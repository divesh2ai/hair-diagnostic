import type { KitId, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';
import { isTeGoldDurationAboveThreeMonths } from './teGoldGatingRule';

const TE_GOLD_VARIANTS = new Set<KitId>(['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG']);

// Promotes TE GOLD to Phase 1 when active shedding is confirmed.
// Also strips TE GOLD entirely when patient reports thinning-only (no visible fall).
export function applyActiveSheddingRule(
  ctx: KitScorerContext,
  _primaryDiagnosis: DiagnosisKey
): KitScorerContext {
  const { isVeg, isRegrowGoal, hasNoVisibleFall, hasActiveShedding } = ctx.flags;
  const durationTooLong = isTeGoldDurationAboveThreeMonths(ctx.flags.duration);

  // v39: "Just thinning, no visible fall" → TE GOLD must NEVER be recommended
  // Extended: regrow-goal patients (goal declares no active fall) must also
  // strip any TE GOLD seeded by the base protocol (e.g. AGA_MALE_123). Without
  // this, MPHL/FPHL Grade 1–3 patients with quiet-phase disease keep TE GOLD
  // baked in from protocolSequencer even though clinically there is no shedding.
  if (hasNoVisibleFall || isRegrowGoal) {
    const phases = ctx.phases.filter((k) => !TE_GOLD_VARIANTS.has(k));
    return {
      ...ctx,
      phases,
      appliedRules: [
        ...ctx.appliedRules,
        'NO_VISIBLE_FALL: TE GOLD removed. Patient reports thinning only / regrow-quality goal — no active shedding phase.',
      ],
    };
  }

  if (durationTooLong) {
    const phases = ctx.phases.filter((k) => !TE_GOLD_VARIANTS.has(k));
    return {
      ...ctx,
      phases,
      appliedRules: [
        ...ctx.appliedRules,
        'TE_GOLD_DURATION_CAP: TE GOLD removed on final pass - hair fall duration exceeds 3 months, so TE GOLD is not recommended.',
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
  if (!ctx.flags.hasNoVisibleFall && !ctx.flags.isRegrowGoal) return ctx;
  return {
    ...ctx,
    phases: ctx.phases.filter((k) => !TE_GOLD_VARIANTS.has(k)),
    appliedRules: [
      ...ctx.appliedRules,
      'FINAL_NO_VISIBLE_FALL: TE GOLD stripped on final pass — confirmed thinning-only / regrow-goal patient.',
    ],
  };
}
