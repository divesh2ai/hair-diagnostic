# Cause Registry v1

**Status:** Sprint 1 / Week 3 deliverable. Frozen at v1.0.0.
**Owner:** Clinical Intelligence layer.
**Consumers:** Cause Ranker engine, Recovery Engine (Week 3), Objectives Engine (Week 3), Narrative Intelligence, Doctor Report Builder, Legacy DiagnosisKey Adapter. Read-only.
**Position in pipeline:**

```
Signals → Pathways → [Causes (this registry)] → Recovery → Objectives → Protocol
```

This registry is the **single source of truth** for explanatory causes in HairOS V2. Together with the Signal Registry and Pathway Registry it completes the Cause Intelligence Layer.

---

## What a Cause IS — and IS NOT

| Concept | Role | Lives in |
|---|---|---|
| **Signal** | An observation about the patient ("dandruff with itching") | `signals/` |
| **Pathway** | A biological mechanism ("scalp-inflammation") | `pathways/` |
| **Cause** | An explanatory hypothesis ("inflammatory-scalp-dysfunction") that competes against other hypotheses for probability mass | `causes/` (this registry) |

Causes are NOT signals (they are not observations).
Causes are NOT pathways (they are not mechanisms).
Causes are **competing explanations** that consume the active pathway graph (plus direct signal cues) and emit a **ranked Bayesian posterior** over a fixed set of clinical narratives.

A cause says: *"if you were a doctor and had to name the dominant driver in one phrase, this is the phrase."*

---

## Files

| File | Purpose |
|---|---|
| `registry.json` | 10 canonical causes with priors, contributing pathways, contributing signals, dissent rules, legacy mappings. |
| `categories.json` | 10 explanatory categories + relationship templates. |
| `confidence-model.json` | Bayesian log-posterior formula, dissent model, conflict handling, confidence propagation, exclusionary edges, governance constants. |
| `validation-schema.json` | JSON Schema + 22 integrity constraints enforced by registry CI. |
| `README.md` | This document. |

---

## Architectural Commitments

1. **Read-only on Pathway Registry and Signal Registry.** Every `pathwayId` and `signalId` referenced here must resolve in its source registry. Cross-registry symmetry is CI-enforced (IC-C-3, IC-C-4, IC-C-21).
2. **Bayesian, not rule-based.** Ranking is a softmax over per-cause log-posteriors. There are no `if/then` branches, no override tables, no precedence lists outside the data. Every clinical override is expressible as a log-likelihood-ratio in JSON.
3. **Three distinct outputs per cause.** Posterior (probability mass), Confidence (trustworthiness of that probability), and Severity-alignment (clinical gravity vector). Each has its own formula in `confidence-model.json` — never collapsed.
4. **No TypeScript clinical logic.** All priors, LLRs, dissent thresholds, conflict penalties, and exclusionary edges live in JSON. The Cause Ranker engine is a stateless evaluator over this registry.
5. **Composite cause is NEVER a fallback.** Multifactorial-hair-loss must EARN its leadership via the `compositeRule` (≥3 pathways above 0.40 AND top-two dissent < 0.06). It is the structural verdict that the case cannot honestly be explained by one driver — not a placeholder.
6. **Dissent is first-class.** Every emitted `CauseRank` carries leadership margin, second-best cause, third-best cause, and the co-leading set. Doctors see *what else was considered* and *how close it came*.
7. **Conflicts subtract, exclusions zero.** Conflicting evidence applies a configurable penalty; only clinically incompatible patterns (e.g. patchy loss vs. androgenic miniaturization) force a cause's score to negative infinity.
8. **Determinism over heuristics.** Same inputs + same registry version ⇒ byte-identical output. Ties are broken structurally (lower prior wins to reward evidence, then lexicographic id) — never randomly.
9. **No products. No protocols.** Causes do not encode treatments. Treatment routing happens downstream from severityAlignment + reversibilityClass + the active pathway set.

---

## The 10 Canonical Causes

