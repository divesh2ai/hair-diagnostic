import type { KitId, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';

const TE_GOLD_VARIANTS = new Set<KitId>(['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG']);

// Promotes TE GOLD to Phase 1 when active shedding is confirmed.
// Also strips TE GOLD entirely when patient reports thinning-only (no visible fall).
export function applyActiveSheddingRule(
  ctx: KitScorerContext,
  _primaryDiagnosis: DiagnosisKey
): KitScorerContext {
  const { isVeg, isRegrowGoal, hasNoVisibleFall, hasActiveShedding } = ctx.flags;

  // v39: "Just thinning, no visible fall" → TE GOLD must NEVER be recommended
  if (hasNoVisibleFall) {
    const phases = ctx.phases.filter((k) => !TE_GOLD_VARIANTS.has(k));
    return {
      ...ctx,
      phases,
      appliedRules: [
        ...ctx.appliedRules,
        'NO_VISIBLE_FALL: TE GOLD removed. Patient reports thinning only — no active shedding phase.',
      ],
    };
  }

  if (!hasActiveShedding || isRegrowGoal) return ctx;

  const teGoldKit: KitId = isVeg ? 'HAIR FACT TE GOLD VEG' : 'HAIR FACT TE GOLD';
  const phases = [
    teGoldKit,
    ...ctx.phases.filter((k) => !TE_GOLD_VARIANTS.has(k)),
  ];

  return {
    ...ctx,
    phases,
    appliedRules: [
      ...ctx.appliedRules,
      'ACTIVE_SHEDDING: TE GOLD promoted to Phase 1. Active shedding confirmed — arresting fall is non-negotiable first step.',
    ],
  };
}

// Final-pass audit strip — confirms no TE GOLD variant survived prioritization when patient
// reported thinning-only. Runs after prioritizeKits, before proImmuneLastRule.
export function applyFinalNoVisibleFallRule(ctx: KitScorerContext): KitScorerContext {
  if (!ctx.flags.hasNoVisibleFall) return ctx;
  return {
    ...ctx,
    phases: ctx.phases.filter((k) => !TE_GOLD_VARIANTS.has(k)),
    appliedRules: [
      ...ctx.appliedRules,
      'FINAL_NO_VISIBLE_FALL: TE GOLD stripped on final pass — confirmed thinning-only patient.',
    ],
  };
}
