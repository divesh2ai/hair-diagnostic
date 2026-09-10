import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setPatientWhatsappConsent } from "@/lib/patient/whatsappConsent";
import { WAVE0_TAG, wave0Id } from "./harness";

// Creation and teardown of one complete synthetic case.
//
// ══ WHY THE ROWS ARE WRITTEN DIRECTLY ═══════════════════════════════════════
//
// Producing an approved consultation through the real pipeline means running
// the clinical engines, the narrative generator and the PDF renderer — minutes
// per case, non-deterministic output, and a dependency on model availability
// for tests whose subject is authorisation and state transitions, not clinical
// reasoning. So the case is assembled directly at the shape the post-approval
// code reads.
//
// What is NOT faked is everything under test: every route below is reached
// over real HTTP with a real session, and every assertion reads the row the
// handler actually wrote.
//
// ══ SYNTHETIC, AND OBVIOUSLY SO ═════════════════════════════════════════════
//
// Names are "WAVE0-TEST …", the phone is in the reserved 999… range, and every
// id carries a `wave0-test-` prefix. Nothing here resembles a real patient, so
// a row that survives cleanup is recognisable at a glance rather than sitting
// unnoticed among real records. Cleanup targets exact ids only.

/** Reserved-range number. Never routable, and the transport never sends. */
const SYNTHETIC_PHONE = "+919999000001";

export interface Wave0Case {
  /**
   * Full synthetic name, and the FIRST TOKEN of it.
   *
   * The patient-facing report deliberately renders only a first name
   * (`OnePageHairReport` splits on whitespace), so a test asserting on the
   * full name would fail against correct behaviour. The first token is made
   * unique per case instead, which is what actually proves a token opened the
   * right record rather than merely rendering something.
   */
  patientName: string;
  patientFirstName: string;
  patientId: string;
  assessmentId: string;
  consultationId: string;
  consultationVersionId: string;
  kitOrderIntentId: string;
  artifactId: string;
  clinicId: string;
  doctorId: string;
}

/**
 * A minimal but real `clinical_report`.
 *
 * Same shape `lib/reports/one-page/fixtures/_runtime.ts` builds for the design
 * previews, so it flows through the production view-model pipeline rather than
 * a test-only branch. Content is invented and clinically meaningless on
 * purpose — this proves the report RENDERS for the right patient, which is the
 * security property; it is not a clinical fixture and no engine produced it.
 */
function syntheticClinicalReport(patientName: string) {
  return {
    patientSummary: {
      name: patientName,
      age: 34,
      gender: "Male",
      goal: ["Reduce hair fall"],
      hairLossPattern: [],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: {},
      clinicalInterpretation: [],
    },
    rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
    treatmentStrategy: [
      {
        phase: 1,
        kitId: "WAVE0_TEST_KIT",
        displayName: "Wave0 Test Kit",
        whySelected: "Synthetic fixture — not a clinical recommendation.",
        supportingConditions: [],
        keyIngredients: [],
        mechanismOfAction: [],
        formulationGroups: [],
      },
    ],
    topicalRecommendations: [],
    topicalCautions: [],
    recoveryRoadmap: [],
    recoveryMilestones: [],
    dietAndLifestyle: [],
    generatedAt: new Date().toISOString(),
    schemaVersion: "v4",
  };
}

/**
 * Build one approved, order-carrying case in the given clinic.
 *
 * `fulfilmentMode` is stamped explicitly rather than left to the approval path,
 * because these suites need to control which branch (CLINIC / PATIENT) is
 * under test. The approval path's own stamping is covered separately.
 */
