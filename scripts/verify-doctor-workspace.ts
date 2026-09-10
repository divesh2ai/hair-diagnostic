/**
 * Prove the doctor workspace behaves correctly for the two shapes the launch
 * cohort actually contains — and prove it through the running application,
 * over real sessions, not by reading the code.
 *
 *   Doctor A   drfact-mumbai-test   2 live branches  → branch selector renders
 *   Doctor B   drfact-pune-test     0 live branches  → no branch UI at all
 *   Super Admin                                      → clinician roster shows
 *                                                      the twelve provisioned
 *                                                      doctors who hold no
 *                                                      auth account
 *
 * ── Why QA doctors and not the launch twelve ────────────────────────────────
 * The twelve have no auth accounts by design, so there is no session to sign
 * in with and nothing to carry into a request. What CAN be exercised through a
 * session is the mechanism they will use, and that mechanism is shared: the
 * same layout, the same /api/doctor/locations, the same requireDoctorContext.
 * Doctor A's clinic has two branches, which is the Tender Skin shape in
 * miniature, and Doctor B's has none, which is the shape that must stay clean.
 *
 * The twelve are verified at the layer they exist at by
 * scripts/verify-launch-cohort.ts, and the roster assertions below confirm the
 * Super Admin can see them despite having no account.
 *
 * ── Empty is a state, not a failure ─────────────────────────────────────────
 * Every doctor surface is loaded for Doctor B, whose clinic holds no patients,
 * no assessments and no orders. A production clinic on day one looks exactly
 * like this, and the pages must render an empty state rather than a 500 — so
 * the sweep asserts a real response and no error boundary, and no fixture is
 * ever created to make a screen look populated.
 *
 * Writes nothing.
 *
 *   npx tsx scripts/verify-doctor-workspace.ts [baseUrl]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// The app reads its session from cookies, never an Authorization header, so a
// bearer token proves nothing: allow-case and deny-case would both answer 401
// and the run would "pass" while testing nothing. Sessions are serialised into
// the cookie a browser would carry, using the app's own @supabase/ssr so the
// encoding and chunking match what the server will decode.
interface SsrCookie {
  name: string;
  value: string;
}
type CreateServerClient = (
  url: string,
  key: string,
  opts: { cookies: { getAll: () => SsrCookie[]; setAll: (l: SsrCookie[]) => void } },
) => {
  auth: {
    signInWithPassword: (c: { email: string; password: string }) => Promise<{
      error: { message: string } | null;
    }>;
  };
};

const REPO = path.resolve(__dirname, "..");
const appRequire = createRequire(
  path.resolve(REPO, "apps", "patient-portal", "package.json"),
);
const { createServerClient } = appRequire("@supabase/ssr") as {
  createServerClient: CreateServerClient;
};

const BASE = process.argv[2] ?? "http://localhost:4000";

function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(String.fromCharCode(10))) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line.trim());
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${detail}`);
}

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

/**
 * Every surface a clinician reaches from the workspace nav.
 *
 * /doctor/queue is a deliberate redirect onto the real Review Queue at
 * /doctor/reports — the queue was never moved, only renamed in the UI — so a
 * 307 there is the correct answer, not a broken page.
 */
const SURFACES = [
  "/doctor",
  "/doctor/queue",
  "/doctor/patients",
  "/doctor/reports",
  "/doctor/treatment",
  "/doctor/orders",
  "/doctor/profile",
  "/doctor/settings",
];

async function sweep(label: string, cookie: string) {
  for (const surface of SURFACES) {
    const res = await fetch(`${BASE}${surface}`, {
      headers: { cookie },
      redirect: "manual",
    });
    const body = await res.text();
    const broke = /Application error|Internal Server Error|SHELL_LOAD_FAIL/i.test(body);
    const redirectedToQueue =
      res.status === 307 && (res.headers.get("location") ?? "").startsWith("/doctor/reports");
    check(`${label}: ${surface}`, (res.status === 200 || redirectedToQueue) && !broke, `HTTP ${res.status}`);
  }
}

