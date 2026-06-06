import type { ConditionKnowledge } from '../../types';

export const MALE_AGA_123: ConditionKnowledge = {
  diagnosisKey: 'AGA_MALE_123',
  displayName: 'Male Pattern Baldness (Grades 1–3)',
  shortName: 'MPB Early-Moderate',
  icd10: 'L64.0',
  description:
    'Androgenetic alopecia in males following the Norwood-Hamilton pattern. Grades 1–3 ' +
    'present as bitemporal recession and early vertex thinning with retained anterior density.',
  clinicalDescription:
    'Male androgenetic alopecia (MAGA) is the most common cause of hair loss in men, driven by ' +
    'genetic androgen sensitivity and 5α-reductase Type II activity converting testosterone to DHT. ' +
    'Grades 1–3 are characterised by bitemporal recession, vertex thinning beginning at the crown, ' +
    'and progressive miniaturisation. Intervention at this stage achieves the best outcomes.',
  mechanisms: [
    {
      label: '5α-Reductase Type II Conversion',
      description:
        'Type II 5α-reductase in scalp dermal papilla cells converts testosterone to DHT, ' +
        'which binds AR and suppresses growth factor signalling essential for anagen maintenance.',
      pathway: 'Testosterone → 5α-R2 → DHT → AR → suppression of IGF-1, KGF, VEGF → miniaturisation',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Follicular Miniaturisation',
      description:
        'Repeated DHT-driven shortening of the anagen phase produces progressively finer hairs ' +
        'until follicles produce only vellus-type hairs.',
      pathway: 'DHT–AR → Wnt/β-catenin inhibition → DKK-1 upregulation → premature catagen',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Perifollicular Micro-inflammation',
      description:
        'Subclinical lymphocytic infiltrate around the upper follicle and sebaceous gland ' +
        'accelerates fibrosis and miniaturisation.',
      pathway: 'Malassezia / sebum → innate immune activation → IL-1, TNF-α → perifollicular fibrosis',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Reduced VEGF & Angiogenesis',
      description:
        'DHT suppresses VEGF in dermal papilla cells, reducing perifollicular capillary density ' +
        'and impairing follicle nutrition.',
      pathway: 'DHT → reduced VEGF → perifollicular hypoxia → impaired anagen',
      evidenceLevel: 'MODERATE',
    },
  ],
  triggers: [
    {
      label: 'DHT Elevation / Androgen Sensitivity',
      description: 'High local 5α-R2 activity or elevated serum DHT drives accelerated miniaturisation.',
      rootCause: 'DHT',
      modifiable: false,
    },
    {
      label: 'Genetic Susceptibility',
      description: 'AR gene polymorphisms on X chromosome; autosomal susceptibility loci (Chr 20, Chr 7).',
      rootCause: 'GENETICS',
      modifiable: false,
    },
    {
      label: 'Seborrhoeic Scalp / Inflammation',
      description: 'Malassezia overgrowth and sebum oxidation contribute to inflammatory acceleration.',
      rootCause: 'STRESS',
      modifiable: true,
    },
  ],
  symptoms: [
    {
      symptom: 'Bitemporal hairline recession',
      onset: 'Often begins in late teens to early twenties',
      severity: 'MILD',
      visible: true,
    },
    {
      symptom: 'Vertex thinning',
      onset: 'Concurrent with or following bitemporal recession',
      severity: 'MODERATE',
      visible: true,
    },
    {
      symptom: 'Increased hair shedding on scalp and pillow',
      onset: 'May be the first patient-reported symptom',
      severity: 'MILD',
      visible: false,
    },
    {
      symptom: 'Oily or flaky scalp',
      onset: 'Concurrent; may precede visible loss',
      severity: 'MILD',
      visible: false,
    },
  ],
  progression: [
    {
      stage: 1,
      label: 'Norwood I — Minimal Recession',
      description: 'Slight bitemporal recession only; no vertex involvement. Often pre-symptomatic.',
      clinicalMarkers: ['Trichoscopy: early miniaturisation at temples'],
      reversible: true,
    },
    {
      stage: 2,
      label: 'Norwood II — Early Recession',
      description: 'Defined triangular bitemporal recessions; slight vertex thinning possible.',
      clinicalMarkers: ['Hair density reduction at temples', 'Miniaturisation ratio >20% at vertex'],
      reversible: true,
    },
    {
      stage: 3,
      label: 'Norwood III — Moderate Recession',
      description:
        'Deep temporal recession; vertex may show a separate bald patch. ' +
        'Bridge of hair between temples and vertex still present.',
      clinicalMarkers: ['Norwood IIIa: deep frontal recession', 'Norwood IIIv: vertex patch'],
      reversible: true,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment:
        'Shedding arrest in 80–90% within 3 months with finasteride or minoxidil combination.',
      withoutTreatment: 'Progression of 1 grade per 1–2 years on average.',
      caveat: 'Minoxidil may cause transient shedding increase in first 6 weeks.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment:
        'Vertex regrowth in 65% with finasteride 1 mg at 12 months (PLESS trial data).',
      withoutTreatment: 'Bridge between temporal recession and vertex narrows.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment:
        'Sustained density maintenance with finasteride; combination with minoxidil improves outcomes.',
      withoutTreatment: 'Norwood grade 5–7 by age 50 in genetically susceptible individuals.',
      caveat: 'Finasteride sexual side effects in <2% of patients; reversible on cessation.',
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
      label: 'Planning fatherhood (near-term)',
      description:
        'Finasteride is teratogenic to male foetuses; women of childbearing potential must not handle ' +
        'broken tablets. Male patients planning conception should discuss risk with prescriber.',
      severity: 'CAUTION',
      affectedTherapies: ['DHT_SUPPRESSION'],
    },
    {
      label: 'Prostate cancer history',
      description:
        'Finasteride/dutasteride lower PSA; may mask prostate cancer screening. ' +
        'Urologist review required.',
      severity: 'RELATIVE',
      affectedTherapies: ['DHT_SUPPRESSION'],
    },
  ],
  confidenceFactors: [
    {
      factor: 'Male sex with Norwood pattern',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.9,
    },
    {
      factor: 'Family history of male baldness (maternal or paternal)',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.85,
    },
    {
      factor: 'Onset before age 30',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.8,
    },
    {
      factor: 'Normal ferritin and thyroid function',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.7,
    },
  ],
  relatedConditions: ['AGA_MALE_45', 'SCALP_INFLAM', 'OXIDATIVE'],
  rootCauses: ['DHT', 'GENETICS'],
  prevalence: 'Affects 50% of men by age 50; 80% by age 70.',
  evidenceLevel: 'STRONG',
  references: [
    'Kaufman KD. Finasteride 1 mg for MAGA. J Am Acad Dermatol. 2002.',
    'Bernstein RM et al. Norwood classification. Dermatol Surg. 2001.',
    'Whiting DA. Diagnostic and predictive value of horizontal sections of scalp biopsy. J Am Acad Dermatol. 1993.',
  ],
  lastReviewed: '2025-01-01',
};

