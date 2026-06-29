# HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE

**Document Type:** Constitutional Explanation Architecture
**Status:** Authoritative
**Scope:** Deterministic transformation of intelligence-layer outputs into human-understandable clinical explanations.
**Out of Scope:** UI, visual design, components, copywriting, report templating, marketing.

**Upstream Authorities (consumed, never modified):**

- HAIROS_ARCHITECTURE.md
- HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md
- HAIROS_SIGNAL_REGISTRY_V1.md
- HAIROS_ROOT_CAUSE_ENGINE.md
- HAIROS_CLINICAL_TRUST_LAYER.md
- HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md
- HAIROS_PHASE_5A_REGISTRY_GOVERNANCE_CONSTITUTION.md
- HAIROS_PHASE_5B_REGISTRY_SPECIFICATION_CONSTITUTION.md
- HairOS Canonical Ledger
- HAIROS_UX_CONTRACT_SPECIFICATION.md (and HAIROS_UX_CONTRACT_CONSTITUTIONAL_ENHANCEMENTS.md)

**Constitutional Direction**

> Clinical Intelligence drives Explanation. Explanation never drives Clinical Intelligence.

The Clinical Explanation and Narrative Engine (hereafter "the Engine") is a deterministic projection layer. It consumes upstream intelligence outputs and emits explanation artifacts that are reconstructable from the Canonical Ledger. The Engine introduces no clinical concepts, no thresholds, no causes, no findings, no recommendations, no monitoring states. Where this document defines a state, vocabulary band, or hierarchy, it specifies only how the Engine **consumes** an output already governed elsewhere.

---

## PART I — PHILOSOPHY OF EXPLANATION

### I.1 Why Explanations Exist

Explanations exist because clinical conclusions are not self-justifying. A finding, cause, recommendation, or monitoring state, presented without its reasoning, is indistinguishable to the recipient from assertion. Assertion without reasoning erodes trust, prevents informed consent, prevents clinician validation, and prevents auditability. The Engine exists to make every conclusion **inspectable**.

### I.2 Foundational Tenets

1. **Clinical Transparency.** The reasoning behind every conclusion is exposed at the surface where the conclusion appears.
2. **Clinical Honesty.** No explanation overstates certainty, severity, expected benefit, or completeness of evidence.
3. **Explainability.** Every conclusion is accompanied by an explanation answerable in plain language.
4. **Interpretability.** The explanation maps to the same underlying objects the intelligence layer used (signals, pathways, causes, objectives), not to a parallel narrative invented at the surface.
5. **Confidence Visibility.** Confidence appears wherever a conclusion appears; it is never omitted to make output seem more authoritative.
6. **Uncertainty Visibility.** Uncertainty is a first-class explanation element. The absence of uncertainty in an explanation is itself a claim and must be defensible.
7. **Evidence Attribution.** Every claim within an explanation traces to one or more intelligence-layer outputs by registry ID and ledger reference.
8. **Trust Formation.** Trust is earned by consistent honesty across time, not by rhetorical reassurance. Explanations are written to be trustworthy, not to feel reassuring.
9. **Cognitive Load Reduction.** Explanations are structured so that the minimal sufficient understanding is reachable first, and depth is reachable on demand.
10. **Progressive Disclosure.** Patient explanations expose plain-language meaning by default; full registry-linked detail is available on demand and required for clinicians.

### I.3 The Non-Invention Principle

The Engine may never invent evidence. The Engine may never introduce a noun, mechanism, finding, cause, recommendation, contraindication, or prediction not present in an upstream output. Where an upstream output is silent, the Engine is silent. Where an upstream output is uncertain, the Engine is uncertain. The Engine has no authority to fill gaps.

### I.4 The Non-Persuasion Principle

Explanations exist to inform, not to persuade. The Engine is prohibited from selecting vocabulary, ordering, or emphasis with the intent of influencing the recipient's choice. Vocabulary is governed by the Clinical Trust Layer's band mapping; ordering is governed by Clinical Priority; emphasis is governed by evidence weight.

---

## PART II — HAIROS UNIVERSAL EXPLANATION CONTRACT

### II.1 The Five Questions

Every Engine-emitted explanation must answer all five of the following:

1. **Why?** — the affirmative reasoning chain from evidence to conclusion.
2. **Why Not?** — the alternatives considered and the evidence against each.
3. **What Evidence?** — the specific signals, intake responses, image regions, pathways, causes, or objectives supporting the conclusion.
4. **How Confident?** — the Clinical Trust Layer confidence band and the drivers of that band.
5. **What Could Change This Conclusion?** — the specific evidence that, if observed, would shift the conclusion.

