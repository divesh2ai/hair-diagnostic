import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicConfig, BudgetProfile } from '../../src/packages/ai-engine/kit-scorer/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function base(overrides: Partial<PatientAnswers> = {}): PatientAnswers {
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

const OPEN_CLINIC: ClinicConfig = {
  clinicId: 'test-clinic',
  availableKits: [
    'HAIR FACT TE GOLD', 'HAIR FACT TE GOLD VEG',
    'PRO FACT META B', 'PRO FACT META B HYPOTHYROID', 'PRO FACT META B PCOS',
    'PRO FACT META B MENOPAUSE', 'PRO FACT META B POSTMENOPAUSE',
    'F-PCOS -1', 'F-PCOS VEG -1',
    'FPHL', 'FPHL PLUS', 'MPHL', 'MPHL PLUS',
    'IRON UP GOLD', 'PRO FACT GI GOLD', 'OXIDATIVE STRESS',
    'RAPID WEIGHT LOSS SHIELD',
    'PHENOTYPE INFLAMATION',
    'PRO IMMUNE GOLD', 'PRO IMMUNE VEG',
    'HAIR FACT HAIR BREAKAGE REPAIR(HBR)',
    'EARLY GREYING CARE GOLD', 'EARLY GREYING CARE VEG',
    'LACTIHEALTH', 'HAIR FACT TTM (OCD)', 'HAIR FACT ALOPECIA AREATA',
    'HAIR FACT NIGHT SHIFT', 'HAIR FACT FREQUENT FLYERS',
    'HAIR FACT PERI MENOPAUSE', 'HAIR FACT PERI MENOPAUSE VEG',
    'HEALTHY - 9', 'PRO FACT THYROID CARE', 'FH WELL 3',
  ],
};

const STANDARD_BUDGET: BudgetProfile = { tier: 'STANDARD', maxKits: 5 };
const COMPREHENSIVE_BUDGET: BudgetProfile = { tier: 'COMPREHENSIVE', maxKits: 7 };

