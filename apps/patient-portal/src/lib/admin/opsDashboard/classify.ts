// Pure operational classification — no Prisma, no I/O — so the rules that
// decide a clinic's status and the capability-gating of a KPI can be unit
// tested in isolation. metrics.ts feeds these the numbers it queried.

import type {
  CapabilityState,
  ClinicFlags,
  ClinicPrimaryStatus,
  GatedKpi,
} from "./types";

/** A clinic with no activity for this long is not "actively using" today. */
export const ACTIVE_RECENCY_DAYS = 30;

export interface ClassifyInput {
  /** ClinicStatus: ACTIVE | SUSPENDED | ARCHIVED. */
  status: string;
  doctorCount: number;
  /** Doctors whose auth.users account has ever recorded a sign-in. */
  signedInCount: number;
  /** False when auth.users could not be read — sign-in is UNKNOWN, not "never". */
  authReadable: boolean;
  assessmentsAllTime: number;
  /**
   * Approved consultation versions. This is the authoritative sign-off count —
   * NEVER AssessmentStatus.COMPLETED, which means only that the AI pipeline
   * finished. A clinic can have many COMPLETED assessments and zero approvals.
   */
  approvalsAllTime: number;
  /**
   * Distinct cases a doctor actually reviewed — a consultation whose current
   * version is APPROVED, REVISION_REQUESTED or REJECTED. This is the genuine
   * "clinical work happened" signal and drives adoption, NOT the approval count
   * alone: a rejection or a requested revision is real review work. PENDING is
   * excluded (not a completed review). Zero here with assessments present means
   * patients submitted but no doctor has reviewed — a login alone, or patient
   * submissions alone, never count as adoption.
   */
  reviewedCasesAllTime: number;
  awaitingReview: number;
  /**
   * COMPLETED assessments with no consultation row. Pipeline attention — the
   * consultation the doctor would review was never produced. NEVER folded into
   * awaitingReview, because that would blame a doctor for a pipeline gap.
   */
  assessmentsWithoutConsultation: number;
  /** Approved-version / Assessment.reviewDecision conflicts. */
  reconciliationDiscrepancies: number;
  deliveryConnected: boolean;
  reportsFailed: number;
  reportsSent: number;
  /**
   * ReportAsset PATIENT_REPORT_PDF rows that are READY — a CONFIRMED asset
   * count from the database, never inferred from the approval count. A report
   * "attention" is only asserted from this measured gap, not from the fact that
   * a version was approved.
   */
  dossiersReady: number;
  /**
   * The most recent activity of any kind (patient submission or audited event).
   * Retained for the general "last activity" display and as a fallback recency
   * signal; it is NOT what proves doctor adoption.
   */
  lastActivityAt: Date | null;
  /**
   * The most recent AUTHENTICATED DOCTOR clinical action (approval, or audited
   * doctor review / note / treatment update), system & Super Admin activity
   * excluded. This — not the patient-submission clock — decides whether clinical
   * activity is "recent", so an older sign-in with recent clinical work still
   * reads as actively using. Null when no such action was recorded.
   */
  lastDoctorActivityAt: Date | null;
  now?: Date;
}

export interface Classification {
  flags: ClinicFlags;
  primaryStatus: ClinicPrimaryStatus;
}

