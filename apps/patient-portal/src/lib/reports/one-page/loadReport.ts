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
export type ReportAudience =
  | { kind: "clinic"; ctx: ClinicContext }
  | { kind: "conference_token" }
  /**
   * The patient, holding a report share token the doctor deliberately sent
   * them (see lib/reportShareToken + POST /api/consultation/[id]/share).
   *
   * Like `conference_token` this is patient-equivalent access with no clinic
   * session, and it is subject to the same approval gate below — which is what
   * gives the link a real revocation lever: if the doctor later moves the
   * consultation to REVISION_REQUESTED, every outstanding patient link stops
   * opening, without rotating a secret or tracking a token list.
   *
   * Unlike `conference_token` it is NOT behind a deployment flag. This is the
   * ordinary production path by which a patient reads their own report, so it
   * has to work in an ordinary clinic deployment.
   */
  | { kind: "patient_share_token" }
  /**
   * A server-side caller that has already authenticated and tenant-checked the
   * request it is acting on — today only the approval path, writing the
   * snapshot of the sheet it is releasing.
   *
   * It carries the clinic it believes it is acting for rather than a bare
   * "trust me" flag, so the cross-clinic check below still runs against a real
   * value. An internal caller that names the wrong clinic is refused exactly
   * like a doctor who does.
   */
  | { kind: "server_internal"; clinicId: string };

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
  return composeOnePageReportViewModel(assessmentId, auth);
}

/**
 * Build the view model for an assessment whose caller is ALREADY authorised.
 *
 * ── Why this is separate, and why it takes the audience ─────────────────────
 * The snapshot writer (lib/reports/one-page/snapshot) runs inside the approval
 * path, which has already resolved a doctor and already checked the tenant. It
 * needs the same document the patient will read, and re-running
 * `getReportAuthContext` there would mean a second cookie-scoped auth on a
 * code path that is not serving that reader's request.
 *
 * The split is deliberately NOT a "skipAuth" flag on the public loader: a
 * boolean that turns off tenant checks on a PHI reader is the kind of
 * parameter that eventually gets passed `true` by accident. Instead the
 * audience is a required argument, so every caller has to say — and therefore
 * has to have — an authorisation it can name.
 */
export async function composeOnePageReportViewModel(
  assessmentId: string,
  auth: ReportAudience,
): Promise<OnePageReportViewModel> {
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
  if (auth.kind === "server_internal" && auth.clinicId !== assessment.clinicId) {
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

  // `clinical_report` above is a point-in-time snapshot frozen into the
  // NARRATIVES artifact at submission time — it never changes after that.
  // The doctor's actual kit decisions live in the ConsultationVersion row
  // instead (KitLineupEditor PATCHes `treatmentPlan.kitPhases` there on every
  // save; see orchestrator.revise()). Without this overlay, a doctor who
  // removes, reorders, or swaps a kit would see the change everywhere
  // (Consultation JSON, cart, KitOrderIntent) except on the one-pager and its
  // permanent approval snapshot, which would keep showing the original
  // AI-recommended lineup forever. Every other field of `clinical_report`
  // (diagnosis, drivers, topicals, lifestyle) is never doctor-edited today, so
  // only `treatmentStrategy` — the field `kitPhases` mirrors verbatim at
  // composition time — needs to be overlaid.
  const versionTreatmentPlan = jsonObject(jsonObject(consultationVersion?.content).treatmentPlan);
  const doctorKitPhases = Array.isArray(versionTreatmentPlan.kitPhases)
    ? versionTreatmentPlan.kitPhases
    : null;
  const effectiveClinicalReport = doctorKitPhases
    ? { ...clinicalReport, treatmentStrategy: doctorKitPhases }
    : clinicalReport;

  // Fail-closed post-approval check. The overlay above is authoritative only
  // when a ConsultationVersion exists — without one, the legacy
  // `assessment.reviewDecision` path predates the kit editor and NARRATIVES is
  // the only available lineup, so the fallback is correct for those rows.
  //
  // But if a ConsultationVersion IS present and its approvalStatus is APPROVED,
  // then a doctor actively approved a prescription through the kit editor —
  // `buildConsultation` always writes `kitPhases: report.treatmentStrategy` at
  // creation, so the absence of a valid array is corrupted state. Silently
  // serving the NARRATIVES artifact would present AI-generated kits as
  // the doctor's final approved prescription, which is the exact failure mode
  // this overlay exists to prevent. Fail with a 500 instead so the caller gets
  // an explicit error rather than wrong data.
  if (consultationVersion?.approvalStatus === "APPROVED" && !doctorKitPhases) {
    throw new ReportAccessError(
      500,
      "Doctor-approved prescription is unavailable: consultation version exists but kit lineup data is missing or invalid.",
    );
  }

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
  //
  // `patient_share_token` is held to exactly the same rule, and deliberately
  // rechecked HERE rather than at the route: the approval state is read in
  // this function, so a caller that forgot to check would be relying on the
  // route it happens to be reached through. This is the gate.
  if (
    (auth.kind === "conference_token" || auth.kind === "patient_share_token") &&
    !isDoctorApproved
  ) {
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


  return buildOnePageReportViewModel(effectiveClinicalReport as ClinicalReport, {
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
      // Admin session can reach this branch unapproved (both patient-equivalent
      // paths are refused above), and they must not be shown a draft dressed as
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


