# Cause Ranker — Governance Constraints

**Status:** Sprint 1 / Week 3 deliverable. Frozen at engine v1.0.0.
**Scope:** The Cause Ranker engine itself — separate from the Cause Registry (`registries/causes/`). This document binds engine behaviour to the registry contracts; the registry binds clinical authorship to schema.

Governance is enforced at three layers:

1. **Build-time** — registry CI rejects malformed JSON. (See registry `validation-schema.json#integrityConstraints`.)
2. **Engine-runtime** — assertions that fail loudly under any production execution.
3. **Operator-discipline** — CODEOWNERS, change discipline, parity gates.

---

## GC-1 — Engine is a stateless evaluator

The Cause Ranker MUST NOT hold mutable per-process clinical state between assessments. It loads the four registries (`signals`, `pathways`, `causes`, `causes.confidence-model`) once at process boot, into an immutable in-memory snapshot keyed by version triple, and never mutates the snapshot. New registry versions force a controlled reload; in-flight assessments complete on the snapshot they started with.

**Enforcement:** runtime invariant test asserts that two evaluations of the same input on the same snapshot return byte-identical output, and that the snapshot object reference is `Object.isFrozen` at boot.

---

## GC-2 — All clinical knowledge in JSON

No conditional clinical logic in TypeScript. Every cause-specific rule (priors, LLRs, dissent thresholds, exclusionary edges, composite rule, conflict penalties) MUST live in JSON registry files. The engine is a pure interpreter.

**Forbidden patterns in engine source:**

```ts
if (causeId === "androgen-driven-miniaturization") { ... }   // ❌
if (signalId === "patchy-loss-marker") { ... }                 // ❌
```

**Permitted:**

```ts
for (const edge of cause.contributingPathways) {                // ✓
  if (pathway.activation >= edge.minActivation) {
    score += pathway.activation * edge.logLikelihoodRatio;
  }
}
```

**Enforcement:** lint rule `no-hardcoded-clinical-ids` in `eslint-config-hairos-clinical`. Repository CI fails on any match.

---

## GC-3 — Two-pass evaluation, no iteration

The Cause Ranker performs evaluation in a single pass over the registry. Composite promotion (multifactorial) requires recomputing posterior over the 9 non-composite causes first, then reinjecting multifactorial — this is the only "second pass" permitted, and it is structurally bounded (single application of `compositePromotionBoost`).

No fixed-point iteration. No oscillating updates. No retry loops.

**Enforcement:** profiling test asserts that the per-cause logScore is computed exactly once; profiler counter `softmaxApplications` must equal exactly 2 (single-cause normalisation + composite re-normalisation).

---

## GC-4 — Deterministic ordering

Tie-breaking MUST be deterministic and stamped on every `CauseRank`:

1. Primary key: `posterior` descending.
2. First tie-break: `priorProbability` **ascending** (lower-prior wins — rewards causes that overcame a weaker prior with evidence).
3. Second tie-break: cause `id` lexicographic ascending.

**Forbidden:** `Math.random()`, `Date.now()`, ordering derived from `Object.keys()` iteration order, ordering derived from hash map traversal.

**Enforcement:** parity-fixture test runs the same input 100 times and asserts emission byte-equality.

---

## GC-5 — Version stamping on every emission

Every `CauseRank` and every `CauseExplanation` MUST stamp:

- `registryVersions.signals`
- `registryVersions.pathways`
- `registryVersions.causes`
- `registryVersions.causesConfidenceModel`
- `engineVersion`

Missing or mismatched stamps cause the orchestrator to refuse to persist the emission.

**Enforcement:** schema validation at `Assessment.aiArtifacts[type=CAUSE_RANK].payload` upsert time; runtime guard in `causeRankerEmit()`.

---

## GC-6 — Floating-point discipline

All arithmetic at IEEE 754 double precision (`number` in JS/TS). One single rounding pass at serialisation, applied via bankers'-rounding to four decimal places. Intermediate values MUST NOT be rounded.

**Forbidden:** `Math.round(posterior * 100) / 100` in the middle of computation. `toFixed()` for anything but display.

**Rationale:** softmax is sensitive to rounding; intermediate rounding causes ordering drift between platforms (V8 vs SpiderMonkey vs JIT-warm vs cold).

---

## GC-7 — Exclusions are auditable

Every exclusion application MUST be emitted in `CauseRank.exclusions[]` with:

- `causeId` — the cause that was excluded.
- `exclusionRuleId` — the rule id in `confidence-model.json#conflictHandling.exclusionaryEdges`.
- `reason` — human-readable rendering of why.
- `triggeringSignalId` / `triggeringPathwayId` — the evidence that crossed the exclusion threshold.

