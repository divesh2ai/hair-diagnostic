/**
 * Prove the staging QA identities authenticate and carry the right claims.
 *
 * Signs each QA user in through the ordinary password grant against the
 * staging project — the same exchange the login page performs — then decodes
 * the returned access token and checks the claims the application actually
 * reads: `user_role` and `clinic_id`. Those are produced by
 * `public.custom_access_token_hook`, so a missing claim here means the hook is
 * not registered, not that the user is wrong.
 *
 * Nothing sensitive is printed: no password, no access token, no service-role
 * key. Only the decoded authorization claims and the resolved clinic.
 *
 * Read-only. Creates nothing, changes nothing.
 *
 *   npx tsx scripts/verify-staging-auth.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();
const CRED_FILE = path.resolve(__dirname, "..", ".env.staging.qa.local");

function creds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(CRED_FILE, "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Decode a JWT payload without verifying — we only need to read the claims. */
function claims(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY required.");

  const ref = extractSupabaseRef(url);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(`Refusing: resolved ${ref ?? "unknown"}, expected staging (${STAGING_SUPABASE_REF}).`);
  }
  console.log(`[verify-auth] project → staging (${ref})\n`);

  const c = creds();
  const identities = [
    { label: "DOCTOR_A", email: c.DOCTOR_A_EMAIL, password: c.DOCTOR_A_PASSWORD },
    { label: "DOCTOR_B", email: c.DOCTOR_B_EMAIL, password: c.DOCTOR_B_PASSWORD },
    { label: "SUPER_ADMIN", email: c.SUPER_ADMIN_EMAIL, password: c.SUPER_ADMIN_PASSWORD },
  ];

  let hookWorking = true;

  for (const id of identities) {
    const supabase = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: id.email,
      password: id.password,
    });

    if (error || !data.session) {
      console.log(`  ${id.label.padEnd(12)} SIGN-IN FAILED — ${error?.message ?? "no session"}`);
      hookWorking = false;
      continue;
    }

    const jwt = claims(data.session.access_token);
    const userRole = jwt.user_role ?? null;
    const clinicId = jwt.clinic_id ?? null;
    if (!userRole) hookWorking = false;

    // What the application would resolve for this identity.
    const doctor = await prisma.doctor.findFirst({
      where: { supabaseUserId: String(jwt.sub), isActive: true, deletedAt: null },
      select: { name: true, clinicId: true },
    });

    console.log(`  ${id.label}`);
    console.log(`    sub            ${String(jwt.sub).slice(0, 8)}…`);
    console.log(`    user_role      ${userRole ?? "(ABSENT — hook not applied)"}`);
    console.log(`    clinic_id      ${clinicId ?? "(none)"}`);
    console.log(`    Doctor row     ${doctor ? `${doctor.name} @ ${doctor.clinicId}` : "(none — admin identity)"}`);
    console.log(
      `    claim matches  ${doctor ? (clinicId === doctor.clinicId ? "YES" : `NO (jwt=${clinicId} db=${doctor.clinicId})`) : "n/a"}`,
    );
    console.log("");

    await supabase.auth.signOut();
  }

  console.log(
    hookWorking
      ? "[verify-auth] custom_access_token_hook IS applying claims."
      : "[verify-auth] custom_access_token_hook is NOT applying claims — check Auth → Hooks.",
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
