# HAIROS_REFERENCE_EXECUTION_ENGINE_SPECIFICATION_V1.md

**Document Status:** Canonical — Runtime Architecture Contract
**Version:** 1.0.0
**Date:** 2026-06-04
**Author Role:** Chief Systems Architect, HairOS
**Designation:** REES v1 (Reference Execution Engine Specification)

---

## Authoritative Source Set (Consumed, Never Modified)

REES v1 is downstream of, and bound to:

- `HAIROS_ARCHITECTURE.md`
- `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md`
- `HAIROS_SIGNAL_REGISTRY_V1.md`
- `HAIROS_ROOT_CAUSE_ENGINE.md`
- `HAIROS_CLINICAL_TRUST_LAYER.md`
- `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md`
- `HAIROS_UX_CONTRACT_SPECIFICATION.md`
- `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md`
- `HAIROS_REPORT_SYSTEM_SPECIFICATION.md`
- `CEH_V1.md`
- `CEH_CK_V1_SPEC.md`

REES does not introduce signals, pathways, causes, recommendations, narratives, reports, or UI. REES converts the existing specification ecosystem into a **runnable deterministic architecture** that enforces every rule those documents already declare.

---

# SECTION 1 — RUNTIME PHILOSOPHY

## 1.1 Runtime Responsibilities

REES is the **execution substrate** for HairOS. Its responsibilities are:

1. Accept a patient case in a canonical structured form.
2. Execute the constitutional pipeline (S1 → S7) deterministically.
3. Bind every output to its upstream source.
4. Enforce every runtime invariant declared in Section 5.
5. Submit every output to the Validation Engine (V1 → V5) before emission.
6. Persist a complete, replayable audit trail.
7. Refuse to emit any artifact that fails validation.

## 1.2 What the Execution Engine MAY Do

- Execute pure functions defined by the constitutional documents.
- Pin engine versions, registry versions, and configuration at execution start.
- Compute confidence values inside the Trust Layer (S5) only.
- Compute monitoring verdicts inside the Trust Layer (S5) only.
- Project (render, copy, reference) values from upstream stages into downstream stages.
- Emit `INSUFFICIENT_EVIDENCE`, `WITHHELD`, `BLOCKED`, or `CONDITIONAL` enum states when constitutional rules require them.
- Halt execution and log a structured failure when an invariant is violated.

## 1.3 What the Execution Engine MAY NEVER Do

- Invent signals, pathways, causes, recommendations, narratives, or confidence values.
- Recompute, smooth, round, or override values produced by an upstream stage.
- Skip, reorder, or re-enter pipeline stages.
- Permit a downstream stage to mutate an upstream stage's output.
- Generate free-text outside template projection as governed by the Explanation Engine.
- Emit an artifact lacking source pointers.
- Emit an artifact lacking a Trust Layer confidence binding.
- Emit a monitoring trend verdict authored anywhere other than S5.
- Persist any output that has not passed all applicable validators.
- Continue execution after a hard-fail invariant violation.

## 1.4 Determinism Guarantees

REES is **strictly deterministic** as a pure function:

```
REES(patientCase, registryVersions, engineVersions, configHash, seed) → (output, executionTrace, validationMatrix, auditPackage)
```

Two invocations with identical inputs MUST produce byte-identical outputs across every artifact (output, trace, validation matrix, audit package). No wall-clock dependence, no network I/O during execution, no uncontrolled randomness, no hardware-dependent floating-point divergence (IEEE-754 double, round-half-to-even, ordered reductions).

## 1.5 Versioning Guarantees

- Every artifact carries the semver and content hash of every registry and engine that contributed to it.
- Version sets are pinned at execution start and immutable for the lifetime of the execution.
- A version mismatch detected mid-execution is a `NON_RECOVERABLE_FAIL` (Section 8).
- Reports generated under different version sets are non-comparable for monitoring purposes unless cross-version compatibility is explicitly declared by the Trust Layer governance.

## 1.6 Replayability Guarantees

Every execution emits a **Replay Package** (Section 9.4) sufficient to regenerate the execution byte-for-byte. Replay is the canonical method of audit verification. A HairOS output that cannot be replayed from its Replay Package is, by definition, invalid and MUST be revoked.

---

# SECTION 2 — RUNTIME TOPOLOGY

REES is composed of ten components arranged in a strict acyclic execution graph. The graph is enforced by the runtime; it is not advisory.

