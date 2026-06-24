# HAIROS_REPORT_SYSTEM_SPECIFICATION.md

**Document Status:** Canonical
**Version:** 1.0.0
**Date:** 2026-06-04
**Authors:** Chief Medical Information Officer · Chief Clinical Intelligence Architect · Hair Restoration Specialist · Dermatology Reporting Expert · Clinical Informatics Specialist · Health Information Systems Architect
**Classification:** Implementation-Ready Contract

---

## Source Documents (Consumed, Never Modified)

This specification is downstream of, and bound to, the following canonical documents. It consumes their outputs; it does not redefine their semantics.

- `HAIROS_ARCHITECTURE.md`
- `HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.md`
- `HAIROS_SIGNAL_REGISTRY_V1.md`
- `HAIROS_ROOT_CAUSE_ENGINE.md`
- `HAIROS_CLINICAL_TRUST_LAYER.md`
- `HAIROS_RECOMMENDATION_DECISION_ENGINE_CONSTITUTION.md`
- `HAIROS_UX_CONTRACT_SPECIFICATION.md`
- `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md`
- HairOS Canonical Ledger

A report that cannot be traced back, line by line, to a node in one of these sources is non-conformant and MUST NOT be issued.

---

# PART I — REPORT PHILOSOPHY

## 1.1 Why the Report Exists

The HairOS report is the **primary clinical artifact** of the platform. Every other surface — chat, dashboards, monitoring views — is ephemeral. The report is the durable, signed, auditable record of what HairOS believed, why it believed it, and what it recommended at a specific moment in time.

The report is not a summary. The report is **evidence rendered into language**.

## 1.2 Patient Purpose

The report exists to give the patient:

- A truthful picture of their current scalp and hair state.
- A grounded explanation of the likely root causes, with honest uncertainty.
- A clear, prioritized recommendation set tied to outcomes the patient cares about.
- A baseline against which future progress (or regression) will be measured.
- The dignity of not being marketed to inside their own clinical record.

## 1.3 Doctor Purpose

The report exists to give the clinician:

- A reviewable clinical document at the altitude of a specialist note.
- Full visibility into signal evidence, pathway activation, and cause ranking.
- Confidence and dissent surfaced explicitly, never hidden in averaged scores.
- Recommendation rationale exposed at the level required to defend or override.
- A document suitable for chart inclusion, referral, and second opinion.

## 1.4 Clinical Purpose

The report is the canonical clinical instrument that:

- Translates Signal Registry, Pathway, Cause, and RDE outputs into a structured clinical narrative.
- Preserves the **semantic provenance chain** from raw observation to recommendation.
- Functions as the clinical handoff format for monitoring and reassessment.

## 1.5 Audit Purpose

Every report is an audit object. It MUST:

- Be reconstructable byte-for-byte from the Canonical Ledger plus registry versions.
- Contain the exact versions of every engine and registry that contributed.
- Carry an immutable identifier and a content hash.

## 1.6 Governance Purpose

The report is the artifact regulators, medical directors, and reviewers will inspect first. It must:

- Show what was claimed.
- Show what supported the claim.
- Show what would have changed the claim.
- Show what the system declined to claim.

## 1.7 The Report as the Visible Manifestation of HairOS Intelligence

HairOS intelligence is invisible until rendered. The chat is conversational; the engines are internal; the ledger is structural. The **report is where intelligence becomes accountable**. If the report is unclear, uncited, marketing-flavored, or evasive about uncertainty, then — regardless of how sophisticated the engines are — the system has failed at its only externally visible obligation: telling the truth, clearly, with evidence.

---

# PART II — REPORT TYPES

Five report types are defined. No other report type may be issued by HairOS without an amendment to this specification.

## 2.1 Patient Report

- **Audience:** The patient.
- **Purpose:** Convey state, causes, and plan in language the patient can act on.
- **Visibility:** Full patient-readable layer; doctor-only layers redacted.
- **Required Sections:** Executive Summary · Findings (patient layer) · Root Causes (patient layer) · Recommendations (patient layer) · Monitoring Plan · Explanation Block · Image Evidence (patient-safe) · Audit Footer (minimal).
- **Prohibited Sections:** Raw signal vectors · Pathway activation matrices · Dissent transcripts · Internal confidence math · Marketing content of any kind.

