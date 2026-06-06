# Flow Execution Map

## Answer → State Update Cycle

```
User selects answer
        │
        ▼
setAnswer(questionId, answer)
        │
        ├─ Merge into answers: { ...answers, [questionId]: answer }
        │
        ├─ computeDerivedState(protocol, newAnswers, currentStepIndex)
        │       ├─ buildBranchingPath()       → visibleQuestionIds[]
        │       ├─ getSkippedQuestionIds()    → skippedIds[]
        │       ├─ getVisibleQuestionIds()    → visibleIds[]
        │       ├─ computeProgress()          → ProgressState
        │       └─ extractProtocolSignals()   → Record<string, any>
        │
        └─ set({ answers, progress, branchingPath, skippedQuestions,
                 visibleQuestions, protocolSignals })
```

## Navigation Cycle

```
User clicks "Continue"
        │
        ▼
nextStep()
        │
        ├─ resolveNextStep(currentIndex, protocol, answers)
        │       └─ increments index, skips invisible questions
        │
        ├─ computeDerivedState(protocol, answers, nextIndex)
        │
        └─ set({ currentStepIndex, ...derived })
```

```
User clicks "Back"
        │
        ▼
prevStep()
        │
        ├─ resolvePrevStep(currentIndex, protocol, answers)
        │       └─ decrements index, skips invisible questions
        │
        ├─ computeDerivedState(protocol, answers, prevIndex)
        │
        └─ set({ currentStepIndex, ...derived })
```

## Auto-Advance (Single Select / Image Select)

```
QuestionRenderer: onAnswer(value)
        │
        ├─ setAnswer(id, value)
        │
        └─ setTimeout(450ms)
                │
                └─ if !isLastVisible → nextStep()
```

## Submit Flow

```
User clicks "Complete Assessment"
        │
        ▼
handleSubmit()
        │
        ├─ setSubmitting(true)
        │
        ├─ POST /api/assessment/submit
        │       └─ body: { answers, clinicId }
        │
        ├─ on success: router.push(/processing/[assessmentId])
        │
        └─ setSubmitting(false)
```

## Fixture Replay Flow

```
replayFixture(fixture)
        │
        ├─ Find last answered rawIndex in protocol
        │
        ├─ computeDerivedState(protocol, fixture, lastIndex)
        │
        └─ set({ answers: fixture, currentStepIndex: lastIndex, ...derived })
```

## Protocol Load / Rehydration

```
App starts / localStorage rehydrated
        │
        ├─ onRehydrateStorage fires
        │
        ├─ Restores: answers, currentStepIndex, clinicData
        │
        └─ Recomputes: protocol=defaultProtocol, branchingPath,
                       skippedQuestions, visibleQuestions, progress, signals
```

## Question Visibility Decision Tree

```
For each Question q in protocol:

  Does q have skipIf?
    NO  → visible = true
    YES → evaluate each LogicCondition in skipIf:
            field = answers[condition.field]
            apply operator (equals / not_equals / contains /
                            greater_than / less_than)
          If ANY condition is true → visible = false
          Else                     → visible = true
```

## Option Filter Decision Tree

```
For each QuestionOption o in question.options:

  Does question.filterOptions reference this option?
    NO  → visible = true
    YES → evaluate each LogicCondition in filterRules.hideIf:
          If ANY condition is true → hidden = true
          Else                     → hidden = false
```

## Multi-Select Exclusivity Rules

```
User selects optionId:
  Is optionId in exclusiveIds? (id === 'none' || id === 'unsure')
    YES → answer = [optionId]            (clears all others)
    NO  → remove exclusiveIds from arr
          toggle optionId in arr
          answer = result
```
