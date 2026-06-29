import type { PatientAnswers, KitId } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// PCOS META B variant substitution rule.
//
// Clinical product rule (locked):
//   Disease must be treated before generic metabolic correction. Whenever a
//   patient reports PCOS / PMOS / PCOD in the hormonal answers, the
//   metabolic kit MUST be the PCOS-specific variant — PRO FACT META B PCOS
//   covers AMPK / insulin sensitisation AND androgen suppression in one kit.
//   Prescribing the generic PRO FACT META B alongside PCOS misses the
//   androgen pathway and creates ingredient overlap if both ever co-exist.
//
//   This rule applies IRRESPECTIVE OF THE PRIMARY DIAGNOSIS — a patient
//   whose primary is WEIGHT_LOSS or AGA_FEMALE_123 but who has PCOS as a
//   co-condition still gets META B PCOS, not the generic META B.
//
//   Idempotent:
//     • If PRO FACT META B PCOS is already in phases → no-op.
//     • If PRO FACT META B is present + PCOS detected → swap to PCOS variant.
//     • If neither META B variant is present → no-op (this rule does not
//       inject META B; insertion is owned by metabolicModifierRule /
//       signalGatedInjectionRule / PROTOCOL_SEQUENCER).
//     • If both PRO FACT META B and PRO FACT META B PCOS end up present →
//       drop the generic one (META B PCOS already covers the same biology).
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_META_B: KitId = 'PRO FACT META B';
const PCOS_META_B: KitId = 'PRO FACT META B PCOS';

export function hasPcosSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return (
    s.hormonal('PCOS') ||
    s.hormonal('PCOD') ||
    s.hormonal('PMOS')
  );
}

export function applyPcosMetaBVariantRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
): KitScorerContext {
  if (!hasPcosSignal(ans)) return ctx;

  // Honour the PCOS_OBESITY + Hypothyroid unification — when pcosStackRule has
  // already collapsed META B PCOS + META B HYPOTHYROID into a single generic
  // META B, do NOT swap it back to the PCOS variant. The unified plain META B
  // is the correct kit (covers AMPK/insulin + androgen + T3 in one).
  const unificationApplied = ctx.appliedRules.some(
    (r) => r.includes('PCOS_OBESITY_HYPO') || r.includes('RULE1_HYPO_METABOLIC'),
  );
  if (unificationApplied) return ctx;

  const phases = [...ctx.phases];
  const hasGeneric = phases.includes(GENERIC_META_B);
  const hasPcos = phases.includes(PCOS_META_B);
  const rules: string[] = [];

  // 1. Both variants present → drop generic.
  if (hasGeneric && hasPcos) {
    const next = phases.filter((k) => k !== GENERIC_META_B);
    rules.push(
      'PCOS_META_B_VARIANT: PRO FACT META B removed — PRO FACT META B PCOS already covers AMPK/insulin + androgen suppression. Avoids ingredient overlap.',
    );
    return { ...ctx, phases: next, appliedRules: [...ctx.appliedRules, ...rules] };
  }

  // 2. Generic present, PCOS variant missing → swap.
  if (hasGeneric && !hasPcos) {
    const idx = phases.indexOf(GENERIC_META_B);
    phases[idx] = PCOS_META_B;
    rules.push(
      'PCOS_META_B_VARIANT: PRO FACT META B → PRO FACT META B PCOS. PCOS detected as co-condition; disease-specific variant covers AMPK/insulin + androgen suppression in one kit.',
    );
    return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
  }

  return ctx;
}
