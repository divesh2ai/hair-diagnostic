# Signal Registry v1

**Status:** Sprint 1 / Week 1 deliverable. Frozen at v1.0.0.
**Owner:** Clinical Intelligence layer.
**Consumers:** Pathway Activation engine, Cause Ranker, Recovery engine, Objectives engine, Explainability builder. Read-only.
**Position in pipeline:**

```
Answers → Normalizer → [Signal Extraction (this registry)] → Pathways → Causes → Recovery → Objectives
```

This registry is the **single source of truth** for biological observations in HairOS V2. It replaces:

- the descriptive `scoringSignals[]` metadata in `questionnaire.schema.json`,
- the substring helpers in `clinical-engine/signals.ts`,
- the score-emitting logic embedded in `clinical-engine/rules/*.ts`.

The substring helpers and rule modules are retained in legacy paths during the parity migration (Sprint 1 → Sprint 6) and removed when shadow parity is signed off.

---

## Files

| File | Purpose |
|---|---|
| `registry.json` | Canonical signal definitions (~55 signals across 17 categories). |
| `extraction-rules.json` | Declarative answer → signal emission rules. No TypeScript. |
| `categories.json` | Biological category taxonomy. |
| `confidence-model.json` | Noisy-OR aggregation, evidence-tier weighting, reinforcement / penalty constants. |
| `validation-schema.json` | JSON Schema + integrity constraints enforced by registry CI. |
| `README.md` | This document. |

---

## Architectural Commitments

1. **Signals are biological observations only.** Protocol routing, kit injection, and product selection rules from the legacy `scoringSignals[]` metadata are **NOT promoted** to signals. They migrate to Protocol Intelligence registries.
2. **Causes and pathways are not collapsed into signals.** Each signal declares its `pathwayRelevance[]` and `causeRelevance[]` — these are *signals about pathways and causes*, not assertions of cause.
3. **Confidence is governed.** The `confidence-model.json` is the only legitimate source of aggregation arithmetic. Engines may not reimplement noisy-OR or reweight signals.
4. **Evidence tiers propagate.** A `heuristic`-tier signal cannot exceed 0.85 confidence (enforced by IC-7). Pathway `required-gate` signals must be `established` (IC-8).
5. **No clinical conclusion bypasses signals.** Every Pathway, Cause, Recovery output, and Objective in the downstream graph traces back through signals to questionnaire answers.
6. **Language-neutral.** Signal IDs and `narrativeMeaning.clinicalConcept` are language-free concept references. Phrasing is owned by the Narrative layer's PhraseBank.
7. **Legacy traceability preserved.** Every signal that maps to one or more legacy `scoringSignals[]` codes records them in `legacySignalCodes[]` for audit and parity verification — not for runtime use.

---

## Authoring Provenance

Authored from:

- `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json` — 21 questions, ~120 options, ~75 legacy signal codes.
- `src/packages/ai-engine/clinical-engine/rules/{agaRules,hormonalRules,metabolicRules,teRules,lifestyleRules,absoluteLocks}.ts` — runtime scoring and lock logic.
- `DrFACT_Condition_Mapping_Latest Final.xlsx` and `DrFACT_Protocol_Sequencer Final.xlsx` — authoritative seed documents for biology grouping.

Decomposition rule: each legacy `scoringSignals[]` code was classified as:

- **(S)** Genuine biological observation → promoted to a Signal here.
- **(C)** Cause prior weighting → migrates to `registries/causes/priors`.
- **(P)** Protocol routing / kit selection → migrates to Protocol Intelligence (Product Capability Graph, Composition Engine, Eligibility).
- **(N)** Narrative override → migrates to Narrative Intelligence governance.

The `deprecatedLegacyCodesNotPromotedToSignals[]` field in `extraction-rules.json` enumerates all (C), (P), and (N) codes for traceability and explicit non-coverage.

---

## Coverage Summary

- **Signals:** ~55 (covering all 21 question domains).
- **Categories:** 17 (per Sprint 1 Week 1 brief).
- **signalType distribution:** DIRECT, DERIVED, BEHAVIORAL, CLINICAL, SELF_REPORTED — all five types present.
- **Pathway coverage:** all 10 canonical pathways are referenced by ≥ 3 signals each.
- **Cause coverage:** all 10 canonical causes are referenced by ≥ 2 signals each.
- **Evidence tiers:** ~78% `established`, ~17% `emerging`, ~5% `heuristic`.
- **Polarity:** majority `pathological`; `protective` and `modifier` represented for non-pathology baselines and demographics.

---

## Registry CI Gates (enforced by `governance/ci/`)

| Gate | Source | Action |
|---|---|---|
| Schema conformance | `validation-schema.json` | Reject non-conforming registry write |
| ID uniqueness (IC-1) | CI | Reject duplicate `id` |
| No orphan signals (IC-2) | CI | Warn at v1; promote to error at v1.1 once all extraction rules authored |
| Pathway coverage (IC-3) | CI | Reject signal lacking `pathwayRelevance` |
| Cause coverage (IC-4) | CI | Reject signal lacking `causeRelevance` |
| questionId resolves (IC-5) | CI | Reject extraction rule referencing unknown question |
| signalId resolves (IC-6) | CI | Reject extraction rule referencing unknown signal |
| Heuristic vs confidence (IC-7) | CI | Reject heuristic-tier signal at confidence > 0.85 |
| Required-gate tier (IC-8) | CI | Reject heuristic-tier signal as required-gate |
| Conflict symmetry (IC-10) | CI | Reject one-sided conflict declarations |
| Weight direction (IC-11) | CI | Reject negative weight on `supports`, positive weight on `inhibits` |

---

## Sprint 1 Parity Plan

Sprint 1 Week 2–3 builds the Pathway, Cause, Recovery, and Objective engines on top of this registry. Parity is verified by:

1. Running every synthetic patient fixture through both legacy `evaluateClinicalProfile` and V2 orchestrator.
2. Diffing legacy `ClinicalProfile.diagnosis`, `rootCauses`, `severity`, `scalpStates` against V2 outputs projected through `adapters/legacyClinicalProfile`.
3. Acceptance threshold: 100% match on `diagnosis` (under derived adapter) and `severity`; ≥ 95% match on `rootCauses` set (V2 may discover legitimate additional contributing causes — clinically reviewed).

Failures trigger registry revision, **not** engine patches. Engines remain stateless functions over this registry.

---

## Change Discipline

- Any change to `confidence-model.json` parameters or aggregation steps requires a **major version bump** and full parity-fixture regeneration.
- Adding a signal: requires clinical reviewer sign-off + at least one extraction rule + non-zero pathway and cause relevance.
- Removing a signal: requires deprecation mapping (which signal absorbs its responsibility) and snapshot replay verification.
- Renaming a signal `id`: forbidden in v1. Use deprecation + new id + dual emission for one release cycle.
- All registry writes are PR-reviewed and stamped into the `registryVersions` of every produced `PatientReasoningGraph`.

---

## Non-Goals (out of scope for this registry)

- Pathway severity model (lives in `registries/pathways/`).
- Cause priors (Bayesian demographic/age priors live in `registries/causes/priors`).
- Eligibility floors (hard locks like pregnancy and grade 4/5 register signals here AND register Eligibility rules + Recovery floors downstream; the floors themselves live in their own registries).
- Product mapping (Protocol Intelligence).
- Narrative phrasing (Narrative Intelligence PhraseBank).

This registry tells you *what was observed and how confidently*. Nothing more. Everything downstream consumes it; nothing rewrites it.
