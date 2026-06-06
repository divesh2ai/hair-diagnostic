# Pathway Activation Engine

**Status:** Sprint 1 / Week 2 deliverable. Architecture spec — engine implementation Week 2 Days 4–5.
**Layer:** Clinical Intelligence.
**Position:** Between Signal Extraction and Cause Ranker.
**Reads:** `signals.registry@1.0`, `pathways.registry@1.0`, `pathways.confidence-model@1.0`. **Writes:** `PathwayActivation[]`, `PathwayGraph`, `PathwayExplanation[]`.
**Inviolable Rule:** Stateless. Pure functional over the input signal set + registry versions. No I/O during activation. No clinical knowledge embedded — all weights, gates, formulas live in registries.

---

## 1. Folder Structure

```
src/packages/clinical-engine/pathway-activation/
├── README.md                       ← this document
├── contracts/
│   ├── PathwayActivation.schema.json
│   ├── PathwayGraph.schema.json
│   └── PathwayExplanation.schema.json
├── algorithm/                      ← reference algorithm spec (no code; pseudocode-grade)
│   ├── 01-gate-evaluation.md
│   ├── 02-weighted-aggregation.md
│   ├── 03-two-pass-interaction.md
│   ├── 04-confidence-calculation.md
│   ├── 05-severity-calculation.md
│   └── 06-recovery-impact-projection.md
├── governance/
│   ├── invariants.md               ← runtime invariants checked in CI
│   └── benchmarks.md               ← p50/p99 latency targets
└── fixtures/
    ├── golden-activations/         ← synthetic-patient → expected PathwayActivation[]
    └── parity-vs-legacy/           ← graph → projected DiagnosisKey vs. evaluateClinicalProfile
```

---

## 2. Engine Contract

### 2.1 Input

```
EngineInput {
  signals:               Signal[]              // emitted by Signal Extraction
  registryVersions:      {
                           signals,
                           pathways,
                           pathwaysConfidenceModel
                         }
  assessmentId:          UUID
  graphSnapshotIdSeed:   string                // for deterministic stamping
}
```

The engine never reads questionnaire answers and never reads any registry not declared above. Any attempt to load other state during activation fails CI's purity gate.

### 2.2 Output

```
EngineOutput {
  pathwayActivations:   PathwayActivation[]      // one per canonical pathway (all 10), including dormant
  pathwayGraph:         PathwayGraph             // nodes + edges + provenance
  explanations:         PathwayExplanation[]     // one per activated pathway (activation ≥ minimumActivationThreshold)
  engineMeta: {
    engineVersion,
    registryVersions,
    evaluatedAt,
    graphSnapshotId
  }
}
```

---

## 3. Algorithm

### Phase A — Signal Index

Build an O(1) lookup index keyed by `signalId` over the input `signals[]`. Signals absent from the input are treated as `confidence = 0` for activation purposes (NOT subthreshold — fully absent). This distinction is recorded in explainability as `absent` vs `subthreshold`.

### Phase B — Gate Evaluation (per pathway)

```
for each pathway p in pathways.registry:
  if p.activationRules.gateMode == "modulator-no-gate":
    gateMultiplier(p) := 1.0
    continue

  required_present := [signal_i for signal_i in p.requiredSignals if input contains signal_i.signalId at confidence ≥ gateMinConfidence]
  required_aggregate := Σ over input-present p.requiredSignals of confidence × weight

  if p.activationRules.gateMode == "required-any":
    gateMultiplier(p) := 1.0 if len(required_present) ≥ 1 else 0.0

  if p.activationRules.gateMode == "required-aggregate":
    gateMultiplier(p) := 1.0 if (len(required_present) ≥ 1 OR required_aggregate ≥ gateMinAggregate) else 0.0

  record gateRationale: present/absent required signals + which path satisfied the gate
```

### Phase C — Pass 1: Raw Activation (no interactions)

```
for each pathway p:
  support_sum := Σ over p.supportingSignals (weight × signal.confidence if present, else 0)
                 + Σ over p.requiredSignals  (weight × signal.confidence if present, else 0)
  inhibit_sum := Σ over p.inhibitorySignals  (|weight| × signal.confidence if present, else 0)

  rawActivation(p) := clip[0,1]( gateMultiplier(p) × (support_sum − inhibit_sum) )
```

### Phase D — Pass 2: Interaction Adjustment

