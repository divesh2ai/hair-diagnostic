import type { ClinicalTemplate } from '../types';
import { v, c, cv } from '../_fragmentUtils';

export const PCOS_PATIENT_OPENING = [
  v(9,
    'Your assessment shows that PCOS is causing hormonal imbalances that are making certain hair follicles more sensitive to thinning — a very common pattern in PCOS.',
    'The link between your PCOS and your hair is hormonal: elevated androgens from your PCOS are making specific follicles on your scalp shrink and produce finer hair.',
    'Your hair concerns are directly connected to your PCOS — the hormonal environment that PCOS creates is causing your follicles to become sensitive to a thinning-related hormone called DHT.'
  ),
];

export const PCOS_PATIENT_MECHANISM = [
  v(9,
    'PCOS creates higher-than-normal levels of androgens (male-type hormones that everyone has). These androgens make certain hair follicles — particularly around the crown and temples — become oversensitive and gradually produce finer hair.',
    'The connection works like this: PCOS disrupts your insulin and hormone balance, which raises androgen levels, which then trigger specific follicles to start thinning. It is a chain reaction that can be interrupted at multiple points.',
    'Higher circulating androgens from PCOS act on genetically sensitive follicles, shortening their growth cycle. Over time, these follicles produce progressively finer and shorter hair until treatment corrects the hormonal imbalance.'
  ),
];

export const PCOS_PATIENT_SEVERITY_MILD = [
  v(8,
    'Your hair thinning related to PCOS is at an early stage — the follicles affected are still active and will respond well to treatment that corrects the hormonal imbalance.',
    'You have caught this at an early point, which is excellent news. Correcting the hormonal root cause now will prevent the thinning from progressing further.'
  ),
];

export const PCOS_PATIENT_SEVERITY_MODERATE = [
  v(8,
    'Your PCOS-related hair thinning is at a moderate stage, meaning the hormonal imbalance has been affecting your follicles for some time. The right treatment can correct this and support recovery.',
    'The thinning has progressed to a moderate level. A targeted hormonal and nutritional protocol will address both the PCOS drivers and the hair thinning together.'
  ),
];

export const PCOS_PATIENT_SEVERITY_SEVERE = [
  v(8,
    'Your hair thinning from PCOS is at a more advanced stage. This means sustained hormonal pressure has affected a larger number of follicles — but a structured treatment can still make a significant difference.',
    'Advanced hormonal hair thinning takes more time to address, but the results of a properly targeted protocol are very real. The key is correcting the hormonal root cause first.'
  ),
];

export const PCOS_PATIENT_TREATMENT = [
  v(9,
    'Your treatment directly targets the hormonal imbalances at the root of your PCOS hair concerns — reducing excess androgens, improving insulin sensitivity, and then supporting your follicles to recover.',
    'The plan works in stages: first correcting the hormonal and insulin imbalances driving the thinning, then clearing any scalp inflammation, then supporting new hair growth.',
    'Because PCOS affects both hormones and metabolism, your treatment addresses both layers simultaneously — which is what gives it the most complete and lasting result.'
  ),
  c('hasActiveShedding', 'Your plan also addresses the active shedding alongside the hormonal work, so you should notice the daily shed reducing within the first few weeks.', 7),
];

export const PCOS_PATIENT_PROGNOSIS = [
  cv('severityMild', 8,
    'Early PCOS hair loss responds very well to hormonal correction — most patients notice the daily shed reducing within 6–8 weeks and see improving density from 3–4 months.',
    'When caught early, PCOS hair thinning is highly manageable. The right treatment produces consistent, noticeable results within a few months.'
  ),
  cv('severityModerate', 8,
    'Moderate PCOS hair thinning responds progressively to treatment — shed stabilisation typically within 6–10 weeks, with density improvement becoming visible over 4–6 months.',
    'With consistent treatment, moderate PCOS-related thinning can be meaningfully reversed. The hormonal balance corrects first, and the hair follows over the subsequent months.'
  ),
  cv('severitySevere', 8,
    'Advanced PCOS hair thinning takes longer to address, but the results of a sustained protocol are real. Expect stabilisation within 3–4 months and gradual improvement over 9–12 months.',
    'Significant hormonal hair thinning responds to treatment over a longer timeline — the most important milestones are hormonal balance first, then gradual follicle recovery.'
  ),
];

export const PCOS_PATIENT_CLOSING = [
  v(6,
    'Treating the hormonal root cause of PCOS hair loss is what makes the difference between temporary improvement and lasting results.',
    'The great thing about this approach is that improving your PCOS management benefits your hair, your hormonal wellbeing, and your overall health all at the same time.'
  ),
];

export const PCOS_PATIENT_TEMPLATE: ClinicalTemplate = {
  category: 'pcos',
  audience: 'patient',
  sections: {
    opening:   PCOS_PATIENT_OPENING,
    mechanism: PCOS_PATIENT_MECHANISM,
    severity: {
      mild:     PCOS_PATIENT_SEVERITY_MILD,
      moderate: PCOS_PATIENT_SEVERITY_MODERATE,
      severe:   PCOS_PATIENT_SEVERITY_SEVERE,
    },
    treatment: PCOS_PATIENT_TREATMENT,
    prognosis: PCOS_PATIENT_PROGNOSIS,
    closing:   PCOS_PATIENT_CLOSING,
  },
};
