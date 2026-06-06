# Cause Ranker (Cause Intelligence Layer)

**Status:** Sprint 1 / Week 3 deliverable. Frozen at engine v1.0.0.
**Owner:** Clinical Intelligence layer.
**Pipeline position:**

```
Signals → Pathways → [Cause Ranker (this engine)] → Recovery → Objectives → Protocol
```

The Cause Ranker consumes a `PathwayGraph` (and the underlying signal set), and emits a deterministic Bayesian posterior distribution over the 10 canonical causes, plus per-cause explanations and the explainability DAG.

This engine is **stateless, deterministic, and registry-driven**. It contains no clinical rules in TypeScript — every cause-specific behaviour is sourced from `src/packages/registries/causes/`.

---

## Folder Layout

```
src/packages/clinical-engine/cause-ranker/
├── README.md                                   ← this document
├── contracts/
│   ├── CauseRank.schema.json                   ← top-level emission per assessment
│   ├── CauseExplanation.schema.json            ← per-cause attribution (one per top-N entry)
│   └── CauseGraph.schema.json                  ← explainability DAG (signals → pathways → causes)
├── algorithm/                                  ← engine TS implementation (Week 3 ticket)
│   ├── rank.ts                                 ← main entrypoint
│   ├── softmax.ts                              ← stable softmax + tie-break
│   ├── scoreCause.ts                           ← per-cause logScore aggregation
│   ├── applyConflictPenalty.ts                 ← conflicting + tier-floor penalties
│   ├── compositePromotion.ts                   ← multifactorial gate
│   ├── exclusionEngine.ts                      ← exclusionary-edge enforcement
│   ├── confidencePropagation.ts                ← per-cause confidence from posterior + tier + conflicts
│   ├── dissent.ts                              ← leadership margin + verdict
│   ├── graphBuilder.ts                         ← assembles CauseGraph from inputs
│   └── explanationBuilder.ts                   ← per-cause CauseExplanation projections
├── legacy-adapter/
│   └── diagnosisKeyAdapter.ts                  ← projects CauseRank → legacy DiagnosisKey
├── governance/
│   ├── governance-constraints.md               ← engine-level governance (GC-1..GC-16)
│   ├── legacy-parity-strategy.md               ← v1 ↔ v2 parity contract per DiagnosisKey
│   └── migration-plan.md                       ← shadow → dual-emit → cut-over plan
└── fixtures/
    ├── golden-rankings/                        ← canonical input → expected output (per cause)
    └── parity-vs-legacy/                       ← one fixture per legacy DiagnosisKey
```

`algorithm/` is the Week 3 implementation ticket — contracts and governance are this deliverable; implementation is the engineering ticket that consumes them.

---

## What It Does (in one paragraph)

Reads the active `PathwayGraph` plus the present signals. For each of the 10 canonical causes, computes a log-score using the cause's prior, its contributing pathways (weighted by activation × log-likelihood-ratio), its contributing signals (weighted by confidence × LLR), and subtractive conflict penalties + evidence-tier-floor penalties. Normalises via softmax (temperature = 1.0) into a posterior over 10 causes. Computes dissent (the second-best posterior) and the leadership verdict (`leads` / `leads-with-dissent` / `co-leads` / `composite`). Promotes `multifactorial-hair-loss` to lead only when its compositeRule fires (≥3 pathways active above 0.40 AND top-two single-cause gap < 0.06). Propagates confidence from underlying pathway confidence + evidence tier + conflict mass. Emits one `CauseRank` (full distribution + verdict), N `CauseExplanation` projections (one per top-N cause), and one `CauseGraph` (the full DAG, for replay and audit).

---

## Inputs

| Input | Source | Shape |
|---|---|---|
| `PathwayGraph` | clinical-engine/pathway-activation | `clinical-engine.pathway-activation.PathwayGraph@1.0.0` |
| `signals[]` | signals/registry + extraction output | `{ signalId, present, confidence, evidenceTier }[]` |
| Cause Registry snapshot | registries/causes@1.0.0 | loaded once at boot |
| Confidence model snapshot | registries/causes.confidence-model@1.0.0 | loaded once at boot |

The engine performs no I/O during evaluation.

---

## Outputs

| Output | Schema | Persisted as |
|---|---|---|
| `CauseRank` | `clinical-engine.cause-ranker.CauseRank@1.0.0` | `Assessment.aiArtifacts[type=CAUSE_RANK]` (one per assessment) |
| `CauseExplanation[]` | `clinical-engine.cause-ranker.CauseExplanation@1.0.0` | `Assessment.aiArtifacts[type=CAUSE_EXPLANATION]` (one per top-N cause) |
| `CauseGraph` | `clinical-engine.cause-ranker.CauseGraph@1.0.0` | `Assessment.aiArtifacts[type=CAUSE_GRAPH]` (one per assessment) |

Each emission stamps the four registry versions + engine version for byte-exact replay.

---

## Bayesian Ranking — the canonical formula

```
logScore(c) = log(prior(c))
            + Σ_p activation(p) × llr(c | p)               [pathways]
            + Σ_s confidence(s) × llr(c | s)               [signals]
            − conflictCount(c) × conflictPenaltyMagnitude
            − tierFloorPenalty(c)

posterior(c) = softmax_T( logScore(c) )                   [T = 1.0]
```

**Composite promotion** (multifactorial only):

```
if (#{p | activation(p) ≥ 0.40} ≥ 3) AND
   (posterior(top, no-composite) − posterior(2nd, no-composite) < 0.06)
then
   logScore(multifactorial) += compositePromotionBoost  (= 1.10)
   re-normalise softmax
```

