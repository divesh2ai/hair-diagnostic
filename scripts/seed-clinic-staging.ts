/**
 * Synthetic clinic for staging end-to-end testing.
 *
 * ── What it builds ──────────────────────────────────────────────────────────
 *   Clinic          DrFACT Mumbai Test Clinic  (slug: drfact-mumbai-test)
 *   Locations       Bandra West (primary) · Andheri East
 *   Doctors         Dr Test A · Dr Test B · Dr Test C
 *   Patients        Priya Sharma (NEW)  — no history, first visit is the E2E walk
 *                   Rahul Mehta (RETURNING) — one prior assessment to match against
 *                   Neha Verma (AMBIGUOUS)  — two records sharing one number
 *   Return visits   one submitted assessment per VisitType that isn't INITIAL
 *
 * ── Every row is fabricated ─────────────────────────────────────────────────
 * Names, numbers and addresses are invented. Nothing is copied, sampled or
 * derived from production. The mobile numbers sit in +9199000xxxxx, which is
 * inside the reserved-looking 99000 block and is not an allocated Indian
 * subscriber range, so a misconfigured WhatsApp credential cannot reach a real
 * person. (Staging leaves the WhatsApp provider unset anyway — see
 * .env.staging.example — but a seed should not depend on that being true.)
 *
 * ── Guards ──────────────────────────────────────────────────────────────────
 * Three, deliberately overlapping:
 *   1. assertSafeDatabaseTarget — refuses the production project by identity,
 *      the same check the runtime uses. Not satisfiable by any flag below.
 *   2. STAGING_SUPABASE_REF — refuses anything that is not *this* staging
 *      project. A local Postgres passes (1) but is not what this seed is for.
 *   3. CLINIC_SEED_ALLOW=1 — an explicit act, so the script cannot run as a
 *      side effect of a Makefile, a postinstall, or a mistyped npm script.
 *
 * Route it through the CLI guard as well, which is what `npm run seed:clinic`
 * does:  tsx scripts/db-cli-guard.ts tsx scripts/seed-clinic-staging.ts
 *
 * ── Idempotent ──────────────────────────────────────────────────────────────
 * Everything upserts on a stable natural key, so re-running converges rather
 * than duplicating. That matters more here than usual: the RETURNING and
 * AMBIGUOUS cases are *defined* by how many Patient rows carry a number, so a
 * seed that appended on every run would silently turn RETURNING into
 * AMBIGUOUS and invalidate the test it exists to support.
 *
 * Usage:
 *   CLINIC_SEED_ALLOW=1 npm run seed:clinic
 */
import {
  PrismaClient,
  AssessmentSource,
  AssessmentStatus,
  ClinicLocationStatus,
  ClinicStatus,
  IdentityResolutionStatus,
  PatientRelationshipState,
  ReviewDecision,
  VisitType,
} from "@prisma/client";
import {
  assertSafeDatabaseTarget,
  extractSupabaseRef,
  STAGING_SUPABASE_REF,
} from "../packages/shared/env/databaseTarget";

const prisma = new PrismaClient();

const CLINIC_SLUG = "drfact-mumbai-test";
const CLINIC_NAME = "DrFACT Mumbai Test Clinic";

/** Marks every row this script creates, so a cleanup query can find them. */
const SEED_MARKER = "seed-clinic-staging";

const DOCTORS = [
  { key: "a", name: "Dr Test A", email: "dr.test.a@drfact.staging", specialization: "Trichology", isPrimary: true },
  { key: "b", name: "Dr Test B", email: "dr.test.b@drfact.staging", specialization: "Dermatology", isPrimary: false },
  { key: "c", name: "Dr Test C", email: "dr.test.c@drfact.staging", specialization: "Dermatology", isPrimary: false },
] as const;

// Reserved-looking, non-allocated. See header.
const PHONE = {
  priya: "+919900010001",
  rahul: "+919900010002",
  neha: "+919900010003",
  followUp: "+919900010011",
  kitFulfilment: "+919900010012",
  reassessment: "+919900010013",
  newConcern: "+919900010014",
  conditionChanged: "+919900010015",
} as const;