| # | Cause ID | Category | Prior | Primary pathway | Reversibility |
|---|---|---|---:|---|---|
| 1 | androgen-driven-miniaturization | androgenic | 0.32 | follicular-miniaturization | partially-reversible |
| 2 | stress-driven-telogen-effluvium | neuro-endocrine-stress | 0.18 | telogen-cycle-disruption | fully-reversible |
| 3 | nutritional-hair-stress | nutritional | 0.10 | nutritional-limitation | fully-reversible |
| 4 | hormonal-hair-loss | endocrine | 0.14 | hormonal-dysregulation | partially-reversible |
| 5 | metabolic-hair-dysfunction | metabolic | 0.06 | metabolic-dysfunction | partially-reversible |
| 6 | autoimmune-hair-loss | autoimmune | 0.04 | immune-dysregulation | stabilizable |
| 7 | gut-hair-axis-dysfunction | gut-axis | 0.05 | gut-hair-axis-dysfunction | partially-reversible |
| 8 | inflammatory-scalp-dysfunction | scalp-inflammatory | 0.06 | scalp-inflammation | fully-reversible |
| 9 | hair-shaft-damage-syndrome | extrinsic-mechanical | 0.04 | hair-shaft-damage | shaft-only-reversible |
| 10 | multifactorial-hair-loss | composite | 0.01 | (composite rule) | partially-reversible |

Priors sum to 1.00 (within IC-C-9 band 0.85–1.05).

---

## Cause → Pathway Matrix

Numbers below are `logLikelihoodRatio` (LLR). Positive = supporting. Negative = competing/exclusionary. Empty = no edge declared.

| Cause \ Pathway | fol-min | tel-cyc | scalp-inf | horm-dys | imm-dys | met-dys | ox-stress | gut-axis | nutr-lim | shaft-dam |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| androgen-driven-miniaturization     | **+2.20** |  −0.50 |       | +0.85 | −1.30 | +0.40 |       |       |       |       |
| stress-driven-telogen-effluvium     |  −0.30 | **+2.40** |       | +0.50 |       |       | +0.40 |       | +0.55 |       |
| nutritional-hair-stress             |  −0.30 |  +0.70 |       |       |       |       |       | +0.55 | **+2.30** |       |
| hormonal-hair-loss                  |  +0.60 |  +0.70 |       | **+2.30** |       | +0.40 |       |       |       |       |
| metabolic-hair-dysfunction          |  +0.50 |       |       | +0.80 |       | **+2.20** | +0.45 |       |       |       |
| autoimmune-hair-loss                |  −0.70 |       | +0.55 |       | **+2.80** |       | +0.30 |       |       |       |
| gut-hair-axis-dysfunction           |       |       | +0.30 |       |       |       |       | **+2.50** | +0.90 |       |
| inflammatory-scalp-dysfunction      |  −0.20 |       | **+2.30** |       | +0.60 |       | +0.40 |       |       |       |
| hair-shaft-damage-syndrome          |       |       |       |       |       |       |       |       |       | **+2.60** |
| multifactorial-hair-loss            |  +0.80 |  +0.80 | +0.60 | +0.80 |       | +0.70 | +0.40 | +0.50 | +0.60 |       |

**Bold = role:primary.** Every non-composite cause has exactly one primary pathway (IC-C-5).

---

## Cause → Signal Matrix (primary signals only)

| Cause | Primary signals (role:primary) |
|---|---|
| androgen-driven-miniaturization     | pattern-thinning-marker |
| stress-driven-telogen-effluvium     | diffuse-shedding-marker |
| nutritional-hair-stress             | iron-deficiency-reported |
| hormonal-hair-loss                  | hypothyroid-diagnosis, hyperthyroid-diagnosis, pcos-diagnosis, pcos-with-metabolic |
| metabolic-hair-dysfunction          | prediabetes-state, diabetes-state, pcos-with-metabolic |
| autoimmune-hair-loss                | patchy-loss-marker, alopecia-areata-history, scarring-alopecia-history |
| gut-hair-axis-dysfunction           | ibs-or-constipation, gerd-symptoms |
| inflammatory-scalp-dysfunction      | dandruff-with-itching, scalp-redness, scalp-pustules, psoriatic-scalp |
| hair-shaft-damage-syndrome          | shaft-breakage-marker |
| multifactorial-hair-loss            | (none — composite by definition) |

Full supporting + conflicting edges are in `registry.json#causes[].contributingSignals`.

---

## Ranking Formula (canonical)

From `confidence-model.json#rankingModel`:

```
logScore(c) = log(prior(c))
            + Σ_p activation(p) × llr(c | p)               [over contributing pathways]
            + Σ_s confidence(s) × llr(c | s)               [over contributing signals]
            − conflictCount(c) × conflictPenaltyMagnitude  [conflicting evidence subtracts]
            − tierFloorPenalty(c)                          [heuristic/emerging primary evidence]

posterior(c) = exp(logScore(c) − maxLog) / Σ_k exp(logScore(k) − maxLog)
             (softmax with temperature = 1.0)
```

