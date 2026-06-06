import type { PatientAnswers, DiagnosisKey } from '../../../types';
import type { KitScorerContext } from '../types';
import { signals } from '../../clinical-engine/signals';

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1: PRO FACT META B substitution rule
//
// Hypothyroid + (Diabetes OR Obesity OR Sedentary)
//   → use PRO FACT META B (NOT PRO FACT META B HYPOTHYROID)
//
// Rationale: PRO FACT META B is a 2-condition integrated kit covering 96% of
// the hypothyroid metabolic deficit AND 79% of the obesity/sedentary metabolic-
// syndrome profile. Prescribing both variants creates AMPK/Berberine/NMN
// duplication. The integrated kit is the correct clinical choice.
// ─────────────────────────────────────────────────────────────────────────────

export function detectMetabolicSignal(ans: PatientAnswers): boolean {
  const s = signals(ans);
  return (
    s.lifestyle('Obesity') || s.lifestyle('Sedentary') ||
    s.lifestyle('weight')  || s.lifestyle('Weight gain') ||
    s.hormonal('Obesity')  ||
    s.diet('Irregular')    || s.diet('poor') || s.diet('Keto') || s.diet('Crash') ||
    s.thyroid('Pre diabetes') || s.thyroid('Diabetes')
  );
}

export function applyMetabolicModifierRule(
  ctx: KitScorerContext,
  ans: PatientAnswers,
  primaryDiagnosis: DiagnosisKey
): KitScorerContext {
  const hasMetabolicSignal = detectMetabolicSignal(ans);
  if (!hasMetabolicSignal) return ctx;

  let phases = [...ctx.phases];
  const rules: string[] = [];

  // ── RULE 1: HYPOTHYROID + METABOLIC → swap HYPOTHYROID variant ───────────
  if (primaryDiagnosis === 'THYROID_HYPO') {
    const hypoIdx = phases.indexOf('PRO FACT META B HYPOTHYROID');
    if (hypoIdx >= 0) {
      phases[hypoIdx] = 'PRO FACT META B';
      rules.push(
        'RULE1_HYPO_METABOLIC: Hypothyroid + metabolic signal detected. ' +
        'PRO FACT META B replaces PRO FACT META B HYPOTHYROID. ' +
        'Single integrated kit covers T3 metabolic correction AND insulin/adipose-tissue correction. ' +
        'Avoids AMPK/Berberine/NMN duplication.'
      );
    }
  }

  // ── PERI-MENOPAUSE + METABOLIC → inject META B after Phase 1 ────────────
  if (primaryDiagnosis === 'PERI_MENOPAUSE') {
    const alreadyHasMetaB = phases.some((k) => k.includes('PRO FACT META B'));
    if (!alreadyHasMetaB) {
      phases.splice(1, 0, 'PRO FACT META B');
      phases = phases.slice(0, 4);
      rules.push('PERI_MENO_METABOLIC: metabolic signal detected → PRO FACT META B injected at Phase 2 of PERI protocol.');
    }
  }

  // ── Generic injection when no META B variant present yet ─────────────────
  const metaBAlreadyCovered = phases.some((k) => k.includes('PRO FACT META B'));
  if (!metaBAlreadyCovered) {
    phases = [...phases, 'PRO FACT META B'].slice(0, 5);
    rules.push('METABOLIC_GENERIC: metabolic signal detected → PRO FACT META B injected.');
  }

  if (rules.length === 0) return ctx;
  return { ...ctx, phases, appliedRules: [...ctx.appliedRules, ...rules] };
}
