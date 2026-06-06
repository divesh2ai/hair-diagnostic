import { detectSignals } from '../../src/packages/ai-engine/signal-registry';
import { evaluatePathways, PATHWAY_IDS } from '../../src/packages/ai-engine/pathway-engine';
import type { PatientAnswers } from '../../src/packages/types';

function base(overrides: Partial<PatientAnswers> = {}): PatientAnswers {
  return {
    sex: 'Female',
    age: '35',
    grade: 'Grade 2',
    thyroid: [], hormonal: [], lifestyle: [], diet: [], cause: [], scalp: [],
    immunity: [], deficiency: [], gut: [], hairtype: [], treatment: [],
    goal: ['Reduce hair fall'],
    duration: '3–6 months',
    count: '50–100 strands',
    ...overrides,
  };
}

function run(overrides: Partial<PatientAnswers> = {}) {
  return evaluatePathways(detectSignals(base(overrides)));
}

describe('Pathway Engine — catalog integrity', () => {
  test('emits one DetectedPathway per catalog entry', () => {
    const set = run();
    expect(set.all.length).toBe(PATHWAY_IDS.length);
    expect(PATHWAY_IDS.every((id) => set.byId[id])).toBe(true);
  });

  test('engineVersion is stamped', () => {
    const set = run();
    expect(set.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('Pathway Engine — activation', () => {
  test('Male Grade 4 with genetics → FOLLICULAR_MINIATURIZATION HIGH', () => {
    const set = run({
      sex: 'Male',
      age: '45',
      grade: 'Grade 4',
      cause: ['Genetics'],
      hairtype: ['Thinning crown'],
    });
    const fm = set.byId.FOLLICULAR_MINIATURIZATION;
    expect(fm.strength).toBe('HIGH');
    expect(fm.score).toBeGreaterThanOrEqual(70);
    expect(fm.supportingSignals).toContain('GENETIC_PREDISPOSITION');
    expect(fm.supportingSignals).toContain('ADVANCED_PATTERN_LOSS');
    expect(fm.severity).toBe('HIGH');
  });

  test('PCOS + obesity activates HORMONAL_DYSREGULATION + METABOLIC_DYSFUNCTION', () => {
    const set = run({
      hormonal: ['PCOS'],
      lifestyle: ['Obesity', 'Sedentary'],
    });
    expect(set.byId.HORMONAL_DYSREGULATION.strength).not.toBe('INACTIVE');
    expect(set.byId.METABOLIC_DYSFUNCTION.strength).not.toBe('INACTIVE');
  });

  test('Active inflammation + dandruff → SCALP_INFLAMMATION active', () => {
    const set = run({ scalp: ['Redness', 'Dandruff'] });
    expect(set.byId.SCALP_INFLAMMATION.strength).not.toBe('INACTIVE');
    expect(set.byId.SCALP_INFLAMMATION.supportingSignals).toContain('ACTIVE_INFLAMMATION');
  });

  test('Alopecia areata → IMMUNE_DYSREGULATION active with HIGH severity', () => {
    const set = run({
      immunity: ['Alopecia Areata'],
      hairtype: ['circular patches'],
    });
    const id = set.byId.IMMUNE_DYSREGULATION;
    expect(id.strength).not.toBe('INACTIVE');
    expect(id.severity).toBe('HIGH');
    expect(id.supportingSignals).toContain('AUTOIMMUNE_HAIR_LOSS');
  });

  test('Hypothyroidism + active shedding → HORMONAL_DYSREGULATION + TELOGEN', () => {
    const set = run({ thyroid: ['Hypothyroidism'], cause: ['Stress'] });
    expect(set.byId.HORMONAL_DYSREGULATION.strength).not.toBe('INACTIVE');
    expect(set.byId.TELOGEN_CYCLE_DISRUPTION.strength).not.toBe('INACTIVE');
  });

  test('Iron deficiency + vegetarian → NUTRITIONAL_LIMITATION active', () => {
    const set = run({ deficiency: ['Iron'], diet: ['Vegetarian'] });
    expect(set.byId.NUTRITIONAL_LIMITATION.strength).not.toBe('INACTIVE');
    expect(set.byId.NUTRITIONAL_LIMITATION.supportingSignals).toContain('IRON_DEFICIENCY');
    expect(set.byId.NUTRITIONAL_LIMITATION.supportingSignals).toContain('VEGETARIAN_PROFILE');
  });

  test('Smoking + alcohol → OXIDATIVE_STRESS active', () => {
    const set = run({ lifestyle: ['Smoking', 'Alcohol'] });
    expect(set.byId.OXIDATIVE_STRESS.strength).not.toBe('INACTIVE');
  });

  test('IBS → GUT_HAIR_AXIS active', () => {
    const set = run({ gut: ['IBS'] });
    expect(set.byId.GUT_HAIR_AXIS.strength).not.toBe('INACTIVE');
  });

  test('Heat treatment + broken hair → HAIR_SHAFT_DAMAGE active', () => {
    const set = run({ treatment: ['Heat'], hairtype: ['Broken short'] });
    expect(set.byId.HAIR_SHAFT_DAMAGE.strength).not.toBe('INACTIVE');
  });
});

describe('Pathway Engine — gating and suppression', () => {
  test('Bare AGE_OVER_30 (MODIFIER only) does NOT activate FOLLICULAR_MINIATURIZATION', () => {
    const set = run({ age: '40' });
    expect(set.byId.FOLLICULAR_MINIATURIZATION.strength).toBe('INACTIVE');
  });

  test('No visible fall keeps TELOGEN_CYCLE_DISRUPTION INACTIVE via gate', () => {
    // Pure "regrow only" patient: shedding-side PRIMARYs do not fire, so the
    // gate stays closed and TELOGEN is INACTIVE — the strongest possible form
    // of "suppression".
    const set = run({
      goal: ['Hair fall has stopped — regrow only'],
      count: 'No visible fall',
      duration: 'More than 12 months',
    });
    expect(set.byId.TELOGEN_CYCLE_DISRUPTION.strength).toBe('INACTIVE');
  });

  test('NO_VISIBLE_FALL deducts score when a primary shedding signal also fires', () => {
    // Contrived: stress fires PSYCHOLOGICAL_STRESS (PRIMARY) opening the gate,
    // and NO_VISIBLE_FALL co-fires from "no visible fall" count → suppressor active.
    const set = run({
      cause: ['Stress'],
      count: 'No visible fall',
    });
    const t = set.byId.TELOGEN_CYCLE_DISRUPTION;
    expect(t.suppressingSignals).toContain('NO_VISIBLE_FALL');
    expect(t.contributionTrace.some((c) => c.signalId === 'NO_VISIBLE_FALL' && c.delta < 0)).toBe(true);
  });

  test('Active list excludes INACTIVE pathways', () => {
    const set = run();
    for (const p of set.active) expect(p.strength).not.toBe('INACTIVE');
  });
});

describe('Pathway Engine — contribution trace', () => {
  test('contributionTrace explains why a pathway scored', () => {
    const set = run({
      sex: 'Male',
      age: '45',
      grade: 'Grade 4',
      cause: ['Genetics'],
    });
    const fm = set.byId.FOLLICULAR_MINIATURIZATION;
    expect(fm.contributionTrace.length).toBeGreaterThan(0);
    const total = fm.contributionTrace.reduce((s, t) => s + t.delta, 0);
    expect(Math.max(0, Math.min(100, total))).toBe(fm.score);
  });
});