Silent exclusion is forbidden.

---

## GC-8 — No clinical decisions on missing data

Absent evidence MUST NOT be treated as conflicting evidence. The Cause Ranker distinguishes:

- **Signal present, role=conflicting** → applies conflict penalty.
- **Signal absent** → contributes zero to logScore (NOT a penalty).

This protects against false negatives in extraction: a missing observation cannot down-rank a cause.

**Enforcement:** unit test asserts that adding a missing signal as `absent` to the input set leaves the posterior unchanged.

---

## GC-9 — Subthreshold transparency

Subthreshold causes (posterior < 0.04) MUST still appear as nodes in `CauseGraph` with `band='subthreshold'`. They MUST NOT be silently dropped. The 5-entry `topNEmitted` is a CONVENIENCE projection; the 10-entry `ranking` is the AUDIT trail.

---

## GC-10 — No protocol or product references

The Cause Ranker MUST NOT emit product names, treatment recommendations, kit ids, or protocol references. Treatment routing is downstream (Recovery Engine → Objectives Engine → Protocol Intelligence).

**Forbidden:** any string field in `CauseRank` or `CauseExplanation` containing a product SKU, brand name, or protocol id.

**Enforcement:** schema-level + lint scan over emitted payloads against the Product Registry.

---

## GC-11 — Patient framing is read-only

`framings.patientFraming` MUST be sourced verbatim from `causes.registry.json#explainabilityMetadata.patientFraming`. The engine MUST NOT template, paraphrase, or rewrite patient-facing text. All patient-facing narrative variation lives downstream in Narrative Intelligence (PhraseBank) — never in the ranker.

---

## GC-12 — Composite promotion is the ONLY way multifactorial leads

`multifactorial-hair-loss` cannot win on its own evidence. It can only become the leader via:

```
compositeRule.fired
  ⇔ (≥ minimumActivePathways pathways above minimumPathwayActivation)
  ∧ (top-two single-cause posterior gap < minimumDissentBetweenTopTwoCauses)
```

The engine MUST emit `compositePromotion.fired = false` when this rule did not fire — even if multifactorial happens to receive a high posterior from its prior + supporting pathways. In that case, multifactorial appears in `ranking` with band='considered' but not as leader.

---

## GC-13 — One CauseRank per assessment

The orchestrator MUST upsert exactly one `CauseRank` artifact per assessment (`Assessment.aiArtifacts[type=CAUSE_RANK]`). Re-evaluation under a new registry version triple does NOT overwrite — it creates a parallel `CAUSE_RANK_REPLAY` artifact with the new versions stamped.

Historic assessments are immutable; new engine releases produce a parallel re-eval record without modifying historic outputs.

---

## GC-14 — Latency budget

| Percentile | Budget |
|---|---:|
| p50 | 1.5 ms |
| p99 | 4.0 ms |
| p99.9 | 8.0 ms |
| timeout | 100 ms (hard) |

Exceeding p99 in production triggers a paging alert. Exceeding the hard timeout causes the orchestrator to fail the assessment into `PARTIAL_FAILURE` with `lastCompletedStage = 'PATHWAY_ACTIVATION'`, preserving the upstream PathwayGraph for retry.

---

## GC-15 — Change discipline

| Change class | Allowed in | Required artifacts |
|---|---|---|
| Patch — wording, framings, notes | minor/patch | clinical-reviewer sign-off |
| Minor — LLR tuning, adding supporting edges | minor | clinical-reviewer sign-off + parity-fixture regeneration + CI green |
| Major — formula change, temperature change, removing a cause | major | clinical-reviewer sign-off + parity-fixture regeneration + migration plan + parallel re-eval window (≥30 days) |
| Adding a new cause | forbidden in v1 | v2 only |

---

## GC-16 — Replay invariant

For any historic assessment A and its persisted `CauseRank`:

```
re-evaluate(
  PathwayGraph(A),
  Signals(A),
  registryVersionsAt(A.causeRank.evaluatedAt)
) === A.causeRank   (byte-identical)
```

Replay is invoked by clinical audits, parity sweeps, and major-version migrations. Any replay drift is a P0 incident.

**Enforcement:** weekly cron job replays 1% of recent assessments and alerts on any non-byte-equal result.

---

## Audit Trail

Every `CauseRank` MUST be persistable to and reconstructible from:

1. The `PathwayGraph` it was computed from.
2. The four registry versions stamped on it.
3. The engine version stamped on it.

These five anchors (graph + 4 versions) are the entire input space. Given them, the output is fully determined.
