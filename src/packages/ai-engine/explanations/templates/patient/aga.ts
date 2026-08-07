import type { ClinicalTemplate } from '../types';
import { v, c, cv, vReq } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const AGA_PATIENT_OPENING = [
  v(9,
    'Your assessment shows that you are experiencing pattern hair loss caused by a hormone called DHT making certain follicles gradually shrink over time.',
    'What we found is a form of hair loss called pattern thinning, where a hormone in your body is making some hair follicles produce finer and shorter hair.',
    'Your hair assessment confirms pattern hair thinning — a very common condition where certain follicles in your scalp become sensitive to a hormone called DHT.'
  ),
  c('isMale', 'This is called male pattern hair loss, and it typically affects the hairline and the top of the head.', 7),
  c('isFemale', 'This is called female pattern hair thinning, and it usually shows as diffuse thinning across the crown with the hairline staying intact.', 7),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const AGA_PATIENT_MECHANISM = [
  v(9,
    'DHT is a natural hormone in your body, but in certain follicles it causes them to shrink with each hair cycle until the hair produced becomes very fine or stops growing.',
    'Think of it as certain hair follicles being overly sensitive to a hormone your body produces naturally — over time they produce finer hair and eventually may go dormant.',
    'The follicles most affected are genetically more sensitive to DHT; this sensitivity makes them shrink gradually, which is why hair becomes thinner before it stops growing.'
  ),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const AGA_PATIENT_SEVERITY_MILD = [
  v(9,
    'The good news is that you have caught this at an early stage, when the affected follicles are still active and very responsive to treatment.',
    'Your hair loss is at an early stage — most of the follicles in the thinning areas are still producing hair. This is the best time to start treatment.',
    'At this early stage, the treatment has the strongest chance of slowing or stopping the thinning and encouraging the follicles to stay active.'
  ),
];

export const AGA_PATIENT_SEVERITY_MODERATE = [
  v(9,
    'Your hair thinning is at a moderate stage, which means some follicles have already miniaturised but a significant number are still active and treatable.',
    'The thinning has progressed to a moderate level. There is still a good opportunity to slow the process and support the follicles that are still functioning.',
    'At this moderate stage, the right treatment can make a meaningful difference — slowing further thinning and supporting some recovery in areas that still have active follicles.'
  ),
];

export const AGA_PATIENT_SEVERITY_SEVERE = [
  v(9,
    'Your hair loss is at a more advanced stage, which means the thinning has progressed over a longer period. A structured treatment can still slow this significantly and help recovery in active areas.',
    'While the thinning is at an advanced stage, a consistent treatment protocol can stabilise the situation and support improvement in follicles that are still viable.',
    'Advanced hair loss takes more time and a more comprehensive approach to address — but with the right structured protocol, real improvement is still achievable.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const AGA_PATIENT_TREATMENT = [
  // Generic variants — no patient-symptom claims. Safe for any AGA patient
  // regardless of scalp state.
  v(9,
    'Think of your treatment as a layered approach — each phase builds on the last, so by the time you reach the growth-stimulating stage, the conditions are perfect for it to work.',
    'The treatment addresses multiple things at once: reducing the hormone driving the thinning and giving your follicles the nutrients they need to recover.'
  ),
  // Scalp-inflammation phrasing — only valid when the patient actually
  // reported visible scalp findings. Was previously unconditional and would
  // claim "clearing scalp inflammation" for normal-scalp patients.
  vReq(['scalp.anyNonNormal'], 9,
    'Your treatment plan works in stages: first stopping the shedding, then clearing scalp inflammation, then blocking DHT, and finally stimulating your follicles to grow stronger hair.',
  ),
  c('hasActiveShedding', 'Because you are also experiencing active shedding, your treatment starts by stopping that first — which gives the rest of the plan the best possible foundation.', 8),
  c('hasNoVisibleFall', 'Since the shedding has already stabilised, your treatment focuses entirely on improving the density of the hair that is already growing, rather than stopping shed.', 8),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const AGA_PATIENT_PROGNOSIS = [
  cv('severityMild', 8,
    'At this early stage, most patients notice the shedding slowing down and texture improving within 6–10 weeks, and see real density improvement at 4–6 months.',
    'Early-stage pattern thinning responds very well to treatment — you can expect to see stabilisation within a few months and gradual improvement from there.'
  ),
  cv('severityModerate', 8,
    'With consistent use of your protocol, most patients see stabilisation within 3–4 months, with noticeable improvement in density over 6–12 months.',
    'Moderate hair thinning takes a bit longer to respond but the results are very meaningful — expect gradual improvement from month 3 onwards.'
  ),
  cv('severitySevere', 8,
    'Advanced hair thinning takes more time, but a consistent protocol can make a real difference. Most patients see slowed progression within 3–4 months and meaningful recovery over 12 months.',
    'With advanced thinning, the most important first win is stopping further loss — which most patients see within 3–4 months. Gradual recovery continues from there.'
  ),
];

// ─── Closing ─────────────────────────────────────────────────────────────────

export const AGA_PATIENT_CLOSING = [
  v(6,
    'Consistency is the key — most patients who stick with their protocol for 6 months see results that are very hard to achieve with any shorter approach.',
    'The most important thing to know is that this works progressively, not overnight. Most patients start noticing changes at 6–8 weeks and continue improving for months.'
  ),
];

// ─── Bundled template ─────────────────────────────────────────────────────────

export const AGA_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'aga',
  audience: 'patient',
  sections: {
    opening:   AGA_PATIENT_OPENING,
    mechanism: AGA_PATIENT_MECHANISM,
    severity: {
      mild:     AGA_PATIENT_SEVERITY_MILD,
      moderate: AGA_PATIENT_SEVERITY_MODERATE,
      severe:   AGA_PATIENT_SEVERITY_SEVERE,
    },
    treatment: AGA_PATIENT_TREATMENT,
    prognosis: AGA_PATIENT_PROGNOSIS,
    closing:   AGA_PATIENT_CLOSING,
  },
};
