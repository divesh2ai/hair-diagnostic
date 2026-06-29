import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// GI GOLD final guard (locked clinical rule 2026-06-14).
//
// Belt-and-braces: strip PRO FACT GI GOLD from final phases if the locked
// trigger expression is false. Protects against future rule drift where a new
// signal pathway accidentally injects GI GOLD for non-eligible patients
// (Bloating-only / Constipation / Indigestion).
//
// Allowed triggers: GERD / IBS / Acid reflux / Crohn — exhaustive.
// Runs LAST in the pipeline, after every injection and prioritisation step.
// ─────────────────────────────────────────────────────────────────────────────

const GI_GOLD_KITS: KitId[] = ['PRO FACT GI GOLD', 'PRO FACT GI GOLD VEG'];

export function applyGiGoldFinalGuardRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  const hasGiGold = ctx.phases.some((k) => GI_GOLD_KITS.includes(k));
  if (!hasGiGold) return ctx;

  const s = signals(ans);
  const allowedTrigger =
    s.gut('GERD') || s.gut('IBS') || s.gut('Acid') || s.gut('Crohn');
  if (allowedTrigger) return ctx;

  const phases = ctx.phases.filter((k) => !GI_GOLD_KITS.includes(k));

  return {
    ...ctx,
    phases,
    appliedRules: [
      ...ctx.appliedRules,
      'GI_GOLD_FINAL_GUARD: PRO FACT GI GOLD stripped — patient gut signals do not include GERD / IBS / Acid reflux / Crohn. Bloating / Constipation / Indigestion never trigger GI GOLD (locked clinical rule).',
    ],
  };
}
