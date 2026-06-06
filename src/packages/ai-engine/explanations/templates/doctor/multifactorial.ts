import type { ClinicalTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_OPENING = [
  v(9,
    'Profile is consistent with multifactorial hair loss: cause-ranker composite-rule fired with three or more contributing pathways above activation threshold and a top-two single-cause posterior gap below the dissent margin.',
    'Composite multifactorial profile — pathway graph shows simultaneous activation of androgenetic, inflammatory, hormonal, and/or metabolic axes with no single dominant single-cause posterior.'
  ),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_MECHANISM = [
  v(9,
    'Coexisting pathways amplify each other: inflammation potentiates DHT-mediated miniaturization; insulin resistance ↓ SHBG raising free androgens; cortisol drives premature catagen; nutritional deficits constrain matrix proliferation. The composite phenotype reflects pathway interaction more than single-cause dominance.',
    'Pathway interaction model: scalp-inflammation amplifies follicular-miniaturization; metabolic-dysfunction ↓ SHBG amplifies androgen exposure; HPA activation drives telogen-cycle-disruption. Composite phenotype emerges from multiplicative interaction.'
  ),
  v(8,
    'Single-pathway interventions in multifactorial profiles consistently under-perform versus sequenced multi-pathway protocols — the unaddressed pathways continue to drive the phenotype.',
    'Monotherapy under-delivers in composite profiles: unaddressed pathways continue driving the phenotype.'
  ),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_SEVERITY_MILD = [
  v(9,
    'Mild composite severity. Reversibility ceiling remains favourable provided all contributors are addressed before structural progression.',
    'Mild multifactorial. Favourable ceiling if all pathways are addressed early.'
  ),
];

export const MULTIFACTORIAL_DOCTOR_SEVERITY_MODERATE = [
  v(9,
    'Moderate composite severity. Phase sequencing per Protocol Sequencer reduces cross-pathway interference and maximises early-phase signal recovery before downstream interventions are layered.',
    'Moderate. Sequenced protocol reduces cross-pathway interference and prevents the "fight on multiple fronts" failure mode.'
  ),
];

export const MULTIFACTORIAL_DOCTOR_SEVERITY_SEVERE = [
  v(9,
    'Severe composite severity. Recovery ceiling is constrained by the most fixed pathway (typically androgenetic) — communicate realistic expectations and prioritise stabilisation over regrowth.',
    'Severe. Ceiling constrained by most fixed pathway. Stabilisation > regrowth in messaging.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_TREATMENT = [
  v(9,
    'Protocol follows the sequencer rationale: arrest active shedding (Phase 1), clear perifollicular inflammation (Phase 2), modulate androgen axis (Phase 3), correct metabolic terrain (Phase 4), and provide immune/nutritional rebuild (Phase 5). Each phase targets a distinct contributing pathway.',
    'Phase sequence — shedding arrest → inflammation clearance → androgen modulation → metabolic correction → immune/nutritional rebuild — each phase aligned to a specific contributing pathway.'
  ),
  v(8,
    'Therapy needs are aggregated across all leading single-cause posteriors. Monitor each contributing biomarker independently — partial responders may show full effect in some pathways and incomplete effect in others.',
    'Therapy needs aggregated across contributing pathways. Biomarker monitoring is pathway-specific; partial responder phenotypes are common.'
  ),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_PROGNOSIS = [
  v(9,
    'Timeline staggered by pathway: TE-component shedding resolves 6–12 weeks; inflammatory component 4–8 weeks; AGA/hormonal component 12–24 weeks. Composite endpoint typically 16–24 weeks for measurable density change.',
    'Pathway-staggered timeline: TE 6–12 wk → inflammation 4–8 wk → AGA/hormonal 12–24 wk. Composite endpoint 16–24 wk.'
  ),
];

// ─── Closing ──────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_CLOSING = [
  v(8,
    'Document baseline for each contributing pathway and reassess at 12 weeks. If one pathway is over-responding while another lags, consider re-sequencing rather than abandoning the protocol.',
    'Baseline + 12-week reassessment per pathway. Lagging single pathway → consider re-sequencing rather than discontinuation.'
  ),
];

// ─── Assembled template ──────────────────────────────────────────────────────

export const MULTIFACTORIAL_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'multifactorial',
  audience: 'doctor',
  sections: {
    opening:   MULTIFACTORIAL_DOCTOR_OPENING,
    mechanism: MULTIFACTORIAL_DOCTOR_MECHANISM,
    severity: {
      mild:     MULTIFACTORIAL_DOCTOR_SEVERITY_MILD,
      moderate: MULTIFACTORIAL_DOCTOR_SEVERITY_MODERATE,
      severe:   MULTIFACTORIAL_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: MULTIFACTORIAL_DOCTOR_TREATMENT,
    prognosis: MULTIFACTORIAL_DOCTOR_PROGNOSIS,
    closing:   MULTIFACTORIAL_DOCTOR_CLOSING,
  },
};
