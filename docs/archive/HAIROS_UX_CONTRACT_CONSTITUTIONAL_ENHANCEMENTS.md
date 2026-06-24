# HAIROS_UX_CONTRACT_CONSTITUTIONAL_ENHANCEMENTS

**Document Type:** Constitutional Extension to the HairOS UX Contract
**Status:** Authoritative
**Scope:** Deterministic experience architecture only
**Out of Scope:** UI, visual design, components, layout, platform implementation, Figma

**Relationship to Existing Authorities**

This document extends, and does not replace, HAIROS_UX_CONTRACT_SPECIFICATION.md. It remains fully subordinate to and compatible with:

- HAIROS_ARCHITECTURE.md
- HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md
- HAIROS_SIGNAL_REGISTRY_V1.md
- HAIROS_ROOT_CAUSE_ENGINE.md
- HAIROS_CLINICAL_TRUST_LAYER.md
- HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md
- HAIROS_PHASE_5A_REGISTRY_GOVERNANCE_CONSTITUTION.md
- HAIROS_PHASE_5B_REGISTRY_SPECIFICATION_CONSTITUTION.md
- HairOS Canonical Ledger
- 18-Question Intelligence Framework
- HAIROS_UX_CONTRACT_SPECIFICATION.md

**Constitutional Direction (reaffirmed)**

> Clinical Intelligence drives UX. UX never drives Clinical Intelligence.

No enhancement defined herein modifies intelligence logic, registry semantics, decision-engine behavior, the 18-Question Framework, or any clinical threshold. Where this document introduces a new state, it specifies only how the UX **consumes** that state from an intelligence-layer output that is governed elsewhere.

---

## PART I — CLINICAL PRIORITY CONTRACT

### I.1 Purpose

The Clinical Priority Contract governs the ordering and emphasis of information at every UX surface. It introduces no new clinical concept; it binds the UX to consume a priority value attached to each intelligence-layer output.

### I.2 Priority Levels

The UX recognizes exactly three priority levels:

- **Priority 1 — Immediate Attention.** Items requiring clinical action, escalation, contraindication handling, or safety acknowledgement before the patient continues meaningfully.
- **Priority 2 — Near-Term Optimization.** Items material to the treatment plan within the current planning horizon but not requiring immediate action.
- **Priority 3 — Supportive / Optimization.** Items that refine, support, or optimize the plan over time without affecting near-term decisions.

No fourth level may be introduced at the UX layer.

### I.3 Assignment Rules

Priority is assigned by the intelligence layer:

- **Findings:** priority is emitted by the Clinical Intelligence layer in accordance with the Clinical Trust Layer's severity and progression-risk semantics.
- **Root Causes:** priority is inherited from the highest-priority finding the cause explains, capped by the Root Cause Engine's confidence band for that cause.
- **Recommendations:** priority is emitted by the Recommendation Decision Engine and reflects Objective urgency, contraindication interaction, and monitoring posture.
- **Monitoring States:** priority is emitted by the monitoring component and corresponds to the state semantics defined in HAIROS_UX_CONTRACT_SPECIFICATION Part XI.

The UX layer is prohibited from assigning, recomputing, or overriding priority. If a priority value is absent, the UX must treat the item as **Priority 3** and surface a governance flag to Clinical Governance; it may not invent a higher priority.

### I.4 Evidence Requirements

- A **Priority 1** item must be backed by evidence sufficient to meet the Clinical Trust Layer's threshold for action-grade conclusions.
- A **Priority 2** item must be backed by evidence sufficient to meet the Trust Layer's planning-grade threshold.
- A **Priority 3** item must be backed by evidence sufficient to meet the Trust Layer's supportive-grade threshold.

If an item's evidence falls below its assigned priority's threshold at any time, the UX must display the item under the lower priority that its evidence supports, and emit a ledger record of the demotion.

### I.5 Confidence Requirements

- **Priority 1** items must carry confidence in the Trust Layer's highest band.
- **Priority 2** items must carry at least the Trust Layer's planning-grade confidence band.
- **Priority 3** items must carry at least the Trust Layer's supportive-grade confidence band.

Confidence is never hidden to preserve a priority. If confidence drops below the band required for the assigned priority, the UX demotes display priority and records the demotion.

### I.6 Clinician Visibility Requirements

Clinicians see:

- The priority of every item.
- The priority's driver (the specific signal, cause, or Objective producing it).
- Any demotions and their causes.
- The original priority and the displayed priority where they differ.

### I.7 Patient Visibility Requirements

Patients see:

- The priority of every item shown to them, in plain language consistent with the Dr. FACT vocabulary.
- The reason an item is **Priority 1**, in plain language, reachable in one disclosure step.
- The fact that other items exist at lower priority, even when collapsed under cognitive-load rules (see Part IV).

Patients never see raw priority scores, demotion records, or internal driver IDs.

### I.8 Escalation Handling

Where the intelligence layer emits an escalation signal (e.g., escalation monitoring state, contraindication breach, safety-critical RDE flag), the UX must:

- Surface the item at **Priority 1** at every screen on which it is reachable.
- Block advancement through any screen whose continuation would bypass the escalation acknowledgement, except where the existing UX Constitution requires non-blocking presentation (e.g., contraindication beside recommendation).
- Record acknowledgement in the Canonical Ledger.

Escalations may not be batched, deferred, or aggregated.

### I.9 Ties and Conflict Resolution

Where multiple items share priority, ordering is deterministic:

1. Higher confidence band first.
2. Earlier escalation trigger first (if any).
3. Earlier ledger timestamp first.
4. Lower registry ID first (stable tiebreaker).

Conflicts where two intelligence outputs implicitly disagree on priority for the same underlying construct are resolved by the **higher** priority, and a governance flag is emitted; the UX never silently selects the lower.

---

## PART II — BIOLOGICAL NARRATIVE CONTRACT

### II.1 Purpose

The Biological Narrative Contract governs the generation of a single deterministic patient-facing storyline that explains, in plain language, what is happening biologically. It is a derived projection, not an inference.

### II.2 Narrative Inputs (Exclusive)

The narrative may be generated **only** from:

- Accepted findings (Signal Registry + Clinical Intelligence outputs).
- Accepted root causes (Root Cause Engine outputs).
- Accepted recommendations (RDE outputs).
- Current monitoring state.

No other input may enter the narrative — including marketing copy, brand assets, generic dermatology content, or speculative interpretation.

### II.3 Prohibitions

The narrative must never:

- Hallucinate biological mechanisms not present in the Master Knowledge Model.
- Speculate on causes the Root Cause Engine has not accepted.
- Introduce findings the Signal Registry has not produced.
- Introduce recommendations the RDE has not emitted.
- Predict outcomes the intelligence layer has not produced.
- Soften, reframe, or omit Priority 1 information.
- Replace clinical conclusions with motivational content.

### II.4 Narrative Structure

The narrative is deterministic and follows this fixed structure:

1. **Current State** — derived from accepted findings, ordered by Clinical Priority (Part I).
2. **Underlying Drivers** — derived from accepted root causes with their evidence chain.
3. **Plan** — derived from accepted recommendations, with Objective → Capability → Recommendation framing per HAIROS_UX_CONTRACT_SPECIFICATION Part IX.
4. **What We Are Watching** — derived from monitoring state, deltas, and reassessment triggers.

No section may be reordered, omitted, or supplemented at the surface layer.

### II.5 Validation Rules

A narrative is valid only if:

- Every clause maps to a specific intelligence-layer output via registry ID or ledger reference.
- No clause introduces a noun, claim, or mechanism without a backing reference.
- The narrative's confidence treatment is consistent with the underlying outputs (Part II.7).
- Re-generating the narrative from the same ledger entries and registry versions produces a semantically equivalent result.

A narrative failing validation must not be displayed; the UX must instead display the structured findings, causes, recommendations, and monitoring state directly.

### II.6 Evidence Traceability

Each narrative clause must be hyperlinked (within the information-architecture sense, not the UI sense) to:

- The supporting registry IDs (clinician view).
- The plain-language evidence summary (patient view).

Traceability must be reachable in one disclosure step from any clause.

### II.7 Confidence Treatment

- Where the underlying output is in the Trust Layer's highest band, the narrative may use declarative language as governed by the Trust Layer.
- Where the underlying output is in a lower band, the narrative must use the corresponding hedged vocabulary defined by the Trust Layer.
- The narrative is prohibited from using vocabulary that overstates the underlying band.
- Uncertainty in the underlying output must produce uncertainty in the narrative.

### II.8 Patient Version

The patient narrative is:

- Plain language consistent with the Dr. FACT voice.
- Non-alarming, non-promising, non-marketing.
- Constrained by cognitive-load rules (Part IV).
- Subject to all visibility constraints applicable to patients.

### II.9 Clinician Version

The clinician narrative is:

- Registry-linked at every clause.
- Inclusive of dissent summaries from the Root Cause Engine.
- Inclusive of RDE alternative summaries.
- Inclusive of monitoring noise-floor framing.
- Never softened relative to the underlying outputs.

