import type { KitId } from '../../../types';
import type { KitScorerContext } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Pattern-kit-last safety pass.
//
// Clinical product rule (locked):
//   Pattern correction kits (FPHL / MPHL family) are the consolidation layer
//   and MUST always be at the tail of the sequence, regardless of how earlier
//   rules sequenced them. They land on follicles that have already been
//   prepared by inflammation control, metabolic correction, immune restoration
//   and hormonal rebalancing.
//
// Function name is preserved (`applyProImmuneLastRule`) for backwards
// compatibility with the pipeline call site — but the rule it enforces is
// now "pattern kit always last" (PRO IMMUNE sits mid-sequence under the new
// sequencing rule established in `kitPrioritizer`).
// ─────────────────────────────────────────────────────────────────────────────

const PATTERN_KIT_PATTERN = /^(MPHL|FPHL)(\s|$|\sPLUS|\sVEG)/;

function isPatternKit(k: KitId | string): boolean {
  return PATTERN_KIT_PATTERN.test(k);
}

export function applyProImmuneLastRule(ctx: KitScorerContext): KitScorerContext {
  const phases = [...ctx.phases];
  const patterns: KitId[] = [];
  const others: KitId[] = [];

  for (const k of phases) {
    if (isPatternKit(k)) patterns.push(k);
    else others.push(k);
  }

  if (patterns.length === 0) return ctx;

  // Already at the tail? No-op.
  const alreadyAtTail =
    patterns.every((p, i) =>
      phases[phases.length - patterns.length + i] === p
    );
  if (alreadyAtTail) return ctx;

  return {
    ...ctx,
    phases: [...others, ...patterns],
    appliedRules: [
      ...ctx.appliedRules,
      'PATTERN_KIT_LAST: FPHL / MPHL pattern correction moved to final phase — consolidation layer after upstream drivers are addressed.',
    ],
  };
}