**Two-step composite handling:** evaluate the 9 single-driver causes first. If `compositeRule` fires (≥3 pathways ≥ 0.40 AND top-two single-cause posterior gap < 0.06), apply `compositePromotionBoost` (+1.10) to multifactorial's log-score before re-normalising. Otherwise multifactorial remains below the fold.

---

## Confidence Propagation

Distinct from posterior:

```
confidence(c) = clip[0.05, 0.97](
    posterior(c)
  × tierFloor(c)                   [established:1.00 / emerging:0.85 / heuristic:0.65]
  × (1 − conflictMass(c))          [0 to 0.6]
  × pathwayConfidenceAvg(c)        [avg of contributing pathways' confidences, weighted by activation]
)
```

A cause may be *probable* yet *low-confidence* if its evidence base is heuristic-tier or sparse. The doctor view surfaces both numbers; the patient view surfaces only confidence-weighted posterior.

---

## Dissent Model

| Verdict | Condition | UI handling |
|---|---|---|
| `leads`              | leadershipMargin ≥ maxDissentForLead         | Single-cause framing. |
| `leads-with-dissent` | 0.05 ≤ leadershipMargin < maxDissentForLead  | Single-cause framing + "also considered:" chip. |
| `co-leads`           | leadershipMargin < 0.05                      | Co-explanation framing (e.g. AGA + Hormonal). |
| `composite`          | compositeRule fired                          | Multifactorial framing, top-3 contributors surfaced. |

Dissent is computed deterministically and stamped on every `CauseRank`. There is no probabilistic threshold drift between runs.

---

## Conflict & Exclusion

- **Conflicting evidence** (signals/pathways tagged `conflicting` or `competing`) applies a `conflictPenaltyMagnitude` (0.45) per qualifying conflict above the conflict threshold (0.40).
- **Exclusionary evidence** drives the cause's logScore to `−∞`. Configured in `confidence-model.json#conflictHandling.exclusionaryEdges`. Examples:
  - `androgen-driven-miniaturization` is excluded when `immune-dysregulation` activation ≥ 0.55 AND `patchy-loss-marker` confidence ≥ 0.50.
  - `stress-driven-telogen-effluvium` is excluded when `patchy-loss-marker` confidence ≥ 0.60.
  - `hair-shaft-damage-syndrome` is excluded when `patchy-loss-marker` confidence ≥ 0.60.

The intent: never zero-out a cause for one weak counter-signal; do zero-out when the case is anatomically incompatible.

---

## Confidence Formulas (summary)

| Quantity | Formula | Bound |
|---|---|---|
| `priorProbability(c)` | (stamped per cause) | [0.005, 0.5] |
| `logScore(c)` | log(prior) + Σ activation·llr + Σ conf·llr − penalties | unbounded |
| `posterior(c)` | softmax over logScores, temperature=1.0 | [0, 1], Σ=1.0 |
| `confidence(c)` | posterior · tierFloor · (1−conflictMass) · pathwayConfidenceAvg | [0.05, 0.97] |
| `dissent(top)` | posterior(2nd) | [0, 1] |
| `leadershipMargin` | posterior(top) − posterior(2nd) | [0, 1] |

---

## Validation Constraints (CI-enforced)

| ID | Constraint |
|---|---|
| IC-C-1 | Unique cause IDs |
| IC-C-2 | All 10 canonical cause IDs present (no subset registries) |
| IC-C-3 | All pathwayIds resolve in Pathway Registry |
| IC-C-4 | All signalIds resolve in Signal Registry |
| IC-C-5 | ≥1 role==primary pathway per cause (except multifactorial) |
| IC-C-6 | ≥1 role==primary signal per cause (except multifactorial) |
| IC-C-7 | All LLRs in [−3.0, 3.0] |
| IC-C-8 | Sum of \|LLR\| over primary-role evidence in [3.0, 18.0] |
| IC-C-9 | Σ priors across 10 causes in [0.85, 1.05] |
| IC-C-10 | evidenceTier == worst tier among primary-role evidence |
| IC-C-11 | No signal/pathway appears twice in the same cause |
| IC-C-12 | dissentRules.competingCauses resolve to existing causes; no self-reference |
| IC-C-13 | compositeRule REQUIRED iff category==composite |
| IC-C-14 | All legacy DiagnosisKey references resolve in the 33-value enum |
| IC-C-15 | parityStrategy==co-explanation requires coWith pointing to an existing cause |
| IC-C-16 | shaft-only-reversible only on hair-shaft-damage-syndrome |
| IC-C-17 | role==exclusionary only on pathway entries |
| IC-C-18 | Pathway role sign: primary/supporting/modulator ⇒ LLR>0; competing/exclusionary ⇒ LLR<0 |
| IC-C-19 | Signal role sign: primary/supporting/modulator ⇒ LLR>0; conflicting/exclusionary ⇒ LLR<0 |
| IC-C-20 | Runtime: posteriors in [0,1] and sum to 1.0; confidence in [min,max] |
| IC-C-21 | Cross-registry: no deleted/deprecated references; minActivation ≥ 0.20 |
| IC-C-22 | Deterministic ordering with prior + lexicographic tie-break |

