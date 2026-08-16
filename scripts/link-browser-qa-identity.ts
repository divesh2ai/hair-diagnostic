/**
 * Link the dev-login browser identity to a clinic-A doctor.
 *
 * The login page's "Dev sign-in" button is hardcoded to the repo owner's
 * address, and `/api/dev/login` creates that auth user on first use via
 * `generateLink`. That gives browser QA a real session through the app's own
 * designed staging path — but the resulting user resolves to no Doctor row, so
 * `requireDoctorContext` answers 403 no_doctor_membership and every doctor
 * surface stays shut.
 *
 * Linking it to an already-seeded clinic-A doctor closes that gap without
 * inventing a new auth mechanism or weakening a check: the session still
 * resolves through supabaseUserId exactly as production does.
 *
 * `Doctor.supabaseUserId` is unique, so this attaches to Dr Test B rather than
 * Dr Test A — Dr Test A already belongs to the scripted QA identity used by
 * the isolation test, and stealing its link would silently break that test.
 *
 * Staging only. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import {
  assertSafeDatabaseTarget,
  extractSupabaseRef,
  STAGING_SUPABASE_REF,
} from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();
const BROWSER_EMAIL = "divesh2ai@gmail.com";
const TARGET_DOCTOR = "Dr Test B";

async function main(): Promise<void> {
  assertSafeDatabaseTarget(process.env, "link-browser-qa-identity");
  const ref =
    extractSupabaseRef(process.env.DIRECT_URL) ??
    extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(`Refusing: resolved ${ref ?? "unknown"}, expected staging.`);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);

  const user = data.users.find(
    (u) => u.email?.toLowerCase() === BROWSER_EMAIL.toLowerCase(),
  );
  if (!user) {
    console.log(`[link-browser-qa] ${BROWSER_EMAIL} has no auth user yet — press "Dev sign-in" once, then re-run.`);
    console.log(`[link-browser-qa] auth users present: ${data.users.length}`);
    return;
  }

  const doctor = await prisma.doctor.findFirst({
    where: { name: TARGET_DOCTOR, deletedAt: null },
    select: { id: true, clinicId: true, name: true },
  });
  if (!doctor) throw new Error(`${TARGET_DOCTOR} not found — run seed:clinic first.`);

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { supabaseUserId: user.id, isActive: true },
  });

  console.log(`[link-browser-qa] ${BROWSER_EMAIL} → ${doctor.name} @ ${doctor.clinicId}`);
  console.log(`[link-browser-qa] auth users present: ${data.users.length}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
