import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// IRON UP GOLD non-negotiable injection rule (locked clinical rule 2026-06-14).
//
// Iron / Anaemia deficiency is a confirmed disease driver. The kit treating it
// (IRON UP GOLD) must appear whenever the patient declares Iron or Anaemia,
// regardless of which primary diagnosis wins the score race.
//
// Iron is essential for follicular metabolism, oxygen transport, and DNA
// synthesis. Without ferritin repletion, no downstream kit can fully take
// hold — every other intervention lands on iron-starved follicles.
//
// Runs irrespective of primary diagnosis. Idempotent.
// ─────────────────────────────────────────────────────────────────────────────

const IRON_UP_GOLD: KitId = 'IRON UP GOLD';

export function applyIronUpInjectionRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  const s = signals(ans);
  const hasIronDeficiency = s.deficiency('Iron') || s.deficiency('Anaemia');
  const hasHeavyBleeding = s.hormonal('Heavy bleeding');
  if (!hasIronDeficiency && !hasHeavyBleeding) return ctx;

  if (ctx.phases.includes(IRON_UP_GOLD)) return ctx;

  const trigger = hasHeavyBleeding
    ? 'Heavy menstrual bleeding declared → chronic iron loss → IRON UP GOLD injected and lifted to Phase 1 (top) per locked clinical rule. Ferritin repletion is foundational; downstream kits cannot take hold on iron-starved follicles.'
    : 'Iron / Anaemia deficiency declared → IRON UP GOLD injected (non-negotiable). Ferritin repletion is a prerequisite for follicular response to every downstream kit.';

  return {
    ...ctx,
    phases: [...ctx.phases, IRON_UP_GOLD],
    appliedRules: [...ctx.appliedRules, `IRON_UP_INJECTION: ${trigger}`],
  };
}
