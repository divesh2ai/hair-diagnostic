# HAIROS_SIGNAL_REGISTRY_V1

# CANONICAL SIGNAL REGISTRY

**Document Class:** Authoritative Signal Registry (scientific knowledge asset).
**Authority Tier:** Subordinate to the HairOS Constitution, the Canonical Ledger & Contract Specification, Phase 5A (Registry Governance Constitution), Phase 5B (Registry Specification Constitution), and the Clinical Intelligence Master Knowledge Model.
**Scope:** Definition of every clinically meaningful signal that HairOS may detect, observe, infer, report, measure, or monitor.
**Status:** Authoritative.
**Determinism Class:** Evidence-based, clinically defensible, deterministic, explainable, audit-ready, implementation-independent.

**This document contains signals only. It contains no diagnoses, no pathways, no root causes, no treatments, no recommendations, no implementation, and no marketing language.**

Where constitutional or schema rules exist upstream (Phase 5A, Phase 5B, Canonical Ledger), this document references them rather than restating them.

---

# PART I — REGISTRY PURPOSE

## §1. Definitions

### §1.1 Signal
A *signal* is a clinically meaningful, biologically grounded observable phenomenon whose presence, absence, magnitude, or trajectory provides evidence about the state of the hair, scalp, follicular biology, or relevant systemic context. A signal is **evidence**. It is never, by itself, a conclusion. It is not a diagnosis, a pathway assertion, a cause assertion, or a recommendation.

### §1.2 Observed Signal
A signal that is directly visible, palpable, or otherwise sensorially detectable by an examining party (clinician, photograph, trichoscope, or validated imaging). Observation is independent of patient report.

### §1.3 Reported Signal
A signal that is supplied by the patient or by a proxy reporter through questionnaire, interview, or structured self-assessment. Reported signals are admissible evidence but carry their own confidence characteristics.

### §1.4 Derived Signal
A signal whose value is computed deterministically from one or more underlying signals (observed, reported, or measured) through a declared derivation rule. A derived signal does not exist in nature; it exists by canonical construction.

### §1.5 Monitoring Signal
A signal whose principal evidentiary value is its trajectory across time (improvement, stability, regression, recurrence) rather than its instantaneous value. Monitoring signals are defined by their evaluation window and trajectory semantics.

### §1.6 Composite Signal
A signal that is constituted from multiple constituent signals under a canonical declarative rule. A composite signal asserts the joint presence of its constituents and inherits the lifecycle constraints of Phase 5B §11 and §28.

### §1.7 Suppression Signal
A signal whose presence reduces the evidentiary weight of another signal under a declared, deterministic predicate. A suppression signal does not contradict; it modulates.

### §1.8 Contradictory Signal
A signal whose presence is biologically incompatible with the presence of another signal in the same evaluation context. Contradictory pairs require explicit symmetric declaration.

## §2. Signals Are Evidence, Not Conclusions

Signals are the **input substrate** of HairOS evaluation. The interpretation of signals — their mapping to pathways, causes, conditions, objectives, or interventions — occurs in registries downstream of this one. Within this registry, no signal carries a clinical conclusion, a probability assignment, a pathway weight, or a cause attribution.

A signal's role is to be observable, defined, and admissible. Its consequences belong elsewhere.

---

# PART II — SIGNAL CLASSIFICATION SYSTEM

The Signal Registry is partitioned into the following canonical categories. Each category is a controlled grouping; every signal belongs to exactly one primary category and may belong to one or more secondary categories declared explicitly.

| Code | Category |
|------|----------|
| A | Density Signals |
| B | Volume Signals |
| C | Hairline Signals |
| D | Pattern Signals |
| E | Shedding Signals |
| F | Caliber Signals |
| G | Miniaturization Signals |
| H | Scalp Surface Signals |
| I | Inflammatory Signals |
| J | Scarring Signals |
| K | Hair Shaft Signals |
| L | Patch Loss Signals |
| M | Systemic Signals |
| N | Endocrine Signals |
| O | Nutritional Signals |
| P | Medication Signals |
| Q | Mechanical / Cosmetic Signals |
| R | Psychological / Behavioral Signals |
| S | Monitoring Signals |
| T | Recovery Signals |
| U | Progression Signals |
| V | Escalation Signals |

Category membership is declarative and immutable per signal version. Reclassification requires issuance of a successor signal per Phase 5A §24.

---

# PART III — CANONICAL SIGNAL TEMPLATE

Every signal definition in Parts IV–X.5 conforms to the following declarative template:

- **Signal Name** — canonical human-readable name.
- **Clinical Definition** — the observable referent.
- **Detection Method** — how the signal becomes admissible (Observed, Reported, Derived, Measured, Monitored).
- **Clinical Meaning** — what the signal is evidence *of* at the signal layer only.
- **Strength of Evidence** — categorical descriptor of the typical evidentiary weight when present (Weak / Moderate / Strong / Pathognomonic-class).
- **Supporting Signals** — signals whose co-presence reinforces this signal's evidentiary value.
- **Suppressing Signals** — signals whose presence reduces this signal's evidentiary weight.
- **Known Confounders** — non-signal factors that may mimic or distort this signal.
- **Monitoring Value** — admissibility as a trajectory signal.
- **Escalation Relevance** — whether and under what circumstances the signal contributes to escalation evaluation.
- **Reversibility Relevance** — what the signal implies about the reversibility of the underlying state at the signal layer only.

This template **does not** carry pathway assignments, cause assignments, treatments, or recommendations.

---

# PART IV — HAIRLINE SIGNAL LIBRARY (Category C)

## SIG-HL-001 — Temple Recession
- **Clinical Definition.** Localized backward movement of the hairline at one or both temples beyond the historical baseline.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Evidence of anterior hairline change in the temporal zone.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Bitemporal recession; caliber heterogeneity at the frontal scalp; vertex thinning.
- **Suppressing Signals.** Loss of follicular ostia in the recessed zone; lonely-hair sign.
- **Known Confounders.** Mature adult hairline (non-pathologic); congenital high hairline; traction-induced marginal loss.
- **Monitoring Value.** High — landmarks are reproducible across visits.
- **Escalation Relevance.** Escalation indicated if accompanied by loss of ostia or perifollicular inflammation.
- **Reversibility Relevance.** Reversibility depends on absence of structural injury; signal alone is non-determinative.

## SIG-HL-002 — Bitemporal Recession
- **Clinical Definition.** Symmetric or near-symmetric recession of both temporal hairline corners.
- **Detection Method.** Observed.
- **Clinical Meaning.** Symmetric anterior hairline change.
- **Strength of Evidence.** Strong when paired with caliber heterogeneity.
- **Supporting Signals.** M-shaped pattern; vertex loss; midfrontal caliber reduction.
- **Suppressing Signals.** Loss of ostia; lonely-hair sign; pure ophiasis pattern.
- **Known Confounders.** Mature hairline; traction history.
- **Monitoring Value.** High.
- **Escalation Relevance.** As §SIG-HL-001.
- **Reversibility Relevance.** Indeterminate at the signal layer.

## SIG-HL-003 — M-Shaped Pattern
- **Clinical Definition.** Combined temple recession producing a centrally preserved frontal forelock and bilaterally recessed temples (M-shape).
- **Detection Method.** Observed.
- **Clinical Meaning.** Recognized anterior hairline configuration.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Vertex loss; caliber heterogeneity.
- **Suppressing Signals.** Frontal band loss with lonely hairs; preserved hairline with midline widening.
- **Known Confounders.** Mature hairline variant.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low unless other features present.
- **Reversibility Relevance.** Indeterminate.

## SIG-HL-004 — Diffuse Frontal Recession
- **Clinical Definition.** Recession across the entire frontal hairline without a clear M-shape; band-like or uniform.
- **Detection Method.** Observed.
- **Clinical Meaning.** Anterior recession of non-pattern morphology.
- **Strength of Evidence.** Moderate to strong.
- **Supporting Signals.** Lonely-hair sign; perifollicular erythema along the frontal band; eyebrow thinning.
- **Suppressing Signals.** Preserved follicular ostia and absence of inflammation.
- **Known Confounders.** Traction; cosmetic shaping.
- **Monitoring Value.** High.
- **Escalation Relevance.** High when accompanied by ostia loss or band-distributed inflammation.
- **Reversibility Relevance.** Diminished reversibility when structural injury co-occurs.

## SIG-HL-005 — Frontal Hairline Preservation
- **Clinical Definition.** Maintenance of the anterior hairline within historical contour despite documented density or caliber change posterior to it.
- **Detection Method.** Observed.
- **Clinical Meaning.** Distinguishing morphologic feature.
- **Strength of Evidence.** Strong (as a discriminator).
- **Supporting Signals.** Central part widening; Christmas-tree pattern.
- **Suppressing Signals.** Frontal band loss; lonely-hair sign.
- **Known Confounders.** Heavy frontal styling masking subtle change.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low when isolated.
- **Reversibility Relevance.** Indeterminate.

## SIG-HL-006 — Occipital Preservation
- **Clinical Definition.** Preserved density and caliber across the occipital scalp.
- **Detection Method.** Observed.
- **Clinical Meaning.** Distribution discriminator.
- **Strength of Evidence.** Strong (as discriminator).
- **Supporting Signals.** Pattern-distributed loss elsewhere; caliber heterogeneity in non-occipital zones.
- **Suppressing Signals.** Diffuse loss extending into the occipital region.
- **Known Confounders.** Limited visibility; styling masking.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-HL-007 — Crown Expansion
- **Clinical Definition.** Centrifugal enlargement of a thinned or bald zone at the crown over time.
- **Detection Method.** Observed; Monitored.
- **Clinical Meaning.** Topographic progression at the crown.
- **Strength of Evidence.** Strong as a progression signal.
- **Supporting Signals.** Vertex loss; caliber heterogeneity.
- **Suppressing Signals.** Crown-centered ostia loss with smooth shiny skin (different process implied at signal layer).
- **Known Confounders.** Lighting; styling.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate at signal layer; structural-injury co-signals reduce.

## SIG-HL-008 — Vertex Loss
- **Clinical Definition.** Visible thinning or bald zone at the vertex.
- **Detection Method.** Observed.
- **Clinical Meaning.** Topographic finding at the crown.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Bitemporal recession; caliber heterogeneity; M-shape.
- **Suppressing Signals.** Loss of ostia within the vertex zone.
- **Known Confounders.** Whorl pattern variation; styling.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-HL-009 — Frontal Band Loss
- **Clinical Definition.** Linear, band-like recession across the frontal hairline.
- **Detection Method.** Observed.
- **Clinical Meaning.** Band-morphology recession.
- **Strength of Evidence.** Strong when accompanied by lonely hairs or perifollicular signs.
- **Supporting Signals.** Lonely-hair sign; eyebrow thinning; perifollicular erythema; loss of ostia in the band.
- **Suppressing Signals.** Preserved ostia with absent inflammation.
- **Known Confounders.** Traction.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reduced reversibility in zones with structural-injury co-signals.

