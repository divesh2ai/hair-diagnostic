# HAIROS_UX_CONTRACT_SPECIFICATION

**Document Type:** Constitutional UX Contract
**Status:** Authoritative
**Scope:** Information architecture and experience architecture only
**Out of Scope:** UI design, visual design, design tokens, component design, frontend/mobile/web architecture, Figma specification

**Upstream Authorities (do not duplicate, do not override):**

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
- Dr. FACT Design System
- HairOS Clinical Photography Standards
- HairOS Visual Intelligence Standards

This document binds these authorities to the patient and clinician experience. It does not modify them.

---

## PART I — PURPOSE

### I.1 Purpose of the UX Contract

The UX Contract is the deterministic bridge between HairOS clinical intelligence outputs and the information presented to human users. It specifies, for every user-facing surface, **what** is shown, **when** it is shown, **why** it is shown, **what evidence** supports it, **what confidence** supports it, and **what explanation** supports it.

The UX Contract is the single source of truth for information architecture and experience architecture. All product, design, engineering, clinical, reporting, and AI image generation teams consume this contract.

### I.2 Constitutional Direction

> **Clinical Intelligence drives UX.**
> **UX never drives Clinical Intelligence.**

No screen, surface, copy block, or visualization may exist unless it is the faithful presentation of an output produced by an authoritative HairOS intelligence component. No UX requirement may cause clinical logic, thresholds, registries, or decision engines to be modified. If a UX need cannot be met by current intelligence outputs, the resolution is to file a request against the relevant constitution — never to invent an intelligence value in the UI.

### I.3 Relationship to HairOS Intelligence Architecture

The UX Contract consumes — and only consumes — outputs from:

| Intelligence Layer | UX Consumption |
|---|---|
| HAIROS_ARCHITECTURE | System-wide stage boundaries, lifecycle, identity model |
| Clinical Intelligence Master Knowledge Model | Domain vocabulary, finding categories, semantic structure |
| Signal Registry v1 | Signal display, evidence attribution, confidence presentation |
| Root Cause Engine | Accepted causes, dissent, alternatives, confidence |
| Clinical Trust Layer | Trust state, uncertainty, audit visibility |
| Recommendation Decision Engine (RDE) | Objective → Capability → Recommendation surface |
| Registry Governance (5A) + Registry Specification (5B) | Versioning, traceability, change visibility |
| Canonical Ledger | Audit, reconstructability of any displayed value |
| 18-Question Framework | Intake surface |
| Dr. FACT Design System | Tone, vocabulary, brand-clinical voice |
| Clinical Photography Standards | Image acquisition contract |
| Visual Intelligence Standards | Visual content contract |

### I.4 Relationship to Doctor Reports and Monitoring

The Doctor Report and Monitoring surfaces are direct projections of intelligence outputs across time. They are bound by this contract to remain reconstructable from the Canonical Ledger.

### I.5 Non-Goals

This document does not specify:

- Visual styling, color, typography, spacing, motion
- Component libraries or frontend frameworks
- Platform choices (web/mobile/native)
- Figma files or design tokens
- Implementation details of any kind

---

## PART II — DESIGN PRINCIPLES

The following principles are constitutional. Any UX decision that violates them is invalid regardless of business pressure.

### II.1 Constitutional Principles

1. **Clinical Transparency.** Every conclusion shown to a user must disclose what it is based on.
2. **Explainability.** Every finding, cause, and recommendation must answer *why this* and *why not alternatives*.
3. **Evidence Visibility.** Evidence supporting a conclusion must be reachable from the conclusion within one disclosure step.
4. **Confidence Visibility.** Confidence must be shown wherever a conclusion is shown. Confidence is never hidden to make output appear more authoritative.
5. **Patient Trust.** The patient experience must remain calm, honest, and non-alarming, while never softening clinically material information.
6. **Clinical Honesty.** No output may overstate certainty, severity, or expected benefit.
7. **Uncertainty Visibility.** Where the intelligence layer is uncertain, the UI must be uncertain. Uncertainty is a first-class display element, not a fallback.
8. **Minimal Cognitive Burden.** Patients see the smallest set of information necessary to understand their state and next step.
9. **Progressive Disclosure.** Deeper evidence, dissent, and audit detail are available on demand and required for clinicians, but never forced on patients.
10. **Auditability.** Every displayed element must be traceable to a ledger entry, registry version, and intelligence output.

