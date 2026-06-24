# HAIROS — RECOMMENDATION DECISION ENGINE (RDE) CONSTITUTION

**Document Class:** Authoritative Reasoning Constitution.
**Authority Tier:** Subordinate to the HairOS Constitution, the Canonical Ledger & Contract Specification, the Clinical Intelligence Master Knowledge Model, Phase 5A (Registry Governance Constitution), Phase 5B (Registry Specification Constitution), the Signal Registry, the Root Cause Engine, and the Clinical Trust Layer.
**Scope:** The deterministic reasoning system that converts completed HairOS clinical intelligence into clinically defensible recommendations.
**Status:** Authoritative.
**Determinism Class:** Deterministic, auditable, clinically defensible, implementation-independent, explainable, modular, fail-closed.

This document is **not** a treatment guide, protocol book, diagnostic engine, pathway registry, root-cause registry, kit catalog, product catalog, or patient report. It contains no software, APIs, databases, UI, JSON, treatment protocols, or product catalogs. Where rules already exist in upstream artifacts, this document references them rather than restating them.

---

## PREAMBLE

The Recommendation Decision Engine (RDE) exists for one purpose: to define the deterministic reasoning system that transforms validated clinical intelligence into clinically defensible recommendations, while preserving the system's capacity to explain — at any moment, for any output — both why a recommendation was selected and why every alternative recommendation was not.

The RDE is reasoning. It is not knowledge. Knowledge lives upstream. Implementation lives downstream. The RDE governs only the disciplined chain that converts the one into the other.

The governing principle of this constitution is:

> **Recommendations may evolve. Reasoning integrity may not.**

---

# PART I — PURPOSE AND SCOPE

## §1. Purpose of the RDE

The Recommendation Decision Engine is the constitutional reasoning layer of HairOS. Its sole purpose is to:

- Consume validated outputs of the Root Cause Engine, the Signal Registry, the Clinical Trust Layer, and the Clinical Intelligence Master Knowledge Model.
- Apply the deterministic chain **Root Cause → Clinical Objective → Capability → Intervention Class → Recommendation Candidate → Kit Eligibility → Recommendation**.
- Produce explainable, ranked, audit-bound recommendations.
- Produce explainable, audit-bound exclusion rationales for every non-selected candidate.
- Propagate confidence without inflation.
- Honor escalation, contraindication, and uncertainty.
- Bind every recommendation to a fully reconstructable audit chain.

## §2. Boundaries

The RDE does **not**:

- Diagnose.
- Define root causes (consumes them).
- Define signals (consumes them).
- Define pathways (consumes upstream outputs only).
- Define interventions, products, kits, or protocols (consumes class-level abstractions only).
- Compose patient-facing communication (consumes capability and recommendation outputs to be rendered downstream).
- Decide pricing, supplier choice, inventory, or any commercial property.
- Persist patient data, manage storage, or expose APIs.

The RDE produces:

- A canonical, ordered set of admissible Recommendation Candidates per evaluation.
- A canonical, ordered ranking of those candidates under deterministic ranking principles.
- A canonical, complete exclusion rationale set for every non-admissible candidate.
- A canonical Explanation Set per recommendation (Part XI).
- A canonical Audit Chain per evaluation (Part XII).

## §3. Relationship to the Root Cause Engine

The Root Cause Engine is the RDE's principal upstream. The RDE consumes its outputs without modification:

- Ranked Root Causes with confidence categories.
- Composite-cause assertions where declared with compositeRule.
- Dissent records, exclusion records, and unresolved-ambiguity records.

The RDE does not re-rank causes. It does not adjudicate cause selection. It does not invent causes. Causes are inputs.

## §4. Relationship to Monitoring Systems

The RDE consumes monitoring outputs (Monitoring Registry, Escalation Registry) as inputs that modulate recommendation eligibility, ranking, and re-evaluation triggers. The RDE never authors monitoring markers, evaluation windows, or escalation rules. The RDE honors mandatory escalation deterministically and without weakening (per the Signal Registry SIG-49).

## §5. Relationship to Kits

Kits are downstream of the RDE. The RDE produces Recommendations at the capability and intervention-class level. Kit eligibility is the final gating step under Capability Map and Kit Knowledge registries (Phase 5A §17–§18) and Phase 5B Parts VIII–IX. The RDE asserts kit *eligibility classes*, not kit identities. Kit identity selection belongs to the Kit Knowledge layer under its own governance.

## §6. Constitutional Posture

The following statements are constitutional and binding:

- **Recommendations are outputs of reasoning.**
- **Recommendations are not root causes.**
- **Recommendations are not diagnoses.**
- **Recommendations are not products.**
- **Recommendations are not commercial choices.**
- **Recommendations are reconstructable through the audit chain or they are not authoritative.**

---

# PART II — CANONICAL RECOMMENDATION HIERARCHY

## §7. The Canonical Chain

The Recommendation Decision Engine operates on, and only on, the following hierarchy:

> **Root Cause → Clinical Objective → Capability → Intervention Class → Recommendation Candidate → Kit Eligibility → Recommendation**

This chain is constitutional. No reasoning step may skip a layer. No reasoning step may invert a layer. No reasoning step may resolve a downstream layer from an upstream layer without traversing the intermediate layers explicitly.

## §8. Layer Definitions

### §8.1 Root Cause
A canonical entry from the Cause Registry, accepted by the Root Cause Engine with a declared confidence category and provenance. Causes are the upstream evidentiary substrate of the RDE.

### §8.2 Clinical Objective
A biologically valid goal whose realization addresses one or more root causes at a mechanistic level. Objectives are defined under Part III. Objectives are biological aims, not interventions.

### §8.3 Capability
A biologically meaningful mechanism class through which one or more objectives may be advanced. Capabilities are defined under Part IV. Capabilities are not products; they are mechanism-of-action abstractions.

### §8.4 Intervention Class
A categorical grouping of interventions sharing delivery mode, regulatory class, and safety profile (e.g., topical, oral, procedural, behavioral, monitoring, referral, escalation). Intervention classes are defined under Part V. They are abstractions; they are never brands, products, or specific treatments.

### §8.5 Recommendation Candidate
A canonical proposal that, at a defined intervention class, in service of a defined capability, addresses a defined objective, traceable to a defined root cause. A candidate is admissible only if its upstream chain is intact.

