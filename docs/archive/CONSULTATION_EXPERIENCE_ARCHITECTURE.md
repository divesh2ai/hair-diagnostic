# Consultation Experience Architecture

> How HairOS becomes a dermatologist-grade consultation platform, end to end.

This document defines the experience layer above the clinical brain. It does not change the engines (signal/pathway/cause). It changes what those engines produce, how it is presented, and the contract between the brain and the patient.

---

## 1. The Three Surfaces

HairOS produces clinical reasoning that must reach three distinct audiences. Each surface has its own contract:

| Surface | Audience | Purpose | Voice |
|---|---|---|---|
| **Dashboard** | Patient (in-app) | Daily orientation — "where am I, what's next" | Conversational, glanceable |
| **Patient Report (V3)** | Patient (PDF / printable) | Full consultation, read once, referenced often | Senior dermatologist, mechanistic |
| **Doctor Report (V3)** | Clinician / OPD | One-page clinical handoff | Terse, technical, complete |

The three surfaces share a single underlying **ConsultationModel**. They do not share layout, prose, or labels.

---

## 2. The Consultation Model (Brain → Experience Contract)

The clinical brain produces a `ConsultationModel` — a single, audience-neutral structure that all three surfaces render from. No surface reads engine internals directly.

```
ConsultationModel {
  identity:        { gender, ageBand, lifeStage }
  diagnosis:       { primary, secondary?, severity, progressionRisk, patternClass }
  healthScore:     { value, band, trend? }
  findings:        Finding[5]               // ranked by impact
  drivers:         {
    primary:       Driver[]                 // typically 1-2
    secondary:     Driver[]                 // typically 1-3
    contributing:  Driver[]                 // typically 0-3
  }
  follicleStory:   FollicleNarrative        // condition-specific biology
  roadmap:         RoadmapStep[3]           // priority 1, 2, 3
  protocol:        ProtocolItem[]           // selected for this patient only
  topicalPlan:     TopicalPlan              // scalp-condition-specific
  lifestyle:       LifestyleItem[]          // prescription, not advice
  monitoring:      MonitoringWindow[4]      // M0, M3, M6, M12
  outcomes:        OutcomeWindow[4]         // 30, 90, 180, 365 days
  doctorSummary:   DoctorSummary            // one-page OPD view
  uncertainty:     UncertaintyNote[]        // explicit "we cannot know without X"
}
```

Every field is **derived**. Nothing in this model carries registry IDs, pathway IDs, signal names, enum values, or any other engine internal. The transformation from engine output → `ConsultationModel` is the responsibility of a single **Consultation Composer** layer (see §5).

---

## 3. The Five-Question Anchoring

Every surface is laid out to answer the five questions in order. The patient never has to hunt:

```
Q1 What    ─► [Current Hair Assessment]
Q2 Why     ─► [What We Found] ─► [Root Cause Analysis]
Q3 How     ─► [Understanding Your Hair Loss]
Q4 Do      ─► [Treatment Roadmap] ─► [Protocol] ─► [Topical] ─► [Lifestyle]
Q5 Expect  ─► [Monitoring] ─► [Expected Outcomes]
```

The dashboard collapses this into eight cards (see `DASHBOARD_V3_SPEC.md`). The doctor report collapses it into a single page (see `DOCTOR_REPORT_V3_SPEC.md`).

---

## 4. The Consultation Flow

```
  Intake form
       │
       ▼
  Clinical brain (signals → pathways → causes → diagnosis)
       │
       ▼
  Recommendation engine (protocol, topical, lifestyle selection)
       │
       ▼
  ┌──────────────────────────────────┐
  │   Consultation Composer (NEW)    │  ← single point of truth
  │   engine internals → Model       │
  └──────────────────────────────────┘
       │
       ├──────────► Dashboard renderer  (V3)
       ├──────────► Patient report renderer (V3)
       └──────────► Doctor report renderer (V3)
```

