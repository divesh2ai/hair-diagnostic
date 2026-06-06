import type { ClinicalTemplate } from '../types';
import { f, v, c, cv } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const AGA_DOCTOR_OPENING = [
  v(9,
    'Androgenetic alopecia presenting in the androgenetically susceptible distribution zones, consistent with clinical assessment findings.',
    'Pattern hair loss with characteristic androgenetic follicular miniaturisation confirmed on clinical review.',
    'Androgenetic alopecia identified; androgen-mediated follicular miniaturisation in the expected Hamilton-Norwood or Ludwig distribution.'
  ),
  c('isMale', 'Male pattern androgenetic alopecia (MPHL) with vertex and/or bitemporal involvement.', 8),
  c('isFemale', 'Female pattern androgenetic alopecia (FPHL) with diffuse central crown involvement and preserved frontal hairline.', 8),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const AGA_DOCTOR_MECHANISM = [
  v(9,
    'DHT-mediated miniaturisation of androgen-sensitive follicles progressively reduces shaft diameter and shortens anagen duration in susceptible zones.',
    '5α-reductase type II activity at the follicular unit converts testosterone to DHT; sustained DHT-AR binding drives progressive follicular regression and shaft miniaturisation.',
    'Androgen receptor polymorphism elevates follicular sensitivity to circulating DHT, triggering a progressive miniaturisation cascade in androgen-susceptible regions.'
  ),
  v(7,
    'Perifollicular NF-kB-mediated microinflammation amplifies the androgenetic process, accelerating miniaturisation beyond the androgen-only model.',
    'Seborrhoea and concurrent scalp inflammatory load compound DHT-mediated follicular regression, widening the zone of androgenetic involvement over time.'
  ),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const AGA_DOCTOR_SEVERITY_MILD = [
  v(9,
    'Grade 1–2 presentation: early androgenetic involvement with retained follicular reserve; therapeutic window is optimal at this stage.',
    'Early-grade pattern loss with viable follicles in the thinning distribution — prognosis for arrest and partial reversal is favourable.',
    'Norwood/Ludwig grade 1–2 confirms minimal follicular loss to date; aggressive early intervention yields the highest probability of density preservation.'
  ),
];

export const AGA_DOCTOR_SEVERITY_MODERATE = [
  v(9,
    'Grade 2–3 presentation: established androgenetic pattern with partial follicular miniaturisation across primary affected zones.',
    'Moderate-grade AGA with ongoing DHT-mediated miniaturisation; follicular reserve remains partially viable but treatment urgency is elevated.',
    'Norwood/Ludwig grade 2–3 indicates intermediate stage; a structured multi-phase protocol can arrest progression and support partial density recovery.'
  ),
];

export const AGA_DOCTOR_SEVERITY_SEVERE = [
  v(9,
    'Grade 4–5 presentation: advanced androgenetic pattern with extensive follicular miniaturisation and significantly reduced viable follicular reserve.',
    'Advanced-grade AGA with dense miniaturisation across crown and temporal zones; probability of full density reversal is reduced — stabilisation is a clinically realistic primary endpoint.',
    'Norwood/Ludwig grade 4–5 confirmed; immune-priming protocol sequencing is mandated before DHT correction to rescue partially viable follicles.'
  ),
  c('isGrade45', 'At advanced grade, PRO IMMUNE priming at Phase 1 is non-negotiable — compromised follicles require nutritional rescue environment before DHT blockade can be effective.', 8),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const AGA_DOCTOR_TREATMENT = [
  v(9,
    'Protocol priority sequence: DHT suppression → NF-kB/TNF-α perifollicular clearance → insulin-androgen axis correction → immune-nutritional anagen re-entry stimulation.',
    'Treatment targets the androgenetic cascade at each mechanistic layer: 5α-reductase inhibition, microenvironment clearance, SHBG upregulation, and follicular growth factor delivery.',
    'Multi-phase sequenced protocol ensures inflammatory terrain is cleared before DHT-blocking compounds are applied, maximising follicular bioavailability.'
  ),
  c('hasActiveShedding', 'Concurrent active shedding component — telogen arrest is Phase 1 priority before androgenetic correction can be applied effectively.', 8),
  c('hasNoVisibleFall', 'No active shedding: HAIR FACT TE GOLD is contraindicated per suppression rule SR-001; protocol shifts to pure miniaturisation correction and anagen stimulation.', 7),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const AGA_DOCTOR_PROGNOSIS = [
  cv('severityMild', 8,
    'Favourable prognosis at early grade; density stabilisation expected within 3–4 months, partial reversal within 6–12 months with consistent DHT suppression and anti-inflammatory clearance.',
    'Early presentation — statistical response rates for arrest of progression are high when DHT suppression is initiated at this grade.'
  ),
  cv('severityModerate', 8,
    'Moderate prognosis; arrest of progression expected within 4–6 months, with partial density improvement possible at 9–12 months.',
    'Moderate-grade AGA can be managed effectively; realistic endpoint is progression arrest and partial reversal rather than full density restoration.'
  ),
  cv('severitySevere', 8,
    'Guarded prognosis for density reversal at advanced grade; primary endpoint is halting further progression and partially restoring follicular cycling in viable zones.',
    'Advanced grade reduces probability of meaningful reversal; patient counselling should align expectations to stabilisation as the primary achievable outcome.'
  ),
];

// ─── Closing ──────────────────────────────────────────────────────────────────

export const AGA_DOCTOR_CLOSING = [
  v(6,
    'Consistent protocol adherence over a minimum of 6 months is required before meaningful response assessment. Interim review at 3 months for early adverse signal detection.',
    'Compliance audit at 3 months is recommended; DHT suppression requires sustained pharmacological pressure to produce measurable clinical response.',
  ),
];

// ─── Bundled template ─────────────────────────────────────────────────────────

export const AGA_DOCTOR_TEMPLATE: ClinicalTemplate = {
  category: 'aga',
  audience: 'doctor',
  sections: {
    opening:   AGA_DOCTOR_OPENING,
    mechanism: AGA_DOCTOR_MECHANISM,
    severity: {
      mild:     AGA_DOCTOR_SEVERITY_MILD,
      moderate: AGA_DOCTOR_SEVERITY_MODERATE,
      severe:   AGA_DOCTOR_SEVERITY_SEVERE,
    },
    treatment: AGA_DOCTOR_TREATMENT,
    prognosis: AGA_DOCTOR_PROGNOSIS,
    closing:   AGA_DOCTOR_CLOSING,
  },
};
