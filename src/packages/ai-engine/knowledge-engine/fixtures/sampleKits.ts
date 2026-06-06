/**
 * Sample Kit Knowledge Fixtures
 *
 * These stubs are for regression testing purposes.
 * Real kit entries will be populated when the KITS_KB registry is filled.
 */

import type { KitKnowledge } from '../types';

export const SAMPLE_AGA_CORE_KIT: KitKnowledge = {
  kitId: 'AGA_CORE_MALE',
  displayName: 'AGA Core Kit (Male)',
  shortName: 'AGA Core M',
  category: 'Androgenetic Alopecia',
  description:
    'Foundation kit for male AGA grades 1–3 targeting DHT suppression and follicle stimulation.',
  clinicalRationale:
    'Combines topical DHT inhibition (finasteride) with vasodilatory follicle stimulation ' +
    '(minoxidil) to address both primary mechanisms of androgenetic alopecia.',
  targetDiagnoses: ['AGA_MALE_123', 'AGA_MALE_45'],
  targetTherapyNeeds: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
  components: [
    {
      type: 'TOPICAL',
      productId: 'minoxidil_finasteride_topical',
      displayName: 'Minoxidil 5% + Finasteride 0.1% Topical',
      role: 'Primary DHT suppression and follicle stimulation',
      optional: false,
    },
    {
      type: 'TOPICAL',
      productId: 'ketoconazole_shampoo_2pct',
      displayName: 'Ketoconazole 2% Shampoo',
      role: 'Scalp inflammation control',
      optional: true,
    },
  ],
  keyIngredients: ['minoxidil', 'finasteride', 'ketoconazole'],
  contraindications: ['Pregnancy', 'Women of childbearing potential without contraception'],
  pregnancySafe: false,
  expectedOutcomes: [
    'Shedding arrest within 3–6 months',
    'Vertex regrowth in 65% at 12 months',
    'Sustained density maintenance with continuous use',
  ],
  timeToEffect: '3–6 months for shedding arrest; 6–12 months for regrowth',
  phaseCompatibility: [1, 2],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

export const ALL_SAMPLE_KITS: readonly KitKnowledge[] = [SAMPLE_AGA_CORE_KIT] as const;
