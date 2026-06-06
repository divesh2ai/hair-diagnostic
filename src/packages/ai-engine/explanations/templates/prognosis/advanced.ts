import type { PrognosisTemplate } from '../types';
import { v, c } from '../_fragmentUtils';

// ─── Advanced / Severe stage prognosis ───────────────────────────────────────
// Applies when: Severity = SEVERE (SEVERITY_TO_STAGE → 'advanced')

export const ADVANCED_PROGNOSIS_TIMELINE = [
  v(9,
    'Advanced-stage presentations require a sustained protocol over 6–18 months; initial stabilisation of progression expected within 3–5 months, with gradual improvement in viable zones thereafter.',
    'At advanced stage, the primary clinical milestone is progression arrest — achievable within 4–6 months; subsequent density improvement in partially viable follicular zones may take 12–18 months.',
    'Advanced-stage treatment timelines are longer by necessity: follicular reserve is reduced and the microenvironment has been compromised for an extended period. Staged improvement over 12–18 months is the realistic expectation.'
  ),
];

export const ADVANCED_PROGNOSIS_PROBABILITY = [
  v(9,
    'Advanced-stage prognosis: high probability of progression arrest; moderate probability of partial density recovery in zones with surviving miniaturised follicles; low probability of full baseline restoration.',
    'At advanced stage, stabilisation is the primary achievable endpoint. Partial reversal is possible in areas with residual follicular activity; realistic expectation-setting is clinically important.',
    'Evidence indicates advanced-stage AGA and TE can be meaningfully managed with targeted protocols; the treatment goal shifts from reversal to sustained stabilisation and optimised quality of surviving follicles.'
  ),
];

export const ADVANCED_PROGNOSIS_CAVEATS = [
  v(7,
    'Advanced-stage recovery is directly proportional to the degree of residual follicular viability; areas of complete follicular loss cannot be restored through nutritional or pharmacological intervention alone.',
    'At advanced stage, co-morbid metabolic, immune, or hormonal drivers are frequently present and must all be adequately addressed; incomplete treatment of any active driver significantly limits the achievable outcome.'
  ),
  c('isGrade45', 'Grade 4–5 patients should be counselled that stabilisation and partial reversal are the realistic treatment goals; full density restoration is not a reliable outcome at this grade.', 8),
  c('hasSecondaryDx', 'Multiple concurrent secondary conditions at advanced stage create a complex clinical picture requiring sustained multi-phase management; timeline expectations should be adjusted accordingly.', 7),
  c('hasActiveShedding', 'Active shedding at advanced grade represents a compounded clinical challenge — shedding arrest is Phase 1 priority, and the timeline to improvement extends from when the shed is controlled.', 8),
];

export const ADVANCED_PROGNOSIS_RECOVERY = [
  v(8,
    'Advanced-stage patients who maintain consistent protocol adherence over 12+ months consistently report meaningful outcomes: stabilised progression, improved hair quality in viable zones, and improved scalp health.',
    'Despite the more guarded prognosis, advanced-stage treatment consistently produces clinically meaningful improvements — particularly in shed velocity, scalp health, and quality of surviving hair fibres.',
    'Advanced-stage hair loss should not be viewed as untreatable; it requires more sustained effort and a longer timeline, but meaningful and tangible improvement remains achievable with a properly sequenced protocol.'
  ),
];

export const ADVANCED_PROGNOSIS_TEMPLATE: PrognosisTemplate = {
  stage: 'advanced',
  timeline:    ADVANCED_PROGNOSIS_TIMELINE,
  probability: ADVANCED_PROGNOSIS_PROBABILITY,
  caveats:     ADVANCED_PROGNOSIS_CAVEATS,
  recovery:    ADVANCED_PROGNOSIS_RECOVERY,
};