function guard(): void {
  // (1) Production is refused by identity, whatever else is set.
  assertSafeDatabaseTarget(process.env, "seed-clinic-staging");

  // (2) …and staging is required positively, so this never lands somewhere
  // merely "not production".
  const ref =
    extractSupabaseRef(process.env.DIRECT_URL) ??
    extractSupabaseRef(process.env.DATABASE_URL) ??
    extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (ref !== STAGING_SUPABASE_REF) {
    throw new Error(
      `[seed-clinic-staging] refusing to run against ${ref ?? "an unrecognised database"}.\n` +
        `This seed is for the staging project (${STAGING_SUPABASE_REF}) only.\n` +
        `Copy .env.staging.example over .env and fill in the two secrets.`,
    );
  }

  // (3) …and it has to be asked for.
  if (process.env.CLINIC_SEED_ALLOW !== "1") {
    throw new Error(
      "[seed-clinic-staging] set CLINIC_SEED_ALLOW=1 to run this seed.\n" +
        "  CLINIC_SEED_ALLOW=1 npm run seed:clinic",
    );
  }
}

/** Minutes ago, as a Date. Keeps the waiting-time fixtures readable. */
function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60_000);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60_000);
}

async function seedClinic() {
  return prisma.clinic.upsert({
    where: { slug: CLINIC_SLUG },
    update: { name: CLINIC_NAME, status: ClinicStatus.ACTIVE, isActive: true },
    create: {
      name: CLINIC_NAME,
      slug: CLINIC_SLUG,
      region: "Mumbai",
      language: "en",
      timezone: "Asia/Kolkata",
      address: "Synthetic address — staging only",
      phone: "+919900000000",
      email: "reception@drfact.staging",
      status: ClinicStatus.ACTIVE,
      isActive: true,
      settings: { seededBy: SEED_MARKER },
    },
  });
}

/**
 * Locations. Bandra West is primary; Andheri East is not.
 *
 * The partial unique index in 20260812_clinic_locations permits exactly one
 * live primary per clinic, so these two rows are also the fixture that P0-8's
 * concurrent-promotion test runs against.
 *
 * There is no natural unique key on (clinicId, branchName), so the upsert is
 * done by hand rather than with `upsert`.
 */
async function seedLocations(clinicId: string) {
  const wanted = [
    {
      branchName: "Bandra West",
      isPrimary: true,
      addressLine1: "1 Synthetic Road",
      city: "Mumbai",
      district: "Mumbai Suburban",
      state: "Maharashtra",
      pincode: "400050",
      phone: "+919900000001",
    },
    {
      branchName: "Andheri East",
      isPrimary: false,
      addressLine1: "2 Synthetic Road",
      city: "Mumbai",
      district: "Mumbai Suburban",
      state: "Maharashtra",
      pincode: "400069",
      phone: "+919900000002",
    },
  ];

  const out = [];
  for (const spec of wanted) {
    const existing = await prisma.clinicLocation.findFirst({
      where: { clinicId, branchName: spec.branchName, deletedAt: null },
    });
    out.push(
      existing
        ? await prisma.clinicLocation.update({
            where: { id: existing.id },
            data: { ...spec, status: ClinicLocationStatus.ACTIVE },
          })
        : await prisma.clinicLocation.create({
            data: { ...spec, clinicId, status: ClinicLocationStatus.ACTIVE },
          }),
    );
  }
  return out;
}

async function seedDoctors(clinicId: string) {
  const out: Record<string, { id: string; name: string }> = {};
  for (const d of DOCTORS) {
    const row = await prisma.doctor.upsert({
      where: { email: d.email },
      update: { name: d.name, clinicId, isActive: true, deletedAt: null },
      create: {
        clinicId,
        name: d.name,
        email: d.email,
        phone: `+91990000010${d.key.charCodeAt(0) - 96}`,
        specialization: d.specialization,
        isPrimary: d.isPrimary,
        isActive: true,
      },
    });
    out[d.key] = { id: row.id, name: row.name };
  }
  return out;
}

/**
 * Upsert a patient by (clinicId, phoneNormalized, name).
 *
 * Deliberately keyed on the name as well. The AMBIGUOUS fixture needs *two*
 * rows sharing one number; keying on the number alone would make the second
 * call update the first row and the ambiguity would never exist.
 */
