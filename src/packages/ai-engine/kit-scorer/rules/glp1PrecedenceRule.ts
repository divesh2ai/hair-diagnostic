import type { KitScorerContext } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2: RAPID WEIGHT LOSS SHIELD precedence rule
//
// GLP-1 Early (hair loss within 6 months of starting):
//   SHIELD is ALWAYS Kit 1 — acute nutritional shedding peak is still active.
//   The shield arrests shedding at the GLP-1/nutrient-deficit trigger level.
//
// GLP-1 Late (hair loss after 6 months):
//   SHIELD is ALWAYS Kit 2 — acute shedding peak has passed.
//   TE GOLD leads (shedding arrest), Shield provides nutritional recovery support.
//
// Rapid weight loss / Crash diet (non-GLP-1):
//   SHIELD is ALWAYS Kit 1 — same acute nutritional shedding mechanism as
//   GLP-1 Early. Patient declared crash-diet/keto driven rapid weight loss;
//   Shield is non-negotiable regardless of which primary diagnosis wins the
//   score race.
//
// This rule is applied TWICE in the pipeline:
//   - Once after initial rule processing
//   - Once after priority lifting (to survive liftPhase reordering)
// ─────────────────────────────────────────────────────────────────────────────

const SHIELD = 'RAPID WEIGHT LOSS SHIELD';

export function applyGLP1PrecedenceRule(ctx: KitScorerContext): KitScorerContext {
  const { hasGLP1Early, hasGLP1Late, hasCrashDiet } = ctx.flags;
  if (!hasGLP1Early && !hasGLP1Late && !hasCrashDiet) return ctx;

  let phases = [...ctx.phases];
  const rules: string[] = [];

  if (hasGLP1Early) {
    phases = phases.filter((k) => k !== SHIELD);
    phases.unshift(SHIELD);
    rules.push(
      'GLP1_EARLY: RAPID WEIGHT LOSS SHIELD enforced at position 0. ' +
      'Acute nutritional shedding phase is active — shield arrests it at trigger level.'
    );
  } else if (hasGLP1Late) {
    const shieldIdx = phases.indexOf(SHIELD);
    if (shieldIdx >= 0) phases.splice(shieldIdx, 1);
    phases.splice(1, 0, SHIELD);
    rules.push(
      'GLP1_LATE: RAPID WEIGHT LOSS SHIELD enforced at position 1. ' +
      'Acute shedding peak has passed — TE GOLD leads at position 0, Shield supports nutritional recovery at Phase 2.'
    );
  } else if (hasCrashDiet) {
    phases = phases.filter((k) => k !== SHIELD);
    phases.unshift(SHIELD);
    rules.push(
      'CRASH_DIET: RAPID WEIGHT LOSS SHIELD enforced at position 0. ' +
      'Rapid weight loss / Crash diet declared — non-negotiable Phase 1 regardless of primary diagnosis. ' +
      'Acute nutrient depletion drives diffuse telogen release; Shield arrests it at the trigger level.'
    );
  }

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}
