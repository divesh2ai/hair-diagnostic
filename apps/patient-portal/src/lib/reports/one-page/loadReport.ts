import { ArtifactType } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError, isSuperAdmin } from "@/lib/auth";
import { signReviewToken } from "@/lib/reviewToken";
import type { ClinicContext } from "@/lib/auth";
import type { ClinicalReport } from "@hairos/packages/ai-engine/report-engine/types";
import { buildOnePageReportViewModel, type OnePageReportViewModel } from "./viewModel";

export class ReportAccessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ReportAccessError";
  }
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function getReportAuthContext(): Promise<ClinicContext> {
  try {
    return await getClinicContext();
  } catch (err) {
    const secret = process.env.DEV_LOGIN_SECRET;
    const localExportAllowed =
      process.env.ALLOW_DEV_LOGIN === "1" &&
      process.env.NODE_ENV !== "production" &&
      typeof secret === "string" &&
      secret.length > 0;

    if (localExportAllowed) {
      const h = await headers();
      if (h.get("x-dev-login-secret") === secret) {
        return {
          userId: "local-one-page-report-export",
          role: "SUPER_ADMIN",
          clinicId: null,
        };
      }
    }

    const response = handleAuthError(err);
    throw new ReportAccessError(response?.status ?? 401, "Unauthorized");
  }
}

export async function loadOnePageReportData(assessmentId: string): Promise<OnePageReportViewModel> {
  const auth = await getReportAuthContext();

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      patient: true,
      clinic: true,
      reviewingDoctor: true,
      consultations: {
        include: {
          currentVersion: true,
        },
        take: 1,
      },
    },
  });

  if (!assessment) {
    throw new ReportAccessError(404, "Assessment not found");
  }

  if (!isSuperAdmin(auth.role) && auth.clinicId !== assessment.clinicId) {
    throw new ReportAccessError(403, "Cross-clinic access denied");
  }

  const narrativesArtifact = await prisma.aIArtifact.findFirst({
    where: { assessmentId, type: ArtifactType.NARRATIVES },
    orderBy: { createdAt: "desc" },
  });

  const content = jsonObject(narrativesArtifact?.content);
  const clinicalReport = content.clinical_report;
  if (!clinicalReport || typeof clinicalReport !== "object" || Array.isArray(clinicalReport)) {
    throw new ReportAccessError(202, "Clinical report is not ready yet");
  }

  const consultationVersion = assessment.consultations[0]?.currentVersion;
  const versionContent = jsonObject(consultationVersion?.content);
  const nextReviewDate =
    versionContent.nextReviewDate ??
    jsonObject(versionContent.followUp).nextReviewDate ??
    jsonObject(versionContent.monitoringPlan).nextReviewDate;
  const configuredGuideUrl =
    versionContent.patientGuideUrl ??
    versionContent.reportUrl ??
    versionContent.lifestyleGuideUrl;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  // Patient links must carry a signed token — without it the report page's
  // status/pdf calls resolve as anonymous and render placeholder content.
  const guideUrl = typeof configuredGuideUrl === "string"
    ? configuredGuideUrl
    : appUrl
      ? `${appUrl}/assessment/${assessmentId}/report?t=${encodeURIComponent(signReviewToken(assessmentId))}`
      : null;


  return buildOnePageReportViewModel(clinicalReport as ClinicalReport, {
    assessmentId,
    patient: {
      name: assessment.patient.name,
      age: assessment.patient.age,
      gender: assessment.patient.gender,
      imageUrl: jsonObject(assessment.rawResponses).patientImageUrl as string | undefined,
      phone: assessment.patient.phone,
    },
    clinic: {
      name: assessment.clinic.name,
      address: assessment.clinic.address,
      phone: assessment.clinic.phone,
      logoUrl: assessment.clinic.logoUrl,
    },
    clinician: {
      name:
        assessment.reviewingDoctor?.name ??
        assessment.reviewerName ??
        (typeof consultationVersion?.approvedBy === "string" ? consultationVersion.approvedBy : null),
      title: "Doctor approved plan",
      signatureUrl: assessment.reviewingDoctor?.signatureUrl ?? null,
    },
    approval: {
      status: consultationVersion?.approvalStatus ?? assessment.reviewDecision,
      approvedAt: consultationVersion?.approvedAt ?? assessment.reviewedAt,
      approvedBy:
        assessment.reviewingDoctor?.name ??
        assessment.reviewerName ??
        consultationVersion?.approvedBy,
      nextReviewDate: typeof nextReviewDate === "string" ? nextReviewDate : null,
      wasModified:
        consultationVersion?.approvalStatus === "REVISION_REQUESTED" ||
        assessment.reviewDecision === "EDITS_REQUESTED",
    },
    guideUrl,
    generatedAt: narrativesArtifact?.createdAt ?? assessment.updatedAt,
  });
}