```
for each pathway p:
  amp_total := 0
  for each entry (otherPathwayId, magnitude, when) in p.activationRules.amplifiedBy:
    other_raw := rawActivation(otherPathwayId)
    qualifies := (when == "co-active"  AND other_raw ≥ interactionThreshold)
              OR (when == "co-dominant" AND other_raw ≥ 0.65)
    if qualifies:
      amp_total += magnitude × other_raw

  amp_total := min(amp_total, interactionAmplificationCap)
  activation(p) := clip[0,1]( rawActivation(p) + amp_total )
```

Two passes guarantee order-independence and convergence without iteration.

### Phase E — Confidence

```
for each pathway p:
  evidenceMass := Σ over present supports + required-gates of
                    (weight × signal.confidence × evidenceTierWeight(signal.evidenceTier))

  expectedAbsent := supports + required-gates NOT present in input
  absenceMass    := Σ over expectedAbsent of (weight × absenceCost)        // absenceCost = 0.30

  conflictingPresent := signals listed in any of p's signals' `conflictingSignals[]` that ARE present
  conflictMass       := count(conflictingPresent) × conflictCost           // conflictCost = 0.20

  uncertaintyMass := absenceMass + conflictMass
  tierFloorWeight := tier-weight of worst tier among present required-gate or top-3 supporting signals

  confidence(p) := clip[minConfidence, maxConfidence](
                     (evidenceMass / (evidenceMass + uncertaintyMass)) × tierFloorWeight
                   )
```

### Phase F — Severity

```
for each pathway p:
  weighted_signal_severity := Σ over present supports + required-gates of
                                (signal.severityContribution × signal.confidence)

  severity(p) := clip[0,1](
                   activation(p)
                   × reversibilityWeight(p.reversibilityClass)
                   × weighted_signal_severity
                   / 1.5
                 )

  severityBand(p) := banded(severity(p))  // dormant / latent / active / dominant / entrenched
```

### Phase G — Recovery Impact Projection

```
for each pathway p:
  recoveryImpact(p) := {
    recoveryCeilingDelta:  p.recoveryImpact.recoveryCeilingDelta  × activation(p),
    responsivenessDelta:   p.recoveryImpact.responsivenessDelta   × activation(p),
    progressionRiskDelta:  p.recoveryImpact.progressionRiskDelta  × activation(p)
  }
```

These are the per-pathway contributions the Recovery Engine (Week 3) will sum and modulate.

### Phase H — Subthreshold Marking

```
for each pathway p:
  if activation(p) < minimumActivationThreshold (0.20):
    subthreshold(p) := true        // emitted in graph for explainability, but excluded from Cause ranking
  else:
    subthreshold(p) := false
```

### Phase I — Emit

Emit one `PathwayActivation` per canonical pathway (all 10), one `PathwayGraph` for the whole assessment, one `PathwayExplanation` per non-subthreshold activation.

---

## 4. PathwayActivation Schema

```jsonc
{
  "pathwayId":         "follicular-miniaturization",
  "activation":        0.78,                       // [0.0, 1.0]
  "activationBand":    "dominant",                 // dormant/latent/active/dominant/entrenched
  "confidence":        0.91,                       // [0.05, 0.98]
  "severity":          0.64,                       // [0.0, 1.0]
  "severityBand":      "active",
  "subthreshold":      false,

  "gateRationale": {
    "gateMode":               "required-any",
    "gateSatisfied":          true,
    "satisfyingRequiredSignals": [
      { "signalId": "pattern-thinning-marker", "confidence": 0.85, "weight": 0.75 }
    ],
    "unsatisfiedRequiredSignals": [],
    "gateAggregate":          0.6375
  },

  "supportingSignals": [
    { "signalId": "grade45-severity-marker",        "weight": 0.85, "confidence": 0.92, "contribution": 0.782 },
    { "signalId": "genetic-predisposition-reported","weight": 0.55, "confidence": 0.80, "contribution": 0.440 },
    { "signalId": "chronic-duration-marker",        "weight": 0.50, "confidence": 0.85, "contribution": 0.425 },
    /* ... ordered by contribution descending ... */
  ],

  "inhibitingSignals": [
    /* present inhibitors with confidence and reduction contribution */
  ],

  "conflictingSignals": [
    /* signals present that conflict with one or more of this pathway's signals (from Signal Registry conflictingSignals[]) */
  ],

  "interactionAdjustments": [
    { "fromPathwayId": "scalp-inflammation",     "magnitude": 0.20, "otherActivation": 0.55, "applied": 0.110 },
    { "fromPathwayId": "hormonal-dysregulation", "magnitude": 0.25, "otherActivation": 0.30, "applied": 0.000, "reason": "below interactionThreshold (0.40)" }
  ],

  "recoveryImpact": {
    "recoveryCeilingDelta":   -0.195,      // = declared(-0.25) × activation(0.78)
    "responsivenessDelta":    -0.078,
    "progressionRiskDelta":    0.234
  },

  "reversibilityClass":   "partially-reversible",
  "chronicityProfile":    { "onsetSpeed": "chronic", "persistenceWithoutTx": "progressive", "recurrenceRisk": "high" },
  "evidenceStrength":     0.87,           // confidence × tierFloorWeight, surfaced for Recovery
  "evidenceTierFloor":    "established",

  "registryVersions":     { "signals": "1.0.0", "pathways": "1.0.0", "pathwaysConfidenceModel": "1.0.0" },
  "engineVersion":        "1.0.0"
}
```

