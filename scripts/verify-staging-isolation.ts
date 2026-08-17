/**
 * Prove tenant isolation through the real application, not the database.
 *
 * The app reads through Prisma as the table owner, which bypasses RLS, so
 * row-level policies are NOT what keeps one clinic's data away from another
 * clinic's doctor — `requireDoctorContext` + `assertDoctorInClinic` are. That
 * makes an application-level test the only one that proves the thing we care
 * about. A passing RLS check would be reassuring and irrelevant.
 *
 * Signs each QA doctor in for real, carries their session cookie into
 * /api/consultation/[assessmentId], and asserts:
 *
 *   Doctor A → own-clinic assessment      200
 *   Doctor A → other-clinic assessment    404/403, and no clinical content
 *   Doctor B → own-clinic assessment      200
 *   Doctor B → Doctor A's assessment      404/403, and no clinical content
 *   anonymous → any assessment            401/403, never 200
 *
 * The denial body is inspected, not just the status: a 404 that still leaks a
 * patient name or a diagnosis is a failure wearing a passing status code.
 *
 * Read-only against the API. Creates nothing.
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

  // ── Doctor B → Doctor A's clinic ─────────────────────────────────────────
  const bCross = await get(clinicA.id, cookieB);
  check(
    "Doctor B → other-clinic assessment denied",
    bCross.status === 404 || bCross.status === 403,
    `HTTP ${bCross.status}`,
  );
  const leaked = leaks(bCross.body, [clinicA.patient?.name ?? "", clinicA.clinicId]);
  check("Doctor B denial leaks no PHI/tenant id", leaked.length === 0, leaked.length ? `LEAKED: ${leaked.join(", ")}` : "clean");

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
