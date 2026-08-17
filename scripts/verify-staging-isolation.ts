/**
 * Prove tenant isolation through the real application, not the database.
 *
 * The app reads through Prisma as the table owner, which bypasses RLS, so
 * row-level policies are NOT what keeps one clinic's data away from another
 * clinic's doctor — `requireDoctorContext` + `assertDoctorInClinic` are. That
 * makes an application-level test the only one that proves the thing we care
 * about. A passing RLS check would be reassuring and irrelevant.
 *
 * Signs each QA doctor in for real, carries their session cookie into the API,
 * and asserts:
 *
 *   Doctor A  → own-clinic assessment       200        (positive control)
 *   Doctor B  → own-clinic dashboard        200        (positive control)
 *   Doctor B  → Doctor A's assessment       404/403, and no clinical content
 *   Doctor B  → PATCH Doctor A's assessment 404/403
 *   Doctor B  → approve Doctor A's assessment 404/403
 *   clinic A's stored record                unchanged by either write
 *   anonymous → any assessment              401/403, never 200
 *
 * Both doctors get a positive control, deliberately. A single one only proves
 * the tenant it belongs to: if B's session were simply broken, every denial
 * below would still read PASS while testing nothing.
 *
 * The denial body is inspected, not just the status: a 404 that still leaks a
 * patient name or a diagnosis is a failure wearing a passing status code. The
 * writes are checked the same way — status codes are compared, and then the
 * database row is compared, because a route can answer 404 and still have
 * mutated something.
 *
 * B's positive control is /api/doctor/stats rather than a consultation: clinic
 * B holds no assessments, and creating one to test against would leave a
 * permanent clinical fixture in staging.
 *
 * Creates nothing. The only writes attempted are cross-tenant ones that must
 * fail, and the run proves they left no trace.
 *
 *   npx tsx scripts/verify-staging-isolation.ts [baseUrl]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "../packages/shared/env/databaseTarget";

// The application reads its session from cookies (`supabase.auth.getClaims()`
// over the SSR cookie store) and never looks at an Authorization header, so a
// Bearer token proves nothing here: every request answers 401, the allow-case
// and the deny-case included, and the run "passes" while testing nothing.
//
// Sessions are therefore serialised into the very cookie a browser would
// carry, using the app's own @supabase/ssr — the same encoding and chunking
// the server will decode. It is resolved from the app's node_modules because
// the package is a dependency of the app, not of the repo root; reimplementing
// the cookie format here would be a copy that silently rots.
//
// The client is typed structurally rather than via `typeof import(...)`: the
// package resolves at runtime from the app, but the root tsconfig cannot see
// it, and a bare require would leave the cookie callbacks implicitly `any`.
interface SsrCookie {
  name: string;
  value: string;
}
type CreateServerClient = (
  url: string,
  key: string,
  opts: {
    cookies: {
      getAll: () => SsrCookie[];
      setAll: (list: SsrCookie[]) => void;
    };
  },
) => {
  auth: {
    signInWithPassword: (c: { email: string; password: string }) => Promise<{
      error: { message: string } | null;
    }>;
  };
};

const appRequire = createRequire(
  path.resolve(__dirname, "..", "apps", "patient-portal", "package.json"),
);
const { createServerClient } = appRequire("@supabase/ssr") as {
  createServerClient: CreateServerClient;
};

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? "http://localhost:4000";
const CRED_FILE = path.resolve(__dirname, "..", ".env.staging.qa.local");

function creds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(CRED_FILE, "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Words that must never appear in a denial body. */
function leaks(body: string, needles: string[]): string[] {
  const lower = body.toLowerCase();
  return needles.filter((n) => n && lower.includes(n.toLowerCase()));
}

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${detail}`);
}

/** Sign in and return the `Cookie` header a signed-in browser would send. */
async function signIn(email: string, password: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const jar = new Map<string, string>();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email}: ${error.message}`);
  if (jar.size === 0) throw new Error(`${email}: signed in but no session cookie was written`);
  return [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
}

async function get(assessmentId: string, cookie: string | null) {
  const res = await fetch(`${BASE}/api/consultation/${assessmentId}`, {
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, body: await res.text() };
}

/** Any method/path, so the write attempts below use the same session plumbing. */
async function call(
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.text() };
}

/**
 * What clinic A's assessment looks like in the database right now.
 *
 * A denied write must be proved by the data, not by the status code it
 * answered with. If a cross-tenant PATCH or approve ever did land, the route
 * could still return 404 while a ConsultationVersion appeared or the review
 * decision flipped — so the state is captured either side of the attempts and
 * compared.
 */
async function writeFingerprint(assessmentId: string) {
  const [versions, assessment] = await Promise.all([
    prisma.consultationVersion.count({
      where: { consultation: { assessmentId } },
    }),
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { reviewDecision: true, reviewedAt: true, status: true },
    }),
  ]);
  return JSON.stringify({ versions, ...assessment });
}

