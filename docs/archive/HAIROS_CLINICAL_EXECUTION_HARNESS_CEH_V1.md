# HairOS Clinical Execution Harness (CEH v1)

**Document Status:** Canonical — Runtime Verification Specification
**Version:** 1.0.0
**Date:** 2026-06-04
**Classification:** Regulated Medical AI QA System Specification
**Role of Author:** Senior Clinical Systems Architect

---

## Preface — What CEH Is and Is Not

CEH is **not** documentation, **not** a UI, **not** a narrative generator, and **not** a source of clinical truth. CEH is a **deterministic clinical execution and validation harness** that:

1. Executes simulated HairOS pipeline runs against test cases.
2. Validates the resulting outputs against the constitutional rules defined in:
   - `HAIROS_ARCHITECTURE.md`
   - `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md`
   - `HAIROS_SIGNAL_REGISTRY_V1.md`
   - `HAIROS_ROOT_CAUSE_ENGINE.md`
   - `HAIROS_CLINICAL_TRUST_LAYER.md`
   - `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md`
   - `HAIROS_UX_CONTRACT_SPECIFICATION.md`
   - `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md`
   - `HAIROS_REPORT_SYSTEM_SPECIFICATION.md`
3. Produces structured pass/fail validation reports with deductive scoring.
4. Is built to **fail outputs**, not to flatter them.

CEH is the QA gate that must clear before any HairOS clinical artifact is fit for deployment.

---

# 1. CEH ARCHITECTURE SPECIFICATION

## 1.1 System Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    CEH v1 RUNTIME                            │
│                                                              │
│  ┌──────────────┐   ┌────────────────────────────────────┐  │
│  │ Test Case    │──▶│   Execution Engine Simulator (EES) │  │
│  │ Loader       │   │  ── Signal Registry sim            │  │
│  └──────────────┘   │  ── Pathway sim                    │  │
│                     │  ── Root Cause Engine sim          │  │
│                     │  ── RDE sim                        │  │
│                     │  ── Trust Layer sim                │  │
│                     │  ── Explanation Engine sim         │  │
│                     │  ── Report System sim              │  │
│                     └────────────────┬───────────────────┘  │
│                                      │                       │
│         ┌────────────────────────────┼───────────────┐      │
│         ▼                            ▼               ▼      │
│  ┌──────────────┐         ┌────────────────┐   ┌─────────┐ │
│  │ Validator    │         │ Report         │   │ Trace   │ │
│  │ Bank (V1–V5) │         │ Generator      │   │ Logger  │ │
│  └──────┬───────┘         └────────┬───────┘   └────┬────┘ │
│         │                          │                │       │
│         └──────────┬───────────────┴────────────────┘       │
│                    ▼                                         │
│         ┌──────────────────────────────────┐                │
│         │  Validation Output Engine (VOE)  │                │
│         │  - Execution Trace               │                │
│         │  - Clinical Report (Patient+Dr)  │                │
│         │  - Validation Matrix             │                │
│         │  - System Integrity Score        │                │
│         └────────────────┬─────────────────┘                │
│                          │                                   │
│                          ▼                                   │
│         ┌──────────────────────────────────┐                │
│         │  Cross-Case Analysis Module      │                │
│         └──────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

## 1.2 Determinism Requirements

- All simulators must be pure functions of `(testCase, registryVersions, seed)`.
- No wall-clock dependence, no randomness without an injected seed, no network I/O.
- Two runs with identical inputs MUST produce byte-identical Execution Traces and Validation Matrices.

## 1.3 Input Contract — Test Case Object