async function upsertPatient(input: {
  clinicId: string;
  name: string;
  phoneE164: string;
  age: number;
  gender: string;
  identityResolutionStatus?: IdentityResolutionStatus;
  createdAt?: Date;
}) {
  const existing = await prisma.patient.findFirst({
    where: {
      clinicId: input.clinicId,
      phoneNormalized: input.phoneE164,
      name: input.name,
      deletedAt: null,
    },
  });

  const data = {
    clinicId: input.clinicId,
    name: input.name,
    phone: input.phoneE164,
    phoneNormalized: input.phoneE164,
    age: input.age,
    gender: input.gender,
    identityResolutionStatus:
      input.identityResolutionStatus ?? IdentityResolutionStatus.RESOLVED,
    identityFlaggedAt:
      input.identityResolutionStatus === IdentityResolutionStatus.AMBIGUOUS
        ? new Date()
        : null,
    isActive: true,
  };

  return existing
    ? prisma.patient.update({ where: { id: existing.id }, data })
    : prisma.patient.create({
        data: { ...data, ...(input.createdAt ? { createdAt: input.createdAt } : {}) },
      });
}

/**
 * A prior, already-reviewed assessment. This is the *history* a returning
 * patient is matched against — not the visit under test.
 *
 * Reviewed and attributed to a doctor on purpose: an unreviewed prior visit
 * would sit in the Review Queue and pollute the FIFO ordering that P0-4 checks.
 */
async function seedHistoricalAssessment(input: {
  clinicId: string;
  patientId: string;
  reviewingDoctorId: string;
  visitType: VisitType;
  relationship: PatientRelationshipState;
  submittedAt: Date;
}) {
  const existing = await prisma.assessment.findFirst({
    where: {
      patientId: input.patientId,
      visitType: input.visitType,
      submittedAt: input.submittedAt,
    },
  });
  if (existing) return existing;

  return prisma.assessment.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      reviewingDoctorId: input.reviewingDoctorId,
      reviewDecision: ReviewDecision.APPROVED,
      reviewedAt: new Date(input.submittedAt.getTime() + 12 * 60_000),
      status: AssessmentStatus.COMPLETED,
      source: AssessmentSource.QR,
      visitType: input.visitType,
      patientRelationship: input.relationship,
      submittedAt: input.submittedAt,
    },
  });
}