---

## 5. PathwayGraph Schema

```jsonc
{
  "graphSnapshotId":   "uuid-v4",
  "assessmentId":      "uuid-v4",
  "evaluatedAt":       "ISO-8601",
  "registryVersions":  { "signals": "1.0.0", "pathways": "1.0.0", "pathwaysConfidenceModel": "1.0.0" },
  "engineVersion":     "1.0.0",

  "nodes": [
    /* Signal nodes (every input signal, plus expected-but-absent signals referenced by any pathway) */
    {
      "kind":          "signal",
      "id":            "node.signal.pattern-thinning-marker",
      "signalId":      "pattern-thinning-marker",
      "present":       true,
      "subthreshold":  false,
      "confidence":    0.85,
      "evidenceTier":  "established",
      "category":      "hair-loss-pattern"
    },
    /* Pathway nodes (always all 10) */
    {
      "kind":              "pathway",
      "id":                "node.pathway.follicular-miniaturization",
      "pathwayId":         "follicular-miniaturization",
      "activation":        0.78,
      "activationBand":    "dominant",
      "confidence":        0.91,
      "severity":          0.64,
      "severityBand":      "active",
      "subthreshold":      false,
      "reversibilityClass":"partially-reversible"
    }
    /* ... */
  ],

  "edges": [
    /* Signal → Pathway edges */
    {
      "kind":           "supports",
      "from":           "node.signal.grade45-severity-marker",
      "to":             "node.pathway.follicular-miniaturization",
      "weight":         0.85,
      "confidence":     0.92,
      "contribution":   0.782,
      "evidenceTier":   "established"
    },
    {
      "kind":           "required-gate",
      "from":           "node.signal.pattern-thinning-marker",
      "to":             "node.pathway.follicular-miniaturization",
      "weight":         0.75,
      "confidence":     0.85,
      "gateSatisfied":  true
    },
    {
      "kind":           "inhibits",
      "from":           "node.signal.age-young-modifier",
      "to":             "node.pathway.follicular-miniaturization",
      "weight":         -0.30,
      "confidence":     0.0,                  // absent
      "contribution":   0.0
    },
    /* Pathway ↔ Pathway interaction edges */
    {
      "kind":           "amplifies",
      "from":           "node.pathway.scalp-inflammation",
      "to":             "node.pathway.follicular-miniaturization",
      "magnitude":      0.20,
      "applied":        0.110,
      "when":           "co-active"
    },
    {
      "kind":           "mediates",
      "from":           "node.pathway.oxidative-stress",
      "to":             "node.pathway.follicular-miniaturization",
      "magnitude":      0.15
    },
    {
      "kind":           "competes",
      "from":           "node.pathway.telogen-cycle-disruption",
      "to":             "node.pathway.follicular-miniaturization",
      "magnitude":      0.10
    }
  ],

  "provenance": {
    "signalsConsumed":     ["pattern-thinning-marker", "grade45-severity-marker", "..."],
    "pathwaysEvaluated":   10,
    "pathwaysActivated":   3,
    "pathwaysSubthreshold":7,
    "computeMs":           4.2
  }
}
```

The PathwayGraph is the **single substrate** Cause Ranker, Recovery Engine, Objectives Engine, and Narrative projections will read. Nothing downstream reads `signals[]` or the Pathway Registry directly — they walk the graph.

---

## 6. PathwayExplanation Schema (three projections per pathway)

