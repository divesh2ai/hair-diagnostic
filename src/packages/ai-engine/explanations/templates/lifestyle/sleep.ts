import type { LifestyleTemplate } from '../types';
import { v } from '../_fragmentUtils';

// ─── Sleep lifestyle template ─────────────────────────────────────────────────
// Covers sleep deprivation, circadian disruption, shift work, and nocturnal
// growth hormone pulsatility.

export const SLEEP_IMPACT = [
  v(9,
    'Chronic sleep deprivation and circadian disruption suppress nocturnal growth hormone pulsatility, elevate IL-6 and CRP, and reduce melatonin-mediated antioxidant protection at the follicular bulge — all directly impairing anagen maintenance.',
    'Inadequate sleep creates a compounding effect on hair health: cortisol remains elevated through the night, growth hormone secretion is suppressed, and follicular repair processes that normally occur during deep sleep are curtailed.',
    'Disrupted sleep architecture reduces the nocturnal hormonal repair window: melatonin-mediated follicular antioxidant protection is insufficient, growth hormone anabolic signalling is blunted, and cortisol clearance is incomplete — each independently shortening anagen phase duration.'
  ),
];

export const SLEEP_RECOMMENDATION = [
  v(8,
    'Consistent sleep timing — the same bedtime and wake time including weekends — is the single most evidence-based sleep intervention; it re-entrains the circadian rhythm within 2–3 weeks.',
    'Prioritising 7–9 hours of consolidated sleep dramatically improves the nocturnal hormonal environment for hair follicles; no topical or oral supplement fully compensates for inadequate deep sleep.',
    'Sleep quality improvements can be supported by a cool, dark bedroom, consistent evening wind-down, magnesium glycinate supplementation, and elimination of screens 60 minutes before sleep — all of which the protocol\'s circadian reset compounds complement.'
  ),
];

export const SLEEP_TIMEFRAME = [
  v(7,
    'Improvements in nocturnal GH pulsatility and cortisol clearance begin within 2–3 weeks of establishing consistent sleep schedules; hair response tracks 4–8 weeks behind the hormonal improvement.',
    'Hair improvements from sleep correction are typically evident at 8–12 weeks — the time required for the improved nocturnal hormonal environment to translate into extended anagen phase duration.',
    'Patients who address sleep alongside the clinical protocol consistently see faster trajectory improvements; the hair benefits of improved sleep are additive to, not a substitute for, the clinical intervention.'
  ),
];

export const SLEEP_LIFESTYLE_TEMPLATE: LifestyleTemplate = {
  factorKey:      'sleep',
  impact:         SLEEP_IMPACT,
  recommendation: SLEEP_RECOMMENDATION,
  timeframe:      SLEEP_TIMEFRAME,
};