```yaml
testCase:
  id: TC-####
  patientProfile:
    age: int
    sex: M|F|other
    hairPatternClass: Norwood-I..VII | Ludwig-I..III | Diffuse | Patchy | Cicatricial | Unspecified
  intake18:                # 18-question intake, compressed structured form
    onsetMonths: int
    familyHistory: bool
    shedRate: low|moderate|high|severe
    itch: 0..3
    pain: 0..3
    burning: 0..3
    scalingVisible: bool
    rednessVisible: bool
    pustules: bool
    medications: [string]
    supplements: [string]
    recentIllness: bool
    recentSurgery: bool
    weightChangeKg: float
    stressLevel: 0..3
    dietRestriction: none|vegetarian|vegan|restricted
    sleepHoursAvg: float
    cycleIrregularity: bool|null
  imageDescriptors:
    - region: vertex|frontal|temporal|crown|occipital|global
      density: low|moderate|high
      miniaturizationVisible: bool
      scalingVisible: bool
      erythemaVisible: bool
      scarringVisible: bool
      qualityScore: 0..1
  clinicalNotes: string|null
  injectedFaults: [string]   # OPTIONAL — used by CEH self-test to verify failure detection
```

`injectedFaults` is a CEH-only field. The pipeline must not see it. The Validator Bank uses it post hoc to confirm the harness detected the seeded violation.

## 1.4 Output Contract

Per test case, CEH emits:

```yaml
ceh_output:
  testCaseId: TC-####
  executionTrace: [...]            # ordered pipeline stage log
  generatedReport:
    patientView: {...}
    doctorView: {...}
  validationMatrix:
    traceability: PASS|FAIL
    confidenceIntegrity: PASS|FAIL
    causalConsistency: PASS|FAIL
    noiseFloorCompliance: PASS|FAIL|N/A
    explanationCompleteness: PASS|FAIL
  systemIntegrityScore: 0..100
  failureModes: [string]
  detectedSeededFaults: [string]   # for self-test cases
```

---

# 2. MODULE DESIGN DETAILS

## 2.1 Execution Engine Simulator (EES)

EES runs the pipeline in **strict topological order**. Skipping or reordering a stage is itself a constitutional violation surfaced by the Causal Consistency Validator.

| Stage | Input | Output | Constitutional Constraint |
|---|---|---|---|
| S1 — Signal Registry | intake18, imageDescriptors | Signal vector with per-signal confidence | Signals only — no findings yet |
| S2 — Pathway Activation | Signal vector | Activated pathways with weights | Pathways are signal aggregations; no causes here |
| S3 — Root Cause Engine | Pathways + Signals | Bayesian posterior over 10 canonical causes; accepted set with `compositeRule` traces | Multifactorial requires `compositeRule` |
| S4 — RDE | Accepted causes + patient profile + contraindications | Ranked recommendations with rationale and `whyNot` set | No recommendation without an objective |
| S5 — Trust Layer | All upstream outputs | Calibrated confidence bands; noise-floor map; report-eligibility flags | Sole authority for confidence values |
| S6 — Explanation Engine | All outputs + Trust Layer | Per-output 5-axis explanation block | Universal Explanation Contract |
| S7 — Report System | All outputs + Explanations + Trust Layer | Patient + Doctor views | Sole-source binding per section |

### 2.1.1 EES Simulators are Lookup-Driven

Each simulator uses an **expected-behavior lookup table** keyed on canonical input fingerprints. CEH does not invent novel clinical reasoning; it asserts that the *shape and discipline* of the output conform to constitutional rules.

## 2.2 Traceability Validator (V1)

Asserts:

- Every finding references ≥1 signal ID present in S1 output.
- Every accepted cause references ≥1 pathway *and* ≥1 signal from S2/S1.
- Every recommendation references ≥1 cause *and* an RDE objective.
- Every report section header binds to its declared sole source (per Report Spec §3.3).
- No "orphan" outputs (outputs whose upstream pointer set is empty).

Failure modes: `ORPHAN_FINDING`, `ORPHAN_CAUSE`, `ORPHAN_RECOMMENDATION`, `MISBOUND_REPORT_SECTION`.

## 2.3 Confidence Integrity Validator (V2)

Asserts:

- Every confidence value in the report appears in the Trust Layer output set with identical numeric/band identity.
- No confidence value is generated by S3, S4, S6, or S7.
- Confidence monotonicity rule: a recommendation's confidence ≤ min(confidence of supporting causes).
- No "smoothed" or rounded-up confidence: report layer banding must equal Trust Layer banding.

Failure modes: `FABRICATED_CONFIDENCE`, `SMOOTHED_CONFIDENCE`, `MONOTONICITY_VIOLATION`.