### §8.6 Kit Eligibility
The class-level eligibility statement that downstream Kit Knowledge consumers may use to bind a Recommendation Candidate to a Kit. The RDE asserts eligibility classes, not Kit ids.

### §8.7 Recommendation
The terminal canonical output: a Recommendation Candidate that has passed eligibility, exclusion, ranking, and audit requirements, accompanied by its Explanation Set and Audit Chain.

## §9. Why Each Layer Exists

- **Root Cause** exists to ground the chain in upstream clinical truth.
- **Objective** exists to translate cause into biological aim, separating *why* from *how*.
- **Capability** exists to translate aim into mechanism-of-action abstraction, separating biology from delivery.
- **Intervention Class** exists to translate mechanism into delivery class, separating mechanism from specific treatment.
- **Recommendation Candidate** exists to assemble the chain as a discrete admissible proposal.
- **Kit Eligibility** exists to gate downstream Kit assembly without leaking Kit identity into the RDE.
- **Recommendation** exists as the final, audit-bound, explanation-bound output.

## §10. Layer Separation as a Constitutional Property

Layer separation is not an organizational convenience; it is a constitutional property. The RDE must never:

- Resolve a Recommendation directly from a Root Cause.
- Resolve a Kit directly from an Objective.
- Resolve an Intervention Class directly from a Root Cause without intervening Objective and Capability.
- Resolve a Capability without an upstream Objective.
- Resolve an Objective without an upstream Root Cause.

Any chain that compresses or skips layers is non-authoritative and is rejected fail-closed.

---

# PART III — CLINICAL OBJECTIVE FRAMEWORK

## §11. Definition of a Clinical Objective

A Clinical Objective is a biologically valid, evidence-supported goal whose realization addresses one or more root causes at the mechanistic level. An objective is:

- A biological aim, not an intervention.
- A what, not a how.
- Reachable, in principle, through one or more capabilities.
- Bounded by the reversibility ceiling of its underlying cause(s) (Clinical Intelligence Master Knowledge Model, Part VIII).
- Declarable as ordinal in priority but never as commercial preference.

## §12. Canonical Objective Examples

These canonical objectives are illustrative of the class; they are sourced from the Clinical Intelligence Master Knowledge Model and the Desired Effect Registry. The RDE does not author objectives; it consumes them.

- Reduce androgen burden on susceptible follicles.
- Reduce inflammatory activity (non-scarring or scarring class as declared upstream).
- Suppress cicatricial inflammation to halt extension.
- Normalize shedding dynamics.
- Restore follicular support (cycling, nutrient sufficiency, vascular adequacy).
- Preserve existing terminal hairs.
- Improve scalp environment (surface, microbiome, barrier).
- Normalize endocrine driver (thyroid, prolactin, androgen, insulin sensitivity, hormonal transitions).
- Resolve mechanical insult.
- Address psychogenic or behavioral driver.
- Restore follicular immune privilege (alopecia-areata class).
- Optimize cosmetic and mechanical practice.

## §13. Objective Rules

- **Rule O-R1.** Every objective in scope of an evaluation must trace upstream to at least one accepted Root Cause for the evaluation.
- **Rule O-R2.** Objectives are never declared without a biological target.
- **Rule O-R3.** Objectives are bounded by the reversibility ceiling of their underlying cause(s); objectives that propose recovery beyond the ceiling are inadmissible.
- **Rule O-R4.** Multiple objectives may serve a single root cause; multiple root causes may share a single objective.
- **Rule O-R5.** Objectives are ordinal, never cardinal. Priority is a category, not a scalar.
- **Rule O-R6.** Objectives never embed intervention or product identity.

## §14. Objective Quality Standards

An objective is admissible only if:

- It declares its biological target by canonical reference to upstream entries (Cause, Mechanism Graph, Signal).
- It declares its expected effect category.
- It declares its reversibility-ceiling-honoring scope.
- It declares its constraints, including contraindication-relevant boundaries.
- It declares its uncertainty category.

## §15. Objective Conflicts

Two objectives conflict when their joint pursuit would, by upstream biology, undermine one another. Conflicts must be:

- Declared explicitly at the objective layer.
- Resolved deterministically by the rules of §16.
- Recorded in the Audit Chain.

## §16. Objective Prioritization

Objective priority is determined deterministically by the following ordered criteria. The first criterion that discriminates resolves priority.

1. **Safety priority.** Objectives whose pursuit prevents irreversible harm (e.g., halt cicatricial extension) take strict precedence.
2. **Reversibility-window priority.** Objectives whose underlying biology is time-sensitive (e.g., resolve mechanical insult before cicatricial conversion) take precedence over time-insensitive objectives.
3. **Cause-confidence priority.** Objectives derived from higher-confidence accepted causes take precedence over those derived from lower-confidence causes.
4. **Mechanistic-coverage priority.** Objectives whose realization addresses multiple accepted causes take precedence over single-cause-coverage objectives.
5. **Evidence-strength priority.** Objectives whose expected effect is supported by higher tiers of the evidence hierarchy (Clinical Intelligence Master Knowledge Model §99) take precedence.
6. **Patient-context priority.** Objectives compatible with patient context (pregnancy, lactation, comorbidities) take precedence over those that conflict with context.

No criterion below the next-applied criterion may modify priority. No criterion outside the enumerated set is admissible.

---

# PART IV — CAPABILITY FRAMEWORK

## §17. Definition of a Capability

A Capability is a biologically meaningful mechanism-of-action abstraction through which one or more Objectives may be advanced. A capability:

- Is a class of mechanism, not a treatment.
- Is bound to upstream Mechanism Graph references.
- Is independent of delivery mode (delivery mode is the Intervention Class layer).
- Is independent of product identity.
- Inherits the reversibility and contraindication characteristics of its underlying mechanism class.

## §18. Canonical Capability Examples

These canonical capabilities are illustrative of the class; they are sourced from the Capability Map Registry. The RDE does not author capabilities; it consumes them.

