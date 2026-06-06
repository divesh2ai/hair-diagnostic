import type { ConditionKnowledge } from '../../types';

export const TE_STRESS: ConditionKnowledge = {
  diagnosisKey: 'TE_STRESS',
  displayName: 'Stress-Induced Telogen Effluvium',
  shortName: 'TE (Stress)',
  icd10: 'L66.1',
  description:
    'Diffuse hair shedding triggered by acute or chronic psychological stress, presenting ' +
    '2–3 months after the stressor as the affected follicles synchronously enter telogen.',
  clinicalDescription:
    'Stress-induced telogen effluvium occurs when a systemic stressor triggers a premature ' +
    'shift of anagen follicles into telogen. The classic lag of 6–12 weeks reflects the ' +
    'duration of the telogen phase before the hair is shed. Cortisol-mediated catecholamine ' +
    'release and substance-P signalling are implicated. The condition is typically self-limiting ' +
    'once the stressor is resolved, but may persist in chronic stress states.',
  mechanisms: [
    {
      label: 'HPA Axis Activation & Cortisol Elevation',
      description:
        'Sustained cortisol elevation suppresses hair follicle stem cells and induces ' +
        'premature catagen entry via CRH receptor signalling in the follicular epithelium.',
      pathway: 'Stress → HPA axis → cortisol → CRH receptors on follicle → catagen induction → telogen',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Substance P Neurogenic Signalling',
      description:
        'Substance P released from perifollicular nerve fibres during stress inhibits hair ' +
        'growth and promotes mast cell activation around the follicle.',
      pathway: 'Sympathetic activation → substance P → mast cell degranulation → follicle growth arrest',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Telogen Phase Synchronisation',
      description:
        'Large numbers of follicles enter telogen simultaneously following a systemic trigger, ' +
        'producing a clinically visible shed 6–12 weeks later.',
      pathway: 'Trigger event → synchronous catagen → synchronous telogen → synchronous shedding',
      evidenceLevel: 'STRONG',
    },
  ],
  triggers: [
    {
      label: 'Acute Psychological Stress',
      description: 'Bereavement, relationship breakdown, work-related acute stress events.',
      rootCause: 'STRESS',
      modifiable: true,
    },
    {
      label: 'Chronic Psychological Stress',
      description: 'Sustained cortisol elevation maintaining follicles in telogen.',
      rootCause: 'STRESS',
      modifiable: true,
    },
    {
      label: 'Post-illness / Physiological Stress',
      description:
        'Fever, surgery, or systemic illness acts as a physiological stress trigger.',
      rootCause: 'ILLNESS',
      modifiable: false,
    },
  ],
  symptoms: [
    {
      symptom: 'Diffuse hair shedding (>150 hairs/day)',
      onset: '6–12 weeks after trigger event',
      severity: 'MODERATE',
      visible: false,
    },
    {
      symptom: 'Hair loss on washing and styling',
      onset: 'Concurrent with active effluvium',
      severity: 'MODERATE',
      visible: false,
    },
    {
      symptom: 'Overall reduced hair density',
      onset: 'Becomes apparent 3–6 months after trigger',
      severity: 'MODERATE',
      visible: true,
    },
    {
      symptom: 'Telogen hairs with intact bulb on pull test',
      onset: 'During active phase',
      severity: 'MILD',
      visible: false,
    },
  ],
  progression: [
    {
      stage: 1,
      label: 'Active Effluvium',
      description: 'Ongoing heavy shedding, peak at 1–3 months post-trigger.',
      clinicalMarkers: ['Positive hair pull test (>6 hairs per pull)', 'Telogen bulbs on shed hairs'],
      reversible: true,
    },
    {
      stage: 2,
      label: 'Recovery Phase',
      description: 'Shedding slows; new anagen hairs visible as short regrowth.',
      clinicalMarkers: ['Reduced pull test', 'Visible short hairs at scalp', 'Improved density'],
      reversible: true,
    },
    {
      stage: 3,
      label: 'Chronic Telogen Effluvium',
      description: 'Persistent shedding >6 months usually due to unresolved stressor or secondary cause.',
      clinicalMarkers: ['Ongoing elevated shedding', 'Reduced ferritin often co-existing'],
      reversible: true,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment: 'Shedding reduction within 4–8 weeks with stress management and nutritional support.',
      withoutTreatment: 'Shedding continues at peak for 1–3 months.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment: 'Significant regrowth by 6 months; density near-normal by 9 months.',
      withoutTreatment: 'Natural resolution expected in 6–9 months if trigger resolved.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Full recovery in 90%+ of acute cases with trigger resolution.',
      withoutTreatment: 'Chronic TE if stressor unaddressed; may persist for years.',
      caveat: 'TE may unmask underlying AGA; ongoing hair thinning after recovery warrants re-evaluation.',
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
    {
      factor: 'Diffuse shedding pattern (not patterned)',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.85,
    },
    {
      factor: 'Positive tug test with telogen bulbs',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.8,
    },
    {
      factor: 'Normal ferritin and thyroid',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.7,
    },
    {
      factor: 'No patterned recession or thinning',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.75,
    },
  ],
  relatedConditions: ['TE_NUTRITION', 'TE_ILLNESS', 'TE_POSTPREG', 'IRON_DEFICIENCY'],
  rootCauses: ['STRESS'],
  prevalence: 'Most common form of diffuse alopecia; exact prevalence unknown; affects all ages.',
  evidenceLevel: 'STRONG',
  references: [
    'Headington JT. Telogen effluvium. Arch Dermatol. 1993.',
    'Rebora A. Telogen effluvium: a comprehensive review. Clin Cosmet Investig Dermatol. 2019.',
  ],
  lastReviewed: '2025-01-01',
};

export const TE_NUTRITION: ConditionKnowledge = {
  diagnosisKey: 'TE_NUTRITION',
  displayName: 'Nutritional Deficiency Telogen Effluvium',
  shortName: 'TE (Nutrition)',
  icd10: 'L66.1',
  description:
    'Diffuse hair shedding secondary to deficiencies in iron, zinc, protein, biotin, or ' +
    'vitamin D that impair follicular metabolic function and prolong telogen.',
  clinicalDescription:
    'The hair follicle is a metabolically active structure highly sensitive to nutritional ' +
    'deprivation. Iron deficiency is the most common nutritional driver of TE, as ferritin ' +
    'acts as an iron store for follicular mitosis. Zinc deficiency impairs keratin synthesis; ' +
    'protein restriction reduces amino acid availability for shaft production. ' +
    'Nutritional TE is reversible with supplementation and dietary correction.',
  mechanisms: [
    {
      label: 'Iron Deficiency — Reduced Follicular Mitosis',
      description:
        'Iron is a cofactor in ribonucleotide reductase, the rate-limiting enzyme of DNA synthesis. ' +
        'Low ferritin (<30 ng/mL) impairs the rapid cell division required by the hair matrix.',
      pathway: 'Low ferritin → impaired ribonucleotide reductase → reduced matrix cell division → shorter anagen',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Zinc Deficiency — Keratin Synthesis Impairment',
      description:
        'Zinc is required for 5α-reductase activity, keratin assembly, and protein synthesis in the hair cortex.',
      pathway: 'Low zinc → impaired keratin polymerisation → structural shaft weakness → increased shedding',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Protein / Amino Acid Restriction',
      description:
        'Hair is ~95% keratin; severe protein restriction diverts amino acids from hair to vital organs, ' +
        'causing follicle energy failure and telogen entry.',
      pathway: 'Protein restriction → reduced cysteine/methionine → keratin synthesis failure → telogen entry',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Vitamin D Deficiency',
      description:
        'Vitamin D receptors are expressed in hair follicle keratinocytes; VDR signalling is required ' +
        'for anagen initiation. Deficiency prolongs telogen.',
      pathway: 'Low 25(OH)D → reduced VDR signalling → impaired anagen re-entry',
      evidenceLevel: 'EMERGING',
    },
  ],
  triggers: [
    {
      label: 'Iron Deficiency / Low Ferritin',
      description: 'Most common nutritional cause; ferritin <30 ng/mL associated with hair loss.',
      rootCause: 'IRON_DEFICIENCY',
      modifiable: true,
    },
    {
      label: 'Restrictive Dieting / Rapid Weight Loss',
      description: 'Crash diets and very low calorie diets deplete protein and micronutrient stores.',
      rootCause: 'RAPID_WEIGHT_LOSS',
      modifiable: true,
    },
    {
      label: 'Vegetarian / Vegan Diet Without Supplementation',
      description: 'Plant-based diets may lack bioavailable iron, zinc, and B12.',
      rootCause: 'POOR_NUTRITION',
      modifiable: true,
    },
    {
      label: 'Gut Malabsorption',
      description: 'Conditions such as coeliac disease or IBD reduce mineral and vitamin absorption.',
      rootCause: 'GUT_MALABSORPTION',
      modifiable: false,
    },
  ],
  symptoms: [
    {
      symptom: 'Diffuse shedding',
      onset: 'Gradual; may be insidious without acute event',
      severity: 'MODERATE',
      visible: false,
    },
    {
      symptom: 'Brittle hair shaft with increased breakage',
      onset: 'Concurrent with shedding',
      severity: 'MILD',
      visible: false,
    },
    {
      symptom: 'Fatigue, pallor (if iron deficient)',
      onset: 'Systemic signs may accompany hair loss',
      severity: 'MODERATE',
      visible: false,
    },
  ],
  progression: [
    {
      stage: 1,
      label: 'Latent Deficiency',
      description: 'Depleted stores without overt shedding; trichoscopy may show increased variability.',
      clinicalMarkers: ['Ferritin <30 ng/mL', 'No obvious shedding yet'],
      reversible: true,
    },
    {
      stage: 2,
      label: 'Active Effluvium',
      description: 'Clinically apparent diffuse shedding with measurable density loss.',
      clinicalMarkers: ['Ferritin <20 ng/mL', 'Pull test positive', 'Reduced density'],
      reversible: true,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment: 'Shedding reduction within 6–8 weeks of nutritional correction.',
      withoutTreatment: 'Continued shedding proportional to deficiency severity.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment: 'Significant regrowth by 4–6 months; ferritin normalisation required.',
      withoutTreatment: 'Chronic shedding; risk of secondary AGA unmasking.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Full recovery in 85%+ with nutritional repletion and dietary correction.',
      withoutTreatment: 'Persistent deficiency leads to chronic TE and potential permanent thinning.',
    },
  ],
  recommendedTherapies: ['SHEDDING_ARREST', 'IRON_REPLETION', 'METABOLIC_SUPPORT'],
  contraindications: [
    {
      label: 'Haemochromatosis',
      description: 'Iron supplementation contraindicated in hereditary haemochromatosis.',
      severity: 'ABSOLUTE',
      affectedTherapies: ['IRON_REPLETION'],
    },
  ],
  confidenceFactors: [
    {
      factor: 'Ferritin <30 ng/mL confirmed on blood test',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.9,
    },
    {
      factor: 'Restrictive diet or recent weight loss >5 kg',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.8,
    },
    {
      factor: 'Diffuse pattern without recession',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.75,
    },
  ],
  relatedConditions: ['TE_STRESS', 'IRON_DEFICIENCY', 'GUT_ISSUES', 'WEIGHT_LOSS'],
  rootCauses: ['IRON_DEFICIENCY', 'POOR_NUTRITION', 'GUT_MALABSORPTION'],
  evidenceLevel: 'STRONG',
  references: [
    'Rushton DH. Nutritional factors and hair loss. Clin Exp Dermatol. 2002.',
    'Trost LB et al. The diagnosis and treatment of iron deficiency and its potential relationship to hair loss. J Am Acad Dermatol. 2006.',
  ],
  lastReviewed: '2025-01-01',
};