async function main() {
  guard();

  const clinic = await seedClinic();
  const locations = await seedLocations(clinic.id);
  const doctors = await seedDoctors(clinic.id);

  // ── NEW ───────────────────────────────────────────────────────────────────
  // Priya has a Patient row but no assessment, so /api/patient/lookup answers
  // RETURNING for her number. The NEW walk-through in P0-3 uses a number that
  // has never been seen instead — see NEW_PATIENT_PHONE printed at the end.
  // She is seeded only so the dashboard has a recognisable name to show when
  // testing the returning path.

  const rahul = await upsertPatient({
    clinicId: clinic.id,
    name: "Rahul Mehta",
    phoneE164: PHONE.rahul,
    age: 34,
    gender: "male",
    createdAt: daysAgo(90),
  });
  await seedHistoricalAssessment({
    clinicId: clinic.id,
    patientId: rahul.id,
    reviewingDoctorId: doctors.a.id,
    visitType: VisitType.INITIAL,
    relationship: PatientRelationshipState.NEW,
    submittedAt: daysAgo(90),
  });

  // ── AMBIGUOUS ─────────────────────────────────────────────────────────────
  // Two Patient rows, same clinic, same number, different people. This is the
  // shape lib/patient/identity refuses to disambiguate: it must quarantine the
  // visit onto a fresh row rather than attach it to either of these.
  //
  // Both are seeded RESOLVED. The AMBIGUOUS flag is what the *application*
  // writes when it meets this data — seeding the flag directly would test the
  // seed rather than the resolver.
  const nehaOlder = await upsertPatient({
    clinicId: clinic.id,
    name: "Neha Verma",
    phoneE164: PHONE.neha,
    age: 29,
    gender: "female",
    createdAt: daysAgo(200),
  });
  const nehaNewer = await upsertPatient({
    clinicId: clinic.id,
    name: "Neha Verma (household)",
    phoneE164: PHONE.neha,
    age: 52,
    gender: "female",
    createdAt: daysAgo(40),
  });
  await seedHistoricalAssessment({
    clinicId: clinic.id,
    patientId: nehaOlder.id,
    reviewingDoctorId: doctors.b.id,
    visitType: VisitType.INITIAL,
    relationship: PatientRelationshipState.NEW,
    submittedAt: daysAgo(200),
  });
  await seedHistoricalAssessment({
    clinicId: clinic.id,
    patientId: nehaNewer.id,
    reviewingDoctorId: doctors.c.id,
    visitType: VisitType.INITIAL,
    relationship: PatientRelationshipState.NEW,
    submittedAt: daysAgo(40),
  });

  // ── One returning patient per non-INITIAL visit intent ────────────────────
  // Each has history, so selecting the matching intent at intake is a
  // realistic path rather than a synthetic one.
  const intents: Array<{ name: string; phone: string; visitType: VisitType }> = [
    { name: "Anita Desai", phone: PHONE.followUp, visitType: VisitType.FOLLOW_UP },
    { name: "Vikram Rao", phone: PHONE.kitFulfilment, visitType: VisitType.KIT_FULFILMENT },
    { name: "Sneha Iyer", phone: PHONE.reassessment, visitType: VisitType.REASSESSMENT },
    { name: "Arjun Nair", phone: PHONE.newConcern, visitType: VisitType.NEW_CONCERN },
    { name: "Meera Joshi", phone: PHONE.conditionChanged, visitType: VisitType.CONDITION_CHANGED },
  ];

  const seededIntents = [];
  for (const [i, intent] of intents.entries()) {
    const patient = await upsertPatient({
      clinicId: clinic.id,
      name: intent.name,
      phoneE164: intent.phone,
      age: 30 + i,
      gender: i % 2 === 0 ? "female" : "male",
      createdAt: daysAgo(120 + i),
    });
    // The prior INITIAL visit that makes them "returning"…
    await seedHistoricalAssessment({
      clinicId: clinic.id,
      patientId: patient.id,
      reviewingDoctorId: doctors.a.id,
      visitType: VisitType.INITIAL,
      relationship: PatientRelationshipState.NEW,
      submittedAt: daysAgo(120 + i),
    });
    // …and a completed return visit carrying the intent under test.
    await seedHistoricalAssessment({
      clinicId: clinic.id,
      patientId: patient.id,
      reviewingDoctorId: doctors.b.id,
      visitType: intent.visitType,
      relationship: PatientRelationshipState.RETURNING,
      submittedAt: daysAgo(20 + i),
    });
    seededIntents.push({ ...intent, patientId: patient.id });
  }

  // ── Priya, for the returning-path dashboard fixture ───────────────────────
  const priya = await upsertPatient({
    clinicId: clinic.id,
    name: "Priya Sharma",
    phoneE164: PHONE.priya,
    age: 27,
    gender: "female",
    createdAt: daysAgo(1),
  });

  const counts = {
    patients: await prisma.patient.count({ where: { clinicId: clinic.id, deletedAt: null } }),
    assessments: await prisma.assessment.count({ where: { clinicId: clinic.id } }),
    openVisits: await prisma.clinicVisit.count({
      where: { clinicId: clinic.id, assessmentId: null },
    }),
  };

  console.log("\n─ Synthetic clinic seeded ────────────────────────────────────");
  console.log(`clinic            ${clinic.name}`);
  console.log(`clinicId          ${clinic.id}`);
  console.log(`clinic URL        /q/${clinic.slug}`);
  console.log(`locations         ${locations.map((l) => `${l.branchName}${l.isPrimary ? " (primary)" : ""}`).join(" · ")}`);
  console.log(`doctors           ${DOCTORS.map((d) => d.name).join(" · ")}`);
  console.log("");
  console.log(`NEW      (unseen) use any number NOT listed here, e.g. +919900019999`);
  console.log(`         Priya Sharma exists at ${PHONE.priya} for the returning fixture`);
  console.log(`RETURNING          Rahul Mehta        ${PHONE.rahul}`);
  console.log(`AMBIGUOUS          Neha Verma x2      ${PHONE.neha}  (patients ${nehaOlder.id}, ${nehaNewer.id})`);
  for (const s of seededIntents) {
    console.log(`${s.visitType.padEnd(18)} ${s.name.padEnd(18)} ${s.phone}`);
  }
  console.log("");
  console.log(`patients          ${counts.patients}`);
  console.log(`assessments       ${counts.assessments}`);
  console.log(`open visits       ${counts.openVisits}`);
  console.log(`priya patientId   ${priya.id}`);
  console.log("──────────────────────────────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