async function main() {
  for (const [k, v] of Object.entries(readEnvFile(path.resolve(REPO, ".env")))) {
    if (!process.env[k]) process.env[k] = v;
  }
  const c = readEnvFile(path.resolve(REPO, ".env.staging.qa.local"));

  console.log(`[workspace] app → ${BASE}\n`);

  const a = await signIn(c.DOCTOR_A_EMAIL!, c.DOCTOR_A_PASSWORD!);
  const b = await signIn(c.DOCTOR_B_EMAIL!, c.DOCTOR_B_PASSWORD!);
  const sa = await signIn(c.SUPER_ADMIN_EMAIL!, c.SUPER_ADMIN_PASSWORD!);

  // ── Branch context is resolved from the session, never from the request ───
  const locA = await (
    await fetch(`${BASE}/api/doctor/locations`, { headers: { cookie: a } })
  ).json();
  const locB = await (
    await fetch(`${BASE}/api/doctor/locations`, { headers: { cookie: b } })
  ).json();
  check(
    "each session resolves its OWN clinic",
    locA.clinicId !== locB.clinicId,
    `A=${locA.clinicId} B=${locB.clinicId}`,
  );
  check(
    "A: multi-location clinic reports its branches",
    locA.locations.length === 2 && locA.multiLocation === true,
    locA.locations.map((l: { branchName: string }) => l.branchName).join(", "),
  );
  check(
    "B: clinic without branches reports multiLocation=false",
    locB.multiLocation === false,
    `${locB.locations.length} branches`,
  );
  check(
    "payload states records are NOT branch-scoped",
    locA.recordsAreBranchScoped === false,
    "recordsAreBranchScoped=false",
  );

  const anon = await fetch(`${BASE}/api/doctor/locations`, { redirect: "manual" });
  const anonBody = await anon.text();
  check(
    "anonymous denied, and leaks no branch data",
    anon.status !== 200 && !anonBody.includes("branchName"),
    `HTTP ${anon.status}`,
  );

  // ── The rendered workspace ────────────────────────────────────────────────
  const htmlA = await (await fetch(`${BASE}/doctor`, { headers: { cookie: a } })).text();
  const htmlB = await (await fetch(`${BASE}/doctor`, { headers: { cookie: b } })).text();
  check(
    "A: branch selector rendered",
    htmlA.includes("Clinic branch context") && htmlA.includes("Working from"),
    "selector present",
  );
  check(
    "A: every branch offered",
    htmlA.includes("Bandra West") && htmlA.includes("Andheri East"),
    "Bandra West, Andheri East",
  );
  check(
    "A: says records span the whole clinic",
    /records are held by the clinic/i.test(htmlA),
    "stated, not implied",
  );
  check(
    "B: single-location doctor sees NO branch UI",
    !htmlB.includes("Clinic branch context") && !htmlB.includes("Working from"),
    "absent, as required",
  );

  // ── Super Admin sight of clinicians who cannot sign in ────────────────────
  const rosterRes = await fetch(`${BASE}/api/admin/clinicians`, { headers: { cookie: sa } });
  const roster = await rosterRes.json();
  type Row = {
    name: string;
    dashboardAccess: boolean;
    contactStatus: string;
    locationCount: number;
    clinicName: string;
    provisioningSource: string | null;
  };
  const launch: Row[] = (roster.clinicians ?? []).filter(
    (x: Row) => x.provisioningSource === "launch-cohort-2026-09",
  );
  const sonia = launch.find((x) => x.name === "Dr. Sonia Tekchandani");
  check("SA: roster reachable", rosterRes.status === 200, `HTTP ${rosterRes.status}`);
  check(
    "SA: sees all 12 launch clinicians despite no accounts",
    launch.length === 12,
    `${launch.length}/12`,
  );
  check(
    "SA: none of them is reported as able to sign in",
    launch.every((x) => x.dashboardAccess === false),
    "all report No access",
  );
  check(
    "SA: all 12 report CONTACT_REQUIRED",
    launch.every((x) => x.contactStatus === "CONTACT_REQUIRED"),
    `${launch.filter((x) => x.contactStatus === "CONTACT_REQUIRED").length}/12`,
  );
  check(
    "SA: Sonia is ONE row carrying four locations",
    !!sonia &&
      sonia.locationCount === 4 &&
      launch.filter((x) => x.name.includes("Tekchandani")).length === 1,
    sonia ? `${sonia.clinicName} · ${sonia.locationCount} locations` : "missing",
  );
  check(
    "SA: roster also shows accounts that CAN sign in",
    (roster.summary?.dashboardReady ?? 0) >= 1,
    `${roster.summary?.dashboardReady} ready`,
  );

  const rosterAsDoctor = await fetch(`${BASE}/api/admin/clinicians`, {
    headers: { cookie: a },
    redirect: "manual",
  });
  check(
    "doctor → clinician roster denied",
    rosterAsDoctor.status !== 200,
    `HTTP ${rosterAsDoctor.status}`,
  );
  const rosterAnon = await fetch(`${BASE}/api/admin/clinicians`, { redirect: "manual" });
  check("anonymous → clinician roster denied", rosterAnon.status !== 200, `HTTP ${rosterAnon.status}`);

  // ── Every workspace surface, populated and empty ──────────────────────────
  await sweep("B (empty clinic)", b);
  await sweep("A (2 branches)", a);

  console.log(`\n[workspace] ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
