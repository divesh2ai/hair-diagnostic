import type { LifestyleTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Nutrition lifestyle template ─────────────────────────────────────────────
// Covers dietary micronutrient support, protein adequacy, and nutritional
// factors modifying treatment response.

export const NUTRITION_IMPACT = [
  v(9,
    'Inadequate dietary intake of iron, zinc, biotin, selenium, and complete protein directly impairs follicular matrix cell keratin synthesis and shortens anagen phase competence — even when supplementation is adequate.',
    'Dietary nutritional gaps create a persistent background follicular deficit that reduces the ceiling of achievable response from the clinical protocol; nutrition optimisation and supplementation work synergistically.',
    'The hair follicle is one of the most metabolically demanding structures in the body; it requires a continuous dietary supply of iron, amino acids, vitamins, and minerals to maintain normal 28-day matrix cell cycling.'
  ),
];

export const NUTRITION_RECOMMENDATION = [
  v(8,
    'Adequate dietary protein (minimum 1.2–1.6g/kg body weight) is critical for optimal hair recovery; protein is the primary substrate for keratin synthesis and cannot be adequately replaced by supplementation alone.',
    'Iron-rich dietary sources — particularly haem iron from meat or fish, or non-haem iron combined with vitamin C — support ferritin restoration alongside supplementation; dietary optimisation shortens the ferritin recovery timeline.',
    'Zinc-rich foods, selenium from Brazil nuts, and a diversity of amino acid sources from protein complement the clinical protocol; a nutritionally varied diet amplifies supplementation efficacy rather than replacing it.'
  ),
  c('isVeg', 'Vegetarian dietary patterns require deliberate planning to meet iron, B12, zinc, and complete protein requirements; haem-iron absence significantly reduces bioavailability of dietary iron — non-haem iron with vitamin C is the compensatory strategy.', 7),
];

export const NUTRITION_TIMEFRAME = [
  v(7,
    'Dietary improvements support faster ferritin and zinc repletion compared to supplementation alone; measurable improvements in hair texture and shed velocity typically follow within 6–12 weeks of nutritional optimisation.',
    'The combination of targeted supplementation and dietary optimisation consistently produces faster and more complete hair recovery than either approach alone — most patients notice the difference at 8–10 weeks.',
    'Nutritional changes need to be sustained — not just during the active recovery phase but as a long-term dietary pattern — to maintain the hair improvements achieved by the protocol.'
  ),
];

export const NUTRITION_LIFESTYLE_TEMPLATE: LifestyleTemplate = {
  factorKey:      'nutrition',
  impact:         NUTRITION_IMPACT,
  recommendation: NUTRITION_RECOMMENDATION,
  timeframe:      NUTRITION_TIMEFRAME,
};