## 2.4 Causal Consistency Validator (V3)

Asserts directional integrity:

```
Signals → Findings → Causes → Recommendations
```

- No recommendation references a cause that was not accepted.
- No cause references a pathway not activated in S2.
- No finding appears in the report without a signal in S1.
- No stage is skipped; no stage is re-entered out of order.

Failure modes: `REVERSE_INFERENCE`, `SKIPPED_STAGE`, `STAGE_REENTRY`, `UNACCEPTED_CAUSE_USED`.

## 2.5 Noise Floor Validator (V4)

Applies only to Monitoring/Reassessment cases (cases with a baseline reference).

Asserts:

- No "improvement" / "progression" / "loss of response" claim where the magnitude is within the Trust Layer noise band.
- "Stable" must be emitted when all signals are within noise band.
- Aggregate trajectory verdicts conform to Report Spec §8.2.

Failure modes: `FABRICATED_IMPROVEMENT`, `FABRICATED_PROGRESSION`, `MISSING_STABLE_VERDICT`, `NOISE_BAND_NOT_RENDERED`.

For baseline-only cases this validator returns `N/A`.

## 2.6 Explanation Completeness Validator (V5)

For every **major output** (each finding, each accepted cause, each recommendation, each monitoring verdict), asserts that the Explanation Engine attached all five axes:

1. Why
2. Why Not (alternatives + reasons)
3. Evidence (enumerated upstream IDs)
4. Confidence (with Trust Layer source pointer)
5. Change Triggers

Failure modes: `MISSING_WHY`, `MISSING_WHY_NOT`, `MISSING_EVIDENCE`, `MISSING_CONFIDENCE_SOURCE`, `MISSING_CHANGE_TRIGGERS`.

## 2.7 Report Generator

Generates two views from the same canonical payload (per Report Spec §3.1 sequence):

- **Patient Report:** condensed, patient-layer fields only.
- **Doctor Report:** full structured clinical depth with all doctor-layer expansions.

The Report Generator MUST NOT author content; it renders payload fields through approved templates.

## 2.8 Validation Output Engine (VOE) and Scoring

### Scoring Rules

Start at **100**. Deduct per failed validator:

| Validator | Deduction on FAIL |
|---|---|
| V1 Traceability | −20 |
| V2 Confidence Integrity | −20 |
| V3 Causal Consistency | −20 |
| V4 Noise Floor Compliance | −20 (skipped if N/A; deduction reallocated to 0) |
| V5 Explanation Completeness | −20 |

A score below **80** means the report MUST NOT be issued. A score of **60 or below** triggers a mandatory engineering review.

---

# 3. VALIDATION RULE ENGINE LOGIC

The Validator Bank is implemented as a set of pure predicates over the Execution Trace and the canonical payload. Pseudocode:

```python
def validate(trace, payload, trustLayer):
    results = {}

    # V1 Traceability
    results['traceability'] = all([
        all(f.signalRefs and set(f.signalRefs) <= trace.S1.signalIds for f in payload.findings),
        all(c.pathwayRefs and c.signalRefs and
            set(c.pathwayRefs) <= trace.S2.pathwayIds and
            set(c.signalRefs)  <= trace.S1.signalIds for c in payload.acceptedCauses),
        all(r.causeRefs and r.objective and
            set(r.causeRefs) <= {c.id for c in payload.acceptedCauses}
            for r in payload.recommendations),
        all(section.source == REPORT_SPEC_SOURCE_MAP[section.kind]
            for section in payload.report.sections),
    ])

    # V2 Confidence Integrity
    results['confidenceIntegrity'] = all([
        all(x.confidence in trustLayer.bands for x in payload.allOutputs()),
        all(x.confidence is trustLayer.lookup(x.id).confidence for x in payload.allOutputs()),
        all(r.confidence <= min(c.confidence for c in r.causes) for r in payload.recommendations),
    ])

    # V3 Causal Consistency
    results['causalConsistency'] = (
        trace.stageOrder == ['S1','S2','S3','S4','S5','S6','S7']
        and all(r.causeRefs <= {c.id for c in payload.acceptedCauses} for r in payload.recommendations)
        and all(c.pathwayRefs <= trace.S2.pathwayIds for c in payload.acceptedCauses)
    )

    # V4 Noise Floor
    if payload.isMonitoring:
        results['noiseFloorCompliance'] = all(
            verdict_matches_noise_band(v, trustLayer.noiseFloor) for v in payload.monitoringVerdicts
        )
    else:
        results['noiseFloorCompliance'] = 'N/A'

    # V5 Explanation Completeness
    results['explanationCompleteness'] = all(
        has_all_five_axes(o.explanation) for o in payload.majorOutputs()
    )

    return results
```