## SIG-HL-010 — Hairline Asymmetry
- **Clinical Definition.** Asymmetric anterior hairline contour exceeding cosmetic baseline asymmetry.
- **Detection Method.** Observed.
- **Clinical Meaning.** Distribution asymmetry.
- **Strength of Evidence.** Weak in isolation; stronger as part of patchy or traction profiles.
- **Supporting Signals.** Patchy loss; traction history; broken hairs of varying length.
- **Suppressing Signals.** Strictly symmetric pattern features.
- **Known Confounders.** Styling; congenital asymmetry.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low to moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-HL-011 — Hairline Instability
- **Clinical Definition.** Documented change in hairline position across two reassessment intervals.
- **Detection Method.** Monitored; derived from paired observations.
- **Clinical Meaning.** Temporal change.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Crown expansion; caliber reduction.
- **Suppressing Signals.** None.
- **Known Confounders.** Measurement inconsistency; styling at reassessment.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate to high.
- **Reversibility Relevance.** Trajectory only.

## SIG-HL-012 — Lonely-Hair Sign
- **Clinical Definition.** Isolated terminal hairs positioned anterior to a receded frontal hairline.
- **Detection Method.** Observed (clinician/trichoscopic).
- **Clinical Meaning.** Discriminator for band-pattern recession with structural injury behind.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Frontal band loss; eyebrow thinning; perifollicular erythema and scaling along the band.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic shaping.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Co-occurs with reduced-reversibility signal context.

## SIG-HL-013 — Mature Hairline (Non-Pathologic Reference Signal)
- **Clinical Definition.** Symmetric mild anterior recession consistent with adult maturation of the hairline.
- **Detection Method.** Observed.
- **Clinical Meaning.** Reference (non-pathologic) configuration.
- **Strength of Evidence.** Reference.
- **Supporting Signals.** None pathologic.
- **Suppressing Signals.** Caliber heterogeneity; vertex loss; lonely-hair sign.
- **Known Confounders.** Congenital high hairline.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** None when isolated.
- **Reversibility Relevance.** Not applicable.

---

# PART V — PATTERN SIGNAL LIBRARY (Category D)

## SIG-PT-001 — Hamilton–Norwood Pattern (Categorical Stage)
- **Clinical Definition.** A documented pattern of male-presenting hair loss matching one of the canonical Hamilton–Norwood stages I–VII, including IIa, IIIa, IVa variants.
- **Detection Method.** Observed; staged categorically.
- **Clinical Meaning.** Topographic categorization of pattern loss in male-presenting morphology.
- **Strength of Evidence.** Strong as a pattern descriptor.
- **Supporting Signals.** Caliber heterogeneity; vertex loss; bitemporal recession.
- **Suppressing Signals.** Loss of ostia within pattern zones; ophiasis pattern; lonely-hair sign.
- **Known Confounders.** Co-occurrence with diffuse processes; mature hairline misclassification.
- **Monitoring Value.** Very high (staged trajectory).
- **Escalation Relevance.** Low unless accompanied by structural-injury signals.
- **Reversibility Relevance.** Variable; signal alone is non-determinative.

## SIG-PT-002 — Ludwig Pattern (Categorical Stage)
- **Clinical Definition.** A documented pattern of female-presenting hair loss matching Ludwig stages I, II, or III.
- **Detection Method.** Observed; staged categorically.
- **Clinical Meaning.** Topographic categorization of central thinning.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Central part widening; Christmas-tree pattern; frontal hairline preservation.
- **Suppressing Signals.** Frontal band loss; lonely-hair sign; loss of ostia.
- **Known Confounders.** Chronic diffuse processes mimicking pattern.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low when isolated.
- **Reversibility Relevance.** Variable.

## SIG-PT-003 — Sinclair Pattern (Categorical Stage)
- **Clinical Definition.** A documented pattern of female-presenting central thinning matching Sinclair stages 1–5 by midline part-line photography.
- **Detection Method.** Observed; staged by canonical midline photographic comparator.
- **Clinical Meaning.** Topographic and severity categorization.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Christmas-tree pattern; central part widening.
- **Suppressing Signals.** Loss of ostia; frontal band loss.
- **Known Confounders.** Lighting; styling; photographic angle.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low when isolated.
- **Reversibility Relevance.** Variable.

## SIG-PT-004 — Christmas-Tree Pattern
- **Clinical Definition.** Triangular widening of the central part anteriorly with apex at the vertex and base at the frontal scalp.
- **Detection Method.** Observed.
- **Clinical Meaning.** Pattern-morphology descriptor in female-presenting central thinning.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Central part widening; frontal hairline preservation; caliber heterogeneity.
- **Suppressing Signals.** Loss of ostia; ophiasis pattern.
- **Known Confounders.** Photographic interpretation variance.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-PT-005 — Diffuse Thinning Without Pattern
- **Clinical Definition.** Generalized reduction in density and/or caliber across the scalp lacking discernible pattern distribution.
- **Detection Method.** Observed; Reported; Measured.
- **Clinical Meaning.** Non-patterned diffuse process descriptor.
- **Strength of Evidence.** Moderate to strong.
- **Supporting Signals.** Acute or chronic shedding; positive pull test; reduced ponytail circumference.
- **Suppressing Signals.** Bitemporal recession with vertex loss; frontal band loss; loss of ostia.
- **Known Confounders.** Heavy styling; early pattern loss not yet morphologically declared.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate when accompanied by systemic signals.
- **Reversibility Relevance.** Indeterminate.

## SIG-PT-006 — Retrograde Pattern
- **Clinical Definition.** Thinning extending from the parietal/temporal margins downward toward the nape, opposite to typical androgenetic distribution.
- **Detection Method.** Observed.
- **Clinical Meaning.** Atypical topographic descriptor.
- **Strength of Evidence.** Strong (as discriminator).
- **Supporting Signals.** Occipital involvement; diffuse signals.
- **Suppressing Signals.** Strict Hamilton–Norwood distribution; pure ophiasis.
- **Known Confounders.** Cosmetic shaping; mechanical loss.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-PT-007 — Ophiasis Pattern
- **Clinical Definition.** Band-like alopecia along the occipital and temporal hair margins.
- **Detection Method.** Observed.
- **Clinical Meaning.** Specific topographic distribution.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Patch loss elsewhere; exclamation-mark hairs; yellow dots; black dots.
- **Suppressing Signals.** Loss of ostia within the ophiasic zone (different process implied at signal layer).
- **Known Confounders.** Traction band along the margin.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate at signal layer.

## SIG-PT-008 — Sisaipho Pattern
- **Clinical Definition.** Diffuse loss sparing the peripheral hair margin (the inverse topography of ophiasis).
- **Detection Method.** Observed.
- **Clinical Meaning.** Inverse-marginal distribution descriptor.
- **Strength of Evidence.** Strong (rare; high specificity as a descriptor).
- **Supporting Signals.** Diffuse central loss; exclamation-mark hairs.
- **Suppressing Signals.** Loss of ostia; pattern-class signals.
- **Known Confounders.** Pattern misclassification.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate.

## SIG-PT-009 — Patch Pattern (Single or Multifocal)
- **Clinical Definition.** Discrete circumscribed alopecic patches, single or multifocal, with or without geometric borders.
- **Detection Method.** Observed.
- **Clinical Meaning.** Patchy topographic descriptor.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Exclamation-mark hairs; yellow dots; black dots; nail pitting; preserved follicular ostia within patches.
- **Suppressing Signals.** Loss of ostia within patches; pure pattern distribution.
- **Known Confounders.** Trichotillomania-induced patches; tinea capitis patches; congenital triangular alopecia.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Patch-level reversibility favored when ostia preserved; reduced when not.

## SIG-PT-010 — Diffuse Unpatterned Loss
- **Clinical Definition.** Synonym admissible for SIG-PT-005 used when distinguishing from non-diffuse cohorts; declared explicitly for clarity in monitoring.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Equivalent to SIG-PT-005 with monitoring framing.
- **Strength of Evidence.** Moderate to strong.
- **Supporting Signals.** As SIG-PT-005.
- **Suppressing Signals.** As SIG-PT-005.
- **Known Confounders.** As SIG-PT-005.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

---

# PART VI — SHEDDING SIGNAL LIBRARY (Category E)

## SIG-SH-001 — Acute Shedding
- **Clinical Definition.** Patient-perceived or observed marked increase in club-hair shedding persisting for a discrete period of weeks to a small number of months.
- **Detection Method.** Reported; Observed in shower/brush/pillow yield.
- **Clinical Meaning.** Acute increase in hair release.
- **Strength of Evidence.** Strong as a temporal signal.
- **Supporting Signals.** Sudden increase in shedding; post-event shedding; positive pull test; telogen shedding morphology.
- **Suppressing Signals.** Anagen shedding morphology; loss of ostia; strict pattern presentation without diffuse component.
- **Known Confounders.** Seasonal shedding; cosmetic over-handling; bathing frequency change.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate at signal layer; trajectory-determined.

## SIG-SH-002 — Chronic Shedding
- **Clinical Definition.** Sustained elevated shedding lasting six months or longer.
- **Detection Method.** Reported; Observed across monitoring windows.
- **Clinical Meaning.** Persistent increased shedding.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Diffuse thinning without pattern; persistent positive pull test.
- **Suppressing Signals.** Anagen morphology of shed hairs; isolated focal pattern recession.
- **Known Confounders.** Repeated triggers; styling regimen change.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate to high.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-003 — Intermittent Shedding
- **Clinical Definition.** Recurrent episodes of increased shedding separated by periods of normal release.
- **Detection Method.** Reported; Monitored.
- **Clinical Meaning.** Episodic release pattern.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Seasonal shedding; post-event shedding; documented stressors.
- **Suppressing Signals.** Strictly continuous elevated shedding.
- **Known Confounders.** Reporting bias; awareness-driven amplification.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-004 — Wash-Day Shedding
- **Clinical Definition.** Increased perceived shedding concentrated on hair-wash days exceeding patient baseline for wash-day yield.
- **Detection Method.** Reported.
- **Clinical Meaning.** Wash-correlated release.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Brush shedding; acute shedding; positive pull test.
- **Suppressing Signals.** Anagen morphology.
- **Known Confounders.** Decreased wash frequency producing accumulated yield; aggressive surfactants.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-005 — Brush Shedding
- **Clinical Definition.** Increased hair yield during brushing or combing compared with baseline.
- **Detection Method.** Reported.
- **Clinical Meaning.** Detachment with mechanical handling.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Acute shedding; positive pull test.
- **Suppressing Signals.** Anagen morphology.
- **Known Confounders.** Brush type; tangling; styling.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-006 — Anagen Shedding Morphology
- **Clinical Definition.** Shed hairs exhibit anagen morphology (pigmented bulb, retained sheath remnants) rather than club morphology.
- **Detection Method.** Observed (microscopy/trichoscopy).
- **Clinical Meaning.** Active-phase release rather than rested-phase release.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Severe rapid shedding; broken hairs at variable lengths.
- **Suppressing Signals.** Pure club morphology.
- **Known Confounders.** Plucking; mechanical extraction.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reversibility favored when niche intact.