- Androgen modulation.
- Growth-signal stimulation.
- Anti-inflammatory support (non-scarring class).
- Cicatricial-inflammation suppression.
- Nutritional correction (substrate sufficiency).
- Barrier restoration.
- Microbiome rebalancing.
- Follicular environment support (vascular and metabolic).
- Mechanical-insult reduction.
- Behavioral support (psychogenic, trichotillomania).
- Immune-privilege restoration (alopecia-areata class).
- Endocrine normalization support.
- Monitoring activation (capability of structured observation).
- Escalation activation (capability of structured referral).

## §19. Objective → Capability Mapping Principles

- **Rule C-R1.** Every capability admitted in an evaluation must trace upstream to at least one in-scope Objective.
- **Rule C-R2.** A single objective may be served by multiple capabilities; a single capability may serve multiple objectives.
- **Rule C-R3.** Capability admissibility honors mechanism reachability: the capability's mechanism must, by Mechanism Graph traversal, plausibly modify the objective's biological target.
- **Rule C-R4.** Capability admissibility honors patient context: a capability whose mechanism is contraindicated in the patient's declared context is inadmissible (Part VI).
- **Rule C-R5.** Capabilities never embed intervention or product identity. Capability is mechanism abstraction.

## §20. Biological Meaning Requirement

A capability is admissible only if it is biologically meaningful — that is, only if its mechanism is supported by upstream evidence at a tier admissible under the Clinical Intelligence Master Knowledge Model §99. Capabilities whose biology is unsupported or contradicted are inadmissible.

## §21. Prohibition of Product Identity

A capability is never a product. A capability is never a brand. A capability is never a SKU. Any attempt to encode product identity at the capability layer is a constitutional violation and is rejected fail-closed.

---

# PART V — INTERVENTION-CLASS FRAMEWORK

## §22. Definition of an Intervention Class

An Intervention Class is a categorical grouping of interventions sharing delivery mode, regulatory class, and safety profile. An Intervention Class:

- Describes *how* a capability is delivered, not *what specific* delivery is used.
- Is bounded by the regulatory and safety classes of its members.
- Is independent of brand, supplier, formulation, or specific treatment identity.

## §23. Canonical Intervention Class Set

The canonical Intervention Class set is:

- **Topical.** Delivery via the scalp surface.
- **Oral.** Delivery via systemic ingestion.
- **Procedural.** Delivery via in-clinic or device-mediated procedure.
- **Behavioral.** Delivery via patient-implemented behavior change.
- **Monitoring.** Delivery via structured observation (not a treatment, but an admissible recommendation class).
- **Referral.** Delivery via routing to an external clinical pathway.
- **Escalation.** Delivery via mandatory routing under safety or scarring-extension conditions.

Other classes may be added only through Phase 5A governance.

## §24. Capability → Intervention-Class Mapping

- **Rule I-R1.** Every Intervention Class admitted in an evaluation must trace upstream to at least one in-scope Capability.
- **Rule I-R2.** A capability may be expressible in multiple intervention classes; an intervention class may express multiple capabilities.
- **Rule I-R3.** Intervention-class admissibility honors regulatory and safety constraints (Part VI).
- **Rule I-R4.** Intervention-class admissibility honors the patient context: classes incompatible with declared context are inadmissible.
- **Rule I-R5.** Intervention classes do not embed specific treatment identities, brands, or products under any circumstance.

## §25. Prohibitions at the Intervention-Class Layer

At the Intervention Class layer the RDE must **not**:

- Define actual treatments.
- Define brands or products.
- Define dosages or specific protocols.
- Define commercial properties.
- Specify formulations.

These belong to the Intervention Library, the Kit Knowledge Registry, and downstream consumers under their own governance.

---

# PART VI — RECOMMENDATION ELIGIBILITY LOGIC

## §26. Becoming Eligible

A Recommendation Candidate becomes eligible when, and only when, all of the following hold deterministically:

- **E-1.** Its underlying Root Cause is among the accepted causes of the evaluation per the Root Cause Engine.
- **E-2.** Its supporting Objective is admissible under Part III for that cause.
- **E-3.** Its supporting Capability is admissible under Part IV for that objective.
- **E-4.** Its Intervention Class is admissible under Part V for that capability.
- **E-5.** No active exclusion (Part VIII) applies.
- **E-6.** No active contraindication (§28) applies.
- **E-7.** No active escalation override (§31) supersedes it.
- **E-8.** Its confidence (Part IX) meets the admissibility floor declared for its Intervention Class.
- **E-9.** Its kit-eligibility class is non-empty for the evaluation context.
- **E-10.** Its audit chain is complete and reconstructable (Part XII).

A candidate that fails any of E-1 through E-10 is ineligible.

## §27. Becoming Ineligible

A previously eligible candidate becomes ineligible when any of the following occurs:

- An upstream cause loses acceptance under re-evaluation by the Root Cause Engine.
- An objective conflicts with a higher-priority objective per §16.
- A capability becomes inadmissible due to new patient-context evidence.
- An intervention class becomes inadmissible due to regulatory or safety constraint change.
- A contraindication newly applies (§28).
- An escalation override newly applies (§31).
- Confidence falls below the admissibility floor.
- The audit chain is no longer reconstructable.

Ineligibility is recorded with its triggering condition. Silent ineligibility is forbidden.

## §28. Contraindications

Contraindications are inherited from upstream registries (Intervention Library, Capability Map, Communication Registry safety subset). The RDE consumes them; it does not author them. Two classes apply:

- **Biological contraindications.** The candidate's mechanism is biologically incompatible with the patient's biology (e.g., regrowth-targeted candidate in a scarred zone).
- **Contextual contraindications.** The candidate is incompatible with the patient's declared context (pregnancy, lactation, pediatric, comorbidities, drug interactions).

A contraindicated candidate is ineligible. Contraindication is recorded in the Exclusion Framework (Part VIII) and the Audit Chain (Part XII).

## §29. Conflict Handling

Two candidates conflict when their joint selection would, by upstream biology or safety, undermine one another or the patient. Conflict handling is deterministic:

- **C-H1.** Detect the conflict by canonical declaration from upstream registries.
- **C-H2.** Resolve by the Objective Prioritization order (§16), then by Capability biological-fit, then by Intervention Class safety profile.
- **C-H3.** Record both the resolution and the displaced candidate's exclusion rationale.
- **C-H4.** Never resolve silently. Never resolve by commercial preference. Never resolve by marketing preference.

## §30. Suppression

