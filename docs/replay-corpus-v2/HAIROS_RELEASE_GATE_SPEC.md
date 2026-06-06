# HAIROS Release Gate Spec

**Version:** 1.0.0
**Frozen contract:** `ClinicalReleaseGate@1.0`

A release of HairOS is blocked unless every gate below is GREEN against
the current corpus version. Gates are enforced by
`scripts/replay-corpus/runReplay.ts` exit code in CI.

---

## 1. Scoring

Overall per-case score is the weighted sum of validator scores:

| Validator     | Weight |
|---------------|--------|
| Diagnosis     | 0.30   |
| Root Cause    | 0.25   |
| Protocol      | 0.20   |
| Monitoring    | 0.10   |
| Narrative     | 0.15   |

Corpus-level accuracy per dimension is the mean per-case score for
that dimension. Overall accuracy is the mean of per-case
`overallScore`.

---

## 2. Quantitative thresholds

| Metric                | Floor |
|-----------------------|-------|
| Diagnosis Accuracy    | ≥ 90  |
| Root Cause Accuracy   | ≥ 90  |
| Protocol Accuracy     | ≥ 90  |
| Monitoring Accuracy   | ≥ 90  |
| Narrative Accuracy    | ≥ 85  |
| Overall Accuracy      | ≥ 90  |

Any floor breach → release blocked.

---

## 3. Categorical thresholds

In addition to overall numbers:

- For every category in the distribution table (Male AGA, FPHL, …
  Multifactorial), per-category overall accuracy MUST be ≥ 85.
  This prevents a single dominant category from masking a regression
  in a smaller one.
- For every adversarial case, the primary diagnosis MUST match
  (overrides numeric scoring).

---

## 4. Critical-failure gate

Release is blocked if ANY of:

- ≥ 1 `critical` finding in the failure registry.
- ≥ 1 `highRiskPattern` (see Failure Registry spec §3).
- Any `mustBlockRules` rule fires in any case
  (`PROTOCOL_FAILURE::*::FORBIDDEN_RULE_FIRED`).
- Any `forbidden` monitoring lab is scheduled
  (`MONITORING_FAILURE::*::FORBIDDEN`).

---

## 5. Performance gate (advisory)

Single-case p95 > 400 ms or full-sweep > 90 s → advisory red. Does
not block release but blocks merge into `main` from feature branches
unless waived by the perf owner.

---

## 6. Drift gate

If diagnosis accuracy drops > 2 points vs the last green release on
the same corpus version → release blocked even if absolute floor is
met. Forces regression triage before shipping.

---

## 7. Output

```
<reportDir>/release-gate.json
```

Shape:

```ts
export interface ReleaseGateResult {
  corpusVersion: string;
  runStartedAt: string;
  thresholds: Record<string, { value: number; floor: number; pass: boolean }>;
  categoryScores: Record<string, { score: number; floor: 85; pass: boolean }>;
  adversarialFailures: string[];        // caseIds
  criticalFindings: number;
  highRiskPatterns: string[];
  performance: { singleCaseP95Ms: number; sweepMs: number };
  driftVsLastGreen: { diagnosis: number; overall: number };
  overallPass: boolean;
  blockReasons: string[];
}
```

`overallPass` is the AND of every quantitative, categorical,
critical-failure and drift gate. CI uses this field to set exit
code.