### II.10 Ledger Reconstructability

Given the case's ledger entries and the registry versions active at generation time, the narrative must be reconstructable. The UX must record the narrative's generation event with references to those inputs.

---

## PART III — RECOMMENDATION READINESS CONTRACT

### III.1 Purpose

The Recommendation Readiness Contract governs how the UX exposes the operational readiness of recommendations produced by the RDE. It introduces no new RDE behavior; it specifies how the UX consumes a readiness value attached to each RDE output.

### III.2 Readiness States

The UX recognizes exactly three readiness states:

- **Ready.** The recommendation may be acted upon as-is, within its standard monitoring posture.
- **Ready With Monitoring.** The recommendation may be acted upon, but with explicit additional monitoring obligations beyond the standard posture.
- **Exploratory.** The recommendation is presented for clinical consideration only and may not be enacted without clinician review and explicit approval.

No fourth state may be introduced at the UX layer.

### III.3 Readiness Criteria

Readiness is emitted by the RDE on the basis of:

- The confidence band of the supporting root causes.
- The confidence band of the supporting findings.
- The presence and severity of contraindications.
- Monitoring availability and feasibility.
- Governance constraints active at the time of generation.

The UX layer may not infer readiness from any other signal and may not re-derive readiness independently.

### III.4 Confidence Requirements

- **Ready** requires the RDE to certify confidence in its action-grade band.
- **Ready With Monitoring** requires the RDE to certify confidence in at least its planning-grade band and to attach explicit monitoring obligations.
- **Exploratory** is permitted at lower bands but is non-enactable without clinician approval.

### III.5 Uncertainty Handling

Where uncertainty in the underlying causes or findings reduces RDE confidence below the band required for a higher readiness, the recommendation is demoted to the readiness state its confidence supports. Demotion is recorded in the ledger and surfaced to clinicians.

### III.6 Contraindication Interaction

- A contraindication produced by the RDE preempts any readiness elevation; it may force a **Ready With Monitoring** or **Exploratory** state irrespective of confidence.
- Contraindications are non-suppressible (consistent with HAIROS_UX_CONTRACT_SPECIFICATION Part IX.6) and appear with equal prominence to the recommendation at every readiness level.

### III.7 Clinician Visibility

Clinicians see:

- The readiness state and its driver (confidence, monitoring posture, contraindication).
- Any demotions and their causes.
- The monitoring obligations attached to **Ready With Monitoring**.
- The reasons an item is **Exploratory** and what evidence would elevate it.

### III.8 Patient Visibility

Patients see:

- The readiness state in plain language.
- For **Ready With Monitoring**, the monitoring obligations.
- For **Exploratory**, an explicit statement that clinician approval is required before action and that no action is implied by the presentation.

Patients never see raw RDE scores, internal thresholds, or governance flags.

### III.9 Governance Requirements

- Readiness semantics, thresholds, and demotion rules are governed under HAIROS_PHASE_5A_REGISTRY_GOVERNANCE_CONSTITUTION and HAIROS_PHASE_5B_REGISTRY_SPECIFICATION_CONSTITUTION.
- The UX must record the governance version active at the time of readiness emission.
- Changes to readiness semantics flow through governance only; never through UX.

### III.10 Audit Requirements

- Each readiness emission is ledger-bound with: RDE version, supporting cause IDs, supporting finding IDs, contraindication IDs, monitoring posture, governance version.
- Clinician overrides of readiness (e.g., approving an Exploratory recommendation) are recorded alongside, not in place of, the system-emitted readiness.

---

## PART IV — COGNITIVE LOAD GOVERNANCE CONTRACT

### IV.1 Purpose

This contract operationalizes the constitutional principle **Minimal Cognitive Burden** without violating the constitutional principles of **Evidence Visibility**, **Confidence Visibility**, **Clinical Transparency**, or **Auditability**.

### IV.2 Governing Rule

> No information may be hidden in a manner that prevents the patient or clinician from reaching it. Cognitive-load rules govern **initial exposure**, not **availability**.

Every item suppressed from initial exposure must be reachable within one disclosure step, and must remain counted, ordered, and confidence-labeled.

### IV.3 Patient Findings Overview

- **Maximum initial visible findings:** 5.
- **Selection rule:** highest Clinical Priority (Part I) first; ties resolved per Part I.9.
- **Suppressed findings:** remain accessible via a single, explicit, non-decorative disclosure mechanism. The count and the highest priority among them are always visible.
- **Prohibition:** no finding may be suppressed if it is **Priority 1**. All Priority 1 findings appear in initial exposure regardless of the maximum.

