// Prisma-backed implementations of the orchestrator loader ports. Each loader
// is a thin read — no business logic. The orchestrator composes their outputs.

import type { PrismaClient } from "@prisma/client";
import type {
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

export function prismaAssessmentLoader(prisma: PrismaClient): AssessmentLoader {
  return {
    async load(assessmentId): Promise<AssessmentLoad | null> {
      const a = await prisma.assessment.findFirst({
        where: { id: assessmentId, deletedAt: null },
        include: { patient: true },
      });
      if (!a || !a.rawResponses) return null;
      const answers = a.rawResponses as Record<string, unknown>;
      return {
        id: a.id,
        clinicId: a.clinicId,
        patientId: a.patientId,
        submittedAt: a.submittedAt.toISOString(),
        source: a.source,
        rawAnswers: answers,
        reviewingDoctorId: a.reviewingDoctorId,
        patient: {
          id: a.patient.id,
          name: a.patient.name ?? "Patient",
          age: a.patient.age ?? (Number(answers.age ?? 0) || 0),
          sex: a.patient.gender ?? String(answers.sex ?? "unknown"),
          phone: a.patient.phone ?? null,
          email: a.patient.email ?? null,
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
      // optional-chaining clinical decisions later.
      return {
        doctorId: d.id,
        preferredLanguage: "en",
        budgetTier: "STANDARD",
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
        defaultBudgetTier: "STANDARD",
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
