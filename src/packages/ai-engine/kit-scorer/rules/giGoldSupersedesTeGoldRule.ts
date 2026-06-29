import type { KitId } from '../../../types';
import type { KitScorerContext } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// GI GOLD supersedes TE GOLD (locked clinical rule).
//
// Confirmed 2026-06-14: PRO FACT GI GOLD's gut-axis restoration (mucosal repair
// + digestive enzymes + probiotic blend) covers the downstream biology that
// HAIR FACT TE GOLD targets via direct nutrient supply. Co-prescribing creates
// ingredient overlap and adds patient cost without clinical benefit.
//
// Action: when final phases contain BOTH GI GOLD and TE GOLD, drop TE GOLD.
// This applies even in acute-shedding cases — GI GOLD wins Phase 1.
//
// Idempotent: no-op if either kit is absent.
// ─────────────────────────────────────────────────────────────────────────────

const GI_GOLD_KITS: KitId[] = ['PRO FACT GI GOLD', 'PRO FACT GI GOLD VEG'];
const TE_GOLD_KITS: KitId[] = ['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG'];

export function applyGiGoldSupersedesTeGoldRule(ctx: KitScorerContext): KitScorerContext {
  const hasGiGold = ctx.phases.some((k) => GI_GOLD_KITS.includes(k));
  const hasTeGold = ctx.phases.some((k) => TE_GOLD_KITS.includes(k));
  if (!hasGiGold || !hasTeGold) return ctx;

  const phases = ctx.phases.filter((k) => !TE_GOLD_KITS.includes(k));

  return {
    ...ctx,
    phases,
    appliedRules: [
      ...ctx.appliedRules,
      'GI_GOLD_SUPERSEDES_TE_GOLD: HAIR FACT TE GOLD removed — PRO FACT GI GOLD already covers the gut-axis restoration that drives nutrient bioavailability and downstream shedding arrest. Co-prescribing creates ingredient overlap.',
    ],
  };
}
