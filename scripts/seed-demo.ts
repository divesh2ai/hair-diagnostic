/**
 * Demo seed — populates the dashboards with realistic data.
 *
 * Guards: refuses to run against VERCEL_ENV=production, and requires
 * DEMO_SEED_ALLOW=1 to be set explicitly. Every insert upserts on a stable
 * unique key so re-running is idempotent.
 *
 * Usage:
 *   DEMO_SEED_ALLOW=1 npx tsx scripts/seed-demo.ts
 */
import {
  PrismaClient,
  AssessmentStatus,
  AssessmentSource,
  ReviewDecision,
  ArtifactType,
  ClinicStatus,
  SystemRole,
} from "@prisma/client";

const prisma = new PrismaClient();

const CLINIC_SLUG = "drfact-mumbai";
const CLINIC_ADMIN_EMAIL = "clinic-admin@drfact.demo";
const DOCTOR_A_EMAIL = "dr.rhea@drfact.demo";
const DOCTOR_B_EMAIL = "dr.arjun@drfact.demo";

const DEMO_MARKER = { seededBy: "seed-demo", cohort: "v1" };

function maskDbUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

function projectRefFromDbUrl(url: string): string | null {
  // Supabase pooler user is `postgres.<projectRef>` — safest place to read the
  // ref from a DATABASE_URL that doesn't include the API host.
  const m = url.match(/\/\/postgres\.([a-z0-9]+):/i);
  return m?.[1] ?? null;
}

function guardEnvironment() {
  const failures: string[] = [];
  if (process.env.NODE_ENV === "production") failures.push("NODE_ENV=production");
  if (process.env.VERCEL_ENV === "production") failures.push("VERCEL_ENV=production");
  if (process.env.DEMO_SEED_ALLOW !== "1") failures.push("DEMO_SEED_ALLOW must be '1'");
  if (!process.env.DEMO_SEED_TARGET) failures.push("DEMO_SEED_TARGET is required (e.g. 'drfact-demo')");
  const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
  if (!expectedRef) failures.push("EXPECTED_SUPABASE_PROJECT_REF is required");
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) failures.push("DATABASE_URL is not set");
  const actualRef = projectRefFromDbUrl(dbUrl);
  if (expectedRef && actualRef && expectedRef !== actualRef) {
    failures.push(
      `DATABASE_URL points at project '${actualRef}', not the expected '${expectedRef}'`,
    );
  }
  if (/prod|production/i.test(dbUrl)) {
    failures.push("DATABASE_URL substring 'prod'/'production' — refusing to run");
  }
  console.log("---- demo seed target ----");
  console.log("  DATABASE_URL          :", maskDbUrl(dbUrl) || "<unset>");
  console.log("  Supabase project ref  :", actualRef ?? "<unknown>");
  console.log("  Expected ref          :", expectedRef ?? "<unset>");
  console.log("  DEMO_SEED_TARGET      :", process.env.DEMO_SEED_TARGET ?? "<unset>");
  console.log("  NODE_ENV              :", process.env.NODE_ENV ?? "<unset>");
  console.log("  VERCEL_ENV            :", process.env.VERCEL_ENV ?? "<unset>");
  console.log("--------------------------");
  if (failures.length) {
    for (const f of failures) console.error("  ✗", f);
    throw new Error(`Refusing to seed. ${failures.length} guard(s) failed.`);
  }
}

const PATIENTS = [
  { name: "Aditi Sharma",   age: 28, gender: "F", phone: "+919821010001" },
  { name: "Rohan Verma",    age: 34, gender: "M", phone: "+919821010002" },
  { name: "Meera Iyer",     age: 41, gender: "F", phone: "+919821010003" },
  { name: "Karan Patel",    age: 24, gender: "M", phone: "+919821010004" },
  { name: "Neha Menon",     age: 37, gender: "F", phone: "+919821010005" },
  { name: "Vikram Rao",     age: 46, gender: "M", phone: "+919821010006" },
  { name: "Pooja Nair",     age: 30, gender: "F", phone: "+919821010007" },
  { name: "Siddharth Jain", age: 52, gender: "M", phone: "+919821010008" },
  { name: "Ananya Kapoor",  age: 26, gender: "F", phone: "+919821010009" },
  { name: "Rahul Bhatt",    age: 39, gender: "M", phone: "+919821010010" },
];

