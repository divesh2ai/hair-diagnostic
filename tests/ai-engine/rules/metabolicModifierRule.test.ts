import { applyMetabolicModifierRule, detectMetabolicSignal } from '../../../src/packages/ai-engine/kit-scorer/rules/metabolicModifierRule';
import type { KitScorerContext } from '../../../src/packages/ai-engine/kit-scorer/types';
import type { PatientAnswers } from '../../../src/packages/types';

function baseAns(overrides: Partial<PatientAnswers> = {}): PatientAnswers {
  return {
    sex: 'Female', age: '35', grade: 'Grade 2',
    thyroid: [], hormonal: [], lifestyle: [], diet: [],
    cause: [], scalp: [], immunity: [], deficiency: [],
    gut: [], hairtype: [], treatment: [],
    goal: ['Reduce hair fall'],
    duration: '3–6 months', count: '50–100 strands',
    ...overrides,
  };
}

function baseCtx(phases: string[], overrides: Partial<KitScorerContext> = {}): KitScorerContext {
  return {
    phases,
    flags: {
      isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: false, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false, hasCrashDiet: false,
      age: 35,
      goal: 'Reduce hair fall', grade: 'Grade 2',
      count: '50–100 strands', duration: '3–6 months',
    },
    therapyNeeds: { needs: [], needReasons: {} },
    appliedRules: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// detectMetabolicSignal
// ─────────────────────────────────────────────────────────────────────────────

describe('detectMetabolicSignal', () => {
  test('returns true for Obesity lifestyle', () => {
    expect(detectMetabolicSignal(baseAns({ lifestyle: ['Obesity'] }))).toBe(true);
  });

  test('returns true for Sedentary lifestyle', () => {
    expect(detectMetabolicSignal(baseAns({ lifestyle: ['Sedentary lifestyle'] }))).toBe(true);
  });

  test('returns true for Diabetes thyroid answer', () => {
    expect(detectMetabolicSignal(baseAns({ thyroid: ['Diabetes'] }))).toBe(true);
  });

  test('returns true for Pre diabetes thyroid answer', () => {
    expect(detectMetabolicSignal(baseAns({ thyroid: ['Pre diabetes'] }))).toBe(true);
  });

  test('returns true for Crash diet', () => {
    expect(detectMetabolicSignal(baseAns({ diet: ['Crash diet'] }))).toBe(true);
  });

  test('returns true for Keto diet', () => {
    expect(detectMetabolicSignal(baseAns({ diet: ['Keto'] }))).toBe(true);
  });

  test('returns false for no metabolic signals', () => {
    expect(detectMetabolicSignal(baseAns())).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1: applyMetabolicModifierRule
// ─────────────────────────────────────────────────────────────────────────────

describe('RULE 1 — applyMetabolicModifierRule', () => {
  test('no metabolic signal → returns ctx unchanged', () => {
    const ctx = baseCtx(['PRO FACT META B HYPOTHYROID', 'HAIR FACT TE GOLD']);
    const result = applyMetabolicModifierRule(ctx, baseAns(), 'THYROID_HYPO');
    expect(result.phases).toEqual(['PRO FACT META B HYPOTHYROID', 'HAIR FACT TE GOLD']);
    expect(result.appliedRules).toHaveLength(0);
  });

  test('THYROID_HYPO + obesity → replaces HYPOTHYROID variant with PRO FACT META B', () => {
    const ctx = baseCtx(['PRO FACT META B HYPOTHYROID', 'HAIR FACT TE GOLD']);
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'THYROID_HYPO');
    expect(result.phases).toContain('PRO FACT META B');
    expect(result.phases).not.toContain('PRO FACT META B HYPOTHYROID');
  });

  test('RULE 1 swap logs RULE1_HYPO_METABOLIC rule reason', () => {
    const ctx = baseCtx(['PRO FACT META B HYPOTHYROID']);
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'THYROID_HYPO');
    expect(result.appliedRules.some((r) => r.includes('RULE1_HYPO_METABOLIC'))).toBe(true);
  });

  test('THYROID_HYPO + metabolic but HYPOTHYROID variant absent → generic META B appended', () => {
    const ctx = baseCtx(['HAIR FACT TE GOLD']);
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'THYROID_HYPO');
    expect(result.phases).toContain('PRO FACT META B');
    expect(result.appliedRules.some((r) => r.includes('METABOLIC_GENERIC'))).toBe(true);
  });

  test('PERI_MENOPAUSE + metabolic → PRO FACT META B injected at position 1', () => {
    const ctx = baseCtx(['HAIR FACT PERI MENOPAUSE', 'FPHL', 'PRO IMMUNE GOLD']);
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'PERI_MENOPAUSE');
    expect(result.phases[0]).toBe('HAIR FACT PERI MENOPAUSE');
    expect(result.phases[1]).toBe('PRO FACT META B');
    expect(result.appliedRules.some((r) => r.includes('PERI_MENO_METABOLIC'))).toBe(true);
  });

  test('PERI_MENOPAUSE + metabolic but META B already present → not injected again', () => {
    const ctx = baseCtx(['HAIR FACT PERI MENOPAUSE', 'PRO FACT META B']);
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'PERI_MENOPAUSE');
    const metaBCount = result.phases.filter((k) => k.includes('PRO FACT META B')).length;
    expect(metaBCount).toBe(1);
  });

  test('non-THYROID_HYPO/PERI diagnosis + metabolic → generic META B appended', () => {
    const ctx = baseCtx(['HAIR FACT TE GOLD', 'PRO IMMUNE GOLD']);
    const ans = baseAns({ lifestyle: ['Sedentary lifestyle'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'TE_STRESS');
    expect(result.phases).toContain('PRO FACT META B');
    expect(result.appliedRules.some((r) => r.includes('METABOLIC_GENERIC'))).toBe(true);
  });

  test('META B already covered → no duplicate generic injection', () => {
    const ctx = baseCtx(['HAIR FACT TE GOLD', 'PRO FACT META B']);
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyMetabolicModifierRule(ctx, ans, 'TE_STRESS');
    const metaBCount = result.phases.filter((k) => k.includes('PRO FACT META B')).length;
    expect(metaBCount).toBe(1);
  });
});
