/**
 * Sample Ingredient Knowledge Fixtures
 */

import type { IngredientKnowledge } from '../types';

export const SAMPLE_MINOXIDIL: IngredientKnowledge = {
  ingredientId: 'minoxidil',
  displayName: 'Minoxidil',
  aliases: ['Rogaine', 'Regaine'],
  category: 'VASODILATOR',
  mechanismsOfAction: [
    'Potassium channel opener: activates ATP-sensitive potassium channels, inducing vasodilation.',
    'VEGF upregulation: promotes perifollicular angiogenesis.',
    'Prolongation of anagen phase.',
  ],
  targetedNeeds: ['FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Multiple large RCTs confirm efficacy of topical minoxidil 5% for AGA.',
  contraindications: ['Pregnancy', 'Breastfeeding', 'Postural hypotension'],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '5% topical solution, 1 mL twice daily',
    unit: 'mL',
    frequency: 'Twice daily',
  },
  interactions: [
    {
      ingredient: 'Finasteride',
      type: 'SYNERGISTIC',
      note: 'Addresses both DHT axis and follicle stimulation.',
    },
  ],
  sideEffects: ['Transient increased shedding (first 4–6 weeks)', 'Scalp irritation'],
  onsetOfAction: 'Visible regrowth: 3–6 months.',
};

export const SAMPLE_FINASTERIDE: IngredientKnowledge = {
  ingredientId: 'finasteride',
  displayName: 'Finasteride',
  aliases: ['Propecia'],
  category: 'DHT_INHIBITOR',
  mechanismsOfAction: [
    'Type II 5α-reductase inhibition: reduces scalp and serum DHT by 60–70%.',
    'Preservation of anagen by restoring Wnt/β-catenin signalling.',
  ],
  targetedNeeds: ['DHT_SUPPRESSION', 'SHEDDING_ARREST'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Pivotal RCT (n=1,553) showed 83% maintained or increased hair count at 2 years.',
  contraindications: ['Pregnancy (Category X)', 'Women of childbearing potential'],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '1 mg oral once daily',
    unit: 'mg',
    frequency: 'Once daily',
  },
  interactions: [
    {
      ingredient: 'Minoxidil',
      type: 'SYNERGISTIC',
      note: 'Combination of DHT suppression and vasodilation.',
    },
  ],
  sideEffects: ['Sexual dysfunction (<2%)', 'Breast tenderness (<1%)'],
  onsetOfAction: 'Hair benefit: 6–12 months.',
};

export const ALL_SAMPLE_INGREDIENTS: readonly IngredientKnowledge[] = [
  SAMPLE_MINOXIDIL,
  SAMPLE_FINASTERIDE,
] as const;
