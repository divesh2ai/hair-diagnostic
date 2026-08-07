/**
 * Read-only: reports every row the demo seed created / mutated so the operator
 * can decide whether to keep or roll back.
 *
 * Marker strategy (v1 of the seed):
 *   - Clinic:            slug='drfact-mumbai' + settings.seededBy='seed-demo'
 *   - Doctors:           email in a fixed allow-list ending in @drfact.demo
 *   - ClinicMember:      email 'clinic-admin@drfact.demo'
 *   - Patients:          phone in +9198210100{01..10} (deterministic 10-digit block)
 *   - Assessments:       reviewingDoctorId ∈ demo doctors AND joined patient phone matches block
 *   - AIArtifact:        content->>'seededBy' = 'seed-demo'
 *   - AuditLog:          entityId='seed-approved-1' OR (entityType='Clinic' AND entityId=<demo clinic id>)
 *
 * Run: npx tsx scripts/inspect-demo-seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_DOCTOR_EMAILS = ["dr.rhea@drfact.demo", "dr.arjun@drfact.demo"];
const DEMO_ADMIN_EMAIL = "clinic-admin@drfact.demo";
const DEMO_PATIENT_PHONES = Array.from({ length: 10 }, (_, i) => `+91982101000${i + 1}`.replace(/00(\d\d)$/, (_, n) => n)).map((_, i) => `+9198210100${String(i + 1).padStart(2, "0")}`);

function mask(url: string | undefined): string {
  if (!url) return "<unset>";
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

async function main() {
  console.log("DATABASE_URL:", mask(process.env.DATABASE_URL));

  const clinic = await prisma.clinic.findFirst({
    where: { slug: "drfact-mumbai" },
    select: {
      id: true, slug: true, name: true, createdAt: true, updatedAt: true,
      settings: true, status: true,
    },
  });
  console.log("\nClinic (drfact-mumbai):", clinic);

  const admin = await prisma.clinicMember.findFirst({
    where: { email: DEMO_ADMIN_EMAIL },
    select: { id: true, email: true, name: true, clinicId: true, createdAt: true },
  });
  console.log("\nClinic admin:", admin);

  const doctors = await prisma.doctor.findMany({
    where: { email: { in: DEMO_DOCTOR_EMAILS } },
    select: { id: true, email: true, name: true, clinicId: true, createdAt: true },
  });
  console.log("\nDemo doctors:", doctors);

  const patients = await prisma.patient.findMany({
    where: { phone: { in: DEMO_PATIENT_PHONES } },
    select: { id: true, name: true, phone: true, clinicId: true, doctorId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nDemo patients (${patients.length}):`);
  for (const p of patients) console.log(" ", p.id, p.name, p.phone, "created", p.createdAt.toISOString());

  const patientIds = patients.map((p) => p.id);
  const assessments = await prisma.assessment.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true, status: true, reviewDecision: true, patientId: true, reviewingDoctorId: true, submittedAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nAssessments on demo patients (${assessments.length}):`);
  for (const a of assessments) console.log(" ", a.id, a.status, a.reviewDecision, "submitted", a.submittedAt?.toISOString(), "created", a.createdAt.toISOString());

  const artifacts = await prisma.aIArtifact.findMany({
    where: {
      assessmentId: { in: assessments.map((a) => a.id) },
      type: "SEVERITY_ANALYSIS",
    },
    select: { id: true, assessmentId: true, content: true, createdAt: true },
  });
  const demoArtifacts = artifacts.filter((a) => (a.content as any)?.seededBy === "seed-demo");
  console.log(`\nDemo SEVERITY_ANALYSIS artifacts (${demoArtifacts.length} of ${artifacts.length} total on these assessments)`);

  const audits = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityId: "seed-approved-1" },
        clinic ? { entityType: "Clinic", entityId: clinic.id, action: { in: ["clinic.activated", "settings.updated"] } } : {},
        clinic ? { entityType: "Doctor", entityId: admin?.id, action: "doctor.invited" } : {},
      ].filter((c): c is object => Object.keys(c).length > 0),
    },
    select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nDemo audit entries (${audits.length}):`);
  for (const a of audits) console.log(" ", a.id, a.action, a.entityType, a.entityId);

  console.log("\nDeletion criteria (dry-run only, not executed):");
  console.log("  AIArtifact.where.assessmentId IN <demoAssessmentIds> AND content->>'seededBy' = 'seed-demo'");
  console.log("  Assessment.where.id IN <demoAssessmentIds>");
  console.log("  Patient.where.phone IN <DEMO_PATIENT_PHONES>");
  console.log("  Doctor.where.email IN <DEMO_DOCTOR_EMAILS>");
  console.log("  ClinicMember.where.email = 'clinic-admin@drfact.demo'");
  console.log("  AuditLog.where.entityId = 'seed-approved-1'  (only the synthetic marker row; real audit not touched)");
  console.log("  Clinic 'drfact-mumbai' — RETAIN unless you explicitly want it removed; it may exist independently.");
}

main().finally(() => prisma.$disconnect());