### II.2 Explicit Prohibitions

The following are prohibited at every surface:

- Marketing behavior (urgency framing, scarcity, social proof tactics)
- Persuasive design intended to bias acceptance of a recommendation
- Fear tactics (catastrophizing, before/after manipulation, loss framing)
- Urgency manipulation (countdown timers, "act now" patterns)
- Unsupported certainty (any claim not backed by an intelligence output)
- Dark patterns (forced continuity, hidden costs, confirmshaming, misdirection)
- Stock or idealized imagery in clinical contexts
- Before/after marketing imagery
- Product placement disguised as recommendation
- Implied diagnosis where the intelligence layer has not concluded one

---

## PART III — USER TYPES

### III.1 Patient

- **Goals:** Understand current hair state, root causes, and what to do next; track progress over time.
- **Information Needs:** Their findings in plain language; their root causes with rationale; their recommendations with rationale; their monitoring state.
- **Visibility Permissions:** Own intake, own images, own findings, own root causes (accepted set), own recommendations, own monitoring, own report (patient version), own audit summary on request.
- **Restricted Information:** Raw signal scores, internal thresholds, registry IDs, ranker weights, dissent calculus internals, model versions (shown as version label only), other patients' data.

### III.2 Doctor (Treating Clinician)

- **Goals:** Review the system's reasoning, validate or override, prescribe, monitor.
- **Information Needs:** Full clinical report including signals, pathways, accepted and rejected causes, dissent, confidence, recommendation rationale, contraindications, monitoring deltas.
- **Visibility Permissions:** All patient-visible information plus the full clinical layer: signal scores, evidence chains, pathway activations, dissent, alternatives, RDE Objective→Capability→Recommendation map, registry versions, ledger audit.
- **Restricted Information:** Other patients (unless within their panel), platform-internal governance discussions.

### III.3 Clinical Reviewer (Governance / QA)

- **Goals:** Audit decisions across patients and time; validate registry adherence; investigate edge cases.
- **Information Needs:** Everything a doctor sees plus cross-case comparison, registry version diffs, ledger replay, dissent distributions.
- **Visibility Permissions:** Full read across cohort scope assigned by governance; full ledger replay.
- **Restricted Information:** Cannot mutate clinical records; cannot alter registries without going through 5A governance.

### III.4 HairOS System

- **Goals:** Deterministic execution of the intelligence layers.
- **Information Needs:** All registry, ledger, signal, cause, and RDE inputs.
- **Visibility Permissions:** System-internal; never user-visible.
- **Restricted Information:** N/A — the system is the source.

---

## PART IV — COMPLETE USER JOURNEY

The HairOS journey is a fixed, ordered sequence. Every stage has a defined objective, inputs, outputs, evidence requirement, explanation requirement, and confidence requirement. Stage outputs are bound to the Canonical Ledger.