### Failure Surfacing

Each validator returns not only PASS/FAIL but the *minimal failing set* — the exact output IDs and the rule violated. The cross-case analyzer aggregates these.

---

# 4. SAMPLE EXECUTION — 3 TEST CASES

The following three test cases are entirely synthetic. They exist to demonstrate harness behavior, including the harness's ability to **fail** outputs that violate the constitution. They are not clinical truth.

---

## 4.1 Test Case TC-0001 — Conformant Baseline (Expected: PASS)

### 4.1.1 Input

```yaml
testCase:
  id: TC-0001
  patientProfile: { age: 34, sex: M, hairPatternClass: Norwood-III }
  intake18:
    onsetMonths: 36
    familyHistory: true
    shedRate: moderate
    itch: 0
    pain: 0
    burning: 0
    scalingVisible: false
    rednessVisible: false
    pustules: false
    medications: []
    supplements: []
    recentIllness: false
    recentSurgery: false
    weightChangeKg: 0
    stressLevel: 1
    dietRestriction: none
    sleepHoursAvg: 7.0
    cycleIrregularity: null
  imageDescriptors:
    - { region: frontal,  density: low,      miniaturizationVisible: true,  scalingVisible: false, erythemaVisible: false, scarringVisible: false, qualityScore: 0.92 }
    - { region: vertex,   density: moderate, miniaturizationVisible: true,  scalingVisible: false, erythemaVisible: false, scarringVisible: false, qualityScore: 0.90 }
    - { region: occipital,density: high,     miniaturizationVisible: false, scalingVisible: false, erythemaVisible: false, scarringVisible: false, qualityScore: 0.95 }
  clinicalNotes: null
  injectedFaults: []
```

### 4.1.2 Execution Trace

```
S1 Signal Registry
  - SIG.MINIATURIZATION.FRONTAL     conf=0.88
  - SIG.MINIATURIZATION.VERTEX      conf=0.85
  - SIG.OCCIPITAL_SPARING           conf=0.93
  - SIG.FAMILY_HISTORY_POSITIVE     conf=1.00
  - SIG.NO_INFLAMMATION             conf=0.95

S2 Pathway Activation
  - PATH.ANDROGEN_DEPENDENT_MINIATURIZATION   weight=0.81  signals=[MIN.F, MIN.V, OCC.SPARE, FH+]
  - PATH.INFLAMMATORY                          weight=0.04  (below activation threshold)

S3 Root Cause Engine
  Posterior (softmax over 10 causes):
    CAUSE.ANDROGENETIC_ALOPECIA   0.86  ACCEPTED
    CAUSE.TELOGEN_EFFLUVIUM        0.05
    CAUSE.SEBORRHEIC_DERMATITIS    0.02
    [others < 0.02]
  compositeRule: not invoked (single-cause acceptance)

S4 RDE
  Objective: HALT_MINIATURIZATION
    REC.TOPICAL_MINOXIDIL_5         conf=0.82
    REC.ORAL_5AR_INHIBITOR          conf=0.78  (contraindication check: none)
  Objective: BASELINE_MONITORING
    REC.QUARTERLY_TRICHOSCOPY       conf=0.90

S5 Trust Layer
  Bands assigned; report-eligibility = all PASS
  Risk band: MODERATE (CI: 0.78–0.89)

S6 Explanation Engine
  5-axis blocks attached to all findings, causes, recommendations.

S7 Report System
  Patient + Doctor views rendered.
```

### 4.1.3 Generated Report (excerpt)

