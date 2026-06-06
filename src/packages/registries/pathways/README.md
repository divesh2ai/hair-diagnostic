# Pathway Registry v1

**Status:** Sprint 1 / Week 2 deliverable. Frozen at v1.0.0.
**Owner:** Clinical Intelligence layer.
**Consumers:** Pathway Activation Engine, Cause Ranker (Week 3), Recovery Engine (Week 3), Objectives Engine (Week 3), Explainability builder. Read-only.
**Position in pipeline:**

```
Signals → [Pathway Activation (this registry)] → Causes → Recovery → Objectives
```

This registry is the **single source of truth** for biological pathways in HairOS V2. Together with the Signal Registry it forms the foundation on which all downstream reasoning is built.

A pathway is a **mechanistic grouping** that turns observations into causation. A pathway is *activated* (graded 0.0–1.0), never assigned. Activation reflects "how much of this process is occurring," distinct from *confidence* ("how sure are we") and *severity* ("how clinically grave").

---

## Files

| File | Purpose |
|---|---|
| `registry.json` | 10 canonical pathways with required/supporting/inhibitory signals, interactions, recovery impact, treatment implications, legacy mappings. |
| `categories.json` | 9 mechanism categories (follicular-cycle, inflammatory, endocrine, immunologic, metabolic, redox, gastrointestinal, nutritional, structural). |
| `confidence-model.json` | Activation formula, confidence formula, severity formula, recovery-impact scaling, interaction logic, governance constants. |
| `validation-schema.json` | JSON Schema + 17 integrity constraints enforced by registry CI. |
| `README.md` | This document. |

---

## Architectural Commitments

1. **Read-only on Signal Registry.** Every `signalId` referenced here must resolve in `signals.registry@1.0.0` AND the referenced signal must declare this pathway in its `pathwayRelevance[]`. Cross-registry symmetry is CI-enforced (IC-P-8).
2. **Three distinct outputs per pathway.** Activation (process magnitude), Confidence (evidence strength), Severity (clinical gravity). Each has its own formula in `confidence-model.json` — never collapsed.
3. **Gate discipline.** Pathways that declare `requiredSignals[]` cannot be activated by corroborating signals alone. At least one required signal must meet `gateMinConfidence` (0.40) OR the aggregate must meet `gateMinAggregate` (0.55). Modulator pathways (`oxidative-stress`) declare `modulator-no-gate`.
4. **No TypeScript logic.** All activation rules, weights, gates, interactions, and recovery deltas live in JSON. The Pathway Activation Engine is a stateless evaluator over this registry.
5. **Interactions are first-class data.** `amplifies`, `mediates`, `competes` edges are explicit. Two-pass evaluation (compute raw activations → apply interaction adjustment) is order-independent and converges without iteration.
6. **Reversibility shapes severity.** A fully-active fully-reversible pathway has lower severity than a half-active stabilizable one. This is structural, not stylistic.
7. **Recovery is a vector triple.** Every pathway declares `recoveryCeilingDelta`, `responsivenessDelta`, `progressionRiskDelta` — the Recovery Engine sums these across active pathways (scaled by activation) and applies demographic/lifestyle modifiers separately. No pathway "predicts recovery"; recovery prediction lives downstream.
8. **No products. No protocols.** Treatment implications are biological objectives (`growth-stimulation`, `nutritional-support`, etc.) — never products, kits, or therapies. Protocol Intelligence consumes objectives, not pathways.

---

## Pathway Inventory

| # | Pathway | Mechanism category | Reversibility | Required-gate signal(s) | Recovery ceiling Δ |
|---|---|---|---|---|---:|
| 1 | follicular-miniaturization | follicular-cycle | partially-reversible | pattern-thinning-marker | −0.25 |
| 2 | telogen-cycle-disruption | follicular-cycle | fully-reversible | diffuse-shedding-marker OR active-shedding-heavy | −0.05 |
| 3 | scalp-inflammation | inflammatory | fully-reversible | dandruff-with-itching / scalp-redness / scalp-pustules / psoriatic-scalp (aggregate) | −0.05 |
| 4 | hormonal-dysregulation | endocrine | partially-reversible | hypothyroid / hyperthyroid / pcos / peri / meno / postmeno | −0.15 |
| 5 | immune-dysregulation | immunologic | stabilizable | patchy-loss / alopecia-areata-history / scarring-alopecia | −0.30 |
| 6 | metabolic-dysfunction | metabolic | partially-reversible | prediabetes / diabetes / pcos-with-metabolic | −0.15 |
| 7 | oxidative-stress | redox | fully-reversible | (modulator — no gate) | −0.05 |
| 8 | gut-hair-axis-dysfunction | gastrointestinal | partially-reversible | ibs-or-constipation / gerd-symptoms | −0.10 |
| 9 | nutritional-limitation | nutritional | fully-reversible | iron-deficiency-reported | −0.05 |
| 10 | hair-shaft-damage | structural | shaft-only-reversible | shaft-breakage-marker | −0.05 |