## SIG-SH-007 — Telogen Shedding Morphology
- **Clinical Definition.** Shed hairs predominantly exhibit club-hair morphology with depigmented, keratinized bulbs and absent sheath.
- **Detection Method.** Observed (microscopy/trichoscopy).
- **Clinical Meaning.** Resting-phase release.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Diffuse thinning; positive bilateral pull test of clubs; recent stressor.
- **Suppressing Signals.** Anagen morphology.
- **Known Confounders.** Plucking technique artifact.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SH-008 — Seasonal Shedding
- **Clinical Definition.** Mild cyclic increase in shedding aligned with seasonal transitions and reverting between cycles.
- **Detection Method.** Reported; Monitored.
- **Clinical Meaning.** Cyclic background variability.
- **Strength of Evidence.** Reference (non-pathologic when isolated).
- **Supporting Signals.** None pathologic.
- **Suppressing Signals.** Persistent elevated shedding outside the seasonal window.
- **Known Confounders.** Climate variability; styling changes.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** None when isolated.
- **Reversibility Relevance.** Not applicable.

## SIG-SH-009 — Post-Event Shedding
- **Clinical Definition.** Increased shedding emerging within a typical biological latency (commonly 8–16 weeks) after an identifiable systemic event (illness, surgery, parturition, severe weight loss, severe stressor, medication change).
- **Detection Method.** Reported; Derived from temporal correlation with antecedent event.
- **Clinical Meaning.** Temporally event-linked release.
- **Strength of Evidence.** Strong when the temporal correlation is unambiguous.
- **Supporting Signals.** Telogen morphology; positive pull test; diffuse pattern.
- **Suppressing Signals.** Strictly patterned distribution without diffuse component.
- **Known Confounders.** Coincident triggers; recall bias.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored when niche intact.

## SIG-SH-010 — Sudden Increase in Shedding
- **Clinical Definition.** Patient-reported step-change in daily shedding occurring over a short window (days to a small number of weeks) without yet meeting acute-shedding duration criteria.
- **Detection Method.** Reported.
- **Clinical Meaning.** Early-onset escalation in release rate.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Recent stressor; medication change; positive pull test.
- **Suppressing Signals.** Anagen morphology coincident with patch pattern (different cluster).
- **Known Confounders.** Awareness amplification.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-011 — Positive Pull Test
- **Clinical Definition.** Extraction of ≥10% of grasped hairs upon gentle traction across multiple scalp zones.
- **Detection Method.** Observed (clinician).
- **Clinical Meaning.** Active release at the bulb–sheath interface.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Telogen morphology; diffuse thinning; acute shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Technique; recent washing.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-012 — Negative Pull Test (Reference Signal)
- **Clinical Definition.** Extraction of fewer than 10% of grasped hairs on gentle traction.
- **Detection Method.** Observed.
- **Clinical Meaning.** Reference for stable release state.
- **Strength of Evidence.** Reference.
- **Supporting Signals.** Stability signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Recent washing reducing detached hairs already shed.
- **Monitoring Value.** High.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Not applicable.

---

# PART VII — SCALP SIGNAL LIBRARY (Category H, I, J)

## SIG-SC-001 — Scaling (Generic)
- **Clinical Definition.** Visible flaking of the scalp stratum corneum.
- **Detection Method.** Observed.
- **Clinical Meaning.** Surface keratinization disturbance.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Pruritus; greasiness; erythema.
- **Suppressing Signals.** Smooth shiny scalp with loss of ostia (different scalp profile).
- **Known Confounders.** Recent product residue; cold-weather xerosis.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate when paired with patch loss in children.
- **Reversibility Relevance.** Surface signal; typically reversible.

## SIG-SC-002 — Greasiness (Seborrhea)
- **Clinical Definition.** Increased sebum on the scalp surface beyond patient baseline.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Sebaceous output elevation.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Scaling; pruritus; perifollicular erythema.
- **Suppressing Signals.** Marked xerosis.
- **Known Confounders.** Wash frequency; products.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-003 — Dryness (Xerosis)
- **Clinical Definition.** Reduced scalp surface lipidization with visible scaling or tightness.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Surface barrier dysfunction.
- **Strength of Evidence.** Weak.
- **Supporting Signals.** Scaling; brittle shafts.
- **Suppressing Signals.** Marked greasiness.
- **Known Confounders.** Climate; product use.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Reversible.

## SIG-SC-004 — Erythema (Generic Scalp)
- **Clinical Definition.** Diffuse or regional scalp redness.
- **Detection Method.** Observed.
- **Clinical Meaning.** Surface vascular response or inflammation.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Scaling; pruritus; tenderness.
- **Suppressing Signals.** None.
- **Known Confounders.** Sun exposure; mechanical irritation.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-005 — Perifollicular Erythema
- **Clinical Definition.** Redness localized circumferentially around follicular ostia.
- **Detection Method.** Observed (trichoscopy / close inspection).
- **Clinical Meaning.** Focal perifollicular inflammation.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Perifollicular scale; pruritus; burning; tenderness; loss of ostia in advanced zones.
- **Suppressing Signals.** Smooth normal perifollicular epithelium.
- **Known Confounders.** Recent waxing/shaving; acute folliculitis from extrinsic cause.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reversibility favored if no structural injury.

## SIG-SC-006 — Perifollicular Scale
- **Clinical Definition.** Keratotic scaling encircling follicular ostia.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Focal perifollicular keratinization disturbance.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Perifollicular erythema; loss of ostia; lonely-hair sign.
- **Suppressing Signals.** Diffuse generic scaling without perifollicular concentration.
- **Known Confounders.** Seborrheic overlap.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reduced reversibility when accompanied by structural-injury signals.

## SIG-SC-007 — Pustules
- **Clinical Definition.** Follicular or perifollicular pustular lesions on the scalp.
- **Detection Method.** Observed.
- **Clinical Meaning.** Neutrophilic surface inflammation.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Crusting; tufted hairs; tenderness; loss of ostia.
- **Suppressing Signals.** Smooth uninflamed scalp.
- **Known Confounders.** Acute folliculitis from extrinsic cause.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reduced reversibility when accompanied by structural-injury signals.

## SIG-SC-008 — Crusting
- **Clinical Definition.** Adherent serous, sanguineous, or purulent crusts on the scalp.
- **Detection Method.** Observed.
- **Clinical Meaning.** Surface exudation following pustular or inflammatory rupture.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Pustules; tenderness; sinus tracts.
- **Suppressing Signals.** None.
- **Known Confounders.** Excoriation.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reduced reversibility when accompanied by structural-injury signals.

## SIG-SC-009 — Loss of Follicular Ostia
- **Clinical Definition.** Absence of visible follicular openings in a scalp zone, often with smooth shiny surface.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Cardinal scalp signal of structural injury at the follicular niche.
- **Strength of Evidence.** Pathognomonic-class (for structural injury at the signal layer).
- **Supporting Signals.** Shiny scalp; perifollicular erythema/scale; lonely-hair sign; tenderness; crusting; pustules.
- **Suppressing Signals.** Visible yellow dots or black dots within the same zone (different scalp configuration at signal layer).
- **Known Confounders.** Lighting; very short cosmetic clipping obscuring ostia.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Very high; escalation mandatory when new or extending.
- **Reversibility Relevance.** Indicates reduced reversibility in affected zone.

## SIG-SC-010 — Shiny Scalp
- **Clinical Definition.** Smooth, glossy scalp surface in affected zones, often with reduced or absent follicular ostia.
- **Detection Method.** Observed.
- **Clinical Meaning.** Surface change correlated with structural injury when ostia loss is present.
- **Strength of Evidence.** Strong when paired with loss of ostia.
- **Supporting Signals.** Loss of ostia; perifollicular scale at the periphery of the smooth zone.
- **Suppressing Signals.** Normal ostia present.
- **Known Confounders.** Cosmetic emollient residue.
- **Monitoring Value.** High.
- **Escalation Relevance.** High when accompanied by ostia loss.
- **Reversibility Relevance.** Reduced reversibility when accompanied by ostia loss.

## SIG-SC-011 — Scalp Pain
- **Clinical Definition.** Spontaneous or evoked painful sensation localized to the scalp.
- **Detection Method.** Reported; Observed.
- **Clinical Meaning.** Active scalp inflammation, infection, or neuropathic sensitization.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Tenderness; burning; pustules; sinus tracts; tenderness on palpation.
- **Suppressing Signals.** None.
- **Known Confounders.** Tension headache referral.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-012 — Burning
- **Clinical Definition.** Sensation of burning localized to scalp without external thermal stimulus.
- **Detection Method.** Reported.
- **Clinical Meaning.** Active surface or perifollicular inflammation; neuropathic component possible.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Perifollicular erythema; perifollicular scale; pruritus.
- **Suppressing Signals.** None.
- **Known Confounders.** Product-induced irritation.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-013 — Pruritus
- **Clinical Definition.** Sensation of itch localized to the scalp.
- **Detection Method.** Reported.
- **Clinical Meaning.** Surface or perifollicular irritation/inflammation.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Scaling; greasiness; perifollicular erythema.
- **Suppressing Signals.** None.
- **Known Confounders.** Generalized pruritus; allergen exposure.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SC-014 — Tenderness
- **Clinical Definition.** Discomfort evoked by palpation of the scalp.
- **Detection Method.** Observed.
- **Clinical Meaning.** Subsurface inflammation, infection, or nodularity.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Pain; pustules; sinus tracts; tenderness over fluctuant nodules.
- **Suppressing Signals.** None.
- **Known Confounders.** Recent trauma.
- **Monitoring Value.** High.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-015 — Trichodynia
- **Clinical Definition.** Patient-reported scalp discomfort, tingling, or dysesthesia in association with hair loss.
- **Detection Method.** Reported.
- **Clinical Meaning.** Subjective scalp dysesthesia.
- **Strength of Evidence.** Weak to moderate.
- **Supporting Signals.** Pruritus; burning; perifollicular erythema.
- **Suppressing Signals.** None.
- **Known Confounders.** Anxiety-driven amplification.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-016 — Sinus Tracts
- **Clinical Definition.** Visible epithelialized tracts connecting subcutaneous cavities and/or scalp surface, often draining.
- **Detection Method.** Observed.
- **Clinical Meaning.** Severe deep neutrophilic inflammation.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Boggy nodules; crusting; pustules; tenderness.
- **Suppressing Signals.** None.
- **Known Confounders.** Post-surgical sinus.
- **Monitoring Value.** High.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced reversibility in tract zones.