**Patient View — Executive Summary**
- Snapshot: 34M, frontal + vertex thinning, occipital sparing, 3-year onset.
- Risk: Moderate.
- Primary Findings: frontal miniaturization, vertex miniaturization, occipital sparing.
- Primary Causes: Androgenetic alopecia (high confidence).
- Recommendations: topical minoxidil 5%; oral 5-α reductase inhibitor (discuss with clinician); quarterly trichoscopic monitoring.
- Confidence: High.
- Monitoring State: Baseline Established.

**Doctor View — Cause Section (excerpt)**
- Accepted: `CAUSE.ANDROGENETIC_ALOPECIA` posterior=0.86, band=HIGH.
- Pathway evidence: `PATH.ANDROGEN_DEPENDENT_MINIATURIZATION` w=0.81.
- Signal evidence: `MIN.FRONTAL`, `MIN.VERTEX`, `OCC.SPARING`, `FH+`.
- Dissent: none.
- Alternatives considered: `TE` (no acute trigger, no shed-rate elevation), `SD` (no scaling, no erythema).
- compositeRule: not applicable.
- Change triggers: emergence of scaling/erythema, acute shed elevation, loss of occipital sparing.

### 4.1.4 Validation Matrix

| Validator | Result |
|---|---|
| V1 Traceability | PASS |
| V2 Confidence Integrity | PASS |
| V3 Causal Consistency | PASS |
| V4 Noise Floor Compliance | N/A (baseline) |
| V5 Explanation Completeness | PASS |

### 4.1.5 Score

**System Integrity Score: 100 / 100** — Report eligible for issuance.

---

## 4.2 Test Case TC-0002 — Fabricated Confidence + Orphan Recommendation (Expected: FAIL, seeded faults)

### 4.2.1 Input

```yaml
testCase:
  id: TC-0002
  patientProfile: { age: 42, sex: F, hairPatternClass: Ludwig-II }
  intake18:
    onsetMonths: 5
    familyHistory: false
    shedRate: severe
    itch: 1
    pain: 0
    burning: 0
    scalingVisible: false
    rednessVisible: false
    pustules: false
    medications: [oral_contraceptive_discontinued_4mo_ago]
    supplements: []
    recentIllness: true
    recentSurgery: false
    weightChangeKg: -6.0
    stressLevel: 3
    dietRestriction: restricted
    sleepHoursAvg: 5.0
    cycleIrregularity: true
  imageDescriptors:
    - { region: global, density: low, miniaturizationVisible: false, scalingVisible: false, erythemaVisible: false, scarringVisible: false, qualityScore: 0.88 }
  clinicalNotes: "Patient reports diffuse shedding throughout scalp."
  injectedFaults: [FABRICATED_CONFIDENCE, ORPHAN_RECOMMENDATION]
```

### 4.2.2 Execution Trace (faulted)

```
S1
  - SIG.DIFFUSE_SHED                conf=0.91
  - SIG.RECENT_ILLNESS              conf=0.95
  - SIG.WEIGHT_LOSS_SIGNIFICANT     conf=0.90
  - SIG.HORMONAL_TRANSITION         conf=0.80
  - SIG.NO_MINIATURIZATION          conf=0.92
S2
  - PATH.TELOGEN_SHIFT              weight=0.84
  - PATH.NUTRITIONAL_STRESS         weight=0.55
S3
  CAUSE.TELOGEN_EFFLUVIUM    0.79  ACCEPTED
  CAUSE.NUTRITIONAL_DEFICIT  0.41  ACCEPTED (compositeRule: co-driver)
S4 (faulted)
  REC.IRON_REPLETION_THERAPY        causeRefs=[NUTRITIONAL_DEFICIT]   conf=0.74
  REC.LOW_LEVEL_LASER_THERAPY       causeRefs=[]                       conf=0.70   ← ORPHAN
S5 Trust Layer
  bands set; LLLT recommendation eligibility flag = FAIL (no cause linkage)
S6 Explanation Engine
  WARNING: cannot generate `why` for REC.LOW_LEVEL_LASER_THERAPY — no upstream cause.
S7 Report System (faulted upstream)
  Report layer overrides Trust Layer band on REC.IRON_REPLETION from MODERATE→HIGH  ← FABRICATED_CONFIDENCE
```

