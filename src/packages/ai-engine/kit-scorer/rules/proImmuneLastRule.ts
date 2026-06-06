import type { KitId } from '../../../types';
import type { KitScorerContext } from '../types';

const PRO_IMMUNE_VARIANTS: KitId[] = ['PRO IMMUNE GOLD', 'PRO IMMUNE VEG', 'PRO IMMUNE GOLD PLUS'];

// PRO IMMUNE must always be the final phase.
// It is the nutritional regrowth supply kit — most effective when delivered into
// a clean, DHT-suppressed, inflammation-free follicle environment built by all
// preceding phases.
export function applyProImmuneLastRule(ctx: KitScorerContext): KitScorerContext {
  const phases = [...ctx.phases];
  let moved = false;

  for (const variant of PRO_IMMUNE_VARIANTS) {
    const idx = phases.indexOf(variant);
    if (idx >= 0 && idx < phases.length - 1) {
      phases.splice(idx, 1);
      phases.push(variant);
      moved = true;
    }
  }

  if (!moved) return ctx;
  return {
    ...ctx,
    phases,
    appliedRules: [
      ...ctx.appliedRules,
      'PRO_IMMUNE_LAST: PRO IMMUNE moved to final phase — nutritional regrowth supply into a clean follicle environment.',
    ],
  };
}