export async function createWave0Case(options: {
  clinicId: string;
  doctorId: string;
  fulfilmentMode?: "CLINIC" | "PATIENT" | null;
  approved?: boolean;
  /**
   * Whether this synthetic patient has given WhatsApp consent. Defaults to
   * true: this fixture predates the consent gate (lib/patient/whatsappConsent.ts),
   * and every existing caller was written to test approval/authorisation
   * behaviour on the automated Share flow, not consent — defaulting to
   * granted keeps those tests exercising what they were designed to exercise
   * now that consent is a real, enforced gate. Pass `false` explicitly for a
   * case that specifically tests the no-consent path.
   */
  whatsappConsent?: boolean;
}): Promise<Wave0Case> {
  const {
    clinicId,
    doctorId,
    fulfilmentMode = "CLINIC",
    approved = true,
    whatsappConsent = true,
  } = options;

  const suffix = wave0Id();
  // First token carries the unique part — see Wave0Case.patientFirstName.
  const patientFirstName = `${WAVE0_TAG}-${suffix.slice(-6)}`;
  const patientName = `${patientFirstName} PATIENT`;

  const patient = await prisma.patient.create({
    data: {
      id: `${suffix}-patient`,
      clinicId,
      name: patientName,
      phone: SYNTHETIC_PHONE,
      age: 34,
      gender: "Male",
    },
  });

  if (whatsappConsent) {
    await setPatientWhatsappConsent(patient.id, true, "wave0_test_fixture");
  }

  const assessment = await prisma.assessment.create({
    data: {
      id: `${suffix}-assessment`,
      clinicId,
      patientId: patient.id,
      reviewingDoctorId: doctorId,
      status: "COMPLETED",
      source: "MANUAL",
      completedAt: new Date(),
      reviewDecision: approved ? "APPROVED" : "PENDING",
    },
  });

  const artifact = await prisma.aIArtifact.create({
    data: {
      id: `${suffix}-artifact`,
      assessmentId: assessment.id,
      type: "NARRATIVES",
      content: {
        clinical_report: syntheticClinicalReport(patientName),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const consultation = await prisma.consultation.create({
    data: {
      id: `${suffix}-consultation`,
      assessmentId: assessment.id,
      clinicId,
      patientId: patient.id,
      status: approved ? "APPROVED" : "AWAITING_DOCTOR_REVIEW",
      createdBy: doctorId,
    },
  });

  const version = await prisma.consultationVersion.create({
    data: {
      id: `${suffix}-version`,
      consultationId: consultation.id,
      contentVersion: 1,
      // treatmentPlan.kitPhases mirrors syntheticClinicalReport's own
      // treatmentStrategy — verified against real staging data (every one of
      // 15 real APPROVED ConsultationVersion rows carries a populated
      // treatmentPlan.kitPhases; buildConsultation's buildTreatmentPlan()
      // always copies report.treatmentStrategy into it verbatim at
      // composition time, and orchestrator.revise() always bases a new
      // version on the PREVIOUS persisted content, never a bare recompose —
      // so a real approved version can never lack it). An empty `content`
      // here does not represent any state the real pipeline produces; it
      // previously tripped loadReport.ts's fail-closed check
      // ("consultation version exists but kit lineup data is missing or
      // invalid"), which is CORRECT for real data and stayed correct — this
      // fixture was the thing that was wrong.
      content: {
        audit: { lastUpdatedAt: new Date().toISOString() },
        treatmentPlan: {
          kitPhases: syntheticClinicalReport(patientName).treatmentStrategy,
          recommendations: [],
          topicals: [],
          topicalCautions: [],
          expectedTimeline: [],
        },
      } as unknown as Prisma.InputJsonValue,
      engineVersions: {} as unknown as Prisma.InputJsonValue,
      contentHash: `${suffix}-hash`,
      approvalStatus: approved ? "APPROVED" : "PENDING_REVIEW",
      approvedBy: approved ? doctorId : null,
      approvedAt: approved ? new Date() : null,
      createdBy: doctorId,
    },
  });

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: { currentVersionId: version.id },
  });

  const intent = await prisma.kitOrderIntent.create({
    data: {
      id: `${suffix}-intent`,
      consultationId: consultation.id,
      consultationVersionId: version.id,
      assessmentId: assessment.id,
      clinicId,
      doctorId,
      kitIds: ["WAVE0_TEST_KIT"],
      quantities: Prisma.JsonNull,
      status: "READY_FOR_FULFILMENT",
    },
  });

  if (fulfilmentMode) {
    // Raw SQL: `fulfilmentMode` is on the post-approval migration and the
    // generated client predates it, exactly as the application does.
    await prisma.$executeRaw`
      UPDATE "KitOrderIntent"
         SET "fulfilmentMode" = ${fulfilmentMode}::"KitFulfilmentMode"
       WHERE "id" = ${intent.id}
    `;
  }

  return {
    patientName,
    patientFirstName,
    patientId: patient.id,
    assessmentId: assessment.id,
    consultationId: consultation.id,
    consultationVersionId: version.id,
    kitOrderIntentId: intent.id,
    artifactId: artifact.id,
    clinicId,
    doctorId,
  };
}

/**
 * Remove one synthetic case, by exact id, in dependency order.
 *
 * ── Why the order is written out and not inferred ──────────────────────────
 * Every foreign key added by the post-approval migration is `ON DELETE
 * RESTRICT`, which is the correct choice for commercial and operational
 * records — nothing should be able to delete an order out from under a
 * payment. The consequence is that teardown has to unwind the graph
 * deliberately: children before parents, every time.
 *
 * ── What is deliberately NOT deleted ───────────────────────────────────────
 * `AuditLog`. Those rows are the compliance record of what this run did, they
 * carry no patient content by design, and a test suite that quietly erases
 * audit history is teaching the codebase a habit it must never have. They are
 * left in place, attributable to the synthetic assessment id.
 */
export async function deleteWave0Case(c: Wave0Case): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "ClinicKitFulfilment" WHERE "assessmentId" = ${c.assessmentId}`;
  await prisma.$executeRaw`DELETE FROM "KitOrderPayment"     WHERE "assessmentId" = ${c.assessmentId}`;
  await prisma.whatsappDelivery.deleteMany({ where: { assessmentId: c.assessmentId } });
  await prisma.assessmentEvent.deleteMany({ where: { assessmentId: c.assessmentId } });
  await prisma.analyticsEvent.deleteMany({ where: { assessmentId: c.assessmentId } });
  await prisma.recommendationFeedback.deleteMany({ where: { assessmentId: c.assessmentId } });
  await prisma.kitOrderIntent.deleteMany({ where: { assessmentId: c.assessmentId } });

  await prisma.consultationEvent.deleteMany({ where: { consultationId: c.consultationId } });
  await prisma.consultation.update({
    where: { id: c.consultationId },
    data: { currentVersionId: null },
  });
  await prisma.consultationVersion.deleteMany({ where: { consultationId: c.consultationId } });
  await prisma.consultation.deleteMany({ where: { id: c.consultationId } });

  await prisma.aIArtifact.deleteMany({ where: { assessmentId: c.assessmentId } });
  await prisma.assessmentResponse.deleteMany({ where: { assessmentId: c.assessmentId } });
  await prisma.orchestrationLog.deleteMany({ where: { assessmentId: c.assessmentId } });

  // AuditLog rows reference the assessment. Detach rather than delete so the
  // compliance trail survives the case it describes.
  await prisma.auditLog.updateMany({
    where: { assessmentId: c.assessmentId },
    data: { assessmentId: null },
  });

  await prisma.assessment.deleteMany({ where: { id: c.assessmentId } });
  await prisma.patient.deleteMany({ where: { id: c.patientId } });
}

/** Read the persisted fulfilment row for assertions. */
export async function readFulfilmentRow(assessmentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; status: string; mode: string; kitOrderIntentId: string }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "mode"::text AS "mode", "kitOrderIntentId"
      FROM "ClinicKitFulfilment" WHERE "assessmentId" = ${assessmentId}
  `);
  return rows;
}

/** Read the persisted payment row for assertions. */
export async function readPaymentRow(assessmentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; status: string; source: string | null; amountMinor: number | null; paidAt: Date | null; checkoutStartedAt: Date | null }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "source"::text AS "source",
           "amountMinor", "paidAt", "checkoutStartedAt"
      FROM "KitOrderPayment" WHERE "assessmentId" = ${assessmentId}
  `);
  return rows;
}

/** Read delivery rows for assertions. */
export async function readDeliveryRows(assessmentId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      subject: string | null;
      status: string;
      messageId: string | null;
      providerStatus: string | null;
      sentAt: Date | null;
      deliveredAt: Date | null;
      readAt: Date | null;
      lastError: string | null;
    }>
  >(Prisma.sql`
    SELECT "id", "subject", "status"::text AS "status", "messageId", "providerStatus",
           "sentAt", "deliveredAt", "readAt", "lastError"
      FROM "WhatsappDelivery" WHERE "assessmentId" = ${assessmentId}
     ORDER BY "createdAt" ASC
  `);
  return rows;
}