Suppression at the recommendation layer operates only through upstream declarations (Signal Registry suppression, Cause Registry exclusion, Capability Map contraindication). The RDE never invents suppression. Suppression reduces confidence or removes admissibility deterministically; it never inverts a candidate's meaning.

## §31. Uncertainty Propagation

Uncertainty at any upstream layer (signal, pathway, cause) propagates to the recommendation layer per Part IX. The RDE never collapses uncertainty into false confidence. Where uncertainty exceeds the admissibility floor for an Intervention Class, the candidate becomes ineligible regardless of other factors.

## §32. Escalation Override

Escalation conditions, when present, override recommendation eligibility deterministically:

- **EO-1.** Mandatory escalation signals (Signal Registry §SIG-MN-011 through §SIG-MN-015 and equivalents) require that the only admissible terminal output be a Recommendation of Intervention Class **Escalation** (or **Referral**, where appropriate), with the escalation rationale carried in the Explanation Set.
- **EO-2.** Other candidates of other Intervention Classes are not removed from the audit chain; they are recorded as deferred under escalation override, with rationale.
- **EO-3.** Escalation override never silences alternative reasoning; it gates the terminal output only.

---

# PART VII — RECOMMENDATION RANKING LOGIC

## §33. Deterministic Ranking Principles

Ranking of eligible Recommendation Candidates is deterministic. The ordered criteria below are applied in sequence. The first criterion that discriminates between two candidates resolves their relative order; subsequent criteria are not applied to that pair.

1. **Safety dominance.** Candidates whose realization prevents irreversible harm rank first.
2. **Escalation dominance.** Where escalation override applies (§31), the escalation candidate ranks above all non-escalation candidates absolutely.
3. **Reversibility-window priority.** Candidates serving time-sensitive objectives rank above time-insensitive candidates.
4. **Objective priority.** Per §16.
5. **Cause-confidence priority.** Candidates derived from higher-confidence accepted causes rank above those derived from lower-confidence causes.
6. **Capability biological-fit priority.** Candidates whose Capability mechanism more directly addresses the upstream cause (by Mechanism Graph traversal) rank above less direct candidates.
7. **Intervention-class safety priority.** Within a tie, lower-risk Intervention Classes rank above higher-risk classes.
8. **Evidence-strength priority.** Per Clinical Intelligence Master Knowledge Model §99.
9. **Mechanistic-coverage priority.** Candidates addressing more accepted causes rank above narrower candidates.
10. **Patient-context fit priority.** Candidates better aligned with declared patient context rank above less aligned candidates.
11. **Canonical tie-break.** Where all preceding criteria are equivalent, candidates are ordered by canonical id in canonical order. This guarantees byte-deterministic ranking under independent implementations.

## §34. Prohibited Ranking Inputs

The RDE must **never** rank based on:

- Revenue.
- Commercial preference.
- Marketing preference.
- Brand identity.
- Inventory availability.
- Supplier preference.
- Promotional cadence.
- User-visible aesthetics of any kind.

Any attempt to introduce such inputs into the ranking path is a constitutional violation and is rejected fail-closed.

## §35. Sole Admissible Ranking Sources

Ranking derives only from:

- Accepted Root Causes and their confidence.
- Admissible Clinical Objectives and their priority.
- Admissible Capabilities and their biological fit.
- Admissible Intervention Classes and their safety class.
- Eligibility and contraindication state.
- Confidence propagated per Part IX.
- Patient context as declared upstream.

No other input may enter the ranking computation.

## §36. Ranking Determinism Requirement

Two independent implementations, given identical inputs, must produce identical ranking outputs by canonical equality of the ranked candidate set, including ordering and tie resolution. Any divergence is a release-blocking parity failure under Phase 5A §50.

---

# PART VIII — RECOMMENDATION EXCLUSION FRAMEWORK

## §37. Reasons for Exclusion

Exclusion of a Recommendation Candidate occurs for one or more of the following deterministic reasons:

- **EX-1.** Upstream cause not accepted.
- **EX-2.** Objective inadmissible (e.g., proposes recovery beyond ceiling).
- **EX-3.** Objective deprioritized under §16 by conflicting higher-priority objective.
- **EX-4.** Capability biologically inadmissible for the patient.
- **EX-5.** Intervention Class regulatorily or contextually inadmissible.
- **EX-6.** Biological contraindication active.
- **EX-7.** Contextual contraindication active.
- **EX-8.** Conflict with higher-ranked candidate resolved against this candidate.
- **EX-9.** Confidence below admissibility floor.
- **EX-10.** Suppressed by upstream declaration.
- **EX-11.** Escalation override deferred this candidate.
- **EX-12.** Kit eligibility class empty for evaluation context.
- **EX-13.** Audit chain incomplete or non-reconstructable.

## §38. Required Exclusion Rationale Generation

Every excluded candidate generates a canonical Exclusion Rationale comprising:

- The candidate's identity (intervention class and capability and objective and cause chain).
- The exclusion code (EX-1 through EX-13).
- The deterministic predicate that produced the exclusion.
- The upstream entries referenced (cause id, signal ids, monitoring marker ids where applicable).
- The release versions of the registries consulted.

## §39. Auditability of Exclusion

Every exclusion is audit-bound. The Exclusion Rationale is part of the Audit Chain (Part XII). It is immutable for the evaluation. It is reconstructable by independent implementations from manifests alone.

## §40. Prohibition of Silent Exclusions

**No silent exclusions are admissible.** A candidate that is not selected must be either:

- Eligible and ranked below the selected candidate (and recorded as such with ranking rationale), or
- Excluded with an Exclusion Rationale recorded explicitly.

A candidate that disappears from the evaluation without record is a constitutional violation and is rejected fail-closed.

---

# PART IX — CONFIDENCE PROPAGATION FRAMEWORK

## §41. Confidence Chain

Confidence flows through the canonical chain:

> **Signal → Pathway → Root Cause → Objective → Capability → Recommendation Candidate → Recommendation**

At each step the RDE computes a categorical confidence (Reference / Low / Moderate / High / Very High) deterministically from the upstream layer's confidence, the strength of the relationship, and any modulating factors (suppression, conflict, contraindication-adjacent uncertainty).

## §42. Computational Discipline