---

## Interaction Graph (excerpt)

```
              ┌────────────── amplifies ─────────────────────────┐
              │                                                  │
              ▼                                                  │
  follicular-miniaturization ◄── amplifies ── hormonal-dysregulation
              ▲                                                  │
              │ amplifies                                        │ amplifies
              │                                                  ▼
        scalp-inflammation ◄────── amplifies ─── immune-dysregulation
              ▲                                                  
              │ amplifies                                        
              │                                                  
        oxidative-stress ── mediates ──► follicular-miniaturization
              ▲
              │ amplifies
              │
        metabolic-dysfunction ◄── amplifies ── hormonal-dysregulation

  nutritional-limitation ◄── amplifies ── gut-hair-axis-dysfunction
        │ amplifies
        ▼
  telogen-cycle-disruption ◄── amplifies ── hormonal-dysregulation
                            ◄── amplifies ── oxidative-stress
                            ── competes ──  follicular-miniaturization
```

Full edges in `registry.json#pathways[].interactions`. The `mediates` edges form a strict DAG (IC-P-10). `amplifies` edges may form cycles — bounded by `interactionAmplificationCap` (0.25).

---

## Activation Formula (canonical)

From `confidence-model.json#activationModel`:

```
activation(p) = clip[0,1]( gateMultiplier(p) * (Σ supports − Σ inhibits) + Σ interactionAdjustments )
```

Where:
- `gateMultiplier`: 1.0 if any required signal meets `gateMinConfidence` (0.40) OR aggregate ≥ `gateMinAggregate` (0.55); else 0.0.
- `Σ supports` = `Σ (weight_i × confidence_i)` over supporting + present required-gate signals.
- `Σ inhibits` = `Σ (|weight_j| × confidence_j)` over inhibitory signals.
- `Σ interactionAdjustments` = `Σ magnitude × otherActivation` over `amplifiedBy[]` entries where `otherActivation ≥ 0.40`. Bounded by `interactionAmplificationCap` (0.25).

Two-pass evaluation:
1. **Pass 1:** Compute raw activation for every pathway with interaction adjustment = 0.
2. **Pass 2:** Apply interaction adjustment using Pass-1 activations of other pathways.

This makes evaluation order-independent and convergent without iteration.

---

## Confidence Formula (distinct from activation)

```
confidence(p) = evidenceMass / (evidenceMass + uncertaintyMass) × tierFloorWeight
```

- `evidenceMass` = Σ over present supports + required-gates of `(weight × confidence × evidenceTierWeight)`.
- `uncertaintyMass` = Σ over expected-but-absent signals of `(weight × absenceCost)` + count of conflicting present signals × `conflictCost`.
- `tierFloorWeight` = worst evidence tier among present required-gate or top-3 supporting signals → 1.00/0.85/0.65 for established/emerging/heuristic.
- Bounded by `[minConfidence, maxConfidence]` = `[0.05, 0.98]`.

---

## Severity Formula

```
severity(p) = activation(p) × reversibilityWeight × Σ (signal.severityContribution × signal.confidence) / 1.5
```

Reversibility weights: fully-reversible 0.60, partially-reversible 0.85, stabilizable 1.00, shaft-only-reversible 0.50, irreversible 1.10.

Severity bands: `dormant` (0.00–0.19), `latent` (0.20–0.39), `active` (0.40–0.64), `dominant` (0.65–0.84), `entrenched` (0.85–1.00).

---

## Recovery Impact Scaling

Each pathway declares max-magnitude deltas at activation = 1.0. The Recovery Engine downstream applies:

```
effectiveDelta = declaredDelta × activation(p)
```

Then sums effective deltas across all pathways with activation ≥ `minimumActivationThreshold` (0.20), then applies demographic + lifestyle modifiers separately (not in this registry).

---

## Validation Constraints (CI-enforced)

