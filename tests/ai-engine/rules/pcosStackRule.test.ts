import { applyPcosStackRule } from '../../../src/packages/ai-engine/kit-scorer/rules/pcosStackRule';
import type { KitScorerContext } from '../../../src/packages/ai-engine/kit-scorer/types';
import type { PatientAnswers, DiagnosisKey } from '../../../src/packages/types';

function baseAns(overrides: Partial<PatientAnswers> = {}): PatientAnswers {
  return {
    sex: 'Female', age: '30', grade: 'Grade 2',
    thyroid: [], hormonal: ['PCOS / PCOD only'], lifestyle: [], diet: [],
    cause: [], scalp: [], immunity: [], deficiency: [],
    gut: [], hairtype: [], treatment: [],
    goal: ['Reduce hair fall'],
    duration: '3–6 months', count: '50–100 strands',
    ...overrides,
  };
}

function baseCtx(
  phases: string[],
  diagnosis: DiagnosisKey = 'PCOS_ONLY',
  overrides: Partial<KitScorerContext> = {}
): KitScorerContext {
  return {
    phases,
    flags: {
      isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: false, hasNoVisibleFall: false,
      hasGLP1Early: false, hasGLP1Late: false, hasCrashDiet: false,
      age: 30,
      goal: 'Reduce hair fall', grade: 'Grade 2',
      count: '50–100 strands', duration: '3–6 months',
    },
    therapyNeeds: { needs: [], needReasons: {} },
    appliedRules: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-PCOS passthrough
// ─────────────────────────────────────────────────────────────────────────────

describe('pcosStackRule — non-PCOS passthrough', () => {
  test('returns ctx unchanged for non-PCOS diagnosis', () => {
    const ctx = baseCtx(['HAIR FACT TE GOLD'], 'TE_STRESS');
    const result = applyPcosStackRule(ctx, baseAns(), 'TE_STRESS');
    expect(result).toBe(ctx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCOS_ONLY stacking
// ─────────────────────────────────────────────────────────────────────────────

describe('pcosStackRule — PCOS_ONLY', () => {
  test('no extra signals → legacy F-PCOS -1 auto-retired to META B PCOS (locked rule)', () => {
    const ctx = baseCtx(['F-PCOS -1']);
    const result = applyPcosStackRule(ctx, baseAns(), 'PCOS_ONLY');
    expect(result.phases).toContain('PRO FACT META B PCOS');
    expect(result.phases).not.toContain('F-PCOS -1');
    expect(result.phases).not.toContain('IRON UP GOLD');
    expect(result.phases).not.toContain('PRO IMMUNE GOLD');
    expect(result.appliedRules.some((r) => r.includes('PCOS_FPCOS_RETIRED'))).toBe(true);
  });

  test('iron deficiency → IRON UP GOLD added', () => {
    const ans = baseAns({ deficiency: ['Iron / Ferritin deficiency'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases).toContain('IRON UP GOLD');
    expect(result.appliedRules.some((r) => r.includes('PCOS_IRON'))).toBe(true);
  });

  test('scalp redness → PHENOTYPE INFLAMATION added', () => {
    const ans = baseAns({ scalp: ['Redness / sensitivity'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases).toContain('PHENOTYPE INFLAMATION');
    expect(result.appliedRules.some((r) => r.includes('PCOS_PHENOTYPE'))).toBe(true);
  });

  test('oily scalp alone (without itching) → PHENOTYPE not added', () => {
    const ans = baseAns({ scalp: ['Oily scalp'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases).not.toContain('PHENOTYPE INFLAMATION');
  });

  test('oily scalp + itching → PHENOTYPE INFLAMATION added', () => {
    const ans = baseAns({ scalp: ['Oily scalp', 'Itching'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases).toContain('PHENOTYPE INFLAMATION');
  });

  test('immune signal (allergies) → PRO IMMUNE GOLD added', () => {
    const ans = baseAns({ immunity: ['Allergies / skin rash'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases.some((k) => k.includes('PRO IMMUNE'))).toBe(true);
    expect(result.appliedRules.some((r) => r.includes('PCOS_IMMUNE'))).toBe(true);
  });

  test('veg patient: immune kit is PRO IMMUNE VEG', () => {
    const ans = baseAns({ immunity: ['Allergies / skin rash'] });
    const ctx = baseCtx(['F-PCOS -1'], 'PCOS_ONLY', {
      flags: {
        isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
        isVeg: true, isMale: false, isPregnant: false,
        isGrade45: false, isGrade123: true,
        hasActiveShedding: false, hasNoVisibleFall: false,
        hasGLP1Early: false, hasGLP1Late: false, hasCrashDiet: false,
        age: 30, goal: 'Reduce hair fall', grade: 'Grade 2',
        count: '50–100 strands', duration: '3–6 months',
      },
    });
    const result = applyPcosStackRule(ctx, ans, 'PCOS_ONLY');
    expect(result.phases).toContain('PRO IMMUNE VEG');
    expect(result.phases).not.toContain('PRO IMMUNE GOLD');
  });

  test('PCOS_ONLY + metabolic signal → PRO FACT META B added', () => {
    const ans = baseAns({ lifestyle: ['Obesity'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases).toContain('PRO FACT META B');
    expect(result.appliedRules.some((r) => r.includes('PCOS_META_B'))).toBe(true);
  });

  test('PCOS_ONLY + diabetes → META B PCOS (F-PCOS -1 retired, no separate upgrade rule needed)', () => {
    const ans = baseAns({ thyroid: ['Diabetes'] });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1']), ans, 'PCOS_ONLY');
    expect(result.phases).toContain('PRO FACT META B PCOS');
    expect(result.phases).not.toContain('F-PCOS -1');
    // F-PCOS -1 is retired (locked rule) — replacement is automatic regardless of diabetes signal.
    expect(result.appliedRules.some((r) => r.includes('PCOS_FPCOS_RETIRED'))).toBe(true);
  });

  test('phase count capped at 7', () => {
    const ans = baseAns({
      deficiency: ['Iron / Ferritin deficiency'],
      scalp: ['Redness / sensitivity', 'Dandruff / white flakes'],
      immunity: ['Allergies / skin rash'],
      lifestyle: ['Obesity'],
    });
    const result = applyPcosStackRule(baseCtx(['F-PCOS -1', 'FPHL', 'HAIR FACT TE GOLD']), ans, 'PCOS_ONLY');
    expect(result.phases.length).toBeLessThanOrEqual(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PCOS_OBESITY stacking
// ─────────────────────────────────────────────────────────────────────────────

describe('pcosStackRule — PCOS_OBESITY', () => {
  test('PCOS_OBESITY base phases preserved', () => {
    const ans = baseAns({ hormonal: ['PCOS / PCOD + Obesity'], lifestyle: ['Obesity'] });
    const result = applyPcosStackRule(
      baseCtx(['PRO FACT META B PCOS'], 'PCOS_OBESITY'),
      ans,
      'PCOS_OBESITY'
    );
    expect(result.phases).toContain('PRO FACT META B PCOS');
  });

  test('PCOS_OBESITY + Hypothyroidism → single PRO FACT META B replaces PCOS and HYPOTHYROID variants', () => {
    const ans = baseAns({
      hormonal: ['PCOS / PCOD + Obesity'],
      thyroid: ['Hypothyroidism'],
      lifestyle: ['Obesity'],
    });
    const ctx = baseCtx(['PRO FACT META B PCOS', 'PRO FACT META B HYPOTHYROID'], 'PCOS_OBESITY');
    const result = applyPcosStackRule(ctx, ans, 'PCOS_OBESITY');
    expect(result.phases).toContain('PRO FACT META B');
    expect(result.phases).not.toContain('PRO FACT META B PCOS');
    expect(result.phases).not.toContain('PRO FACT META B HYPOTHYROID');
    expect(result.appliedRules.some((r) => r.includes('PCOS_OBESITY_HYPO'))).toBe(true);
  });
});