---

## Legacy Parity (DiagnosisKey → Cause)

Of the 33 legacy `DiagnosisKey` values:
- **29** map to one or more causes via `legacyMappings[]` per cause (direct, co-explanation, downstream-eligibility).
- **4** are surfaced as non-causes: `CHRONIC_MEDICAL`, `EARLY_GREY`, `REGROW_ONLY`, `TRICHOTILLOMANIA`. See `registry.json#legacyDiagnosisKeysNotMappedToCauses`.

Parity strategy is documented per cause in `legacyMappings[].parityStrategy`:
- `direct` — single legacy key maps to single cause.
- `co-explanation` — legacy key reflects a clinical bundle that the cause layer represents as two causes co-leading. The `coWith` field names the partner cause.
- `downstream-eligibility` — legacy key encodes an eligibility gate, not a cause; surfaced by the Eligibility registry.

The full Cause Ranker → DiagnosisKey adapter lives at:
`src/packages/clinical-engine/cause-ranker/legacy-adapter/diagnosisKeyAdapter.ts`

Parity-fixture corpus: `src/packages/clinical-engine/cause-ranker/fixtures/parity-vs-legacy/` (one fixture per legacy DiagnosisKey input, asserting expected cause leadership).

---

## Production Scale Assumptions

The Cause Ranker is designed for **1M assessments/day**:

- **Stateless and pure.** Same inputs + same registry versions → byte-identical outputs. Trivially horizontally scalable.
- **No I/O during ranking.** Registries are loaded once at process start, cached in-memory, refreshed only on registry version bump.
- **Bounded computation.** 10 causes × ≤20 evidence references each + softmax over 10 = O(200) multiplications + 1 softmax. p99 target: <4 ms per assessment under load.
- **Memory footprint** ~32 KB per loaded registry (well under L1 cache).
- **Determinism stamp.** Every emitted `CauseRank` carries the signal+pathway+cause+confidence-model registry versions and engine version for audit reconstruction.
- **Snapshot replay.** Historic assessments reproduce exactly under stamped versions; new engine releases produce a parallel re-eval record without modifying historic outputs.

---

## Change Discipline

- **Major version bump** required for: ranking formula change, softmax temperature change, dissent model change, conflict handling change, compositeRule change, removal of any of the 10 canonical cause IDs.
- **Minor version bump:** LLR tuning within existing references, addition of new supporting signals/pathways, addition of legacy mappings.
- **Patch:** clarifying notes, explainability metadata refinements, prior rationale wording.
- Every change requires clinical-reviewer sign-off + parity-fixture regeneration + CI green across all 22 integrity constraints.
- Adding a cause: forbidden in v1. v1 is locked at 10 canonical causes. New causes require v2 with full migration plan.

---

## Sprint Boundary

- **Sprint 1 Week 1 (done):** Signal Registry v1.
- **Sprint 1 Week 2 (done):** Pathway Registry v1 + Pathway Activation Engine.
- **Sprint 1 Week 3 (this deliverable):** Cause Registry v1 + Cause Ranker engine + CauseGraph schema + CauseExplanation projections + legacy DiagnosisKey adapter + Recovery Engine + Objectives Engine.
- **Sprint 1 Week 4 (next):** Doctor Report Builder + Patient Report projection + end-to-end legacy parity gate.

---

## Non-Goals (out of scope for this registry)

- **Pathway activation arithmetic** — owned by `pathways/` + `clinical-engine/pathway-activation/`.
- **Recovery prediction** — owned by `clinical-engine/recovery/`.
- **Objective mapping** — owned by `objectives/`.
- **Eligibility floors** (pregnancy, grade 4/5 hard locks) — owned by `eligibility/`.
- **Product mapping** — owned by Protocol Intelligence.
- **Narrative phrasing** — owned by Narrative Intelligence PhraseBank.

This registry tells you *which clinical narrative best explains the patient's presentation, with what confidence, against what competing hypotheses*. Nothing more. Everything downstream consumes it; nothing rewrites it.
