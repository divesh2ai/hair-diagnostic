import type { PrognosisTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Early / Mild stage prognosis ─────────────────────────────────────────────
// Applies when: Severity = MILD (SEVERITY_TO_STAGE → 'early')

export const EARLY_PROGNOSIS_TIMELINE = [
  v(9,
    'At this early stage, the treatment window is optimal — most patients notice measurable improvement within 6–12 weeks of consistent protocol use.',
    'Early-stage presentation offers the strongest prognosis; the majority of viable follicles are still active and responsive to intervention.',
    'With early-stage involvement, arrest of progression is achievable within 1–2 months; partial reversal or density improvement typically follows within 3–6 months.'
  ),
];

export const EARLY_PROGNOSIS_PROBABILITY = [
  v(9,
    'Probability of progression arrest is high at this stage; probability of measurable density improvement is moderate-to-high with consistent treatment.',
    'Early-stage response rates to targeted treatment are significantly higher than at moderate or advanced stages; this is the most advantageous time to intervene.',
    'Clinical evidence supports strong outcomes for early-stage hair loss when root-cause correction and anti-inflammatory management are initiated promptly.'
  ),
];

export const EARLY_PROGNOSIS_CAVEATS = [
  v(7,
    'Consistency of protocol use is the single greatest determinant of outcome at early stage — intermittent use significantly reduces the probability of arrest and reversal.',
    'Concurrent lifestyle factors such as chronic stress, poor nutrition, or inadequate sleep can slow early-stage recovery even with correct protocol — addressing these amplifies treatment response.'
  ),
  c('isVeg', 'Vegetarian or vegan dietary patterns may create nutritional gaps that slow early-stage recovery; protocol selection has accounted for this but dietary optimisation is recommended alongside treatment.', 6),
  c('hasGLP1Early', 'Active GLP-1 use creates an ongoing nutritional pressure that must be actively shielded against; early-stage recovery whilst on GLP-1 requires the shield protocol to be maintained throughout.', 7),
];

export const EARLY_PROGNOSIS_RECOVERY = [
  v(8,
    'Full cycle normalisation — meaning hair texture, density, and shed rate returning to baseline — is a realistic and commonly achieved outcome for early-stage presentations.',
    'Early-stage treatment success stories are the norm, not the exception; patients who adhere to their protocol through the first 12 weeks consistently report measurable improvements.',
    'At early stage, the biological conditions for full recovery are largely intact — treatment is essentially optimising what the body already has the capacity to do.'
  ),
];

export const EARLY_PROGNOSIS_TEMPLATE: PrognosisTemplate = {
  stage: 'early',
  timeline:    EARLY_PROGNOSIS_TIMELINE,
  probability: EARLY_PROGNOSIS_PROBABILITY,
  caveats:     EARLY_PROGNOSIS_CAVEATS,
  recovery:    EARLY_PROGNOSIS_RECOVERY,
};