- **CP-1.** Confidence is categorical. It is never a hidden scalar. If numeric internally, the canonical confidence emitted to the Recommendation layer is categorical.
- **CP-2.** Downstream confidence may not exceed upstream confidence. Confidence is bounded above by the weakest required link in the chain.
- **CP-3.** Confidence at a layer is computed deterministically from declared inputs only.
- **CP-4.** Confidence is propagated, never invented. The RDE may reduce or preserve confidence; it may never inflate confidence.

## §43. Inflation Prohibitions

The following inflations are forbidden and are rejected fail-closed:

- **INF-1.** Aggregating multiple Moderate signals into High confidence without a declared canonical rule supporting the aggregation.
- **INF-2.** Promoting confidence on the basis of repeated occurrence within a single evaluation.
- **INF-3.** Promoting confidence on the basis of patient persistence or repetition of report.
- **INF-4.** Promoting confidence on the basis of commercial considerations.
- **INF-5.** Promoting confidence on the basis of consumer-facing presentation aesthetics.

## §44. Unsupported Certainty Prevention

Confidence at the Recommendation layer must not exceed:

- The confidence of the accepted Root Cause(s) supporting it.
- The strength of evidence (Clinical Intelligence Master Knowledge Model §99) supporting the objective's expected effect.
- The biological-fit confidence of the Capability mechanism with respect to the objective's target.
- The safety-margin confidence of the Intervention Class for the patient context.

Any of the above reduces the terminal confidence. None may increase it.

## §45. Confidence Recording

Every recommendation records its terminal confidence category and the full propagation trace as part of its Explanation Set (Part XI) and Audit Chain (Part XII).

---

# PART X — MONITORING AND RE-EVALUATION FRAMEWORK

## §46. Recommendation Validity Monitoring

Every Recommendation declares, by reference to the Monitoring Registry, the monitoring markers that govern its ongoing validity. The RDE does not author markers; it binds them.

## §47. Reassessment Triggers

A Recommendation is reassessed by the RDE when any of the following occurs:

- A defined monitoring interval elapses.
- A monitoring marker fires (improvement, stability, progression, regression, recurrence, loss-of-response).
- An escalation signal arises.
- Patient context changes (pregnancy state, medication, comorbidity, age category).
- An upstream registry release pin changes the accepted cause or capability set.

## §48. Loss-of-Response Handling

When a Loss-of-Response signal (Signal Registry §SIG-MN-009) is recorded, the RDE:

- Reduces the Recommendation's terminal confidence per Part IX.
- Recomputes eligibility and ranking with the loss-of-response signal active.
- If admissibility falls below the floor, the Recommendation is withdrawn under an EX-9 (confidence below floor) or EX-13 (chain integrity) rationale, as applicable.
- Triggers re-evaluation of alternative candidates whose ranks may now have changed.

## §49. Progression Handling

When a Progression Signal (Signal Registry §SIG-MN-006 or §SIG-MN-007) is recorded:

- The RDE re-evaluates Objective priority under §16, including any time-sensitive reversibility-window priority shifts.
- If new structural-injury signals (Signal Registry §SIG-MN-011) are present, the Reversibility relevance of affected candidates is updated, potentially reducing their Objective from recovery-class to preservation-class objectives.
- Escalation override may apply per §31.

## §50. Recovery Handling

When Improvement Signals (Signal Registry §SIG-MN-001 through §SIG-MN-004) are recorded:

- The RDE preserves the current Recommendation by default unless monitoring markers indicate transition to a Stability-only recommendation class.
- Recovery does not authorize confidence inflation. Confidence remains bounded by upstream constraints.
- Reassessment cadence may be adjusted by reference to the Monitoring Registry, never by the RDE inventing new cadence.

## §51. Stability Handling

When Stability Signals (Signal Registry §SIG-MN-005) are recorded, the RDE continues the current Recommendation, schedules reassessment per Monitoring Registry cadence, and records continuity in the Audit Chain.

## §52. Re-Evaluation Determinism

All re-evaluation outcomes must be deterministic under identical inputs. Two independent implementations re-evaluating the same state must produce identical outcomes, including Recommendation continuity, withdrawal, and re-ranking.

---

# PART XI — EXPLANATION LAYER

## §53. Mandatory Explainability Outputs

Every Recommendation must produce, atomically with its emission, a canonical Explanation Set. The Explanation Set is not optional. A Recommendation without a complete Explanation Set is non-authoritative.

## §54. Required Elements of the Explanation Set

For every emitted Recommendation, the Explanation Set must include:

- **Supporting Root Causes.** Canonical ids and confidence categories of the accepted causes that authorize the Recommendation.
- **Supporting Objectives.** Canonical ids of the in-scope objectives, with priority rank under §16.
- **Supporting Capabilities.** Canonical ids of the in-scope capabilities, with biological-fit category.
- **Supporting Intervention Class.** The selected intervention class and the safety-class rationale.
- **Supporting Evidence.** Canonical references to upstream evidence per Clinical Intelligence Master Knowledge Model §99.
- **Exclusion Rationale Set.** For every alternative candidate not selected, a canonical Exclusion Rationale per Part VIII.
- **Confidence Rationale.** The propagation trace per Part IX, with all bounding-link disclosures.
- **Monitoring Plan Binding.** The canonical references to the monitoring markers governing the Recommendation's validity.
- **Escalation Status.** Whether escalation override applied and, if so, its triggering signal.
- **Reversibility Context.** The reversibility-ceiling category of the Recommendation's objective for the patient's affected zones.

## §55. The "Why" and "Why Not" Requirement

Every Recommendation must, by virtue of the Explanation Set, be capable of answering:

- **Why was this Recommendation selected?** By Recommendation, by Objective, by Capability, by Intervention Class, by Cause, by Confidence.
- **Why were alternative Recommendations not selected?** By Exclusion Rationale, by ranking inferiority, by contraindication, by suppression, by escalation deferral.

A Recommendation that cannot answer both is non-authoritative.

## §56. Explanation Determinism

Explanation Sets are deterministic. Two independent implementations must produce byte-identical Explanation Sets for identical inputs and identical registry versions, with canonical ordering of all enumerated elements.

## §57. Explanation Layer Prohibitions

The Explanation Set must not:

- Contain persuasion, urgency, scarcity, fear framing, or comparative-superiority claims.
- Contain commercial constructs.
- Conceal uncertainty.
- Omit displaced alternatives.
- Embed brand, product, or pricing identity.
- Vary in canonical content based on consumer-presentation aesthetics.