**Confidence propagation:**

```
confidence(c) = clip[0.05, 0.97](
    posterior(c)
  × tierFloor(c)
  × (1 − conflictMass(c))
  × pathwayConfidenceAvg(c)
)
```

**Verdict (dissent decision table):**

| `leadershipMargin` | Verdict |
|---|---|
| ≥ `top.dissentRules.maxDissentForLead` | `leads` |
| 0.05 to maxDissentForLead | `leads-with-dissent` |
| < 0.05 | `co-leads` |
| compositeRule fired | `composite` |

All constants live in `src/packages/registries/causes/confidence-model.json`. The engine reads them; it does not redefine them.

---

## Determinism Guarantees

1. **No I/O after registry load.** Registries cached, frozen via `Object.freeze`.
2. **No `Math.random()`** in the algorithm path. Tie-breaks are structural: (lower prior wins, then lexicographic id).
3. **Single rounding pass.** Bankers'-rounding to 4dp at serialisation only. Intermediate arithmetic at IEEE 754 double precision.
4. **Two-pass evaluation, single iteration each.** Composite promotion is a structurally bounded second pass.
5. **Version stamping** on every emission. Replay regenerates byte-exact output.

See `governance/governance-constraints.md` for the full constraint set (GC-1 … GC-16).

---

## Production Scale Targets

| Metric | Target |
|---|---:|
| p50 latency | 1.5 ms |
| p99 latency | 4.0 ms |
| p99.9 latency | 8.0 ms |
| Hard timeout | 100 ms |
| Throughput | 1,000,000 assessments/day |
| Memory footprint (loaded snapshot) | ~32 KB |
| Horizontal scaling | trivial (stateless, no shared cache required) |

Compute upper bound per assessment: 10 causes × ≤20 evidence references × 2 multiplications + 1 softmax over 10 = O(400) floating-point ops + 10 `exp()` calls. Well under L1 cache budget.

---

## How to Run Locally

```ts
import { rankCauses } from "@hairos/clinical-engine/cause-ranker/algorithm/rank";
import { loadCauseRegistry } from "@hairos/registries/causes";
import { loadConfidenceModel } from "@hairos/registries/causes/confidence-model";

const snapshot = {
  causes: loadCauseRegistry(),
  causesConfidenceModel: loadConfidenceModel(),
  // pathways + signals registries also required
};

const result = rankCauses({
  pathwayGraph,             // from upstream PathwayActivation engine
  signals,                  // SignalNode[] from PathwayGraph
  snapshot,
  engineVersion: "1.0.0",
});

result.causeRank;                 // CauseRank (top-level)
result.causeExplanations;         // CauseExplanation[]
result.causeGraph;                // CauseGraph
```

---

## Fixtures

| Fixture set | Path | Purpose |
|---|---|---|
| Golden rankings | `fixtures/golden-rankings/` | One fixture per cause showing a canonical "this cause clearly leads" input → expected output. Used for regression. |
| Parity vs legacy | `fixtures/parity-vs-legacy/` | One fixture per legacy `DiagnosisKey` (33 fixtures) asserting the v2 verdict + adapter projection. Used for migration gate. |

Run fixtures:

```bash
npm run cause-ranker:fixtures
npm run cause-ranker:parity
```

---

## Validation Layers

| Layer | Enforces |
|---|---|
| `registry.json` schema | Cause IDs, LLR ranges, role consistency, completeness (IC-C-1 … IC-C-19) |
| `confidence-model.json` schema | Formula constants in declared ranges |
| Engine runtime invariants | Posteriors sum to 1.0, no NaN/Infinity escapes serialisation, version stamps present (IC-C-20 … IC-C-22) |
| Parity fixtures | DiagnosisKey reproducibility ≥ acceptance bars (see `legacy-parity-strategy.md`) |
| Replay invariant test | Re-evaluation of historic assessments under stamped versions is byte-equal |

---

## Boundaries

The Cause Ranker DOES NOT:

- Compute pathway activation (owned by `pathway-activation/`).
- Predict recovery (owned by `recovery/`).
- Emit treatment objectives (owned by `objectives/`).
- Render narrative phrasing (owned by Narrative Intelligence `PhraseBank`).
- Apply eligibility gates (owned by `eligibility/`).
- Emit product or protocol references (owned by Protocol Intelligence).

It answers exactly one question: **"Given this pathway graph and signal set, which clinical narrative best explains the patient — with what confidence, and against what competing hypotheses?"**

Everything downstream consumes its answer. Nothing rewrites it.

---

## Sprint Boundary

- **Done (Week 3, this deliverable):** Cause Registry v1, Cause Ranker contracts (`CauseRank`, `CauseExplanation`, `CauseGraph`), governance constraints, legacy parity strategy, migration plan.
- **Adjacent tickets (Week 3):** Cause Ranker algorithm implementation in `algorithm/`, parity-fixture corpus regeneration, Recovery Engine + Objectives Engine.
- **Next (Week 4):** Doctor Report Builder consuming `CauseRank` + `CauseExplanation`; Patient Report projection.

---

## Change Discipline

Every change requires:

1. CI green across all 22 cause-registry constraints (IC-C-1 … IC-C-22).
2. Engine governance tests passing (GC-1 … GC-16).
3. Parity fixtures meeting acceptance bars.
4. Clinical-reviewer sign-off (any LLR or formula change).
5. Major version bump for: formula change, softmax temperature change, dissent model change, conflictHandling change, compositeRule change, cause removal.
