// Determinism gate for the recommendation engine.
//
// The launch requirement is narrow and absolute: the SAME clinical evidence
// must produce the SAME recommendation, whatever order that evidence happens
// to arrive in. A questionnaire is a set of selections, not a sequence — a
// patient who ticks "Dandruff" before "Oily scalp" has told us exactly what a
// patient who ticks them the other way round has told us, and the protocol
// they are dispensed must be byte-identical.
//
// This suite permutes the inputs the engine is most exposed to and asserts
// nothing changes:
//   · multi-select answer order within every questionnaire group
//   · the order of the groups themselves (object key order)
//   · repeated evaluation of the same input (no hidden state between runs)
//
// It asserts on the four things a clinic actually dispenses on: diagnosis,
// kit identity, kit count, and final sequence. It deliberately does NOT assert
// any particular protocol — it compares each permutation against the engine's
// own output for the canonical ordering, so it stays correct if the approved
// clinical behaviour is ever intentionally changed.

import { scoreKits } from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { OPEN_CLINIC } from '../../src/sandbox/loaders/fixtureLoader';
import type { PatientAnswers } from '../../src/packages/types';
import type { ClinicConfig, BudgetProfile } from '../../src/packages/ai-engine/kit-scorer/types';

const CLINIC = OPEN_CLINIC as unknown as ClinicConfig;
const STANDARD: BudgetProfile = { tier: 'STANDARD', maxKits: 5 };

interface Outcome {
  primaryDiagnosis: string;
  kitIds: string[];
  kitCount: number;
}

type AnswerRecord = Record<string, unknown>;

/** The one conversion point: a record view widened to the engine's input. */
function asAnswers(record: AnswerRecord): PatientAnswers {
  return record as unknown as PatientAnswers;
}

function evaluate(record: AnswerRecord, budget: BudgetProfile = STANDARD): Outcome {
  const answers = asAnswers(record);
  const profile = evaluateClinicalProfile(answers);
  const needs = mapTherapyNeeds(profile);
  const rec = scoreKits(profile, needs, answers, CLINIC, budget);
  return {
    primaryDiagnosis: String(profile.primaryDiagnosis),
    kitIds: rec.rankedKits.map((k) => k.kitId),
    kitCount: rec.rankedKits.length,
  };
}

function base(overrides: AnswerRecord = {}): AnswerRecord {
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

/** Reverse every array-valued answer. Same selections, opposite order. */
function reverseSelections(answers: AnswerRecord): AnswerRecord {
  const out: AnswerRecord = {};
  for (const [k, v] of Object.entries(answers)) {
    out[k] = Array.isArray(v) ? [...v].reverse() : v;
  }
  return out;
}

/** Rebuild the object with its keys in reverse insertion order. */
function reverseGroups(answers: AnswerRecord): AnswerRecord {
  return Object.fromEntries(Object.entries(answers).reverse());
}

/** Deterministic shuffle (seeded) so a failure is reproducible, not flaky. */
function shuffleSelections(answers: AnswerRecord, seed: number): AnswerRecord {
  let state = seed;
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const out: AnswerRecord = {};
  for (const [k, v] of Object.entries(answers)) {
    if (!Array.isArray(v)) {
      out[k] = v;
      continue;
    }
    const arr = [...v];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    out[k] = arr;
  }
  return out;
}

// Scenarios chosen to cover multi-signal inputs where ordering could plausibly
// leak into the result: several selections inside one group, and several
// groups contributing competing drivers.
const SCENARIOS: Array<{ name: string; answers: AnswerRecord }> = [
  {
    name: 'male AGA + scalp inflammation + genetics',
    answers: base({
      sex: 'Male',
      grade: 'Grade 2 — Norwood III',
      cause: ['Stress / Anxiety / Depression', 'Genetics / Family history'],
      scalp: ['Dandruff / white flakes', 'Oily scalp'],
    }),
  },
  {
    name: 'female pattern hair loss',
    answers: base({ grade: 'Grade 2 — Ludwig 2' }),
  },
  {
    name: 'TE / acute shedding',
    answers: base({
      age: '28',
      duration: '1–3 months',
      count: '100+ strands',
      hairtype: ['Full-length hairs with white bulb'],
      cause: ['Stress / Anxiety / Depression'],
    }),
  },
  {
    name: 'PCOS',
    answers: base({ hormonal: ['PCOS / PCOD only'] }),
  },
  {
    name: 'hypothyroid + obesity (META B substitution)',
    answers: base({ thyroid: ['Hypothyroidism'], lifestyle: ['Obesity'] }),
  },
  {
    name: 'iron deficiency',
    answers: base({ deficiency: ['Iron / Anaemia'] }),
  },
  {
    name: 'pregnancy safety lock',
    answers: base({ hormonal: ['Currently pregnant'] }),
  },
  {
    name: 'full multifactorial stack',
    answers: base({
      thyroid: ['Hypothyroidism'],
      hormonal: ['PCOS / PCOD only'],
      deficiency: ['Iron / Anaemia', 'Vitamin D3'],
      gut: ['Bloating / gas', 'Constipation'],
      scalp: ['Dandruff / white flakes', 'Oily scalp'],
      lifestyle: ['Smoking / Vaping', 'Night shift work'],
      cause: ['Stress / Anxiety / Depression', 'Genetics / Family history'],
    }),
  },
  {
    name: 'chemical treatment (HBR filler path)',
    answers: base({
      treatment: ['Heat styling (straightener etc.)', 'Chemical treatment (colour / keratin)'],
      cause: ['Hard water'],
    }),
  },
  {
    name: 'young thin stack with gut + stress',
    answers: base({
      age: '24',
      grade: 'Grade 1',
      gut: ['Bloating / gas'],
      cause: ['Stress / Anxiety / Depression'],
    }),
  },
];

describe('recommendation determinism — same evidence, same protocol', () => {
  for (const { name, answers } of SCENARIOS) {
    describe(name, () => {
      const canonical = evaluate(answers);

      it('is stable across repeated evaluation (no state leaks between runs)', () => {
        expect(evaluate(answers)).toEqual(canonical);
        expect(evaluate(answers)).toEqual(canonical);
      });

      it('is unchanged when every multi-select answer order is reversed', () => {
        expect(evaluate(reverseSelections(answers))).toEqual(canonical);
      });

      it('is unchanged when the questionnaire groups arrive in reverse order', () => {
        expect(evaluate(reverseGroups(answers))).toEqual(canonical);
      });

      it('is unchanged under seeded shuffles of every selection list', () => {
        for (const seed of [1, 7, 42, 1337, 90210]) {
          expect(evaluate(shuffleSelections(answers, seed))).toEqual(canonical);
        }
      });

      it('produces a fully-ranked sequence with no duplicate kits', () => {
        expect(canonical.kitIds).toHaveLength(canonical.kitCount);
        expect(new Set(canonical.kitIds).size).toBe(canonical.kitCount);
      });
    });
  }

  it('holds across every scenario at once — diagnosis, kits, count and order', () => {
    for (const { answers } of SCENARIOS) {
      const canonical = evaluate(answers);
      for (const permuted of [
        reverseSelections(answers),
        reverseGroups(answers),
        shuffleSelections(answers, 2024),
        shuffleSelections(reverseGroups(answers), 99),
      ]) {
        const got = evaluate(permuted);
        expect(got.primaryDiagnosis).toBe(canonical.primaryDiagnosis);
        expect(got.kitIds).toEqual(canonical.kitIds);
        expect(got.kitCount).toBe(canonical.kitCount);
      }
    }
  });
});
