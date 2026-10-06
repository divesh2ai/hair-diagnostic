import { describe, it, expect } from 'vitest';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import { adaptProtocol } from '@/runtime/protocolAdapter';
import { buildBranchingPath } from '@/runtime/stepResolver';
import {
  applyGroupExclusivity,
  applyMultiSelectRules,
  getExclusiveOptions,
} from '@/runtime/optionFilterEngine';
import type { Question } from '@/types/questionnaire';

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end flow test for the assessment-v3 Hormonal question, driving the SAME
// pure engines the live v3 UI calls — the Vercel preview host is not reachable
// from CI, and the real /q/[clinic]/assessment-v3 route needs a DB, so this
// exercises the branching + selection logic directly instead.
//
//   • branching/visibility  → buildBranchingPath (visibilityEngine + skipEngine),
//                              exactly what AssessmentV3Journey walks via nextStep
//   • option selection      → applyGroupExclusivity(selected, id, groups,
//                              exclusiveIds), exactly QuestionRendererV3.handleSelect
//   • Skip / Continue gating → mirrors AssessmentV3Journey:
//                              onSkip wired only when !question.required;
//                              canContinue = isAnswerValid, whose multi_select
//                              branch is `required ? answer.length > 0 : true`.
// ─────────────────────────────────────────────────────────────────────────────

const protocol = adaptProtocol(masterProtocol);
const hormonal = protocol.find((q) => q.id === 'hormonal') as Question;

const MISCARRIAGE = 'Miscarriage';
const PREGNANT = 'Currently pregnant';
const POSTPARTUM = 'Post-delivery or breastfeeding';
const PCOS = 'PCOS / PCOD only';
const NONE = 'None of the above';

// Mirror of QuestionRendererV3.handleSelect (multi_select branch).
const exclusiveIds = getExclusiveOptions(hormonal).map((o) => o.id);
const click = (current: string[], id: string): string[] =>
  hormonal.mutualExclusivityGroups?.length
    ? applyGroupExclusivity(current, id, hormonal.mutualExclusivityGroups, exclusiveIds)
    : applyMultiSelectRules(current, id, exclusiveIds);

// Mirror of AssessmentV3Journey gating for a multi_select question.
const skipOffered = (q: Question): boolean => !q.required;
const continueEnabled = (q: Question, answer: string[]): boolean =>
  q.required ? answer.length > 0 : true;

const sorted = (a: string[]) => [...a].sort();

describe('Hormonal flow — FEMALE path', () => {
  const answers = { sex: 'Female' };

  it('shows the Hormonal question', () => {
    expect(buildBranchingPath(protocol, answers)).toContain('hormonal');
  });

  it('cannot be skipped — Skip control withheld, Continue gated until answered', () => {
    expect(skipOffered(hormonal)).toBe(false);
    expect(continueEnabled(hormonal, [])).toBe(false);
    expect(continueEnabled(hormonal, [NONE])).toBe(true);
    expect(continueEnabled(hormonal, [MISCARRIAGE])).toBe(true);
  });

  it('Miscarriage ↔ Currently pregnant are mutually exclusive (either order)', () => {
    expect(click([MISCARRIAGE], PREGNANT)).toEqual([PREGNANT]);
    expect(click([PREGNANT], MISCARRIAGE)).toEqual([MISCARRIAGE]);
  });

  it('Miscarriage ↔ Post-delivery/breastfeeding are mutually exclusive (either order)', () => {
    expect(click([MISCARRIAGE], POSTPARTUM)).toEqual([POSTPARTUM]);
    expect(click([POSTPARTUM], MISCARRIAGE)).toEqual([MISCARRIAGE]);
  });

  it('Miscarriage still co-exists with unrelated conditions (e.g. PCOS)', () => {
    expect(sorted(click([MISCARRIAGE], PCOS))).toEqual(sorted([MISCARRIAGE, PCOS]));
  });

  it('"None of the above" is the explicit negative answer and clears everything', () => {
    expect(click([MISCARRIAGE, PCOS], NONE)).toEqual([NONE]);
    expect(click([NONE], MISCARRIAGE)).toEqual([MISCARRIAGE]);
  });
});

describe('Hormonal flow — MALE path', () => {
  const answers = { sex: 'Male' };

  it('never shows the Female-only Hormonal question, so required cannot trap him', () => {
    const path = buildBranchingPath(protocol, answers);
    expect(path).not.toContain('hormonal');
  });
});