## 2.2 Doctor Report

- **Audience:** Licensed clinician.
- **Purpose:** Enable clinical review, override, and chart inclusion.
- **Visibility:** All patient content plus doctor expansions.
- **Required Sections:** All Patient Report sections at doctor depth · Signal Evidence Tables · Pathway Activation Summary · Cause Ranking with Dissent and Alternatives · RDE Rationale · Contraindications · Monitoring Thresholds · Full Audit Footer.
- **Prohibited Sections:** Patient-facing reassurance language not grounded in evidence · Any narrative not produced by the Explanation Engine.

## 2.3 Monitoring Report

- **Audience:** Patient + Doctor (dual-layer).
- **Purpose:** Report change between an anchored baseline and a follow-up assessment.
- **Visibility:** Layered.
- **Required Sections:** Baseline Reference · Current State · Delta Findings · Noise-Floor Statement · Trajectory Classification · Recommendation Adjustments · Monitoring Plan Update · Audit Footer.
- **Prohibited Sections:** Any improvement claim below noise floor · Trend statements not supported by the Trust Layer · Reframing of prior findings to manufacture progress.

## 2.4 Reassessment Report

- **Audience:** Patient + Doctor.
- **Purpose:** Re-derive the full clinical picture after a defined interval or trigger event.
- **Visibility:** Layered.
- **Required Sections:** All Doctor Report sections, regenerated · Comparison to Prior Reassessment · Cause Stability Statement · Plan Continuity Statement · Audit Footer.
- **Prohibited Sections:** Carry-forward of prior conclusions without re-derivation · Recommendations not re-validated by the current RDE pass.

## 2.5 Audit Report

- **Audience:** Medical director · Compliance · Regulator · Internal review.
- **Purpose:** Full reconstructable trace of a clinical decision and its evidence.
- **Visibility:** Unrestricted internal.
- **Required Sections:** Ledger Reference Block · Registry Version Manifest · Engine Version Manifest · Full Signal Trace · Full Pathway Trace · Full Cause Ranking Trace · Full RDE Trace · Trust Layer Outputs · Dissent Record · Diff Against Prior Report (if any) · Reconstruction Checksum.
- **Prohibited Sections:** Any narrative softening · Any patient-facing reassurance language · Any content not present in or derivable from the ledger.

---

# PART III — REPORT INFORMATION ARCHITECTURE

## 3.1 Mandatory Section Sequence

Every HairOS report — regardless of type — MUST follow this ordering. The ordering is clinical, not aesthetic.

1. **Header & Identity Block** — patient identity, encounter identity, report type, report version.
2. **Executive Summary** — Part IV.
3. **Findings** — Part V.
4. **Root Causes** — Part VI.
5. **Recommendations** — Part VII.
6. **Monitoring** — Part VIII.
7. **Explanation Block** — Part IX.
8. **Image Evidence** — Part X.
9. **Audit Footer** — Part XI.

## 3.2 Justification of the Ordering

- **Header first** anchors identity and prevents misattribution.
- **Executive Summary second** because every downstream audience needs the verdict before the evidence.
- **Findings before Causes** because causes are *interpretations* of findings; reversing the order inverts the epistemic chain.
- **Causes before Recommendations** because recommendations are *responses* to causes; presenting recommendations first would imply HairOS recommends actions independent of diagnosis.
- **Recommendations before Monitoring** because monitoring targets are derived from the recommendation plan.
- **Explanation Block before Image Evidence** because explanation is structural; images are corroborative.
- **Audit Footer last** because it certifies everything above.

## 3.3 Source Binding Rule

**No section may exist without an intelligence source.** Every section header in this specification declares the engine or registry whose output it consumes. A section with no upstream source is, by definition, fabrication and MUST NOT be rendered.

| Section | Sole Upstream Source |
|---|---|
| Executive Summary | Deterministic projection of Findings + Causes + Recommendations + Trust Layer |
| Findings | Signal Registry v1 |
| Root Causes | Root Cause Engine |
| Recommendations | Recommendation Decision Engine (RDE) |
| Monitoring | Trust Layer + RDE monitoring targets |
| Explanation Block | Clinical Explanation and Narrative Engine, under the Universal Explanation Contract |
| Image Evidence | Validated image pipeline (UX Contract §image-validation) |
| Audit Footer | Canonical Ledger |

