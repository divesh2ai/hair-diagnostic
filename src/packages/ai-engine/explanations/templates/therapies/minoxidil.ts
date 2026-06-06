import type { TherapyTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Minoxidil therapy template ───────────────────────────────────────────────
// Covers topical and oral minoxidil formulations used in the protocol.

export const MINOXIDIL_MECHANISM = [
  v(9,
    'Minoxidil is a potassium channel opener that dilates scalp microvasculature, increasing blood flow and nutrient delivery to follicular papillae; it also directly prolongs anagen phase duration.',
    'Minoxidil acts as a vasodilator at the follicular level, improving oxygen and nutrient delivery to the follicular papilla while simultaneously extending the hair growth phase.',
    'The primary mechanism of minoxidil is dual: peripheral vasodilation increasing scalp perfusion, and direct follicular stimulation via potassium channel activation to prolong anagen phase.'
  ),
  c('isFemale', 'In female-pattern hair loss, topical minoxidil is indicated for diffuse crown thinning; concentration and formulation are selected based on grade, scalp state, and hormonal profile.', 7),
];

export const MINOXIDIL_EXPECTED_OUTCOMES = [
  v(8,
    'Miniaturised follicle recovery begins within 4–8 weeks; visible density improvement is typically noted at 3–6 months; full response assessment requires 12 months of consistent use.',
    'Clinical response to minoxidil: early shedding increase (weeks 2–4, indicating follicular recruitment) followed by progressive density improvement from month 3 onwards.',
    'Anagen phase prolongation produces visibly improved hair density and calibre over 3–6 months; reduction in daily shed velocity is an early positive indicator of effective response.'
  ),
];

export const MINOXIDIL_USAGE = [
  v(8,
    'Topical application to affected zones once or twice daily as prescribed; hair should be dry and the scalp clean before application; do not wash for 4 hours post-application.',
    'Apply to the specific thinning zones indicated; scalp massage post-application improves absorption; consistent twice-daily application maintains the vasodilatory effect.',
    'Use on a dry scalp directly to the affected area; the vehicle formulation (solution vs. foam) is selected based on scalp type and hair texture as indicated in the protocol.'
  ),
];

export const MINOXIDIL_CAUTION = [
  v(7,
    'Initial shedding increase (telogen effluvium-type) is expected within weeks 2–4 as minoxidil recruits dormant follicles into synchronised anagen; patients should be counselled to continue through this phase.',
    'Discontinuation of minoxidil results in progressive loss of gains within 3–6 months — patients must understand that treatment is ongoing, not a fixed course.'
  ),
  c('isPregnant', 'Minoxidil (all formulations) is absolutely contraindicated during pregnancy and whilst breastfeeding — HEALTHY-9 is the only prescribed supplement in this protocol.', 10),
];

export const MINOXIDIL_THERAPY_TEMPLATE: TherapyTemplate = {
  therapyKey:       'minoxidil',
  mechanism:        MINOXIDIL_MECHANISM,
  expectedOutcomes: MINOXIDIL_EXPECTED_OUTCOMES,
  usage:            MINOXIDIL_USAGE,
  caution:          MINOXIDIL_CAUTION,
};