### IV.4 Patient Root Cause Overview

- **Maximum initial visible causes:** 3.
- **Selection rule:** highest confidence first, then highest Clinical Priority, then deterministic tiebreakers (Part I.9).
- **Suppressed causes:** remain accessible in one disclosure step. The count is always visible.
- **Dissent:** dissent summaries from the Root Cause Engine remain reachable per HAIROS_UX_CONTRACT_SPECIFICATION Part VIII.5.
- **Prohibition:** no accepted cause may be wholly hidden; cognitive-load rules govern initial exposure only.

### IV.5 Patient Recommendation Overview

- **Maximum initial visible recommendations:** 5.
- **Selection rule:** Priority 1 first, then highest readiness state (Ready before Ready With Monitoring before Exploratory), then highest confidence band, then deterministic tiebreakers.
- **Suppressed recommendations:** remain accessible in one disclosure step. The count is always visible.
- **Prohibition:** no Priority 1 recommendation, no contraindication, and no Exploratory recommendation tied to an active safety concern may be suppressed.

### IV.6 Monitoring Overview

- **Maximum initial visible monitoring items:** the current monitoring state plus up to 3 most material deltas.
- **Selection rule:** deltas with the largest evidence-backed magnitude beyond the Trust Layer's noise floor first.
- **Suppressed deltas:** remain accessible in one disclosure step. The count is always visible.
- **Prohibition:** escalation states (Loss of Response, Escalation, Progression beyond noise floor) may not be suppressed under any condition.

### IV.7 Progressive Disclosure Rules

- Disclosure depth from any overview surface to full evidence, full dissent, and full audit must not exceed two steps.
- Each disclosure step must be explicit, deterministic, and labeled with its consequence.
- Disclosure mechanisms may not be styled to discourage use (consistent with the existing prohibition on dark patterns).

### IV.8 Ordering Rules

Ordering at every overview surface is deterministic:

1. Clinical Priority (Part I).
2. Confidence band (Trust Layer).
3. Readiness state (recommendations only; Part III).
4. Ledger timestamp.
5. Registry ID (stable tiebreaker).

The UX is prohibited from reordering on the basis of engagement metrics, commercial considerations, or any non-clinical signal.

### IV.9 Prioritization Rules

- Initial exposure is selected by Clinical Priority first; cognitive-load maxima may never demote a Priority 1 item out of initial exposure.
- Where the number of Priority 1 items exceeds an overview's maximum, the maximum is overridden to admit all Priority 1 items; lower-priority items are suppressed instead.

### IV.10 Non-Hiding Invariants

The following may never be hidden under cognitive-load rules:

- Evidence supporting a displayed item.
- Confidence of a displayed item.
- Contraindications.
- Escalation states.
- Priority 1 items.
- Dissent summaries when the dissent affects a Priority 1 or Priority 2 conclusion.

### IV.11 Clinician Exemptions

Clinician surfaces are exempt from initial-exposure maxima. Clinicians see the complete set of findings, causes, recommendations, and monitoring items by default, ordered per Part IV.8. Clinician views may offer collapse mechanisms, but no item is suppressed from default exposure.

---

## PART V — SCREEN IMPACT ANALYSIS

For each screen defined in HAIROS_UX_CONTRACT_SPECIFICATION Part XIV, the table below documents impact, additional information, and new obligations introduced by Parts I–IV of this document.

