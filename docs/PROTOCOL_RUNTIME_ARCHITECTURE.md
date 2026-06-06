# Protocol Runtime Architecture

## Overview

The questionnaire frontend is a **generic clinical protocol renderer**. It has no embedded knowledge of clinical rules. All branching, skip logic, option filtering, and progress computation is driven by the protocol definition at runtime.

---

## Directory Structure

```
apps/patient-portal/src/
├── config/questionnaire/questions.ts   ← Protocol source (23 clinical questions)
├── runtime/
│   ├── visibilityEngine.ts             ← Condition evaluation + visibility
│   ├── skipEngine.ts                   ← Skip decision engine
│   ├── optionFilterEngine.ts           ← Dynamic option filtering + multi-select rules
│   ├── stepResolver.ts                 ← Navigation resolution + replay frames
│   ├── progressEngine.ts               ← Progress computation
│   ├── protocolLoader.ts               ← Protocol loading (default / fixture / remote)
│   ├── signalExtractor.ts              ← Clinical signal extraction from answers
│   └── index.ts                        ← Barrel export
├── stores/useAssessmentStore.ts        ← Zustand state engine (protocol-driven)
├── types/questionnaire.ts              ← AssessmentState + ProgressState types
└── components/
    ├── questionnaire/QuestionRenderer.tsx  ← Generic renderer (no hardcoded logic)
    └── sandbox/DebugPanel.tsx              ← Developer debug panel (dev only)
```

---

## Module Responsibilities

### `visibilityEngine.ts`
- `evaluateCondition(condition, answers)` — evaluates a single `LogicCondition`
- `evaluateAllConditions(conditions, answers, mode)` — evaluates an array (`any` | `all`)
- `isQuestionVisible(question, answers)` — primary visibility check
- `getVisibleQuestions(protocol, answers)` — returns visible `Question[]`
- `getVisibleOptions(question, answers)` — returns filtered `QuestionOption[]`

### `skipEngine.ts`
- `shouldSkip(question, answers)` — inverse of `isQuestionVisible`
- `getSkippedQuestionIds(protocol, answers)` — for state tracking
- `explainSkipDecisions(protocol, answers)` — debug: reason for each skip

### `optionFilterEngine.ts`
- Re-exports `getVisibleOptions` from visibilityEngine
- `applyMultiSelectRules(currentAnswer, selectedId, exclusiveIds)` — handles `none`/`unsure` exclusivity
- `getExclusiveOptions(question)` — identifies mutually exclusive options

### `stepResolver.ts`
- `resolveNextStep(index, protocol, answers)` — skips invisible questions forward
- `resolvePrevStep(index, protocol, answers)` — skips invisible questions backward
- `buildBranchingPath(protocol, answers)` — ordered list of visible question IDs
- `buildReplayFrames(protocol, fixture)` — deterministic frame sequence for QA replay

### `progressEngine.ts`
- `computeProgress(index, protocol, answers)` → `ProgressState`
  - `percentage`, `visiblePosition`, `visibleTotal`, `rawIndex`, `answeredCount`
- `isProtocolComplete(protocol, answers)` — all required visible questions answered

### `protocolLoader.ts`
- `loadProtocol(source, fixture?)` — loads from `default` | `fixture` | `remote`
- `getDefaultProtocol()` — returns the static `questionnaireConfig`

### `signalExtractor.ts`
- `extractProtocolSignals(protocol, answers)` — extracts clinical signals from `clinicalMapping` and `clinicalTags` on answered questions
- Produces `Record<string, any>` — the frontend signal surface (not normalized, backend does full normalization)

---

## State Engine

`useAssessmentStore` (Zustand + persist) holds:

| Field | Type | Description |
|---|---|---|
| `protocol` | `Question[] \| null` | Loaded protocol definition |
| `currentStepIndex` | `number` | Raw index into protocol array |
| `answers` | `Record<string, any>` | All collected answers |
| `progress` | `ProgressState` | Computed progress (visibility-aware) |
| `branchingPath` | `string[]` | Ordered visible question IDs |
| `skippedQuestions` | `string[]` | Currently skipped question IDs |
| `visibleQuestions` | `string[]` | Currently visible question IDs |
| `protocolSignals` | `Record<string, any>` | Extracted clinical signals |

All derived fields (`progress`, `branchingPath`, `skippedQuestions`, `visibleQuestions`, `protocolSignals`) are recomputed atomically on every `setAnswer`, `nextStep`, `prevStep`, or `goToStep` call via `computeDerivedState()`.

### Persistence
Only `answers`, `currentStepIndex`, and `clinicData` are persisted to localStorage. Derived state is recomputed on rehydration via `onRehydrateStorage`.

---

## QuestionRenderer

`QuestionRenderer` is a **pure renderer** — it receives a `Question` and calls `onAnswer`. It delegates:
- Option filtering → `optionFilterEngine.getVisibleOptions()`
- Multi-select rules → `optionFilterEngine.applyMultiSelectRules()`

It has no awareness of skip logic, branching, or clinical rules.

---

## Sandbox / Fixture Replay

```typescript
// Load a fixture and replay to the last answered step
store.replayFixture({
  q1_age: 28,
  q2_gender: 'female',
  q3_primary_concern: ['shedding', 'thinning'],
  // ...
});
```

`buildReplayFrames(protocol, fixture)` produces a deterministic sequence of frames for QA validation, each including the branching path snapshot at that moment.

---

## Debug Panel

`<DebugPanel enabled={process.env.NODE_ENV === 'development'} />` shows:
- Current step metadata
- Branching path with current position highlighted
- Skip decisions with triggering condition
- Extracted protocol signals
- Raw answers

Add it to any page that renders the questionnaire.