### 4.2.3 Generated Report (would be blocked)

Report Generator emits the payload **but VOE blocks issuance** because two validators fail.

### 4.2.4 Validation Matrix

| Validator | Result | Failing Set |
|---|---|---|
| V1 Traceability | **FAIL** | `REC.LOW_LEVEL_LASER_THERAPY` → `ORPHAN_RECOMMENDATION` |
| V2 Confidence Integrity | **FAIL** | `REC.IRON_REPLETION_THERAPY` → `FABRICATED_CONFIDENCE` (report band ≠ Trust Layer band) |
| V3 Causal Consistency | PASS |  |
| V4 Noise Floor Compliance | N/A |  |
| V5 Explanation Completeness | **FAIL** (cascading) | `REC.LOW_LEVEL_LASER_THERAPY` missing Why/Evidence/Confidence-source |

### 4.2.5 Score

**System Integrity Score: 100 − 20 − 20 − 20 = 40 / 100**
**Status: BLOCK ISSUANCE. Engineering review required.**
**Seeded faults detected: `FABRICATED_CONFIDENCE` ✓, `ORPHAN_RECOMMENDATION` ✓.**

---

## 4.3 Test Case TC-0003 — Reassessment with Noise-Floor Violation (Expected: FAIL, seeded fault)

### 4.3.1 Input

```yaml
testCase:
  id: TC-0003
  patientProfile: { age: 51, sex: M, hairPatternClass: Norwood-V }
  intake18:
    onsetMonths: 120
    familyHistory: true
    shedRate: low
    itch: 0
    pain: 0
    burning: 0
    scalingVisible: false
    rednessVisible: false
    pustules: false
    medications: [finasteride_1mg, minoxidil_5_topical]
    supplements: []
    recentIllness: false
    recentSurgery: false
    weightChangeKg: 0
    stressLevel: 1
    dietRestriction: none
    sleepHoursAvg: 7.5
    cycleIrregularity: null
  imageDescriptors:
    - { region: vertex, density: moderate, miniaturizationVisible: true, scalingVisible: false, erythemaVisible: false, scarringVisible: false, qualityScore: 0.93 }
  clinicalNotes: "12-month reassessment under stable therapy."
  baselineReference: TC-0001-LIKE-SNAPSHOT
  injectedFaults: [FABRICATED_IMPROVEMENT]
```

### 4.3.2 Execution Trace (faulted)

```
S1
  - SIG.VERTEX_DENSITY_DELTA        delta=+1.8%   conf=0.85
  - SIG.MINIATURIZATION_VERTEX      conf=0.80 (Δ vs baseline = -0.03; below noise floor 0.05)
S5 Trust Layer
  Noise floor for SIG.VERTEX_DENSITY_DELTA = ±3.0%
  Noise floor for SIG.MINIATURIZATION_VERTEX = ±0.05
  → Both deltas WITHIN noise band → verdict required: STABLE.
S7 Report System (faulted)
  Monitoring section emits: "Modest improvement in vertex density observed."   ← FABRICATED_IMPROVEMENT
```

### 4.3.3 Validation Matrix

| Validator | Result | Failing Set |
|---|---|---|
| V1 Traceability | PASS |  |
| V2 Confidence Integrity | PASS |  |
| V3 Causal Consistency | PASS |  |
| V4 Noise Floor Compliance | **FAIL** | Vertex density Δ=+1.8% within ±3.0% noise band; verdict must be STABLE |
| V5 Explanation Completeness | PASS |  |

### 4.3.4 Score

