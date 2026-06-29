import type { KitId } from '../../../types';
import type { KitScorerContext } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PERI MENOPAUSE supersedes TE GOLD (locked clinical rule).
//
// When HAIR FACT PERI MENOPAUSE (or VEG variant) and HAIR FACT TE GOLD are
// both present in the final phases, PERI takes TE GOLD's sequence position
// and TE GOLD is removed. PERI's hormonal-axis correction already drives the
// downstream shedding-arrest biology that TE GOLD targets; co-prescribing
// duplicates without clinical benefit.
//
// Idempotent. No-op when either kit is absent or they share an index
// (impossible in practice — different KitIds).
// ─────────────────────────────────────────────────────────────────────────────

const PERI_KITS: KitId[] = ['HAIR FACT PERI MENOPAUSE', 'HAIR FACT PERI MENOPAUSE VEG'];
const TE_GOLD_KITS: KitId[] = ['HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG'];

export function applyPeriMenopauseSupersedesTeGoldRule(
  ctx: KitScorerContext,
): KitScorerContext {
  const periIdx = ctx.phases.findIndex((k) => PERI_KITS.includes(k));
  const teIdx = ctx.phases.findIndex((k) => TE_GOLD_KITS.includes(k));
  if (periIdx === -1 || teIdx === -1) return ctx;

  const periKit = ctx.phases[periIdx];

  // Drop both kits, then re-insert PERI at TE GOLD's original slot.
  // If PERI sat before TE GOLD, the splice index shifts down by one because
  // removing the earlier PERI shortens the prefix.
  const targetIdx = teIdx > periIdx ? teIdx - 1 : teIdx;
  const phases = ctx.phases.filter((_, i) => i !== periIdx && i !== teIdx);
  phases.splice(targetIdx, 0, periKit);

  return {
    ...ctx,
    phases,
    appliedRules: [
      ...ctx.appliedRules,
      `PERI_SUPERSEDES_TE_GOLD: HAIR FACT TE GOLD removed — HAIR FACT PERI MENOPAUSE moved to its slot. Perimenopause kit's hormonal-axis correction already covers the downstream shedding-arrest biology TE GOLD targets; co-prescribing duplicates without clinical benefit.`,
    ],
  };
}
