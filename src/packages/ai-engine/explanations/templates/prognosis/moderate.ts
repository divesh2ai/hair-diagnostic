import type { PrognosisTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Moderate stage prognosis ─────────────────────────────────────────────────
// Applies when: Severity = MODERATE (SEVERITY_TO_STAGE → 'moderate')

export const MODERATE_PROGNOSIS_TIMELINE = [
  v(9,
    'At moderate stage, expect progression arrest within 2–4 months of consistent protocol use; density improvement follows progressively from month 4–6 onwards.',
    'Moderate-stage presentations respond well to structured treatment — initial shed reduction typically noted within 6–10 weeks, with ongoing improvement over 6–9 months.',
    'Clinical timeline for moderate-stage hair loss: stabilisation within 3–4 months, partial reversal possible within 6–12 months with sustained protocol adherence.'
  ),
];

export const MODERATE_PROGNOSIS_PROBABILITY = [
  v(9,
    'Moderate-stage prognosis is positive for progression arrest and partial reversal; full baseline density restoration is less certain but meaningful improvement is consistently achievable.',
    'At moderate stage, complete arrest of progression is the primary achievable endpoint; partial density recovery is common but degree varies with root-cause resolution adequacy.',
    'Evidence supports moderate-to-strong response rates at moderate stage when treatment addresses both the primary driver and inflammatory microenvironment concurrently.'
  ),
];

export const MODERATE_PROGNOSIS_CAVEATS = [
  v(7,
    'Moderate-stage recovery is more dependent on addressing concurrent secondary factors than early-stage; incomplete correction of a co-existing metabolic, nutritional, or hormonal factor will limit the hair response.',
    'At moderate stage, protocol compliance over the full recommended period is more critical than at early stage — the follicular environment has been under pressure longer and requires sustained correction.'
  ),
  c('hasSecondaryDx', 'Secondary diagnoses present alongside the primary condition extend the treatment timeline; adequate resolution of all active drivers is necessary for full response at moderate stage.', 7),
  c('isGrade45', 'Grade 4–5 at moderate severity classification indicates a transition zone — immune priming protocol sequencing is applied to address the reduced follicular reserve.', 7),
];

export const MODERATE_PROGNOSIS_RECOVERY = [
  v(8,
    'Most patients at moderate stage achieve meaningful recovery — stabilised shed rate, improved texture, and partial density gains — within 6–9 months of consistent treatment.',
    'Moderate-stage recovery is real and achievable; the outcome target shifts from full reversal to significant improvement and prevention of further progression.',
    'Patients at moderate stage consistently report improvement in shed velocity, texture, and scalp comfort as early markers of a positive trajectory, even before density changes become visible.'
  ),
];

export const MODERATE_PROGNOSIS_TEMPLATE: PrognosisTemplate = {
  stage: 'moderate',
  timeline:    MODERATE_PROGNOSIS_TIMELINE,
  probability: MODERATE_PROGNOSIS_PROBABILITY,
  caveats:     MODERATE_PROGNOSIS_CAVEATS,
  recovery:    MODERATE_PROGNOSIS_RECOVERY,
};