**System Integrity Score: 100 − 20 = 80 / 100**
**Status: AT THRESHOLD — issuance blocked pending correction (per Report Spec §13 criterion #10 and CEH §2.8).**
**Seeded fault detected: `FABRICATED_IMPROVEMENT` ✓.**

---

# 5. CROSS-CASE ANALYSIS

## 5.1 Aggregate Pass/Fail

| Test Case | Score | Result |
|---|---|---|
| TC-0001 | 100 | PASS (issuable) |
| TC-0002 | 40 | BLOCK (engineering review) |
| TC-0003 | 80 | BLOCK (at threshold; correction required) |

## 5.2 Most Frequent Failure Modes (Across This Sample)

1. **Confidence fabrication at the report boundary** (TC-0002) — the report layer overriding Trust Layer banding is the highest-impact violation observed, because it silently corrupts every downstream display surface.
2. **Orphan recommendations** (TC-0002) — RDE candidates surviving without upstream cause linkage indicate either a constitution gap (RDE permitting non-causal candidates) or a payload-assembly bug.
3. **Noise-floor laundering** (TC-0003) — sub-threshold deltas rendered as trend claims; structurally identical to the "fabricated progress" anti-pattern called out in Report Spec §13.

## 5.3 Weakest System Component (Observed)

**Boundary between Trust Layer (S5) and Report System (S7).** Two of three failure cases originated at or after S5. This is consistent with the architectural risk that:

- S5 produces calibrated values.
- S7 is expected to *render* them.
- Any room for S7 to *transform* a value is room for fabrication.

**Hardening recommendation (system-level only, no UX):**
- Replace any computation in S7 with strict projection.
- Add a runtime invariant `hash(S7.banding) == hash(S5.banding)` evaluated before report emission.

## 5.4 Structural Gaps in Architecture (Observed)

1. **No mandatory "verdict-from-noise-band" derivation** at S5→S7 handoff. Currently the report layer is trusted to *interpret* the noise band; CEH evidence (TC-0003) shows this interpretive freedom is the failure surface. The verdict should be **derived inside S5** and rendered (not interpreted) by S7.
2. **No hard binding between RDE candidates and accepted causes.** TC-0002 shows that an RDE candidate without `causeRefs` reached S7. The RDE constitution should make `causeRefs` non-empty an *emission precondition*, not a downstream validator concern.
3. **Explanation Engine cascading failures are silent.** When V5 fails because V1 already failed (TC-0002), the harness should distinguish *primary* from *cascading* failures so engineering effort routes to the true root cause.

## 5.5 Evidence of Hallucination Risk Zones

Ranked by observed risk in this sample:

1. **Monitoring narrative generation** — the natural-language verbs ("improvement", "progression") are linguistically loaded and tempt the renderer to over-claim. Highest hallucination risk surface.
2. **Recommendation rationale** — `why` text is at risk of generalizing from "this patient's accepted cause" to "this intervention is broadly effective."
3. **Cause acceptance under low-margin posteriors** — when top-1 and top-2 posteriors are within ~0.05, the report layer may suppress the dissent flag; this should be impossible by construction.

## 5.6 System Improvement Suggestions (No UI; System-Level Only)

1. **Sealed S5→S7 channel.** Define an immutable, hash-sealed payload from Trust Layer to Report System. S7 may render fields; S7 may not mutate fields.
2. **Move verdict derivation upstream.** All trend verdicts (Stable / Improvement / Progression / Loss of Response / Escalation) are derived in S5 from the noise-floor map and emitted as enum values. S7 renders the enum.
3. **RDE emission preconditions.** `causeRefs` non-empty, `objective` set, `whyNot` populated for top-K alternatives — all enforced at S4 emission, not at validation.
4. **Cascading-failure attribution.** CEH should tag each failure with `primary` or `cascading` and route only primaries to scoring deductions, while still reporting cascades for transparency.
5. **Dissent flag is non-suppressible.** If the top-2 cause posterior margin is below the constitution's dissent threshold, the dissent flag is set in S3 and is immutable downstream.
6. **CEH self-test parity.** Every constitutional rule in the source documents must have at least one CEH test case that intentionally violates it (with `injectedFaults`). A constitution rule without a corresponding CEH self-test is, for QA purposes, untested.

---

## Closing Statement

CEH v1 is designed to behave like the QA layer of a regulated medical AI system. It is built to **find faults, not flatter outputs**. A HairOS build that cannot survive CEH is, by this specification's definition, not deployable. A HairOS build that survives CEH has cleared the minimum bar for clinical reviewability — not the maximum bar for clinical correctness, which remains the domain of human clinicians and regulators.

**End of Specification.**