## SIG-SC-017 — Boggy Nodules
- **Clinical Definition.** Fluctuant, deep, palpable subcutaneous nodular zones in the scalp.
- **Detection Method.** Observed; palpated.
- **Clinical Meaning.** Subcutaneous inflammatory mass.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Sinus tracts; tenderness; crusting.
- **Suppressing Signals.** None.
- **Known Confounders.** Cysts.
- **Monitoring Value.** High.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced.

## SIG-SC-018 — Tufted Hairs (Polytrichia)
- **Clinical Definition.** Multiple hair shafts emerging from a single ostium.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Follicular tufting characteristic of deep cicatricial neutrophilic processes.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Pustules; crusting; loss of surrounding ostia.
- **Suppressing Signals.** None.
- **Known Confounders.** Post-transplant tufting.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced.

## SIG-SC-019 — Yellow Dots
- **Clinical Definition.** Round yellow keratotic plugs visible within empty follicular ostia on trichoscopy.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Follicular ostia preserved with keratotic plugging.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Black dots; exclamation-mark hairs; patch loss.
- **Suppressing Signals.** Loss of follicular ostia in the same zone.
- **Known Confounders.** Sebaceous plugs.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SC-020 — Black Dots (Cadaverized Hairs)
- **Clinical Definition.** Pinpoint black structures representing hair shafts fractured at the scalp surface.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Acute fracture at the surface within preserved ostia.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Exclamation-mark hairs; yellow dots; broken hairs.
- **Suppressing Signals.** Loss of follicular ostia.
- **Known Confounders.** Recent close clipping.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored if niche intact.

## SIG-SC-021 — Exclamation-Mark Hairs
- **Clinical Definition.** Short hairs (typically 2–4 mm) tapered proximally with a darker, broader distal segment.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Active follicular insult with anagen interruption and proximal narrowing.
- **Strength of Evidence.** Strong (highly specific morphology).
- **Supporting Signals.** Patch pattern; yellow dots; black dots; ophiasis.
- **Suppressing Signals.** Loss of follicular ostia.
- **Known Confounders.** Mechanical breakage.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reversibility favored when ostia preserved.

## SIG-SC-022 — Broken Hairs of Varying Length
- **Clinical Definition.** Hairs of multiple non-uniform short lengths within a zone.
- **Detection Method.** Observed.
- **Clinical Meaning.** Mechanical or extrinsic shaft fracture.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Trichotillomania history; chemical/thermal injury history; black dots.
- **Suppressing Signals.** Exclamation-mark hairs predominant.
- **Known Confounders.** Cosmetic over-processing.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SC-023 — Eyebrow Thinning
- **Clinical Definition.** Reduction in eyebrow density, especially lateral thinning.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Non-scalp follicular involvement; relevant body-region signal.
- **Strength of Evidence.** Moderate as a co-signal.
- **Supporting Signals.** Frontal band loss; lonely-hair sign; thyroid systemic signals; alopecia areata patch signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic over-plucking.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-024 — Eyelash Loss
- **Clinical Definition.** Reduction in eyelash density beyond cosmetic baseline.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Non-scalp follicular involvement.
- **Strength of Evidence.** Moderate as co-signal.
- **Supporting Signals.** Eyebrow thinning; patchy alopecia; nail pitting.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic extension trauma.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SC-025 — Nail Pitting
- **Clinical Definition.** Small pinpoint depressions on the nail surface.
- **Detection Method.** Observed.
- **Clinical Meaning.** Non-scalp epithelial appendage finding relevant to certain follicular profiles.
- **Strength of Evidence.** Strong as a co-signal in patch-pattern contexts.
- **Supporting Signals.** Patch pattern; exclamation-mark hairs; ophiasis.
- **Suppressing Signals.** None.
- **Known Confounders.** Psoriasis nail involvement (extrinsic).
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

---

# PART VIII — CALIBER & MINIATURIZATION LIBRARY (Categories F, G)

## SIG-CM-001 — Caliber Variability (Anisotrichosis)
- **Clinical Definition.** Coexistence of vellus, intermediate, and terminal shafts within a single small scalp field, with shaft-diameter variability exceeding twenty percent.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Heterogeneous shaft-diameter population.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Vellus increase; terminal hair reduction; pattern-class signals.
- **Suppressing Signals.** Uniform terminal-hair field; pure ophiasis-pattern.
- **Known Confounders.** Cosmetic clipping.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low when isolated.
- **Reversibility Relevance.** Partial reversibility favored when miniaturization not advanced.

## SIG-CM-002 — Diffuse Caliber Reduction
- **Clinical Definition.** Uniform reduction in average shaft diameter across multiple scalp zones compared with baseline.
- **Detection Method.** Observed; Measured.
- **Clinical Meaning.** Generalized caliber reduction.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Diffuse thinning; reduced ponytail circumference; chronic shedding.
- **Suppressing Signals.** Zonally restricted caliber loss with preservation elsewhere.
- **Known Confounders.** Aging baseline.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Partially reversible.

## SIG-CM-003 — Terminal Hair Reduction
- **Clinical Definition.** Reduction in the proportion of terminal hairs within a defined scalp field.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Loss of terminal compartment.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Vellus increase; caliber variability.
- **Suppressing Signals.** Preserved terminal proportion.
- **Known Confounders.** Field selection bias.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Partially reversible.

## SIG-CM-004 — Vellus Increase
- **Clinical Definition.** Elevated proportion of vellus (fine, short, lightly pigmented) hairs within a defined scalp field.
- **Detection Method.** Observed (trichoscopy).
- **Clinical Meaning.** Shift in the vellus-to-terminal balance.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Caliber variability; terminal hair reduction; pattern-class signals.
- **Suppressing Signals.** Preserved terminal predominance.
- **Known Confounders.** Pediatric scalp baseline.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Partial.

## SIG-CM-005 — Miniaturization Progression
- **Clinical Definition.** Documented increase in vellus proportion or decrease in terminal proportion across reassessment intervals.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Trajectory signal indicating worsening miniaturization.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Increasing caliber variability; expanding pattern stage.
- **Suppressing Signals.** Stable or improving caliber.
- **Known Confounders.** Field re-selection inconsistency.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reduced as miniaturization advances.

## SIG-CM-006 — Miniaturization Stability
- **Clinical Definition.** Unchanged vellus/terminal proportion across reassessment intervals.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Trajectory signal indicating arrest of progression.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Stable density; absence of progression signals.
- **Suppressing Signals.** Progression signals.
- **Known Confounders.** Measurement insensitivity.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Trajectory-neutral.

## SIG-CM-007 — Caliber Recovery
- **Clinical Definition.** Documented increase in average shaft diameter across reassessment intervals.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Trajectory signal of caliber improvement.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Improvement signals; density increase.
- **Suppressing Signals.** Progression signals.
- **Known Confounders.** Hydration; sampling artifact.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Recovery trajectory.

---

# PART VIII.A — DENSITY AND VOLUME LIBRARY (Categories A, B)

## SIG-DV-001 — Density Reduction (Regional)
- **Clinical Definition.** Documented reduction in terminal hair count per unit area within a defined region.
- **Detection Method.** Observed; Measured.
- **Clinical Meaning.** Regional density loss.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Caliber heterogeneity; pattern-class signals; vellus increase.
- **Suppressing Signals.** Loss of follicular ostia (different signal cluster).
- **Known Confounders.** Lighting; styling.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low to moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-DV-002 — Density Reduction (Diffuse)
- **Clinical Definition.** Documented reduction in terminal hair count per unit area across multiple regions without pattern restriction.
- **Detection Method.** Observed; Measured.
- **Clinical Meaning.** Diffuse density loss.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Diffuse caliber reduction; diffuse thinning; chronic shedding.
- **Suppressing Signals.** Pattern-class signals.
- **Known Confounders.** Aging baseline.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-DV-003 — Central Part Widening
- **Clinical Definition.** Increased visible width of the midline part beyond patient baseline.
- **Detection Method.** Observed.
- **Clinical Meaning.** Midline density change.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Christmas-tree pattern; Ludwig/Sinclair staging; frontal hairline preservation.
- **Suppressing Signals.** Frontal band loss; lonely-hair sign.
- **Known Confounders.** Styling direction.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-DV-004 — Reduced Ponytail Circumference
- **Clinical Definition.** Measured or reported reduction in ponytail circumference compared with historical baseline.
- **Detection Method.** Reported; Measured.
- **Clinical Meaning.** Combined density and caliber proxy.
- **Strength of Evidence.** Moderate to strong.
- **Supporting Signals.** Diffuse thinning; caliber reduction; chronic shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Recent haircut; styling.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-DV-005 — Subjective Volume Reduction
- **Clinical Definition.** Patient-reported decrease in perceived overall volume or fullness.
- **Detection Method.** Reported.
- **Clinical Meaning.** Patient-perceived volumetric change.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Reduced ponytail circumference; density reduction.
- **Suppressing Signals.** None.
- **Known Confounders.** Body-image bias; styling change.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-DV-006 — Scalp Visibility Increase
- **Clinical Definition.** Increased scalp visibility through the hair when parted or styled, compared with baseline.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Effective density change.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Central part widening; diffuse thinning; pattern-class signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Lighting.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

---

# PART VIII.B — HAIR SHAFT LIBRARY (Category K)

## SIG-SH-100 — Brittle Shafts
- **Clinical Definition.** Reduced tensile resilience of shafts with easy breakage and split ends beyond patient baseline.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Shaft integrity reduction.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Trichorrhexis nodosa; nutritional systemic signals; cosmetic injury history.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic over-processing.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low to moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SH-101 — Trichorrhexis Nodosa
- **Clinical Definition.** Nodular swellings along the shaft representing localized cortical disruption, often with paint-brush fracture.
- **Detection Method.** Observed (microscopy/trichoscopy).
- **Clinical Meaning.** Localized cortical injury.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Brittle shafts; cosmetic injury history; nutritional signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic over-processing.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Reversible with shaft renewal.

## SIG-SH-102 — Pili Torti
- **Clinical Definition.** Shaft twisting at irregular intervals along its length.
- **Detection Method.** Observed (microscopy).
- **Clinical Meaning.** Shaft morphologic anomaly.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Brittle shafts; structural shaft anomalies.
- **Suppressing Signals.** None.
- **Known Confounders.** Acquired secondary changes.
- **Monitoring Value.** Low.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-103 — Monilethrix
- **Clinical Definition.** Beaded appearance of the shaft with periodic narrowings.
- **Detection Method.** Observed (microscopy).
- **Clinical Meaning.** Shaft morphologic anomaly.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Brittle shafts; structural shaft anomalies.
- **Suppressing Signals.** None.
- **Known Confounders.** Acquired secondary changes.
- **Monitoring Value.** Low.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SH-104 — Trichoptilosis (Split Ends)
- **Clinical Definition.** Longitudinal splitting of the distal shaft.
- **Detection Method.** Observed.
- **Clinical Meaning.** Distal shaft damage.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Brittle shafts; cosmetic injury history.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic over-processing.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Reversible.

