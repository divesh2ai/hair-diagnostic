import type { ClinicalTemplate } from '../types';
import { v, c, cv } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const THYROID_DOCTOR_OPENING = [
  v(9,
    'Thyroid-associated diffuse alopecia identified; dysthyroid state is the primary driver of follicular metabolic disruption and elevated telogen shedding.',
    'Thyroid hormone dysregulation confirmed as the primary aetiological factor in diffuse non-scarring alopecia presentation.',
    'Thyroid-mediated alopecia: follicular cycling disruption secondary to systemic metabolic rate dysregulation from thyroid hormone insufficiency or excess.'
  ),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const THYROID_DOCTOR_MECHANISM = [
  v(9,
    'Hypothyroid state reduces cellular basal metabolic rate including follicular keratinocyte proliferation, shortening anagen phase and increasing synchronised telogen fraction.',
    'Insufficient T3/T4 impairs follicular metabolic competence; reduced keratinocyte mitotic activity shortens anagen duration and increases the telogen-to-anagen ratio.',
    'Thyroid hormone deficit reduces IGF-1 receptor sensitivity at the follicular papilla, impairing the IGF-1-mediated anagen maintenance signal.'
  ),
  c('hasActiveShedding', 'Active shedding pattern consistent with hypothyroid TE: diffuse shed elevation driven by synchronised telogen shift from sustained T4 deficit.', 8),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const THYROID_DOCTOR_SEVERITY_MILD = [
  v(8,
    'Mild thyroid-driven alopecia with moderate diffuse thinning; metabolic disruption is relatively contained — thyroid co-factor support will restore follicular cycling within expected timeline.',
    'Early thyroid-associated hair loss; thyroid hormone support co-factors can restore follicular anagen competence progressively over 2–4 months.'
  ),
];

export const THYROID_DOCTOR_SEVERITY_MODERATE = [
  v(8,
    'Moderate thyroid-driven diffuse alopecia with sustained shed elevation; thyroid metabolic correction is the gating intervention before downstream hair-specific treatment becomes effective.',
    'Intermediate thyroid-driven hair loss; metabolic rate has been suppressed sufficiently to produce noticeable density reduction — correction timeframe is 3–6 months.'
  ),
];

export const THYROID_DOCTOR_SEVERITY_SEVERE = [
  v(8,
    'Severe diffuse alopecia secondary to thyroid dysregulation; sustained metabolic disruption has produced significant follicular cycling impairment — thyroid correction is the sole clinical priority at Phase 1.',
    'Advanced thyroid-driven hair loss: prolonged thyroid dysfunction has accumulated across multiple hair cycles; full recovery requires thyroid stabilisation before hair-specific protocol can be meaningful.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const THYROID_DOCTOR_TREATMENT = [
  v(9,
    'Thyroid metabolic correction is the non-negotiable Phase 1 clinical priority; downstream anti-inflammatory and shedding-arrest interventions only become effective once follicular metabolic rate is restored.',
    'Protocol sequencing rule: thyroid always scores highest (100) and governs Phase 1. Downstream shedding-arrest and immune support phases are conditional on thyroid normalisation progress.',
    'Treatment gate: all hair-specific intervention is pharmacologically ineffective until cellular metabolic competence is restored via thyroid co-factor support at Phase 1.'
  ),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const THYROID_DOCTOR_PROGNOSIS = [
  cv('severityMild', 8,
    'Prognosis is favourable when thyroid function is corrected and co-factors are replete; anagen re-entry typically commences within 8–12 weeks of metabolic rate restoration.',
    'Early thyroid hair loss responds strongly to metabolic correction; patients should expect progressive shed reduction within 2–3 months of protocol initiation.'
  ),
  cv('severityModerate', 8,
    'Moderate thyroid-driven hair loss recovers well once thyroid function is restored; full shed normalisation typically achieves by month 4–6.',
    'Clinical response correlates directly with thyroid normalisation speed; staged improvement over 3–6 months is the expected timeline.'
  ),
  cv('severitySevere', 8,
    'Severe thyroid-mediated hair loss requires sustained metabolic correction; recovery timeline is 6–12 months, with shed normalisation preceding density improvement by 3–4 months.',
    'Advanced thyroid alopecia can recover substantially once thyroid function is adequately corrected; patients require counselling on the extended timeline of 6–12 months for full hair cycle restoration.'
  ),
];

// ─── Closing ─────────────────────────────────────────────────────────────────

export const THYROID_DOCTOR_CLOSING = [
  v(6,
    'TSH, fT3, fT4, and selenium status review at 8 weeks recommended; selenium deficiency directly impairs T4-to-T3 deiodinase conversion and is a modifiable rate-limiting factor.',
    'Thyroid panel reassessment at 3 months to confirm metabolic normalisation; co-factor repletion (selenium, iodine, zinc) is often the key to unlocking adequate T3 production.'
  ),
];

// ─── Bundled template ─────────────────────────────────────────────────────────

export const THYROID_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'thyroid',
  audience: 'doctor',
  sections: {
    opening:   THYROID_DOCTOR_OPENING,
    mechanism: THYROID_DOCTOR_MECHANISM,
    severity: {
      mild:     THYROID_DOCTOR_SEVERITY_MILD,
      moderate: THYROID_DOCTOR_SEVERITY_MODERATE,
      severe:   THYROID_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: THYROID_DOCTOR_TREATMENT,
    prognosis: THYROID_DOCTOR_PROGNOSIS,
    closing:   THYROID_DOCTOR_CLOSING,
  },
};
