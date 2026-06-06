import type { TherapyTemplate } from '../types';
import { v } from '../_fragmentUtils';

// ─── Anti-inflammatory therapy template ──────────────────────────────────────
// Covers PHENOTYPE INFLAMATION and related NF-kB suppression compounds.

export const ANTI_INFLAMMATORY_MECHANISM = [
  v(9,
    'Curcumin-piperine complex, quercetin, and long-chain omega-3s inhibit NF-kB and TNF-α signalling in the perifollicular space, clearing the cytokine microenvironment that impairs follicular anagen initiation.',
    'Multi-pathway anti-inflammatory intervention targeting NF-kB, IL-6, and TNF-α simultaneously restores the perifollicular microenvironment required for normal anagen phase cycling.',
    'Curcumin at standardised absorbable concentration provides NF-kB inhibition; quercetin provides complementary STAT3 and COX-2 suppression; together they clear the key inflammatory pathways disrupting follicular cycling.'
  ),
];

export const ANTI_INFLAMMATORY_EXPECTED_OUTCOMES = [
  v(8,
    'Scalp comfort improvement — reduced oiliness, sensitivity, or redness — is typically the earliest indicator of anti-inflammatory efficacy, usually within 3–5 weeks.',
    'Perifollicular inflammatory clearance produces visible scalp health improvements within 3–6 weeks; downstream follicular response improvements follow from week 8 onwards.',
    'Early outcomes include improved scalp comfort and reduced reactive sebum; the delayed outcome — observable in weeks 8–12 — is improved hair density and shed velocity reduction as follicles respond to the cleared microenvironment.'
  ),
];

export const ANTI_INFLAMMATORY_USAGE = [
  v(7,
    'Anti-inflammatory compounds are most effective when taken consistently with food to improve lipophilic absorption; curcumin bioavailability is significantly enhanced by piperine co-formulation.',
    'Consistent daily use is required to maintain the anti-inflammatory gradient in scalp tissue; sporadic use allows inflammatory cytokine levels to rebound between doses.'
  ),
];

export const ANTI_INFLAMMATORY_CAUTION = [
  v(6,
    'Anti-inflammatory Phase 1 must be completed before transitioning to DHT correction or follicle stimulation phases — premature escalation limits the efficacy of downstream interventions.',
    'Curcumin and quercetin at therapeutic doses are well tolerated; concurrent use with anticoagulant medication warrants clinical review due to mild platelet aggregation effects.'
  ),
];

export const ANTI_INFLAMMATORY_THERAPY_TEMPLATE: TherapyTemplate = {
  therapyKey:       'antiInflammatory',
  mechanism:        ANTI_INFLAMMATORY_MECHANISM,
  expectedOutcomes: ANTI_INFLAMMATORY_EXPECTED_OUTCOMES,
  usage:            ANTI_INFLAMMATORY_USAGE,
  caution:          ANTI_INFLAMMATORY_CAUTION,
};
