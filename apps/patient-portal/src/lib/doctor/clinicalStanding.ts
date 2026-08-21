// Where a case stands, from the doctor's point of view. One rule, every surface.
//
// ── Why this is domain code and not a component helper ──────────────────────
// Before this existed, three surfaces answered "is this case done?" separately:
// the registry row, the calendar cell, and `components/ui/StatusBadges`. They
// disagreed. `statusTone("COMPLETED")` painted a finished-but-unapproved report
// EMERALD on the patient detail page while the registry correctly showed the
// same case AMBER — one screen telling a doctor their work was finished and
// another telling them it was owed.
//
// So the classification lives here, in lib, with no colours and no JSX. A
// surface may choose how to paint a standing; no surface gets to decide what a
// standing IS.
//
// ── The one rule that matters ───────────────────────────────────────────────
// Two independent facts feed this, and the order they are consulted is the
// whole point:
//
//   reviewDecision — has the DOCTOR signed this off?
//   status         — how far did the PIPELINE get?
//
// The decision is read FIRST. A report can reach AssessmentStatus.COMPLETED
// while still sitting unread in the review queue. Green must mean a human
// approved it, never that a machine finished writing it.

/**
 * The six meanings a case can carry. Named for what they mean, not what colour
 * they render as — a surface maps these to its own palette.
 */
export type Standing =
  | "REVIEWED" //   Doctor is finished. Nothing is owed.
  | "AWAITING_REVIEW" // Doctor is the blocker. Report is ready and unread.
  | "PROCESSING" //  System is working. Nothing owed by anyone.
  | "ATTENTION" //   Failed or refused. Needs a human to look.
  | "NONE"; //       No assessment yet.

export interface StandingInfo {
  standing: Standing;
  /** Short label for a chip. */
  label: string;
  /** One sentence, used as the accessible name and in the day panel. */
  detail: string;
  /**
   * Sort weight for "what should the doctor do next" — lower comes first.
   * Pending review outranks everything; completed work sinks. See
   * `compareByPriority`.
   */
  priority: number;
}

export interface CaseFacts {
  /** 0 means the patient has never submitted. */
  assessmentCount: number;
  /** AssessmentStatus of the latest assessment. */
  lastStatus?: string | null;
  /** ReviewDecision of the latest assessment. */
  lastReviewDecision?: string | null;
}

/** Pipeline states meaning the machine has finished and the doctor is next. */
const PIPELINE_DONE = new Set(["COMPLETED", "CLINICAL_READY"]);

export function standingOf(facts: CaseFacts): StandingInfo {
  if (facts.assessmentCount === 0 || !facts.lastStatus) {
    return {
      standing: "NONE",
      label: "No assessment",
      detail: "This patient has not submitted an assessment yet.",
      priority: 5,
    };
  }

  switch (facts.lastReviewDecision) {
    case "APPROVED":
      return {
        standing: "REVIEWED",
        label: "Reviewed",
        detail: "You approved this patient's latest report.",
        priority: 4,
      };
    case "REJECTED":
      return {
        standing: "ATTENTION",
        label: "Rejected",
        detail: "The latest report was rejected at review.",
        priority: 2,
      };
    case "EDITS_REQUESTED":
      // The doctor has acted; the ball is back with the system. Deliberately
      // NOT amber — amber means "you are the blocker", and here you are not.
      return {
        standing: "PROCESSING",
        label: "Revision sent",
        detail: "You sent the latest report back for revision.",
        priority: 3,
      };
  }

  // reviewDecision is PENDING — the pipeline decides what is actually owed.
  //
  // FAILED and PARTIAL_FAILURE are kept apart rather than collapsed into one
  // red label. They call for different actions: a total failure has nothing to
  // read and needs a retry, while a partial one produced most of a report and
  // may still be worth opening. Labelling both "Failed" would send a doctor to
  // retry a case they could have reviewed.
  if (facts.lastStatus === "FAILED") {
    return {
      standing: "ATTENTION",
      label: "Failed",
      detail: "Report generation failed for the latest assessment.",
      priority: 2,
    };
  }
  if (facts.lastStatus === "PARTIAL_FAILURE") {
    return {
      standing: "ATTENTION",
      label: "Partial failure",
      detail:
        "Some parts of the latest report did not generate. What was produced is still readable.",
      priority: 2,
    };
  }
  if (PIPELINE_DONE.has(facts.lastStatus)) {
    return {
      standing: "AWAITING_REVIEW",
      label: "Awaiting review",
      detail: "The report is ready and waiting for you to read it.",
      priority: 1,
    };
  }
  return {
    standing: "PROCESSING",
    label: "Processing",
    detail: "The report for the latest assessment is still being generated.",
    priority: 3,
  };
}

/**
 * Default registry order: the work the doctor owes, first.
 *
 * Awaiting review → needs attention → processing → reviewed → no assessment,
 * and within a band the most recent submission leads. Sorting the register by
 * recency alone buries a three-day-old pending review under this morning's
 * already-approved cases, which is the opposite of what the page is for.
 */
export function compareByPriority(
  a: CaseFacts & { lastAssessment?: string | null },
  b: CaseFacts & { lastAssessment?: string | null },
): number {
  const pa = standingOf(a).priority;
  const pb = standingOf(b).priority;
  if (pa !== pb) return pa - pb;
  const ta = a.lastAssessment ? new Date(a.lastAssessment).getTime() : 0;
  const tb = b.lastAssessment ? new Date(b.lastAssessment).getTime() : 0;
  return tb - ta;
}

// ── What the doctor does next ───────────────────────────────────────────────

export type NextAction =
  /** A real destination the doctor should go to now. */
  | { kind: "primary" | "secondary"; label: string; href: string }
  /** Nothing to act on. Rendered as text, never as a dead button. */
  | { kind: "inert"; label: string };

/**
 * The single next step for a case.
 *
 * Every state resolves to exactly one, and states with nothing to do resolve to
 * `inert` rather than a disabled button. A button a doctor cannot press is a
 * question they have to answer before they can move on.
 */
export function nextActionOf(
  facts: CaseFacts,
  refs: { assessmentId?: string | null; reviewHref?: string | null },
): NextAction {
  const { standing } = standingOf(facts);
  const href = refs.reviewHref ?? null;

  if (standing === "NONE") return { kind: "inert", label: "No assessment" };
  if (!href || !refs.assessmentId) {
    return { kind: "inert", label: "Open patient" };
  }

  switch (standing) {
    case "AWAITING_REVIEW":
      return { kind: "primary", label: "Review", href };
    case "ATTENTION":
      return { kind: "primary", label: "Open case", href };
    case "REVIEWED":
      return { kind: "secondary", label: "View report", href };
    case "PROCESSING":
      return { kind: "inert", label: "Processing" };
  }
}