## SIG-SH-105 — Shaft Diameter Reduction (Per-Shaft)
- **Clinical Definition.** Measured reduction in the diameter of a single shaft at a defined point along its length.
- **Detection Method.** Measured.
- **Clinical Meaning.** Per-shaft caliber finding.
- **Strength of Evidence.** Strong as a measured signal.
- **Supporting Signals.** Caliber variability; vellus increase.
- **Suppressing Signals.** None.
- **Known Confounders.** Hydration; measurement technique.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Partial.

---

# PART VIII.C — PATCH LOSS LIBRARY (Category L)

## SIG-PL-001 — Single Discrete Patch
- **Clinical Definition.** One circumscribed alopecic patch.
- **Detection Method.** Observed.
- **Clinical Meaning.** Patch topography (single).
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Exclamation-mark hairs; yellow dots; black dots; preserved ostia.
- **Suppressing Signals.** Loss of ostia within the patch; broken hairs of varying length (different cluster).
- **Known Confounders.** Trichotillomania; tinea capitis.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Reversibility favored when ostia preserved.

## SIG-PL-002 — Multifocal Patches
- **Clinical Definition.** Two or more circumscribed alopecic patches.
- **Detection Method.** Observed.
- **Clinical Meaning.** Patch topography (multiple).
- **Strength of Evidence.** Strong.
- **Supporting Signals.** As SIG-PL-001.
- **Suppressing Signals.** As SIG-PL-001.
- **Known Confounders.** As SIG-PL-001.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** As SIG-PL-001.

## SIG-PL-003 — Confluent Patch Loss
- **Clinical Definition.** Coalescence of multifocal patches into a larger continuous alopecic region.
- **Detection Method.** Observed; Monitored.
- **Clinical Meaning.** Patch progression to confluence.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Multifocal patches; ophiasis pattern; progression signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Pattern misclassification.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced when accompanied by structural-injury signals.

## SIG-PL-004 — Patch Border Activity
- **Clinical Definition.** Active signs (exclamation-mark hairs, positive pull test, broken hairs) at the border of an existing patch.
- **Detection Method.** Observed.
- **Clinical Meaning.** Active extension of patch.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Exclamation-mark hairs; positive pull test; black dots.
- **Suppressing Signals.** Inactive smooth border.
- **Known Confounders.** Cosmetic clipping artifact.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate.

## SIG-PL-005 — Alopecia Totalis Configuration
- **Clinical Definition.** Loss of all or near-all terminal scalp hair.
- **Detection Method.** Observed.
- **Clinical Meaning.** Maximal-extent scalp configuration.
- **Strength of Evidence.** Strong (as topographic descriptor).
- **Supporting Signals.** Eyebrow thinning; eyelash loss; nail pitting.
- **Suppressing Signals.** Preserved follicular ostia distinguish from end-stage scarring topographies of equivalent extent.
- **Known Confounders.** Universal cosmetic shaving.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced; not absent.

## SIG-PL-006 — Alopecia Universalis Configuration
- **Clinical Definition.** Loss of all or near-all terminal hair on the scalp and body.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Whole-body topographic descriptor.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Eyebrow loss; eyelash loss; nail pitting.
- **Suppressing Signals.** Preserved body terminal hair.
- **Known Confounders.** Cosmetic body-hair removal.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced.

---

# PART IX — SYSTEMIC SIGNAL LIBRARY (Category M, N, O, P, Q, R)

## SIG-SY-001 — Fatigue
- **Clinical Definition.** Sustained sense of energy deficit beyond patient baseline.
- **Detection Method.** Reported.
- **Clinical Meaning.** Non-specific systemic indicator.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Cold intolerance; weight change; menstrual irregularity; iron-deficiency context.
- **Suppressing Signals.** None.
- **Known Confounders.** Sleep deficit; mood disorder.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate when paired with systemic cluster.
- **Reversibility Relevance.** Reversible with cause control.

## SIG-SY-002 — Weight Change (Gain)
- **Clinical Definition.** Unintentional weight gain beyond patient baseline.
- **Detection Method.** Reported; Measured.
- **Clinical Meaning.** Endocrine/metabolic indicator.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Cold intolerance; fatigue; menstrual irregularity.
- **Suppressing Signals.** None.
- **Known Confounders.** Lifestyle factors.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate in cluster.
- **Reversibility Relevance.** Reversible with cause control.

## SIG-SY-003 — Weight Change (Loss)
- **Clinical Definition.** Unintentional or rapid weight loss exceeding declared thresholds.
- **Detection Method.** Reported; Measured.
- **Clinical Meaning.** Possible systemic trigger.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Acute shedding; post-event shedding; heat intolerance.
- **Suppressing Signals.** None.
- **Known Confounders.** Intentional restrictive dieting.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored on restoration.

## SIG-SY-004 — Cold Intolerance
- **Clinical Definition.** Subjective inability to tolerate ambient cold relative to peers or baseline.
- **Detection Method.** Reported.
- **Clinical Meaning.** Possible thyroid axis indicator.
- **Strength of Evidence.** Moderate within systemic cluster.
- **Supporting Signals.** Fatigue; weight gain; lateral eyebrow thinning; brittle shafts.
- **Suppressing Signals.** Heat intolerance.
- **Known Confounders.** Environmental.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversible.

## SIG-SY-005 — Heat Intolerance
- **Clinical Definition.** Subjective inability to tolerate heat relative to baseline.
- **Detection Method.** Reported.
- **Clinical Meaning.** Possible thyroid axis indicator (opposite direction).
- **Strength of Evidence.** Moderate within systemic cluster.
- **Supporting Signals.** Weight loss; palpitations; anxiety.
- **Suppressing Signals.** Cold intolerance.
- **Known Confounders.** Environmental.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversible.

## SIG-SY-006 — Menstrual Irregularity
- **Clinical Definition.** Cycles outside the 21–35 day window, missed cycles, or marked variability across cycles, by patient report or chart.
- **Detection Method.** Reported.
- **Clinical Meaning.** Endocrine indicator.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Hirsutism; acne; central adiposity; postpartum state.
- **Suppressing Signals.** None.
- **Known Confounders.** Hormonal contraception; perimenopause.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-007 — Postpartum State
- **Clinical Definition.** Time period within twelve months of delivery.
- **Detection Method.** Reported.
- **Clinical Meaning.** Hormonal-transition context.
- **Strength of Evidence.** Strong as a contextual signal.
- **Supporting Signals.** Acute shedding; telogen morphology; post-event shedding at 3–4 months.
- **Suppressing Signals.** None.
- **Known Confounders.** Concurrent nutritional and sleep stressors.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SY-008 — Pregnancy or Planned Pregnancy
- **Clinical Definition.** Confirmed pregnancy, suspected pregnancy, or active family planning toward pregnancy.
- **Detection Method.** Reported.
- **Clinical Meaning.** Safety-critical context.
- **Strength of Evidence.** Reference.
- **Supporting Signals.** None pathologic.
- **Suppressing Signals.** None.
- **Known Confounders.** None relevant.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** Mandatory escalation for safety-relevant evaluation.
- **Reversibility Relevance.** Not applicable.

## SIG-SY-009 — Lactation
- **Clinical Definition.** Active breastfeeding.
- **Detection Method.** Reported.
- **Clinical Meaning.** Safety-critical context.
- **Strength of Evidence.** Reference.
- **Supporting Signals.** Postpartum state.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** Mandatory escalation for safety-relevant evaluation.
- **Reversibility Relevance.** Not applicable.

## SIG-SY-010 — Perimenopausal Transition
- **Clinical Definition.** Documented perimenopausal status by symptom cluster or cycle change.
- **Detection Method.** Reported.
- **Clinical Meaning.** Hormonal-transition context.
- **Strength of Evidence.** Strong as contextual signal.
- **Supporting Signals.** Hot flashes; menstrual irregularity; sleep disruption; diffuse signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Other endocrine drivers.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-011 — Hirsutism
- **Clinical Definition.** Excess terminal-hair growth in androgen-dependent body regions in genetically female-presenting individuals.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Possible hyperandrogenism indicator.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Acne; menstrual irregularity; central adiposity.
- **Suppressing Signals.** None.
- **Known Confounders.** Ethnic baseline variation; cosmetic removal.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-012 — Acne (Persistent Adult)
- **Clinical Definition.** Persistent post-pubertal facial or truncal acne beyond expected duration.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Possible androgen-axis indicator.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Hirsutism; menstrual irregularity.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic and dietary contributors.
- **Monitoring Value.** Low.
- **Escalation Relevance.** Low to moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-013 — Galactorrhea
- **Clinical Definition.** Spontaneous milky nipple discharge outside lactation.
- **Detection Method.** Reported; Observed.
- **Clinical Meaning.** Possible hyperprolactinemia indicator.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Menstrual irregularity; diffuse signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Medication-induced.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** High.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-014 — Lateral Eyebrow Thinning (Systemic Co-Signal)
- **Clinical Definition.** Loss of the lateral third of the eyebrows.
- **Detection Method.** Observed.
- **Clinical Meaning.** Systemic co-signal in thyroid context.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Cold intolerance; fatigue; weight gain; brittle shafts.
- **Suppressing Signals.** None.
- **Known Confounders.** Cosmetic plucking.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-015 — Dietary Restriction
- **Clinical Definition.** Sustained restrictive dietary pattern (calorie, protein, or macro-/micronutrient class) reported by patient.
- **Detection Method.** Reported.
- **Clinical Meaning.** Nutritional-context signal.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Weight loss; brittle shafts; diffuse signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Reporting bias.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SY-016 — Rapid Weight Loss
- **Clinical Definition.** Loss exceeding defined kilogram-per-month threshold by patient report or measurement.
- **Detection Method.** Reported; Measured.
- **Clinical Meaning.** Acute systemic-stressor context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Acute shedding; post-event shedding; dietary restriction.
- **Suppressing Signals.** None.
- **Known Confounders.** Pharmacologic weight-loss therapy.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate to high.
- **Reversibility Relevance.** Reversibility favored on restoration.

## SIG-SY-017 — Sleep Disruption
- **Clinical Definition.** Sustained sleep deficiency, fragmentation, or insomnia.
- **Detection Method.** Reported.
- **Clinical Meaning.** Stress-axis-relevant context.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Stress burden; chronic shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Shift work; primary sleep disorder.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-018 — Stress Burden
- **Clinical Definition.** Patient-reported sustained psychological stress at high levels by validated self-assessment scale or structured query.
- **Detection Method.** Reported.
- **Clinical Meaning.** Stress-axis-relevant context.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Sleep disruption; post-event shedding; chronic shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Reporting bias.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Moderate; high if distress reaches clinical threshold.
- **Reversibility Relevance.** Reversibility favored on control.