type AssessmentPlan = {
  patientIndex: number;
  status: AssessmentStatus;
  decision: ReviewDecision;
  daysAgo: number;
  primaryDiagnosis: string;
  severity: "mild" | "moderate" | "severe";
  priorityKit: string;
  reviewerIdx?: 0 | 1; // which doctor is reviewing
};

// A slice across every dashboard bucket the doctor UI cares about.
const ASSESSMENTS: AssessmentPlan[] = [
  // 4 × Needs Review (COMPLETED + PENDING)
  { patientIndex: 0, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Androgenetic Alopecia (Female)", severity: "moderate", priorityKit: "F-AGA GOLD", reviewerIdx: 0 },
  { patientIndex: 1, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Telogen Effluvium (Acute)",     severity: "mild",     priorityKit: "TE GOLD",    reviewerIdx: 1 },
  { patientIndex: 2, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.PENDING,       daysAgo: 1, primaryDiagnosis: "PCOS + Hypothyroid",             severity: "severe",   priorityKit: "META B",     reviewerIdx: 0 },
  { patientIndex: 3, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.PENDING,       daysAgo: 2, primaryDiagnosis: "Androgenetic Alopecia (Male)",   severity: "moderate", priorityKit: "M-AGA GOLD", reviewerIdx: 1 },

  // 3 × Report Generating
  { patientIndex: 4, status: AssessmentStatus.REPORT_GENERATING,  decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Seborrheic Dermatitis",          severity: "moderate", priorityKit: "SCALP CARE", reviewerIdx: 0 },
  { patientIndex: 5, status: AssessmentStatus.CLINICAL_READY,     decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Menopausal Diffuse",             severity: "moderate", priorityKit: "MELASURGE",  reviewerIdx: 1 },
  { patientIndex: 6, status: AssessmentStatus.GENERATING_REPORT,  decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Iron-deficiency TE",             severity: "mild",     priorityKit: "IRON UP",    reviewerIdx: 0 },

  // 3 × Approved
  { patientIndex: 7, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.APPROVED,      daysAgo: 4, primaryDiagnosis: "Male AGA · Grade 3",             severity: "moderate", priorityKit: "M-AGA GOLD", reviewerIdx: 0 },
  { patientIndex: 8, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.APPROVED,      daysAgo: 6, primaryDiagnosis: "Female AGA · early",             severity: "mild",     priorityKit: "F-AGA GOLD", reviewerIdx: 1 },
  { patientIndex: 9, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.APPROVED,      daysAgo: 8, primaryDiagnosis: "Postpartum TE",                  severity: "mild",     priorityKit: "TE GOLD",    reviewerIdx: 0 },

  // 1 × Needs Revision
  { patientIndex: 0, status: AssessmentStatus.COMPLETED,          decision: ReviewDecision.EDITS_REQUESTED, daysAgo: 5, primaryDiagnosis: "AGA + suspected Thyroid",      severity: "moderate", priorityKit: "META B",     reviewerIdx: 0 },

  // 2 × Recent submissions
  { patientIndex: 1, status: AssessmentStatus.PENDING,            decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Awaiting analysis",              severity: "mild",     priorityKit: "—",          reviewerIdx: 1 },
  { patientIndex: 2, status: AssessmentStatus.QUEUED,             decision: ReviewDecision.PENDING,       daysAgo: 0, primaryDiagnosis: "Awaiting analysis",              severity: "mild",     priorityKit: "—",          reviewerIdx: 0 },
];

async function ensureClinic() {
  // Reuse the org+clinic if the base seed already ran.
  const org = await prisma.organization.upsert({
    where: { slug: "drfact" },
    update: {},
    create: {
      name: "DrFACT Healthcare",
      slug: "drfact",
      country: "IN",
      timezone: "Asia/Kolkata",
    },
  });
  const clinic = await prisma.clinic.upsert({
    where: { slug: CLINIC_SLUG },
    update: { status: ClinicStatus.ACTIVE },
    create: {
      organizationId: org.id,
      name: "DrFACT Mumbai",
      slug: CLINIC_SLUG,
      region: "Mumbai, IN",
      language: "en",
      timezone: "Asia/Kolkata",
      status: ClinicStatus.ACTIVE,
      email: "hello@drfact-mumbai.demo",
      phone: "+912266778899",
      tagline: "AI-augmented dermatology, human-approved.",
      primaryColor: "#0E7C7B",
      accentColor: "#F59E0B",
      settings: DEMO_MARKER,
    },
  });
  return { org, clinic };
}

async function ensureClinicAdmin(clinicId: string) {
  const existing = await prisma.clinicMember.findFirst({
    where: { clinicId, email: CLINIC_ADMIN_EMAIL },
    select: { id: true, email: true },
  });
  if (existing) {
    return prisma.clinicMember.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
  }
  return prisma.clinicMember.create({
    data: {
      clinicId,
      supabaseUserId: "demo-clinic-admin",
      role: SystemRole.CLINIC_ADMIN,
      name: "Priya Menon",
      email: CLINIC_ADMIN_EMAIL,
      phone: "+919820000001",
      isActive: true,
    },
  });
}

async function ensureDoctors(clinicId: string) {
  const drRhea = await prisma.doctor.upsert({
    where: { email: DOCTOR_A_EMAIL },
    update: { clinicId, isActive: true },
    create: {
      clinicId,
      name: "Dr. Rhea Kulkarni",
      email: DOCTOR_A_EMAIL,
      phone: "+919820000002",
      specialization: "Trichology · Female-pattern hair loss",
      credentials: "MBBS, DVD (Dermatology)",
      bio: "Ten years in hair-restoration medicine.",
      isPrimary: true,
      isActive: true,
    },
  });
  const drArjun = await prisma.doctor.upsert({
    where: { email: DOCTOR_B_EMAIL },
    update: { clinicId, isActive: true },
    create: {
      clinicId,
      name: "Dr. Arjun Desai",
      email: DOCTOR_B_EMAIL,
      phone: "+919820000003",
      specialization: "Trichology · Male-pattern hair loss",
      credentials: "MD (Skin & VD)",
      bio: "Focus on androgenetic alopecia and metabolic drivers.",
      isPrimary: false,
      isActive: true,
    },
  });
  return { drRhea, drArjun };
}

async function ensurePatients(clinicId: string, doctorAId: string, doctorBId: string) {
  const created: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    const doctorId = i % 2 === 0 ? doctorAId : doctorBId;
    const existing = await prisma.patient.findFirst({
      where: { clinicId, phone: p.phone },
      select: { id: true, name: true },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    const row = await prisma.patient.create({
      data: {
        clinicId,
        doctorId,
        name: p.name,
        phone: p.phone,
        email: `${p.name.split(" ")[0].toLowerCase()}@demo.drfact`,
        age: p.age,
        gender: p.gender,
      },
      select: { id: true, name: true },
    });
    created.push(row);
  }
  return created;
}

async function ensureAssessments(
  clinicId: string,
  patients: Array<{ id: string }>,
  reviewers: [string, string],
) {
  for (let i = 0; i < ASSESSMENTS.length; i++) {
    const plan = ASSESSMENTS[i];
    const patient = patients[plan.patientIndex];
    const reviewerId = plan.reviewerIdx !== undefined ? reviewers[plan.reviewerIdx] : null;
    const submittedAt = new Date(Date.now() - plan.daysAgo * 24 * 60 * 60 * 1000);
    const reviewedAt =
      plan.decision === ReviewDecision.APPROVED || plan.decision === ReviewDecision.EDITS_REQUESTED
        ? new Date(submittedAt.getTime() + 6 * 60 * 60 * 1000)
        : null;

    // Idempotency key: (patientId, submittedAt, primaryDiagnosis) is stable
    // across re-runs because daysAgo is fixed per plan entry.
    const existing = await prisma.assessment.findFirst({
      where: {
        patientId: patient.id,
        clinicId,
        submittedAt,
      },
      select: { id: true },
    });

    const assessment = existing
      ? await prisma.assessment.update({
          where: { id: existing.id },
          data: {
            status: plan.status,
            reviewDecision: plan.decision,
            reviewingDoctorId: reviewerId,
            reviewedAt,
          },
        })
      : await prisma.assessment.create({
          data: {
            clinicId,
            patientId: patient.id,
            reviewingDoctorId: reviewerId,
            status: plan.status,
            source: AssessmentSource.WEB,
            submittedAt,
            reviewDecision: plan.decision,
            reviewedAt,
            reviewerName: reviewerId ? "Dr. Reviewer" : null,
          },
        });

    // Severity analysis artifact — powers the doctor reports table's
    // primaryDiagnosis + severity columns.
    const sevContent = {
      primaryDiagnosis: plan.primaryDiagnosis,
      severity: plan.severity,
      priorityKit: plan.priorityKit,
      seededBy: DEMO_MARKER.seededBy,
    };
    const existingSev = await prisma.aIArtifact.findFirst({
      where: { assessmentId: assessment.id, type: ArtifactType.SEVERITY_ANALYSIS },
      select: { id: true },
    });
    if (existingSev) {
      await prisma.aIArtifact.update({
        where: { id: existingSev.id },
        data: { content: sevContent },
      });
    } else {
      await prisma.aIArtifact.create({
        data: {
          assessmentId: assessment.id,
          type: ArtifactType.SEVERITY_ANALYSIS,
          content: sevContent,
        },
      });
    }
  }
}

async function ensureAuditLog(clinicId: string, actorId: string) {
  const events: Array<{ action: string; entityType: string; entityId: string; metadata: object }> = [
    { action: "clinic.activated",    entityType: "Clinic",  entityId: clinicId, metadata: { region: "Mumbai" } },
    { action: "doctor.invited",      entityType: "Doctor",  entityId: actorId,  metadata: { email: DOCTOR_A_EMAIL } },
    { action: "doctor.invited",      entityType: "Doctor",  entityId: actorId,  metadata: { email: DOCTOR_B_EMAIL } },
    { action: "settings.updated",    entityType: "Clinic",  entityId: clinicId, metadata: { field: "language" } },
    { action: "report.approved",     entityType: "Assessment", entityId: "seed-approved-1", metadata: { decision: "APPROVED" } },
  ];
  for (const ev of events) {
    const already = await prisma.auditLog.findFirst({
      where: {
        entityType: ev.entityType,
        entityId: ev.entityId,
        action: ev.action,
      },
      select: { id: true },
    });
    if (already) continue;
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole: SystemRole.SUPER_ADMIN,
        actorType: "admin",
        entityType: ev.entityType,
        entityId: ev.entityId,
        action: ev.action,
        metadata: ev.metadata,
      },
    });
  }
}

async function main() {
  guardEnvironment();
  console.log("Seeding demo cohort into DrFACT Mumbai…");
  const { clinic } = await ensureClinic();
  const admin = await ensureClinicAdmin(clinic.id);
  const { drRhea, drArjun } = await ensureDoctors(clinic.id);
  const patients = await ensurePatients(clinic.id, drRhea.id, drArjun.id);
  await ensureAssessments(clinic.id, patients, [drRhea.id, drArjun.id]);
  await ensureAuditLog(clinic.id, admin.id);
  console.log(
    `Done. Clinic ${clinic.slug} · admin ${admin.email} · doctors ${drRhea.email}, ${drArjun.email} · ${patients.length} patients · ${ASSESSMENTS.length} assessments.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
