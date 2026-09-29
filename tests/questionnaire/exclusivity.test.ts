import { describe, it, expect } from 'vitest';
import {
  applyGroupExclusivity,
  getExclusiveOptions,
  applyMultiSelectRules,
} from '@/runtime/optionFilterEngine';
import { adaptProtocol } from '@/runtime/protocolAdapter';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import type { Question } from '@/types/questionnaire';

const questions = adaptProtocol(masterProtocol);
const byId = (id: string): Question => {
  const q = questions.find(x => x.id === id);
  if (!q) throw new Error(`Question "${id}" not found in adapted protocol`);
  return q;
};

/** Reproduces exactly what the V3 renderer does on a tap. */
function tap(q: Question, current: string[], optionId: string): string[] {
  const exclusiveIds = getExclusiveOptions(q).map(o => o.id);
  return q.mutualExclusivityGroups?.length
    ? applyGroupExclusivity(current, optionId, q.mutualExclusivityGroups, exclusiveIds)
    : applyMultiSelectRules(current, optionId, exclusiveIds);
}

// ─────────────────────────────────────────────────────────────────────────────
// DIET — single-choice emulation.
//
// The diet question must accept only ONE selection (a patient has one primary
// dietary pattern), but it stays a multi_select so the stored answer keeps its
// array shape (["Vegetarian"]). This matters because the whole scoring stack
// reads diet as an array — signals().diet → has(ans.diet, …) (Array.some),
// extractFlags' isVeg → ans.diet.some(…), and detectors' arr(ans.diet) returns
// [] for a non-array. A true single_select would store a string and silently
// break the veg-kit swap and every diet-based detector.
// ─────────────────────────────────────────────────────────────────────────────
describe('diet question — single-choice emulation', () => {
  const diet = byId('diet');
  const groups = diet.mutualExclusivityGroups ?? [];

  it('stays a multi_select (array storage shape preserved for scoring)', () => {
    expect(diet.type).toBe('multi_select');
  });

  it('exposes exactly one exclusivity group covering every option', () => {
    expect(groups.length).toBe(1);
    const optionIds = (diet.options ?? []).map(o => o.id);
    expect(optionIds.length).toBeGreaterThan(1);
    expect(groups[0].slice().sort()).toEqual(optionIds.slice().sort());
  });

  it('selecting a second diet replaces the first (radio behaviour)', () => {
    const result = tap(diet, ['Vegetarian'], 'Vegan');
    expect(result).toEqual(['Vegan']);
    expect(Array.isArray(result)).toBe(true); // still an array → scoring unaffected
  });

  it('can never hold two diet types', () => {
    let answer: string[] = [];
    for (const pick of ['Non-vegetarian', 'Vegetarian', 'High protein diet']) {
      answer = tap(diet, answer, pick);
    }
    expect(answer).toEqual(['High protein diet']);
  });

  it('tapping the selected diet again clears it', () => {
    expect(tap(diet, ['Vegan'], 'Vegan')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guards — the diet change must not disturb the hormonal question.
// (Miscarriage ↔ Currently pregnant exclusivity is covered in depth in
//  tests/ai-engine/miscarriageKits.test.ts; here we just guard non-regression.)
// ─────────────────────────────────────────────────────────────────────────────
describe('hormonal question — reproductive-state exclusivity intact', () => {
  const hormonal = byId('hormonal');
  const groups = hormonal.mutualExclusivityGroups ?? [];
  const sharesAGroup = (a: string, b: string) =>
    groups.some(g => g.includes(a) && g.includes(b));

  it('the pregnant/peri/post triangle still fires', () => {
    expect(sharesAGroup('Currently pregnant', 'Peri-menopause')).toBe(true);
    expect(sharesAGroup('Currently pregnant', 'Post-menopause')).toBe(true);
    expect(sharesAGroup('Peri-menopause', 'Post-menopause')).toBe(true);
    expect(tap(hormonal, ['Currently pregnant'], 'Post-menopause')).toEqual(['Post-menopause']);
  });

  it('Miscarriage is exclusive with Currently pregnant only — not peri/post', () => {
    expect(sharesAGroup('Miscarriage', 'Currently pregnant')).toBe(true);
    expect(sharesAGroup('Miscarriage', 'Peri-menopause')).toBe(false);
    expect(sharesAGroup('Miscarriage', 'Post-menopause')).toBe(false);
    // both selection orders keep only the latest conflicting choice
    expect(tap(hormonal, ['Miscarriage'], 'Currently pregnant')).toEqual(['Currently pregnant']);
    expect(tap(hormonal, ['Currently pregnant'], 'Miscarriage')).toEqual(['Miscarriage']);
  });
});
