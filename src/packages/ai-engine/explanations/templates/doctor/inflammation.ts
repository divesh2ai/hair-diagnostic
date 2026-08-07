import type { ClinicalTemplate } from '../types';
import { v, c, cv, vReq } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_OPENING = [
  // Direct "scalp inflammation identified" claims require the patient to
  // have actually reported scalp findings. The inflammation template fires
  // whenever the engine routes a diagnosis into the inflammation category,
  // but that routing can be triggered by indirect signals — without a
  // reported scalp finding we should not assert visible inflammation.
  vReq(['scalp.anyNonNormal'], 9,
    'Scalp inflammatory pathology identified as a primary driver of follicular microenvironment disruption and secondary alopecia.',
    'Scalp inflammation identified as the primary or contributing driver; anti-inflammatory clearance is the mandatory Phase 1 intervention before any follicle-directed therapy can be effective.',
  ),
  // Microscopic / mechanism-level statement — does not claim visible
  // inflammation, so safe without scalp evidence.
  v(8,
    'Perifollicular inflammatory load suspected; NF-kB-mediated inflammatory signalling can create a hostile follicular microenvironment incompatible with normal anagen cycling.',
  ),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_MECHANISM = [
  v(9,
    'Malassezia-driven or endogenous NF-kB/TNF-α/IL-6 activation in the perifollicular space directly inhibits anagen initiation and shortens the growth phase duration.',
    'Perifollicular IL-1α, TNF-α, and NF-kB signalling elevation creates a cytokine microenvironment that suppresses follicular anagen competence at the papilla level.',
    'Scalp seborrhoea and dysbiosis generate a chronic low-grade inflammatory state; cumulative perifollicular cytokine burden progressively shortens anagen phase duration.'
  ),
  c('hasActiveShedding', 'Active telogen shedding pattern overlays the primary inflammatory pathology; both pathways require concurrent management.', 7),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_SEVERITY_MILD = [
  v(8,
    'Mild scalp inflammatory load with limited follicular impact; targeted anti-inflammatory clearance should restore microenvironment within 4–6 weeks.',
    'Low-grade scalp inflammation; responsive to anti-inflammatory protocol with expected microenvironment restoration over a single hair cycle.'
  ),
];

export const INFLAMMATION_DOCTOR_SEVERITY_MODERATE = [
  v(8,
    'Moderate scalp inflammatory load with measurable impact on follicular cycling; inflammatory clearance is Phase 1 priority before any growth-stimulating intervention.',
    'Established perifollicular inflammatory pathology; sustained NF-kB activation requires a full anti-inflammatory protocol before downstream hair-specific treatment becomes bioavailable.'
  ),
];

export const INFLAMMATION_DOCTOR_SEVERITY_SEVERE = [
  v(8,
    'Severe scalp inflammatory pathology with significant follicular microenvironment compromise; extended anti-inflammatory correction period required before Phase 2 interventions can operate effectively.',
    'Advanced inflammatory scalp disease with high inflammatory cytokine burden; mono-therapy will be insufficient — multi-pathway anti-inflammatory intervention and systemic support are required.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_TREATMENT = [
  v(9,
    'Inflammation clearance is always Phase 1 for scalp inflammatory presentations; applying DHT correction or follicle stimulation into an inflamed microenvironment produces suboptimal absorption and response.',
    'Protocol mandate: perifollicular inflammatory terrain must be cleared (PHENOTYPE INFLAMATION) before any androgenetic correction or follicular stimulation compound is introduced.',
    'Anti-inflammatory Phase 1 ensures downstream pharmacological agents reach target follicles at effective concentration; bypassing this step is the single most common cause of inadequate treatment response.'
  ),
  c('hasGLP1Early', 'GLP-1 active: concurrent nutritional depletion amplifies the inflammatory burden — metabolic support must be co-administered alongside anti-inflammatory clearance.', 7),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_PROGNOSIS = [
  cv('severityMild', 8,
    'Mild inflammation: microenvironment clearance expected within 4–6 weeks; downstream hair-specific treatment can be initiated at this point.',
    'Responsive prognosis for mild inflammatory load; patients should note scalp comfort improvement within 3–4 weeks as an early treatment signal.'
  ),
  cv('severityModerate', 8,
    'Moderate inflammatory pathology requires 6–10 weeks of consistent anti-inflammatory intervention before the follicular microenvironment is adequately restored.',
    'Clinical clearance of moderate scalp inflammation typically takes 6–8 weeks; premature escalation to growth-phase treatments risks inadequate response.'
  ),
  cv('severitySevere', 8,
    'Severe inflammatory pathology may require 10–16 weeks of anti-inflammatory management before Phase 2 interventions are viable; progress monitoring at 4-week intervals is recommended.',
    'Extended anti-inflammatory protocol required for severe scalp disease; patient counselling should include realistic expectation-setting about the 3–4 month preparatory phase.'
  ),
];

// ─── Closing ─────────────────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_CLOSING = [
  v(6,
    'Scalp microbiome and seborrhoea reassessment at 6 weeks; maintenance anti-inflammatory support is recommended even after resolution to prevent recurrence.',
    'Sebum control and barrier function improvement are early indicators of Phase 1 efficacy; reassess at 4–6 weeks before transitioning to Phase 2 interventions.'
  ),
];

// ─── Bundled template ─────────────────────────────────────────────────────────

export const INFLAMMATION_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'inflammation',
  audience: 'doctor',
  sections: {
    opening:   INFLAMMATION_DOCTOR_OPENING,
    mechanism: INFLAMMATION_DOCTOR_MECHANISM,
    severity: {
      mild:     INFLAMMATION_DOCTOR_SEVERITY_MILD,
      moderate: INFLAMMATION_DOCTOR_SEVERITY_MODERATE,
      severe:   INFLAMMATION_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: INFLAMMATION_DOCTOR_TREATMENT,
    prognosis: INFLAMMATION_DOCTOR_PROGNOSIS,
    closing:   INFLAMMATION_DOCTOR_CLOSING,
  },
};