| # | Stage | Objective | Inputs | Outputs | Evidence Req. | Explanation Req. | Confidence Req. |
|---|---|---|---|---|---|---|---|
| 1 | Entry | Identify user, establish consent, set expectations | Account/auth, consent record | Authenticated session, consent ledger entry | Consent record | What HairOS does and does not do | N/A |
| 2 | Intake | Collect 18-Question Framework responses | User responses | Structured intake bundle | Per-question response with timestamp | Why each question is asked | Per-question completeness |
| 3 | Image Upload | Capture required image set per Photography Standards | Captured images | Validated image set with quality flags | Image quality scores | Why each image is needed; rejection reasons | Image confidence per view |
| 4 | Processing | Run intelligence pipeline | Intake + images | Signals, pathways, candidate causes | Ledger entry per signal | Pipeline status (calm, factual) | N/A to user; system records full provenance |
| 5 | Findings | Present clinical findings | Signal Registry outputs | Findings list with severity and progression risk | Source signals, image regions | Why each finding; what it means | Per-finding confidence |
| 6 | Root Causes | Present accepted root causes | Root Cause Engine output | Accepted causes, dissent summary, alternatives | Supporting signals, pathway activations | Why this cause; why not alternatives | Per-cause confidence |
| 7 | Recommendations | Present RDE recommendations | RDE Objective→Capability→Recommendation | Recommendation set with rationale | Linked causes, linked objectives, contraindications | Why this; why not alternatives | Per-recommendation confidence |
| 8 | Doctor Review | Clinician reviews, accepts, modifies, or overrides | Full case bundle | Reviewed/signed plan; overrides recorded | Full clinical report | Reviewer rationale where overriding | Final confidence after review |
| 9 | Monitoring | Track adherence and biological response | Follow-up intake, follow-up images, time | Monitoring state (Baseline / Follow-up / Improvement / Stability / Progression / Loss of Response / Escalation) | Delta evidence vs. baseline | Why state changed | Confidence in delta |
| 10 | Reassessment | Re-run pipeline against new data | New intake + images | Updated findings, causes, recommendations | Same as stages 5–7 | Why changes occurred | Updated confidences |

Each stage must be exitable, resumable, and auditable. No stage may bypass evidence or confidence requirements.

---

## PART V — INTAKE EXPERIENCE CONTRACT

### V.1 Canonical Intake

The 18-Question Intelligence Framework is the canonical intake architecture. The preferred intake size is **18 questions**. The UX Contract may **recommend** additional questions only if all of the following are demonstrated:

1. A material improvement in **root-cause discrimination**, **escalation detection**, **contraindication detection**, or **recommendation safety**.
2. The improvement cannot be achieved by existing questions, by image evidence, or by intelligence-layer logic.
3. The added cognitive burden is justified by the clinical value.

**Hard ceiling: intake may never exceed 20 total questions.** Any proposal that would exceed 20 is automatically rejected.

### V.2 New Question Proposal Burden

Every proposed new question must be submitted with:

- **Exact inference gap** — the specific clinical inference currently impossible or unsafe.
- **Why current questions cannot solve it** — explicit mapping against the 18 canonical questions.
- **Affected signals** — the Signal Registry entries that would gain evidence.
- **Affected root causes** — the Root Cause Engine causes whose discrimination improves.
- **Expected clinical value** — escalation, safety, or discrimination delta.

Questions that fail any element of this burden are rejected without further review.

### V.3 Per-Question Contract

For each of the 18 canonical questions, the UX Contract requires (sourced from the 18-Question Framework, not redefined here):

- **Purpose** — the inference it enables.
- **Supported signals** — the Signal Registry entries it feeds.
- **Confidence contribution** — how it sharpens or weakens downstream confidence.
- **Root-cause contribution** — the Root Cause Engine causes it informs.
- **Recommendation relevance** — the RDE objectives or capabilities it gates.

The UX surface for each question must expose, on demand, a plain-language rationale: *why we ask this*.

### V.4 Completion, Abandonment, Partial Completion

- **Completion Requirement:** All 18 canonical questions must be answered before the pipeline may produce findings, causes, or recommendations. Optional (≤2) approved additions, if any, are not blocking.
- **Abandonment Handling:** Partial intake is preserved in ledger as `intake.partial`. No findings, causes, or recommendations are shown. The patient sees an honest "intake incomplete" state, never a synthesized result.
- **Partial Completion Handling:** A patient may resume from the last answered question. Time elapsed between sessions is recorded. If a clinically material window has elapsed (per governance), prior answers may require re-confirmation before the pipeline runs.
- **No Inference From Absence:** A skipped question never produces a synthetic answer. Missing data must propagate as uncertainty into the intelligence layer.

---

## PART VI — IMAGE ACQUISITION CONTRACT

This contract aligns with — and never overrides — the **HairOS Clinical Photography Standards**.

### VI.1 Image Sets

