import type { StatusTone } from "@/components/ui/status-badge";
import { REVIEW_PATHWAY_DISPLAY_LABELS } from "@shared/review-pathway/labels";
import type { ReviewPathwayReasonCode } from "@shared/review-pathway/types";

// Clinical review priority — deliberately NOT waiting time.
//
// The queue used to render "URGENT · 763h", which computed a clinical-looking
// badge purely from elapsed hours. Every case eventually became urgent, which
// means nothing was. Priority and waiting are now two independent axes:
//
//    priority  ← clinical/operational classification (this file)
//    waiting   ← elapsed time since submittedAt (waitingShort)
//
// The only source of clinical priority is the review-pathway classifier in
// packages/shared/review-pathway. It is a real, tested classifier with
// doctor-facing reason strings already written.
//
// IMPORTANT — the classifier is currently DISABLED in production.
// evaluateAndPersistReviewPathway() short-circuits to action:"DISABLED" unless
// FEATURE_REVIEW_PATHWAY_SHADOW=true, which is set nowhere, so every row has
// reviewPathway = NULL today (verified: 0 of 489 assessments populated).
//
// Consequently `unclassified` is the tier essentially every live case lands in,
// and it deliberately carries NO reason text. Rendering "no significant red
// flags detected" for a case that was never classified would be a clinical
// safety claim with nothing behind it. We say "Review" and stay quiet.
//
// When the flag is enabled and history backfilled, the other tiers light up
// with real reason codes and no UI change is required.

export type ReviewPriorityTier =
  | "attention"
  | "examination"
  | "focused"
  | "routine"
  | "unclassified";

export interface ReviewPriority {
  tier: ReviewPriorityTier;
  /** Short chip label, e.g. "Focused review". Never includes elapsed time. */
  label: string;
  /**
   * Why this tier was assigned, in clinician language — or null when we have
   * nothing truthful to say. Never fabricate reassurance here.
   */
  reason: string | null;
  tone: StatusTone;
  /** Sort key. Lower sorts first. Mirrors the SQL CASE in the stats loader. */
  rank: number;
}

export interface ReviewPriorityInput {
  assessmentStatus?: string | null;
  reviewPathway?: string | null;
  reviewPathwayReasons?: readonly string[] | null;
}

// Rank must stay in lockstep with REVIEW_PRIORITY_RANK_SQL below.
const RANK: Record<ReviewPriorityTier, number> = {
  attention: 0,
  examination: 1,
  focused: 2,
  routine: 3,
  unclassified: 3,
};

/**
 * SQL fragment producing the same ordering as `rank` above, so the server can
 * order the full pending set without loading it into memory. Kept as a string
 * next to the TS ranks so the two cannot silently drift.
 */
export const REVIEW_PRIORITY_RANK_SQL = `CASE a."reviewPathway"::text
        WHEN 'RESOLUTION_REQUIRED'  THEN 0
        WHEN 'EXAMINATION_REQUIRED' THEN 1
        WHEN 'FOCUSED_REVIEW'       THEN 2
        ELSE 3
      END`;

function describeReasons(codes: readonly string[] | null | undefined): string | null {
  if (!codes || codes.length === 0) return null;
  const labels = codes
    .map(
      (code): string | null =>
        REVIEW_PATHWAY_DISPLAY_LABELS[code as ReviewPathwayReasonCode] ?? null,
    )
    .filter((v): v is string => Boolean(v));
  if (labels.length === 0) return null;
  // Two reasons is as much as a queue row can carry legibly.
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels.slice(0, 2).join(" · ")} +${labels.length - 2} more`;
}

export function reviewPriority(input: ReviewPriorityInput): ReviewPriority {
  const status = (input.assessmentStatus ?? "").toUpperCase();
  const pathway = (input.reviewPathway ?? "").toUpperCase();
  const reasons = describeReasons(input.reviewPathwayReasons);

  // Operational integrity, not a clinical judgement — the report itself is
  // broken, so the case cannot be approved as it stands.
  if (status === "FAILED" || status === "PARTIAL_FAILURE") {
    return {
      tier: "attention",
      label: "Needs attention",
      reason: "Report generation did not complete",
      tone: "danger",
      rank: RANK.attention,
    };
  }

  switch (pathway) {
    case "RESOLUTION_REQUIRED":
      return {
        tier: "attention",
        label: "Needs attention",
        reason: reasons ?? "Blocked before approval",
        tone: "danger",
        rank: RANK.attention,
      };
    case "EXAMINATION_REQUIRED":
      return {
        tier: "examination",
        label: "Examination required",
        reason: reasons,
        tone: "danger",
        rank: RANK.examination,
      };
    case "FOCUSED_REVIEW":
      return {
        tier: "focused",
        label: "Focused review",
        reason: reasons,
        tone: "warning",
        rank: RANK.focused,
      };
    case "ROUTINE_REVIEW":
      return {
        tier: "routine",
        label: "Standard review",
        reason: "No priority flags raised",
        tone: "neutral",
        rank: RANK.routine,
      };
    default:
      // Classifier has not run for this case. Say nothing clinical.
      return {
        tier: "unclassified",
        label: "Review",
        reason: null,
        tone: "neutral",
        rank: RANK.unclassified,
      };
  }
}

/** True for tiers the doctor should look at ahead of the routine backlog. */
export function isPriorityTier(tier: ReviewPriorityTier): boolean {
  return tier === "attention" || tier === "examination" || tier === "focused";
}

/**
 * Clinical attention as DISPLAY information — never as an ordering key.
 *
 * The queue is FIFO: the patient who submitted first is seen first. That is
 * the rule a waiting room can be run on, and it is the rule patients and
 * reception already understand. A classifier that quietly reorders it produces
 * a queue nobody can predict and everybody eventually distrusts.
 *
 * What the classifier is for is telling the doctor something true about the
 * case they are about to open — "painful scalp reported" — so they arrive
 * informed. That is a label on a row, not a promotion.
 *
 * ── Returns null far more often than not ────────────────────────────────────
 * Routine and unclassified cases get nothing. A chip reading "Standard review"
 * on every row is a severity hierarchy applied to a waiting room, and a chip
 * reading "Review" is a button pretending to be information. Silence is the
 * honest rendering when there is nothing to flag — and with the classifier
 * disabled in production (see the note above), silence is almost always the
 * correct answer today.
 */
export interface ClinicalAttention {
  label: string;
  /** Doctor-facing reason, when the classifier produced one. */
  reason: string | null;
  tone: "danger" | "warning";
}

export function clinicalAttention(
  input: ReviewPriorityInput,
): ClinicalAttention | null {
  const priority = reviewPriority(input);
  if (!isPriorityTier(priority.tier)) return null;
  return {
    // "Needs attention" reads like a queue position; "Clinical attention"
    // reads like what it is — a property of the case.
    label: priority.tier === "attention" ? "Clinical attention" : priority.label,
    reason: priority.reason,
    tone: priority.tone === "danger" ? "danger" : "warning",
  };
}

/**
 * "42F" from age + gender, or null when either is missing. Never guesses —
 * an unknown demographic renders as nothing rather than a plausible default.
 */
export function demographicLabel(
  age: number | null | undefined,
  gender: string | null | undefined,
): string | null {
  const g = (gender ?? "").trim().toUpperCase();
  const initial = g.startsWith("F") ? "F" : g.startsWith("M") ? "M" : null;
  if (age == null && !initial) return null;
  if (age == null) return initial;
  return initial ? `${age}${initial}` : `${age}`;
}
