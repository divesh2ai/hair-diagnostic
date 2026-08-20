import { ArtifactType } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError, isSuperAdmin } from "@/lib/auth";
import { signReviewToken, verifyReviewToken } from "@/lib/reviewToken";
import { isConferenceMode } from "@/lib/conferenceMode";
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

/**
 * Who is asking for this report.
 *
 * `clinic` keeps the production rules — the cross-clinic check below applies.
 * `conference_token` is only ever produced when CONFERENCE_MODE is on AND the
 * caller presented a valid signed token bound to this exact assessment, so
 * there is no clinic to compare against; the token IS the scope.
 */
type ReportAudience =
  | { kind: "clinic"; ctx: ClinicContext }
  | { kind: "conference_token" };

async function getReportAuthContext(
  assessmentId: string,
  reviewToken?: string | null,
): Promise<ReportAudience> {
  try {
    return { kind: "clinic", ctx: await getClinicContext() };
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
          kind: "clinic",
          ctx: {
            userId: "local-one-page-report-export",
            role: "SUPER_ADMIN",
            clinicId: null,
            // Synthetic local-export identity — there is no signed-in person
            // and therefore no address to report.
            email: null,
          },
        };
      }
    }

    // Conference / pilot only. Off by default, so production clinics reach
    // the same 401 they always did.
    if (isConferenceMode() && reviewToken) {
      const result = verifyReviewToken(reviewToken);
      if (result.ok && result.assessmentId === assessmentId) {
        return { kind: "conference_token" };
      }
    }

    const response = handleAuthError(err);
    throw new ReportAccessError(response?.status ?? 401, "Unauthorized");
  }
}

export async function loadOnePageReportData(
  assessmentId: string,
  options?: { reviewToken?: string | null },
): Promise<OnePageReportViewModel> {
  const auth = await getReportAuthContext(assessmentId, options?.reviewToken);

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

  // Cross-clinic protection applies to clinic sessions exactly as before. A
  // conference token is already bound to this single assessmentId, so there is
  // no other clinic's data it could reach.
  if (auth.kind === "clinic" && !isSuperAdmin(auth.ctx.role) && auth.ctx.clinicId !== assessment.clinicId) {
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

  // Doctor approval, resolved once and used for both the access decision and
  // the label. `ConsultationVersion.approvalStatus` is authoritative when a
  // consultation exists; `Assessment.reviewDecision` is the legacy fallback
  // for rows that predate the consultation aggregate. Both spell the approved
  // state "APPROVED", and anything else — DRAFT, PENDING_REVIEW,
  // REVISION_REQUESTED, REJECTED, EDITS_REQUESTED — is not approved.
  const approvalState: string | null =
    consultationVersion?.approvalStatus ?? assessment.reviewDecision ?? null;
  const isDoctorApproved = approvalState === "APPROVED";

  // A conference token is patient-equivalent access: it is presented by
  // someone with no clinic session, and it is the only way this loader can be
  // reached without staff authorisation. Patient-equivalent callers get the
  // report only once a doctor has approved it. Clinic and Super Admin sessions
  // keep pre-approval access — reviewing an unapproved draft is their job —
  // but they see it labelled for what it is, below.
  if (auth.kind === "conference_token" && !isDoctorApproved) {
    throw new ReportAccessError(403, "Consultation is not approved");
  }

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
      // Never claim approval that has not happened. Only a clinic or Super
      // Admin session can reach this branch unapproved (the conference-token
      // path is refused above), and they must not be shown a draft dressed as
      // a signed plan either — the same document is what gets printed.
      title: isDoctorApproved ? "Doctor approved plan" : "Draft — pending doctor review",
      signatureUrl: isDoctorApproved
        ? assessment.reviewingDoctor?.signatureUrl ?? null
        : null,
    },
    approval: {
      status: approvalState,
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