- **Required Set:** the minimum images without which the pipeline cannot produce defensible findings.
- **Recommended Set:** images that materially improve confidence or discrimination.
- **Optional Set:** images that may aid edge-case analysis or longitudinal comparison.

The exact view list, framing, and acceptance thresholds are governed by the Photography Standards. This contract binds the UX to surface them.

### VI.2 Per-Image Contract

For each required, recommended, and optional image, the UX Contract specifies:

- **Purpose** — what inference the image enables.
- **Supported Findings** — which findings depend on it.
- **Supported Signals** — which Signal Registry entries it feeds.
- **Image Quality Requirements** — sharpness, exposure, hair visibility, scalp visibility, framing, distance.
- **Rejection Conditions** — explicit conditions under which the image is rejected and re-capture is requested.

### VI.3 Acquisition Requirements

- **Lighting Requirements:** as specified in Photography Standards; UX must surface real-time guidance.
- **Hair Visibility Requirements:** parting, lifting, and scalp exposure per standard.
- **Framing Requirements:** view-specific framing per standard.
- **Image Confidence Rules:** each image carries a confidence score; the UX must surface it and refuse to advance the pipeline if a required image falls below the standard's acceptance threshold.

### VI.4 Patient-Facing Behavior

- Rejections are explained in plain language with the specific failure (e.g., "we cannot see the scalp clearly enough at the crown").
- Re-capture flows are non-punitive and non-alarming.
- The system never claims a finding from an image it has rejected.

---

## PART VII — CLINICAL FINDINGS EXPERIENCE

### VII.1 What Is Shown

The findings surface presents only findings produced by the Signal Registry and Clinical Intelligence layers. No finding may appear that is not registry-sourced.

### VII.2 Grouping

Findings are grouped by clinical domain (e.g., follicular density, miniaturization, inflammation, scaling, shedding, scalp condition) as defined by the Clinical Intelligence Master Knowledge Model. Grouping is structural, not promotional.

### VII.3 Evidence Display

Each finding exposes:

- **Source signals** with registry IDs (clinician view) or plain-language labels (patient view).
- **Image regions** that contributed (clinician view; patient view shows only the image and an indicative marker).
- **Intake responses** that contributed.

Evidence is reachable within one disclosure step from the finding.

### VII.4 Confidence Display

- Confidence is shown for every finding.
- Confidence is presented on the scale defined by the Clinical Trust Layer.
- Patient view uses plain-language bands; clinician view shows the underlying score and band.
- Low confidence is never hidden.

### VII.5 Uncertainty Display

- Where the intelligence layer reports uncertainty, the UI explicitly states it.
- Synonyms for uncertainty (e.g., "early signs", "indicative", "consistent with") must be governed by the Trust Layer mapping, not invented at the surface.

### VII.6 Severity Display

- Severity is shown only where the Signal Registry or Master Knowledge Model defines a severity scale for the finding.
- Severity is never inferred at the UI layer.

### VII.7 Progression Risk Display

- Progression risk is shown only where the intelligence layer produces it.
- Progression risk is presented as the trajectory implied by current evidence, never as prophecy.

### VII.8 Finding Contract

> **Finding → Evidence → Confidence → Explanation**

Every finding surface must answer:

- What is this finding?
- What evidence supports it?
- How confident is this?
- What does this mean for me (patient) / for management (clinician)?

---

## PART VIII — ROOT CAUSE EXPERIENCE

### VIII.1 Accepted Causes

Only causes accepted by the Root Cause Engine are shown as conclusions. Acceptance is defined by the Root Cause Engine; the UX never re-derives it.

### VIII.2 Confidence

- Per-cause confidence is always displayed alongside the cause.
- Confidence bands follow the Clinical Trust Layer.
- A cause without sufficient confidence to be accepted is not shown as a conclusion.

### VIII.3 Supporting Evidence

For each accepted cause:

- The supporting signals and findings are reachable in one disclosure step.
- Image evidence and intake evidence are attributed.

### VIII.4 Uncertainty