---

# PART IV — EXECUTIVE SUMMARY

The Executive Summary is **deterministically generated**. It is a projection, not an authored paragraph. Two reports generated from the same ledger state, with the same engine versions, MUST yield byte-identical Executive Summaries.

## 4.1 Patient Snapshot

- Age band, sex assigned for clinical modeling, scalp region(s) of concern, assessment date, encounter ID.
- No subjective descriptors. No sentiment. No reassurance.

## 4.2 Risk Summary

- Aggregate risk classification (Low / Moderate / Elevated / High), inherited from the Trust Layer's calibrated risk band — never recomputed inside the report layer.
- Risk band MUST carry its confidence interval.

## 4.3 Primary Findings

- Top *N* findings by Signal Registry severity × confidence, with N bounded by the UX Contract (default N = 5).
- Each item: finding label, severity tier, confidence tier.

## 4.4 Primary Root Causes

- Top accepted causes from the Root Cause Engine, in rank order.
- Each item: cause label, posterior confidence, dissent flag if present.

## 4.5 Recommendation Summary

- Top recommendations from the RDE, grouped by objective.
- Each item: capability, recommendation, confidence, contraindication flag if present.

## 4.6 Confidence Summary

- Overall confidence posture: `High` / `Moderate` / `Provisional` / `Insufficient Evidence`.
- Bound to Trust Layer output. The report layer MUST NOT upgrade or downgrade this band.

## 4.7 Monitoring State

- One of: `Baseline Established` · `Stable` · `Improving` · `Progressing` · `Loss of Response` · `Escalation Triggered` · `Insufficient Data`.

## 4.8 Deterministic Generation Rules

- The Executive Summary is rendered from a pure function `summarize(ledgerSnapshot, engineVersions) → ExecutiveSummary`.
- No language model may author the Executive Summary. Templating only, with controlled vocabulary from the Explanation Engine's approved lexicon.
- Field ordering, truncation rules, and tie-breaks are specified by the UX Contract and MUST be honored.

---

# PART V — FINDINGS SECTION

**Sole source:** Signal Registry v1. The Findings section is a rendering of registered signals; it MAY NOT introduce findings that are not present as registry outputs.

## 5.1 Per-Finding Fields (Mandatory)

| Field | Definition | Source |
|---|---|---|
| Finding | Canonical finding label | Signal Registry |
| Severity | Tier (e.g. Minimal / Mild / Moderate / Marked / Severe) | Signal Registry severity function |
| Confidence | Trust-Layer-calibrated confidence band | Trust Layer |
| Evidence | Enumerated signal IDs and image references that triggered the finding | Signal Registry + Ledger |
| Clinical Meaning | Plain-language interpretation | Explanation Engine |
| Progression Implication | What this finding tends to indicate if unaddressed | Explanation Engine, gated by Knowledge Model |
| Uncertainty | Explicit statement of what is *not* known about this finding | Trust Layer + Explanation Engine |
| Change Triggers | The observable changes that would raise or lower this finding | Signal Registry change-trigger map |
| Doctor Expansion | Signal vector excerpt, thresholds crossed, sensor/quality notes | Signal Registry (doctor layer) |
| Audit Expansion | Ledger pointers for every signal contributing to the finding | Ledger |

## 5.2 Rules

- No finding may be rendered without a Confidence band.
- No finding may be rendered with Confidence below the Trust Layer's *report-eligibility threshold*; sub-threshold signals are surfaced only in the Audit Report.
- "Normal / unremarkable" findings MUST be rendered when clinically relevant — silence is not absence.

---

# PART VI — ROOT CAUSE SECTION

**Sole source:** Root Cause Engine. Inherits the Bayesian softmax over the 10 canonical causes and the `compositeRule` semantics for multifactorial cases (per Sprint 1 Week 3 cause intelligence contracts).

## 6.1 Per-Cause Fields (Mandatory)

| Field | Definition |
|---|---|
| Accepted Cause | Canonical cause ID + label |
| Supporting Evidence | Findings and signals that elevated this cause |
| Pathway Evidence | Activated pathways contributing posterior weight |
| Signal Evidence | Specific signal IDs with weights |
| Confidence | Posterior probability + Trust Layer band |
| Dissent | Any engine, rule, or reviewer dissent recorded against this acceptance |
| Alternatives | Causes that were considered and not accepted |
| Why Not Alternatives | Reason each alternative was outranked or excluded |
| Uncertainty | What additional evidence would change the ranking |
| Doctor Layer | Pathway activation matrix, posterior table, compositeRule trace if applicable |
| Audit Layer | Ledger pointers to the exact ranker invocation, registry version, and inputs |