function run(ans: PatientAnswers, budget = STANDARD_BUDGET) {
  const profile = evaluateClinicalProfile(ans);
  const needs   = mapTherapyNeeds(profile);
  return scoreKits(profile, needs, ans, OPEN_CLINIC, budget);
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic contract
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — basic contract', () => {
  test('returns rankedKits, protocolLabel, protocolRationale, selectionJustification, appliedRules', () => {
    const rec = run(base());
    expect(Array.isArray(rec.rankedKits)).toBe(true);
    expect(typeof rec.protocolLabel).toBe('string');
    expect(typeof rec.protocolRationale).toBe('string');
    expect(typeof rec.selectionJustification).toBe('string');
    expect(Array.isArray(rec.appliedRules)).toBe(true);
  });

  test('rankedKits respects budget maxKits cap', () => {
    const rec = run(base(), { tier: 'ESSENTIAL', maxKits: 2 });
    expect(rec.rankedKits.length).toBeLessThanOrEqual(2);
  });

  test('each kit has kitId, score, matchedNeeds, reasons, phase', () => {
    const rec = run(base());
    for (const kit of rec.rankedKits) {
      expect(typeof kit.kitId).toBe('string');
      expect(typeof kit.score).toBe('number');
      expect(Array.isArray(kit.matchedNeeds)).toBe(true);
      expect(Array.isArray(kit.reasons)).toBe(true);
      expect(typeof kit.phase).toBe('number');
    }
  });

  test('phase numbers are sequential starting at 1', () => {
    const rec = run(base());
    rec.rankedKits.forEach((kit, i) => {
      expect(kit.phase).toBe(i + 1);
    });
  });

  test('kit scores are descending', () => {
    const rec = run(base());
    for (let i = 1; i < rec.rankedKits.length; i++) {
      expect(rec.rankedKits[i]!.score).toBeLessThanOrEqual(rec.rankedKits[i - 1]!.score);
    }
  });

  test('no duplicate kitIds in output', () => {
    const rec = run(base());
    const ids = rec.rankedKits.map((k) => k.kitId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — determinism', () => {
  test('identical input produces identical output on repeated calls', () => {
    const ans = base({ thyroid: ['Hypothyroidism'], lifestyle: ['Obesity'] });
    const a = run(ans);
    const b = run(ans);
    expect(a.rankedKits.map((k) => k.kitId)).toEqual(b.rankedKits.map((k) => k.kitId));
    expect(a.appliedRules).toEqual(b.appliedRules);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PREGNANCY — single kit invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — PREGNANCY single kit', () => {
  test('PREGNANCY → exactly 1 kit: HEALTHY - 9', () => {
    const rec = run(base({ hormonal: ['Currently pregnant'] }), COMPREHENSIVE_BUDGET);
    expect(rec.rankedKits).toHaveLength(1);
    expect(rec.rankedKits[0]!.kitId).toBe('HEALTHY - 9');
  });

  test('PREGNANCY rankedKits[0] reason mentions pregnancy safety', () => {
    const rec = run(base({ hormonal: ['Currently pregnant'] }));
    const reasons = rec.rankedKits[0]!.reasons.join(' ');
    expect(reasons.toLowerCase()).toMatch(/pregnan/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRO IMMUNE last invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — PRO IMMUNE always last', () => {
  test('PRO IMMUNE is the final kit when present', () => {
    const ans = base({
      immunity: ['Alopecia Areata (patchy hair loss)'],
      deficiency: ['Iron / Ferritin deficiency'],
    });
    const rec = run(ans, COMPREHENSIVE_BUDGET);
    const kits = rec.rankedKits.map((k) => k.kitId);
    const immuneIdx = kits.findIndex((k) => k.includes('PRO IMMUNE'));
    if (immuneIdx >= 0) {
      expect(immuneIdx).toBe(kits.length - 1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1: HYPO + metabolic substitution
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — RULE 1 (HYPO + metabolic META B substitution)', () => {
  test('THYROID_HYPO alone → PRO FACT META B HYPOTHYROID in output', () => {
    const rec = run(base({ thyroid: ['Hypothyroidism'] }));
    const kitIds = rec.rankedKits.map((k) => k.kitId);
    expect(kitIds.some((k) => k.includes('META B'))).toBe(true);
  });

  test('THYROID_HYPO + obesity → PRO FACT META B (not HYPOTHYROID variant)', () => {
    const rec = run(base({ thyroid: ['Hypothyroidism'], lifestyle: ['Obesity'] }), COMPREHENSIVE_BUDGET);
    const kitIds = rec.rankedKits.map((k) => k.kitId);
    expect(kitIds).toContain('PRO FACT META B');
    expect(kitIds).not.toContain('PRO FACT META B HYPOTHYROID');
    expect(rec.appliedRules.some((r) => r.includes('RULE1_HYPO_METABOLIC'))).toBe(true);
  });

  test('RULE 1 swap: no AMPK duplication (only one META B variant present)', () => {
    const rec = run(base({ thyroid: ['Hypothyroidism'], lifestyle: ['Obesity'] }), COMPREHENSIVE_BUDGET);
    const metaBKits = rec.rankedKits.filter((k) => k.kitId.includes('PRO FACT META B'));
    expect(metaBKits).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2: GLP-1 Shield precedence
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — RULE 2 (GLP-1 Shield precedence)', () => {
  test('GLP-1 Early → RAPID WEIGHT LOSS SHIELD is kit 1 (phase 1)', () => {
    const rec = run(base({ cause: ['GLP-1 receptor agonist (hair loss within 6 months)'] }), COMPREHENSIVE_BUDGET);
    expect(rec.rankedKits[0]!.kitId).toBe('RAPID WEIGHT LOSS SHIELD');
    expect(rec.appliedRules.some((r) => r.includes('GLP1_EARLY'))).toBe(true);
  });

  test('GLP-1 Late → RAPID WEIGHT LOSS SHIELD is kit 2 (phase 2)', () => {
    const rec = run(base({ cause: ['GLP-1 receptor agonist (hair loss after 6 months)'] }), COMPREHENSIVE_BUDGET);
    expect(rec.rankedKits[1]!.kitId).toBe('RAPID WEIGHT LOSS SHIELD');
    expect(rec.appliedRules.some((r) => r.includes('GLP1_LATE'))).toBe(true);
  });

  test('GLP-1 Early: Shield is Phase 1 even after priority lifting', () => {
    const rec = run(base({
      cause: ['GLP-1 receptor agonist (hair loss within 6 months)'],
      deficiency: ['Iron / Ferritin deficiency'],
    }), COMPREHENSIVE_BUDGET);
    expect(rec.rankedKits[0]!.kitId).toBe('RAPID WEIGHT LOSS SHIELD');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Clinic substitutions
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — clinic substitutions', () => {
  test('unavailable kit is replaced by substitution', () => {
    const ans = base({ thyroid: ['Hypothyroidism'] });
    const profile = evaluateClinicalProfile(ans);
    const needs   = mapTherapyNeeds(profile);
    const clinic: ClinicConfig = {
      clinicId: 'restricted-clinic',
      availableKits: ['HAIR FACT TE GOLD', 'PRO FACT META B', 'PRO IMMUNE GOLD'],
      substitutions: { 'PRO FACT META B HYPOTHYROID': 'PRO FACT META B' },
    };
    const rec = scoreKits(profile, needs, ans, clinic, STANDARD_BUDGET);
    const kitIds = rec.rankedKits.map((k) => k.kitId);
    expect(kitIds).not.toContain('PRO FACT META B HYPOTHYROID');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCOS protocols
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — PCOS protocols', () => {
  test('PCOS_ONLY → F-PCOS-1 in output', () => {
    const rec = run(base({ hormonal: ['PCOS / PCOD only'] }), COMPREHENSIVE_BUDGET);
    const kitIds = rec.rankedKits.map((k) => k.kitId);
    expect(kitIds.some((k) => k.includes('F-PCOS') || k.includes('PRO FACT META B PCOS'))).toBe(true);
  });

  test('PCOS_ONLY + diabetes → PRO FACT META B PCOS (upgraded from F-PCOS-1)', () => {
    const rec = run(base({ hormonal: ['PCOS / PCOD only'], thyroid: ['Diabetes'] }), COMPREHENSIVE_BUDGET);
    const kitIds = rec.rankedKits.map((k) => k.kitId);
    expect(kitIds).toContain('PRO FACT META B PCOS');
    expect(kitIds).not.toContain('F-PCOS -1');
  });

  test('PCOS_OBESITY + Hypothyroid → single PRO FACT META B (no PCOS/HYPO variant)', () => {
    const rec = run(base({
      hormonal: ['PCOS / PCOD + Obesity'],
      thyroid: ['Hypothyroidism'],
      lifestyle: ['Obesity'],
    }), COMPREHENSIVE_BUDGET);
    const kitIds = rec.rankedKits.map((k) => k.kitId);
    expect(kitIds).toContain('PRO FACT META B');
    expect(kitIds).not.toContain('PRO FACT META B PCOS');
    expect(kitIds).not.toContain('PRO FACT META B HYPOTHYROID');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectionJustification audit trail
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreKits — selectionJustification audit trail', () => {
  test('selectionJustification contains primary diagnosis', () => {
    const rec = run(base({ thyroid: ['Hypothyroidism'] }));
    expect(rec.selectionJustification).toContain('THYROID_HYPO');
  });

  test('selectionJustification contains phase sequence', () => {
    const rec = run(base());
    expect(rec.selectionJustification).toContain('Phase 1');
  });

  test('selectionJustification lists applied rules', () => {
    const rec = run(base({ thyroid: ['Hypothyroidism'], lifestyle: ['Obesity'] }));
    expect(rec.selectionJustification).toContain('RULE1_HYPO_METABOLIC');
  });
});