### II.2 Constitutional Force

The Five Questions are constitutional. Any HairOS output reaching a user surface that cannot answer all five — for the audience of that surface — is invalid. The Engine refuses to emit explanations that cannot satisfy the contract; it instead emits a structured "insufficient explanation" record bound to ledger for governance review.

### II.3 Audience Calibration

The same five answers are produced for every audience. Only their rendering differs:

- **Patient:** plain language, Trust Layer band vocabulary, evidence summarized, alternatives summarized.
- **Doctor:** registry-linked, score-aware, dissent-complete, alternative-ranked.
- **Audit:** full provenance, registry versions, ledger references, generation events.

The Engine may never present different **facts** to different audiences; only rendering depth varies.

### II.4 Compliance Recording

Every emitted explanation is recorded in the Canonical Ledger with: explanation ID, conclusion ID, audience class, Trust Layer band, registry versions, source ledger references, and Engine version.

---

## PART III — FINDING EXPLANATION ENGINE

### III.1 Mandatory Structure

For every finding, the Engine emits an explanation composed of the following fields. Each field is deterministically generated from the upstream output. Field omission is permitted only where the upstream output explicitly emits no value for that field; substitution and inference are prohibited.

1. **Finding** — the finding's canonical label per the Master Knowledge Model.
2. **Meaning** — plain-language description of what the finding represents, derived from the Knowledge Model's definition.
3. **Evidence** — the supporting signals (registry IDs, plain labels), intake responses, and image regions emitted by the Signal Registry and Clinical Intelligence layer.
4. **Confidence** — Trust Layer band, rendered per Part VII.
5. **Uncertainty** — the specific uncertainty drivers emitted by the Trust Layer, rendered per Part VIII.
6. **Progression Implication** — the trajectory implied by current evidence, only where the intelligence layer emits one; never inferred.
7. **Clinical Relevance** — the relevance of the finding to downstream causes, objectives, and recommendations, derived from the linkages already present in the Knowledge Model and Root Cause Engine.
8. **What Could Change** — the change-trigger evidence (better imaging, new intake response, monitoring delta) that would shift the finding's confidence or severity, derived from Trust Layer change-trigger semantics.
9. **Doctor Detail Layer** — signal scores, image region references, registry IDs, severity band drivers, and any dissent within signals contributing to the finding.
10. **Audit Layer** — Signal Registry version, Knowledge Model version, ledger references for each cited evidence element, Engine version.

### III.2 Deterministic Rendering Rules

- Field order is fixed and non-reorderable.
- Vocabulary for **Meaning** is sourced exclusively from Knowledge Model definitions.
- Vocabulary for **Confidence** and **Uncertainty** is sourced exclusively from the Trust Layer band mapping.
- Evidence enumeration is ordered by descending contribution weight; ties broken by registry ID ascending.
- No field may include language not anchored in an upstream definition.

### III.3 Prohibitions

- No finding explanation may introduce a finding, signal, or mechanism not present upstream.
- No finding explanation may soften or omit severity.
- No finding explanation may suppress uncertainty.
- No finding explanation may include before/after framing or marketing vocabulary.

---

## PART IV — ROOT CAUSE EXPLANATION ENGINE

### IV.1 Mandatory Narratives

For every root cause accepted by the Root Cause Engine, the Engine emits:

1. **Accepted Cause Narrative** — the cause's canonical label and plain-language meaning per the Knowledge Model.
2. **Supporting Evidence Narrative** — enumeration of supporting findings and signals with their contribution weights, sourced from the Root Cause Engine's evidence chain.
3. **Pathway Narrative** — the activated pathways that connect signals to the cause, sourced from the Knowledge Model and Root Cause Engine.
4. **Signal Narrative** — the specific Signal Registry entries contributing, with plain-language labels for patient view and registry IDs for clinician view.
5. **Confidence Narrative** — Trust Layer band and drivers, rendered per Part VII.
6. **Dissent Narrative** — the dissent summary emitted by the Root Cause Engine, including alternative causes with non-trivial posterior.
7. **Alternative Cause Narrative** — the ranked alternatives the engine considered.
8. **Why Not Alternative Narrative** — for each ranked alternative, the evidence weakening it, sourced from the engine's dissent calculus.
9. **Change Trigger Narrative** — the evidence whose appearance would elevate a dissenter or weaken the accepted cause, sourced from the Trust Layer change-trigger semantics.
10. **Doctor Expansion Layer** — full ranked posterior, pathway activation weights, signal scores, registry IDs.
11. **Audit Layer** — Root Cause Engine version, Knowledge Model version, Signal Registry version, Trust Layer version, ledger references, Engine version.

