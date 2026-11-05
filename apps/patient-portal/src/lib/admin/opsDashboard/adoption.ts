// Clinic adoption classification + follow-up suggestion — pure, no I/O.
//
// Adoption is measured against PATIENT-ASSESSMENT recency, on the clinic-local
// day, with configurable day-windows. It is deliberately a different question
// from "is a doctor reviewing patients" (doctor activity) and from "can a
// doctor log in" (authentication) — a patient submission is never a doctor
// login or a doctor review. The follow-up suggestion turns the status plus the
// operational flags into the single next action the operations team should take
// today, ranked by the task's priority order.

export interface AdoptionThresholds {
  /** Assessment activity within this many days ⇒ actively using. */
  usingWithinDays: number;
  /** At/after this many days without activity (and before dormant) ⇒ needs engagement. */
  engagementAfterDays: number;
  /** At/after this many days without activity ⇒ dormant. */
  dormantAfterDays: number;
}

/** Task's suggested initial rules: using ≤6d, engagement 7–13d, dormant ≥14d. */
export const DEFAULT_ADOPTION_THRESHOLDS: AdoptionThresholds = {
  usingWithinDays: 7,
  engagementAfterDays: 7,
  dormantAfterDays: 14,
};

export type AdoptionStatus =
  // Patient-assessment activity within the "using" window.
  | "USING"
  // Had assessments, but none for engagementAfterDays..dormantAfterDays-1 days.
  | "NEEDS_ENGAGEMENT"
  // Had assessments, none for dormantAfterDays+ days — the "stopped using" signal.
  | "DORMANT"
  // No assessments ever recorded, but a login identity is linked.
  | "NOT_STARTED"
  // No assessments ever AND no linked login identity — stuck before onboarding.
  | "LOGIN_PENDING"
  // Can't be determined (auth/activity telemetry unreadable, no clinical signal).
  | "UNKNOWN";

/** The operational priority bands for the follow-up queue (1 = most urgent). */
export type FollowUpPriority = 1 | 2 | 3 | 4 | 5;

export interface FollowUp {
  /** null ⇒ no follow-up needed (healthy / actively using). */
  priority: FollowUpPriority | null;
  /** Short imperative next action for the operations team. */
  action: string;
  /** One line of evidence/why. */
  reason: string;
}

export interface AdoptionInput {
  /** ClinicStatus (ARCHIVED is never classified as needing follow-up). */
  status: string;
  /** Whether auth telemetry (auth.users / identities) was readable. */
  authReadable: boolean;
  /** At least one doctor has a linked login identity. */
  hasLinkedLogin: boolean;
  /** At least one doctor has a recorded successful sign-in. */
  anySignedIn: boolean;
  /** Genuine clinical work: a doctor reviewed ≥1 case (approved/revision/rejected). */
  hasDoctorActivity: boolean;
  assessmentsAllTime: number;
  /** Latest submitted assessment instant, or null if none. */
  lastAssessmentAt: Date | null;
  /** Pipeline/report exceptions already computed by classify(). */
  missingConsultation: boolean;
  reportDeliveryAttention: boolean;
  now?: Date;
}

export interface AdoptionResult {
  status: AdoptionStatus;
  /** Whole days since the last submitted assessment; null when none exist. */
  daysSinceLastAssessment: number | null;
  followUp: FollowUp;
}

/** Whole days between two instants (floor), never negative. */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

export function classifyAdoption(
  input: AdoptionInput,
  thresholds: AdoptionThresholds = DEFAULT_ADOPTION_THRESHOLDS,
): AdoptionResult {
  const now = input.now ?? new Date();
  const isArchived = input.status === "ARCHIVED";

  const daysSinceLastAssessment = input.lastAssessmentAt
    ? daysBetween(input.lastAssessmentAt, now)
    : null;

  let status: AdoptionStatus;
  if (isArchived) {
    status = "UNKNOWN";
  } else if (input.assessmentsAllTime > 0 && daysSinceLastAssessment !== null) {
    if (daysSinceLastAssessment < thresholds.usingWithinDays) status = "USING";
    else if (daysSinceLastAssessment < thresholds.dormantAfterDays) status = "NEEDS_ENGAGEMENT";
    else status = "DORMANT";
  } else {
    // No assessment activity at all.
    if (!input.authReadable && !input.hasLinkedLogin) status = "UNKNOWN";
    else if (!input.hasLinkedLogin) status = "LOGIN_PENDING";
    else status = "NOT_STARTED";
  }

  const followUp = suggestFollowUp(input, status, daysSinceLastAssessment);
  return { status, daysSinceLastAssessment, followUp };
}

// Follow-up priority order (from the task):
//   1. Login blocked or not linked
//   2. Clinical pipeline or report delivery blocked
//   3. Assessment activity stopped (dormant / needs engagement)
//   4. Doctor login recorded but no meaningful doctor activity
//   5. New clinic awaiting its first assessment
function suggestFollowUp(
  input: AdoptionInput,
  status: AdoptionStatus,
  daysSince: number | null,
): FollowUp {
  if (input.status === "ARCHIVED") {
    return { priority: null, action: "No action — archived", reason: "Clinic is archived." };
  }
  // 1 — login not linked (can't even get in).
  if (!input.hasLinkedLogin && input.authReadable) {
    return {
      priority: 1,
      action: "Help the doctor complete login setup",
      reason: "No successfully linked login identity.",
    };
  }
  // 2 — clinical pipeline / report delivery blocked.
  if (input.missingConsultation || input.reportDeliveryAttention) {
    return {
      priority: 2,
      action: "Resolve the blocked pipeline / report delivery",
      reason: input.missingConsultation
        ? "Completed assessment(s) have no consultation."
        : "Report asset or delivery needs attention.",
    };
  }
  // 3 — assessment activity stopped.
  if (status === "DORMANT" || status === "NEEDS_ENGAGEMENT") {
    return {
      priority: 3,
      action: "Re-engage — no recent patient assessments",
      reason:
        daysSince !== null
          ? `${daysSince} day(s) since the last assessment.`
          : "Assessment activity has stopped.",
    };
  }
  // 4 — logged in but no meaningful doctor activity.
  if (input.anySignedIn && !input.hasDoctorActivity && input.assessmentsAllTime > 0) {
    return {
      priority: 4,
      action: "Encourage the doctor's first patient review",
      reason: "A doctor has signed in but has not reviewed any case.",
    };
  }
  // 5 — new clinic awaiting its first assessment (login is set up).
  if (status === "NOT_STARTED") {
    return {
      priority: 5,
      action: "Help capture the first patient assessment",
      reason: "Login is linked but no assessments yet.",
    };
  }
  if (status === "UNKNOWN") {
    return {
      priority: null,
      action: "Verify telemetry",
      reason: "Authentication/activity evidence is unavailable here.",
    };
  }
  return { priority: null, action: "No action needed", reason: "Actively using HairOS." };
}

export const ADOPTION_STATUS_LABEL: Record<AdoptionStatus, string> = {
  USING: "Using HairOS",
  NEEDS_ENGAGEMENT: "Needs engagement",
  DORMANT: "Dormant",
  NOT_STARTED: "Not started",
  LOGIN_PENDING: "Login pending",
  UNKNOWN: "Unknown",
};