export const MALE_AGA_45: ConditionKnowledge = {
  diagnosisKey: 'AGA_MALE_45',
  displayName: 'Male Pattern Baldness (Grades 4–5)',
  shortName: 'MPB Advanced',
  icd10: 'L64.0',
  description:
    'Advanced androgenetic alopecia in males; Norwood grades 4–5. Significant vertex and frontal ' +
    'baldness with a remaining horseshoe fringe. Follicular fibrosis limits regrowth potential.',
  clinicalDescription:
    'Grades 4–5 represent moderate-to-severe MAGA with coalescence of temporal and vertex baldness. ' +
    'The remaining hair forms a horseshoe-shaped fringe. Perifollicular fibrosis in the bald zones ' +
    'precludes significant regrowth; medical therapy aims at stabilisation and fringe preservation.',
  mechanisms: [
    {
      label: 'Follicular Fibrosis and Stem Cell Depletion',
      description:
        'Prolonged DHT exposure depletes the bulge stem cell population and replaces the ' +
        'perifollicular dermis with fibrotic connective tissue.',
      pathway: 'Chronic DHT → stem cell exhaustion → TGF-β1 fibrosis → irreversible follicle loss',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Dermal Papilla Cell Loss',
      description:
        'The dermal papilla cell (DPC) cluster shrinks progressively; below a critical threshold, ' +
        'follicular regeneration ceases.',
      pathway: 'Miniaturisation → DPC apoptosis → loss of inductive capacity → permanent alopecia',
      evidenceLevel: 'MODERATE',
    },
  ],
  triggers: [
    {
      label: 'DHT Elevation / Androgen Sensitivity',
      description: 'Continued high DHT exposure in susceptible follicular zones.',
      rootCause: 'DHT',
      modifiable: false,
    },
    {
      label: 'Genetic Susceptibility',
      description: 'Strong polygenic predisposition driving early and severe expression.',
      rootCause: 'GENETICS',
      modifiable: false,
    },
  ],
  symptoms: [
    {
      symptom: 'Large bald patch joining temporal recession and vertex',
      onset: 'Progressed from earlier grades',
      severity: 'SEVERE',
      visible: true,
    },
    {
      symptom: 'Horseshoe fringe only remaining',
      onset: 'Grade 5+',
      severity: 'SEVERE',
      visible: true,
    },
  ],
  progression: [
    {
      stage: 4,
      label: 'Norwood IV — Moderate Baldness',
      description: 'Frontal recession and vertex patch separated by narrow bridge of hair.',
      clinicalMarkers: ['Dense remaining fringe', 'Bridge <3 cm width'],
      reversible: false,
    },
    {
      stage: 5,
      label: 'Norwood V — Moderate-Severe Baldness',
      description: 'Temporal and vertex areas connected; only thin bridge remaining.',
      clinicalMarkers: ['Bridge remnant only', 'Extensive bald plateau'],
      reversible: false,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment: 'Shedding stabilisation; minimal regrowth in bald zones.',
      withoutTreatment: 'Continued loss of fringe hair; progression to grade 6–7.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Fringe preservation is the primary goal; hair transplant evaluation recommended.',
      withoutTreatment: 'Near-total scalp baldness (Norwood VI–VII) within 5–10 years.',
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
      label: 'Prostate cancer / PSA monitoring',
      description: '5α-reductase inhibitors suppress PSA; urological monitoring required.',
      severity: 'RELATIVE',
      affectedTherapies: ['DHT_SUPPRESSION'],
    },
  ],
  confidenceFactors: [
    {
      factor: 'Norwood grade 4–5 on clinical grading',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.95,
    },
    {
      factor: 'Duration of hair loss >5 years',
      direction: 'INCREASES_CONFIDENCE',
      weight: 0.8,
    },
  ],
  relatedConditions: ['AGA_MALE_123'],
  rootCauses: ['DHT', 'GENETICS'],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};