---

# PART XII — AUDIT CHAIN FRAMEWORK

## §58. The Canonical Audit Chain

Every evaluation produces a canonical Audit Chain in the following order:

> **Question → Signal → Pathway → Root Cause → Objective → Capability → Intervention Class → Recommendation Candidate → Kit Eligibility → Recommendation**

The chain is the constitutional record of the reasoning. It is immutable for the evaluation, sealed under the Canonical Ledger, and bound by deterministic hashing per Phase 5A §42–§44.

## §59. Audit Chain Components

For each evaluation, the Audit Chain enumerates:

- The intelligence inputs (canonical question ids, answers, image findings, monitoring events).
- The signals admitted (canonical Signal Registry ids with quality classes).
- The pathways consulted (canonical Pathway Registry ids with activation outcomes).
- The root causes evaluated and accepted (canonical Cause Registry ids with confidence).
- The objectives in scope (canonical Desired Effect Registry / Objective Template Registry ids with priority).
- The capabilities admitted (canonical Capability Map Registry ids with biological-fit category).
- The intervention classes considered (with safety classifications).
- The recommendation candidates assembled (with eligibility outcomes).
- The kit-eligibility class assertions (without Kit identity).
- The recommendation(s) emitted (with Explanation Sets).
- The registry release versions consulted (pinned).
- The engine versions consulted (pinned).
- The Audit Chain hash and the evaluation seal hash.

## §60. Full Reconstructability Requirement

The Audit Chain must permit complete reconstruction of the evaluation's reasoning by any independent auditor:

- Given the Audit Chain, the pinned registry releases, and the pinned engine versions, an independent implementation must reproduce the same Recommendation set, the same Explanation Sets, and the same Audit Chain hash.
- Reconstruction must succeed without recourse to implementation internals.
- Reconstruction must produce byte-identical output per Phase 5A §46.

## §61. Audit Chain Immutability

Once sealed, the Audit Chain is immutable. Corrections occur only by issuing a subsequent evaluation that supersedes the prior, with both retained in the historical record.

## §62. Audit Chain Determinism

Two independent implementations produce identical Audit Chains for identical inputs and pinned registry / engine versions. Any divergence is a release-blocking parity failure per Phase 5A §50.

---

# PART XIII — INTEGRITY CONSTRAINTS

The following constraints extend, and do not supersede, those of Phase 5A (RIC-01…RIC-35), Phase 5B (RS-01…RS-32), and the Signal Registry (SIG-01…SIG-50). Each declares Purpose, Rule, and Failure Behavior. All failures are fail-closed.

## RDE-01 — Chain Completeness Integrity
- **Purpose.** Enforce the canonical hierarchy.
- **Rule.** No Recommendation may be emitted without a complete chain from accepted Root Cause through Objective, Capability, Intervention Class, Recommendation Candidate, and Kit Eligibility.
- **Failure Behavior.** Recommendation rejected; evaluation aborted at the failing layer.

## RDE-02 — No Layer Skipping Integrity
- **Purpose.** Prevent compression of reasoning.
- **Rule.** No reasoning step may resolve a downstream layer from an upstream layer without traversing each intermediate layer explicitly.
- **Failure Behavior.** Integrity incident; chain rejected.

## RDE-03 — Direct Cause-to-Kit Prohibition
- **Purpose.** Forbid the most dangerous compression.
- **Rule.** A Kit Eligibility class may never be asserted directly from a Root Cause without intervening Objective, Capability, Intervention Class, and Recommendation Candidate.
- **Failure Behavior.** Integrity incident; chain rejected.

## RDE-04 — Diagnosis Prohibition
- **Purpose.** Preserve reasoning-only posture.
- **Rule.** The RDE may not assert a diagnosis, label a condition, or relabel an upstream cause as a diagnosis.
- **Failure Behavior.** Integrity incident; output rejected.

## RDE-05 — Marketing Influence Prohibition
- **Purpose.** Preserve clinical defensibility.
- **Rule.** No marketing input may enter eligibility, ranking, exclusion, or confidence computation.
- **Failure Behavior.** Integrity incident; release blocked.

## RDE-06 — Hidden Weighting Prohibition
- **Purpose.** Preserve auditability.
- **Rule.** No opaque scalar, learned weight, or hidden coefficient may modify eligibility, ranking, or exclusion. Every modulating factor must be a declared categorical or canonical rule.
- **Failure Behavior.** Integrity incident.

## RDE-07 — Confidence Inflation Prohibition
- **Purpose.** Preserve evidentiary honesty.
- **Rule.** Recommendation confidence may not exceed upstream-bounded confidence per Part IX.
- **Failure Behavior.** Recommendation rejected.

## RDE-08 — Silent Exclusion Prohibition
- **Purpose.** Preserve auditability of alternatives.
- **Rule.** Every non-selected candidate must be either ranked below the selected candidate with rationale or excluded with a canonical Exclusion Rationale.
- **Failure Behavior.** Integrity incident.

## RDE-09 — Objective Bypass Prohibition
- **Purpose.** Preserve mechanistic discipline.
- **Rule.** No Recommendation may be produced without an in-scope Objective.
- **Failure Behavior.** Recommendation rejected.

## RDE-10 — Capability Bypass Prohibition
- **Purpose.** Preserve mechanism-of-action discipline.
- **Rule.** No Recommendation may be produced without an admissible Capability.
- **Failure Behavior.** Recommendation rejected.

## RDE-11 — Intervention-Class Bypass Prohibition
- **Purpose.** Preserve delivery-class discipline.
- **Rule.** No Recommendation may be produced without an admissible Intervention Class.
- **Failure Behavior.** Recommendation rejected.

## RDE-12 — Unsupported Recommendation Prohibition
- **Purpose.** Preserve evidentiary chain.
- **Rule.** Every Recommendation must trace through pinned registry versions to evidence of admissible tier per Clinical Intelligence Master Knowledge Model §99.
- **Failure Behavior.** Recommendation rejected.

## RDE-13 — Mandatory Escalation Honoring Integrity
- **Purpose.** Preserve safety dominance.
- **Rule.** When a mandatory escalation signal is present, the terminal Recommendation must be of Intervention Class Escalation or Referral as applicable.
- **Failure Behavior.** Integrity incident; output rejected.