### IV.2 Multifactorial Causes

Where the Root Cause Engine emits a composite (multifactorial) cause, the Engine renders the composite exactly as emitted, including relative contributions of each component. The Engine is prohibited from collapsing, simplifying, or re-weighting components.

### IV.3 Deterministic Generation Rules

- The cause is named per the Knowledge Model only.
- Supporting evidence enumeration follows the engine's contribution-weight ordering.
- Dissent is included whenever the engine emits any alternative with posterior above the Trust Layer's dissent-visibility threshold.
- **Why Not** statements are produced one-per-alternative; collapsing multiple alternatives into a single statement is prohibited.

### IV.4 Prohibitions

- No cause explanation may present the cause as certain unless the engine emits a certain verdict.
- No cause explanation may omit dissent when the engine emits it.
- No cause explanation may introduce a cause, pathway, or signal absent from upstream outputs.

---

## PART V — RECOMMENDATION EXPLANATION ENGINE

### V.1 Mandatory Narratives

For every recommendation emitted by the RDE, the Engine produces:

1. **Objective Narrative** — the clinical objective the recommendation serves, sourced from the RDE.
2. **Capability Narrative** — the capability addressing that objective.
3. **Recommendation Narrative** — the specific recommendation instantiating the capability.
4. **Reasoning Narrative** — the chain Objective → Capability → Recommendation, with the supporting causes and findings.
5. **Evidence Narrative** — the linked causes, findings, and signals.
6. **Confidence Narrative** — Trust Layer band and drivers, rendered per Part VII.
7. **Contraindication Narrative** — any contraindications emitted by the RDE, rendered with equal prominence to the recommendation.
8. **Alternative Recommendation Narrative** — the RDE-emitted alternative set, with the reasoning for each alternative's relative position.
9. **Monitoring Narrative** — the monitoring obligations attached by the RDE and the monitoring posture under which the recommendation operates.
10. **Success Criteria Narrative** — the specific evidence that, if observed, would constitute response, stability, or loss of response, sourced from the RDE and Trust Layer noise-floor semantics.
11. **Doctor Layer** — Readiness state (per UX Enhancements Part III), full alternative ranking with RDE scores, registry IDs, governance version.
12. **Audit Layer** — RDE version, governance version active at emission, ledger references, Engine version.

### V.2 Readiness Coupling

Where Readiness (Ready / Ready With Monitoring / Exploratory) is emitted, the Engine renders Readiness within the Recommendation Narrative per the UX Enhancements contract. Engine vocabulary for Readiness is sourced from the Trust Layer's band mapping for Readiness; vocabulary substitution is prohibited.

### V.3 Deterministic Generation Rules

- Recommendations are ordered per Clinical Priority and Readiness per the UX Enhancements ordering rules.
- Contraindications are surfaced in the same explanation block as the recommendation they constrain; placement elsewhere is prohibited.
- Alternatives are enumerated in the RDE's emitted order; reordering is prohibited.

### V.4 Prohibitions

- No recommendation explanation may include commercial framing, brand language, persuasion, urgency, or scarcity.
- No recommendation explanation may overstate expected benefit beyond the Trust Layer band.
- No recommendation explanation may suppress contraindications.
- No recommendation explanation may omit the Why Not Alternative section when the RDE emits alternatives.

---

## PART VI — MONITORING EXPLANATION ENGINE

### VI.1 States Covered

The Engine emits explanations for the seven monitoring states defined in HAIROS_UX_CONTRACT_SPECIFICATION Part XI: **Baseline**, **Follow-up**, **Improvement**, **Stability**, **Progression**, **Loss of Response**, **Escalation**.

### VI.2 Per-State Mandatory Fields

For each state, the Engine emits:

- **Meaning** — plain-language definition of the state, sourced from the monitoring component and Trust Layer.
- **Evidence Required** — the comparable image set, intake deltas, and signal deltas underpinning the state.
- **Confidence Treatment** — Trust Layer confidence in the **delta itself**, not only in the underlying findings.
- **Noise Floor Treatment** — explicit framing of where the delta sits relative to the Trust Layer's noise floor.
- **Patient Explanation** — plain-language meaning, what changed, what is being watched next.
- **Doctor Explanation** — signal-by-signal deltas, dissent within deltas, registry IDs, monitoring posture.
- **Audit Explanation** — comparison snapshot IDs, monitoring component version, Trust Layer version, ledger references.

