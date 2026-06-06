import type { TherapyTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Metabolic correction therapy template ────────────────────────────────────
// Covers berberine/AMPK pathway correction, insulin sensitisation, thyroid
// metabolic support, and related metabolic-axis compounds.

export const METABOLIC_MECHANISM = [
  v(9,
    'Berberine activates the AMPK pathway, improving insulin sensitivity and reducing hyperinsulinaemia-driven ovarian/adrenal androgen synthesis; SHBG levels rise as insulin resistance decreases.',
    'AMPK activation via berberine mimics the metabolic effects of exercise at the cellular level: improved glucose utilisation, reduced free fatty acid accumulation, and downstream androgen axis normalisation.',
    'Metabolic correction targets the insulin-androgen axis at its source: reducing insulin resistance lowers LH-stimulated androgen output and raises SHBG, cutting free androgen bioavailability at follicular receptors.'
  ),
  c('hasGLP1Early', 'GLP-1 active: metabolic support must account for the additional nutritional depletion from appetite suppression — protein, ferritin, and zinc repletion are co-priorities alongside AMPK correction.', 7),
];

export const METABOLIC_EXPECTED_OUTCOMES = [
  v(8,
    'Insulin sensitivity markers improve within 8–12 weeks; SHBG elevation and free androgen reduction follow within 3–4 months; hair response — reduced androgenic shed — reflects these hormonal changes over 3–6 months.',
    'Metabolic correction produces a cascade of measurable changes: improved fasting glucose → reduced androgen output → elevated SHBG → lower follicular DHT concentration → reduced miniaturisation rate.',
    'Clinical markers of metabolic response (improved energy, reduced central fat, better fasting glucose) typically appear before the hair response — the metabolic improvements are the leading indicator of hair improvement to follow.'
  ),
];

export const METABOLIC_USAGE = [
  v(7,
    'Berberine-containing compounds are most effective when taken with meals to reduce GI adaptation; consistent twice-daily use maintains the AMPK activation gradient.',
    'Metabolic support compounds require a sustained minimum of 8–12 weeks of consistent use before measurable hormonal changes are reflected in clinical markers — short courses are insufficient.'
  ),
];

export const METABOLIC_CAUTION = [
  v(6,
    'Berberine has mild CYP3A4 inhibitory activity; clinical review for interactions with statins, cyclosporin, or antiretroviral medications is advised.',
    'Metabolic correction is a long-horizon intervention; patients should be counselled that the hair benefit follows the metabolic improvement by 2–3 months — visible response at 3–6 months should be the expectation.'
  ),
  c('isPregnant', 'Berberine-containing metabolic compounds are contraindicated during pregnancy and breastfeeding — protocol is limited to HEALTHY-9.', 10),
];

export const METABOLIC_THERAPY_TEMPLATE: TherapyTemplate = {
  therapyKey:       'metabolic',
  mechanism:        METABOLIC_MECHANISM,
  expectedOutcomes: METABOLIC_EXPECTED_OUTCOMES,
  usage:            METABOLIC_USAGE,
  caution:          METABOLIC_CAUTION,
};
