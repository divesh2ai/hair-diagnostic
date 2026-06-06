/**
 * Sample Condition Knowledge Fixtures
 *
 * Used in snapshot and regression tests.
 * These are the canonical reference values for CI assertions.
 */

import type { ConditionKnowledge } from '../types';

export const SAMPLE_FEMALE_AGA_123: ConditionKnowledge = {
  diagnosisKey: 'AGA_FEMALE_123',
  displayName: 'Female Pattern Hair Loss (Grades 1–3)',
  shortName: 'FPHL Early-Moderate',
  icd10: 'L64.8',
  description:
    'Androgenetic alopecia in females presenting as diffuse thinning over the crown and mid-scalp ' +
    'with preservation of the frontal hairline. Grades 1–3 on the Ludwig scale.',
  clinicalDescription:
    'Female pattern hair loss (FPHL) is a non-scarring, androgen-sensitive alopecia characterised ' +
    'by progressive miniaturisation of terminal hair follicles.',
  mechanisms: [
    {
      label: 'Follicular Miniaturisation',
      description:
        'Progressive conversion of terminal follicles to vellus follicles driven by DHT ' +
        'binding to androgen receptors in dermal papilla cells.',
      pathway: 'DHT → AR binding → Wnt/β-catenin suppression → reduced IGF-1 → follicle miniaturisation',
      evidenceLevel: 'STRONG',
    },
  ],
  triggers: [
    {
      label: 'Androgenic Activity',
      description: 'Elevated DHT or heightened follicular androgen receptor sensitivity.',
      rootCause: 'DHT',
      modifiable: false,
    },
  ],
  symptoms: [
    {
      symptom: 'Diffuse crown and mid-scalp thinning',
      onset: 'Gradual over months to years',
      severity: 'MODERATE',
      visible: true,
    },
  ],
  progression: [
    {
      stage: 1,
      label: 'Ludwig I — Minimal Thinning',
      description: 'Slight thinning at the crown visible only on close inspection.',
      clinicalMarkers: ['Widened mid-partition'],
      reversible: true,
    },
  ],
  prognosis: [
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment: 'Partial regrowth of vellus-to-terminal conversion in 40–60% by 6 months.',
      withoutTreatment: 'Transition from grade 2 to grade 3 likely within 2–3 years.',
    },
  ],
  recommendedTherapies: [
    'SHEDDING_ARREST',
    'DHT_SUPPRESSION',
    'FOLLICLE_STIMULATION',
    'INFLAMMATION_CONTROL',
    'METABOLIC_SUPPORT',
  ],
  contraindications: [
    {
      label: 'Pregnancy',
      description: 'Minoxidil and anti-androgen therapies are contraindicated during pregnancy.',
      severity: 'ABSOLUTE',
      affectedTherapies: ['DHT_SUPPRESSION', 'HORMONAL_REBALANCING'],
    },
  ],
  confidenceFactors: [
    {
      factor: 'Family history of female pattern hair loss',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.85,
    },
  ],
  relatedConditions: ['AGA_FEMALE_45', 'PCOS_ONLY', 'PERI_MENOPAUSE'],
  rootCauses: ['DHT', 'GENETICS', 'HORMONAL_SHIFT'],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

export const SAMPLE_TE_STRESS: ConditionKnowledge = {
  diagnosisKey: 'TE_STRESS',
  displayName: 'Stress-Induced Telogen Effluvium',
  shortName: 'TE (Stress)',
  icd10: 'L66.1',
  description:
    'Diffuse hair shedding triggered by acute or chronic psychological stress, presenting ' +
    '2–3 months after the stressor.',
  clinicalDescription:
    'Stress-induced telogen effluvium occurs when a systemic stressor triggers a premature ' +
    'shift of anagen follicles into telogen.',
  mechanisms: [
    {
      label: 'HPA Axis Activation & Cortisol Elevation',
      description:
        'Sustained cortisol elevation suppresses hair follicle stem cells and induces ' +
        'premature catagen entry via CRH receptor signalling.',
      pathway: 'Stress → HPA axis → cortisol → CRH receptors on follicle → catagen induction → telogen',
      evidenceLevel: 'MODERATE',
    },
  ],
  triggers: [
    {
      label: 'Acute Psychological Stress',
      description: 'Bereavement, relationship breakdown, work-related acute stress events.',
      rootCause: 'STRESS',
      modifiable: true,
    },
  ],
  symptoms: [
    {
      symptom: 'Diffuse hair shedding (>150 hairs/day)',
      onset: '6–12 weeks after trigger event',
      severity: 'MODERATE',
      visible: false,
    },
  ],
  progression: [
    {
      stage: 1,
      label: 'Active Effluvium',
      description: 'Ongoing heavy shedding, peak at 1–3 months post-trigger.',
      clinicalMarkers: ['Positive hair pull test', 'Telogen bulbs on shed hairs'],
      reversible: true,
    },
  ],
  prognosis: [
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Full recovery in 90%+ of acute cases with trigger resolution.',
      withoutTreatment: 'Chronic TE if stressor unaddressed.',
    },
  ],
  recommendedTherapies: ['SHEDDING_ARREST', 'INFLAMMATION_CONTROL'],
  contraindications: [],
  confidenceFactors: [
    {
      factor: 'Identifiable trigger event 2–4 months prior',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.9,
    },
  ],
  relatedConditions: ['TE_NUTRITION', 'TE_ILLNESS', 'IRON_DEFICIENCY'],
  rootCauses: ['STRESS'],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

/** All sample conditions as a readonly array — use in snapshot tests */
export const ALL_SAMPLE_CONDITIONS: readonly ConditionKnowledge[] = [
  SAMPLE_FEMALE_AGA_123,
  SAMPLE_TE_STRESS,
] as const;