## SIG-SY-019 — Recent Acute Illness
- **Clinical Definition.** Documented or reported acute illness with fever or systemic involvement within the trailing 2–4 months.
- **Detection Method.** Reported.
- **Clinical Meaning.** Trigger-window context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Post-event shedding; telogen morphology.
- **Suppressing Signals.** None.
- **Known Confounders.** Coincident triggers.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SY-020 — Recent Surgery or Anesthesia
- **Clinical Definition.** Surgical procedure under general anesthesia within trailing 2–4 months.
- **Detection Method.** Reported.
- **Clinical Meaning.** Trigger-window context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Post-event shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Coincident medication change.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SY-021 — Recent Severe Psychological Stressor
- **Clinical Definition.** Reported acute severe psychological stress event within trailing 2–4 months.
- **Detection Method.** Reported.
- **Clinical Meaning.** Trigger-window context.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Sleep disruption; stress burden; post-event shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Recall bias.
- **Monitoring Value.** High.
- **Escalation Relevance.** Variable; high if patient distress reaches clinical threshold.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SY-022 — Concurrent Autoimmune Condition
- **Clinical Definition.** Patient-reported or documented diagnosis of an autoimmune condition (thyroid autoimmunity, vitiligo, atopy, others).
- **Detection Method.** Reported.
- **Clinical Meaning.** Autoimmune context co-signal.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Patch loss; nail pitting; eyebrow/eyelash loss.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-SY-023 — Family History of Pattern Hair Loss
- **Clinical Definition.** Patient-reported family pattern of hair loss.
- **Detection Method.** Reported.
- **Clinical Meaning.** Genetic-susceptibility context.
- **Strength of Evidence.** Moderate.
- **Supporting Signals.** Pattern-class signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Recall bias.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Not applicable.

## SIG-SY-024 — Medication Initiation or Change
- **Clinical Definition.** Initiation, dose change, or cessation of a medication within trailing 2–6 months.
- **Detection Method.** Reported.
- **Clinical Meaning.** Trigger-window context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Post-event shedding.
- **Suppressing Signals.** None.
- **Known Confounders.** Coincident triggers.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Variable; high for high-stakes medications.
- **Reversibility Relevance.** Reversibility favored on cessation for many classes.

## SIG-SY-025 — Hormonal Contraceptive Change
- **Clinical Definition.** Initiation, switch, or cessation of hormonal contraception within trailing 6 months.
- **Detection Method.** Reported.
- **Clinical Meaning.** Hormonal-transition context.
- **Strength of Evidence.** Moderate to strong.
- **Supporting Signals.** Post-event shedding; menstrual irregularity.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** High.
- **Escalation Relevance.** Low to moderate.
- **Reversibility Relevance.** Reversibility favored.

## SIG-SY-026 — Mechanical / Cosmetic Tension History (Category Q)
- **Clinical Definition.** Reported history of sustained tension hairstyles, extensions, weaves, tight ponytails, or chronic helmet/hat compression.
- **Detection Method.** Reported.
- **Clinical Meaning.** Mechanical-injury context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Marginal recession; broken hairs; perifollicular pustules.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** High.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Reversibility favored if early.

## SIG-SY-027 — Chemical / Thermal Cosmetic Exposure (Category Q)
- **Clinical Definition.** Reported history of chemical relaxers, bleach, high-heat styling, or aggressive chemical processing.
- **Detection Method.** Reported.
- **Clinical Meaning.** Cosmetic-injury context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Brittle shafts; trichorrhexis nodosa; trichoptilosis.
- **Suppressing Signals.** None.
- **Known Confounders.** Reporting completeness.
- **Monitoring Value.** Moderate.
- **Escalation Relevance.** Low to moderate.
- **Reversibility Relevance.** Reversibility favored at shaft level.

## SIG-SY-028 — Pulling Behavior (Category R)
- **Clinical Definition.** Reported or observed habitual hair pulling.
- **Detection Method.** Reported; Observed.
- **Clinical Meaning.** Behavioral-injury context.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Bizarre or geometric patches; broken hairs of varying length; absent exclamation-mark hairs; preserved ostia.
- **Suppressing Signals.** Exclamation-mark hairs predominant.
- **Known Confounders.** Underreporting.
- **Monitoring Value.** High.
- **Escalation Relevance.** Variable; psychological support pathway when distress is significant.
- **Reversibility Relevance.** Reversibility favored if behavior resolves.

## SIG-SY-029 — Smoking Status
- **Clinical Definition.** Current or recent smoking by patient report.
- **Detection Method.** Reported.
- **Clinical Meaning.** Vascular-risk context.
- **Strength of Evidence.** Weak in isolation.
- **Supporting Signals.** Diffuse caliber reduction.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Partial.

## SIG-SY-030 — Patient-Reported Psychological Distress
- **Clinical Definition.** Patient-reported psychological distress related to hair loss reaching a defined threshold on a validated scale or structured query.
- **Detection Method.** Reported.
- **Clinical Meaning.** Functional-impact signal recorded without modifying biological assertions.
- **Strength of Evidence.** Functional.
- **Supporting Signals.** None biological.
- **Suppressing Signals.** None.
- **Known Confounders.** None relevant.
- **Monitoring Value.** High.
- **Escalation Relevance.** Mandatory escalation to appropriate support pathway when threshold is reached.
- **Reversibility Relevance.** Not biological.

---

# PART X — MONITORING, RECOVERY, PROGRESSION, ESCALATION (Categories S, T, U, V)

## SIG-MN-001 — Improvement Signal (Density)
- **Clinical Definition.** Documented increase in regional or diffuse terminal density across reassessment intervals.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Trajectory toward higher density.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Caliber recovery; reduced shedding; resolution of inflammatory signs.
- **Suppressing Signals.** Progression signals.
- **Known Confounders.** Photographic and field-selection variance.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Recovery trajectory.

## SIG-MN-002 — Improvement Signal (Caliber)
- **Clinical Definition.** As §SIG-CM-007.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Trajectory of shaft-diameter improvement.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Density improvement; shedding reduction.
- **Suppressing Signals.** Progression signals.
- **Known Confounders.** Sampling.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Recovery trajectory.

## SIG-MN-003 — Improvement Signal (Shedding Reduction)
- **Clinical Definition.** Documented reduction in shedding rate across reassessment intervals.
- **Detection Method.** Reported; Monitored.
- **Clinical Meaning.** Resolution of active release.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Negative pull test; absence of acute shedding.
- **Suppressing Signals.** Persistent positive pull test.
- **Known Confounders.** Wash regimen change.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Recovery trajectory.

## SIG-MN-004 — Improvement Signal (Symptom Resolution)
- **Clinical Definition.** Documented resolution of pruritus, burning, trichodynia, scaling, or erythema.
- **Detection Method.** Reported; Observed.
- **Clinical Meaning.** Resolution of surface or perifollicular irritation.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Density improvement; caliber improvement.
- **Suppressing Signals.** Persistence of symptoms.
- **Known Confounders.** None.
- **Monitoring Value.** High.
- **Escalation Relevance.** None.
- **Reversibility Relevance.** Recovery trajectory.

## SIG-MN-005 — Stability Signal
- **Clinical Definition.** Absence of improvement and absence of progression across the defined reassessment interval, with absence of active inflammatory or expanding signs.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Trajectory-neutral.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Negative pull test; absence of new patches; absence of perifollicular erythema.
- **Suppressing Signals.** Progression signals.
- **Known Confounders.** Insensitive measurement.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Low.
- **Reversibility Relevance.** Trajectory-neutral.

## SIG-MN-006 — Progression Signal (Generic)
- **Clinical Definition.** Documented worsening of any density, caliber, pattern, patch, or inflammatory signal across reassessment intervals.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Negative trajectory.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Density reduction; caliber reduction; new patches; expanding patches; new perifollicular erythema.
- **Suppressing Signals.** Improvement signals.
- **Known Confounders.** Measurement variance.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate to high.
- **Reversibility Relevance.** Reduced.

## SIG-MN-007 — Rapid Progression Signal
- **Clinical Definition.** Documented worsening exceeding declared change thresholds over a short window (weeks).
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Accelerated negative trajectory.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Confluent patch loss; new ostia loss; rapid expansion.
- **Suppressing Signals.** Improvement signals.
- **Known Confounders.** None.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Very high.
- **Reversibility Relevance.** Reduced.

## SIG-MN-008 — Regression Signal
- **Clinical Definition.** Documented return toward baseline after an episode of improvement.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Loss of response.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Recurrence of shedding; recurrence of patches; recurrence of perifollicular erythema.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-MN-009 — Loss-of-Response Signal
- **Clinical Definition.** Trajectory in which previously documented improvement plateaus and reverses despite continuity of contextual conditions.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Failure of sustained response.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Regression signal; recurrence signals.
- **Suppressing Signals.** None.
- **Known Confounders.** Adherence variability (recorded contextually, not interpreted here).
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate.
- **Reversibility Relevance.** Indeterminate.

## SIG-MN-010 — Recurrence Signal
- **Clinical Definition.** Re-emergence of a previously resolved signal (e.g., new patches after prior remission).
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Relapse evidence.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** New patches; new shedding; new perifollicular erythema.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** Moderate to high.
- **Reversibility Relevance.** Indeterminate.

## SIG-MN-011 — New Loss of Ostia (Escalation Signal)
- **Clinical Definition.** Emergence of loss of follicular ostia in a zone where ostia were previously preserved.
- **Detection Method.** Derived; Monitored.
- **Clinical Meaning.** Cardinal escalation signal at the monitoring layer.
- **Strength of Evidence.** Pathognomonic-class for structural-injury escalation.
- **Supporting Signals.** Perifollicular erythema/scale; rapid progression.
- **Suppressing Signals.** None.
- **Known Confounders.** Lighting; clipping artifact.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** **Mandatory escalation.**
- **Reversibility Relevance.** Reduced in affected zone.

## SIG-MN-012 — Pediatric Patchy Loss with Scaling (Escalation Signal)
- **Clinical Definition.** Patchy alopecia accompanied by scaling in a pediatric patient.
- **Detection Method.** Observed; Reported.
- **Clinical Meaning.** Escalation signal at the signal layer.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Scaling; broken hairs; black dots; cervical lymphadenopathy.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Very high.
- **Escalation Relevance.** **Mandatory escalation.**
- **Reversibility Relevance.** Indeterminate at signal layer.

