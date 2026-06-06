import type { ConditionKnowledge } from '../../types';

export const FEMALE_AGA_123: ConditionKnowledge = {
  diagnosisKey: 'AGA_FEMALE_123',
  displayName: 'Female Pattern Hair Loss (Grades 1–3)',
  shortName: 'FPHL Early-Moderate',
  icd10: 'L64.8',
  description:
    'Androgenetic alopecia in females presenting as diffuse thinning over the crown and mid-scalp ' +
    'with preservation of the frontal hairline. Grades 1–3 on the Ludwig scale.',
  clinicalDescription:
    'Female pattern hair loss (FPHL) is a non-scarring, androgen-sensitive alopecia characterised ' +
    'by progressive miniaturisation of terminal hair follicles. In grades 1–3 the frontal hairline ' +
    'is maintained while the central and mid-scalp partition shows widening and density reduction. ' +
    'Androgen receptor (AR) polymorphisms and local 5α-reductase activity drive follicular ' +
    'miniaturisation even in the presence of normal circulating androgens.',
  mechanisms: [
    {
      label: 'Follicular Miniaturisation',
      description:
        'Progressive conversion of terminal follicles to vellus follicles driven by ' +
        'dihydrotestosterone (DHT) binding to androgen receptors in dermal papilla cells.',
      pathway: 'DHT → AR binding → Wnt/β-catenin suppression → reduced IGF-1 → follicle miniaturisation',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Shortened Anagen Phase',
      description:
        'Each successive hair cycle produces a shorter anagen phase, resulting in progressively ' +
        'finer and shorter hairs that fail to achieve cosmetically visible length.',
      pathway: 'DHT → premature catagen induction → truncated anagen cycle duration',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Perifollicular Micro-inflammation',
      description:
        'Subclinical lymphocytic perifolliculitis contributes to follicle damage and accelerates ' +
        'the conversion to vellus-type follicles.',
      pathway: 'Sebum oxidation → IL-1α / TNF-α release → perifollicular fibrosis',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Reduced VEGF Signalling',
      description:
        'DHT suppresses vascular endothelial growth factor (VEGF) in dermal papilla cells, ' +
        'impairing follicular angiogenesis and nutrient delivery.',
      pathway: 'DHT → VEGF downregulation → reduced perifollicular microvasculature',
      evidenceLevel: 'MODERATE',
    },
  ],
  triggers: [
    {
      label: 'Androgenic Activity',
      description: 'Elevated DHT or heightened follicular androgen receptor sensitivity.',
      rootCause: 'DHT',
      modifiable: false,
    },
    {
      label: 'Genetic Predisposition',
      description: 'Polygenic inheritance of AR gene variants and 5α-reductase activity.',
      rootCause: 'GENETICS',
      modifiable: false,
    },
    {
      label: 'Hormonal Shifts',
      description: 'Perimenopause and menopause reduce oestrogen-mediated protection against DHT.',
      rootCause: 'HORMONAL_SHIFT',
      modifiable: false,
    },
    {
      label: 'Chronic Psychological Stress',
      description:
        'Cortisol-mediated suppression of hair cycle and worsening of androgen sensitivity.',
      rootCause: 'STRESS',
      modifiable: true,
    },
    {
      label: 'Nutritional Deficiency',
      description: 'Iron, zinc, and vitamin D deficiency amplify follicular vulnerability.',
      rootCause: 'POOR_NUTRITION',
      modifiable: true,
    },
  ],
  symptoms: [
    {
      symptom: 'Diffuse crown and mid-scalp thinning',
      onset: 'Gradual over months to years',
      severity: 'MODERATE',
      visible: true,
    },
    {
      symptom: 'Widening of central hair partition',
      onset: 'Early presenting sign',
      severity: 'MILD',
      visible: true,
    },
    {
      symptom: 'Increased hair shedding (>100 hairs/day)',
      onset: 'May coincide with hormonal fluctuations',
      severity: 'MODERATE',
      visible: false,
    },
    {
      symptom: 'Reduced hair density on scalp examination',
      onset: 'Progressive',
      severity: 'MODERATE',
      visible: true,
    },
  ],
  progression: [
    {
      stage: 1,
      label: 'Ludwig I — Minimal Thinning',
      description: 'Slight thinning at the crown visible only on close inspection. Frontal hairline intact.',
      clinicalMarkers: ['Widened mid-partition', 'Trichoscopy: miniaturised hairs ≥20% at crown'],
      reversible: true,
    },
    {
      stage: 2,
      label: 'Ludwig II — Moderate Thinning',
      description: 'Obvious thinning at crown; scalp visible through hair with normal lighting.',
      clinicalMarkers: ['Hair density <180 hairs/cm²', 'Miniaturisation ratio >30%'],
      reversible: true,
    },
    {
      stage: 3,
      label: 'Ludwig III — Marked Thinning',
      description: 'Significant crown baldness; requires cosmetic coverage. Hair still present at margins.',
      clinicalMarkers: ['Hair density <120 hairs/cm²', 'Diffuse bare crown visible'],
      reversible: false,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment: 'Shedding arrest in 70–80% of patients within 3 months with topical minoxidil.',
      withoutTreatment: 'Continued progressive miniaturisation; density loss of ~5% per year.',
      caveat: 'Shedding increase in first 4–6 weeks of minoxidil is expected and self-limiting.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment: 'Partial regrowth of vellus-to-terminal conversion in 40–60% by 6 months.',
      withoutTreatment: 'Transition from grade 2 to grade 3 likely within 2–3 years.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Sustained density maintenance in 80% with continuous treatment; full reversal unlikely at grade 3.',
      withoutTreatment: 'Irreversible follicular fibrosis and permanent baldness at crown.',
      caveat: 'Treatment must be maintained indefinitely; cessation results in relapse within 6–12 months.',
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
    {
      label: 'Breastfeeding',
      description: 'Topical minoxidil is contraindicated during breastfeeding due to systemic absorption risk.',
      severity: 'ABSOLUTE',
      affectedTherapies: ['FOLLICLE_STIMULATION'],
    },
    {
      label: 'Postural hypotension',
      description: 'Minoxidil may exacerbate hypotension; use with caution.',
      severity: 'RELATIVE',
      affectedTherapies: ['FOLLICLE_STIMULATION'],
    },
  ],
  confidenceFactors: [
    {
      factor: 'Family history of female pattern hair loss',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.85,
    },
    {
      factor: 'Ludwig pattern on clinical assessment',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.9,
    },
    {
      factor: 'Normal thyroid function confirmed',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.7,
    },
    {
      factor: 'Active shedding >150 hairs/day',
      direction: 'DECREASES_CONFIDENCE',
      weight: 0.4,
    },
    {
      factor: 'Recent acute stressor within 3 months',
      direction: 'DECREASES_CONFIDENCE',
      weight: 0.5,
    },
  ],
  relatedConditions: ['AGA_FEMALE_45', 'PCOS_ONLY', 'PCOS_OBESITY', 'PERI_MENOPAUSE', 'MENOPAUSE'],
  rootCauses: ['DHT', 'GENETICS', 'HORMONAL_SHIFT'],
  prevalence: 'Affects approximately 40% of women by age 50; prevalence rises post-menopause.',
  evidenceLevel: 'STRONG',
  references: [
    'Sinclair RD. Female pattern hair loss. Int J Dermatol. 2005.',
    'Olsen EA. Female pattern hair loss. J Am Acad Dermatol. 2001.',
    'Blume-Peytavi U et al. EDF/EADV guidelines on hair disorders. 2011.',
  ],
  lastReviewed: '2025-01-01',
};

export const FEMALE_AGA_45: ConditionKnowledge = {
  diagnosisKey: 'AGA_FEMALE_45',
  displayName: 'Female Pattern Hair Loss (Grades 4–5)',
  shortName: 'FPHL Advanced',
  icd10: 'L64.8',
  description:
    'Advanced androgenetic alopecia in females with extensive crown and vertex baldness, ' +
    'Ludwig grades 4–5. Significant follicular fibrosis likely; limited reversibility.',
  clinicalDescription:
    'Grade 4–5 FPHL represents advanced follicular exhaustion with extensive permanent miniaturisation. ' +
    'The scalp shows diffuse baldness over the crown and vertex with only a marginal fringe preserved. ' +
    'Perifollicular fibrosis reduces reversibility; aggressive intervention is required to prevent further loss.',
  mechanisms: [
    {
      label: 'Irreversible Follicular Fibrosis',
      description:
        'Long-standing perifollicular inflammation leads to fibrotic replacement of the dermal papilla, ' +
        'permanently abolishing follicular cycling.',
      pathway: 'Chronic inflammation → TGF-β1 upregulation → perifollicular fibrosis → permanent follicle loss',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Terminal Follicle Exhaustion',
      description:
        'Sustained DHT exposure depletes the follicular stem cell pool, preventing regeneration.',
      pathway: 'DHT → bulge stem cell depletion → loss of follicular regenerative capacity',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Reduced Dermal Papilla Cell Viability',
      description:
        'Chronic miniaturisation reduces the viability and signalling capacity of dermal papilla cells.',
      pathway: 'Miniaturisation → reduced DP cell count → impaired Wnt/β-catenin → anagen failure',
      evidenceLevel: 'EMERGING',
    },
  ],
  triggers: [
    {
      label: 'Androgenic Activity',
      description: 'Elevated DHT or heightened follicular androgen receptor sensitivity.',
      rootCause: 'DHT',
      modifiable: false,
    },
    {
      label: 'Genetic Predisposition',
      description: 'Strong polygenic inheritance; bilateral family history typical.',
      rootCause: 'GENETICS',
      modifiable: false,
    },
    {
      label: 'Post-menopausal oestrogen decline',
      description: 'Loss of oestrogen-mediated follicular protection accelerates grade progression.',
      rootCause: 'HORMONAL_SHIFT',
      modifiable: false,
    },
  ],
  symptoms: [
    {
      symptom: 'Extensive crown and vertex baldness',
      onset: 'Years of progressive loss',
      severity: 'SEVERE',
      visible: true,
    },
    {
      symptom: 'Thin, sparse remaining hairs over entire scalp',
      onset: 'Chronic',
      severity: 'SEVERE',
      visible: true,
    },
    {
      symptom: 'Scalp clearly visible under normal illumination',
      onset: 'Advanced disease',
      severity: 'SEVERE',
      visible: true,
    },
  ],
  progression: [
    {
      stage: 4,
      label: 'Ludwig IV — Severe Thinning',
      description: 'Baldness over entire crown and vertex; thin fringe maintained at sides.',
      clinicalMarkers: ['Hair density <80 hairs/cm²', 'Perifollicular fibrosis on trichoscopy'],
      reversible: false,
    },
    {
      stage: 5,
      label: 'Ludwig V — Near-Total Alopecia',
      description: 'Nearly complete alopecia over crown with only marginal hair band persisting.',
      clinicalMarkers: ['Hair density <40 hairs/cm²', 'Fibrotic tracts replacing follicular units'],
      reversible: false,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment: 'Shedding arrest achievable; regrowth minimal at grade 4–5.',
      withoutTreatment: 'Continued loss of marginal fringe hair.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment: 'Stabilisation in most patients; cosmetic improvement limited.',
      withoutTreatment: 'Progressive fringe recession.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Maintenance of remaining density; referral to hair transplant specialist appropriate.',
      withoutTreatment: 'Total crown alopecia; irreversible.',
      caveat: 'Hair transplant candidacy should be evaluated; knowledge engine does not replace clinical assessment.',
    },
  ],
  recommendedTherapies: [
    'SHEDDING_ARREST',
    'DHT_SUPPRESSION',
    'FOLLICLE_STIMULATION',
    'INFLAMMATION_CONTROL',
  ],
  contraindications: [
    {
      label: 'Pregnancy',
      description: 'All anti-androgen and minoxidil therapies contraindicated.',
      severity: 'ABSOLUTE',
      affectedTherapies: ['DHT_SUPPRESSION', 'HORMONAL_REBALANCING', 'FOLLICLE_STIMULATION'],
    },
  ],
  confidenceFactors: [
    {
      factor: 'Ludwig grade 4–5 confirmed on clinical assessment',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.95,
    },
    {
      factor: 'Long duration of hair loss (>5 years)',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.8,
    },
    {
      factor: 'Strong bilateral family history',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.85,
    },
  ],
  relatedConditions: ['AGA_FEMALE_123', 'POST_MENOPAUSE', 'MENOPAUSE'],
  rootCauses: ['DHT', 'GENETICS', 'HORMONAL_SHIFT'],
  prevalence: 'Advanced FPHL (grades 4–5) affects approximately 5–8% of women over 60.',
  evidenceLevel: 'STRONG',
  references: [
    'Olsen EA. Female pattern hair loss. J Am Acad Dermatol. 2001.',
    'Vujovic S et al. FPHL in postmenopause. Menopause. 2008.',
  ],
  lastReviewed: '2025-01-01',
};
