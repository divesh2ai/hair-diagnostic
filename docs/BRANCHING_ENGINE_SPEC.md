# Branching Engine Specification

## LogicCondition Type

```typescript
type LogicCondition = {
  field: string;      // question ID to read from answers
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
};
```

## Operator Semantics

| Operator | Answer Type | Behavior |
|---|---|---|
| `equals` | any | `answer === value` |
| `not_equals` | any | `answer !== value` |
| `contains` | `string[]` | `answer.includes(value)` |
| `contains` | `string` | `answer === value` (fallback) |
| `greater_than` | number | `Number(answer) > Number(value)` |
| `less_than` | number | `Number(answer) < Number(value)` |

Missing or null answers evaluate to `false` for all operators.

---

## skipIf Evaluation

A question is **skipped** if **any** `skipIf` condition evaluates to `true` (OR semantics).

```typescript
// In visibilityEngine.ts
isQuestionVisible = !skipIf.some(c => evaluateCondition(c, answers))
```

To require ALL conditions to skip (AND semantics), use `evaluateAllConditions(conditions, answers, 'all')` directly.

---

## Current Skip Rules

| Question | Skip Condition |
|---|---|
| `q5_hairfall_severity` | `q3_primary_concern not_equals 'shedding'` |
| `q13b_illness_time` | `q13_illness not_equals 'yes'` |
| `q14_hormonal` | `q2_gender equals 'male'` |
| `q15_pregnancy` | `q2_gender equals 'male'` OR `q1_age greater_than 55` |
| `q19_greying` | `q1_age greater_than 40` |

---

## filterOptions Evaluation

Individual options within a question can be hidden. A question can remain visible while some of its options are filtered out.

```typescript
// A question with filterOptions:
{
  id: 'q_example',
  filterOptions: [
    {
      optionId: 'option_x',
      hideIf: [{ field: 'q1_age', operator: 'greater_than', value: 50 }]
    }
  ]
}
// option_x is hidden if age > 50, but the question itself is still shown
```

---

## Branching Path

`buildBranchingPath(protocol, answers)` returns the **ordered list of question IDs that will be shown** given the current answer state. This is a snapshot — it changes as answers change.

```typescript
// Example for a male user aged 30:
buildBranchingPath(protocol, { q2_gender: 'male', q1_age: 30 })
// Returns all 23 question IDs except:
// - q14_hormonal (skipped: gender=male)
// - q15_pregnancy (skipped: gender=male)
```

---

## Navigation Determinism

Navigation is **deterministic** — given the same protocol + answers, `resolveNextStep` and `resolvePrevStep` always produce the same index. No randomness, no side effects.

```typescript
resolveNextStep(i, protocol, answers):
  let n = i + 1
  while n < protocol.length && shouldSkip(protocol[n], answers):
    n++
  return n < protocol.length ? n : i

resolvePrevStep(i, protocol, answers):
  let p = i - 1
  while p >= 0 && shouldSkip(protocol[p], answers):
    p--
  return p >= 0 ? p : i
```

---

## Replay Frame Sequence

`buildReplayFrames(protocol, fixture)` simulates walking through the protocol with a pre-defined answer set. Each frame captures state **as it would be** when the user reaches that step.

```typescript
interface ReplayFrame {
  stepIndex: number;
  questionId: string;
  answer: any;                     // value from fixture
  branchingPathSnapshot: string[]; // branching path at this moment
}
```

Frames are built **progressively**: answers are accumulated as the walk proceeds. This means skip decisions in later frames correctly reflect earlier answers — identical to real user behavior.

---

## Adding New Branching Rules

To add a new skip rule, add a `skipIf` array to the question in `config/questionnaire/questions.ts`:

```typescript
{
  id: 'q_new',
  skipIf: [
    { field: 'q2_gender', operator: 'equals', value: 'male' },
    { field: 'q1_age', operator: 'less_than', value: 18 }
  ]
  // Skipped if gender=male OR age<18
}
```

No runtime code changes required. The engines read `skipIf` from the protocol definition.

---

## Protocol Extension Points

| Feature | Protocol Field | Engine |
|---|---|---|
| Question visibility | `question.skipIf` | `visibilityEngine` |
| Option visibility | `question.filterOptions` | `optionFilterEngine` |
| Clinical signal extraction | `question.clinicalMapping.signal` | `signalExtractor` |
| Clinical hint propagation | `question.clinicalMapping.protocolHints` | `signalExtractor` |
| Option-level signal tags | `option.clinicalTags` | `signalExtractor` |
| Option severity weighting | `option.severityLevel` | Available for future scoring |
| Option risk weighting | `option.riskWeight` | Available for future scoring |