### VI.3 State-Specific Constraints

- **Baseline:** no delta language is permitted. The Engine emits only the locked baseline summary.
- **Follow-up:** the Engine emits comparison-pending or comparison-in-progress framing; no improvement or progression language is permitted.
- **Improvement:** permitted only where the delta exceeds the Trust Layer noise floor on the upstream-emitted direction.
- **Stability:** mandatory where the delta is within the noise floor; the Engine may not render small sub-noise deltas as Improvement or Progression.
- **Progression:** permitted only where the delta exceeds the noise floor on the negative direction.
- **Loss of Response:** permitted only where the monitoring component explicitly emits the state.
- **Escalation:** non-suppressible; the Engine surfaces escalation at Priority 1 on every surface where the state is reachable.

### VI.4 Prohibitions

- No fabricated progress language.
- No before/after marketing framing.
- No omission of progression to preserve adherence.
- No improvement claims absent delta evidence above the noise floor.

---

## PART VII — CONFIDENCE COMMUNICATION SYSTEM

### VII.1 Source of Truth

All confidence vocabulary is sourced exclusively from the Clinical Trust Layer band mapping. The Engine introduces no confidence terms.

### VII.2 Bands

The Engine recognizes the Trust Layer's bands as projected by the Trust Layer; for the purposes of this document they are referenced as:

- **High** — sufficient for action-grade conclusions under the Trust Layer.
- **Moderate** — sufficient for planning-grade conclusions under the Trust Layer.
- **Low** — sufficient only for supportive-grade conclusions under the Trust Layer.
- **Insufficient Evidence** — no defensible conclusion is permitted; the Engine emits the evidence-gap explanation instead of a conclusion.

### VII.3 Patient Confidence Language

- **High:** declarative, plain-language statements consistent with Trust Layer's declarative vocabulary.
- **Moderate:** hedged plain-language statements consistent with Trust Layer's hedged vocabulary.
- **Low:** explicit qualification ("early signs", "indicative") per Trust Layer mapping.
- **Insufficient Evidence:** explicit statement that no conclusion is being made and what is needed for one.

### VII.4 Doctor Confidence Language

- All bands are rendered with their underlying scores, drivers, and contributing evidence weights, sourced from the Trust Layer.
- Hedging vocabulary at the clinician layer matches the Trust Layer's clinician-band mapping, not the patient mapping.

### VII.5 Audit Confidence Language

- Bands are recorded with their exact numerical values where emitted by the Trust Layer.
- Drivers are recorded by registry ID.
- Band transitions over time are recorded with ledger references.

### VII.6 Prohibitions

- The Engine may not invent a band.
- The Engine may not promote a conclusion above its emitted band.
- The Engine may not collapse Moderate or Low into High vocabulary.
- The Engine may not hide Insufficient Evidence by substituting a Low-band conclusion.

---

## PART VIII — UNCERTAINTY COMMUNICATION SYSTEM

### VIII.1 Recognized Uncertainty Classes

The Engine renders uncertainty in the following classes, each sourced from upstream:

1. **Known Unknowns** — gaps the intelligence layer explicitly flags.
2. **Missing Data** — intake responses absent or images not captured.
3. **Conflicting Evidence** — signals or findings in opposition, flagged by the Trust Layer or Root Cause Engine.
4. **Insufficient Image Quality** — image confidence below the Photography Standards threshold.
5. **Competing Root Causes** — non-trivial dissent emitted by the Root Cause Engine.
6. **Monitoring Ambiguity** — deltas within the noise floor, or comparison-blocked states.

### VIII.2 Rendering Principles

- Uncertainty is rendered alongside the conclusion it qualifies, never on a separate surface.
- Uncertainty is rendered in patient language consistent with the Trust Layer mapping; in doctor language with full driver detail; in audit with registry and ledger references.
- The Engine may not aggregate uncertainty into a single generic disclaimer; each uncertainty class is rendered with its specific driver.

### VIII.3 Trust-Preserving Uncertainty

Communicating uncertainty does not reduce trust when the communication is:

- **Specific** — the source of uncertainty is named.
- **Actionable** — the change-trigger that would resolve the uncertainty is named.
- **Calibrated** — the magnitude of uncertainty matches the upstream emission.