| ID | Constraint |
|---|---|
| IC-P-1 | Unique pathway IDs |
| IC-P-2 | ≥1 supporting signal per pathway |
| IC-P-3 | All signalIds resolve in Signal Registry |
| IC-P-4 | No signal appears in more than one of required/supporting/inhibitory for the same pathway |
| IC-P-5 | `required-any` or `required-aggregate` mode ⇒ requiredSignals non-empty |
| IC-P-6 | `modulator-no-gate` mode ⇒ requiredSignals empty |
| IC-P-7 | Required-gate signals must be established-tier (mirrors Signal IC-8) |
| IC-P-8 | Cross-registry symmetry — every supporting signal must list this pathway in its Signal Registry `pathwayRelevance[]` |
| IC-P-9 | Interactions resolve to existing pathways; no self-interaction |
| IC-P-10 | `mediates` edges form a strict DAG (no cycles); `amplifies` cycles permitted (bounded) |
| IC-P-11 | Sum of supporting weights in [0.5, 8.0] |
| IC-P-12 | ≥1 treatment implication |
| IC-P-13 | `shaft-only-reversible` restricted to {scalp-stabilization, maintenance} implications |
| IC-P-14 | Recovery deltas in declared ranges |
| IC-P-15 | Runtime: activation ≤ 1.0, severity ≤ 1.0, recovery delta scaling preserved |
| IC-P-16 | All 10 canonical pathway IDs present (no subset registries) |
| IC-P-17 | All legacy DiagnosisKey references resolve in the 33-value enum |

---

## Legacy Parity (DiagnosisKey → Pathway)

Of the 33 legacy `DiagnosisKey` values:
- **27** map to one or more pathways via `legacyMappings[]` per pathway (direct, co-activation, composite).
- **4** are not pathways and are surfaced as non-pathway artifacts: `CHRONIC_MEDICAL`, `EARLY_GREY`, `REGROW_ONLY`, `MULTI`. See `registry.json#legacyDiagnosisKeysNotMappedToPathways`.
- **2** (`PREGNANCY`, `AGA_GRADE45_LOCK`) route partially: pathway activates softly while hard eligibility / recovery floors register in their downstream registries.

Parity strategy is documented per pathway in `legacyMappings[].parityStrategy`. Parity verification runs in Sprint 1 Week 3 once Cause Ranker can project to `DiagnosisKey` via the legacy adapter.

---

## Recovery Intelligence Compatibility

Every pathway emits the following fields consumable by the Recovery Engine (Week 3):

```
{
  pathwayId,
  reversibilityClass:     fully-reversible | partially-reversible | stabilizable | shaft-only-reversible | irreversible,
  chronicityProfile:      { onsetSpeed, persistenceWithoutTx, recurrenceRisk },
  severity:               banded number,
  evidenceStrength:       confidence × tierFloorWeight,
  recoveryModifiers:      { recoveryCeilingDelta, responsivenessDelta, progressionRiskDelta }  [scaled by activation at use time]
}
```

This is the Recovery Intelligence contract surface. No additional pathway authoring is required to enable Week 3 work.

---

## Sprint Boundary

- **Sprint 1 Week 1 (done):** Signal Registry v1.
- **Sprint 1 Week 2 (this deliverable):** Pathway Registry v1 + Pathway Activation Engine spec + PathwayGraph schema + PathwayExplanation projections.
- **Sprint 1 Week 3 (next):** Cause Ranker + Recovery Engine + Objectives Engine + legacy `ClinicalProfile` adapter. Parity sign-off at end of week.

---

## Production Scale Assumptions

The Pathway Activation Engine is designed for **1M assessments/day**:

- **Stateless and pure.** Same inputs + same registry versions → byte-identical outputs. Trivially horizontally scalable.
- **No I/O during activation.** Registries are loaded once at process start, cached in-memory, refreshed only on registry version bump.
- **Bounded computation.** 10 pathways × ≤25 signals each × 2 passes = O(500) multiplications per assessment. p99 target: <5 ms per assessment under load.
- **Determinism stamp.** Every emitted `PathwayActivation` carries the signal+pathway+confidence-model registry versions and engine version for audit reconstruction.
- **Snapshot replay.** Historic assessments reproduce exactly under stamped versions; new engine releases produce a parallel re-eval record without modifying historic outputs.

---

## Change Discipline

- Major version bump required for: activation formula change, confidence formula change, severity formula change, interaction model change, removal of any of the 10 canonical pathway IDs.
- Minor version bump: weight tuning within existing signals, addition of new supporting signals, addition of interactions.
- Patch: clarifying notes, explainability metadata refinements, legacy mapping additions.
- Every change requires clinical-reviewer sign-off + parity-fixture regeneration + CI green across all 17 integrity constraints.
- Adding a pathway: forbidden in v1. v1 is locked at 10 canonical pathways. New pathways (e.g. circadian, vascular) require v2 with full migration plan.

---

## Non-Goals (out of scope for this registry)

- Cause ranking — owned by `causes/` registry (Week 3).
- Recovery prediction — owned by `clinical-intelligence/recovery/` engine.
- Objective mapping — owned by `objectives/` registry.
- Eligibility floors (pregnancy, grade 4/5 hard locks) — registered separately in `eligibility/`.
- Product mapping — owned by Protocol Intelligence.
- Narrative phrasing — owned by Narrative Intelligence PhraseBank.

This registry tells you *what biological processes are active, with what confidence, at what severity, with what recovery implications*. Nothing more. Everything downstream consumes it; nothing rewrites it.
