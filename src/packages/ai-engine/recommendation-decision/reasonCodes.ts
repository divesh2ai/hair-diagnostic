// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDATION REASON CODES — machine-readable enum.
//
// Codes are consumed by RecommendationDecision.reasonCodes /
// eligibility.reasonCodes / safety.blockingCodes and by the trace-mode
// discrepancy list. This is NOT a clinical policy surface — codes describe
// what already happened inside the live pipeline. No code implies a new rule.
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationReasonCode =
  // Eligibility — kit is a candidate and matched a condition upstream.
  | 'ELIGIBLE_CONDITION_MATCH'
  // Eligibility — no active clinical indication for this kit.
  | 'NO_ACTIVE_INDICATION'
  // Eligibility — resolveKitInteractions dropped the condition that would
  // have selected this kit (supersession / unification / mutex). The exact
  // rule string is preserved on the decision as an audit string.
  | 'SUPERSEDED_BY_INTERACTION_RULE'
  | 'UNIFIED_INTO_ANOTHER_KIT'
  | 'MUTEX_LOST_TO_HIGHER_PRIORITY_KIT'
  // Eligibility — the clinic doesn't stock this kit and no substitute exists.
  | 'CLINIC_UNAVAILABLE_NO_SUBSTITUTE'
  // Eligibility — kit was capped out by the budget/maxKits limit.
  | 'BUDGET_CAP_TRUNCATED'

  // Safety — mapped 1:1 from SafetyRuleId of the existing evaluator.
  // The evaluator remains the single source of truth; these codes are
  // deterministic renames so the adapter never re-classifies a safety verdict.
  | 'SAFETY_PREGNANCY_KIT_LOCK'
  | 'SAFETY_PREGNANCY_TOPICAL_BLOCK'
  | 'SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK'
  | 'SAFETY_HYPERTENSION_MINOXIDIL_BLOCK'
  | 'SAFETY_HYPERTENSION_ORAL_MINOXIDIL_CAUTION'
  | 'SAFETY_FINASTERIDE_MALE_UNDER_18'
  | 'SAFETY_FINASTERIDE_FEMALE_PREGNANCY_POTENTIAL'
  | 'SAFETY_ORAL_MINOXIDIL_OVER_60_CARDIAC'
  | 'SAFETY_KIT_COMBINATION_UNIFIED'
  | 'SAFETY_INPUT_HYPERTENSION_FREE_TEXT_ONLY'
  | 'SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE'
  | 'SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED'
  // Safety — evaluator emitted a BLOCK finding whose ruleId is not one of
  // the canonical enum values above. Preserved for future-proofing.
  | 'SAFETY_BLOCKED_UNKNOWN_RULE'

  // Trace / defect signals (never a clinical rule).
  // The live scorer does not expose a per-kit score breakdown; this code
  // marks that the score column is a placeholder rather than an invented
  // component.
  | 'LEGACY_SCORE_COMPONENT_UNAVAILABLE'
  // Trace — kit's tier could not be derived from existing sequence buckets
  // or resolveKitInteractions rule labels. Reveals unexplained ordering.
  | 'LEGACY_SEQUENCE_POLICY'
  // Discrepancy — the legacy sequence (before safety filtering) ranked a
  // kit that the evaluator later declared blocked. The final list still
  // strips it, but the fact that the scorer considered it at all is a
  // defect signal.
  | 'LEGACY_RANKED_BLOCKED_KIT'
  // Discrepancy — kit is in the final sequence with no matched condition.
  | 'NO_INDICATION_IN_FINAL'
  // Discrepancy — kit is in the final sequence with no machine-readable
  // reason after all eligibility/safety codes were emitted.
  | 'NO_MACHINE_REASON_AVAILABLE'
  // Discrepancy — final ordering position depended on Set insertion order,
  // Object key order, or an unmatched fallback branch rather than an
  // explicit priority slot.
  | 'IMPLICIT_ORDER_FALLBACK'
  // Discrepancy — filtered canonical order (legacy minus safety-blocked)
  // does not match the final sequence emitted by the live pipeline.
  | 'SEQUENCE_DIVERGENCE';

// Safety-rule → reason-code map, kept as a plain lookup so an unknown ruleId
// coming out of the evaluator degrades to `SAFETY_BLOCKED_UNKNOWN_RULE`
// rather than silently disappearing.
export const SAFETY_RULE_TO_REASON: Readonly<Record<string, RecommendationReasonCode>> = {
  SAFETY_PREGNANCY_KIT_LOCK: 'SAFETY_PREGNANCY_KIT_LOCK',
  SAFETY_PREGNANCY_TOPICAL_BLOCK: 'SAFETY_PREGNANCY_TOPICAL_BLOCK',
  SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK: 'SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK',
  SAFETY_HYPERTENSION_MINOXIDIL_BLOCK: 'SAFETY_HYPERTENSION_MINOXIDIL_BLOCK',
  SAFETY_HYPERTENSION_ORAL_MINOXIDIL_CAUTION: 'SAFETY_HYPERTENSION_ORAL_MINOXIDIL_CAUTION',
  SAFETY_FINASTERIDE_MALE_UNDER_18: 'SAFETY_FINASTERIDE_MALE_UNDER_18',
  SAFETY_FINASTERIDE_FEMALE_PREGNANCY_POTENTIAL: 'SAFETY_FINASTERIDE_FEMALE_PREGNANCY_POTENTIAL',
  SAFETY_ORAL_MINOXIDIL_OVER_60_CARDIAC: 'SAFETY_ORAL_MINOXIDIL_OVER_60_CARDIAC',
  SAFETY_KIT_COMBINATION_UNIFIED: 'SAFETY_KIT_COMBINATION_UNIFIED',
  SAFETY_INPUT_HYPERTENSION_FREE_TEXT_ONLY: 'SAFETY_INPUT_HYPERTENSION_FREE_TEXT_ONLY',
  SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE:
    'SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE',
  SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED: 'SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED',
};