```
                   ┌─────────────────────┐
                   │   Intake Parser     │
                   └──────────┬──────────┘
                              │ CanonicalCase
                              ▼
                   ┌─────────────────────┐
                   │   Signal Engine     │ ◀──── Signal Registry v1
                   └──────────┬──────────┘
                              │ SignalSet
                              ▼
                   ┌─────────────────────┐
                   │   Pathway Engine    │ ◀──── Pathway Model
                   └──────────┬──────────┘
                              │ PathwaySet
                              ▼
                   ┌─────────────────────┐
                   │ Root Cause Engine   │ ◀──── Cause Model
                   └──────────┬──────────┘
                              │ CauseSet (accepted + dissent)
                              ▼
                   ┌─────────────────────┐
                   │ Recommendation Eng. │ ◀──── RDE Constitution
                   └──────────┬──────────┘
                              │ RecommendationSet
                              ▼
                   ┌─────────────────────┐
                   │    Trust Layer      │ ◀──── Trust Layer Model
                   │ (banding, noise,    │
                   │  monitoring verdict)│
                   └──────────┬──────────┘
                              │ TrustEnvelope (sealed)
                              ▼
                   ┌─────────────────────┐
                   │ Explanation Engine  │ ◀──── Explanation & Narrative Engine
                   └──────────┬──────────┘
                              │ ExplanationBlocks (5-axis)
                              ▼
                   ┌─────────────────────┐
                   │    Report Engine    │ ◀──── Report System Specification
                   └──────────┬──────────┘
                              │ Report Payload (patient + doctor)
                              ▼
                   ┌─────────────────────┐
                   │ Validation Engine   │ ◀──── CEH v1 + CEH-CK v1
                   │ (V1 → V5)           │
                   └──────────┬──────────┘
                              │ ValidationMatrix
                              ▼
                   ┌─────────────────────┐
                   │   Audit Logger      │
                   └─────────────────────┘
```

### 2.1 Component Definitions

| Component | Owns | Reads | Writes |
|---|---|---|---|
| Intake Parser | Canonical normalization of patient case | Raw test case | `CanonicalCase` |
| Signal Engine | Signal activation and per-signal confidence | `CanonicalCase`, Signal Registry | `SignalSet` |
| Pathway Engine | Pathway weights and activation/suppression | `SignalSet`, Pathway Model | `PathwaySet` |
| Root Cause Engine | Posterior computation, acceptance, dissent, compositeRule | `PathwaySet`, `SignalSet`, Cause Model | `CauseSet` |
| Recommendation Engine | Capability emission, contraindication evaluation, whyNot population | `CauseSet`, Patient profile, RDE Constitution | `RecommendationSet` |
| Trust Layer | Confidence bands, noise floor, monitoring verdict enum, sealed envelope | All upstream | `TrustEnvelope` |
| Explanation Engine | Template-only projection of 5-axis blocks | All upstream + `TrustEnvelope` | `ExplanationBlocks` |
| Report Engine | Patient + Doctor view assembly via projection | All upstream + `TrustEnvelope` + `ExplanationBlocks` | `ReportPayload` |
| Validation Engine | V1–V5, scoring, BLOCK/ISSUE decision | All upstream artifacts | `ValidationMatrix` |
| Audit Logger | Trace persistence, replay package assembly, hash certification | All upstream artifacts | `AuditPackage` |

### 2.2 Edge Discipline

- Edges in the topology are typed channels carrying immutable artifacts.
- A downstream component receives a **read-only reference** to upstream artifacts.
- Any attempt by a downstream component to mutate an upstream artifact is a runtime invariant violation (RI-006, Section 5).

---

# SECTION 3 — CANONICAL RUNTIME DATA STRUCTURES

All runtime objects are immutable after emission by their owning component. All carry source pointers and version pointers.

## 3.1 Signal

```
Signal {
  id:                SIGNAL_ID                    // immutable
  definitionRef:     SignalRegistryRef@version    // immutable, source pointer
  activatedBy:       List<InputFieldRef>          // immutable, source pointer
  confidence:        Float [0.0, 1.0]             // immutable
  qualityScore:      Float [0.0, 1.0] | null      // immutable
  emittedBy:         StageId = S1                 // immutable
  emittedAt:         ExecutionTick                // immutable
}
```

## 3.2 Pathway

```
Pathway {
  id:                PATHWAY_ID                   // immutable
  definitionRef:     PathwayModelRef@version      // immutable
  weight:            Float [0.0, +∞)              // immutable
  activationState:   {ACTIVATED, INDETERMINATE, SUPPRESSED}  // immutable
  contributingSignals: List<{SignalId, weight, confidence}>  // immutable, source pointers
  emittedBy:         StageId = S2                 // immutable
}
```

## 3.3 Cause

```
Cause {
  id:                CAUSE_ID                     // immutable
  definitionRef:     CauseModelRef@version        // immutable
  prior:             Float                        // immutable
  posterior:         Float [0.0, 1.0]             // immutable
  acceptanceState:   {ACCEPTED_PRIMARY, ACCEPTED_COMPOSITE, REJECTED, INSUFFICIENT}  // immutable
  pathwayRefs:       List<PathwayId>              // immutable, source pointers
  signalRefs:        List<SignalId>               // immutable, source pointers
  exclusionsTriggered: List<SignalId>             // immutable
  compositeRuleTrace: CompositeTrace | null       // immutable
  dissentFlag:       Boolean                      // immutable
  emittedBy:         StageId = S3                 // immutable
}
```

## 3.4 Recommendation

```
Recommendation {
  id:                RECOMMENDATION_ID            // immutable
  causeRefs:         List<CauseId>  [non-empty]   // immutable, source pointers (PRECONDITION)
  objective:         ObjectiveEnum                // immutable (PRECONDITION)
  capabilityRef:     CapabilityId                 // immutable (PRECONDITION)
  intervention:      InterventionId               // immutable
  status:            {EMITTED, CONDITIONAL, WITHHELD, BLOCKED}  // immutable
  contraindications: List<{type, severity, reason}>  // immutable
  whyNotSet:         List<{alternative, reason}> [non-empty if alternatives exist]  // immutable
  monitoringSignals: List<SignalId>               // immutable
  emittedBy:         StageId = S4                 // immutable
}
```