## 6.2 Rules

- Multifactorial acceptance requires an explicit `compositeRule` trace in the Doctor Layer.
- The report MUST never collapse multiple accepted causes into a single label for readability — multifactorial states are reported multifactorially.
- Dissent, where present, MUST be visible in the patient layer at minimum as a flag ("clinical reviewers were not unanimous on this cause"), with full detail in the doctor layer.

---

# PART VII — RECOMMENDATION SECTION

**Sole source:** Recommendation Decision Engine (RDE). The report MAY NOT generate, soften, strengthen, or reorder recommendations.

## 7.1 Per-Recommendation Fields (Mandatory)

| Field | Definition |
|---|---|
| Objective | The clinical objective the recommendation serves |
| Capability | The class of intervention (e.g. topical anti-androgen, nutritional correction, procedural) |
| Recommendation | The specific recommended action as emitted by the RDE |
| Why | Causal and evidentiary justification from the RDE rationale |
| Why Not Alternatives | RDE's emitted reasons for not recommending considered alternatives |
| Contraindications | Hard and soft contraindications detected for this patient |
| Monitoring Targets | Quantitative or categorical targets the Monitoring section will track |
| Success Criteria | Definition of response and definition of non-response |
| Confidence | RDE confidence × Trust Layer band |
| Doctor Layer | Full RDE decision trace including suppressed candidates |
| Audit Layer | Ledger pointers to RDE invocation and constitution version |

## 7.2 Rules

- A recommendation with unresolved hard contraindication MUST be withheld and reported as withheld, with reason.
- No recommendation may be reworded by the report layer; only the Explanation Engine may render the patient-facing surface form, and only from RDE-approved templates.

---

# PART VIII — MONITORING SECTION

## 8.1 Required Sub-Reports

- **Baseline** — anchored state at first qualifying assessment.
- **Follow-up** — current state vs. baseline.
- **Improvement** — change exceeding the positive noise floor.
- **Stability** — change within noise floor.
- **Progression** — change exceeding the negative noise floor.
- **Loss of Response** — prior improvement no longer sustained.
- **Escalation** — trigger condition met that mandates plan revision.

## 8.2 Noise-Floor Rules (Mandatory)

- Every reported change MUST be compared against the Trust Layer's per-signal noise floor.
- A change within the noise floor MUST be reported as **Stable**, never as improvement or progression.
- Aggregate trajectory MUST NOT be reported as positive unless at least one signal exceeds its positive noise floor *and* no signal exceeds its negative noise floor — or compositeRule explicitly authorizes the aggregate verdict.

## 8.3 Rules

- "Improvement" is a reserved word. It may not be used outside a noise-floor-validated comparison.
- Visualizations of trajectory MUST render the noise-floor band; charts without the band are non-conformant.

---

# PART IX — EXPLANATION SECTION

This section embeds the **Universal Explanation Contract** as defined in `HAIROS_CLINICAL_EXPLANATION_AND_NARRATIVE_ENGINE.md`. Every major output — every finding, every cause, every recommendation, every monitoring verdict — MUST be answerable on all five axes:

1. **Why** — the affirmative reason this output was produced.
2. **Why Not** — the alternatives that were considered and rejected.
3. **Evidence** — the enumerated upstream artifacts that support it.
4. **Confidence** — the Trust-Layer-calibrated band.
5. **Change Triggers** — the specific future observations that would revise it.

A report in which any major output cannot answer all five is non-conformant and MUST NOT be issued.

---

# PART X — IMAGE EVIDENCE SECTION

## 10.1 Rules

- **Validated images only.** Any image rendered into a report MUST have passed the validation pipeline defined in the UX Contract (quality, lighting, framing, identity-binding).
- **Image confidence.** Each image carries a quality and confidence score; this score MUST be displayed.
- **Image quality.** Substandard images MAY be retained in the ledger but MUST NOT be used to support findings rendered in the report.
- **Evidence attribution.** Every image displayed in a clinical context MUST be annotated with the signal(s) or finding(s) it evidences. Decorative or unattributed images are prohibited.
- **No decorative imagery.** No stock photography. No before/after composites assembled by the report layer.
- **No marketing imagery.** No product photography, brand imagery, or aspirational visuals in any clinical report.