async function main(): Promise<void> {
  const ref = extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(`Refusing: resolved ${ref ?? "unknown"}, expected staging.`);
  }
  console.log(`[isolation] project → staging (${ref})`);
  console.log(`[isolation] app     → ${BASE}\n`);

  const c = creds();

  // One composable assessment in clinic A, plus the patient name that must
  // never surface in a denial.
  //
  // Composability is filtered in JS, not in the `where`: a Prisma JSON-null
  // predicate on `rawResponses` selected legacy rows too, and a legacy row
  // cannot be composed into a Consultation — so the positive control answered
  // 404 and the whole run looked like an isolation failure.
  const candidates = await prisma.assessment.findMany({
    where: { deletedAt: null, clinic: { slug: "drfact-mumbai-test" } },
    select: { id: true, clinicId: true, rawResponses: true, patient: { select: { name: true } } },
    orderBy: { submittedAt: "asc" },
  });
  const clinicA = candidates.find((a) => a.rawResponses !== null);
  if (!clinicA) throw new Error("No composable assessment found in clinic A.");

  console.log(`  clinic A assessment ${clinicA.id}\n`);

  const cookieA = await signIn(c.DOCTOR_A_EMAIL, c.DOCTOR_A_PASSWORD);
  const cookieB = await signIn(c.DOCTOR_B_EMAIL, c.DOCTOR_B_PASSWORD);

  // ── Doctor A → own clinic ────────────────────────────────────────────────
  // The positive control, and the reason the denials below mean anything: if
  // this is not a 200, every "denied" result underneath is just the same
  // failure wearing a different label.
  const aOwn = await get(clinicA.id, cookieA);
  check("Doctor A → own-clinic assessment", aOwn.status === 200, `HTTP ${aOwn.status}`);

  // ── Doctor B → own clinic ────────────────────────────────────────────────
  // B's own positive control. Without it, every denial below is ambiguous:
  // a B session that was simply broken would produce exactly the same 404s
  // and the run would still say PASS.
  //
  // Not /api/consultation, because clinic B has no assessments — an empty
  // clinic is the honest state of the QA tenant and creating one to test
  // against would leave a permanent clinical fixture behind. /api/doctor/stats
  // is clinic-scoped through the same requireDoctorContext() gate and answers
  // 200 with zero rows, which is exactly the proof needed: B is authenticated
  // and authorised inside its own tenant.
  const bOwn = await call("GET", "/api/doctor/stats", cookieB);
  check("Doctor B → own-clinic dashboard", bOwn.status === 200, `HTTP ${bOwn.status}`);

  // ── Doctor B → Doctor A's clinic ─────────────────────────────────────────
  const bCross = await get(clinicA.id, cookieB);
  check(
    "Doctor B → other-clinic assessment denied",
    bCross.status === 404 || bCross.status === 403,
    `HTTP ${bCross.status}`,
  );
  const leaked = leaks(bCross.body, [clinicA.patient?.name ?? "", clinicA.clinicId]);
  check("Doctor B denial leaks no PHI/tenant id", leaked.length === 0, leaked.length ? `LEAKED: ${leaked.join(", ")}` : "clean");

  // ── Doctor B → writing Doctor A's clinic ─────────────────────────────────
  // Reads being isolated says nothing about writes: they are separate handlers
  // with separate gates, and a revise or an approve that crossed a tenant
  // boundary would corrupt another clinic's clinical record rather than merely
  // expose it. Approval is included because it is the highest-consequence
  // write in the product — it can mint a kit order.
  //
  // Read the PATCH result carefully: it answers ASSESSMENT_NOT_FOUND, byte for
  // byte what a nonexistent id answers, because the route deliberately refuses
  // to confirm that another tenant's assessment exists. That status on its own
  // therefore proves nothing. Three facts together do:
  //
  //   • Doctor A fetched this same id successfully above, so it resolves;
  //   • approve answers 403 — a different gate, a different code, so the
  //     request demonstrably reached authorization rather than a routing miss;
  //   • the stored record is byte-identical afterwards.
  //
  // A write positive control (Doctor A patching successfully) is deliberately
  // absent: it would create a ConsultationVersion and leave a permanent
  // fixture in staging, which costs more than it proves.
  const before = await writeFingerprint(clinicA.id);

  const bPatch = await call("PATCH", `/api/consultation/${clinicA.id}`, cookieB, {
    doctorNotes: "cross-tenant write attempt — must never persist",
  });
  check(
    "Doctor B → PATCH other-clinic assessment denied",
    bPatch.status === 404 || bPatch.status === 403,
    `HTTP ${bPatch.status}`,
  );

  const bApprove = await call("POST", `/api/consultation/${clinicA.id}/approve`, cookieB, {});
  check(
    "Doctor B → approve other-clinic assessment denied",
    bApprove.status === 404 || bApprove.status === 403,
    `HTTP ${bApprove.status}`,
  );

  const patchLeak = leaks(bPatch.body + bApprove.body, [
    clinicA.patient?.name ?? "",
    clinicA.clinicId,
  ]);
  check(
    "Doctor B write denials leak no PHI/tenant id",
    patchLeak.length === 0,
    patchLeak.length ? `LEAKED: ${patchLeak.join(", ")}` : "clean",
  );

  // The status codes above are a claim; this is the evidence.
  const after = await writeFingerprint(clinicA.id);
  check(
    "clinic A record unchanged by B's writes",
    before === after,
    before === after ? "identical" : `MUTATED: ${before} → ${after}`,
  );

  // ── anonymous ────────────────────────────────────────────────────────────
  const anon = await get(clinicA.id, null);
  check("anonymous → assessment denied", anon.status === 401 || anon.status === 403, `HTTP ${anon.status}`);
  const anonLeak = leaks(anon.body, [clinicA.patient?.name ?? ""]);
  check("anonymous denial leaks no PHI", anonLeak.length === 0, anonLeak.length ? `LEAKED: ${anonLeak.join(", ")}` : "clean");

  console.log(`\n[isolation] ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
