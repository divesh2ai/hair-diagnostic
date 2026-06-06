# HAIROS Clinical Failure Registry Spec

**Version:** 1.0.0
**Frozen contract:** `ClinicalFailureRegistry@1.0`

The Failure Registry is the post-replay artifact that captures every
finding that a) failed a validator OR b) was a `major`/`critical`
finding from any validator, even when the validator passed overall.

It is the input to the Benchmark Dashboard and the substrate for
release-gate "no critical failure patterns" enforcement.

---

## 1. Entry schema

```ts
export type FailureComponent =
  | "SIGNAL_FAILURE"
  | "PATHWAY_FAILURE"
  | "ROOTCAUSE_FAILURE"
  | "PROTOCOL_FAILURE"
  | "MONITORING_FAILURE"
  | "NARRATIVE_FAILURE";

export interface FailureEntry {
  replayId: string;                   // uuid for the replay run
  caseId: string;
  component: FailureComponent;
  expected: unknown;
  actual: unknown;
  severity: "minor" | "major" | "critical";
  rootCauseAnalysis: string;          // emitter MUST fill this
  remediation: string;                // suggested fix / owner
  /** Optional cluster key for pattern aggregation. */
  patternKey?: string;
}

export interface FailureRegistry {
  replayId: string;
  corpusVersion: string;              // e.g. "2.0.0"
  startedAt: string;                  // ISO-8601
  entries: FailureEntry[];
}
```

---

## 2. Component → category mapping

| Validator finding origin            | Component             |
|-------------------------------------|-----------------------|
| Extracted-signal mismatch           | `SIGNAL_FAILURE`      |
| Pathway activation under floor      | `PATHWAY_FAILURE`     |
| Cause posterior / dissent / multi   | `ROOTCAUSE_FAILURE`   |
| Diagnosis primary mismatch          | `ROOTCAUSE_FAILURE`   |
| Kit include / exclude / rule        | `PROTOCOL_FAILURE`    |
| Lab required / forbidden            | `MONITORING_FAILURE`  |
| Narrative themes / tokens / length  | `NARRATIVE_FAILURE`   |

Note: `SIGNAL_FAILURE` and `PATHWAY_FAILURE` originate from the
runner's intermediates being compared against `expectedSignals` /
`expectedPathways`, not from a dedicated validator.

---

## 3. Pattern aggregation

`patternKey` is emitted by the registry writer using this formula:

```
patternKey =
  component + "::" +
  expectedRef +     // e.g. cause id, signal id, kit substring, lab code
  "::" +
  failureMode       // e.g. "MISSING", "EXTRA", "BELOW_MIN", "WRONG_PRIMARY"
```

Examples:

- `ROOTCAUSE_FAILURE::androgen-driven-miniaturization::WRONG_PRIMARY`
- `PROTOCOL_FAILURE::MPHL::MISSING`
- `MONITORING_FAILURE::FERRITIN_4M::MISSING`
- `SIGNAL_FAILURE::pcos-with-metabolic::BELOW_MIN`

The dashboard groups by `patternKey` to compute
`topFailurePatterns` and `highRiskFailurePatterns` (= critical-severity
patterns that recur across ≥ 3 cases or any pattern that recurs in
≥ 5% of cases).

---

## 4. Persistence

Written to `<reportDir>/failure-registry.json` per run. Historical
runs are kept under `<reportDir>/history/<isoDate>-<replayId>.json`
for trendlines on the dashboard.

---

## 5. Read API

For dashboard / CLI consumers:

```ts
queryFailures(filter: {
  caseId?: string;
  component?: FailureComponent;
  severity?: ("minor"|"major"|"critical")[];
  patternKey?: string;
}): FailureEntry[];

topPatterns(k: number): Array<{ patternKey: string; count: number }>;

highRiskPatterns(): Array<{ patternKey: string; count: number; rate: number }>;
```

The registry is UI-agnostic; dashboards consume the JSON.