## SIG-MN-013 — Systemic-Illness-Accompanied Loss (Escalation Signal)
- **Clinical Definition.** Hair loss accompanied by systemic illness signs (unexplained fever, weight loss, lymphadenopathy, severe fatigue out of proportion).
- **Detection Method.** Reported; Observed.
- **Clinical Meaning.** Escalation signal.
- **Strength of Evidence.** Strong.
- **Supporting Signals.** Cluster of systemic signals.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** High.
- **Escalation Relevance.** **Mandatory escalation.**
- **Reversibility Relevance.** Indeterminate.

## SIG-MN-014 — Pregnancy-Relevant Evaluation (Escalation Signal)
- **Clinical Definition.** Co-occurrence of any hair-loss signal cluster with pregnancy, suspected pregnancy, planned pregnancy, or lactation.
- **Detection Method.** Reported.
- **Clinical Meaning.** Safety-critical escalation signal.
- **Strength of Evidence.** Reference.
- **Supporting Signals.** SIG-SY-008; SIG-SY-009.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** **Mandatory escalation.**
- **Reversibility Relevance.** Not applicable.

## SIG-MN-015 — High-Stakes Medication Context (Escalation Signal)
- **Clinical Definition.** Reported use of medication classes with significant safety implications relevant to hair-loss evaluation.
- **Detection Method.** Reported.
- **Clinical Meaning.** Safety-relevant escalation signal.
- **Strength of Evidence.** Reference.
- **Supporting Signals.** Medication initiation/change context.
- **Suppressing Signals.** None.
- **Known Confounders.** None.
- **Monitoring Value.** Reference.
- **Escalation Relevance.** **Mandatory escalation.**
- **Reversibility Relevance.** Not applicable.

---

# PART XI — SIGNAL QUALITY FRAMEWORK

## §3. Quality Classes

Every admitted signal carries a quality class derived deterministically from its detection method, evidence sources, and any conflict context. Quality classes are signal-layer attributes; they do not encode pathway or cause weighting.

### §3.1 High-Confidence Signal
A signal that is directly observed by a qualified examiner or measured by a validated instrument under canonical conditions, with no contradictory signals present and known confounders excluded by available evidence.

### §3.2 Moderate-Confidence Signal
A signal that is observed, reported, or measured under acceptable conditions, with no active contradictory signals, but where one or more known confounders remain plausible and have not been excluded.

### §3.3 Weak Signal
A signal that is reported with limited corroboration, observed under suboptimal conditions, or subject to one or more confounders that have not been excluded.

### §3.4 Conflicting Signal
A signal that is present alongside another signal declared contradictory to it (see §4.2). Conflicting signals do not invalidate one another at the signal layer; both are recorded with their conflict explicitly declared.

### §3.5 Suppressed Signal
A signal whose evidentiary weight is canonically reduced by the documented presence of a declared suppressor under a deterministic predicate.

### §3.6 Indeterminate Signal
A signal whose presence cannot be confidently affirmed or denied due to inadequate observation conditions or insufficient reporting fidelity.

### §3.7 Missing Signal
A signal that has not been observed, reported, measured, or derived for the current evaluation context and is therefore not admissible.

## §4. Quality Determinism

Every quality class is computed deterministically from declared inputs:

- Detection method.
- Presence/absence of declared confounders.
- Presence/absence of declared suppressors.
- Presence/absence of declared contradictions.
- Observation-context completeness.

No quality class is assigned by interpretation. No quality class encodes a clinical conclusion.

---

# PART XII — SIGNAL INTERACTION FRAMEWORK

This Part defines how signals interact **at the signal layer only**. No clause of this Part creates pathway, cause, intervention, or recommendation logic.

## §4.1 Supporting Signals
A supporting relationship is a declared, asymmetric or symmetric assertion that the co-presence of one signal reinforces the evidentiary weight of another. Supporting relationships are not implications; they do not assert clinical conclusions.

## §4.2 Contradictory Signals
A contradictory relationship is a symmetric, declared assertion that two signals are biologically incompatible in the same evaluation context. Contradictions must be declared on both sides. The presence of contradictory signals does not produce a conclusion; it produces a recorded conflict for downstream evaluation.

## §4.3 Mutually Exclusive Signals
A subset of contradictory signals in which the two signals cannot biologically co-exist within a single anatomical zone. Their joint presence in the same zone is a release-blocking integrity failure under SIG-IC rules.

## §4.4 Signal Clusters
A signal cluster is a declared canonical grouping of signals that frequently co-occur and whose joint presence is monitored for trajectory purposes. Clusters do not assign causes; they organize observation.

## §4.5 Signal Amplification
A signal amplification relationship declares that one signal's evidentiary weight increases in the presence of one or more declared co-signals. Amplification is bounded by the underlying signal's category and is never used to assert a conclusion.

## §4.6 Signal Suppression
A signal suppression relationship declares that one signal's evidentiary weight decreases in the presence of one or more declared suppressors under a deterministic predicate. Suppression never inverts a signal; it modulates its weight.

## §4.7 Signal Conflict Handling
Conflicts are recorded explicitly. Resolution at the signal layer is limited to:

- Declaring the conflict.
- Computing the joint quality class deterministically.
- Marking the affected signals for downstream evaluation.

No signal-layer rule may resolve a conflict by inferring a cause, pathway, or recommendation.

---

# PART XIII — CLINICAL INTEGRITY CONSTRAINTS

The following constraints extend, and do not supersede, the Registry Integrity Constraints of Phase 5A (RIC-01…RIC-35) and Phase 5B (RS-01…RS-32). Each is implementation-independent and fail-closed.

## SIG-01 — Signal Class Membership Integrity
- **Purpose.** Ensure every signal belongs to exactly one primary category.
- **Rule.** Every signal entry must declare exactly one primary category from Part II; secondary categories must be declared explicitly.
- **Failure Behavior.** Entry rejected; release blocked.

## SIG-02 — Clinical Definition Integrity
- **Purpose.** Ensure every signal has an unambiguous observable referent.
- **Rule.** Every signal must declare a clinical definition whose referent is observable, reportable, derivable, measurable, or monitorable.
- **Failure Behavior.** Entry rejected.

## SIG-03 — Detection Method Integrity
- **Purpose.** Ensure every signal declares how it becomes admissible.
- **Rule.** Every signal must declare at least one detection method from {Observed, Reported, Derived, Measured, Monitored}.
- **Failure Behavior.** Entry rejected.

## SIG-04 — Evidence Strength Integrity
- **Purpose.** Ensure every signal carries an explicit strength descriptor.
- **Rule.** Every signal must declare a strength-of-evidence category drawn from the controlled vocabulary {Reference, Weak, Moderate, Strong, Pathognomonic-class}.
- **Failure Behavior.** Entry rejected.

## SIG-05 — Supporting Relationship Integrity
- **Purpose.** Prevent silent or one-sided support declarations.
- **Rule.** Every declared supporting relationship must reference signals that exist within this registry; symmetric supporting declarations must appear on both sides.
- **Failure Behavior.** Entry rejected.

## SIG-06 — Suppressing Relationship Integrity
- **Purpose.** Prevent inversion or paradox.
- **Rule.** A suppressing signal may modulate weight but may not invert a signal; suppression predicates must be deterministic.
- **Failure Behavior.** Entry rejected.

## SIG-07 — Contradiction Symmetry Integrity
- **Purpose.** Ensure contradictory pairs are declared on both sides.
- **Rule.** Every contradiction declaration must appear symmetrically on both involved signals.
- **Failure Behavior.** Release blocked.

## SIG-08 — Mutual Exclusion Integrity
- **Purpose.** Prevent biologically incompatible joint presence within a single zone.
- **Rule.** Two signals declared mutually exclusive within a single anatomical zone may not both be marked present for that zone in the same evaluation.
- **Failure Behavior.** Integrity incident; evaluation context invalidated.

## SIG-09 — Confounder Declaration Integrity
- **Purpose.** Ensure known confounders are explicit.
- **Rule.** Every signal must declare its known confounders, even if empty.
- **Failure Behavior.** Entry rejected.

## SIG-10 — Monitoring Value Integrity
- **Purpose.** Distinguish trajectory-admissible signals.
- **Rule.** Every signal must declare its monitoring value class.
- **Failure Behavior.** Entry rejected.

## SIG-11 — Escalation Relevance Integrity
- **Purpose.** Ensure escalation behavior is explicit.
- **Rule.** Every signal must declare its escalation relevance class.
- **Failure Behavior.** Entry rejected.

## SIG-12 — Reversibility Relevance Integrity
- **Purpose.** Ensure signal-layer reversibility implications are explicit.
- **Rule.** Every signal must declare its reversibility relevance, even if Indeterminate.
- **Failure Behavior.** Entry rejected.

## SIG-13 — Prohibition of Pathway Assignment
- **Purpose.** Preserve signal-layer purity.
- **Rule.** No signal entry may declare, imply, or carry a pathway assignment.
- **Failure Behavior.** Entry rejected; integrity incident logged.

## SIG-14 — Prohibition of Cause Assignment
- **Purpose.** Preserve signal-layer purity.
- **Rule.** No signal entry may declare, imply, or carry a root-cause assignment.
- **Failure Behavior.** Entry rejected; integrity incident logged.

## SIG-15 — Prohibition of Treatment Logic
- **Purpose.** Preserve signal-layer purity.
- **Rule.** No signal entry may declare, imply, or carry a treatment, intervention, or recommendation.
- **Failure Behavior.** Entry rejected; integrity incident logged.

## SIG-16 — Prohibition of Diagnosis
- **Purpose.** Preserve signal-layer purity.
- **Rule.** No signal entry may carry a diagnostic label.
- **Failure Behavior.** Entry rejected.

## SIG-17 — Prohibition of Marketing Language
- **Purpose.** Preserve scientific posture.
- **Rule.** No signal entry may contain persuasive, promotional, urgency, scarcity, or comparative-superiority language.
- **Failure Behavior.** Entry rejected; integrity incident logged.

## SIG-18 — Reference Resolvability Integrity
- **Purpose.** Eliminate dangling references.
- **Rule.** Every reference within a signal entry to another signal must resolve within this registry at the entry's release version.
- **Failure Behavior.** Entry rejected.

## SIG-19 — Determinism of Derivation
- **Purpose.** Ensure derived signals are reproducible.
- **Rule.** Every derived signal must declare a deterministic derivation rule referencing only signals admitted in the same release.
- **Failure Behavior.** Entry rejected.

## SIG-20 — Composite Signal Closure
- **Purpose.** Ensure composite signals are closed under their constituents.
- **Rule.** Every composite signal must enumerate its constituents canonically, and every constituent must declare reciprocal participation eligibility.
- **Failure Behavior.** Entry rejected.

## SIG-21 — Monitoring Signal Window Integrity
- **Purpose.** Ensure trajectory signals have explicit windows.
- **Rule.** Every monitoring signal must declare its evaluation window structurally; windows must be finite and deterministically defined.
- **Failure Behavior.** Entry rejected.

