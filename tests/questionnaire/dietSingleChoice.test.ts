import { describe, it, expect } from 'vitest';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import { adaptProtocol } from '@/runtime/protocolAdapter';
import {
  applyGroupExclusivity,
  applyMultiSelectRules,
  getExclusiveOptions,
} from '@/runtime/optionFilterEngine';
import type { Question } from '@/types/questionnaire';

// ─────────────────────────────────────────────────────────────────────────────
// "What best describes your diet?" must behave as single-choice (radio): picking
// one option replaces any previous pick. It stays a multi_select storing an array
// (e.g. ["Vegetarian"]) so the array-based diet scoring (isVeg veg-kit swap,
// metabolic / crash-diet detectors) is unaffected — this is enforced via the
// schema's `allOptionsExclusive` flag expanded into one all-options group.
//
// Selection path mirrors QuestionRendererV3.handleSelect (multi_select branch).
// ─────────────────────────────────────────────────────────────────────────────

const protocol = adaptProtocol(masterProtocol);
const diet = protocol.find((q) => q.id === 'diet') as Question;

const exclusiveIds = getExclusiveOptions(diet).map((o) => o.id);
const click = (current: string[], id: string): string[] =>
  diet.mutualExclusivityGroups?.length
    ? applyGroupExclusivity(current, id, diet.mutualExclusivityGroups, exclusiveIds)
    : applyMultiSelectRules(current, id, exclusiveIds);

describe('Diet — single choice (radio) while keeping array storage', () => {
  it('exposes one all-options exclusivity group covering every option', () => {
    expect(diet.mutualExclusivityGroups).toHaveLength(1);
    const group = diet.mutualExclusivityGroups?.[0] ?? [];
    const optionIds = diet.options?.map((o) => o.id) ?? [];
    expect([...group].sort()).toEqual([...optionIds].sort());
  });

  it('selecting a second option replaces the first (never accumulates)', () => {
    expect(click(['Vegetarian'], 'Non-vegetarian')).toEqual(['Non-vegetarian']);
    expect(click(['Non-vegetarian'], 'Vegan')).toEqual(['Vegan']);
  });

  it('stays an array of length ≤ 1 (storage shape preserved for scoring)', () => {
    const afterFirst = click([], 'Vegetarian');
    expect(Array.isArray(afterFirst)).toBe(true);
    expect(afterFirst).toEqual(['Vegetarian']);

    const afterSecond = click(afterFirst, 'High protein diet');
    expect(afterSecond).toEqual(['High protein diet']);
    expect(afterSecond.length).toBe(1);
  });

  it('clicking the selected option again toggles it off (empty array)', () => {
    expect(click(['Vegetarian'], 'Vegetarian')).toEqual([]);
  });
});
