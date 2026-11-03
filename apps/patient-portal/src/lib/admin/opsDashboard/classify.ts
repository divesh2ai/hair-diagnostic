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
  awaitingReview: number;
  deliveryConnected: boolean;
  reportsFailed: number;
  reportsSent: number;
  reportsAvailable: number;
  lastActivityAt: Date | null;
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

  // Only assert a delivery problem when delivery is actually connected —
  // otherwise "no sends" is "we can't see sends", not "sends are failing".
  const reportDeliveryAttention =
    !isArchived &&
    input.deliveryConnected &&
    (input.reportsFailed > 0 ||
      (input.reportsAvailable > 0 && input.reportsSent === 0));

  // Adoption, deliberately distinct from activation (ClinicStatus.ACTIVE):
  // real throughput — a signed-in doctor, assessments, at least one approval,
  // and recent activity.
  const activelyUsing =
    !isArchived &&
    input.assessmentsAllTime > 0 &&
    input.approvalsAllTime > 0 &&
    input.signedInCount > 0 &&
    input.lastActivityAt !== null &&
    input.lastActivityAt.getTime() >= recencyCutoff.getTime();

  const flags: ClinicFlags = {
    neverLoggedIn,
    noAssessments,
    pendingReview,
    reportDeliveryAttention,
    activelyUsing,
  };

  // Primary chip: lifecycle first, then the most operationally-urgent facet.
  let primaryStatus: ClinicPrimaryStatus;
  if (isArchived) primaryStatus = "ARCHIVED";
  else if (isSuspended) primaryStatus = "SUSPENDED";
  else if (neverLoggedIn) primaryStatus = "NEVER_LOGGED_IN";
  else if (noAssessments) primaryStatus = "NO_ASSESSMENTS";
  else if (pendingReview) primaryStatus = "PENDING_REVIEW";
  else if (reportDeliveryAttention) primaryStatus = "REPORT_DELIVERY_ATTENTION";
  else if (activelyUsing) primaryStatus = "ACTIVELY_USING";
  else primaryStatus = "ONBOARDING_IDLE";

  return { flags, primaryStatus };
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