The Engine is required to render uncertainty in this form. Vague disclaimers are prohibited.

### VIII.4 Prohibitions

- No uncertainty class may be hidden to preserve a conclusion.
- No conclusion may be elevated by suppressing its uncertainty.
- No uncertainty may be invented where the upstream output is certain.

---

## PART IX — PATIENT NARRATIVE ARCHITECTURE

### IX.1 Audience Definition

Patient narratives are addressed to a non-clinician recipient receiving their own clinical information. The recipient has the right to honest, intelligible explanation and the right not to be persuaded.

### IX.2 Requirements

- **Plain language.** Vocabulary is sourced from the Knowledge Model's patient-rendering layer and the Trust Layer's patient band mapping.
- **Non-alarming.** Tone is calm; severity is communicated by Knowledge Model semantics, not by emotive framing.
- **Clinically honest.** No softening that obscures clinically material information.
- **No marketing.** No brand language, urgency, scarcity, or persuasion.
- **No persuasion.** Vocabulary and ordering are not optimized to influence acceptance.
- **No oversimplification.** Simplifications that change clinical meaning are prohibited.
- **No hidden uncertainty.** Every uncertainty class flagged upstream is rendered.

### IX.3 Cognitive Load Principles

- Patient narratives consume the cognitive-load maxima defined in the UX Enhancements Part IV.
- The first reading conveys current state, drivers, plan, and what is being watched.
- Depth is reachable by progressive disclosure within the steps permitted by the UX Constitution.

### IX.4 Constraints Sourced from UX Constitution

The patient narrative inherits the deterministic structure defined by the Biological Narrative Contract (UX Enhancements Part II). The Engine is the producer of that narrative.

---

## PART X — DOCTOR NARRATIVE ARCHITECTURE

### X.1 Audience Definition

Doctor narratives are addressed to treating clinicians and clinical reviewers. The recipient requires registry-linked, score-aware, dissent-complete information sufficient to validate or override the system's conclusions.

### X.2 Mandatory Exposure

Doctor narratives must expose:

- **Signals** — Signal Registry IDs, scores, contribution weights.
- **Pathways** — activated pathways with weights.
- **Evidence Chains** — full chain from intake and image evidence through signals and pathways to findings and causes.
- **Dissent** — full ranked alternatives from the Root Cause Engine.
- **Alternatives** — full RDE alternative set with scores.
- **Confidence Drivers** — Trust Layer band drivers per conclusion.
- **Registry References** — registry versions for every cited authority.
- **Ledger References** — ledger entry IDs for every cited evidence element.

### X.3 No Cognitive-Load Suppression

Per the UX Enhancements Part IV.11, clinician surfaces are exempt from initial-exposure maxima. The doctor narrative renders the complete set by default.

### X.4 Override Recording

Where a clinician overrides a system conclusion, the override is rendered alongside, not in place of, the system narrative. The Engine renders both, with the override's clinician rationale and timestamp.

---

## PART XI — AUDIT EXPLANATION ARCHITECTURE

### XI.1 Reconstructability

Every narrative emitted by the Engine must be reconstructable. Given the ledger entries and registry versions active at emission, regenerating the narrative must produce a semantically equivalent result.

### XI.2 Sentence-Level Traceability

Every sentence in an Engine-emitted narrative must trace to:

- One or more upstream outputs (signal, finding, cause, pathway, recommendation, monitoring delta).
- The registry version active at emission.
- The Trust Layer band and drivers at emission.
- The ledger entries cited as evidence.

### XI.3 Required Provenance Fields

Every narrative carries a provenance record containing:

- Engine version.
- Knowledge Model version.
- Signal Registry version.
- Root Cause Engine version.
- Trust Layer version.
- RDE version.
- Governance version (5A/5B).
- Ledger reference IDs for every cited evidence element.
- Generation timestamp.
- Audience class.

### XI.4 Replay Guarantee

The Engine guarantees that, for a given case, an audit replay using the recorded provenance reproduces the narrative. Replay failures are themselves recorded for governance review.

---

## PART XII — NARRATIVE GENERATION RULES

### XII.1 Allowed Inputs

The Engine may consume only:

- Accepted findings emitted by the Clinical Intelligence layer.
- Accepted root causes emitted by the Root Cause Engine.
- Accepted recommendations emitted by the RDE.
- Monitoring states emitted by the monitoring component.
- Confidence bands and uncertainty drivers emitted by the Clinical Trust Layer.
- Priority and Readiness values emitted under the UX Enhancements contract.
- Vocabulary mappings defined by the Knowledge Model and Trust Layer.
- Registry versions and ledger references active at generation.

