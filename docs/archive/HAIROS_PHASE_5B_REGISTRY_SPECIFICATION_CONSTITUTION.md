# HAIROS — PHASE 5B

# REGISTRY SPECIFICATION CONSTITUTION

**Document Class:** Constitutional Specification Artifact
**Authority Tier:** Tier 4 — Subordinate to:
1. HairOS Constitutional Architecture v1.0
2. Canonical Ledger & Contract Specification v1.0
3. Registry Governance Constitution (Phase 5A)

**Scope:** The schema of every HairOS registry entry, the validation it must satisfy, the references it may carry, the versioning and lifecycle it must honor, and the traceability and determinism guarantees it must uphold.

**Status:** Authoritative.

**Determinism Class:** Fail-closed, implementation-independent, replay-grade.

---

## PREAMBLE

This document specifies *what a registry entry is* in HairOS. It does not create any entries. It does not exhibit any. It does not prescribe storage, APIs, code, or interchange formats. Where Phase 5A defined how registries are governed, this document defines what the governed objects must contain.

Where a rule already exists in the Constitution, the Canonical Ledger, or Phase 5A, this document references it rather than restating it. Where this document defines a rule, it is binding on every conforming registry.

The governing principle of this specification is:

> **Knowledge is data. Registries are constitutional assets. Registries may evolve. Meaning may not drift.**

---

# PART I — FOUNDATIONS

## §1. Defined Terms

### §1.1 Registry
A registry is the authoritative, owned, versioned collection of canonical entries of a single knowledge class, as governed by Phase 5A. For the purposes of this specification, a registry is the namespace within which entry identity and schema are defined.

### §1.2 Registry Entry
A registry entry is the smallest authoritative unit of registry knowledge. It bears a canonical identifier, a typed schema conforming to this specification, a lifecycle state, declared dependencies, provenance, and an entry hash.

### §1.3 Registry Manifest
A registry manifest is the declarative, deterministically serialized enumeration of all entries belonging to a registry release, together with the metadata, dependencies, and hashes sufficient to reconstruct and verify the release.

### §1.4 Registry Version
A registry version is the monotonic identifier of one sealed release of a registry. A version refers, immutably and for all time, to exactly one release.

### §1.5 Registry Release
A registry release is the sealed, ledger-bound, immutable publication of a registry at a specific version, comprising its manifest, its entries in their published lifecycle states, and its seal hash.

## §2. Constitutional Posture

### §2.1 Knowledge is Data
Registry entries are data. They are inert. They do not execute. They do not infer. They are interpreted by engines, never by themselves.

### §2.2 Registries are Constitutional Assets
Registries are not application configuration. They are constitutionally protected assets whose evolution is bound by Phase 5A and whose schema is bound by this document.

### §2.3 Evolution Permitted, Drift Forbidden
Registries may evolve through additions, deprecations, retirements, tombstones, and successor entries. **Meaning may not drift.** The canonical id of a published entry refers to one and only one conceptual referent for all time. Reinterpretation of a published id is constitutionally void.

### §2.4 Scope of This Document
This document specifies schema, validation, reference, versioning, lifecycle, traceability, and determinism requirements for every registry entry. It does not specify storage, encoding, transport, APIs, or implementation strategy.

---

# PART II — UNIVERSAL REGISTRY ENTRY CONTRACT

Every registry entry, regardless of class, must conform to the contract in this Part. Class-specific schemas in Parts III–XI extend this contract but may not relax it.

## §3. Field Categories

Every field on a registry entry belongs to exactly one of the following categories:

- **Required.** Must be present and validated for any entry transitioning to Approved or later.
- **Optional.** May be present; if present, must validate.
- **Immutable.** Once an entry is published, the field's value is fixed for that entry across all subsequent appearances of that canonical id. Immutability is enforced by the entry hash.

A field may carry the **immutable** attribute in combination with **required** or **optional**.

## §4. Mandatory Universal Fields

The following fields are required on every registry entry of every class.

### §4.1 Identity Fields
- **id.** The canonical identifier minted by the owning registry. Required, immutable. Globally namespaced (per RIC-35, Phase 5A). Never reused, never re-pointed.
- **registryId.** The identifier of the owning registry. Required, immutable.
- **schemaClass.** The entry class declared by this specification (e.g., Signal, Pathway, Cause). Required, immutable.

### §4.2 Descriptive Fields
- **name.** The canonical human-readable name. Required, immutable in meaning; presentation locale variants live in the Communication Registry, never inline.
- **description.** The canonical authoritative description of the entry's referent. Required.

### §4.3 Ownership Fields
- **ownerDomain.** The constitutional owning domain. Required, immutable. Must match the registry's owner per Phase 5A Part III.

### §4.4 Versioning Fields
- **createdVersion.** The registry version in which the entry first achieved Published state. Required, immutable.
- **lastModifiedVersion.** The most recent registry version in which the entry's content or lifecycle state changed. Required.
- **schemaVersion.** The version of the schema class to which this entry conforms. Required, immutable per published entry.

### §4.5 Lifecycle Fields
- **lifecycleState.** One of {Draft, Proposed, Approved, Published, Deprecated, Retired, Tombstoned} per Phase 5A §23. Required.
- **status.** A coarse-grained authority flag derived from lifecycleState: {Authoritative, AuthoritativeWithConstraint, NonAuthoritative, Prohibited}. Required; derived deterministically from lifecycleState.

### §4.6 Provenance Fields
- **evidenceReferences.** The canonical references to evidence sources justifying the entry, of the evidence class required by the registry. Required for Approved or later.
- **provenance.** The structured record of authoring domain, reviewers, review identifiers, and first-publication release. Required from Approved onward; immutable after publication.

### §4.7 Dependency Fields
- **dependencies.** The complete, declared set of cross-registry references this entry depends on, each naming the upstream registry id, the upstream canonical id, and the upstream version range. Required (may be empty for foundational classes).

### §4.8 Compatibility Fields
- **compatibilityMetadata.** Declarations of engine compatibility ranges, downstream consumer compatibility ranges, and any composition constraints. Required.

### §4.9 Traceability Fields
- **traceabilityMetadata.** The structured record sufficient to link the entry to Decision Traces, Confidence Reports, and Decision Ledger entries that consume it. Required; format is specified by the Canonical Ledger.

### §4.10 Integrity Fields
- **entryHash.** The deterministic content hash over the entry's canonical fields in canonical order. Required for Approved or later; immutable after publication.
- **supersedes.** The canonical id of an entry this one replaces, if any. Optional, immutable once set.
- **supersededBy.** The canonical id of a successor entry, if any. Optional; may be set by the owning domain in a later release.

## §5. Forbidden Universal Fields

The following are forbidden on every registry entry of every class:

- Inline localized presentation text outside the Communication Registry.
- Inline copies of upstream registry content (references only; see §28).
- Mutable runtime state, counters, timestamps of last evaluation, or per-tenant data.
- Implementation artifacts: storage keys, database identifiers, transport metadata.
- Non-deterministic content of any kind (per RIC-29, Phase 5A).
- Free-text fields used as covert identifiers or as substitutes for canonical references.
- Fields whose meaning depends on the consumer's interpretation rather than the registry's authoritative definition.

## §6. Immutability Rules

### §6.1 Published Immutability
For any Published-or-later entry, the following fields are immutable and bound by the entry hash: id, registryId, schemaClass, schemaVersion, name (referent meaning), ownerDomain, createdVersion, provenance, evidenceReferences as published, dependencies as published, supersedes (if set), entryHash.

### §6.2 Permitted Forward Mutation
The following fields may evolve across releases without violating immutability, because each new release records its own immutable snapshot: lifecycleState, status, lastModifiedVersion, supersededBy, compatibilityMetadata as it pertains to forward consumers.

### §6.3 Correction Through Succession
Any change to an immutable field is achieved only by issuing a new entry with a new canonical id, recording supersedes against the original, and transitioning the original to Deprecated, Retired, or Tombstoned per Phase 5A §24–§25.

---

# PART III — SIGNAL REGISTRY SPECIFICATION

Signals are foundational (Tier 1). They have no upstream registry dependencies.

## §7. Signal Identity
Every Signal entry extends the Universal Contract and additionally declares:

- **signalCode.** The canonical short code stable across all releases. Required, immutable.
- **signalFamily.** The high-level family classification (e.g., morphological, biochemical, symptomatic, environmental). Required, immutable. Drawn from a registry-defined controlled vocabulary.

## §8. Signal Classification
- **observability.** Declaration of how the signal is observed: {patientReported, clinicianObserved, instrumentMeasured, derived}. Required.
- **modality.** The observation modality where applicable (e.g., visual, tactile, photometric, biochemical). Required where observability implies a modality.

## §9. Severity Support
- **severitySchema.** The declaration of whether the signal supports severity, and if so, the canonical severity scale identifier (defined within the Signal Registry's controlled vocabulary). Required.
- **severityBounds.** Declaration of admissible values, ordering, and monotonicity properties. Required when severitySchema declares severity.

## §10. Evidence Expectations
- **evidenceClass.** The class of evidence required to publish or modify the entry. Required, drawn from the Signal Registry's evidence class vocabulary.
- **evidenceSufficiency.** Declaration of minimum evidence count and quality threshold. Required.

## §11. Composite and Relational Structure
- **mutuallyExclusiveWith.** The set of canonical ids of signals that may not co-occur with this signal in a single observation context. Optional.
- **compositeMembership.** Declarations of any composite signals this signal participates in as a constituent, naming the composite by canonical id. Optional.
- **derivationRule.** For derived signals, a declarative statement of the deterministic derivation in terms of canonical predicates over other signals. Required for observability = derived.

## §12. Context Gates
- **contextGates.** Declarations of contextual prerequisites (e.g., demographic, anatomical, temporal) under which the signal is admissible for evaluation. Optional; when present, expressed in canonical predicate form.

## §13. Suppression Eligibility
- **suppressible.** Declaration of whether downstream evaluation may suppress this signal in the presence of declared suppressors. Required.
- **suppressionConditions.** Canonical predicates under which suppression is permitted. Required when suppressible is affirmative.

## §14. Signal Validation Rules
- **SR-V01.** signalCode must be unique across all Signal entries for all time.
- **SR-V02.** signalFamily must resolve to the registry's controlled vocabulary at the release version.
- **SR-V03.** severityBounds must be internally consistent (non-empty, ordered, monotone).
- **SR-V04.** derivationRule must reference only Published, Deprecated, or Retired Signal entries (per Phase 5A RIC-24).
- **SR-V05.** mutuallyExclusiveWith must be symmetric across the asserting pair (declared on both sides).
- **SR-V06.** compositeMembership must resolve to a composite signal entry that lists this signal as a constituent.
- **SR-V07.** suppressionConditions must compile to deterministic predicates over canonical referents.
- **SR-V08.** evidenceSufficiency thresholds must meet or exceed registry-wide minima.

Failure of any SR-V rule is fail-closed; the entry may not be published.

---

# PART IV — PATHWAY REGISTRY SPECIFICATION

Pathways depend exclusively on the Signal Registry.

## §15. Pathway Identity
- **pathwayCode.** Required, immutable.
- **pathwayClass.** The biological or clinical class declaration. Required, immutable.

## §16. Activation Criteria
- **activationPredicate.** The canonical declarative predicate, expressed over Signal canonical ids, defining the conditions under which the pathway is considered active. Required.
- **minimumActivationEvidence.** The minimum count and quality of constituent signal observations required for activation. Required.

## §17. Signal Relationships
- **signalDependencies.** The complete set of Signal canonical ids referenced by the activation predicate or by weighting metadata. Required.
- **signalRoles.** For each referenced signal, the declared role within the pathway: {primaryActivator, secondaryActivator, modulator, suppressor, contextGate}. Required.

## §18. Weighting Metadata
- **weightScheme.** The declaration of how constituent signals contribute to pathway activation strength. Required, drawn from the registry's controlled weighting-scheme vocabulary.
- **weights.** The canonical, deterministic weights associated with each signal role. Required; serialized in canonical numeric form (RIC-29 forbids floating-point drift in the canonical path).

## §19. LLR Constraints
- **llrSupport.** Declaration of whether the pathway contributes to log-likelihood-ratio computations for downstream Cause evaluation. Required.
- **llrBounds.** When llrSupport is affirmative, the canonical admissible bounds for the pathway's LLR contribution. Required.
- **llrCalibrationReference.** The provenance of the calibration that established llrBounds. Required when llrSupport is affirmative.

## §20. Band Thresholds
- **bandSchema.** The canonical declaration of the discrete activation bands (e.g., inactive, subthreshold, active, dominant). Required.
- **bandThresholds.** The canonical thresholds separating bands, in deterministic numeric form. Required.

## §21. Suppression Rules
- **suppressors.** Canonical references to Signal or sibling Pathway entries whose activation suppresses this pathway. Optional.
- **suppressionPredicate.** The deterministic predicate under which suppression applies. Required when suppressors are declared.

## §22. Pathway Validation Rules
- **PR-V01.** All canonical ids in signalDependencies, activationPredicate, suppressors, and suppressionPredicate must resolve to Signal entries in declared upstream version ranges.
- **PR-V02.** signalRoles must cover every signal appearing in activationPredicate.
- **PR-V03.** weights must be defined for every role that the weightScheme requires.
- **PR-V04.** bandThresholds must be strictly monotonic and cover the full admissible activation range.
- **PR-V05.** llrBounds must be finite, ordered, and consistent with bandThresholds.
- **PR-V06.** suppressionPredicate, when present, must compile to a deterministic boolean predicate.
- **PR-V07.** No pathway may declare itself as a suppressor or constituent.

Failure of any PR-V rule is fail-closed.

---

# PART V — CAUSE REGISTRY SPECIFICATION

Causes depend on the Signal Registry and the Pathway Registry.

## §23. Cause Identity
- **causeCode.** Required, immutable.
- **causeClass.** The class declaration (e.g., monofactorial, multifactorial). Required, immutable.

## §24. Priors
- **priorSchema.** The declaration of the prior distribution family used in cause evaluation. Required, drawn from the registry's controlled vocabulary.
- **priorParameters.** Canonical deterministic parameters of the prior. Required.
- **priorProvenance.** Evidence and calibration provenance for the prior. Required.

## §25. Dependencies
- **pathwayDependencies.** The complete set of Pathway canonical ids whose activations participate in the cause's evaluation. Required.
- **signalDependencies.** Direct Signal references where the cause depends on signals not mediated by a declared pathway. Optional; when present, must declare justification in provenance.
- **dependencyRoles.** For each dependency, the declared role: {primaryEvidence, supportingEvidence, exclusionary, contextGate}. Required.

## §26. Composite Eligibility
- **compositeEligible.** Declaration of whether this cause may participate as a constituent of a multifactorial composite cause. Required.
- **compositeRule.** When compositeEligible is affirmative, the canonical declarative rule expressing the composite's evaluation in terms of constituent causes. Required for multifactorial cause classes.

## §27. Exclusion Relationships
- **mutuallyExclusiveWith.** Canonical references to other Cause entries with which this cause cannot co-rank above declared thresholds. Optional.
- **exclusionPredicate.** The canonical predicate under which exclusion applies. Required when mutuallyExclusiveWith is declared.

## §28. Dissent Support
- **dissentEligible.** Declaration of whether downstream ranking may record dissent against this cause. Required.
- **dissentCriteria.** Canonical predicates defining what constitutes admissible dissent evidence. Required when dissentEligible is affirmative.

## §29. Cause Validation Rules
- **CR-V01.** All pathwayDependencies must resolve to Pathway entries in declared version ranges.
- **CR-V02.** All signalDependencies must resolve to Signal entries; their justification must appear in provenance.
- **CR-V03.** priorParameters must be admissible under priorSchema.
- **CR-V04.** compositeRule, when present, must reference only Cause entries that declare compositeEligible affirmatively.
- **CR-V05.** mutuallyExclusiveWith must be symmetric.
- **CR-V06.** dependencyRoles must cover every dependency.
- **CR-V07.** No cause may declare itself as a dependency, exclusion partner, or composite constituent.
- **CR-V08.** Multifactorial cause classes must declare compositeRule.

Failure is fail-closed.

---

# PART VI — MECHANISM GRAPH REGISTRY SPECIFICATION

The Mechanism Graph Registry encodes a directed acyclic graph (DAG) over Mechanism, FollicularImpact, and ClinicalConsequence nodes, depending on Signal, Pathway, and Cause registries.

## §30. Allowed Node Schemas

### §30.1 Mechanism
- **mechanismCode.** Required, immutable.
- **mechanismClass.** Required, immutable.
- **mediatedBy.** Canonical references to Pathway entries that mediate the mechanism. Required.
- **drivenBy.** Canonical references to Cause entries that drive the mechanism. Required.
- **evidenceClass.** Required.

### §30.2 FollicularImpact
- **impactCode.** Required, immutable.
- **impactClass.** Required, immutable.
- **producedBy.** Canonical references to Mechanism nodes producing the impact. Required.
- **severityProfile.** Declaration of impact severity dimensions and bounds. Required.

### §30.3 ClinicalConsequence
- **consequenceCode.** Required, immutable.
- **consequenceClass.** Required, immutable.
- **derivedFrom.** Canonical references to FollicularImpact nodes (and, where justified in provenance, to Mechanism nodes) from which the consequence is derived. Required.
- **observableVia.** Canonical references to Signal entries through which the consequence is clinically observable. Required.

## §31. Allowed Edges

Edges in the Mechanism Graph are declared exclusively along the following directions:

- Cause → Mechanism (drivenBy inverse).
- Pathway → Mechanism (mediatedBy inverse).
- Mechanism → FollicularImpact (producedBy inverse).
- FollicularImpact → ClinicalConsequence (derivedFrom inverse).
- ClinicalConsequence → Signal (observableVia inverse; informational, not authoritative for Signal definitions).

No other edges are permitted. Edges are declarative; the graph is not computed at runtime.

## §32. DAG Requirements
- **MG-DAG-01.** The combined node-and-edge set must be acyclic.
- **MG-DAG-02.** Topological ordering must be deterministic when serialized in the manifest.
- **MG-DAG-03.** No node may reference itself directly or transitively.

## §33. Evidence Support
- **evidenceReferences.** Required on every node, per Universal Contract §4.6.
- **evidenceJointConstraints.** Where a node's evidence depends on the joint presence of evidence in upstream nodes, the joint constraint must be declared canonically.

## §34. Versioning Rules
- Mechanism Graph nodes are versioned per the Universal Contract.
- A graph release must declare its constituent node versions in the manifest deterministically.
- Edges are derived from node declarations and require no independent versioning, but must be enumerated explicitly in the manifest for replay (RIC-16/RIC-17).

## §35. Graph Integrity Requirements
- **MG-V01.** Every node referenced by an edge must exist in the same release.
- **MG-V02.** All upstream references must resolve to Published, Deprecated, or Retired entries in the declared upstream registries.
- **MG-V03.** No edge may cross outside the permitted directions of §31.
- **MG-V04.** ClinicalConsequence.observableVia must reference Signal entries whose context gates are consistent with the consequence's declared observation context.
- **MG-V05.** FollicularImpact.severityProfile must be internally monotonic and bounded.

Failure is fail-closed.

---

# PART VII — CLINICAL INTELLIGENCE REGISTRY SPECIFICATION

This Part governs the Desired Effect, Intervention, Condition Descriptor, Prognosis Knowledge, and Application Guidance schemas owned within the Clinical Intelligence domain set (Planning and Capability tiers, per Phase 5A Part III).

## §36. DesiredEffect
- **effectCode.** Required, immutable.
- **effectClass.** Required, immutable.
- **targets.** Canonical references to Cause, Condition, FollicularImpact, or ClinicalConsequence entries whose modification constitutes the effect. Required.
- **directionOfChange.** Canonical declaration of the direction of clinical change (e.g., reduce, restore, stabilize). Required.
- **measurableVia.** Canonical references to Signal or Outcome entries through which realization of the effect is observable. Required.
- **constraints.** Canonical predicates declaring conditions under which the effect is admissible or excluded. Optional.

## §37. Intervention
- **interventionCode.** Required, immutable.
- **interventionClass.** Required, immutable.
- **mechanismOfActionReferences.** Canonical references to Mechanism Graph nodes describing the intervention's action. Required.
- **eligibilityPredicate.** Canonical predicate over Condition, Cause, and Signal references declaring patient eligibility. Required.
- **contraindicationPredicate.** Canonical predicate declaring contraindications. Required.
- **expectedEffects.** Canonical references to Desired Effect entries the intervention is expected to realize. Required.
- **safetyClass.** Canonical declaration of safety classification, drawn from the registry's controlled vocabulary. Required.
- **regulatoryClass.** Canonical declaration of regulatory classification. Required.

## §38. ConditionDescriptor
- **conditionCode.** Required, immutable.
- **conditionClass.** Required, immutable.
- **signalSignature.** Canonical predicate over Signal entries defining the descriptor's observable signature. Required.
- **causeAssociations.** Canonical references to Cause entries associated with the condition, with declared association strength category. Required.
- **mechanismAssociations.** Canonical references to Mechanism Graph nodes participating in the condition. Required.

## §39. PrognosisKnowledge
- **prognosisCode.** Required, immutable.
- **prognosisClass.** Required, immutable.
- **conditionScope.** Canonical references to ConditionDescriptor entries the prognosis describes. Required.
- **temporalProfile.** Canonical declaration of the prognosis's temporal structure (epoch boundaries, expected progression categories). Required.
- **modifiers.** Canonical predicates over Cause, Signal, and Intervention references that modify the prognosis. Optional.

## §40. ApplicationGuidance
- **guidanceCode.** Required, immutable.
- **guidanceClass.** Required, immutable.
- **appliesTo.** Canonical references to Intervention or Kit Knowledge entries the guidance governs. Required.
- **preconditionPredicate.** Canonical predicate establishing when the guidance applies. Required.
- **stepStructure.** Canonical declaration of ordered guidance phases in deterministic structural form (no free-text procedural narrative). Required.
- **safetyConstraints.** Canonical predicates declaring safety-bounding conditions. Required.

## §41. Prohibited Content in Clinical Intelligence Entries
The following are forbidden in every entry of this Part:

- Patient-facing wording (lives in Communication Registry).
- Regulated marketing claims of any kind.
- Outcome guarantees, efficacy guarantees, or temporal guarantees.
- Inline restatement of upstream Signal, Pathway, Cause, or Mechanism content.
- Pricing, commercial, or supplier information.
- Brand or product identity (lives in Kit Knowledge).

## §42. Clinical Intelligence Validation Rules
- **CI-V01.** All references must resolve to entries in declared upstream registries and version ranges.
- **CI-V02.** measurableVia must reference Signal or Outcome entries whose evaluation modalities are consistent with the declared effect class.
- **CI-V03.** eligibilityPredicate and contraindicationPredicate must be mutually consistent (no admissible state satisfies both).
- **CI-V04.** expectedEffects must reference Desired Effect entries whose targets are reachable through the declared mechanismOfActionReferences (graph-traceable).
- **CI-V05.** prognosis temporalProfile must be monotone and finite.
- **CI-V06.** ApplicationGuidance.stepStructure must be a deterministic ordered structure with no free-text imperative content.

Failure is fail-closed.

---

# PART VIII — CAPABILITY MAP REGISTRY SPECIFICATION

Capabilities map Interventions and Objective Templates to deliverable capabilities. Capability Map depends on Intervention Library and Objective Template Registry.

## §43. Capability
- **capabilityCode.** Required, immutable.
- **capabilityClass.** Required, immutable.
- **realizes.** Canonical references to Desired Effect entries this capability realizes. Required.
- **deliveredVia.** Canonical references to Intervention entries that deliver the capability. Required.
- **coverageScope.** Canonical declaration of the conditions and causes the capability addresses, by reference. Required.

## §44. CapabilityRule
- **ruleCode.** Required, immutable.
- **ruleClass.** Required, immutable.
- **appliesToCapability.** Canonical reference to the Capability entry the rule governs. Required.
- **predicate.** Canonical predicate over upstream references determining the rule's applicability. Required.
- **effectOfApplication.** Canonical declaration of the rule's effect (e.g., requires, permits, excludes, escalates), drawn from a controlled vocabulary. Required.

## §45. RequirementMapping
- **mappingCode.** Required, immutable.
- **mappingClass.** Required, immutable.
- **requirementSource.** Canonical references to Objective Template or Desired Effect entries that originate the requirement. Required.
- **satisfiedBy.** Canonical references to Capability entries that satisfy the requirement. Required.
- **coverageDeclaration.** Canonical declaration that the satisfying capabilities cover the requirement {fully, partial, withSubstitution}. Required.

## §46. Coverage and Unmet-Need Declarations
- **coverageManifest.** For every Capability, a deterministic enumeration of conditions, causes, or desired effects within scope, marked covered or notCovered. Required.
- **unmetNeedDeclarations.** Explicit, canonical references to conditions, causes, or desired effects within scope but not satisfied. Required when any element of coverageManifest is notCovered.

## §47. Contraindication Metadata
- **contraindicationReferences.** Canonical references to Intervention contraindication predicates inherited by the capability. Required.
- **capabilityContraindicationPredicate.** Capability-level contraindications beyond inherited ones. Optional.

## §48. Capability Map Integrity Constraints
- **CM-V01.** Every Capability must trace through Interventions to Mechanism Graph nodes and ultimately to declared targets.
- **CM-V02.** No Capability may declare a deliveredVia Intervention whose contraindicationPredicate is universally satisfied within the Capability's coverageScope.
- **CM-V03.** RequirementMapping.satisfiedBy must consist of Capability entries whose realizes set is a superset of the requirement's effects.
- **CM-V04.** unmetNeedDeclarations must be exhaustive with respect to the declared coverageScope.
- **CM-V05.** CapabilityRule effectOfApplication values must be drawn from the controlled vocabulary at the release version.

Failure is fail-closed.

---

# PART IX — KIT KNOWLEDGE REGISTRY SPECIFICATION

Kit Knowledge depends on Capability Map and Intervention Library.

## §49. Kit
- **kitCode.** Required, immutable.
- **kitClass.** Required, immutable.
- **realizesCapabilities.** Canonical references to Capability entries the kit realizes. Required.
- **composition.** Canonical, ordered enumeration of constituent Product references with role declarations. Required.
- **coverageDeclaration.** Canonical declaration of the kit's coverage relative to its realized capabilities {fullCoverage, partialCoverage, substitutionCoverage}. Required.

## §50. Product
- **productCode.** Required, immutable.
- **productClass.** Required, immutable.
- **deliversInterventions.** Canonical references to Intervention entries the product delivers. Required.
- **regulatoryClassification.** Canonical declaration of regulatory class, drawn from the registry's controlled vocabulary. Required.
- **compositionDeclaration.** Canonical declaration of constituent active and functional elements at the registry's declared granularity (no proprietary formulation detail; constitutional declaration only). Required.

## §51. Protocol
- **protocolCode.** Required, immutable.
- **protocolClass.** Required, immutable.
- **appliesToKit.** Canonical reference to the Kit entry the protocol governs. Required.
- **phaseStructure.** Canonical, ordered, deterministic structural declaration of protocol phases. Required.
- **applicationGuidanceReferences.** Canonical references to ApplicationGuidance entries that elaborate the protocol's safety-bounded phases. Required.
- **monitoringHooks.** Canonical references to Monitoring Registry markers triggered by the protocol. Required.

## §52. Kit Knowledge Integrity Constraints
- **KK-V01.** Every Kit.realizesCapabilities reference must resolve to a Capability whose deliveredVia includes at least one Intervention delivered by a Product in the Kit's composition.
- **KK-V02.** Product.regulatoryClassification must be consistent with the regulatoryClass of every Intervention referenced via deliversInterventions.
- **KK-V03.** Protocol.phaseStructure must be a deterministic ordered structure; no free-text procedural narrative.
- **KK-V04.** Protocol.monitoringHooks must reference Monitoring Markers whose triggers are within scope of the protocol's phases.
- **KK-V05.** Kit.coverageDeclaration must be consistent with its constituent Products' interventions and the realized Capabilities' coverageManifests.

Failure is fail-closed.

---

# PART X — MONITORING REGISTRY SPECIFICATION

Monitoring depends on Signal, Condition, Outcome, Intervention, Capability, and Kit registries (per Phase 5A §20).

## §53. MonitoringMarker
- **markerCode.** Required, immutable.
- **markerClass.** Required, immutable.
- **observedVia.** Canonical references to Signal or Outcome entries the marker observes. Required.
- **evaluationWindow.** Canonical declaration of the temporal window over which the marker is evaluated. Required.
- **triggerPredicate.** Canonical predicate defining when the marker fires. Required.
- **severityClassification.** Canonical declaration of the severity category produced when the marker fires. Required.

## §54. EscalationRule
- **escalationCode.** Required, immutable.
- **escalationClass.** Required, immutable.
- **triggeredBy.** Canonical references to MonitoringMarker entries whose firing triggers the rule. Required.
- **routingDeclaration.** Canonical declaration of the responsible role or domain to which the escalation routes, drawn from a controlled vocabulary. Required.
- **temporalConstraint.** Canonical declaration of latency expectations and timeouts. Required.
- **severityFloor.** Canonical declaration of the minimum severity classification required to invoke the rule. Required.

## §55. MeasurementSpecification
- **measurementCode.** Required, immutable.
- **measurementClass.** Required, immutable.
- **measures.** Canonical references to Signal or Outcome entries whose values the specification quantifies. Required.
- **methodDeclaration.** Canonical declaration of the measurement method category. Required.
- **admissibleBounds.** Canonical declaration of admissible value bounds and units (units drawn from controlled vocabulary). Required.
- **calibrationProvenance.** Provenance of the calibration. Required.

## §56. Monitoring Validation Rules
- **MN-V01.** triggerPredicate must compile to a deterministic boolean predicate over the entries listed in observedVia.
- **MN-V02.** evaluationWindow must be finite and deterministically defined.
- **MN-V03.** severityClassification values must be drawn from the registry's controlled severity vocabulary.
- **MN-V04.** EscalationRule.triggeredBy must reference MonitoringMarker entries whose severityClassification is greater than or equal to severityFloor.
- **MN-V05.** routingDeclaration must reference a role or domain present in the constitutional ownership matrix.
- **MN-V06.** MeasurementSpecification.admissibleBounds must be internally consistent and within the admissible bounds of the referenced Signals or Outcomes.

Failure is fail-closed.

---

# PART XI — COMMUNICATION REGISTRY SPECIFICATION

Communication depends on Escalation, Monitoring, Outcome, Condition, and Kit registries.

## §57. Template
- **templateCode.** Required, immutable.
- **templateClass.** Required, immutable.
- **purposeReference.** Canonical reference to the Escalation, Monitoring, Outcome, Condition, or Kit entry whose communication the template serves. Required.
- **claimReferences.** Canonical references to the upstream clinical-intelligence or outcome entries supporting every clinical claim made by the template. Required.
- **slotSchema.** Canonical declaration of variable slots and their permitted referent types (no free-form interpolation). Required.

## §58. LocalePack
- **localePackCode.** Required, immutable.
- **localePackClass.** Required, immutable.
- **locale.** Canonical locale identifier drawn from the registry's controlled vocabulary. Required, immutable.
- **bindsTemplate.** Canonical reference to the Template entry this pack localizes. Required.
- **localizationContent.** Structurally constrained localized renderings keyed strictly to the bound Template's slot schema. Required.

## §59. ReadingLevelPolicy
- **policyCode.** Required, immutable.
- **policyClass.** Required, immutable.
- **appliesToScope.** Canonical declaration of which templates, locale packs, or audiences the policy governs. Required.
- **levelDeclaration.** Canonical declaration of the reading-level category and any structural constraints (sentence-length bounds, lexical-tier bounds), drawn from the registry's controlled vocabulary. Required.

## §60. StyleLintRule
- **ruleCode.** Required, immutable.
- **ruleClass.** Required, immutable.
- **forbiddenPatterns.** Canonical declaration of structurally defined forbidden patterns (categorical, not free-text). Required.
- **requiredPatterns.** Canonical declaration of structurally required patterns. Optional.
- **scopeReference.** Canonical declaration of the templates, locale packs, or claim classes the rule governs. Required.

## §61. Communication Integrity Requirements
- **CM-COMM-V01.** Every clinical claim in any Template must be backed by a claimReference resolving to a Published upstream entry whose authority supports the claim.
- **CM-COMM-V02.** Regulated claims may appear only within Templates whose templateClass declares regulated communication scope. Outside that scope they are forbidden.
- **CM-COMM-V03.** Persuasive constructs (urgency framing, scarcity framing, fear framing, comparative superiority) are forbidden in all clinical Templates.
- **CM-COMM-V04.** LocalePack.localizationContent must conform to the bound Template's slotSchema; no locale may introduce new slots or claims.
- **CM-COMM-V05.** ReadingLevelPolicy.levelDeclaration must be enforceable by deterministic structural validators.
- **CM-COMM-V06.** StyleLintRule.forbiddenPatterns must be categorically defined; opaque heuristics are forbidden.
- **CM-COMM-V07.** Communication entries may not introduce clinical content; they may only render upstream-authoritative content.

Failure is fail-closed.

---

# PART XII — CROSS-REGISTRY DEPENDENCY RULES

## §62. Allowed References
Cross-registry references are permitted only along the tier ordering and permitted-reference sets enumerated in Phase 5A Part III. This document does not modify that enumeration; it binds every registry entry to comply with it.

## §63. Forbidden References
A registry entry may not reference any registry not listed in its owning registry's permitted upstream set. In particular:

- No upstream registry may reference any downstream registry.
- No registry may reference a sibling registry at the same tier unless explicitly permitted by Phase 5A.
- No registry entry may inline content from another registry; references are by canonical id only.

## §64. Tier Ordering
Tier ordering is inherited from Phase 5A §30:

Tier 1 (Signal) → Tier 2 (Pathway, Cause, Mechanism Graph, Condition) → Tier 3 (Desired Effect, Objective Template) → Tier 4 (Intervention Library, Capability Map, Kit Knowledge) → Tier 5 (Outcome, Monitoring, Escalation, Communication).

Knowledge flows strictly forward. Reverse constitutional dependencies are constitutionally void.

## §65. Reverse Dependency Prohibition
No registry may create, declare, infer, derive, or otherwise establish a reverse constitutional dependency on a downstream registry. Any entry attempting to do so fails fail-closed at validation.

## §66. Fail-Closed Behavior
Where any cross-registry rule of this Part is violated, validation fails fail-closed: the entry may not be Approved; the release may not be Published; downstream evaluation may not proceed; and the violation is recorded for governance review per Phase 5A §49.

---

# PART XIII — REGISTRY INTEGRITY CONSTRAINTS

The following numbered constraints are binding on every registry entry under this specification. They extend, and do not supersede, the Registry Integrity Constraints (RIC-01 through RIC-35) of Phase 5A. Each constraint declares Purpose, Rule, and Failure Behavior; every failure is fail-closed.

## RS-01 — Canonical Identity Integrity
- **Purpose:** Bind every entry to a unique, stable, immutable identifier.
- **Rule:** Every entry must carry a registry-minted canonical id, unique across all releases for all time, never reused, never re-pointed.
- **Failure:** Entry rejected; release blocked.

## RS-02 — Schema Conformance Integrity
- **Purpose:** Bind every entry to its declared class schema.
- **Rule:** Every entry must validate against the schema for its declared schemaClass at its declared schemaVersion. No additional, unrecognized, or undeclared fields are permitted.
- **Failure:** Entry rejected.

## RS-03 — Required Field Integrity
- **Purpose:** Guarantee mandatory metadata presence.
- **Rule:** Every required field for the entry's class, including all Universal Contract fields, must be present and non-empty at Approved or later.
- **Failure:** Entry rejected.

## RS-04 — Forbidden Field Integrity
- **Purpose:** Prevent prohibited content.
- **Rule:** No entry may contain any field enumerated as forbidden in §5 or in its class-specific forbidden set.
- **Failure:** Entry rejected.

## RS-05 — Immutability Integrity
- **Purpose:** Preserve meaning across releases.
- **Rule:** Immutable fields of any Published-or-later entry must remain byte-identical across all subsequent releases referencing the same canonical id.
- **Failure:** Release blocked; integrity incident logged.

## RS-06 — Reference Resolvability Integrity
- **Purpose:** Eliminate dangling references.
- **Rule:** Every reference field must resolve to a Published, Deprecated, or Retired entry in the named upstream registry within the declared version range.
- **Failure:** Entry rejected.

## RS-07 — Reference Ownership Integrity
- **Purpose:** Prevent ownership leakage.
- **Rule:** Every reference must target an entry in a registry permitted by Phase 5A Part III for the referencing registry.
- **Failure:** Entry rejected.

## RS-08 — Reference Lifecycle Integrity
- **Purpose:** Prevent adoption of invalid upstreams.
- **Rule:** No new entry may take a Retired or Tombstoned entry as an authoritative dependency.
- **Failure:** Entry rejected.

## RS-09 — Symmetric Relation Integrity
- **Purpose:** Guarantee declared mutual relations are consistent.
- **Rule:** Symmetric declarations (mutual exclusion, mutual composition, mutual suppression) must be declared on both sides at the same release.
- **Failure:** Release blocked.

## RS-10 — Predicate Determinism Integrity
- **Purpose:** Eliminate non-deterministic evaluation.
- **Rule:** Every predicate field (activation, suppression, exclusion, eligibility, contraindication, trigger, precondition) must compile to a deterministic boolean expression over canonical referents.
- **Failure:** Entry rejected.

## RS-11 — Numeric Determinism Integrity
- **Purpose:** Eliminate floating-point and locale drift.
- **Rule:** Every numeric field in the canonical entry path must be expressed in a canonical, byte-deterministic numeric form, free of floating-point representational ambiguity and locale-dependent formatting.
- **Failure:** Entry rejected.

## RS-12 — Vocabulary Conformance Integrity
- **Purpose:** Prevent uncontrolled enumerations.
- **Rule:** Every field whose value is drawn from a controlled vocabulary must resolve to a value present in that vocabulary at the entry's release version.
- **Failure:** Entry rejected.

## RS-13 — Version Monotonicity Integrity
- **Purpose:** Preserve version ordering.
- **Rule:** lastModifiedVersion must be greater than or equal to createdVersion and must reflect the highest version in which any field of the entry was modified.
- **Failure:** Entry rejected.

## RS-14 — Ownership Integrity
- **Purpose:** Enforce constitutional ownership.
- **Rule:** ownerDomain must equal the owning domain of the entry's registry per Phase 5A Part III.
- **Failure:** Entry rejected; integrity incident logged.

## RS-15 — Provenance Integrity
- **Purpose:** Guarantee evidentiary record.
- **Rule:** Every Approved-or-later entry must carry complete, immutable provenance and evidence references satisfying its registry's evidence class.
- **Failure:** Entry rejected.

## RS-16 — Traceability Integrity
- **Purpose:** Bind entries to ledger-bound traces.
- **Rule:** traceabilityMetadata must be sufficient for Decision Trace, Confidence Report, and Decision Ledger linkage as required by the Canonical Ledger.
- **Failure:** Entry rejected.

## RS-17 — Replay Identity Integrity
- **Purpose:** Guarantee replay reproducibility.
- **Rule:** Two independent implementations, given the same entry content, must compute identical entryHash values.
- **Failure:** Parity failure; release blocked.

## RS-18 — Hash Binding Integrity
- **Purpose:** Bind content and identity.
- **Rule:** entryHash must be computed deterministically over the canonical-ordered serialization of all immutable canonical fields and must be present on every Approved-or-later entry.
- **Failure:** Entry rejected.

## RS-19 — Acyclic Reference Integrity
- **Purpose:** Prevent cyclic knowledge structures.
- **Rule:** No entry may, directly or transitively, reference itself.
- **Failure:** Entry rejected.

## RS-20 — Composite Closure Integrity
- **Purpose:** Guarantee composite consistency.
- **Rule:** Every composite reference (compositeMembership, compositeRule) must be closed under the participating registry: every named constituent must declare reciprocal eligibility.
- **Failure:** Entry rejected.

## RS-21 — Suppression Consistency Integrity
- **Purpose:** Prevent paradoxical suppression.
- **Rule:** Suppression predicates must not be jointly satisfiable with their target's activation predicates in a manner that produces undefined evaluation.
- **Failure:** Entry rejected.

## RS-22 — Mechanism Graph DAG Integrity
- **Purpose:** Preserve graph acyclicity.
- **Rule:** Mechanism Graph entries, taken together at any release version, must form a directed acyclic graph along permitted edges only.
- **Failure:** Release blocked.

## RS-23 — Cross-Tier Reference Integrity
- **Purpose:** Enforce tier ordering.
- **Rule:** No entry may reference a registry that is not in its owning registry's permitted upstream set.
- **Failure:** Entry rejected; integrity incident logged.

## RS-24 — Coverage Declaration Integrity
- **Purpose:** Prevent silent coverage gaps.
- **Rule:** Coverage declarations in Capability and Kit registries must be exhaustive over their declared scopes; unmet needs must be explicit.
- **Failure:** Entry rejected.

## RS-25 — Claim Backing Integrity
- **Purpose:** Bind communication to evidence.
- **Rule:** Every clinical claim in any Communication entry must be backed by a claimReference to a Published upstream entry whose authority supports the claim.
- **Failure:** Entry rejected.

## RS-26 — Regulated Claim Integrity
- **Purpose:** Confine regulated claims.
- **Rule:** Regulated claims may appear only in Templates whose class declares regulated scope; otherwise forbidden.
- **Failure:** Entry rejected.

## RS-27 — Persuasion Prohibition Integrity
- **Purpose:** Exclude persuasive constructs from clinical communication.
- **Rule:** Persuasive constructs are forbidden in all clinical Templates and their LocalePacks.
- **Failure:** Entry rejected.

## RS-28 — Localization Conformance Integrity
- **Purpose:** Prevent locale drift.
- **Rule:** LocalePack content must conform strictly to its bound Template's slotSchema; no locale may add slots or claims.
- **Failure:** Entry rejected.

## RS-29 — Controlled-Severity Integrity
- **Purpose:** Bind severity semantics.
- **Rule:** All severity classifications across Signal, Pathway, Mechanism Graph, Monitoring, and Escalation entries must be drawn from controlled vocabularies whose ordering is canonical and consistent across registries.
- **Failure:** Entry rejected.

## RS-30 — Trace Identity Integrity
- **Purpose:** Guarantee deterministic trace linkage.
- **Rule:** Given identical inputs and identical entry sets at identical versions, the trace identifiers produced by any conforming engine must be identical across independent implementations.
- **Failure:** Parity failure; release blocked.

## RS-31 — Replay Manifest Integrity
- **Purpose:** Guarantee manifest reconstructibility.
- **Rule:** Every release manifest must enumerate all entry hashes, all dependencies, all version pins, and all compatibility ranges sufficient to reconstruct the release deterministically.
- **Failure:** Release blocked.

## RS-32 — Implementation Independence Integrity
- **Purpose:** Prevent implementation-specific dependencies.
- **Rule:** No entry may carry fields whose meaning depends on a particular implementation's storage, encoding, transport, or runtime.
- **Failure:** Entry rejected.

Every failure under RS-01 through RS-32 is fail-closed.

---

# PART XIV — REPLAY & DETERMINISM

## §67. Canonical Ordering
Every entry, manifest, dependency list, controlled-vocabulary value set, predicate term ordering, and numeric field ordering must be expressed in canonical order. Canonical order is the deterministic, lexicographically or structurally defined order declared by the registry's specification; it is identical across implementations.

## §68. Hashing
Entry hashes, registry hashes, and release hashes are computed by a canonical hashing path that:

- Operates over canonical-ordered, canonical-serialized inputs.
- Admits no non-deterministic sources (RIC-29, Phase 5A).
- Produces byte-identical outputs across independent implementations.
- Binds, transitively, every immutable field of the entry, the manifest's enumeration, and the registry's release identity.

The hash algorithm and its canonical encoding are declared by the Canonical Ledger and are inherited here without restatement.

## §69. Release Manifests
Every release manifest must:

- Enumerate every entry by canonical id, schemaClass, schemaVersion, lifecycleState, and entryHash.
- Enumerate every dependency by upstream registryId, upstream canonical id, and pinned upstream version.
- Enumerate every compatibility range.
- Be serialized in canonical order.
- Be sealed under the Canonical Ledger and bear an immutable seal hash.

## §70. Dependency Pinning
Every cross-registry reference must pin its upstream to an exact version or to a version range whose resolution is deterministic at release time and whose resolved value is recorded in the manifest. No reference may rely on "latest," "default," or implementation-resolved defaults.

## §71. Reproducible Output Requirements
For any conforming engine, given:

- identical inputs,
- identical engine versions,
- identical registry versions resolved through pinned manifests,

the engine must produce identical:

- artifact contents,
- artifact hashes,
- Decision Traces,
- Confidence Reports,
- Decision Ledger entries,
- Seal Hashes.

Any divergence is a release-blocking parity failure per Phase 5A §50.

---

# PART XV — ACCEPTANCE CRITERIA

## §72. Validity Conditions
A registry implementation is valid only if it is:

- **Deterministic.** All canonical paths — schema, hashing, ordering, predicate evaluation, manifest serialization — are byte-deterministic across independent implementations.
- **Replay-Safe.** Every historical release and every historical run is reconstructible from manifests and the Canonical Ledger to byte-identical state.
- **Audit-Safe.** Every entry carries complete, immutable provenance and evidence references sufficient for regulator-grade reconstruction.
- **Trace-Safe.** Every entry carries traceability metadata sufficient to bind Decision Traces, Confidence Reports, and Ledger entries that consume it.
- **Ownership-Safe.** Every entry's ownerDomain matches the constitutional owner of its registry; no entry crosses ownership boundaries.
- **Constitutional-Compliant.** Every entry conforms to the Constitution, the Canonical Ledger, Phase 5A, and this document, with no derogation under any condition.

## §73. Independent-Team Equivalence
Two independent teams, working from this specification alone and without recourse to one another's implementations, given identical inputs, identical engine versions, and identical registry versions, must produce:

- identical entry hashes,
- identical registry hashes,
- identical release hashes,
- identical artifact hashes,
- identical Decision Traces,
- identical Confidence Reports,
- identical Decision Ledger entries,
- identical Seal Hashes.

Any divergence renders one or both implementations non-conforming.

## §74. Constitutional Closure
No clause of this document permits derogation from determinism, immutability, ownership exclusivity, tier ordering, tombstone permanence, replay fidelity, claim backing, or persuasion prohibition. Where any clause of this document conflicts with the Constitution, the Canonical Ledger, or Phase 5A, those documents prevail. Where ambiguity arises within this document, the stricter interpretation prevails. Where any rule appears to permit unconstrained interpretation, the interpretation that preserves replay fidelity and audit reconstructibility prevails.

This specification is binding on every HairOS registry, every registry entry, every release manifest, and every engine that consumes registry knowledge. It contains no entries, no examples, no code, no APIs, no storage design, and no implementation guidance. It governs only the constitutional shape of registry knowledge.

— End of HairOS Phase 5B: Registry Specification Constitution —
