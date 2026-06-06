import type { ClinicalTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Opening ──────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_OPENING = [
  v(9,
    'Your assessment shows that your hair loss is driven by several factors acting together, not by one single cause. This is more common than people realise.',
    'What we found is that multiple causes are contributing to your hair loss at the same time. No single explanation tells the whole story.',
    'Your hair loss reflects a combination of factors — each is real and each plays a role.'
  ),
  c('isFemale', 'In many women, hormonal shifts combine with stress, nutrition, and inflammation to produce a layered picture.', 7),
  c('isMale', 'In many men, genetic sensitivity combines with metabolic and inflammatory drivers to produce a layered picture.', 7),
];

// ─── Mechanism ────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_MECHANISM = [
  v(9,
    'Some factors directly damage or shrink follicles. Other factors amplify the first set — when both are active, the effect is bigger than either one alone.',
    'Think of it as several streams flowing into one river. Each on its own would be a smaller problem; together they create the picture you are experiencing.',
    'Multiple biological processes are pulling on the hair cycle simultaneously. That is why a single treatment alone usually does not produce the full result needed.'
  ),
  v(7,
    'Common combinations include: hormonal shifts amplifying genetic sensitivity, inflammation accelerating the hormone-driven thinning, nutritional gaps reducing the body\'s capacity to repair, and stress shortening the growth phase of the hair cycle.',
    'Frequently we see hormone effects, inflammation, nutritional gaps, and stress all contributing — each making the other worse.'
  ),
];

// ─── Severity ─────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_SEVERITY_MILD = [
  v(9,
    'The overall picture is currently mild. Addressing the contributing factors now usually produces the strongest and most lasting response.',
    'At this early stage, addressing each contributing factor while the loss is still mild often produces the best long-term outcome.'
  ),
];

export const MULTIFACTORIAL_PATIENT_SEVERITY_MODERATE = [
  v(9,
    'The overall picture is moderate. Because multiple factors are active, the plan addresses them in a deliberate sequence rather than all at once — that produces clearer results than trying everything simultaneously.',
    'Your case is moderate. The treatment is staged so that each phase clears the path for the next, rather than overwhelming your system with everything at once.'
  ),
];

export const MULTIFACTORIAL_PATIENT_SEVERITY_SEVERE = [
  v(9,
    'The overall picture is advanced. A sequenced, multi-pathway plan is needed because no single factor explains the full extent — each contributor needs its own correction.',
    'At this advanced stage a layered plan is required. Stopping the active processes first, then rebuilding, is the realistic and effective approach.'
  ),
];

// ─── Treatment rationale ──────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_TREATMENT = [
  v(9,
    'Your protocol has multiple phases because multiple factors are active. Each phase has a specific job: arrest active shedding, clear inflammation, modulate hormonal drivers, correct metabolic and nutritional gaps, and finally support sustained regrowth.',
    'Each phase of your plan corrects one of the contributing factors before the next layer is added. This sequencing is what makes a multi-pathway plan work.'
  ),
  c('hasActiveShedding', 'Because you are also experiencing active shedding, your treatment starts there — stopping the shedding gives every later phase a much stronger starting point.', 8),
  v(7,
    'A single-target treatment would address one factor but leave the others to keep pulling on your hair cycle. The layered approach is why multifactorial cases need multi-component support.',
    'One treatment alone would leave several pulling factors uncorrected — which is why your plan is intentionally broader.'
  ),
];

// ─── Prognosis ────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_PROGNOSIS = [
  v(9,
    'Different contributors recover on different timelines. Shedding usually settles first, scalp comfort and inflammation next, and density improvements typically come over months rather than weeks.',
    'Expect early wins on shedding and scalp comfort within 6–10 weeks, with density improvements emerging over 3–6 months.'
  ),
  v(7,
    'Some contributors are reversible (stress, nutrition, inflammation). Others (genetic sensitivity) can be slowed and partially reversed but require ongoing support. Realistic expectations help you stay consistent.',
    'Reversible drivers respond well; structural drivers like genetics need ongoing, consistent support. Knowing which is which helps you stay on the plan.'
  ),
];

// ─── Closing ──────────────────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_CLOSING = [
  v(8,
    'Multifactorial cases require consistency across all phases. The single most common reason these plans under-deliver is stopping one component because another is taking longer to show effect.',
    'Stay with the full plan. Multifactorial cases respond when every contributor is addressed — not just the most obvious one.'
  ),
];

// ─── Assembled template ──────────────────────────────────────────────────────

export const MULTIFACTORIAL_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'multifactorial',
  audience: 'patient',
  sections: {
    opening:   MULTIFACTORIAL_PATIENT_OPENING,
    mechanism: MULTIFACTORIAL_PATIENT_MECHANISM,
    severity: {
      mild:     MULTIFACTORIAL_PATIENT_SEVERITY_MILD,
      moderate: MULTIFACTORIAL_PATIENT_SEVERITY_MODERATE,
      severe:   MULTIFACTORIAL_PATIENT_SEVERITY_SEVERE,
    },
    treatment: MULTIFACTORIAL_PATIENT_TREATMENT,
    prognosis: MULTIFACTORIAL_PATIENT_PROGNOSIS,
    closing:   MULTIFACTORIAL_PATIENT_CLOSING,
  },
};