The Composer is the **only** place that knows about engine internals. The three renderers know only about the `ConsultationModel`. This is the structural guarantee that prevents engine leakage into the UI.

---

## 5. The Consultation Composer

A new layer that sits between the engines and the surfaces. Responsibilities:

- **Translate** engine outputs (registry IDs, enums, scores) into patient-facing concepts.
- **Filter** — drop anything the patient should not see (raw scores, internal labels, low-confidence speculations).
- **Condition** — apply gender, severity, and life-stage filters before any narrative is selected.
- **Rank** — collapse N signals/causes into the top 5 findings and top 1–3 drivers by impact.
- **Compose narrative** — assemble condition-specific paragraphs from the narrative library, never falling back to generic copy.
- **Express uncertainty** — surface "we cannot determine X without Y" rather than fabricating confidence.

The Composer is the gate that enforces `NARRATIVE_GOVERNANCE_RULES.md`. If a piece of content cannot pass governance, the Composer refuses to emit it and emits a graceful "this requires additional evaluation" note instead.

---

## 6. Specificity Pipeline

Every narrative selection runs through this pipeline before reaching the model:

```
candidate paragraph
    │
    ├── filter: matches diagnosis?       (else drop)
    ├── filter: matches gender?          (else drop)  ← blocks PCOS-in-male
    ├── filter: matches severity band?   (else drop)
    ├── filter: any required driver present? (else drop)
    ├── filter: any contraindicated driver absent? (else drop)
    │
    ▼
admitted narrative fragment
```

If, after filtering, no candidate remains for a section, the Composer emits an honest minimal version of that section ("Based on your current data, your primary driver is X; additional findings will refine this section as more data is gathered") rather than a generic fallback.

---

## 7. Trust-Layer Guarantees

The architecture enforces, structurally, that the patient surfaces never contain:

- registry IDs, pathway IDs, signal IDs, cause IDs
- raw scores, confidence values, probabilities as numbers
- enum strings (e.g., `CAUSE_AGA_HORMONAL`)
- artifact names (e.g., `pathway_v3_node_42`)
- template variables (e.g., `{{patient.gender}}`)
- words like "engine", "pipeline", "registry", "score", "artifact"

This is enforced by:

1. **Type-level**: `ConsultationModel` field types do not carry IDs or scores.
2. **Composer-level**: explicit allowlist of patient-facing strings.
3. **Render-level**: a final lint pass on the rendered document rejects any string matching a blocklist of internal terms.

See `NARRATIVE_GOVERNANCE_RULES.md` §3 for the full blocklist.

---

## 8. Doctor View vs. Patient View

The doctor receives **more** information, not different information. The same `ConsultationModel` powers both, but the doctor view:

- exposes severity scoring, progression risk numerics
- lists the actual driver mechanisms and contributing causes
- shows monitoring escalation triggers as explicit thresholds
- includes a one-page printable handoff

The doctor view does **not** expose registry/pathway IDs either. Those live in the audit trail and the engineering console, not in any clinician-facing surface.

---

## 9. Acceptance Tests

The architecture is correct when:

- A patient reading the report can answer the five questions out loud.
- A male patient's report contains zero PCOS, menstrual, or pregnancy content.
- A female patient's report does not assume male-pattern framing.
- No patient-facing surface contains any string from the engine blocklist (lint passes clean).
- A dermatologist scanning the doctor page in 60 seconds can write a prescription.
- A patient closes the report knowing the one thing to do this week.

These tests are the gate for shipping V3. See `dermatologist-review-v1/` for the human-evaluation harness.

---

## 10. Out of Scope (for this phase)

- Changes to signal, pathway, or cause engines.
- Changes to the recommendation engine's scoring.
- Changes to ingredient or kit data models.
- Backend persistence changes.

The Composer and the three renderers are the entire surface of change. The brain is preserved.
