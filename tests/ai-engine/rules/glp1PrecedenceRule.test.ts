import { applyGLP1PrecedenceRule } from '../../../src/packages/ai-engine/kit-scorer/rules/glp1PrecedenceRule';
import type { KitScorerContext } from '../../../src/packages/ai-engine/kit-scorer/types';

const SHIELD = 'RAPID WEIGHT LOSS SHIELD';
const TE_GOLD = 'HAIR FACT TE GOLD';

function baseCtx(
  phases: string[],
  glp: { hasGLP1Early?: boolean; hasGLP1Late?: boolean } = {}
): KitScorerContext {
  return {
    phases,
    flags: {
      isRegrowGoal: false, hasGreyGoal: false, hasHairGoal: true,
      isVeg: false, isMale: false, isPregnant: false,
      isGrade45: false, isGrade123: true,
      hasActiveShedding: true, hasNoVisibleFall: false,
      hasGLP1Early: glp.hasGLP1Early ?? false,
      hasGLP1Late:  glp.hasGLP1Late  ?? false,
      age: 32,
      goal: 'Reduce hair fall', grade: 'Grade 2',
      count: '50–100 strands', duration: '3–6 months',
    },
    therapyNeeds: { needs: [], needReasons: {} },
    appliedRules: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2: GLP-1 Precedence
// ─────────────────────────────────────────────────────────────────────────────

describe('RULE 2 — applyGLP1PrecedenceRule', () => {
  test('no GLP-1 flags → ctx returned unchanged', () => {
    const phases = [TE_GOLD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases));
    expect(result.phases).toEqual(phases);
    expect(result.appliedRules).toHaveLength(0);
  });

  // ── GLP-1 Early (Shield at position 0) ────────────────────────────────────

  test('GLP1_EARLY: Shield moved to position 0', () => {
    const phases = [TE_GOLD, 'F-PCOS -1', SHIELD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Early: true }));
    expect(result.phases[0]).toBe(SHIELD);
  });

  test('GLP1_EARLY: Shield not duplicated when already at position 0', () => {
    const phases = [SHIELD, TE_GOLD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Early: true }));
    expect(result.phases[0]).toBe(SHIELD);
    expect(result.phases.filter((k) => k === SHIELD)).toHaveLength(1);
  });

  test('GLP1_EARLY: Shield inserted even when not originally present', () => {
    const phases = [TE_GOLD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Early: true }));
    expect(result.phases[0]).toBe(SHIELD);
  });

  test('GLP1_EARLY: logs GLP1_EARLY rule', () => {
    const result = applyGLP1PrecedenceRule(baseCtx([TE_GOLD, SHIELD], { hasGLP1Early: true }));
    expect(result.appliedRules.some((r) => r.includes('GLP1_EARLY'))).toBe(true);
  });

  // ── GLP-1 Late (Shield at position 1) ─────────────────────────────────────

  test('GLP1_LATE: Shield moved to position 1', () => {
    const phases = [TE_GOLD, 'F-PCOS -1', SHIELD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Late: true }));
    expect(result.phases[1]).toBe(SHIELD);
  });

  test('GLP1_LATE: TE GOLD remains at position 0', () => {
    const phases = [TE_GOLD, 'F-PCOS -1', SHIELD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Late: true }));
    expect(result.phases[0]).toBe(TE_GOLD);
    expect(result.phases[1]).toBe(SHIELD);
  });

  test('GLP1_LATE: Shield not duplicated', () => {
    const phases = [TE_GOLD, SHIELD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Late: true }));
    expect(result.phases.filter((k) => k === SHIELD)).toHaveLength(1);
    expect(result.phases[1]).toBe(SHIELD);
  });

  test('GLP1_LATE: logs GLP1_LATE rule', () => {
    const result = applyGLP1PrecedenceRule(baseCtx([TE_GOLD, SHIELD], { hasGLP1Late: true }));
    expect(result.appliedRules.some((r) => r.includes('GLP1_LATE'))).toBe(true);
  });

  // ── Invariant: relative ordering of non-Shield kits preserved ─────────────

  test('GLP1_EARLY: other kits maintain relative order after Shield', () => {
    const phases = [TE_GOLD, 'FPHL', SHIELD, 'PRO IMMUNE GOLD'];
    const result = applyGLP1PrecedenceRule(baseCtx(phases, { hasGLP1Early: true }));
    const withoutShield = result.phases.filter((k) => k !== SHIELD);
    expect(withoutShield).toEqual([TE_GOLD, 'FPHL', 'PRO IMMUNE GOLD']);
  });

  // ── Two-pass idempotency (applied before and after prioritizeKits) ─────────

  test('GLP1_EARLY: applying rule twice is idempotent', () => {
    const phases = [TE_GOLD, SHIELD, 'PRO IMMUNE GOLD'];
    const ctx = baseCtx(phases, { hasGLP1Early: true });
    const pass1 = applyGLP1PrecedenceRule(ctx);
    const pass2 = applyGLP1PrecedenceRule(pass1);
    expect(pass2.phases[0]).toBe(SHIELD);
    expect(pass2.phases.filter((k) => k === SHIELD)).toHaveLength(1);
  });

  test('GLP1_LATE: applying rule twice is idempotent', () => {
    const phases = [TE_GOLD, 'FPHL', SHIELD, 'PRO IMMUNE GOLD'];
    const ctx = baseCtx(phases, { hasGLP1Late: true });
    const pass1 = applyGLP1PrecedenceRule(ctx);
    const pass2 = applyGLP1PrecedenceRule(pass1);
    expect(pass2.phases[0]).toBe(TE_GOLD);
    expect(pass2.phases[1]).toBe(SHIELD);
    expect(pass2.phases.filter((k) => k === SHIELD)).toHaveLength(1);
  });
});