export function classifyClinic(input: ClassifyInput): Classification {
  const now = input.now ?? new Date();
  const recencyCutoff = new Date(now.getTime() - ACTIVE_RECENCY_DAYS * 24 * 60 * 60 * 1000);

  const isArchived = input.status === "ARCHIVED";
  const isSuspended = input.status === "SUSPENDED";

  // "Never logged in": nobody can have signed in if there are no doctors; or,
  // when auth is readable, no doctor has ever signed in. When auth is NOT
  // readable we cannot assert "never", so the flag stays false (the UI shows
  // sign-in as Unknown separately).
  const neverLoggedIn =
    !isArchived &&
    (input.doctorCount === 0 || (input.authReadable && input.signedInCount === 0));

  const noAssessments = !isArchived && input.assessmentsAllTime === 0;
  const pendingReview = !isArchived && input.awaitingReview > 0;

  // A COMPLETED assessment with no consultation is a pipeline gap, not doctor
  // inaction — kept as its own flag so it is never classified as a pending
  // review.
  const missingConsultation =
    !isArchived && input.assessmentsWithoutConsultation > 0;

  // An approved-version / reviewDecision conflict. Reported, never reconciled
  // automatically.
  const reconciliationDiscrepancy =
    !isArchived && input.reconciliationDiscrepancies > 0;

  // Report attention has two independent, measured triggers and asserts asset
  // existence from NEITHER an approval nor a guess:
  //   • a measured asset gap — approved versions that have no READY dossier
  //     asset (dossiersReady < approvalsAllTime). This is a DB fact and holds
  //     whether or not delivery is connected.
  //   • a delivery fault — but only when delivery is actually connected;
  //     otherwise "no sends" is "we can't see sends", not "sends are failing".
  const assetGap =
    !isArchived &&
    input.approvalsAllTime > 0 &&
    input.dossiersReady < input.approvalsAllTime;
  const deliveryFault =
    !isArchived &&
    input.deliveryConnected &&
    (input.reportsFailed > 0 ||
      (input.dossiersReady > 0 && input.reportsSent === 0));
  const reportDeliveryAttention = assetGap || deliveryFault;

  // Genuine clinical work: a doctor has reviewed at least one case (approved,
  // rejected or asked for a revision). This — not an approval count, not a
  // login, not a patient submission — is the bar for adoption. Clinical work
  // implies authenticated access, so it stands even if the recorded sign-in is
  // old or (when auth is unreadable) unknown.
  const hasClinicalWork = input.reviewedCasesAllTime > 0;

  // Clinical recency is measured against the last DOCTOR activity, never the
  // patient-submission clock: a clinic whose patients keep submitting but whose
  // doctor stopped reviewing is NOT "recently active".
  const clinicalRecent =
    input.lastDoctorActivityAt !== null &&
    input.lastDoctorActivityAt.getTime() >= recencyCutoff.getTime();

  // Adoption, deliberately distinct from activation (ClinicStatus.ACTIVE):
  // genuine clinical work AND recent clinical activity.
  const activelyUsing = !isArchived && hasClinicalWork && clinicalRecent;

  // Had clinical work, but not recently — the "stopped using HairOS" signal.
  const noRecentActivity = !isArchived && hasClinicalWork && !clinicalRecent;

  // A doctor can sign in but has not started clinical work. Only asserted when
  // sign-in is POSITIVELY established (authReadable), so it is never confused
  // with the unknown case below.
  const loggedInNoActivity =
    !isArchived &&
    !hasClinicalWork &&
    input.authReadable &&
    input.signedInCount > 0;

  // Adoption cannot be established: no clinical signal AND the sign-in evidence
  // is unreadable, for a clinic that is actually staffed. Reported as Unknown,
  // never as a confident "never" or a fabricated zero.
  const trackingUnavailable =
    !isArchived &&
    !hasClinicalWork &&
    !input.authReadable &&
    input.doctorCount > 0;

  const flags: ClinicFlags = {
    neverLoggedIn,
    noAssessments,
    pendingReview,
    missingConsultation,
    reconciliationDiscrepancy,
    reportDeliveryAttention,
    activelyUsing,
    loggedInNoActivity,
    noRecentActivity,
    trackingUnavailable,
  };

  // Primary chip: lifecycle first, then the most operationally-urgent facet.
  // Data-integrity (a conflicting approval state) and pipeline gaps (a missing
  // consultation) rank ahead of the routine doctor queue so neither hides
  // behind "pending review" or an "actively using" badge — and the missing
  // consultation is never shown as doctor inaction.
  let primaryStatus: ClinicPrimaryStatus;
  if (isArchived) primaryStatus = "ARCHIVED";
  else if (isSuspended) primaryStatus = "SUSPENDED";
  else if (neverLoggedIn) primaryStatus = "NEVER_LOGGED_IN";
  else if (noAssessments) primaryStatus = "NO_ASSESSMENTS";
  else if (reconciliationDiscrepancy) primaryStatus = "RECONCILIATION_DISCREPANCY";
  else if (missingConsultation) primaryStatus = "MISSING_CONSULTATION";
  else if (pendingReview) primaryStatus = "PENDING_REVIEW";
  else if (reportDeliveryAttention) primaryStatus = "REPORT_DELIVERY_ATTENTION";
  else if (activelyUsing) primaryStatus = "ACTIVELY_USING";
  // A clinic that did real clinical work but has gone quiet is "no recent
  // activity" (stopped), never conflated with one that never started.
  else if (noRecentActivity) primaryStatus = "NO_RECENT_ACTIVITY";
  // No clinical signal: if we cannot even read the sign-in evidence, say so.
  else if (trackingUnavailable) primaryStatus = "UNKNOWN_TRACKING";
  // A doctor can log in but has not started clinical work.
  else if (loggedInNoActivity) primaryStatus = "LOGGED_IN_NO_ACTIVITY";
  else primaryStatus = "ONBOARDING_IDLE";

  return { flags, primaryStatus };
}