```jsonc
{
  "pathwayId":         "follicular-miniaturization",
  "activationBand":    "dominant",
  "confidence":        0.91,
  "severityBand":      "active",
  "evidenceTierFloor": "established",

  "whyActivated": {
    "gateSatisfiedBy":     [{ "signalId": "pattern-thinning-marker", "confidence": 0.85 }],
    "topSupports":         [
      { "signalId": "grade45-severity-marker",        "contribution": 0.782 },
      { "signalId": "genetic-predisposition-reported","contribution": 0.440 },
      { "signalId": "chronic-duration-marker",        "contribution": 0.425 }
    ],
    "amplifyingInteractions": [
      { "fromPathway": "scalp-inflammation", "applied": 0.110 }
    ]
  },

  "strongestEvidence": {
    "signalId":        "grade45-severity-marker",
    "confidence":      0.92,
    "evidenceTier":    "established"
  },

  "conflictingEvidence": [
    /* signals present that conflict with primary supports — drives dissent in Cause Ranker */
  ],

  "confidenceRationale": {
    "evidenceMass":     1.47,
    "absenceMass":      0.18,
    "conflictMass":     0.0,
    "tierFloorWeight":  1.00,
    "narrative":        "concept.confidence.high_evidence_established_tier"
  },

  "severityRationale": {
    "reversibilityClass":         "partially-reversible",
    "reversibilityWeight":        0.85,
    "weightedSignalSeverity":     1.13,
    "severityBeforeBanding":      0.64,
    "narrative":                  "concept.severity.active_progressive"
  },

  "doctorView": {
    "framing":              "concept.miniaturization.doctor",
    "showDissent":          true,
    "showEvidenceTiers":    true,
    "showConfidenceNumber": true,
    "showAlternatives":     true,
    "scientificDepth":      "comprehensive",
    "anchorPhraseConcepts": ["concept.miniaturization.doctor.primary","concept.miniaturization.doctor.mechanism"]
  },

  "patientView": {
    "framing":              "concept.miniaturization.patient",
    "showDissent":          false,
    "showEvidenceTiers":    false,
    "showConfidenceNumber": false,
    "uncertaintyPresentation": "qualitative-banded",
    "tone":                 "informative",
    "anchorPhraseConcepts": ["concept.miniaturization.patient.what","concept.miniaturization.patient.outlook"]
  },

  "scientificView": {
    "framing":              "concept.miniaturization.scientific",
    "showFullDAG":          true,
    "showRegistryVersions": true,
    "showFormulaTrace":     true,
    "anchorPhraseConcepts": ["concept.miniaturization.scientific.mechanism","concept.miniaturization.scientific.evidence"]
  },

  "provenance": {
    "graphNodeId":       "node.pathway.follicular-miniaturization",
    "registryVersions":  { "signals": "1.0.0", "pathways": "1.0.0" }
  }
}
```

**Critical:** PathwayExplanation produces **structured concept references**, not English prose. Phrasing happens at the Narrative layer via PhraseBank lookup. This is what makes locale expansion zero-engine-cost.

---

## 7. Runtime Invariants (`governance/invariants.md`)

Enforced as runtime assertions and verified by CI on every fixture:

| ID | Invariant |
|---|---|
| INV-1  | All 10 canonical pathway IDs present in output (no missing pathways) |
| INV-2  | activation ∈ [0.0, 1.0] for every pathway |
| INV-3  | confidence ∈ [0.05, 0.98] for every activated pathway |
| INV-4  | severity ∈ [0.0, 1.0] for every pathway |
| INV-5  | A pathway with subthreshold == true has activation < 0.20 |
| INV-6  | gateRationale.gateSatisfied == false implies activation == 0.0 |
| INV-7  | Sum of recoveryImpact.* across all activated pathways stays within Recovery Engine input bounds (recoveryCeilingDelta ∈ [-2.0, 0.4], etc.) — verified before handoff |
| INV-8  | Two consecutive runs of the same EngineInput produce byte-identical PathwayGraph (modulo evaluatedAt and graphSnapshotId) |
| INV-9  | Every PathwayActivation references only signalIds that exist in signals.registry@registryVersions.signals |
| INV-10 | Every supports/inhibits/required-gate edge in PathwayGraph has a corresponding pathway-registry entry (cross-registry symmetry) |
| INV-11 | No edge of kind `mediates` is part of a cycle (DAG invariant) |
| INV-12 | Total interaction amplification per pathway ≤ interactionAmplificationCap (0.25) |

---

## 8. Performance Targets (`governance/benchmarks.md`)

