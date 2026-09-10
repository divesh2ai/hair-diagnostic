// Prisma-backed implementations of the orchestrator loader ports. Each loader
// is a thin read — no business logic. The orchestrator composes their outputs.

import type { PrismaClient } from "@prisma/client";
import type {
  AssessmentComposability,
  AssessmentDegradedReason,
  AssessmentLoader,
  AssessmentLoad,
  ClinicBrandingLoader,
  ClinicBranding,
  DoctorPreferencesLoader,
  DoctorPreferences,
  OrgDefaultsLoader,
  OrgDefaults,
  PreviousConsultationsLoader,
} from "../ports";

/**
 * Classify what the stored questionnaire actually contains.
 *
 * `rawResponses` is `Json?`. Three things live in that column across the
 * history of this table: a proper answers object, `null` on every row created
 * before the 20260521 migration added the column, and — rarely — a JSON value
 * that is not an object at all. Only the first can be composed from; the other
 * two are still real clinical records with a patient, a doctor and often a
 * persisted consultation.
 */
function classifyAnswers(raw: unknown): {
  answers: Record<string, unknown>;
  composability: AssessmentComposability;
  degradedReasons: AssessmentDegradedReason[];
} {
  if (raw === null || raw === undefined) {
    return { answers: {}, composability: "LEGACY_DEGRADED", degradedReasons: ["RAW_RESPONSES_MISSING"] };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { answers: {}, composability: "LEGACY_DEGRADED", degradedReasons: ["RAW_RESPONSES_MALFORMED"] };
  }
  const answers = raw as Record<string, unknown>;
  if (Object.keys(answers).length === 0) {
    return { answers, composability: "LEGACY_DEGRADED", degradedReasons: ["RAW_RESPONSES_EMPTY"] };
  }
  return { answers, composability: "FULL", degradedReasons: [] };
}

export function prismaAssessmentLoader(prisma: PrismaClient): AssessmentLoader {
  return {
    async load(assessmentId): Promise<AssessmentLoad | null> {
      const a = await prisma.assessment.findFirst({
        where: { id: assessmentId, deletedAt: null },
        include: { patient: true },
      });

      // `null` from this loader means one thing only: there is no such
      // assessment. It used to also mean "the questionnaire column is empty",
      // which made every pre-20260521 record indistinguishable from a deleted
      // one — the orchestrator raised `not_found` and the doctor was told the
      // case did not exist, on a row the API had already read.
      if (!a) return null;

      const { answers, composability, degradedReasons } = classifyAnswers(a.rawResponses);

      return {
        id: a.id,
        clinicId: a.clinicId,
        patientId: a.patientId,
        submittedAt: a.submittedAt.toISOString(),
        source: a.source,
        rawAnswers: answers,
        reviewingDoctorId: a.reviewingDoctorId,
        status: String(a.status),
        composability,
        degradedReasons,
        patient: {
          id: a.patient.id,
          name: a.patient.name ?? "Patient",
          // The `answers` fallbacks are unreachable when the questionnaire is
          // missing, which is correct: age/sex are then simply unknown rather
          // than invented.
          age: a.patient.age ?? (Number(answers.age ?? 0) || 0),
          sex: a.patient.gender ?? String(answers.sex ?? "unknown"),
          phone: a.patient.phone ?? null,
          email: a.patient.email ?? null,
          // WhatsApp consent is deliberately NOT read here. This loader's
          // `include: { patient: true }` selects every scalar column of the
          // typed Prisma model, so if a deployment has not yet applied
          // 20260908_whatsapp_report_delivery, adding the new Patient columns
          // to this query would throw "column does not exist" on EVERY
          // consultation load — not just WhatsApp sends. Consent is read
          // separately, over guarded raw SQL, only where it is actually
          // needed: see lib/patient/whatsappConsent.ts.
        },
      };
    },
  };
}

export function prismaClinicBrandingLoader(prisma: PrismaClient): ClinicBrandingLoader {
  return {
    async load(clinicId): Promise<ClinicBranding | null> {
      const c = await prisma.clinic.findUnique({ where: { id: clinicId } });
      if (!c) return null;
      return {
        clinicId: c.id,
        name: c.name,
        logoUrl: c.logoUrl,
        primaryColor: c.primaryColor,
        secondaryColor: c.secondaryColor,
        accentColor: c.accentColor,
        tagline: c.tagline,
        footerText: c.footerText,
        pdfBranding: (c.pdfBranding ?? null) as Record<string, unknown> | null,
        reportBranding: (c.reportBranding ?? null) as Record<string, unknown> | null,
      };
    },
  };
}

export function prismaDoctorPreferencesLoader(prisma: PrismaClient): DoctorPreferencesLoader {
  return {
    async load(doctorId): Promise<DoctorPreferences | null> {
      if (!doctorId) return null;
      const d = await prisma.doctor.findUnique({ where: { id: doctorId } });
      if (!d) return null;
      // Doctor model in this repo has minimal preference fields today; the
      // loader provides safe defaults so the orchestrator can compose without
      // optional-chaining clinical decisions later. budgetTier is intentionally
      // omitted so the org default wins until the doctor explicitly chooses.
      return {
        doctorId: d.id,
        preferredLanguage: "en",
      };
    },
  };
}

export function prismaOrgDefaultsLoader(prisma: PrismaClient): OrgDefaultsLoader {
  return {
    async load(clinicId): Promise<OrgDefaults> {
      const c = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { organizationId: true, language: true },
      });
      return {
        organizationId: c?.organizationId ?? null,
        defaultLanguage: c?.language ?? "en",
        // Platform default. COMPREHENSIVE is a ceiling (maxKits: 7) — the kit
        // scorer still returns only kits with valid clinical triggers, so
        // simple cases stay small. Doctors and orgs can override.
        defaultBudgetTier: "COMPREHENSIVE",
      };
    },
  };
}

export function prismaPreviousConsultationsLoader(
  prisma: PrismaClient,
): PreviousConsultationsLoader {
  return {
    async load(patientId, excludeAssessmentId) {
      const rows = await prisma.consultation.findMany({
        where: { patientId, NOT: { assessmentId: excludeAssessmentId } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return rows;
    },
  };
}