Where the Root Cause Engine reports multifactorial causation, the UX shows the **composite** with the relative contributions, exactly as produced by the engine.

### VIII.5 Dissent

- Where the engine produces dissent (alternative causes with non-trivial posterior), the dissent is exposed.
- Patient view shows dissent in plain language ("we also considered X").
- Clinician view shows ranked alternatives with their scores.

### VIII.6 Mandatory Questions

The root cause surface must answer:

- **Why this root cause?** — supporting evidence chain.
- **Why not alternatives?** — what evidence weakens each rejected alternative.

### VIII.7 Prohibitions

- No cause may be presented as certain unless the engine emits a certain verdict.
- No cause may be inferred at the UI layer.
- No cause may be reframed at the UI layer for emotional effect.

---

## PART IX — RECOMMENDATION EXPERIENCE

### IX.1 Consumption of RDE Outputs

The Recommendation surface consumes only RDE outputs and exposes the **Objective → Capability → Recommendation** visibility model exactly as the RDE produces it.

### IX.2 Visibility Model

Each recommendation is shown together with:

- The **Objective** it serves (clinical goal).
- The **Capability** that addresses that objective.
- The specific **Recommendation** instantiating that capability.

The chain is reachable in one disclosure step.

### IX.3 Per-Recommendation Contract

For every recommendation the UX exposes:

- **Explanation** — why this recommendation, in plain language.
- **Confidence** — RDE-produced confidence band.
- **Evidence** — the causes, findings, and signals it traces to.
- **Monitoring** — what will be measured to evaluate response, and when.
- **Audit** — registry versions and ledger references (clinician view).

### IX.4 Mandatory Questions

- **Why this recommendation?** — Objective and supporting causes.
- **Why not alternatives?** — RDE-emitted alternative summary.

### IX.5 Prohibitions

- No commercial influence on ranking or presentation.
- No product marketing language.
- No unsupported efficacy claims.
- No exaggerated expected outcomes.
- No undisclosed sponsorship.
- No upsell at the recommendation surface.
- No "premium" tier for safety-critical information.

### IX.6 Contraindications and Safety

Contraindications surfaced by the RDE are non-suppressible at the UI layer. They appear with equal prominence to the recommendation they constrain.

---

## PART X — DOCTOR REPORT CONTRACT

### X.1 Scope

The Doctor Report is the clinician-facing projection of the full case. It is reconstructable from the Canonical Ledger and registry versions at the time of generation.

### X.2 Required Sections

- **Intake Summary** — canonical 18 responses (and any approved additions), with timestamps and any partial/abandonment notes.
- **Image Summary** — image set used, per-image quality and confidence, rejections.
- **Findings Summary** — findings with severity, progression risk, confidence, evidence chain.
- **Signal Summary** — Signal Registry outputs with IDs, scores, registry version.
- **Pathway Summary** — activated pathways with weights.
- **Root-Cause Summary** — accepted causes, dissent, alternatives, confidence.
- **Recommendation Summary** — Objective → Capability → Recommendation, with RDE rationale and alternatives.
- **Monitoring Summary** — current monitoring state and deltas if reassessment.
- **Audit Summary** — registry versions, ledger reference IDs, model version label, generation timestamp.

### X.3 Requirements

- **Clinically Reviewable** — readable in clinical workflow time.
- **Evidence Linked** — every claim links to its evidence.
- **Confidence Linked** — every claim carries its confidence.
- **Reconstructable** — given the ledger entries and registry versions, the report can be regenerated bit-identically.

### X.4 Overrides

When the clinician overrides any RDE or Root Cause output, the override is recorded with the clinician's rationale and is presented in the report alongside the system output, never in place of it.

---

## PART XI — MONITORING EXPERIENCE

### XI.1 States

Monitoring exposes one of the following states, produced by the intelligence layer:

- **Baseline** — initial assessment locked.
- **Follow-up** — new assessment recorded; comparison pending or in-progress.
- **Improvement** — measurable positive delta beyond the Trust Layer's noise floor.
- **Stability** — no measurable delta within the noise floor.
- **Progression** — measurable negative delta beyond the noise floor.
- **Loss of Response** — prior improvement reversed or plateaued in a manner the engine flags.
- **Escalation** — clinical escalation criteria met; clinician attention required.

