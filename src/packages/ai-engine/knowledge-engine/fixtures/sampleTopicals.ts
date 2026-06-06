/**
 * Sample Topical Knowledge Fixtures
 */

import type { TopicalKnowledge } from '../types';

export const SAMPLE_MINOXIDIL_5PCT: TopicalKnowledge = {
  topicalId: 'minoxidil_5pct',
  displayName: 'Minoxidil 5% Topical Solution',
  formulation: 'Topical solution (propylene glycol vehicle)',
  activeIngredients: ['Minoxidil 5%'],
  ingredientIds: ['minoxidil'],
  scalpPenetration: {
    depth: 'FOLLICULAR',
    mechanism:
      'Passive diffusion through the follicular opening; propylene glycol vehicle enhances penetration.',
    enhancers: ['Propylene glycol', 'Ethanol'],
    onset: 'Measurable follicular levels within 30 minutes of application',
  },
  follicularTargeting: {
    targeted: true,
    mechanism: 'Minoxidil sulphate acts on ATP-sensitive potassium channels in dermal papilla cells.',
    specificity: 'MODERATE',
    phase: 'ALL_PHASES',
    description: 'Preferential accumulation in the follicular infundibulum.',
  },
  applicationGuidance: {
    frequency: 'Twice daily',
    amount: '1 mL per application',
    method: 'Apply directly to dry scalp using dropper',
    timing: 'Morning and evening',
    hairStatus: 'DRY',
    coverage: 'Entire affected scalp area',
    duration: 'Continuous — benefit reverses within 6–12 months of cessation',
    notes: ['Wash hands after application', 'Allow to dry fully before styling'],
  },
  irritationRisks: {
    riskLevel: 'MODERATE',
    commonReactions: ['Contact dermatitis', 'Scalp dryness', 'Pruritus'],
    riskFactors: ['Propylene glycol intolerance', 'Sensitive scalp'],
    monitoringAdvice: 'Switch to foam if contact dermatitis occurs.',
    escalationCriteria: ['Spreading redness', 'Systemic symptoms (dizziness, hypotension)'],
  },
  inflammationModulation: {
    modulates: false,
    targets: [],
    expectedEffect: 'NEUTRAL',
    clinicalNote: 'Minoxidil has no direct anti-inflammatory activity.',
  },
  targetScalpStates: ['NORMAL_SCALP', 'DRY_SCALP', 'OILY_SCALP'],
  targetTherapyNeeds: ['FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
  contraindications: ['Pregnancy', 'Breastfeeding', 'Hypersensitivity to minoxidil'],
  pregnancySafe: false,
  mechanisms: [
    'Potassium channel activation → vasodilation → increased scalp perfusion',
    'VEGF upregulation → perifollicular angiogenesis',
    'Direct anagen prolongation',
  ],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

export const ALL_SAMPLE_TOPICALS: readonly TopicalKnowledge[] = [
  SAMPLE_MINOXIDIL_5PCT,
] as const;