## RDE-14 — Contraindication Honoring Integrity
- **Purpose.** Preserve patient safety.
- **Rule.** Contraindicated candidates may never be selected.
- **Failure Behavior.** Recommendation rejected.

## RDE-15 — Reversibility-Ceiling Honoring Integrity
- **Purpose.** Prevent biologically indefensible objectives.
- **Rule.** Objectives proposing recovery beyond the upstream reversibility ceiling are inadmissible; their downstream candidates are rejected.
- **Failure Behavior.** Candidate rejected.

## RDE-16 — Tie-Break Determinism Integrity
- **Purpose.** Guarantee byte-deterministic ranking.
- **Rule.** All ranking ties resolve by canonical id ordering as declared in §33 criterion 11.
- **Failure Behavior.** Parity failure; release blocked.

## RDE-17 — Audit Chain Completeness Integrity
- **Purpose.** Preserve reconstructability.
- **Rule.** Every emitted Recommendation must carry a complete Audit Chain per Part XII.
- **Failure Behavior.** Recommendation non-authoritative.

## RDE-18 — Explanation Set Completeness Integrity
- **Purpose.** Preserve explainability.
- **Rule.** Every emitted Recommendation must carry a complete Explanation Set per Part XI.
- **Failure Behavior.** Recommendation non-authoritative.

## RDE-19 — Why-Not Completeness Integrity
- **Purpose.** Guarantee alternative-rationale completeness.
- **Rule.** Every alternative candidate considered must be enumerated in the Explanation Set with its rationale (ranking-inferior or excluded).
- **Failure Behavior.** Integrity incident.

## RDE-20 — Determinism Integrity
- **Purpose.** Preserve replay parity.
- **Rule.** Identical inputs and pinned registry / engine versions must produce identical Recommendations, Explanation Sets, and Audit Chains across independent implementations.
- **Failure Behavior.** Release-blocking parity failure.

## RDE-21 — Pinned Version Integrity
- **Purpose.** Eliminate latent registry drift.
- **Rule.** Every evaluation must pin all consulted registry releases and engine versions at the evaluation seal.
- **Failure Behavior.** Evaluation non-authoritative.

## RDE-22 — Conflict-Resolution Determinism Integrity
- **Purpose.** Eliminate silent conflict handling.
- **Rule.** Conflicts must resolve per §29; resolutions must be recorded; never silent.
- **Failure Behavior.** Integrity incident.

## RDE-23 — Suppression Discipline Integrity
- **Purpose.** Eliminate invented suppression.
- **Rule.** Suppression is admissible only via upstream declarations; the RDE may not invent or amplify suppression beyond upstream definitions.
- **Failure Behavior.** Integrity incident.

## RDE-24 — Patient-Context Honoring Integrity
- **Purpose.** Preserve contextual safety.
- **Rule.** Eligibility and ranking must honor declared patient context (pregnancy, lactation, pediatric, comorbidities, drug interactions).
- **Failure Behavior.** Recommendation rejected.

## RDE-25 — Kit Identity Prohibition at the RDE Layer
- **Purpose.** Preserve layer separation.
- **Rule.** The RDE may assert Kit Eligibility classes only; it may not assert Kit identities.
- **Failure Behavior.** Integrity incident.

## RDE-26 — Product Identity Prohibition
- **Purpose.** Preserve commercial-blindness.
- **Rule.** No Recommendation, Capability, Intervention Class, or Objective in the RDE may carry product identity, brand, supplier, formulation, or SKU.
- **Failure Behavior.** Recommendation rejected.

## RDE-27 — Commercial Input Prohibition
- **Purpose.** Preserve neutrality.
- **Rule.** No commercial input may modify any RDE computation at any point.
- **Failure Behavior.** Integrity incident; release blocked.

## RDE-28 — Confidence Categoricity Integrity
- **Purpose.** Preserve explainability.
- **Rule.** Recommendation confidence emitted to downstream consumers must be categorical, drawn from the canonical confidence vocabulary.
- **Failure Behavior.** Integrity incident.

## RDE-29 — Monitoring Binding Integrity
- **Purpose.** Preserve validity tracking.
- **Rule.** Every Recommendation must bind to one or more Monitoring Registry markers governing its validity.
- **Failure Behavior.** Recommendation rejected.

## RDE-30 — Loss-of-Response Discipline Integrity
- **Purpose.** Preserve responsiveness.
- **Rule.** Loss-of-Response signals must trigger re-evaluation per §48; silent continuity is forbidden.
- **Failure Behavior.** Integrity incident.

## RDE-31 — Progression Discipline Integrity
- **Purpose.** Preserve safety on progression.
- **Rule.** Progression signals must trigger re-evaluation per §49.
- **Failure Behavior.** Integrity incident.

## RDE-32 — Recovery Discipline Integrity
- **Purpose.** Preserve maintenance discipline.
- **Rule.** Recovery signals may not authorize confidence inflation; continuity vs. transition is determined deterministically per §50.
- **Failure Behavior.** Integrity incident.

## RDE-33 — Audit Chain Immutability Integrity
- **Purpose.** Preserve historical truth.
- **Rule.** A sealed Audit Chain is immutable; corrections are issued only by superseding evaluations.
- **Failure Behavior.** Integrity incident; corrupted chain non-authoritative.

## RDE-34 — Vocabulary Conformance Integrity
- **Purpose.** Bind controlled enumerations.
- **Rule.** All categorical fields (Intervention Class, confidence category, exclusion code, objective priority, capability biological-fit) must draw from the RDE's controlled vocabularies at the evaluation's pinned releases.
- **Failure Behavior.** Evaluation rejected.

## RDE-35 — Pediatric Discipline Integrity
- **Purpose.** Preserve pediatric safety.
- **Rule.** Pediatric context propagates eligibility constraints throughout the chain; pediatric escalation per Signal Registry SIG-24 is honored without weakening.
- **Failure Behavior.** Integrity incident.

## RDE-36 — Pregnancy / Lactation Discipline Integrity
- **Purpose.** Preserve reproductive safety.
- **Rule.** Pregnancy, suspected pregnancy, planned pregnancy, and lactation propagate mandatory eligibility constraints and may force escalation; never weakened.
- **Failure Behavior.** Integrity incident.

