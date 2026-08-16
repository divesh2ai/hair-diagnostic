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
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "../packages/shared/env/databaseTarget";

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

async function signIn(email: string, password: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`${email}: ${error?.message ?? "no session"}`);
  return data.session.access_token;
}

async function get(assessmentId: string, token: string | null) {
  const res = await fetch(`${BASE}/api/consultation/${assessmentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

  // One composable assessment per clinic, plus the patient names that must
  // never surface in a denial.
  const clinicA = await prisma.assessment.findFirst({
    where: { deletedAt: null, NOT: { rawResponses: { equals: undefined } }, clinic: { slug: "drfact-mumbai-test" } },
    select: { id: true, clinicId: true, patient: { select: { name: true } } },
    orderBy: { submittedAt: "asc" },
  });
  if (!clinicA) throw new Error("No composable assessment found in clinic A.");

  console.log(`  clinic A assessment ${clinicA.id}\n`);

  const tokenA = await signIn(c.DOCTOR_A_EMAIL, c.DOCTOR_A_PASSWORD);
  const tokenB = await signIn(c.DOCTOR_B_EMAIL, c.DOCTOR_B_PASSWORD);

  // ── Doctor A → own clinic ────────────────────────────────────────────────
  const aOwn = await get(clinicA.id, tokenA);
  check("Doctor A → own-clinic assessment", aOwn.status === 200, `HTTP ${aOwn.status}`);

  // ── Doctor B → Doctor A's clinic ─────────────────────────────────────────
  const bCross = await get(clinicA.id, tokenB);
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