## 3.5 ConfidenceBand

```
ConfidenceBand {
  bindsTo:           ArtifactRef                  // immutable
  c:                 Float [0.0, 1.0]             // immutable
  band:              {HIGH, MODERATE, PROVISIONAL, INSUFFICIENT}  // immutable
  derivedFrom:       {signalStrength, pathwayCoherence, posteriorEntropy}  // immutable inputs
  formulaVersion:    TrustLayerRef@version        // immutable
  ownedBy:           StageId = S5                 // immutable, SOLE OWNER
}
```

## 3.6 ExplanationBlock

```
ExplanationBlock {
  bindsTo:           ArtifactRef                  // immutable
  why:               TemplateProjection           // immutable, source: rule
  whyNot:            List<TemplateProjection>     // immutable, source: alternatives rule
  evidence:          List<UpstreamId>             // immutable, source pointers
  confidenceRef:     ConfidenceBandRef            // immutable, POINTER ONLY (no copy of value)
  changeTriggers:    List<SignalDeltaTrigger>    // immutable, source pointers
  templateVersion:   ExplanationEngineRef@version // immutable
  emittedBy:         StageId = S6                 // immutable
}
```

## 3.7 MonitoringVerdict

```
MonitoringVerdict {
  enum:              {STABLE, IMPROVEMENT, PROGRESSION, MIXED, LOSS_OF_RESPONSE, ESCALATION, INSUFFICIENT_BASELINE, BASELINE_ESTABLISHED}  // immutable
  perSignalDeltas:   List<{SignalId, delta, noiseBand, classification}>  // immutable
  baselineRef:       ReportContentHash | null     // immutable
  ownedBy:           StageId = S5                 // immutable, SOLE OWNER
}
```

## 3.8 ExecutionTrace

```
ExecutionTrace {
  executionId:       UUIDv4                       // immutable
  inputHash:         SHA-256(CanonicalCase)       // immutable
  versionManifest:   Map<ComponentId, Semver+Hash>  // immutable
  configHash:        SHA-256(Config)              // immutable
  seed:              UInt64                       // immutable
  stages:            Ordered List<StageRecord>    // immutable
  startedAt:         MonotonicTimestamp           // immutable
  completedAt:       MonotonicTimestamp           // immutable
  status:            {COMPLETED, HALTED, BLOCKED} // immutable
}

StageRecord {
  stage:             StageId
  inputs:            List<ArtifactRef>
  outputs:           List<ArtifactRef>
  operationsLog:     List<OperationRecord>
  durationTicks:     UInt64
}
```

## 3.9 AuditEvent

```
AuditEvent {
  eventId:           UUIDv4                       // immutable
  executionId:       UUIDv4                       // immutable
  type:              {STAGE_ENTRY, STAGE_EXIT, INVARIANT_CHECK, VALIDATOR_RESULT, BLOCK_DECISION, EMISSION, REVOCATION}  // immutable
  payload:           StructuredPayload            // immutable
  artifactHash:      SHA-256                      // immutable
  occurredAt:        MonotonicTimestamp           // immutable
}
```

---

# SECTION 4 — EXECUTION LIFECYCLE

Execution order is fixed: **S1 → S2 → S3 → S4 → S5 → S6 → S7**. Validators run after S7 in fixed order: **V1 → V2 → V3 → V4 → V5**. There is no parallelism across stages. Within a stage, parallelism is permitted only if it produces byte-identical results to serial execution.

For each stage:

## 4.1 S1 — Signal Engine

- **Inputs:** `CanonicalCase`, Signal Registry @ pinned version.
- **Outputs:** `SignalSet`.
- **Allowed:** Activation evaluation per registry rules; per-signal confidence via registry primitives; conflict resolution per registry EXCLUDES.
- **Forbidden:** Inferring signals not declared in the registry; combining intake and image to create derived signals beyond declared DERIVED_* primitives.
- **Failure Conditions:** Registry version unavailable; input field missing required for an activation rule (treated as condition false, never as inferred true).
- **Rollback:** Halt; emit `HARD_FAIL` (Section 8); no downstream stage runs.

## 4.2 S2 — Pathway Engine

- **Inputs:** `SignalSet`, Pathway Model @ pinned version.
- **Outputs:** `PathwaySet`.
- **Allowed:** Weighted sum per adjacency matrix; threshold classification.
- **Forbidden:** Adjusting weights; renaming pathways; emitting a pathway not in the model.
- **Failure Conditions:** Adjacency matrix references a signal not in the registry version.
- **Rollback:** Halt; `HARD_FAIL`.

## 4.3 S3 — Root Cause Engine