### XI.2 Per-State Contract

For every state:

- **Displayed Information** — current state, delta vs. baseline and vs. last follow-up.
- **Evidence Requirements** — the comparable image set and intake responses underpinning the delta.
- **Confidence Treatment** — confidence in the delta itself, not just the underlying findings; deltas below the noise floor are shown as **Stability**, never as small Improvement or small Progression.
- **Reassessment Triggers** — calendar-based and event-based triggers (e.g., new symptoms).
- **Recommendation Implications** — which recommendations may be reinforced, modified, or escalated per RDE logic.

### XI.3 Prohibitions

- No fabricated progress visuals.
- No "before/after" marketing framing.
- No suppression of progression to preserve adherence.
- No claim of improvement without delta evidence above the noise floor.

---

## PART XII — EXPLANATION SYSTEM

### XII.1 The HairOS Explanation Contract

Every major output — findings, root causes, recommendations, monitoring states — must answer **all five** of the following:

1. **Why?** — the affirmative evidence chain.
2. **Why not?** — the rejected alternatives and the evidence against them.
3. **What evidence?** — the specific signals, intake responses, and image regions.
4. **How confident?** — the confidence band and what drives it.
5. **What could change this conclusion?** — the specific evidence that, if observed, would shift the conclusion.

### XII.2 Explanation Architecture by Output Class

- **Findings:** evidence = signals + image regions + intake; alternatives = differential within the finding's group; change-triggers = re-image with better quality, intake revision, monitoring delta.
- **Root Causes:** evidence = supporting signals + pathway activations + findings; alternatives = dissent ranking from Root Cause Engine; change-triggers = new evidence that lifts a dissenter or weakens the accepted cause.
- **Recommendations:** evidence = linked causes + linked objectives; alternatives = RDE alternative set; change-triggers = contraindication emergence, monitoring response, patient preference within RDE bounds.
- **Monitoring:** evidence = delta vs. baseline; alternatives = adjacent states; change-triggers = new follow-up data, escalation criteria, clinician override.

### XII.3 Audience Calibration

- Patient explanations are plain language and short.
- Clinician explanations are full and registry-linked.
- The underlying evidence is the same; only the rendering differs. The UI may never present different *facts* to patient and clinician.

---

## PART XIII — VISUAL CONTENT CONTRACT

The Dr. FACT Design System, HairOS Clinical Photography Standards, and HairOS Visual Intelligence Standards are authoritative. This section binds the UX to use them; it does not redesign them.

### XIII.1 Required Visual Assets by Stage

- **Intake Imagery:** instructional, neutral, demographically representative, non-idealized.
- **Diagnostic Imagery:** the patient's own validated images; reference exemplars only when comparing against governed clinical reference sets.
- **Findings Imagery:** the patient's images with non-decorative, evidence-attributed markers; reference exemplars only where governance permits.
- **Progression Imagery:** longitudinal sequences of the patient's own images, captured under matched conditions per Photography Standards.
- **Monitoring Imagery:** matched-condition follow-up images with delta-evidence overlays only.
- **Doctor-Report Imagery:** clinical-grade renderings suitable for clinical review and archival.

### XIII.2 Visual Constraints

All visuals must remain:

- Premium
- Realistic
- Clinical
- Biologically accurate
- Dermatologist-grade
- Non-advertising
- Non-stock-photo

### XIII.3 Prohibitions

- No idealized models.
- No before/after marketing pairs.
- No filters or enhancements that alter clinically material features.
- No product packaging shots inside clinical surfaces.
- No emotive imagery (distress, triumph) used to drive behavior.

---

## PART XIV — SCREEN INVENTORY

Each screen is defined by its information contract only. UI, layout, color, spacing, and component choice are out of scope.

### XIV.1 Screens

