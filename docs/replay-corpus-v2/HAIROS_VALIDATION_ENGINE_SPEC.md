# HAIROS Validation Engine Spec

**Version:** 1.0.0
**Frozen contract:** `ClinicalReplayValidator@1.0`

The Validation Engine consumes a `ReplayResult` + a `ClinicalReplayCase`
and emits `CaseValidation`. Each of the five validators is independent
and returns a uniform shape.

---

## 1. Common return shape

```ts
export interface ValidatorOutcome {
  pass: boolean;
  score: number;          // 0..100
  findings: Finding[];
}

export interface Finding {
  code: string;           // e.g. "SIGNAL_MISSING", "POSTERIOR_BELOW_MIN"
  severity: "info" | "minor" | "major" | "critical";
  expected: unknown;
  actual: unknown;
  message: string;
}
```

A validator MUST be deterministic: identical inputs ⇒ identical
outcome.

---

## 2. validateDiagnosis()

Inputs: `expectedDiagnosis`, `diagnosisResult`.

Checks (each contributes to score; weights in parentheses):

- (40) `primary` cause id matches.
- (20) `legacyDiagnosisKey` matches `expected.legacyDiagnosisKey`
  OR is in `expected.legacyDiagnosisKeyAlternates`.
- (15) `expected.secondary` is a subset of `result.coExplanations`.
- (15) `result.severity` matches `expectedSeverity`.
- (10) `result.confidence` ≥ floor for evidence tier of primary cause.

Critical finding (auto-fail of validator):
- `primary` mismatch where `expectedDiagnosis.primary` was authored
  with `presentationClarity = "clear"`.

---

## 3. validateRootCause()

Inputs: `expectedRootCauses`, `rootCauseResult`, `intermediates.causePosteriors`.

Checks:

- (35) every `expectedRootCauses[i]` cause appears in the top-K
  with `posterior ≥ minPosterior`.
- (25) `surfaceAs` agreement: lead/co-lead/candidate role matches.
- (20) **Dissent integrity**: if any expected cause is a `lead`,
  the dissent between top-1 and top-2 in the result must be ≥
  the value the cause's `dissentRules.maxDissentForLead` allows
  for single leadership (otherwise the case should be co-lead).
- (10) **Composite rule sanity**: if `primary` is
  `multifactorial-hair-loss`, ≥ 3 pathways are above 0.40 activation
  in `intermediates.activatedPathways`.
- (10) no expected cause is missing from posteriors entirely (i.e.
  cause emitter elided it).

Critical findings:
- Expected `lead` cause is below `minPosterior` by more than 0.10.
- `multifactorial-hair-loss` surfaced as `lead` without the composite
  rule being satisfied.

---

## 4. validateProtocol()

Inputs: `expectedProtocol` (= `expectedProtocolClass` + kit constraints),
`protocolResult`.

Checks:

- (30) `protocolClass` matches.
- (25) every `mustIncludeKits` substring appears in at least one
  recommended kit id.
- (20) no `mustExcludeKits` substring appears in any recommended kit id.
- (15) all `mustTriggerRules` are present in `protocolResult.firedRules`.
- (10) none of `mustBlockRules` are present in `protocolResult.firedRules`.

Critical findings:
- A `mustExcludeKits` substring appears (wrong kit shipped).
- A `mustBlockRules` rule fired (clinical-safety gate breached).

---

## 5. validateMonitoring()

Inputs: `expectedMonitoringRequirements`, `monitoringResult`.

Checks:

- (50) every `required` item is scheduled.
- (20) no `forbidden` item is scheduled.
- (20) `recommended` items, if scheduled, are timed within ±1 month
  of registry default cadence.
- (10) total scheduled tests ≤ `required.length + recommended.length + 2`
  (over-monitoring guard).

Critical findings:
- Any `forbidden` item present.
- A `required` lab whose absence would compromise safety (`TSH_3M`
  in hormonal cases, `FERRITIN_4M` in nutritional cases) is missing.

---

## 6. validateNarrative()

Inputs: `expectedNarrativeThemes`, `narrativeResult`.

Checks:

- (50) every `themes` entry appears in `narrativeResult.themes`.
- (25) every `mustContainTokens` substring appears (case-insensitive)
  in `narrativeResult.patientFraming` ∪ `doctorFraming` ∪
  `scientificFraming`.
- (15) no `mustNotContainTokens` substring appears anywhere in those
  three framings.
- (10) framings are non-empty and ≥ 40 words each (length floor).

Critical findings:
- A `mustNotContainTokens` token appears (e.g. promising "regrowth
  guaranteed" in an AA case).

---

## 7. Composition

```ts
export interface CaseValidation {
  caseId: string;
  diagnosis: ValidatorOutcome;
  rootCause: ValidatorOutcome;
  protocol: ValidatorOutcome;
  monitoring: ValidatorOutcome;
  narrative: ValidatorOutcome;
  /** Weighted overall — see HAIROS_RELEASE_GATE_SPEC.md. */
  overallScore: number;
  /** AND of `pass` across validators after critical-finding propagation. */
  overallPass: boolean;
}
```