### XII.2 Prohibited Inputs

The Engine may not consume:

- Marketing copy.
- Brand assets or product names not present in RDE outputs.
- Generic dermatology literature not anchored in the Knowledge Model.
- Engagement metrics.
- Commercial signals.
- A/B test variants intended to influence acceptance.
- LLM-generated content not validated against upstream outputs at the sentence level.

### XII.3 Evidence Hierarchy

When multiple upstream outputs are available, the Engine prefers them in this order:

1. Direct intelligence-layer emissions (signals, findings, causes, recommendations, monitoring states).
2. Knowledge Model definitions.
3. Trust Layer band and uncertainty mappings.
4. Registry-governed vocabulary.

The hierarchy is non-bypassable. Lower-priority sources may not contradict higher-priority sources.

### XII.4 Conflict Resolution

Where two upstream outputs conflict:

- If both are emitted with confidence, the Engine renders both and surfaces the conflict as **Conflicting Evidence** uncertainty (Part VIII).
- If one is emitted with higher confidence, the Engine renders the higher-confidence output as primary and the lower as **Dissent** or **Alternative** per the relevant Part (IV or V).
- The Engine never silently chooses one and discards the other.

### XII.5 Missing Evidence Handling

Where evidence required for a field is missing:

- The field is rendered as the corresponding uncertainty class (Part VIII).
- No substitute evidence is invented.
- No conclusion is elevated to compensate.

### XII.6 Confidence Handling

- Confidence is rendered for every conclusion.
- Vocabulary is sourced from the Trust Layer band mapping.
- Confidence is never omitted, never collapsed upward, never collapsed downward.

### XII.7 Uncertainty Handling

- Uncertainty is rendered per Part VIII with its specific class.
- Uncertainty is never aggregated into a single generic disclaimer.
- Uncertainty is never hidden to preserve a conclusion.

### XII.8 Versioning

- The Engine carries a version.
- Each emission records the Engine version, all upstream component versions, and the governance version active at emission.
- A change in any upstream version may change emissions; such changes are recorded in the ledger.

### XII.9 Governance

- Engine semantics are governed under HAIROS_PHASE_5A_REGISTRY_GOVERNANCE_CONSTITUTION and HAIROS_PHASE_5B_REGISTRY_SPECIFICATION_CONSTITUTION.
- Changes to vocabulary mappings, field structures, or generation rules flow through governance, never through ad-hoc updates.
- The Engine refuses to emit under a governance state flagged as invalid.

---

## PART XIII — ACCEPTANCE CRITERIA

The Engine and this specification are valid only when **all** of the following are true:

1. **Reconstructability.** Every narrative is reconstructable from the recorded provenance.
2. **Sentence-Level Traceability.** Every statement traces to an upstream output via registry IDs and ledger references.
3. **Confidence Traceability.** Every confidence statement traces to a Trust Layer band emission.
4. **Uncertainty Traceability.** Every uncertainty statement traces to an actual uncertainty driver emitted upstream.
5. **No Marketing Language.** No emission contains marketing, persuasion, urgency, scarcity, or brand framing.
6. **No Speculative Language.** No emission introduces speculation absent from upstream outputs.
7. **No Unsupported Claim.** No emission contains a claim that cannot be defended against the provenance record.
8. **No Recommendation Without Evidence.** No recommendation explanation exists in the absence of supporting causes, objectives, and RDE emission.
9. **No Root Cause Without Evidence.** No root-cause explanation exists in the absence of Root Cause Engine acceptance and supporting evidence.
10. **No Monitoring Without Delta Evidence.** No monitoring explanation other than Baseline or Follow-up exists in the absence of delta evidence above or within the Trust Layer noise floor as defined by the state.
11. **Five-Question Compliance.** Every emission answers all five of the Universal Explanation Contract questions for its audience.
12. **Audience Parity of Facts.** No emission presents different facts to different audiences; only rendering depth varies.
13. **Determinism.** Given identical upstream inputs and versions, the Engine produces semantically equivalent emissions.
14. **Non-Invention.** No noun, mechanism, finding, cause, recommendation, contraindication, or prediction appears in an emission without an upstream source.
15. **Non-Suppression.** No contraindication, escalation, Priority 1 item, or material uncertainty is hidden under any rule in this document.

An emission failing any criterion is invalid. The Engine is required to refuse such emissions and record the refusal for governance.

---

**End of HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE**