## RDE-37 — Cicatricial-Zone Reversibility Discipline Integrity
- **Purpose.** Honor irreversibility.
- **Rule.** Candidates proposing recovery in zones bearing structural-injury signals are inadmissible.
- **Failure Behavior.** Candidate rejected under RDE-15.

## RDE-38 — Composite Cause Discipline Integrity
- **Purpose.** Honor multifactorial reasoning.
- **Rule.** Composite causes (Clinical Intelligence Master Knowledge Model §48) require that each constituent be independently evaluable; recommendations from composite causes must trace through declared compositeRule.
- **Failure Behavior.** Recommendation rejected.

## RDE-39 — Dissent Carriage Integrity
- **Purpose.** Preserve clinical dissent provenance.
- **Rule.** Where the Root Cause Engine records dissent against an accepted cause, downstream recommendations must carry the dissent record in the Explanation Set without suppression.
- **Failure Behavior.** Explanation Set non-authoritative.

## RDE-40 — No Confidence-Reinforcement Loops Integrity
- **Purpose.** Prevent self-reinforcing certainty.
- **Rule.** A Recommendation's emission may not feed back into the confidence computation of its supporting causes or objectives within the same or subsequent evaluations.
- **Failure Behavior.** Integrity incident.

## RDE-41 — Ranking Reproducibility Integrity
- **Purpose.** Preserve replay parity for ranks.
- **Rule.** Ranking outputs must be byte-identical across independent implementations under identical pinned inputs.
- **Failure Behavior.** Release-blocking parity failure.

## RDE-42 — Exclusion Reproducibility Integrity
- **Purpose.** Preserve replay parity for exclusions.
- **Rule.** Exclusion Rationales must be byte-identical across independent implementations under identical pinned inputs.
- **Failure Behavior.** Release-blocking parity failure.

## RDE-43 — Layer Vocabulary Sovereignty Integrity
- **Purpose.** Preserve domain ownership.
- **Rule.** Objectives, Capabilities, and Intervention Classes are defined by their owning upstream registries; the RDE may neither author nor mutate them.
- **Failure Behavior.** Integrity incident.

## RDE-44 — Patient-Distress Honoring Integrity
- **Purpose.** Honor psychological-support pathway.
- **Rule.** Patient distress at declared threshold (Signal Registry SIG-26) propagates a mandatory escalation to the support pathway in the terminal Recommendation set without altering biological assertions.
- **Failure Behavior.** Integrity incident.

## RDE-45 — Communication-Layer Boundary Integrity
- **Purpose.** Preserve layer separation.
- **Rule.** The RDE emits canonical Recommendations and Explanation Sets only; it does not render patient-facing communication. Communication is the Communication Registry's exclusive domain.
- **Failure Behavior.** Integrity incident.

## RDE-46 — Empty-Set Honesty Integrity
- **Purpose.** Honor cases with no admissible Recommendation.
- **Rule.** When no candidate is admissible, the RDE emits an empty Recommendation set with a complete Audit Chain and an Explanation Set documenting why no admissible candidate exists.
- **Failure Behavior.** Silent emptiness is forbidden; absence must be explained.

## RDE-47 — Uncertainty Declaration Integrity
- **Purpose.** Preserve evidentiary humility.
- **Rule.** Where uncertainty bounds confidence below the admissibility floor, the RDE must declare it explicitly in the Explanation Set rather than silently selecting a lower-confidence Recommendation.
- **Failure Behavior.** Integrity incident.

## RDE-48 — Constitutional Hierarchy Integrity
- **Purpose.** Honor upstream authority.
- **Rule.** Where any clause of this constitution conflicts with the HairOS Constitution, the Canonical Ledger, Phase 5A, Phase 5B, the Clinical Intelligence Master Knowledge Model, the Signal Registry, the Root Cause Engine, or the Clinical Trust Layer, those documents prevail.
- **Failure Behavior.** Conflicting RDE content non-authoritative.

All RDE-01 through RDE-48 failures are fail-closed.

---

# PART XIV — ACCEPTANCE CRITERIA

## §63. Validity Conditions

The Recommendation Decision Engine is valid only if it is:

- **Deterministic.** Identical inputs and pinned registry / engine versions produce byte-identical Recommendations, Explanation Sets, and Audit Chains across independent implementations.
- **Auditable.** Every emission is reconstructable from pinned manifests and the Canonical Ledger by independent auditors without recourse to implementation internals.
- **Clinically defensible.** Every emission traces through pinned upstream evidence at admissible evidence tiers.
- **Implementation-independent.** No clause of this constitution constrains storage, APIs, transport, runtime, programming language, or user interface.
- **Explainable.** Every emission answers, by virtue of its Explanation Set, both "why this Recommendation" and "why not the alternatives."
- **Modular.** Each layer of the canonical hierarchy is owned by an upstream registry; the RDE composes these layers without authoring or mutating them.
- **Fail-closed.** Every integrity constraint failure halts the failing chain and is recorded; no degraded mode is admissible.

## §64. Permanence Clause

This constitution is the authoritative reasoning law of HairOS. It defines how clinical intelligence becomes a clinically defensible recommendation, and how every such recommendation is bound for all time to its complete chain of causes, objectives, capabilities, intervention classes, candidates, exclusions, confidences, explanations, and audit records.

No clause of this constitution permits derogation from determinism, auditability, layer separation, escalation honoring, contraindication honoring, reversibility-ceiling honoring, silent-exclusion prohibition, marketing-influence prohibition, commercial-input prohibition, or confidence-inflation prohibition.

Where any clause of this constitution conflicts with the HairOS Constitution, the Canonical Ledger & Contract Specification, the Registry Governance Constitution (Phase 5A), the Registry Specification Constitution (Phase 5B), the Clinical Intelligence Master Knowledge Model, the Signal Registry, the Root Cause Engine, or the Clinical Trust Layer, those documents prevail. Where ambiguity arises within this constitution, the stricter, more conservative, and more evidentiarily honest interpretation prevails. Where any rule appears to permit unconstrained extension, the interpretation that preserves auditability, replay fidelity, layer separation, and patient safety prevails.

> **Recommendations may evolve. Reasoning integrity may not.**

— End of HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION —
