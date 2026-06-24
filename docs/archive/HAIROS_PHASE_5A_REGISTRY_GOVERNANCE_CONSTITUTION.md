# HAIROS — PHASE 5A

# REGISTRY GOVERNANCE CONSTITUTION

**Document Class:** Constitutional Governance Specification
**Authority Tier:** Tier 3 — Subordinate to HairOS Constitutional Architecture v1.0 and HairOS Canonical Ledger & Contract Specification v1.0
**Scope:** All HairOS registries, registry entries, registry releases, and registry-derived artifacts
**Status:** Authoritative
**Determinism Class:** Fail-closed, implementation-independent

---

## PREAMBLE

This document establishes the governance system that binds every HairOS registry to constitutional behavior. It does not redefine the Constitution, the Canonical Ledger, ownership domains, tier ordering, artifact contracts, or determinism guarantees — those are inherited as given. This specification governs how registries are structured, owned, evolved, validated, published, and audited so that the system as a whole remains deterministic, replayable, and regulator-ready.

Where a rule already exists in the Constitution or the Canonical Ledger, this document references it by name and does not restate it. Where this document defines a rule, it is binding on all registries without exception.

---

# PART I — REGISTRY FOUNDATIONS

## §1. Registry Philosophy

### §1.1 Purpose
A HairOS registry is the authoritative, versioned, governed source of a single class of canonical knowledge. Registries are the only sanctioned origin of identifiers, definitions, and constraints used by HairOS engines. Knowledge that is not in a registry does not exist for the purposes of the system.

### §1.2 Constitutional Relationship
Registries are subordinate to the Constitution and to the Canonical Ledger. Registries supply the knowledge that the Constitution governs and that the Ledger records. Registries never define system behavior, tier ordering, ownership domains, or artifact contracts; those are inherited.

### §1.3 Ownership Model
Every registry has exactly one owning domain. Ownership is exclusive, non-delegable, and non-transferable except by constitutional amendment. No registry may be co-owned. No entry may be authored, modified, deprecated, or retired by any party other than the owning domain.

### §1.4 Authority Model
A registry's authority is limited to its declared scope. A registry has no authority over entries it does not own, identifiers it does not mint, or domains outside its ownership. Authority is exercised only through published releases; unpublished state is non-authoritative.

### §1.5 Publication Model
Knowledge becomes authoritative only upon publication of an immutable registry release sealed under the Canonical Ledger. Pre-publication state is advisory only and may not be referenced by engines, artifacts, or downstream registries.

### §1.6 Audit Model
Every registry must permit complete historical reconstruction of any published state, including the exact entry set, entry contents, dependencies, and seal hashes that were authoritative at any past instant. Audit access is a constitutional obligation, not a feature.

## §2. Definitional Distinctions

### §2.1 Registry
The authoritative governed collection for one knowledge class, identified by registry id and owned by one domain.

### §2.2 Registry Entry
A single canonical unit of knowledge within a registry, bearing a canonical id, lifecycle state, content, dependencies, provenance, and entry hash.

### §2.3 Registry Release
An immutable, sealed, versioned snapshot of a registry comprising the full set of entries in their published lifecycle states at the moment of release, together with the release manifest and release hash.

### §2.4 Registry Manifest
The declarative document accompanying every release that enumerates entries, versions, dependencies, compatibility ranges, and hashes sufficient to reconstruct and verify the release.

### §2.5 Registry Version
The monotonic identifier of a registry release. Versions are never reused, reordered, or rewritten. A version refers to exactly one sealed release for all time.

## §3. Immutable Knowledge, Mutable Governance

### §3.1 Immutable Knowledge
Once an entry is published in a release, its content, canonical id, dependency declarations, and entry hash are immutable for that release. Subsequent releases may supersede, deprecate, retire, or tombstone the entry but may never rewrite history.

### §3.2 Mutable Governance
Governance metadata — lifecycle state across future releases, deprecation notes, successor declarations, and review records — may evolve through subsequent releases. Mutation never alters a prior release; it only authors a new one.

### §3.3 Replay Obligation
For any past run, the system must reconstruct the exact registry versions, entries, and hashes used by that run. Replay is a constitutional obligation. Any condition that prevents replay is a release-blocking parity failure.

---

# PART II — UNIVERSAL REGISTRY CONTRACT

Every HairOS registry, without exception, must satisfy the contract in this Part. A registry that fails any clause is non-conformant and may not be published.

## §4. Registry Identity

### §4.1 Registry ID
Every registry has a globally unique, stable, human-readable identifier. The identifier is permanent and never reused.

### §4.2 Registry Owner
Every registry declares exactly one owning domain as defined by the Constitution. Ownership is recorded in the manifest of every release.

### §4.3 Registry Scope
Every registry declares the precise knowledge class it governs and the boundary that separates it from sibling registries. Scope is binding; out-of-scope entries are prohibited.

### §4.4 Registry Class
Every registry declares its class: foundational, derived, mechanism, planning, capability, outcome, or governance, as defined by the Constitution. Class determines permitted upstream and downstream relationships.

## §5. Registry Metadata

### §5.1 Version
Every release declares its version. Versions are monotonic and immutable.

### §5.2 Compatibility Range
Every release declares the range of consumer engine versions and upstream registry versions with which it is compatible. Out-of-range combinations are forbidden at runtime.

### §5.3 Publication Status
Every release declares a publication status: published, withdrawn, or superseded. Withdrawn releases remain auditable but are non-authoritative.

### §5.4 Lifecycle Status
Every release declares the lifecycle status of the registry as a whole: active, frozen, sunset, or retired. Status governs what kinds of subsequent releases are permitted.

## §6. Registry Entry Requirements

### §6.1 Canonical ID
Every entry has a canonical id minted by the owning registry. Ids are stable, opaque to consumers, never reused, and never re-pointed.

### §6.2 Uniqueness
Within a registry, canonical ids are unique across all releases for all time. No id may name two distinct entries at any point in history.

### §6.3 Dependency Declarations
Every entry that references entries in other registries must declare each dependency explicitly, naming the upstream registry, upstream canonical id, and upstream version range. Implicit dependencies are forbidden.

### §6.4 Provenance
Every entry records its provenance: authoring domain, source evidence class, review status, and the release in which it was first published. Provenance is immutable once published.

### §6.5 Validation
Every entry must pass the registry's declared validators before promotion to published state. Validation is fail-closed; an entry that cannot be validated cannot be published.

## §7. Publication, Deprecation, and Tombstoning

### §7.1 Publication
Entries become authoritative only when carried in a published release. Pre-publication entries may be referenced only by other pre-publication entries in the same draft cycle.

### §7.2 Deprecation
Deprecation marks an entry as discouraged for new use while preserving its authority for existing references. Deprecated entries must declare a successor or an explicit absence of successor.

### §7.3 Retirement
Retirement withdraws authority for new use while preserving the entry for historical replay. Retired entries may not be referenced by any new entry in any registry.

### §7.4 Tombstoning
Tombstoning records the permanent invalidation of an entry. The canonical id remains reserved forever; it is never reassigned, never resurrected, and never reused. Tombstones are themselves immutable.

## §8. Hashing and Reproducibility

### §8.1 Entry Hash
Every entry carries a deterministic content hash computed over its canonical fields in canonical order. Two entries with identical content in identical order produce identical hashes across independent implementations.

### §8.2 Registry Hash
Every release carries a registry hash computed deterministically over the ordered set of entry hashes and the manifest. The registry hash is the single authoritative fingerprint of the release.

### §8.3 Determinism Requirement
All hashing must be byte-deterministic, ordering-deterministic, and implementation-independent. Any source of nondeterminism — timestamps, locale, floating-point drift, set ordering, hash randomization — is forbidden in the canonical hashing path.

---

# PART III — REGISTRY OWNERSHIP MATRIX

The following matrix is binding. It enumerates every HairOS registry, its owning domain, scope, and permitted relationships. The matrix is consistent with Constitutional ownership rules and tier ordering.

## §9. Signal Registry
- **Owner:** Signal Domain
- **Class:** Foundational (Tier 1)
- **Purpose:** Canonical definitions of all observable clinical signals.
- **Permitted references:** None upstream; foundational.
- **Prohibited references:** Pathways, causes, conditions, interventions, kits, outcomes.
- **Upstream dependencies:** None.
- **Downstream consumers:** Pathway Registry, Cause Registry, Mechanism Graph Registry, Condition Registry, Outcome Registry, Monitoring Registry.

## §10. Pathway Registry
- **Owner:** Pathway Domain
- **Class:** Derived (Tier 2)
- **Purpose:** Canonical biological and clinical pathways that link signals to mechanisms.
- **Permitted references:** Signal Registry.
- **Prohibited references:** Causes, conditions, interventions, kits, capabilities, outcomes, escalation, communication.
- **Upstream dependencies:** Signal Registry.
- **Downstream consumers:** Cause Registry, Mechanism Graph Registry, Condition Registry.

## §11. Cause Registry
- **Owner:** Cause Domain
- **Class:** Derived (Tier 2)
- **Purpose:** Canonical causes underlying observable signals via pathways.
- **Permitted references:** Signal Registry, Pathway Registry.
- **Prohibited references:** Interventions, kits, capabilities, outcomes, escalation, communication.
- **Upstream dependencies:** Signal Registry, Pathway Registry.
- **Downstream consumers:** Mechanism Graph Registry, Condition Registry, Desired Effect Registry, Objective Template Registry.

## §12. Mechanism Graph Registry
- **Owner:** Mechanism Domain
- **Class:** Mechanism (Tier 2)
- **Purpose:** Canonical directed relations among signals, pathways, and causes constituting the mechanism graph.
- **Permitted references:** Signal Registry, Pathway Registry, Cause Registry.
- **Prohibited references:** Conditions, interventions, kits, capabilities, outcomes, escalation, communication.
- **Upstream dependencies:** Signal Registry, Pathway Registry, Cause Registry.
- **Downstream consumers:** Condition Registry, Desired Effect Registry, Objective Template Registry, Intervention Library.

## §13. Condition Registry
- **Owner:** Condition Domain
- **Class:** Derived (Tier 2)
- **Purpose:** Canonical clinical conditions composed from signals, pathways, causes, and mechanism relations.
- **Permitted references:** Signal, Pathway, Cause, Mechanism Graph.
- **Prohibited references:** Interventions, kits, capabilities, outcomes, escalation, communication.
- **Upstream dependencies:** Signal, Pathway, Cause, Mechanism Graph.
- **Downstream consumers:** Desired Effect Registry, Objective Template Registry, Outcome Registry, Monitoring Registry, Escalation Registry.

## §14. Desired Effect Registry
- **Owner:** Planning Domain
- **Class:** Planning (Tier 3)
- **Purpose:** Canonical desired clinical effects that resolve, suppress, or modify causes and conditions.
- **Permitted references:** Cause, Condition, Mechanism Graph.
- **Prohibited references:** Interventions, kits, capabilities, communication.
- **Upstream dependencies:** Cause Registry, Condition Registry, Mechanism Graph Registry.
- **Downstream consumers:** Objective Template Registry, Intervention Library, Outcome Registry.

## §15. Objective Template Registry
- **Owner:** Planning Domain
- **Class:** Planning (Tier 3)
- **Purpose:** Canonical reusable objective templates mapping desired effects to plan structures.
- **Permitted references:** Desired Effect, Cause, Condition, Mechanism Graph.
- **Prohibited references:** Interventions, kits, capabilities, communication.
- **Upstream dependencies:** Desired Effect Registry and its upstreams.
- **Downstream consumers:** Intervention Library, Capability Map Registry.

## §16. Intervention Library
- **Owner:** Intervention Domain
- **Class:** Capability (Tier 4)
- **Purpose:** Canonical interventions catalogued by mechanism of action, eligibility, and contraindications.
- **Permitted references:** Desired Effect, Objective Template, Mechanism Graph, Cause, Condition.
- **Prohibited references:** Kits except by capability mapping, communication, escalation.
- **Upstream dependencies:** Planning-tier registries and their upstreams.
- **Downstream consumers:** Capability Map Registry, Kit Knowledge Registry, Outcome Registry, Monitoring Registry, Escalation Registry.

## §17. Capability Map Registry
- **Owner:** Capability Domain
- **Class:** Capability (Tier 4)
- **Purpose:** Canonical mapping from interventions and objectives to deliverable capabilities.
- **Permitted references:** Intervention Library, Objective Template, Desired Effect.
- **Prohibited references:** Signals, pathways, causes, conditions, mechanism graph directly.
- **Upstream dependencies:** Intervention Library, Objective Template Registry.
- **Downstream consumers:** Kit Knowledge Registry, Outcome Registry, Monitoring Registry.

## §18. Kit Knowledge Registry
- **Owner:** Kit Domain
- **Class:** Capability (Tier 4)
- **Purpose:** Canonical assembled kits realizing one or more capabilities for delivery.
- **Permitted references:** Capability Map, Intervention Library.
- **Prohibited references:** Signals, pathways, causes, conditions, mechanism graph, communication, escalation directly.
- **Upstream dependencies:** Capability Map Registry, Intervention Library.
- **Downstream consumers:** Outcome Registry, Monitoring Registry, Communication Registry.

## §19. Outcome Registry
- **Owner:** Outcome Domain
- **Class:** Outcome (Tier 5)
- **Purpose:** Canonical measurable outcomes attributable to interventions, kits, or capabilities.
- **Permitted references:** Signal, Condition, Desired Effect, Intervention, Capability, Kit.
- **Prohibited references:** Pathways and causes directly; outcome attribution flows through condition and desired effect.
- **Upstream dependencies:** All tiers above.
- **Downstream consumers:** Monitoring Registry, Escalation Registry.

## §20. Monitoring Registry
- **Owner:** Monitoring Domain
- **Class:** Governance (Tier 5)
- **Purpose:** Canonical monitoring policies, surveillance windows, and observation triggers.
- **Permitted references:** Signal, Condition, Outcome, Intervention, Kit, Capability.
- **Prohibited references:** Mechanism graph and pathway internals.
- **Upstream dependencies:** Outcome Registry and its upstreams.
- **Downstream consumers:** Escalation Registry, Communication Registry.

## §21. Escalation Registry
- **Owner:** Escalation Domain
- **Class:** Governance (Tier 5)
- **Purpose:** Canonical escalation paths, thresholds, and responsible roles.
- **Permitted references:** Monitoring, Outcome, Condition.
- **Prohibited references:** Mechanism graph, pathway, cause, intervention internals.
- **Upstream dependencies:** Monitoring Registry.
- **Downstream consumers:** Communication Registry.

## §22. Communication Registry
- **Owner:** Communication Domain
- **Class:** Governance (Tier 5)
- **Purpose:** Canonical communication templates, channels, and authorization rules for user-facing messaging.
- **Permitted references:** Escalation, Monitoring, Outcome, Condition, Kit.
- **Prohibited references:** Signal, pathway, cause, mechanism graph, intervention, capability internals.
- **Upstream dependencies:** Escalation Registry.
- **Downstream consumers:** None within the registry system.

---

# PART IV — REGISTRY ENTRY GOVERNANCE

## §23. Entry Lifecycle States

The lifecycle of every registry entry is governed by the following states. No other states are permitted.

- **Draft.** Entry exists in pre-publication workspace. Non-authoritative.
- **Proposed.** Entry has been submitted for review. Non-authoritative.
- **Approved.** Entry has passed all required reviews and validators and is queued for inclusion in a release. Non-authoritative.
- **Published.** Entry is included in a sealed release. Authoritative.
- **Deprecated.** Entry remains authoritative for existing references but is discouraged for new use. Authoritative with constraint.
- **Retired.** Entry is no longer authoritative for new references. Historical replay only.
- **Tombstoned.** Entry's canonical id is permanently invalidated. Non-authoritative for any forward use. Authoritative only as a prohibition.

## §24. Allowed Lifecycle Transitions

- Draft → Proposed
- Proposed → Draft (rework)
- Proposed → Approved
- Approved → Proposed (revocation before release)
- Approved → Published (only by release event)
- Published → Deprecated
- Published → Retired (only after deprecation cycle, except by emergency release per §40)
- Deprecated → Retired
- Retired → Tombstoned (only on integrity grounds)
- Published → Tombstoned (only on integrity grounds, by emergency release)

## §25. Forbidden Lifecycle Transitions

- Any transition that returns an entry from Tombstoned to any other state.
- Any transition from Retired back to Published, Deprecated, Approved, Proposed, or Draft.
- Any transition that bypasses Proposed and Approved between Draft and Published.
- Any transition between distinct entries that would reuse a canonical id.

## §26. Review Requirements

Every transition to Approved requires:

- Domain owner authorization.
- Successful execution of all declared validators.
- Recorded provenance update naming reviewers and evidence.
- Conformance check against the Universal Registry Contract.

Emergency transitions are governed by §40.

## §27. Evidence Requirements

Every Approved entry must carry, immutably, the class and identity of the evidence that justifies its content. Evidence class is declared per registry. Entries lacking required evidence may not be published.

## §28. Publication Requirements

Publication occurs only through a sealed registry release. An entry cannot be selectively published outside the release mechanism. The release seal hash binds the entry's content for all time.

## §29. Immutability After Publication

After publication, an entry's content, canonical id, dependencies, provenance, and entry hash are immutable. Corrections occur only by issuing a successor entry in a subsequent release and transitioning the prior entry to Deprecated, Retired, or Tombstoned per §24–§25.

---

# PART V — REGISTRY INTEGRITY CONSTRAINTS

The following constraints are binding on every registry release. Each constraint identifies its purpose, validation rule, and failure behavior. All failures are fail-closed and block release.

## RIC-01 — Canonical ID Uniqueness
- **Purpose:** Prevent ambiguous references.
- **Rule:** No canonical id may name two distinct entries in any release of a registry across all time.
- **Failure:** Release rejected.

## RIC-02 — Canonical ID Stability
- **Purpose:** Preserve historical reference integrity.
- **Rule:** A canonical id, once minted, must refer to the same conceptual entry for all time.
- **Failure:** Release rejected.

## RIC-03 — Reference Resolvability
- **Purpose:** Eliminate dangling references.
- **Rule:** Every declared dependency in every entry must resolve to a Published, Deprecated, or Retired entry in the named upstream registry within the declared version range.
- **Failure:** Release rejected.

## RIC-04 — Reference Tier Conformance
- **Purpose:** Enforce constitutional tier ordering.
- **Rule:** No entry may reference an entry in a registry of equal or downstream tier per the Ownership Matrix (Part III).
- **Failure:** Release rejected.

## RIC-05 — Ownership Exclusivity
- **Purpose:** Prevent ownership leakage.
- **Rule:** Every entry must be authored, modified, deprecated, retired, or tombstoned exclusively by its owning domain.
- **Failure:** Release rejected.

## RIC-06 — Scope Conformance
- **Purpose:** Prevent out-of-scope content.
- **Rule:** Every entry's content must fall within the declared scope of its owning registry.
- **Failure:** Release rejected.

## RIC-07 — Dependency Declaration Completeness
- **Purpose:** Eliminate implicit coupling.
- **Rule:** Every external reference in entry content must appear in the entry's declared dependency set.
- **Failure:** Release rejected.

## RIC-08 — Dependency Version Range Validity
- **Purpose:** Prevent incompatible composition.
- **Rule:** Every declared dependency version range must be non-empty and satisfied by the manifest of the coordinated release set.
- **Failure:** Release rejected.

## RIC-09 — Lifecycle Transition Legality
- **Purpose:** Enforce lifecycle integrity.
- **Rule:** Every transition recorded in the release must be permitted under §24 and not forbidden under §25.
- **Failure:** Release rejected.

## RIC-10 — Immutability of Published State
- **Purpose:** Protect historical truth.
- **Rule:** No prior published release may be altered by any subsequent action.
- **Failure:** Release rejected; integrity incident logged.

## RIC-11 — Tombstone Permanence
- **Purpose:** Prevent identifier resurrection.
- **Rule:** A tombstoned canonical id may never be reassigned, reused, or resurrected.
- **Failure:** Release rejected; integrity incident logged.

## RIC-12 — Provenance Completeness
- **Purpose:** Guarantee auditability.
- **Rule:** Every Approved-or-later entry must carry complete provenance per §6.4 and §27.
- **Failure:** Release rejected.

## RIC-13 — Validator Pass Requirement
- **Purpose:** Enforce content quality.
- **Rule:** Every Approved-or-later entry must have passed all validators declared for its registry and class.
- **Failure:** Release rejected.

## RIC-14 — Version Monotonicity
- **Purpose:** Preserve release ordering.
- **Rule:** Each new registry version must strictly succeed the prior version per the registry's declared versioning scheme.
- **Failure:** Release rejected.

## RIC-15 — Version Non-Reuse
- **Purpose:** Prevent historical rewriting.
- **Rule:** No version identifier may ever be reused for a distinct release.
- **Failure:** Release rejected; integrity incident logged.

## RIC-16 — Manifest Completeness
- **Purpose:** Guarantee reconstructibility.
- **Rule:** Every release manifest must enumerate all entries, all hashes, all dependencies, all compatibility ranges, and all lifecycle states sufficient to reconstruct the release.
- **Failure:** Release rejected.

## RIC-17 — Manifest Determinism
- **Purpose:** Eliminate manifest drift.
- **Rule:** Manifest serialization must be canonical, ordered, and byte-deterministic.
- **Failure:** Release rejected.

## RIC-18 — Hash Determinism
- **Purpose:** Guarantee fingerprint identity.
- **Rule:** Entry hashes, registry hashes, and release hashes must be deterministic across independent implementations given identical inputs.
- **Failure:** Release rejected; parity failure recorded.

## RIC-19 — Acyclicity
- **Purpose:** Prevent cyclic knowledge.
- **Rule:** The dependency graph induced by entry-level references must be acyclic across all registries.
- **Failure:** Release rejected.

## RIC-20 — Registry-Level Acyclicity
- **Purpose:** Prevent inter-registry cycles.
- **Rule:** The directed registry-to-registry dependency graph must be acyclic at all times.
- **Failure:** Release rejected.

## RIC-21 — Cross-Tier Reference Prohibition
- **Purpose:** Prevent cross-tier contamination.
- **Rule:** A registry may not reference a registry not enumerated in its permitted-reference set in Part III.
- **Failure:** Release rejected.

## RIC-22 — Reverse Dependency Prohibition
- **Purpose:** Prevent upstream pollution.
- **Rule:** No upstream registry may declare any dependency on any downstream registry.
- **Failure:** Release rejected.

## RIC-23 — Deprecation Successor Declaration
- **Purpose:** Preserve continuity.
- **Rule:** Every entry transitioning to Deprecated must declare a successor entry or an explicit absence of successor with justification.
- **Failure:** Release rejected.

## RIC-24 — Retirement Reference Quiescence
- **Purpose:** Prevent retired-entry adoption.
- **Rule:** No new entry in any registry may take a Retired entry as a dependency.
- **Failure:** Release rejected.

## RIC-25 — Tombstone Reference Prohibition
- **Purpose:** Eliminate invalid references.
- **Rule:** No entry in any release may reference a Tombstoned entry, except as a historical record of prohibition.
- **Failure:** Release rejected.

## RIC-26 — Compatibility Range Honesty
- **Purpose:** Prevent silent breakage.
- **Rule:** A release's declared engine and upstream-registry compatibility ranges must be validated against integration tests before publication.
- **Failure:** Release rejected.

## RIC-27 — Coordinated Release Consistency
- **Purpose:** Guarantee cross-registry coherence.
- **Rule:** When multiple registries are released together, every cross-registry reference must resolve within the coordinated manifest set.
- **Failure:** Coordinated release rejected.

## RIC-28 — Replay Fidelity
- **Purpose:** Guarantee historical reproducibility.
- **Rule:** A historical run must be reconstructible to byte-identical registry state, entries, and hashes.
- **Failure:** Replay invalid; governance review triggered.

## RIC-29 — Determinism Source Prohibition
- **Purpose:** Eliminate non-deterministic content.
- **Rule:** No entry, manifest, or hashing path may incorporate timestamps, locale, hash randomization, floating-point drift, or unordered set semantics in its canonical form.
- **Failure:** Release rejected.

## RIC-30 — Seal Hash Binding
- **Purpose:** Bind releases to the Canonical Ledger.
- **Rule:** Every release must be sealed under the Canonical Ledger and bear an immutable seal hash referenced by the manifest.
- **Failure:** Release non-authoritative; rejected.

## RIC-31 — Provenance Immutability
- **Purpose:** Preserve evidentiary record.
- **Rule:** Provenance records on published entries are immutable.
- **Failure:** Integrity incident; rejection.

## RIC-32 — Emergency Release Justification
- **Purpose:** Constrain emergency authority.
- **Rule:** Every emergency release must record its constitutional justification, scope of derogation, and remediation plan.
- **Failure:** Emergency release void.

## RIC-33 — Audit Reconstructibility
- **Purpose:** Guarantee auditor access.
- **Rule:** From the manifest set, an auditor must be able to reconstruct registry state, artifact state, and ledger state for any historical run without recourse to implementation internals.
- **Failure:** Audit failure; governance review triggered.

## RIC-34 — Forbidden Reference Set Enforcement
- **Purpose:** Codify Part III prohibitions.
- **Rule:** No entry may reference any registry enumerated as a prohibited reference for its owning registry.
- **Failure:** Release rejected.

## RIC-35 — Cross-Registry Identifier Disjointness
- **Purpose:** Prevent identifier collisions across registries.
- **Rule:** Canonical ids minted by distinct registries must be globally distinguishable by namespace.
- **Failure:** Release rejected.

---

# PART VI — REGISTRY DEPENDENCY CONSTITUTION

## §30. Tier Ordering
The registry dependency graph honors Constitutional tier ordering: Tier 1 (Signal) → Tier 2 (Pathway, Cause, Mechanism Graph, Condition) → Tier 3 (Desired Effect, Objective Template) → Tier 4 (Intervention Library, Capability Map, Kit Knowledge) → Tier 5 (Outcome, Monitoring, Escalation, Communication).

## §31. Allowed Relationships
A registry may depend only on registries enumerated in its **Upstream dependencies** field in Part III. Allowed reads are limited to entries in those registries that are Published, Deprecated, or Retired (per RIC-24). Allowed references are exactly the canonical ids of such entries.

## §32. Forbidden Relationships
Any relationship not explicitly allowed by Part III is forbidden. In particular:

- A registry may not depend on, read from, or reference any registry not listed in its upstream dependency set.
- A registry may not declare a dependency on a registry of equal tier unless explicitly permitted by Part III.
- A registry may not declare a dependency that would form a cycle either at the entry level (RIC-19) or at the registry level (RIC-20).

## §33. Reverse Dependency Prevention
Upstream registries are forbidden from referencing downstream registries (RIC-22). Knowledge flows strictly from foundational tiers toward governance tiers. Reverse flow is a constitutional violation.

## §34. Cross-Tier Contamination Prevention
A registry may not embed, restate, or shadow the content of another registry. References are by canonical id only. Inline duplication of upstream content is prohibited (RIC-21, RIC-34).

## §35. Ownership Leakage Prevention
A registry's entries may only encode knowledge within its owning domain. Knowledge proper to another domain must be referenced, never restated (RIC-05, RIC-06).

---

# PART VII — REGISTRY RELEASE GOVERNANCE

## §36. Release Units

### §36.1 Single Registry Release
A single-registry release publishes one registry version. It is permitted only when the new version introduces no cross-registry reference changes incompatible with downstream consumers within the declared compatibility range.

### §36.2 Coordinated Release
A coordinated release publishes two or more registry versions together under a single coordinated manifest. It is required whenever cross-registry references would otherwise resolve inconsistently.

### §36.3 Emergency Release
An emergency release publishes one or more registry versions outside the standard cadence to remediate an integrity incident, safety concern, or constitutional violation. Emergency releases are governed by §40.

## §37. Release Manifests
Every release produces:

- A **registry manifest** per registry version (the authoritative entry enumeration).
- A **dependency manifest** declaring all upstream registry version pins.
- A **compatibility manifest** declaring engine and downstream compatibility ranges.

For coordinated releases, the three manifests are unified under a coordinated manifest that ties all included registries to a single seal hash.

## §38. Approval Requirements
A release is approved only when:

- All entries in scope satisfy the Universal Registry Contract (Part II).
- All Registry Integrity Constraints (Part V) pass.
- All required domain authorizations are recorded.
- All parity and replay checks pass under §42.

## §39. Publication Requirements
Publication is the act of sealing the release manifest under the Canonical Ledger and assigning it a seal hash. A release is authoritative only after sealing.

## §40. Emergency Releases
Emergency releases require:

- Explicit declaration of emergency class and justification.
- Recorded scope of derogation: which standard rules, if any, are bypassed and under what authority.
- A remediation plan returning the system to standard cadence.
- Full audit recording per RIC-32.

Emergency releases may not derogate from determinism, immutability, ownership exclusivity, tier ordering, or tombstone permanence under any circumstance.

## §41. Rollback Requirements
Rollback is not the rewriting of a release. Rollback is the issuance of a new release that supersedes a faulty release by:

- Transitioning affected entries to Deprecated, Retired, or Tombstoned as appropriate.
- Publishing successor entries where required.
- Recording the rollback justification in the manifest.

Withdrawn releases remain in the audit record permanently; they are marked withdrawn but never deleted.

---

# PART VIII — REGISTRY AUDIT CONSTITUTION

## §42. Registry Hash Requirements
Every release carries:

- An entry hash for each entry.
- A registry hash binding the ordered set of entry hashes and the manifest.
- A seal hash issued by the Canonical Ledger upon publication.

All three are deterministic, immutable, and bound to each other.

## §43. Release Hash Requirements
A release hash uniquely identifies a release across all time and all implementations. It is computed deterministically from the manifest and entry hashes per RIC-18.

## §44. Manifest Requirements
A manifest must be:

- Complete (RIC-16).
- Deterministic in serialization (RIC-17).
- Sealed under the Canonical Ledger (RIC-30).
- Indefinitely retained.

## §45. Historical Reconstruction
For any historical run, an auditor must be able to reconstruct, using only publicly available manifests and the Canonical Ledger:

- The exact registry versions consumed.
- The exact entries and their contents.
- The exact dependency resolutions.
- The exact engine versions.
- The exact artifacts produced, their hashes, and the ledger entries that recorded them.

Reconstruction must succeed without access to implementation internals (RIC-33).

---

# PART IX — REPLAY GUARANTEE

## §46. Identity Under Replay
Given identical inputs, identical engine versions, and identical registry versions, the following must be byte-identical across independent implementations and across time:

- Artifact contents and artifact hashes.
- Decision Traces.
- Confidence Reports.
- Decision Ledgers.
- Seal Hashes.

## §47. Conditions That Invalidate Replay
Replay is invalidated, and the result is non-authoritative, when any of the following holds:

- A consumed registry version is unavailable in its sealed form.
- A consumed engine version is unavailable in its sealed form.
- A manifest cannot be reconstructed deterministically (RIC-17).
- Any hash recomputation diverges from the recorded value (RIC-18).
- Any entry referenced in the original run has been Tombstoned and the run depended on its content beyond historical record.

## §48. Conditions That Block Release
A release is blocked when any of the following holds:

- Any Registry Integrity Constraint (Part V) fails.
- Parity verification across two independent implementations of the canonical hashing path diverges.
- Any forbidden lifecycle transition is detected (§25).
- Any forbidden dependency is detected (§32).
- Any emergency derogation attempts to violate the inviolable rules of §40.

## §49. Conditions That Trigger Governance Review
Governance review is automatically triggered when:

- An integrity incident is logged under any RIC.
- An emergency release is published.
- A replay attempt fails (§47).
- An audit reconstruction fails (RIC-33).
- A parity failure is recorded (§50).

## §50. Release-Blocking Parity Failures
A parity failure occurs when two independent implementations, given identical inputs and identical registry and engine versions, produce divergent values for any of:

- Entry hashes.
- Registry hashes.
- Release hashes.
- Artifact hashes.
- Decision Traces.
- Confidence Reports.
- Decision Ledgers.
- Seal Hashes.

Any parity failure is release-blocking and remains so until resolved by constitutional governance review.

---

# PART X — ACCEPTANCE CRITERIA

## §51. Acceptance Test
This specification is accepted only when two independent teams, working from this document alone and without recourse to one another's implementations, given:

- identical inputs,
- identical engine versions,
- identical registry versions,

produce:

- identical artifact hashes,
- identical Decision Traces,
- identical Confidence Reports,
- identical Decision Ledgers,
- identical Seal Hashes.

## §52. Specification Properties
The specification must be, and is hereby declared to be:

- **Constitutional-grade:** subordinate only to the Constitution and the Canonical Ledger.
- **Deterministic:** admitting no non-deterministic content, ordering, or serialization in any canonical path.
- **Fail-closed:** every integrity, lifecycle, dependency, replay, and parity failure blocks publication.
- **Implementation-independent:** containing no API, storage, code, or example that any conforming implementation must adopt.
- **Regulator-ready:** providing complete audit reconstructibility for every historical run.
- **Audit-ready:** providing immutable provenance and seal hash binding for every authoritative artifact.

## §53. Closure
No clause of this document permits derogation from determinism, immutability, ownership exclusivity, tier ordering, tombstone permanence, or replay fidelity. Where ambiguity arises, the stricter interpretation prevails. Where conflict arises with the Constitution or the Canonical Ledger, those documents prevail.

— End of HairOS Phase 5A: Registry Governance Constitution —