// ── Per-report readiness ─────────────────────────────────────────────────────
// The task is explicit: a report's availability must be SEPARATED into the
// clinical sign-off, the one-pager snapshot object, the dossier asset, and a
// verified retrieval — and asset existence must NEVER be inferred from the
// approval alone. These pure helpers encode that separation so the drilldown can
// present one honest row per approved assessment and the figures can be tested
// without a database or an object store.

/** Whether the one-pager snapshot object exists. UNKNOWN = storage unreadable. */
export type SnapshotState = "PRESENT" | "ABSENT" | "UNKNOWN";

/** Whether a retrieval of the stored bytes was actually attempted, and its result. */
export type RetrievalState = "VERIFIED" | "FAILED" | "NOT_TESTED";

export interface ReportAssetFacts {
  /** An approved ConsultationVersion exists (the clinical sign-off). */
  approved: boolean;
  /** One-pager snapshot object (one-pagers/{assessmentId}/v{n}.json). */
  onePagerSnapshot: SnapshotState;
  /** ReportAsset PATIENT_REPORT_PDF is READY for this version. */
  dossierReady: boolean;
  /** Result of an attempted byte retrieval of the snapshot, where testable. */
  retrieval: RetrievalState;
}

/**
 * How ready one approved assessment's patient-facing report actually is.
 *
 *   NOT_APPROVED     No approved version — there is nothing to render yet.
 *   AVAILABLE        Approved, snapshot present, dossier ready; any attempted
 *                    retrieval succeeded.
 *   RETRIEVAL_FAILED Approved and the asset exists, but a tested retrieval of
 *                    the bytes failed — worse than "missing", it looks present
 *                    and cannot be served.
 *   ASSET_MISSING    Approved, but the snapshot is confirmed absent or the
 *                    dossier is not READY. Derived from a measured absence,
 *                    never from the approval.
 *   UNVERIFIABLE     Approved, but storage could not be read, so snapshot
 *                    presence is UNKNOWN — reported as such, never as present.
 */
export type ReportReadiness =
  | "NOT_APPROVED"
  | "AVAILABLE"
  | "RETRIEVAL_FAILED"
  | "ASSET_MISSING"
  | "UNVERIFIABLE";

export function classifyReportReadiness(f: ReportAssetFacts): ReportReadiness {
  if (!f.approved) return "NOT_APPROVED";
  // A tested retrieval that failed is the most actionable fault: the record
  // exists but cannot be served.
  if (f.retrieval === "FAILED") return "RETRIEVAL_FAILED";
  if (f.onePagerSnapshot === "ABSENT" || !f.dossierReady) return "ASSET_MISSING";
  if (f.onePagerSnapshot === "UNKNOWN") return "UNVERIFIABLE";
  return "AVAILABLE";
}

/**
 * Build a capability-gated KPI. The whole point: when the backing migration is
 * absent the figures are null (rendered "Not connected"), NEVER 0 — a clinic
 * with no paid orders and a database that cannot answer must not look the same.
 */
export function toGatedKpi(
  state: CapabilityState,
  today: number,
  allTime: number,
): GatedKpi {
  if (state !== "CONNECTED") {
    return { state: "NOT_CONNECTED", today: null, allTime: null };
  }
  return { state: "CONNECTED", today, allTime };
}
