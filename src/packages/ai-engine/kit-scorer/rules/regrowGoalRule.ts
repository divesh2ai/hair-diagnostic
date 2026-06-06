import type { KitId, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';

const AGA_KEYS = new Set<DiagnosisKey>([
  'AGA_MALE_123', 'AGA_MALE_45', 'AGA_FEMALE_123', 'AGA_FEMALE_45',
]);
const TE_GOLD_KITS = new Set<KitId>(['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG']);

// When the patient says "shedding has stopped, I only want to regrow":
// - AGA protocols: swap to pattern-loss kit + PRO IMMUNE (TE GOLD wrong regardless of protocol)
// - All other protocols: strip TE GOLD, ensure PRO IMMUNE is present
export function applyRegrowGoalRule(
  ctx: KitScorerContext,
  primaryDiagnosis: DiagnosisKey
): KitScorerContext {
  if (!ctx.flags.isRegrowGoal) return ctx;

  const { isVeg, isMale, isGrade45 } = ctx.flags;

  if (AGA_KEYS.has(primaryDiagnosis)) {
    const agaKit: KitId = isMale
      ? (isGrade45 ? 'MPHL PLUS' : 'MPHL')
      : (isGrade45 ? 'FPHL PLUS' : 'FPHL');
    const immuneKit: KitId = isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD';
    return {
      ...ctx,
      phases: [agaKit, immuneKit],
      appliedRules: [
        ...ctx.appliedRules,
        'REGROW_GOAL_AGA: TE GOLD stripped. Pattern-loss kit + PRO IMMUNE substituted for active shedding stack.',
      ],
    };
  }

  let phases = ctx.phases.filter((k) => !TE_GOLD_KITS.has(k));
  const hasImmune = phases.some((k) => k.includes('PRO IMMUNE'));
  if (!hasImmune) {
    phases = [...phases, isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD'];
  }

  return {
    ...ctx,
    phases,
    appliedRules: [
      ...ctx.appliedRules,
      'REGROW_GOAL_OTHER: TE GOLD stripped from non-AGA protocol. PRO IMMUNE ensured.',
    ],
  };
}