- **Inputs:** `PathwaySet`, `SignalSet`, Cause Model @ pinned version.
- **Outputs:** `CauseSet` (accepted, rejected, insufficient) + dissent flags + compositeRule traces.
- **Allowed:** Eligibility filtering; unnormalized score per CEH-CK §3; softmax normalization; acceptance per thresholds.
- **Forbidden:** Accepting a cause whose required pathways are not activated; suppressing the dissent flag when the top-1/top-2 margin is below the threshold; collapsing co-accepted composite causes.
- **Failure Conditions:** Posterior distribution sums to a value outside `[1.0 − ε, 1.0 + ε]` with ε = 1e-9.
- **Rollback:** Halt; `HARD_FAIL`.

## 4.4 S4 — Recommendation Engine

- **Inputs:** `CauseSet`, patient profile, RDE Constitution @ pinned version.
- **Outputs:** `RecommendationSet`.
- **Allowed:** Capability emission per cause→capability table; contraindication evaluation; whyNot enumeration; status assignment.
- **Forbidden:** Emitting a recommendation without `causeRefs`, `objective`, or `capabilityRef`; emitting a recommendation referencing a cause not in `acceptedCauses`; suppressing a hard contraindication.
- **Failure Conditions:** Any precondition fails at emission → recommendation `BLOCKED` at S4 boundary; if any required capability mapping is missing for an accepted cause → `HARD_FAIL`.
- **Rollback:** Individual recommendation `BLOCKED` does not halt execution; missing capability mapping does.

## 4.5 S5 — Trust Layer

- **Inputs:** All upstream artifacts.
- **Outputs:** `TrustEnvelope` containing: ConfidenceBands for every output, noise floor map, monitoring verdict enum (if applicable), report-eligibility flags.
- **Allowed:** Computing C per the trust formula; banding per fixed thresholds; deriving monitoring verdict per noise floor rules; sealing the envelope (content hash).
- **Forbidden:** Modifying any upstream artifact; permitting any downstream stage to author confidence values; emitting bands for outputs not present upstream.
- **Failure Conditions:** Monotonicity invariant violated (recommendation C > min cause C); sealed envelope hash unverifiable.
- **Rollback:** Halt; `HARD_FAIL`. Trust Layer failure is non-recoverable because all downstream stages are pointer-bound to S5.

## 4.6 S6 — Explanation Engine

- **Inputs:** All upstream artifacts + `TrustEnvelope`.
- **Outputs:** `ExplanationBlocks` — one per major output, each with five axes.
- **Allowed:** Template projection from approved lexicon; enumeration of alternatives and reasons; source pointer assembly.
- **Forbidden:** Free-text generation; authoring confidence values; computing trend verdicts; rewording RDE recommendations.
- **Failure Conditions:** Any axis unbound for any major output.
- **Rollback:** Block emission of the affected output; downstream Report Engine omits it; Validation Engine surfaces V5 failure.

## 4.7 S7 — Report Engine

- **Inputs:** All upstream artifacts + `TrustEnvelope` + `ExplanationBlocks`.
- **Outputs:** `ReportPayload` containing patient view and doctor view, in the section sequence mandated by the Report System Specification.
- **Allowed:** Strict projection of upstream fields into report sections via approved templates; section ordering enforcement.
- **Forbidden:** Authoring content; reordering, suppressing, or duplicating sections; recomputing or rebanding confidence; reinterpreting monitoring verdicts; embedding images that have not passed validation.
- **Failure Conditions:** Section sole-source binding broken; sealed-channel hash mismatch (S5.banding ≠ S7.banding); monitoring narrative contradicts verdict enum.
- **Rollback:** Block emission; surface to Validation Engine as the originating validator failure.

## 4.8 V1 → V5 — Validation Engine

- Runs in fixed order. Any FAIL is surfaced with its minimal failing set.
- Scoring: start 100; −20 per failed validator; score < 80 → BLOCK ISSUANCE.
- Cascading failures (Section 5, RI-014) are tagged but only the root validator's deduction is applied; cascades are reported for transparency.

---

# SECTION 5 — RUNTIME INVARIANTS

Every invariant is enforced at runtime. Violations are not warnings; they are halt conditions or block conditions per the listed failure response.

| ID | Rule | Detection Method | Failure Response |
|---|---|---|---|
| RI-001 | Stage execution order is exactly S1 → S2 → S3 → S4 → S5 → S6 → S7. | ExecutionTrace stage sequence equality check. | `HARD_FAIL`, halt. |
| RI-002 | No stage re-entry within a single execution. | StageId multiset count in trace. | `HARD_FAIL`, halt. |
| RI-003 | No stage skipped. | Trace covers every stage exactly once. | `HARD_FAIL`, halt. |
| RI-004 | Every emitted output carries source pointers to upstream artifacts. | Artifact schema validation. | V1 FAIL → BLOCK. |
| RI-005 | No orphan outputs (artifact whose source pointer set is empty when non-empty is required). | Per-stage emission preconditions. | BLOCK at owning stage. |
| RI-006 | Downstream stages may not mutate upstream artifacts. | Immutability check on artifact hashes pre- and post-stage. | `HARD_FAIL`, halt. |
| RI-007 | Confidence values are emitted only by S5. | Field provenance check: `ConfidenceBand.ownedBy == S5`. | V2 FAIL → BLOCK. |
| RI-008 | Monitoring verdict enum is emitted only by S5. | Field provenance check: `MonitoringVerdict.ownedBy == S5`. | V4 FAIL → BLOCK. |
| RI-009 | Sealed channel: `hash(S5.bandingMap) == hash(bandingMap referenced in S7)`. | Hash comparison at S7 emission. | V2 FAIL → BLOCK. |
| RI-010 | Recommendation monotonicity: `C(rec) ≤ min(C(c) for c in rec.causeRefs)`. | Numeric comparison at S5 emission. | V2 FAIL → BLOCK. |
| RI-011 | Every recommendation carries non-empty `causeRefs`, `objective`, `capabilityRef`, `whyNotSet` (when alternatives exist). | S4 emission preconditions. | BLOCK at S4. |
| RI-012 | Every major output has a 5-axis Explanation block with all axes bound. | S6 emission preconditions. | V5 FAIL → BLOCK. |
| RI-013 | No improvement / progression / loss-of-response claim within noise band. | S5 verdict derivation; S7 verdict rendering; cross-check. | V4 FAIL → BLOCK. |
| RI-014 | Cascading failures are tagged; primary deduction attributed to root validator only. | Validation Engine dependency graph. | Tag only; no double penalty. |
| RI-015 | No silent defaults. Any field requiring a value MUST be set explicitly or marked `INSUFFICIENT_EVIDENCE`. | Schema validation: `null` only where explicitly permitted. | `HARD_FAIL` or BLOCK per field. |
| RI-016 | No hidden inference. Any output not produced by a constitutional rule is forbidden. | Stage-level provenance assertion. | `HARD_FAIL`. |
| RI-017 | No skipped validators. V1–V5 all execute (V4 may return N/A only for non-monitoring cases). | Validation Engine execution log. | `HARD_FAIL`. |
| RI-018 | Version manifest is pinned at execution start and immutable for the execution lifetime. | Version manifest hash check at each stage entry. | `NON_RECOVERABLE_FAIL`. |
| RI-019 | Dissent flag, once set by S3, is immutable downstream. | Artifact immutability check. | `HARD_FAIL`. |
| RI-020 | An artifact failing emission preconditions is BLOCKED at the owning stage; downstream stages do not see it. | Stage-output filter. | BLOCK at owning stage. |

---

# SECTION 6 — STATE MANAGEMENT MODEL

## 6.1 Stateless Execution (Default)

A baseline (first-encounter) execution is stateless. Inputs are the `CanonicalCase` and the pinned version manifest. No prior report is consumed. The Validation Engine sets V4 = `N/A`.

## 6.2 Monitoring Execution

A monitoring execution consumes:

- The current `CanonicalCase`.
- A pinned reference to a prior report's Replay Package (the **baseline pointer**).
- The version manifest that produced the baseline.

The Trust Layer computes per-signal deltas against the baseline and derives the monitoring verdict enum.

## 6.3 Baseline Version Pinning

A monitoring execution MUST verify that the baseline's version manifest is compatible with the current execution's version manifest. Compatibility is declared explicitly by Trust Layer governance via a `versionCompatibilityMatrix`. Compatibility is binary; partial compatibility is not permitted.

- Compatible → monitoring verdict computed normally.
- Incompatible → `MonitoringVerdict.enum = INSUFFICIENT_BASELINE`; no trend claims rendered; reassessment must be re-baselined.

## 6.4 Historical Comparison Rules

- Comparisons may only span Replay Packages, never raw stored reports.
- Aggregate trajectory across more than two cycles is permitted only if every intermediate cycle is itself version-compatible with the endpoints.
- A reassessment that re-derives the full pipeline does not inherit prior conclusions; it re-emits them from current evidence (per Report Spec §2.4).

## 6.5 Audit Retention Requirements

- Every Replay Package is retained for the platform's declared retention period (set by governance, not by REES).
- Replay Packages are immutable. Mutating storage is a `NON_RECOVERABLE_FAIL` for the affected execution.
- A revoked report (Section 8) is marked revoked but never deleted; revocation is itself an `AuditEvent`.

---

# SECTION 7 — TRUST LAYER ENFORCEMENT

## 7.1 Confidence Ownership

The Trust Layer (S5) is the **sole owner** of confidence values. No other component computes, transforms, smooths, rounds, or overrides a confidence value. Downstream components hold **pointers** to `ConfidenceBand` objects; they never hold copies of the numeric `C` or band enum.

## 7.2 Band Ownership

The same rule applies to bands. The mapping from `C` to `{HIGH, MODERATE, PROVISIONAL, INSUFFICIENT}` is computed once, at S5 emission, and is immutable thereafter.

## 7.3 Noise Floor Ownership

The noise floor parameter set is fixed by the CEH-CK v1 noise floor model. The Trust Layer (S5) applies it during monitoring executions. No other component reads the raw noise floor table; downstream components read only the derived `MonitoringVerdict.enum`.

## 7.4 Sealed Channel Implementation

The `TrustEnvelope` is sealed at S5 emission:

```
TrustEnvelope.sealHash = SHA-256(canonicalize(TrustEnvelope.contents))
```

Every downstream stage that consumes the envelope verifies the seal at stage entry. A failed verification is RI-009 / `HARD_FAIL`. The Report Engine (S7) MUST embed the seal hash into the report's Audit Footer; the Audit Logger MUST persist it.

## 7.5 Hash Verification Model

- Each stage's output is hashed at emission. The hash is recorded in the `ExecutionTrace`.
- Each consumer stage verifies the hash of every artifact it reads at entry.
- A hash mismatch is `NON_RECOVERABLE_FAIL`; the execution halts and the artifact is quarantined.

## 7.6 Why S7 Cannot Alter S5 Outputs

Three independent enforcement layers prevent S7 from altering S5 outputs:

1. **Schema:** S7 receives `ConfidenceBandRef` (pointer), not `ConfidenceBand` (value).
2. **Sealing:** Any structural change to `TrustEnvelope` breaks the seal.
3. **Validation:** V2 cross-checks every confidence rendered in the report against the `TrustEnvelope`'s banding map and FAILs on any divergence.

A successful tampering would require simultaneously defeating all three. The architecture treats single-layer defeat as a compromise event, not a bug.

---

# SECTION 8 — RUNTIME FAILURE HANDLING

REES distinguishes failure classes precisely. Each class has a fixed runtime action.

| Class | Definition | Runtime Action |
|---|---|---|
| **Hard Fail** | Constitutional invariant violated mid-execution; further execution is unsafe. | Halt immediately. Emit `ExecutionTrace.status = HALTED`. No outputs emitted. Audit event recorded. |
| **Soft Fail** | A single artifact fails an emission precondition but does not invalidate the execution. | Block the artifact. Continue execution. Emit `BLOCKED` status on the artifact. |
| **Recoverable Fail** | Transient I/O or storage error in audit/persistence layer. | Retry per declared policy (idempotent retries only). Persist failure event. If retries exhausted → `NON_RECOVERABLE_FAIL`. |
| **Non-Recoverable Fail** | Version mismatch, hash mismatch, storage corruption, or audit-logger failure. | Halt. Quarantine all in-flight artifacts. Mark execution `HALTED`. Notify governance via audit event. |
| **Constitution Violation** | A constitutional rule is violated (e.g., orphan recommendation, fabricated confidence). | Map to the responsible invariant ID (RI-XXX). Apply that invariant's failure response. |
| **Validator Failure** | V1–V5 detect a violation in the assembled outputs. | Apply scoring deduction. If score < 80 → BLOCK ISSUANCE. Persist `ValidationMatrix`. |
| **Version Mismatch** | Any pinned component version diverges from the manifest mid-execution. | `NON_RECOVERABLE_FAIL`. |
| **Insufficient Evidence** | No cause posterior ≥ acceptance threshold, OR all confidence bands at `INSUFFICIENT`. | Not a failure. Emit explicit `INSUFFICIENT_EVIDENCE` enums per spec. Audit Report only; no patient/doctor report. |

### 8.1 Revocation

If a previously emitted report is later found to have been generated under a compromised version set (e.g., a registry hash was tampered with), governance MAY revoke the report. Revocation is an `AuditEvent`; the report payload is retained, marked revoked, and excluded from monitoring baseline pools.

---

# SECTION 9 — AUDIT ARCHITECTURE

## 9.1 Execution Trace

A complete, ordered, immutable log of every stage entry, stage exit, artifact emission, hash, and invariant check.

## 9.2 Audit Event

Discrete events recorded outside the per-stage trace: BLOCK decisions, validator results, revocations, governance overrides. Audit events reference `executionId` and carry independent `eventId`.

## 9.3 Validation Result

The `ValidationMatrix` plus the minimal failing set per validator. Includes cascading-failure attribution graph.

## 9.4 Replay Package

```
ReplayPackage {
  executionId:      UUIDv4
  canonicalCase:    CanonicalCase                 // exact input
  versionManifest:  Map<ComponentId, Semver+Hash> // pinned versions
  configHash:       SHA-256(Config)
  seed:             UInt64
  baselineRef:      ReplayPackageRef | null       // for monitoring executions
  expectedOutputs:  Map<ArtifactRef, SHA-256>     // emission hash map
  packageHash:      SHA-256(canonicalize(self))
}
```

A successful replay produces every artifact with matching hashes. A divergent replay invalidates the original output.

## 9.5 Regulatory Review Package

A superset of the Replay Package, including:

- The full `ExecutionTrace`.
- All `AuditEvents`.
- The `ValidationMatrix`.
- The emitted `ReportPayload` (patient + doctor + audit views).
- The `TrustEnvelope` (sealed).
- The signed `versionManifest`.

## 9.6 Complete Provenance Chain

For any single statement in any emitted report, the audit chain traces:

```
Statement → Report section → Explanation block → Source artifact → Stage record →
Inputs → Upstream artifacts → ... → CanonicalCase → Replay Package → Version manifest
```

A statement that cannot be resolved through this chain is, by construction, impossible in REES. If observed, it is a runtime compromise event.

---

# SECTION 10 — DEPLOYMENT READINESS GATES

These gates are **architectural readiness gates**, not regulatory gates. Each is binary; partial readiness does not promote.

## 10.1 Research Ready

All required to be true:

- All ten REES components implemented per Section 2.
- All canonical data structures emitted per Section 3.
- Stage order enforced per Section 4.
- RI-001 through RI-006 enforced.
- Replay Package emitted and round-trip-verifiable on synthetic cases.
- CEH v1 runs end-to-end on the published sample set with deterministic outputs.

## 10.2 Internal Clinical Review Ready

Adds to Research Ready:

- RI-007 through RI-020 all enforced.
- V1–V5 fully implemented with cascading-failure attribution (RI-014).
- Sealed channel (RI-009) verified across at least 1000 synthetic executions.
- Monitoring executions implemented with baseline version pinning (Section 6.3).
- Doctor view + patient view both project from identical canonical payload (verified by hash equality on shared fields).
- Cause Model dissent flag (RI-019) demonstrated immutable across all stages.

## 10.3 Pilot Ready

Adds to Internal Clinical Review Ready:

- Constitution-coverage parity: every constitutional rule in the source documents has at least one CEH self-test case with `injectedFaults` that the harness detects.
- Replay verification automated on every emitted report; divergent replay triggers automatic revocation.
- Governance workflow implemented for revocation events.
- Audit retention enforced with immutable storage.
- Version compatibility matrix (Section 6.3) declared and enforced.
- INSUFFICIENT_EVIDENCE and INSUFFICIENT_BASELINE paths exercised end-to-end with full report omission semantics.

## 10.4 Production Candidate

Adds to Pilot Ready:

- Zero open `FAIL DESIGN` items from CEH-CK §fail_design for in-scope behavior.
- Sustained zero V1/V2/V3 validator failures across the entire pilot dataset.
- Sustained zero RI-006 / RI-007 / RI-009 / RI-010 violations across the entire pilot dataset.
- Cross-version replay verified for every supported version-compatibility pair.
- Full Regulatory Review Package emitted for every report and stored immutably.
- Independent architecture review completed by a party not involved in REES authorship, with findings closed or formally accepted.

---

# SECTION 11 — ARCHITECTURAL WEAKNESS REVIEW

This section is a brutal review of the existing constitutional ecosystem. Each item is a real architectural risk to deterministic execution. Items are framed as gaps to close, not as criticisms of intent.

## 11.1 Implementation Gaps

**G-01. Image-derived severity is presence-only.** CEH-CK FD-002 explicitly defers severity grading. Today, REES cannot distinguish a faint frontal miniaturization from a marked one based on `imageDescriptors`. Findings render as binary in the report — a clinically thin signal. **Gap impact:** Trust Layer confidence is squeezed against a low ceiling; recommendation strength loses gradation.

**G-02. No declared version-compatibility matrix.** Section 6.3 requires a `versionCompatibilityMatrix` for monitoring executions, but no constitutional document defines it. Until declared, every monitoring execution across a version bump degrades to `INSUFFICIENT_BASELINE`. **Gap impact:** Real-world monitoring trajectories will fragment at every registry upgrade.

**G-03. Approved lexicon for Explanation templates is referenced but not enumerated.** The Explanation & Narrative Engine spec references an "approved lexicon"; no canonical list is bound. REES requires this list to enforce RI-012 deterministically. **Gap impact:** S6 outputs are not fully reproducible across implementers.

**G-04. RDE objective enum is implicit.** The RDE Constitution defines objectives via examples (HALT_MINIATURIZATION, etc.). REES requires a closed enum. CEH-CK §4 enumerates a working set, but no constitutional document declares it canonical. **Gap impact:** Any implementer can extend the objective set silently.

**G-05. Baseline reference scheme is unspecified.** Section 6.2 requires a baseline pointer (`ReportContentHash`), but no constitutional document defines how baselines are selected, anchored, or refreshed. **Gap impact:** Monitoring is half-defined.

## 11.2 Ambiguity Risks

**A-01. "Major output" is referenced across CEH v1, CEH-CK v1, REES, and the Explanation Engine, but its enumeration is implicit.** REES treats it as: every finding, every accepted cause, every emitted/conditional recommendation, every monitoring verdict. This works, but it should be canonized in one place.

**A-02. Composite cause acceptance thresholds appear in CEH-CK §3 (margin ≤ 0.40, posterior ≥ 0.20).** The Root Cause Engine document is the constitutional source; until that document mirrors these thresholds verbatim, the two will drift. **Risk:** silent divergence.

**A-03. "Patient-safe" vs. "doctor-only" image classification is referenced in the Report Spec but not defined.** REES has no rule to apply.

## 11.3 Determinism Risks

**D-01. Floating-point reductions over signal/pathway sets must be order-stable.** No constitutional document mandates ordered reduction or a canonical iteration order. REES declares it; the registries should mirror it (e.g., sort by SIGNAL_ID lexicographically before summation).

**D-02. Image quality scores are floats supplied by external pipelines.** Without canonical quantization, two pipelines feeding the same image may emit different `qualityScore` values, producing different `SignalSet` outputs. **Risk:** input-side non-determinism imported into REES.

**D-03. Softmax in S3 can amplify tiny floating-point differences near acceptance thresholds.** REES should freeze the softmax implementation (which library, which numerical guard) at the platform level, not at the implementer level.

## 11.4 Scalability Risks

**S-01. Replay Packages embed full input + full output hashes.** At pilot scale this is fine. At population scale, blob storage costs and replay-verification batch latency must be modeled. REES does not currently bound per-execution storage.

**S-02. Cross-version replay (Section 10.4) requires retaining every prior registry version permanently.** The retention model is not declared.

**S-03. Validation Engine cascading-failure graph is potentially quadratic in artifact count for deeply linked outputs.** REES does not bound this; a pathological case (large cause set with deep composite traces) could degrade.

## 11.5 Auditability Risks

**AU-01. Audit Logger sits at the end of the topology.** If the Audit Logger itself fails, the execution loses provenance for outputs already emitted upstream. REES classifies this as `NON_RECOVERABLE_FAIL`, but the architecture would be stronger if audit events were streamed during execution, not batched at the end.

**AU-02. Revocation governance is referenced but not specified.** Section 8.1 says governance "MAY revoke"; the criteria, authority, and notification model are out of scope. **Risk:** revocation becomes ad hoc.

**AU-03. Constitutional documents do not yet declare their own content hashes.** Until they do, the `versionManifest` cannot fully bind to the canonical text — only to the implementer's copy of the canonical text.

## 11.6 Hidden Assumptions

**H-01. The 10 canonical causes are assumed sufficient.** CEH-CK fixes them; REES inherits them. The Knowledge Model should explicitly affirm that no clinical case requires a cause outside this set, or define an `OTHER_REFERRAL` escape hatch.

**H-02. Patient profile fields are assumed available and accurate.** No invariant addresses input integrity (e.g., contradictory intake answers, image-of-record verification). Garbage-in determinism is still garbage-out.

**H-03. The pipeline is assumed serial across stages and parallel within.** REES permits within-stage parallelism only if byte-identical to serial. Implementers will be tempted to parallelize across stages for latency; the architecture must remain hostile to that temptation.

**H-04. Contraindication attributes (pregnancy, hepatic impairment, etc.) are assumed structured in the patient profile.** The Intake Parser must enforce a closed contraindication-attribute schema; today this is implicit.

---

# SECTION 12 — FUTURE ENGINE ROADMAP

Scope-bounded. No speculative features. Each future version exists to close a specific gap REES v1 cannot close without breaking determinism.

## 12.1 REES v2 — Severity-Graded Image Pipeline

**Trigger:** Closure of G-01 and D-02.

**Adds:** Quantitative severity grading from validated image-pipeline outputs (density fraction, miniaturization ratio, hair-shaft caliber distribution). Severity tiers become first-class signals. Trust Layer confidence ceilings rise.

**Does not add:** New causes, new pathways, new recommendations. The intelligence layer is unchanged; only the input fidelity improves.

**Architectural change:** A versioned `ImageEvidence` artifact enters S1 inputs alongside `CanonicalCase`. Its hash participates in the Replay Package.

## 12.2 REES v3 — Cross-Version Continuity

**Trigger:** Closure of G-02 and S-02.

**Adds:** A declared `versionCompatibilityMatrix` and a `BaselineMigrator` component that re-projects historical baselines into the current version's signal/cause/pathway space when compatibility is partial (under explicit governance approval).

**Does not add:** Speculative compatibility. Migrations are pinned, versioned, and themselves replayable.

**Architectural change:** The `MonitoringVerdict` enum gains `MIGRATED_BASELINE`; trend rendering carries a migration provenance pointer.

---

# REMAINING ARCHITECTURAL GAPS PREVENTING FULL EXECUTABILITY

REES v1 is implementation-ready **except** for the following items, which require constitutional action before HairOS can be declared a fully executable deterministic clinical intelligence system:

1. **G-02 — versionCompatibilityMatrix** must be declared by Trust Layer governance.
2. **G-03 — Approved Explanation lexicon** must be enumerated as a versioned registry.
3. **G-04 — RDE objective enum** must be promoted from CEH-CK working set to RDE constitutional declaration.
4. **G-05 — Baseline reference scheme** must be specified (selection, anchoring, refresh).
5. **A-01 — "Major output" enumeration** must be canonized in one constitutional document and referenced by all others.
6. **A-02 — Composite acceptance thresholds** must be mirrored from CEH-CK into the Root Cause Engine document verbatim.
7. **A-03 — Image classification (patient-safe / doctor-only)** must be defined.
8. **D-01 — Canonical iteration order** for floating-point reductions must be declared.
9. **D-03 — Softmax implementation** must be pinned at platform level.
10. **AU-01 — Streaming audit emission** should replace end-of-execution batching.
11. **AU-02 — Revocation governance** must be specified.
12. **AU-03 — Constitutional documents' own content hashes** must be declared and embedded in every Replay Package.
13. **H-01 — Cause-set sufficiency** must be affirmed or an `OTHER_REFERRAL` escape hatch declared.
14. **H-04 — Contraindication-attribute schema** must be closed and bound to the Intake Parser.

Until each of these is closed, REES executes deterministically within its declared envelope but cannot guarantee deterministic equivalence across implementers, across versions, or across the full clinical input distribution. Closing this list converts HairOS from a specification ecosystem into a fully executable deterministic clinical intelligence system.

---

**End of Specification.**

REES v1 is the runtime contract. It does not add features. It makes every existing rule run.