For each screen below, the contract is: **Purpose**, **Inputs**, **Outputs**, **Evidence Blocks**, **Confidence Blocks**, **Explanation Blocks**, **Monitoring Blocks** (where applicable), **Recommendation Blocks** (where applicable).

#### S1. Entry / Consent
- **Purpose:** authenticate, establish consent, set expectations.
- **Inputs:** identity, consent acceptance.
- **Outputs:** session, consent ledger entry.
- **Evidence:** consent text version.
- **Confidence:** N/A.
- **Explanation:** what HairOS does and does not do.

#### S2. Intake — Question N (×18, plus ≤2 governed additions if approved)
- **Purpose:** capture one canonical question.
- **Inputs:** user response.
- **Outputs:** structured response with timestamp.
- **Evidence:** the response itself.
- **Confidence:** completeness flag.
- **Explanation:** "why we ask this" on demand.

#### S3. Intake Review
- **Purpose:** confirm responses before pipeline.
- **Inputs:** intake bundle.
- **Outputs:** confirmation or edit.
- **Evidence:** all responses.
- **Confidence:** completeness summary.
- **Explanation:** what happens next.

#### S4. Image Acquisition — View N
- **Purpose:** capture one view per Photography Standards.
- **Inputs:** camera stream / upload.
- **Outputs:** validated image or rejection.
- **Evidence:** image, quality scores.
- **Confidence:** per-image confidence.
- **Explanation:** purpose of the view; rejection reasons in plain language.

#### S5. Image Review
- **Purpose:** confirm validated image set.
- **Inputs:** validated images.
- **Outputs:** approval to process or re-capture flow.
- **Evidence:** thumbnails, quality flags.
- **Confidence:** set-level confidence.
- **Explanation:** why this image set is sufficient.

#### S6. Processing
- **Purpose:** factual progress indication.
- **Inputs:** pipeline state.
- **Outputs:** stage progress.
- **Evidence:** N/A to user.
- **Confidence:** N/A.
- **Explanation:** calm, non-alarming, non-promising status.

#### S7. Findings Overview (Patient)
- **Purpose:** present findings.
- **Inputs:** Signal Registry / Clinical Intelligence outputs.
- **Outputs:** finding cards.
- **Evidence Blocks:** per-finding evidence reachable in one step.
- **Confidence Blocks:** per-finding confidence band.
- **Explanation Blocks:** plain-language Why / Why-not / What-could-change.

#### S8. Finding Detail
- **Purpose:** drill into one finding.
- **Inputs:** finding ID.
- **Outputs:** full finding contract.
- **Evidence Blocks:** signals, image regions, intake links.
- **Confidence Blocks:** confidence + drivers.
- **Explanation Blocks:** all five Explanation Contract questions.

#### S9. Root Causes Overview (Patient)
- **Purpose:** present accepted causes.
- **Inputs:** Root Cause Engine output.
- **Outputs:** cause cards.
- **Evidence Blocks:** linked findings/signals.
- **Confidence Blocks:** per-cause confidence.
- **Explanation Blocks:** Why this; Why not alternatives.

#### S10. Root Cause Detail
- **Purpose:** drill into one cause.
- **Inputs:** cause ID.
- **Outputs:** full cause contract.
- **Evidence Blocks:** supporting evidence chain.
- **Confidence Blocks:** confidence + drivers.
- **Explanation Blocks:** dissent, alternatives, change-triggers.

#### S11. Recommendations Overview (Patient)
- **Purpose:** present RDE recommendations.
- **Inputs:** RDE output.
- **Outputs:** Objective → Capability → Recommendation cards.
- **Evidence Blocks:** linked causes.
- **Confidence Blocks:** per-recommendation confidence.
- **Explanation Blocks:** Why / Why-not / Monitoring / Contraindications.

#### S12. Recommendation Detail
- **Purpose:** drill into one recommendation.
- **Inputs:** recommendation ID.
- **Outputs:** full recommendation contract.
- **Evidence Blocks:** evidence chain to causes and findings.
- **Confidence Blocks:** RDE confidence band.
- **Explanation Blocks:** alternatives, contraindications, monitoring plan.

