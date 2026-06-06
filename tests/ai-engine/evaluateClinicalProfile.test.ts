import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import type { PatientAnswers } from '../../src/packages/types';

function base(overrides: Partial<PatientAnswers> = {}): PatientAnswers {
  return {
    sex: 'Female',
    age: '35',
    grade: 'Grade 2',
    thyroid: [],
    hormonal: [],
    lifestyle: [],
    diet: [],
    cause: [],
    scalp: [],
    immunity: [],
    deficiency: [],
    gut: [],
    hairtype: [],
    treatment: [],
    goal: ['Reduce hair fall'],
    duration: '3–6 months',
    count: '50–100 strands',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnosis detection
// ─────────────────────────────────────────────────────────────────────────────

describe('Clinical Engine — diagnosis detection', () => {
  test('detects THYROID_HYPO as dominant', () => {
    const profile = evaluateClinicalProfile(base({ thyroid: ['Hypothyroidism'] }));
    expect(profile.primaryDiagnosis).toBe('THYROID_HYPO');
  });

  test('detects PCOS_OBESITY over PCOS_ONLY when obesity present', () => {
    const profile = evaluateClinicalProfile(base({
      hormonal: ['PCOS / PCOD + Obesity'],
      lifestyle: ['Obesity'],
    }));
    expect(profile.primaryDiagnosis).toBe('PCOS_OBESITY');
  });

  test('detects PCOS_ONLY when no obesity', () => {
    const profile = evaluateClinicalProfile(base({ hormonal: ['PCOS / PCOD only'] }));
    expect(profile.primaryDiagnosis).toBe('PCOS_ONLY');
  });

  test('PERI_MENOPAUSE dominates AGA — hormonal always wins (98 > 70)', () => {
    const profile = evaluateClinicalProfile(base({
      hormonal: ['Peri-menopause'],
      cause: ['Genetics / Family history'],
      hairtype: ['Thinning all over'],
    }));
    expect(profile.primaryDiagnosis).toBe('PERI_MENOPAUSE');
    const secondaryKeys = profile.secondaryDiagnoses.map((d) => d.key);
    expect(secondaryKeys.some((k) => k.startsWith('AGA'))).toBe(true);
  });

  test('PREGNANCY is an absolute lock — no secondary conditions', () => {
    const profile = evaluateClinicalProfile(base({ hormonal: ['Currently pregnant'] }));
    expect(profile.primaryDiagnosis).toBe('PREGNANCY');
    expect(profile.secondaryDiagnoses).toHaveLength(0);
  });

  test('EARLY_GREY is an absolute lock when sole goal', () => {
    const profile = evaluateClinicalProfile(base({ goal: 'Early greying / premature greying' }));
    expect(profile.primaryDiagnosis).toBe('EARLY_GREY');
  });

  test('EARLY_GREY is NOT a lock when combined with hair fall goal', () => {
    const profile = evaluateClinicalProfile(base({
      goal: ['Reduce hair fall', 'Early greying / premature greying'],
      cause: ['Stress / Anxiety'],
    }));
    expect(profile.primaryDiagnosis).not.toBe('EARLY_GREY');
    expect(profile.flags.hasGreyGoal).toBe(true);
    expect(profile.flags.hasHairGoal).toBe(true);
  });

  test('Grade 4/5 at age >= 20 forces AGA diagnosis regardless of stress signals', () => {
    const profile = evaluateClinicalProfile(base({
      age: '28',
      grade: 'Grade 4',
      sex: 'Male',
      cause: ['Stress / Anxiety'],
    }));
    expect(profile.primaryDiagnosis).toBe('AGA_MALE_45');
  });

  test('WEIGHT_LOSS detected from GLP-1 cause', () => {
    const profile = evaluateClinicalProfile(base({
      cause: ['GLP-1 receptor agonist (hair loss within 6 months)'],
    }));
    expect(profile.primaryDiagnosis).toBe('WEIGHT_LOSS');
    expect(profile.flags.hasGLP1Early).toBe(true);
  });

  test('THYROID_HYPO (100) beats PERI_MENOPAUSE (98)', () => {
    const profile = evaluateClinicalProfile(base({
      thyroid: ['Hypothyroidism'],
      hormonal: ['Peri-menopause'],
    }));
    expect(profile.primaryDiagnosis).toBe('THYROID_HYPO');
    const secondary = profile.secondaryDiagnoses.map((d) => d.key);
    expect(secondary).toContain('PERI_MENOPAUSE');
  });

  test('ALOPECIA_AREATA (105) beats THYROID_HYPO (100)', () => {
    const profile = evaluateClinicalProfile(base({
      immunity: ['Alopecia Areata (patchy hair loss)'],
      thyroid: ['Hypothyroidism'],
    }));
    expect(profile.primaryDiagnosis).toBe('ALOPECIA_AREATA');
  });

  test('regrow-only goal falls back to REGROW_ONLY when no specific condition', () => {
    const profile = evaluateClinicalProfile(base({
      goal: ['Hair fall has stopped, I want to regrow only'],
      age: '25',
    }));
    expect(profile.primaryDiagnosis).toBe('REGROW_ONLY');
    expect(profile.flags.isRegrowGoal).toBe(true);
  });

  test('regrow goal with PCOS returns PCOS_ONLY (not REGROW_ONLY)', () => {
    const profile = evaluateClinicalProfile(base({
      goal: ['Hair fall has stopped, I want to regrow only'],
      hormonal: ['PCOS / PCOD only'],
    }));
    expect(profile.primaryDiagnosis).toBe('PCOS_ONLY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scalp state mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('Clinical Engine — scalp state mapping', () => {
  test('detects OILY_SCALP', () => {
    const profile = evaluateClinicalProfile(base({ scalp: ['Oily scalp'] }));
    expect(profile.scalpStates).toContain('OILY_SCALP');
  });

  test('detects INFLAMED_SCALP from redness', () => {
    const profile = evaluateClinicalProfile(base({ scalp: ['Redness / sensitivity'] }));
    expect(profile.scalpStates).toContain('INFLAMED_SCALP');
  });

  test('detects DANDRUFF', () => {
    const profile = evaluateClinicalProfile(base({ scalp: ['Dandruff / white flakes'] }));
    expect(profile.scalpStates).toContain('DANDRUFF');
  });

  test('returns NORMAL_SCALP when no scalp signals', () => {
    const profile = evaluateClinicalProfile(base());
    expect(profile.scalpStates).toContain('NORMAL_SCALP');
    expect(profile.scalpStates).toHaveLength(1);
  });

  test('multiple scalp states detected together', () => {
    const profile = evaluateClinicalProfile(base({
      scalp: ['Oily scalp', 'Dandruff / white flakes'],
    }));
    expect(profile.scalpStates).toContain('OILY_SCALP');
    expect(profile.scalpStates).toContain('DANDRUFF');
    expect(profile.scalpStates).not.toContain('NORMAL_SCALP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Root cause derivation
// ─────────────────────────────────────────────────────────────────────────────

describe('Clinical Engine — root cause derivation', () => {
  test('maps PCOS to PCOS root cause', () => {
    const profile = evaluateClinicalProfile(base({ hormonal: ['PCOS / PCOD only'] }));
    expect(profile.rootCauses).toContain('PCOS');
  });

  test('maps iron deficiency to IRON_DEFICIENCY root cause', () => {
    const profile = evaluateClinicalProfile(base({ deficiency: ['Iron / Ferritin deficiency'] }));
    expect(profile.rootCauses).toContain('IRON_DEFICIENCY');
  });

  test('maps stress cause to STRESS root cause', () => {
    const profile = evaluateClinicalProfile(base({ cause: ['Stress / Anxiety / Depression'] }));
    expect(profile.rootCauses).toContain('STRESS');
  });

  test('maps GLP-1 cause to RAPID_WEIGHT_LOSS root cause', () => {
    const profile = evaluateClinicalProfile(base({
      cause: ['GLP-1 receptor agonist (hair loss within 6 months)'],
    }));
    expect(profile.rootCauses).toContain('RAPID_WEIGHT_LOSS');
  });

  test('maps smoking to OXIDATIVE_STRESS root cause', () => {
    const profile = evaluateClinicalProfile(base({ lifestyle: ['Smoking'] }));
    expect(profile.rootCauses).toContain('OXIDATIVE_STRESS');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Severity
// ─────────────────────────────────────────────────────────────────────────────

describe('Clinical Engine — severity derivation', () => {
  test('Grade 1 → MILD', () => {
    expect(evaluateClinicalProfile(base({ grade: 'Grade 1' })).severity).toBe('MILD');
  });
  test('Grade 2 → MILD', () => {
    expect(evaluateClinicalProfile(base({ grade: 'Grade 2' })).severity).toBe('MILD');
  });
  test('Grade 3 → MODERATE', () => {
    expect(evaluateClinicalProfile(base({ grade: 'Grade 3' })).severity).toBe('MODERATE');
  });
  test('Grade 4 → SEVERE', () => {
    expect(evaluateClinicalProfile(base({ grade: 'Grade 4' })).severity).toBe('SEVERE');
  });
  test('Grade 5 → SEVERE', () => {
    expect(evaluateClinicalProfile(base({ grade: 'Grade 5' })).severity).toBe('SEVERE');
  });
  test('no grade → MODERATE', () => {
    const profile = evaluateClinicalProfile(base({ grade: undefined }));
    expect(profile.severity).toBe('MODERATE');
  });
});