| Screen | Affected? | Additional Information | New Obligations |
|---|---|---|---|
| **S1. Entry / Consent** | No | None. | None. |
| **S2. Intake — Question N** | No | None. | None. The 18-Question Framework is unchanged. |
| **S3. Intake Review** | No | None. | None. |
| **S4. Image Acquisition — View N** | No | None. | None. |
| **S5. Image Review** | No | None. | None. |
| **S6. Processing** | No | None. | None. |
| **S7. Findings Overview (Patient)** | Yes | Per-finding Priority (Part I); cognitive-load maxima (Part IV.3); deterministic ordering (Part IV.8). | Surface Priority; enforce 5-finding maximum with Priority 1 override; expose suppressed-count and one-step disclosure; record demotions. |
| **S8. Finding Detail** | Yes | Priority driver; demotion history if any. | Display priority driver; expose any demotion record in clinician view. |
| **S9. Root Causes Overview (Patient)** | Yes | Per-cause Priority; cognitive-load maxima (Part IV.4); ordering (Part IV.8). | Enforce 3-cause initial maximum; preserve dissent reachability; record demotions. |
| **S10. Root Cause Detail** | Yes | Priority driver; demotion history. | Display priority driver; clinician-view demotion record. |
| **S11. Recommendations Overview (Patient)** | Yes | Per-recommendation Priority and Readiness (Parts I, III); cognitive-load maxima (Part IV.5); ordering (Part IV.8). | Enforce 5-recommendation initial maximum with Priority 1 and safety-tied Exploratory overrides; display Readiness; preserve contraindication prominence. |
| **S12. Recommendation Detail** | Yes | Readiness driver; monitoring obligations for Ready With Monitoring; Exploratory rationale; readiness demotion history. | Display Readiness driver and monitoring obligations; record overrides alongside system Readiness. |
| **S13. Doctor Review Queue (Clinician)** | Yes | Case-level Priority summary; Readiness mix per case; escalation flags. | Order queue by escalation then Priority then ledger timestamp; surface Readiness mix. |
| **S14. Doctor Case View (Clinician)** | Yes | Full Priority, Readiness, and Biological Narrative (clinician version, Part II.9); demotion records. | Render clinician narrative with registry links; surface full Priority and Readiness with drivers and demotions; no cognitive-load suppression (Part IV.11). |
| **S15. Doctor Report (Clinician / exportable)** | Yes | Priority and Readiness for each item; clinician Biological Narrative; demotion records; readiness governance version. | Report must reconstruct Priority, Readiness, and Narrative from ledger and registry versions. |
| **S16. Monitoring Overview (Patient)** | Yes | Monitoring-state Priority; cognitive-load maxima (Part IV.6); ordering (Part IV.8). | Enforce maximum on deltas; prohibit suppression of escalation states; surface Priority. |
| **S17. Monitoring Detail** | Yes | Delta Priority drivers; demotion records. | Display Priority drivers; clinician-view demotion records. |
| **S18. Reassessment Flow** | Yes | Updated Priority and Readiness; regenerated Biological Narrative bound to new ledger entries. | Re-emit Narrative under Part II validation; record regeneration event. |
| **S19. Audit / Provenance View (Clinician / Reviewer)** | Yes | Priority emissions, Readiness emissions, Narrative generation events, all demotions. | Make all Part I–IV emissions ledger-replayable. |
| **S20. Account / Consent Management** | No | None. | None. |

Where a screen is marked unaffected, this document introduces no obligation. Where a screen is marked affected, the obligations are cumulative with the existing UX Constitution and may not relax it.

---

## PART VI — ACCEPTANCE CRITERIA

The enhancements specified in this document are valid only when **all** of the following are true:

1. **Compatibility.** The enhancements are fully compatible with HAIROS_UX_CONTRACT_SPECIFICATION.md and impose no contradiction with any clause therein.
2. **No Intelligence Modification.** No clause modifies Signal Registry semantics, Root Cause Engine logic, RDE behavior, Clinical Trust Layer thresholds, the 18-Question Framework, or any governance constitution.
3. **No Duplicate Authority.** Priority, Readiness, and Narrative inputs are consumed from the intelligence layer; the UX neither owns nor re-derives them.
4. **Ledger Reconstructability.** Every Priority emission, Readiness emission, Narrative generation, and cognitive-load demotion is ledger-bound and reconstructable.
5. **Registry Traceability.** Every displayed Priority, Readiness state, and Narrative clause traces to registry IDs and the registry versions active at emission.
6. **Patient Simplicity Preserved.** Cognitive-load rules constrain initial exposure within deterministic maxima while preserving one-step disclosure to all suppressed items.
7. **Clinician Rigor Preserved.** Clinician surfaces remain exempt from initial-exposure maxima; clinicians see complete sets, drivers, demotions, and dissent.
8. **No Hidden Evidence.** No evidence, confidence, contraindication, escalation, or Priority 1 item is hidden under any rule in this document.
9. **No New Clinical Concepts.** No new finding, cause, recommendation, monitoring state, or governance authority is introduced by this document.
10. **Determinism.** Given identical ledger inputs and registry versions, every Priority, Readiness, ordering, suppression, and Narrative output produced under this document is reproducible.
11. **No Marketing or Persuasion.** No clause introduces marketing language, persuasive framing, urgency manipulation, or dark patterns.
12. **No UI Specification.** No clause specifies UI components, visual design, layout, platform implementation, or design tokens.

An enhancement failing any criterion is invalid and must be remediated before adoption.

---

**End of HAIROS_UX_CONTRACT_CONSTITUTIONAL_ENHANCEMENTS**