---

# PART XI — AUDIT SECTION

The Audit Footer is the cryptographic and structural certification of the report.

## 11.1 Required Contents

- **Registry versions:** Signal Registry, Cause Registry, Pathway Registry, RDE Constitution, Knowledge Model, UX Contract, Explanation Engine — each with semver and content hash.
- **Ledger references:** the exact ledger event IDs consumed to generate this report.
- **Trust Layer version:** semver, calibration set ID, and last recalibration timestamp.
- **Report generation timestamp:** UTC, ISO-8601, with monotonic source.
- **Report content hash:** hash over the canonicalized report payload.
- **Reconstruction manifest:** the minimal input set sufficient to regenerate this report byte-for-byte.

## 11.2 Reconstruction Requirement

Given the reconstruction manifest and the pinned engine/registry versions, regenerating the report MUST yield an identical content hash. Failure to reconstruct invalidates the report and triggers an audit incident.

---

# PART XII — EXPORT CONTRACT

## 12.1 PDF

- Canonical, paginated, print-stable.
- Embedded fonts; no external asset fetches at render time.
- Headers and footers carry report ID, page numbers, and content hash.
- PDF is generated from the same canonical payload as all other exports — never re-authored.

## 12.2 Doctor Print View

- Compact clinical layout.
- All doctor-layer expansions inline.
- Optimized for chart inclusion (Letter and A4 layouts both supported).

## 12.3 Patient View

- Web-rendered, accessibility-conformant per the UX Contract.
- Patient-layer content only; doctor and audit layers omitted.
- Plain-language Explanation Block expanded by default.

## 12.4 EMR-Compatible Export

- Structured export in FHIR-aligned resources:
  - `DiagnosticReport` for the report envelope.
  - `Observation` per finding, with LOINC where mappable.
  - `Condition` per accepted cause, with ICD-10 where mappable.
  - `CarePlan` and `ServiceRequest` for recommendations.
  - `Provenance` for the audit footer.
- All identifiers stable across reissues of the same report.

## 12.5 Future API Export

- A signed JSON envelope containing the canonical payload, the reconstruction manifest, and the audit footer.
- Schema versioned independently; backward compatibility guaranteed for at least two minor versions.
- Consumers MUST verify the content hash before trusting any field.

---

# PART XIII — ACCEPTANCE CRITERIA

A HairOS report system implementation is **valid only if every one of the following holds**. These criteria are not aspirational; they are gating.

1. **Evidence traceability.** Every statement in every report traces to an enumerated upstream artifact in the Signal Registry, Cause Engine, RDE, Trust Layer, Explanation Engine, or Ledger.
2. **Confidence traceability.** Every confidence statement traces to a Trust Layer output. The report layer never authors a confidence value.
3. **Recommendation traceability.** Every recommendation traces to an RDE output. The report layer never authors, softens, strengthens, or reorders recommendations.
4. **Cause traceability.** Every root cause traces to a Root Cause Engine acceptance, including dissent and compositeRule traces where applicable.
5. **Finding traceability.** Every finding traces to a Signal Registry output above the report-eligibility threshold.
6. **Reconstructability.** Every report is reconstructable byte-for-byte from the Canonical Ledger plus the pinned registry and engine versions recorded in the Audit Footer.
7. **No marketing language.** No promotional, aspirational, brand, or persuasive language appears in any report.
8. **No unsupported claims.** No claim appears without an enumerated source.
9. **No hidden uncertainty.** Uncertainty is rendered explicitly on every major output; silence about uncertainty is prohibited.
10. **No fabricated progress.** No improvement, stability, or progression statement is rendered without noise-floor validation.

A report that fails any of the above MUST NOT be issued. A system that issues such a report MUST be treated as failing its clinical contract and remediated before resumption.

---

**End of Specification.**

This document is the canonical report contract for HairOS. Amendments require sign-off from the Chief Medical Information Officer, the Chief Clinical Intelligence Architect, and the Medical Director of record. All amendments MUST be versioned and ledgered.
