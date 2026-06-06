import fs from 'fs';
import path from 'path';
import { detectSignals } from '../../src/packages/ai-engine/signal-registry';
import { evaluatePathways } from '../../src/packages/ai-engine/pathway-engine';
import {
  evaluateRootCauses,
  CAUSE_IDS,
} from '../../src/packages/ai-engine/cause-registry';
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
  const sig = detectSignals(base(overrides));
  const path = evaluatePathways(sig);
  return evaluateRootCauses(sig, path);
}

describe('Cause Registry — catalog integrity', () => {
  test('catalog ids are unique', () => {
    const seen = new Set<string>();
    for (const id of CAUSE_IDS) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  test('engineVersion stamped', () => {
    const set = run();
    expect(set.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('Cause Registry — primary cause selection', () => {
  test('Male 45 Grade 4 with genetics → ANDROGEN_DRIVEN_MINIATURIZATION primary', () => {
    const set = run({
      sex: 'Male', age: '45', grade: 'Grade 4',
      cause: ['Genetics'],
      hairtype: ['Thinning crown'],
    });
    expect(set.primary?.id).toBe('ANDROGEN_DRIVEN_MINIATURIZATION');
  });

  test('PCOS patient → PCOS_DRIVEN_HORMONAL primary', () => {
    const set = run({
      sex: 'Female', age: '30',
      hormonal: ['PCOS'],
      lifestyle: ['Obesity', 'Sedentary'],
    });
    expect(set.primary?.id).toBe('PCOS_DRIVEN_HORMONAL');
  });

  test('Hypothyroid only → HYPOTHYROID_HAIR_LOSS primary', () => {
    const set = run({ thyroid: ['Hypothyroidism'] });
    expect(set.primary?.id).toBe('HYPOTHYROID_HAIR_LOSS');
  });

  test('Iron deficiency vegetarian → IRON_DEFICIENCY_ANAEMIA primary', () => {
    const set = run({
      deficiency: ['Iron'],
      diet: ['Vegetarian'],
    });
    expect(set.primary?.id).toBe('IRON_DEFICIENCY_ANAEMIA');
  });

  test('Alopecia areata → AUTOIMMUNE_HAIR_LOSS primary, ANDROGEN demoted', () => {
    const set = run({
      sex: 'Male', age: '45', grade: 'Grade 4',
      cause: ['Genetics'],
      immunity: ['Alopecia Areata'],
      hairtype: ['circular patches'],
    });
    expect(set.primary?.id).toBe('AUTOIMMUNE_HAIR_LOSS');
    // ANDROGEN cause should appear demoted from primary
    expect(set.primary?.demotedCauses).toContain('ANDROGEN_DRIVEN_MINIATURIZATION');
  });

  test('Recent surgery + stress → ILLNESS or STRESS TE primary, not MULTIFACTORIAL', () => {
    const set = run({ cause: ['Recent Illness or Surgery', 'Stress'] });
    expect(['ILLNESS_DRIVEN_TE', 'STRESS_DRIVEN_TE']).toContain(set.primary?.id);
  });
});

describe('Cause Registry — secondary and contributing buckets', () => {
  test('PCOS + obesity + Hypothyroid → primary PCOS, secondary HYPOTHYROID', () => {
    const set = run({
      hormonal: ['PCOS'],
      lifestyle: ['Obesity', 'Sedentary'],
      thyroid: ['Hypothyroidism'],
    });
    expect(set.primary?.id).toBe('PCOS_DRIVEN_HORMONAL');
    expect(set.secondary.some((c) => c.id === 'HYPOTHYROID_HAIR_LOSS')).toBe(true);
  });

  test('Strong PCOS picture with co-existing scalp inflammation — both appear, PCOS primary', () => {
    const set = run({
      hormonal: ['PCOS'],
      lifestyle: ['Obesity', 'Sedentary'],
      scalp: ['Redness', 'Dandruff'],
    });
    expect(set.primary?.id).toBe('PCOS_DRIVEN_HORMONAL');
    const inflam = set.all.find((c) => c.id === 'INFLAMMATORY_SCALP_DYSFUNCTION');
    expect(inflam).toBeDefined();
    expect(inflam?.role).not.toBe('PRIMARY');
  });
});

describe('Cause Registry — multifactorial fallback', () => {
  test('Patient with three weak-to-moderate pathways but no dominant cause emits MULTIFACTORIAL', () => {
    const set = run({
      cause: ['Stress'],
      scalp: ['Dandruff'],
      lifestyle: ['Smoking'],
      gut: ['IBS'],
    });
    const m = set.all.find((c) => c.id === 'MULTIFACTORIAL_HAIR_LOSS');
    expect(m).toBeDefined();
  });
});

describe('Cause Registry — explainability', () => {
  test('Every detected cause carries supportingSignals OR drivingPathways', () => {
    const set = run({
      hormonal: ['PCOS'], thyroid: ['Hypothyroidism'],
      deficiency: ['Iron'], lifestyle: ['Smoking'],
    });
    for (const c of set.all) {
      expect(c.supportingSignals.length + c.drivingPathways.length).toBeGreaterThan(0);
    }
  });

  test('Pathway and signal traces sum within score bounds', () => {
    const set = run({ hormonal: ['PCOS'] });
    const pcos = set.byId.PCOS_DRIVEN_HORMONAL;
    expect(pcos).toBeDefined();
    if (!pcos) return;
    const sumP = pcos.pathwayTrace.reduce((s, t) => s + t.delta, 0);
    const sumS = pcos.signalTrace.reduce((s, t) => s + t.delta, 0);
    expect(sumP + sumS).toBeGreaterThan(0);
    expect(pcos.score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT TEST: engine.ts contains zero hardcoded clinical knowledge
// ─────────────────────────────────────────────────────────────────────────────
describe('Cause Engine — zero clinical knowledge contract', () => {
  const enginePath = path.resolve(__dirname, '../../src/packages/ai-engine/cause-registry/engine.ts');
  const source = fs.readFileSync(enginePath, 'utf8');

  // Strip comments and string-typed identifiers (CONFIG keys etc.).
  // We want to fail if the engine source contains any clinical string literal.
  const stripped = source
    .replace(/\/\/.*$/gm, '')           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');  // block comments

  test('no clinical cause ids appear in engine.ts', () => {
    const clinicalCauseTokens = [
      'ANDROGEN_DRIVEN_MINIATURIZATION', 'STRESS_DRIVEN_TE', 'POST_PARTUM_TE',
      'ILLNESS_DRIVEN_TE', 'RAPID_WEIGHT_LOSS_TE', 'PCOS_DRIVEN_HORMONAL',
      'MENOPAUSAL_TRANSITION', 'HYPOTHYROID_HAIR_LOSS', 'IRON_DEFICIENCY_ANAEMIA',
      'AUTOIMMUNE_HAIR_LOSS', 'INFLAMMATORY_SCALP_DYSFUNCTION', 'GUT_AXIS_DYSFUNCTION',
      'OXIDATIVE_LIFESTYLE', 'MULTIFACTORIAL_HAIR_LOSS', 'TRICHOTILLOMANIA_CAUSE',
    ];
    for (const tok of clinicalCauseTokens) {
      expect(stripped.includes(tok)).toBe(false);
    }
  });

  test('no signal ids appear in engine.ts', () => {
    const signalTokens = [
      'PCOS', 'HYPOTHYROIDISM', 'IRON_DEFICIENCY', 'GENETIC_PREDISPOSITION',
      'POST_PARTUM', 'AUTOIMMUNE_HAIR_LOSS', 'ACTIVE_SHEDDING', 'DANDRUFF',
      'OILY_SCALP', 'CHRONIC_INFLAMMATORY_PHENOTYPE',
    ];
    for (const tok of signalTokens) {
      expect(stripped.includes(tok)).toBe(false);
    }
  });

  test('no pathway ids appear in engine.ts', () => {
    const pathwayTokens = [
      'FOLLICULAR_MINIATURIZATION', 'TELOGEN_CYCLE_DISRUPTION', 'SCALP_INFLAMMATION',
      'IMMUNE_DYSREGULATION', 'HORMONAL_DYSREGULATION', 'METABOLIC_DYSFUNCTION',
      'OXIDATIVE_STRESS', 'NUTRITIONAL_LIMITATION', 'GUT_HAIR_AXIS', 'HAIR_SHAFT_DAMAGE',
    ];
    for (const tok of pathwayTokens) {
      expect(stripped.includes(tok)).toBe(false);
    }
  });
});
