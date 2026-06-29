import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// LACTIHEALTH non-negotiable injection rule.
//
// Breastfeeding nutritional demand is the highest-priority driver in
// post-partum TE. When the patient declares "Post partum — still feeding"
// (cause) or "Post-delivery or breastfeeding" (hormonal), LACTIHEALTH must
// appear in the protocol regardless of which primary diagnosis wins the
// score race.
//
// The explicit "not feeding" branch is excluded — those patients route to
// TE_DELIVERY (no LACTIHEALTH).
//
// This rule only adds the kit if missing; it does NOT reposition an existing
// LACTIHEALTH entry. Phase placement is left to the base protocol and the
// active-shedding rule (acute shedding correctly promotes TE GOLD ahead of
// LACTIHEALTH).
//
// Runs irrespective of primary diagnosis. Idempotent.
// ─────────────────────────────────────────────────────────────────────────────

const LACTIHEALTH: KitId = 'LACTIHEALTH';

export function applyLactihealthInjectionRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  if (ctx.phases.includes(LACTIHEALTH)) return ctx;

  const s = signals(ans);

  const postPartumCause      = s.cause('Post partum');
  const explicitlyNotFeeding = s.cause('not feeding');
  const stillFeeding =
    (postPartumCause && !explicitlyNotFeeding) ||
    s.cause('still feeding') ||
    s.hormonal('breastfeeding') ||
    s.hormonal('Post-delivery');

  if (!stillFeeding) return ctx;

  return {
    ...ctx,
    phases: [LACTIHEALTH, ...ctx.phases],
    appliedRules: [
      ...ctx.appliedRules,
      'LACTIHEALTH_INJECTION: Post-partum + breastfeeding declared → LACTIHEALTH injected (non-negotiable). Lactation nutritional demand is the highest-priority driver in post-partum TE; downstream kits cannot compensate.',
    ],
  };
}