## SIG-22 — Escalation Signal Mandatory-Escalation Integrity
- **Purpose.** Ensure escalation signals trigger downstream action.
- **Rule.** A signal carrying mandatory escalation relevance must propagate that property deterministically to the monitoring layer without modification.
- **Failure Behavior.** Integrity incident.

## SIG-23 — Reversibility-Relevance Honesty Integrity
- **Purpose.** Prevent overstatement of reversibility.
- **Rule.** A signal coexisting with structural-injury signals in a zone must not declare reversibility favored at the signal-layer for that zone.
- **Failure Behavior.** Entry rejected.

## SIG-24 — Pediatric Escalation Integrity
- **Purpose.** Ensure pediatric escalation pathways are honored.
- **Rule.** Any signal observed in a pediatric context that involves patchy loss with scaling, pustules, sinus tracts, or systemic illness must declare mandatory escalation.
- **Failure Behavior.** Entry rejected.

## SIG-25 — Pregnancy/Lactation Escalation Integrity
- **Purpose.** Ensure safety-critical contexts are honored.
- **Rule.** Pregnancy, suspected pregnancy, planned pregnancy, and lactation co-occurring with any hair-loss signal cluster must propagate mandatory escalation deterministically.
- **Failure Behavior.** Integrity incident.

## SIG-26 — Distress Escalation Integrity
- **Purpose.** Honor psychological-support pathway.
- **Rule.** Patient-reported distress reaching the declared threshold must propagate mandatory escalation to the appropriate support pathway, without inferring clinical conclusions.
- **Failure Behavior.** Integrity incident.

## SIG-27 — Anatomic Zone Integrity
- **Purpose.** Ensure zone-restricted signals are evaluated by zone.
- **Rule.** Every signal whose meaning is zone-restricted must declare its admissible anatomical zones explicitly; cross-zone marking is forbidden.
- **Failure Behavior.** Entry rejected.

## SIG-28 — Pathognomonic Restraint Integrity
- **Purpose.** Confine pathognomonic-class assignment.
- **Rule.** Pathognomonic-class strength may be declared only for signals whose observable referent is universally accepted as diagnostic-strength evidence at the signal layer; declaration must reference upstream evidence.
- **Failure Behavior.** Entry rejected.

## SIG-29 — Confounder Honesty Integrity
- **Purpose.** Prevent silent confounder suppression.
- **Rule.** Known confounders must be enumerated even when they reduce the signal's apparent strength.
- **Failure Behavior.** Entry rejected.

## SIG-30 — Reporting Bias Acknowledgment Integrity
- **Purpose.** Honor evidentiary humility for reported signals.
- **Rule.** Every Reported signal must declare reporting bias among its known confounders if applicable.
- **Failure Behavior.** Entry rejected.

## SIG-31 — Numeric Determinism Integrity
- **Purpose.** Eliminate locale and floating-point drift.
- **Rule.** Any numeric threshold within a signal definition must be canonical, ordered, and byte-deterministic.
- **Failure Behavior.** Entry rejected.

## SIG-32 — Vocabulary Conformance Integrity
- **Purpose.** Bind controlled enumerations.
- **Rule.** Detection method, strength-of-evidence, monitoring value, escalation relevance, and reversibility relevance must each draw values from the controlled vocabulary of this registry at the release version.
- **Failure Behavior.** Entry rejected.

## SIG-33 — Lifecycle Conformance Integrity
- **Purpose.** Honor Phase 5A lifecycle rules.
- **Rule.** Every signal lifecycle transition must comply with Phase 5A §24–§25.
- **Failure Behavior.** Entry rejected.

## SIG-34 — Immutability of Published Signal Identity Integrity
- **Purpose.** Preserve referent constancy.
- **Rule.** A Published signal's id, primary category, clinical definition (referent meaning), and entry hash are immutable across all subsequent releases.
- **Failure Behavior.** Integrity incident; release blocked.

## SIG-35 — Hashing Determinism Integrity
- **Purpose.** Guarantee replay-grade fingerprinting.
- **Rule.** Every signal entry's content hash must be deterministic across independent implementations.
- **Failure Behavior.** Parity failure; release blocked.

## SIG-36 — Cross-Reference Integrity to Upstream Authority
- **Purpose.** Ensure scientific lineage.
- **Rule.** Every signal must trace evidentiary support to the Clinical Intelligence Master Knowledge Model and the registry's evidence references.
- **Failure Behavior.** Entry rejected.

## SIG-37 — Trajectory Signal Source Integrity
- **Purpose.** Ensure monitoring signals are constructed from admissible underlying signals.
- **Rule.** Every monitoring signal must declare its underlying signals from this registry; no monitoring signal may be constructed from non-signal inputs.
- **Failure Behavior.** Entry rejected.

## SIG-38 — Quality Class Determinism Integrity
- **Purpose.** Honor deterministic quality computation.
- **Rule.** Quality class assignment must be computed deterministically from declared detection method, confounders, suppressors, and contradictions; no interpretive class assignment is admissible.
- **Failure Behavior.** Integrity incident.

## SIG-39 — Conflict Recording Integrity
- **Purpose.** Preserve conflict provenance.
- **Rule.** Every detected signal conflict must be recorded explicitly with both signals named and the conflict class declared; silent resolution is forbidden.
- **Failure Behavior.** Integrity incident.

## SIG-40 — Suppression Bound Integrity
- **Purpose.** Prevent over-suppression.
- **Rule.** Suppression may reduce weight but may not reduce a present signal below the minimum admissibility floor declared for its category.
- **Failure Behavior.** Entry rejected.

## SIG-41 — Composite Signal Independent-Evaluability Integrity
- **Purpose.** Honor multifactorial discipline.
- **Rule.** Every composite signal's constituents must remain independently evaluable; composite assertion requires explicit constituent evidence.
- **Failure Behavior.** Entry rejected.

## SIG-42 — Anatomical Zone Mutual-Exclusion Integrity
- **Purpose.** Prevent contradictory joint zone marking.
- **Rule.** Signals declared mutually exclusive in a zone may not be jointly marked present for that zone in any evaluation.
- **Failure Behavior.** Integrity incident.

## SIG-43 — Trajectory Window Determinism Integrity
- **Purpose.** Honor replay-grade trajectory.
- **Rule.** Every trajectory signal's evaluation window boundaries must be deterministic across independent implementations.
- **Failure Behavior.** Integrity incident.

## SIG-44 — Reporting Source Integrity
- **Purpose.** Honor source provenance.
- **Rule.** Every Reported signal must record its reporting source (patient, proxy, structured questionnaire identifier, interview structure) deterministically.
- **Failure Behavior.** Entry rejected.

## SIG-45 — Observation Context Integrity
- **Purpose.** Honor observation conditions.
- **Rule.** Every Observed signal must declare its admissible observation contexts (e.g., lighting, magnification class, anatomical preparation) within the registry's controlled vocabulary.
- **Failure Behavior.** Entry rejected.

## SIG-46 — Measurement Method Integrity
- **Purpose.** Honor measurement determinism.
- **Rule.** Every Measured signal must reference a Measurement Specification (Monitoring Registry) by canonical id; ad-hoc measurement is forbidden.
- **Failure Behavior.** Entry rejected.

## SIG-47 — Derived Signal Provenance Integrity
- **Purpose.** Honor derivation traceability.
- **Rule.** Every Derived signal must record its derivation rule and the canonical ids of its inputs in canonical order.
- **Failure Behavior.** Entry rejected.

## SIG-48 — Cross-Registry Read-Only Integrity
- **Purpose.** Honor Phase 5A tier ordering.
- **Rule.** Signal entries are read-only relative to downstream registries; no signal may import authority from a downstream registry.
- **Failure Behavior.** Integrity incident.

## SIG-49 — Escalation Propagation Integrity
- **Purpose.** Honor mandatory escalation.
- **Rule.** Any mandatory escalation relevance in a signal must be propagated to the Monitoring and Escalation registries without weakening transformation.
- **Failure Behavior.** Integrity incident.

## SIG-50 — Constitutional Hierarchy Integrity
- **Purpose.** Honor upstream authority.
- **Rule.** Where any clause of this registry conflicts with the HairOS Constitution, the Canonical Ledger, Phase 5A, Phase 5B, or the Clinical Intelligence Master Knowledge Model, those documents prevail; the conflicting registry content is non-authoritative.
- **Failure Behavior.** Conflicting content non-authoritative; integrity incident logged.

All SIG-01 through SIG-50 failures are fail-closed.

---

# PART XIV — ACCEPTANCE CRITERIA

## §5. Validity Conditions

This registry is valid only if:

- **Every signal is clinically observable, reportable, derivable, measurable, or monitorable** under canonical conditions defined within this registry.
- **Every signal is scientifically defensible** under the evidence hierarchy of the Clinical Intelligence Master Knowledge Model.
- **No signal contains diagnosis.**
- **No signal contains treatment, intervention, or recommendation logic.**
- **No signal contains pathway assignment.**
- **No signal contains root-cause assignment.**
- **No signal contains marketing or persuasive language.**
- **Every signal honors Phase 5A and Phase 5B constraints**, including determinism, immutability, ownership exclusivity, replay fidelity, and audit reconstructibility.
- **Every signal is implementation-independent**, free of storage design, API surface, transport format, or runtime construct.
- **The registry is comprehensive** to the extent that any future HairOS questionnaire answer, image-analysis finding, clinical observation, or monitoring event admissible to the system can be canonically mapped to one or more signals defined herein, or, when no admissible mapping exists, triggers a registry-evolution proposal under Phase 5A.

## §6. Constitutional Closure

This registry is the canonical Signal Registry of HairOS. It is a scientific knowledge asset. It is not software, not implementation, not diagnosis, not treatment logic, not recommendation logic, and not pathway logic. It defines signals only.

No clause of this registry permits the assertion of clinical conclusions at the signal layer, the implication of cause or pathway, the inference of treatment, the inclusion of marketing constructs, the overstatement of reversibility in zones of structural injury, the suppression of declared confounders, the silent resolution of conflicts, or the bypass of mandatory escalation.

Where any clause of this registry conflicts with the HairOS Constitution, the Canonical Ledger & Contract Specification, the Registry Governance Constitution (Phase 5A), the Registry Specification Constitution (Phase 5B), or the Clinical Intelligence Master Knowledge Model, those documents prevail. Where ambiguity arises within this registry, the more biologically conservative and more evidentiarily honest interpretation prevails. Where any rule appears to permit unconstrained extension, the interpretation that preserves auditability, replay fidelity, and signal-layer purity prevails.

This registry governs the scientific shape of HairOS signal knowledge for all time. Evolution of the registry is permitted; drift of signal meaning is not.

— End of HAIROS_SIGNAL_REGISTRY_V1 —
