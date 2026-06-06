# HAIROS Clinical Acceptance Gate Spec

**Version:** 1.0.0
**Authored:** 2026-06-06
**Pack:** DERMATOLOGIST_REVIEW_PACK v1.0.0 (25 cases)
**Schema:** [DERMATOLOGIST_FEEDBACK_SCHEMA.ts](./DERMATOLOGIST_FEEDBACK_SCHEMA.ts)

This gate is **separate from** the corpus replay gate
([HAIROS_RELEASE_GATE_SPEC.md](../replay-corpus-v2/HAIROS_RELEASE_GATE_SPEC.md)).
The corpus gate measures regression safety against a frozen benchmark.
This gate measures **clinical trust** by licensed dermatologists.
A release MUST pass both.

---

## 1. Reviewer eligibility

A reviewer's `ReviewerFeedback.attestation` MUST satisfy:

- `isLicensedDermatologist: true`
- `yearsInPractice ≥ 3`
- `completedBlindReview: true` (saw only patient/doctor-facing outputs)

Submissions failing eligibility are excluded from aggregation but
retained for audit.

---

## 2. Minimum reviewer pool

- ≥ 5 eligible reviewers per pack version.
- Each reviewer evaluates all 25 cases (full sweep) — partial
  submissions are discarded for gate purposes; they may still inform
  qualitative themes.

---

## 3. Quantitative thresholds

Pack-level averages computed across (reviewer × case) tuples:

| Metric                       | Floor |
|------------------------------|-------|
| Diagnostic Accuracy          | ≥ 4.5 |
| Root Cause Accuracy          | ≥ 4.5 |
| Recommendation Quality       | ≥ 4.5 |
| Monitoring Quality           | ≥ 4.5 |
| Trustworthiness              | ≥ 4.5 |
| Patient Explainability       | ≥ 4.0 |
| Clinical Safety              | ≥ 4.7 (safety floor is stricter) |
| Clinical Completeness        | ≥ 4.3 |
| **Would Sign rate**          | ≥ 80% (YES + YES_WITH_MINOR_EDITS) |
| **Strict Would Sign rate**   | ≥ 50% (YES alone)                  |

Any floor breach → acceptance blocked.

---

## 4. Qualitative gates

Acceptance is blocked if ANY of:

- ≥ 1 `SAFETY_CONCERN` of severity `critical` (single voice is enough).
- ≥ 2 reviewers flag the same `SAFETY_CONCERN` themeKey at severity
  `major` or higher.
- Any `FailureTheme` whose `caseCoverage ≥ 30%` of pack cases
  (recurring harmful or wrong-output pattern).
- ≥ 2 reviewers report the same `MOST_REQUESTED_CHANGES` themeKey AND
  the change category is `DIAGNOSIS_ERROR` or `PROTOCOL_ERROR`.

---

## 5. Per-case sentinel gates

In addition to pack averages:

- For every case, mean `clinicalSafety ≥ 4.0`. A single case below
  the safety sentinel blocks acceptance for the pack regardless of
  other averages.
- For every case, `signYesRate + signYesWithEditsRate ≥ 50%`.

These prevent a strong average from masking a single dangerous case.

---

## 6. Outputs

The aggregator emits:

- `consensus.json` — `ConsensusReport`
- `CLINICAL_REVIEW_SUMMARY.md` — human-readable summary
- `acceptance-gate.json` — gate decision payload:

```ts
export interface ClinicalAcceptanceGateResult {
  packVersion: string;
  reviewerCount: number;
  caseCount: number;
  averages: ConsensusAverages;
  thresholds: Record<string, { value: number; floor: number; pass: boolean }>;
  willingToSignPercent: number;
  strictWillingToSignPercent: number;
  perCaseSentinelFailures: string[];     // caseIds
  blockingSafetyConcerns: SafetyConcernCluster[];
  blockingFailureThemes: FailureTheme[];
  overallPass: boolean;
  blockReasons: string[];
}
```

CI exits non-zero iff `overallPass === false`.

---

## 7. Versioning & re-runs

- Adding cases or changing the prompt set → new pack version.
- Re-running with the same pack on new reviewers → accumulates into
  the existing pack version's aggregation; gate re-evaluated.
- A pack that has passed acceptance is checkpointed in
  `docs/dermatologist-review-v1/acceptance-baselines/` and used for
  trust-drift detection on subsequent packs.

---

## 8. Out of scope

This gate does NOT measure:

- Code quality, regression safety, or performance (covered by replay gate).
- Patient outcomes (requires real-world deployment; out of pre-release scope).
- Avatar / UI / multilingual quality.

It measures ONLY whether licensed dermatologists, reading the
patient- and doctor-facing outputs in isolation, find them safe and
trustworthy enough to sign.
