import type { ClinicalTemplate } from '../types';
import { v, c, cv } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const PCOS_DOCTOR_OPENING = [
  v(9,
    'PCOS-associated androgenetic alopecia: hyperandrogenism drives frontotemporal follicular miniaturisation and seborrhoea via elevated DHEAS and free testosterone.',
    'PCOS-related hair loss confirmed; LH/FSH dysregulation and insulin resistance create a hyperandrogenic environment promoting progressive follicular miniaturisation.',
    'Androgen-excess alopecia secondary to PCOS identified; 5α-reductase activity and elevated free androgen index are the primary follicular drivers.'
  ),
  c('isFemale', 'Female pattern androgenetic alopecia is the hair phenotype; PCOS is the endocrine driver — both pathways require concurrent treatment.', 8),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const PCOS_DOCTOR_MECHANISM = [
  v(9,
    'Hyperinsulinaemia upregulates ovarian androgen synthesis and suppresses SHBG, amplifying free androgen bioavailability at follicular androgen receptors.',
    'Elevated LH:FSH ratio drives theca cell androgen overproduction; reduced SHBG from insulin resistance further increases DHT and testosterone bioactivity at hair follicles.',
    'PCOS-driven insulin resistance creates a bidirectional androgenic amplification loop: hyperinsulinaemia → excess ovarian androgens → reduced SHBG → elevated free DHT → follicular miniaturisation.'
  ),
  c('hasSecondaryDx', 'Concurrent secondary condition compounds the androgenic burden; integrated metabolic and hormonal correction is essential for adequate response.', 7),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const PCOS_DOCTOR_SEVERITY_MILD = [
  v(8,
    'Mild androgenic alopecia with early frontotemporal involvement; follicular reserve is intact — hormonal correction at this stage produces strongest response.',
    'Early-stage PCOS hair loss with light thinning pattern; identifying and addressing insulin resistance alongside androgen excess is critical for long-term control.'
  ),
];

export const PCOS_DOCTOR_SEVERITY_MODERATE = [
  v(8,
    'Moderate androgenic alopecia with established frontotemporal and crown involvement; sustained hyperandrogenism has created measurable follicular miniaturisation.',
    'Intermediate PCOS hair loss stage: follicular miniaturisation is partially established; structured androgenic correction with metabolic support can arrest progression and partially reverse.'
  ),
];

export const PCOS_DOCTOR_SEVERITY_SEVERE = [
  v(8,
    'Significant androgenic alopecia with advanced frontotemporal and crown involvement; insulin resistance and androgen excess have been sustained long enough to reduce follicular reserve meaningfully.',
    'Advanced PCOS-driven hair loss: prolonged hyperandrogenism has driven extensive miniaturisation; stabilisation is the primary realistic endpoint with possible partial reversal in viable zones.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const PCOS_DOCTOR_TREATMENT = [
  v(9,
    'Protocol prioritises androgen excess correction (inositol/D-chiro-inositol, spearmint 5α-reductase inhibition) before inflammatory clearance; insulin sensitisation underpins the hormonal normalisation.',
    'Treatment targets the PCOS androgenic cascade at three levels: insulin sensitisation → androgen synthesis reduction → 5α-reductase inhibition at follicular level.',
    'Hormonal correction must precede anti-inflammatory management; clearing inflammatory terrain before correcting the androgenic driver produces suboptimal response.'
  ),
  c('hasActiveShedding', 'Active shedding component present — concurrent TE GOLD phase is included to arrest telogen shedding overlaying the androgenetic pattern.', 8),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const PCOS_DOCTOR_PROGNOSIS = [
  cv('severityMild', 8,
    'Favourable prognosis when insulin resistance is addressed concurrently with androgen excess; hormonal normalisation within 3–4 months typically produces measurable shed reduction.',
    'Early PCOS hair loss responds well to targeted hormonal intervention; patients should expect progressive improvement over 4–6 months with consistent protocol adherence.'
  ),
  cv('severityModerate', 8,
    'Moderate PCOS hair loss prognosis is conditional on adequate insulin sensitisation; partial reversal possible at 6–9 months if hormonal parameters normalise.',
    'Clinical response depends on degree of insulin resistance correction; incomplete metabolic treatment produces incomplete hair response.'
  ),
  cv('severitySevere', 8,
    'Advanced PCOS hair loss: primary endpoint is progression arrest and hormonal stabilisation; partial reversal possible in viable follicular zones over 9–18 months.',
    'Severe androgenic alopecia in PCOS context requires sustained protocol; realistic goal is hormonal control and density stabilisation rather than full reversal.'
  ),
];

// ─── Closing ─────────────────────────────────────────────────────────────────

export const PCOS_DOCTOR_CLOSING = [
  v(6,
    'Endocrine co-management recommended where testosterone, DHEAS, SHBG, and fasting insulin are not already being monitored; hair response correlates closely with hormonal normalisation.',
    'Hormonal monitoring at 3-month intervals allows protocol adjustment; SHBG elevation and free androgen index reduction are the most sensitive indicators of treatment efficacy.'
  ),
];

// ─── Bundled template ─────────────────────────────────────────────────────────

export const PCOS_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'pcos',
  audience: 'doctor',
  sections: {
    opening:   PCOS_DOCTOR_OPENING,
    mechanism: PCOS_DOCTOR_MECHANISM,
    severity: {
      mild:     PCOS_DOCTOR_SEVERITY_MILD,
      moderate: PCOS_DOCTOR_SEVERITY_MODERATE,
      severe:   PCOS_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: PCOS_DOCTOR_TREATMENT,
    prognosis: PCOS_DOCTOR_PROGNOSIS,
    closing:   PCOS_DOCTOR_CLOSING,
  },
};