| Workload | p50 | p99 | p99.9 |
|---|---:|---:|---:|
| Per-assessment activation (cold registry) | 1.5 ms | 5 ms | 12 ms |
| Per-assessment activation (warm registry, cached) | 0.4 ms | 1.2 ms | 3 ms |
| Concurrent throughput @ 1 vCPU | — | 500 req/s | — |
| Memory footprint (registries cached) | 18 MB | — | — |
| 1M assessments/day capacity | 12 vCPU steady-state | — | — |

**Why these are achievable:**
- 10 pathways × ≤25 signals each × 2 passes = O(500) FLOPs per assessment.
- No allocations in hot path beyond the output structs (pooled).
- No I/O; registries memory-resident.
- Trivially parallelizable (no shared state between assessments).

---

## 9. Conflict Handling

Conflicts surface from the Signal Registry's `conflictingSignals[]` symmetry. When a pathway's supporting signal A is present and A's conflicting signal B is also present:

1. The signal-level confidence aggregation (Signal Registry confidence model, Phase 4: Conflict Penalty) has already reduced confidences before this engine runs. No re-application.
2. This engine records `conflictingSignals[]` on the PathwayActivation for explainability.
3. Confidence formula adds `conflictMass = count × conflictCost (0.20)` to uncertainty.
4. Cause Ranker (Week 3) consumes conflicting evidence as `dissent` per cause.

The Pathway Activation Engine does NOT decide which conflicting interpretation wins. That is the Cause Ranker's responsibility.

---

## 10. Reinforcement Logic

"Reinforcement" happens at two levels and is NOT re-applied here:

1. **Signal-level reinforcement** — handled by Signal Registry confidence model (corroborating signals at conf ≥ 0.40 apply reinforcementMultiplier 1.10).
2. **Pathway-level interaction amplification** — handled by Pass 2 of activation, bounded by `interactionAmplificationCap (0.25)`.

This engine NEVER reaches back into the signals to modify their confidences. Signals are immutable inputs.

---

## 11. Threshold Logic Summary

| Threshold | Value | Owner | Used for |
|---|---:|---|---|
| `gateMinConfidence` | 0.40 | pathways.confidence-model | per-signal gate check |
| `gateMinAggregate` | 0.55 | pathways.confidence-model | aggregate gate check |
| `interactionThreshold` | 0.40 | pathways.confidence-model | qualifying co-active interactions |
| `interactionAmplificationCap` | 0.25 | pathways.confidence-model | total amplification per pathway |
| `minimumActivationThreshold` | 0.20 | pathways.confidence-model | subthreshold marking |
| `minimumEvidenceThreshold` | 0.40 | signals.confidence-model | signal subthreshold (pre-engine) |
| `maxConfidence` (pathway) | 0.98 | pathways.confidence-model | confidence ceiling |
| `minConfidence` (pathway) | 0.05 | pathways.confidence-model | confidence floor |

Engines may not introduce new thresholds. Adding a threshold requires a major version bump of the relevant confidence-model file.

---

## 12. Determinism & Reproducibility

Given:
- `EngineInput` (immutable)
- `registryVersions` (immutable refs to versioned registries)
- `engineVersion` (immutable code version)

The engine guarantees **byte-identical** `pathwayActivations` and `pathwayGraph.edges` across:
- Repeated invocations on the same machine.
- Invocations across machines (no platform-specific floating-point reliance — formulas use stable arithmetic; banding is closed-interval).
- Invocations across time (no time-dependent inputs in activation, only in `evaluatedAt` metadata).

`graphSnapshotId` and `evaluatedAt` are excluded from diff comparisons by the parity harness.

---

## 13. Audit Trail

Every emitted `PathwayActivation` carries `registryVersions` and `engineVersion`. Together with the stored `signals[]` input (persisted by `assessment-orchestrator`), any historic assessment can be recomputed exactly. If a registry or engine version differs from production-current, the engine produces a **parallel re-eval record** dated and stamped — historic output is never overwritten.

---

## 14. Sprint Boundary

- **Week 2 Days 1–3:** Pathway Registry + categories + confidence-model + validation-schema (DONE).
- **Week 2 Days 4–5:** Implement engine against this spec; produce 50 fixtures in `fixtures/golden-activations/`; CI green on all 12 runtime invariants.
- **Week 3 Day 1:** Hand off PathwayGraph to Cause Ranker.

The engine is intentionally small (≤500 lines including tests). The complexity lives in the registries — where it should.