#### S13. Doctor Review Queue (Clinician)
- **Purpose:** list cases awaiting review.
- **Inputs:** assigned cases.
- **Outputs:** case rows with status.
- **Evidence Blocks:** summary chips.
- **Confidence Blocks:** case-level confidence summary.
- **Explanation Blocks:** triage rationale where engine flags escalation.

#### S14. Doctor Case View (Clinician)
- **Purpose:** full case review per Part X.
- **Inputs:** case bundle.
- **Outputs:** sign / modify / override actions.
- **Evidence / Confidence / Explanation Blocks:** complete clinician views per prior sections.
- **Recommendation Blocks:** RDE Objective→Capability→Recommendation with alternatives.

#### S15. Doctor Report (Clinician / exportable)
- **Purpose:** authoritative case report per Part X.
- **Inputs:** signed case.
- **Outputs:** rendered report, ledger-reconstructable.
- **Evidence / Confidence / Explanation Blocks:** all required sections.

#### S16. Monitoring Overview (Patient)
- **Purpose:** show current monitoring state.
- **Inputs:** monitoring state.
- **Outputs:** state badge + delta summary.
- **Evidence Blocks:** comparison images, intake deltas.
- **Confidence Blocks:** delta confidence.
- **Explanation Blocks:** why this state; what could change it.
- **Monitoring Blocks:** next assessment trigger.

#### S17. Monitoring Detail
- **Purpose:** drill into deltas.
- **Inputs:** monitoring snapshot IDs.
- **Outputs:** signal-by-signal deltas.
- **Evidence / Confidence / Explanation Blocks:** full Explanation Contract.

#### S18. Reassessment Flow
- **Purpose:** re-run pipeline with new data.
- **Inputs:** new intake responses (delta) + new image set.
- **Outputs:** updated findings, causes, recommendations.
- **Evidence / Confidence / Explanation Blocks:** as in S7–S12.

#### S19. Audit / Provenance View (Clinician / Reviewer)
- **Purpose:** expose ledger and registry versions.
- **Inputs:** case ID.
- **Outputs:** ledger entries, registry versions, model version label.
- **Evidence Blocks:** ledger references.
- **Confidence Blocks:** none (factual record).
- **Explanation Blocks:** how to reconstruct any displayed value.

#### S20. Account / Consent Management
- **Purpose:** manage identity and consent.
- **Inputs:** user actions.
- **Outputs:** updated records.
- **Evidence Blocks:** consent version history.
- **Confidence Blocks:** N/A.
- **Explanation Blocks:** clear plain-language consent text.

### XIV.2 Screen Justification Rule

Every screen above must justify its existence by a specific intelligence output or governance requirement. Screens with no intelligence binding are prohibited.

---

## PART XV — ACCEPTANCE CRITERIA

The UX Contract is valid only when **all** of the following are true:

1. Every screen exists for a justified reason traced to an intelligence output or governance requirement.
2. Every displayed element traces to an intelligence output via registry IDs and ledger references.
3. Every recommendation traces to RDE outputs (Objective → Capability → Recommendation), with alternatives.
4. Every confidence value traces to evidence and to the Clinical Trust Layer's band mapping.
5. Every explanation is reconstructable from the Canonical Ledger and the registry version active at the time.
6. Every monitoring state is defined and bounded by the Trust Layer's noise floor.
7. Patient experience remains simple, calm, and honest.
8. Clinician experience remains rigorous, complete, and registry-linked.
9. No marketing language exists at any surface.
10. No unsupported claims exist at any surface.
11. No dark patterns exist at any surface.
12. Intake remains within the 18–20 question constraint, with all additions individually justified.
13. No screen, finding, cause, recommendation, or monitoring state is generated outside the authoritative intelligence layers.
14. Every override by a clinician is recorded alongside, never in place of, the system output.
15. Every image used to produce a finding meets Photography Standards thresholds; rejected images never feed conclusions.

A UX Contract failing any criterion is invalid and must be remediated before release.

---

**End of HAIROS_UX_CONTRACT_SPECIFICATION**
