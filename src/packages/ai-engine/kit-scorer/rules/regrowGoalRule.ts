import type { KitId, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';

const AGA_KEYS = new Set<DiagnosisKey>([
  'AGA_MALE_123', 'AGA_MALE_45', 'AGA_FEMALE_123', 'AGA_FEMALE_45',
]);
const TE_GOLD_KITS = new Set<KitId>(['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG']);

// When the patient says "shedding has stopped, I only want to regrow":
//
// AGA protocols (regrow goal + thinning / widening, no visible hair fall):
//   Only TWO kits are unconditionally guaranteed for this presentation —
//     • PRO FACT META B  (metabolic terrain that sustains follicle dormancy)
//     • PRO IMMUNE       (anagen re-entry / nutritional consolidation)
//   PHENOTYPE INFLAMATION is preserved when the source protocol carried it.
//   The pattern kit (MPHL / FPHL) is NOT forced here — the signal-gated
//   injection rule adds it downstream when actual pattern signals
//   (thinning / widening / parting / genetics-after-30) are reported. If no
//   pattern signal is present, no pattern kit is prescribed.
//
// Non-AGA protocols:
//   Strip TE GOLD and ensure PRO IMMUNE is present (anagen re-entry support).
export function applyRegrowGoalRule(
  ctx: KitScorerContext,
  primaryDiagnosis: DiagnosisKey
): KitScorerContext {
  if (!ctx.flags.isRegrowGoal) return ctx;

  const { isVeg } = ctx.flags;

  if (AGA_KEYS.has(primaryDiagnosis)) {
    let phases = ctx.phases.filter((k) => !TE_GOLD_KITS.has(k));

    const immuneKit: KitId = isVeg ? 'PRO IMMUNE VEG' : 'PRO IMMUNE GOLD';

    // Track whether PHENOTYPE was in the source protocol so we re-add it
    // only if the original protocol called for it (AGA_MALE_45 / AGA_FEMALE_45
    // intentionally omit PHENOTYPE).
    const hadPhenotype = phases.includes('PHENOTYPE INFLAMATION');

    // Strip the kits we manage so we can lay them down in a canonical order.
    // Pattern kits are stripped here so the signal-gated rule re-adds them
    // ONLY when pattern signals are actually present — never as a default.
    phases = phases.filter(
      (k) =>
        !k.includes('FPHL') &&
        !k.includes('MPHL') &&
        !k.includes('PRO IMMUNE') &&
        !k.includes('PRO FACT META B') &&
        k !== 'PHENOTYPE INFLAMATION',
    );

    // PRO FACT META B — non-negotiable for regrow + thinning/widening.
    phases = [...phases, 'PRO FACT META B'];

    if (hadPhenotype) {
      phases = [...phases, 'PHENOTYPE INFLAMATION'];
    }

    // PRO IMMUNE — non-negotiable for regrow (anagen re-entry support).
    phases = [...phases, immuneKit];

    // NOTE: pattern kit intentionally NOT appended here. The signal-gated
    // injection rule (step 6 — pattern loss) handles it when thinning /
    // widening / parting / genetics-after-30 signals are confirmed. If those
    // signals are absent, no pattern kit is prescribed.

    return {
      ...ctx,
      phases,
      appliedRules: [
        ...ctx.appliedRules,
        'REGROW_GOAL_AGA: TE GOLD stripped. PRO FACT META B + PRO IMMUNE are the two guaranteed kits for regrow + thinning/widening presentations. PHENOTYPE retained when source protocol carried it. Pattern kit (MPHL/FPHL) deferred to the signal-gated rule — condition-driven, not hardcoded.',
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
