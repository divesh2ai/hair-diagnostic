import { detectSignals, SIGNAL_CATALOG, SIGNAL_IDS, getSignal } from '../../src/packages/ai-engine/signal-registry';
import type { PatientAnswers } from '../../src/packages/types';

// ─────────────────────────────────────────────────────────────────────────────
// Signal Registry — Phase 1 smoke tests
//
// Verifies:
//   1. Catalog integrity (all ids unique, all detectors reference valid ids).
//   2. Representative patient scenarios fire the expected signals.
//   3. Evidence is always attached to detected signals.
// ─────────────────────────────────────────────────────────────────────────────

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

describe('Signal Registry — catalog integrity', () => {
  test('all catalog ids are unique', () => {
    const seen = new Set<string>();
    for (const s of SIGNAL_CATALOG) {
      expect(seen.has(s.id)).toBe(false);
      seen.add(s.id);
    }
  });

  test('SIGNAL_IDS matches catalog', () => {
    expect(SIGNAL_IDS.length).toBe(SIGNAL_CATALOG.length);
  });

  test('every catalog entry has a narrativeMeaning', () => {
    for (const s of SIGNAL_CATALOG) {
      expect(s.narrativeMeaning.length).toBeGreaterThan(0);
    }
  });

  test('getSignal returns undefined for unknown ids', () => {
    expect(getSignal('NOT_A_REAL_SIGNAL')).toBeUndefined();
  });
});

describe('Signal Registry — detection scenarios', () => {
  test('baseline 35F with TE-style answers fires ACTIVE_SHEDDING + AGE_OVER_30', () => {
    const set = detectSignals(base());
    expect(set.byId['ACTIVE_SHEDDING']).toBeDefined();
    expect(set.byId['AGE_OVER_30']).toBeDefined();
  });

  test('Hypothyroid + iron deficiency fires both biology signals with evidence', () => {
    const set = detectSignals(base({
      thyroid: ['Hypothyroidism'],
      deficiency: ['Iron'],
    }));
    expect(set.byId['HYPOTHYROIDISM']).toBeDefined();
    expect(set.byId['IRON_DEFICIENCY']).toBeDefined();
    expect(set.byId['HYPOTHYROIDISM'].evidence.length).toBeGreaterThan(0);
    expect(set.byId['IRON_DEFICIENCY'].evidence[0].questionId).toBe('deficiency');
  });

  test('PCOS + obesity fires PCOS and METABOLIC_DYSFUNCTION', () => {
    const set = detectSignals(base({
      hormonal: ['PCOS / PCOD + Obesity'],
      lifestyle: ['Obesity'],
    }));
    expect(set.byId['PCOS']).toBeDefined();
    expect(set.byId['METABOLIC_DYSFUNCTION']).toBeDefined();
  });

  test('Grade 4 male advanced pattern loss', () => {
    const set = detectSignals(base({ sex: 'Male', grade: 'Grade 4' }));
    expect(set.byId['ADVANCED_PATTERN_LOSS']).toBeDefined();
    expect(set.byId['ADVANCED_PATTERN_LOSS'].evidence[0].value).toContain('Grade 4');
  });

  test('Patchy loss → autoimmune signals', () => {
    const set = detectSignals(base({
      hairtype: ['circular patches'],
      immunity: ['Alopecia Areata'],
    }));
    expect(set.byId['PATCHY_LOSS']).toBeDefined();
    expect(set.byId['AUTOIMMUNE_HAIR_LOSS']).toBeDefined();
  });

  test('Vegetarian + iron deficiency layers correctly', () => {
    const set = detectSignals(base({
      diet: ['Vegetarian'],
      deficiency: ['Iron'],
    }));
    expect(set.byId['VEGETARIAN_PROFILE']).toBeDefined();
    expect(set.byId['IRON_DEFICIENCY']).toBeDefined();
  });

  test('Smoking + alcohol fires OXIDATIVE_STRESS', () => {
    const set = detectSignals(base({ lifestyle: ['Smoking', 'Alcohol'] }));
    expect(set.byId['OXIDATIVE_STRESS']).toBeDefined();
  });

  test('Pregnancy detected from is_pregnant flag', () => {
    const set = detectSignals(base({ is_pregnant: true }));
    expect(set.byId['PREGNANCY']).toBeDefined();
  });

  test('Regrow-only goal fires REGROW_ONLY_GOAL and suppresses ACTIVE_SHEDDING', () => {
    const set = detectSignals(base({
      goal: ['Hair fall has stopped — regrow only'],
      count: 'No visible fall',
    }));
    expect(set.byId['REGROW_ONLY_GOAL']).toBeDefined();
    expect(set.byId['NO_VISIBLE_FALL']).toBeDefined();
    expect(set.byId['ACTIVE_SHEDDING']).toBeUndefined();
  });

  test('Female under 30 modifier fires', () => {
    const set = detectSignals(base({ age: '25', sex: 'Female' }));
    expect(set.byId['AGE_UNDER_30_FEMALE']).toBeDefined();
    expect(set.byId['AGE_OVER_30']).toBeUndefined();
  });

  test('Every detected signal carries at least one piece of evidence', () => {
    const set = detectSignals(base({
      thyroid: ['Hypothyroidism'],
      hormonal: ['PCOS / PCOD'],
      lifestyle: ['Smoking', 'Night shift'],
      cause: ['Stress', 'Genetics'],
      scalp: ['Dandruff', 'Oily'],
      deficiency: ['Iron'],
      diet: ['Vegetarian'],
      gut: ['IBS'],
      hairtype: ['Thinning', 'widening parting'],
    }));
    for (const s of set.signals) {
      expect(s.evidence.length).toBeGreaterThan(0);
    }
  });

  test('Registry version stamp is present', () => {
    const set = detectSignals(base());
    expect(set.registryVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
