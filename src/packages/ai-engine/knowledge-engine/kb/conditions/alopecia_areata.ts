import type { ConditionKnowledge } from '../../types';

export const ALOPECIA_AREATA: ConditionKnowledge = {
  diagnosisKey: 'ALOPECIA_AREATA',
  displayName: 'Alopecia Areata',
  shortName: 'AA',
  icd10: 'L63',
  description:
    'Autoimmune non-scarring hair loss caused by collapse of the hair-follicle immune privilege ' +
    'and CD8+ NKG2D+ T-cell attack on anagen-phase follicles. Typically presents as discrete ' +
    'round or oval patches and can extend to alopecia totalis (entire scalp) or universalis ' +
    '(scalp plus body). Follicular architecture is preserved in classical non-scarring forms — ' +
    'regrowth is biologically possible.',
  clinicalDescription:
    'Alopecia areata is an organ-specific autoimmune disorder. Anagen-bulb keratinocytes ' +
    'upregulate MHC class I and NKG2D ligands (MICA, ULBP3) under interferon-gamma exposure, ' +
    'losing the protective immune-privileged status that normally shields the bulb from immune ' +
    'surveillance. CD8+ NKG2D+ effector T cells are recruited via CXCL9/10/11 chemokine ' +
    'gradients and execute peribulbar attack producing the characteristic "swarm of bees" ' +
    'histology. An IL-15-mediated amplification loop between bulb keratinocytes and ' +
    'lymphocytes maintains the lesion. Hair follicle stem cells in the bulge are typically ' +
    'spared in classical non-scarring AA, which is why regrowth remains biologically possible. ' +
    'Course is relapsing-remitting; comorbid autoimmunity (Hashimoto thyroiditis, vitiligo, ' +
    'atopy) is common.',
  mechanisms: [
    {
      label: 'Follicular Immune Privilege Collapse',
      description:
        'The anagen hair bulb normally maintains immune privilege via low MHC class I expression ' +
        'and active immunosuppressive signaling. Under IFN-γ exposure this protective state ' +
        'collapses, exposing bulb antigens to surveillance.',
      pathway: 'IFN-γ → MHC class I upregulation → bulb antigen presentation → immune surveillance',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'CD8+ NKG2D+ Cytotoxic Attack',
      description:
        'NKG2D ligands MICA and ULBP3 are induced on follicular epithelium under stress and IFN-γ. ' +
        'CD8+ NKG2D+ effector T cells engage these ligands and execute cytotoxic attack on the ' +
        'anagen bulb — the "swarm of bees" histologic finding.',
      pathway: 'MICA/ULBP3 induction → NKG2D ligation → CD8+ T-cell cytotoxicity on anagen bulb',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'IFN-γ / JAK-STAT Axis',
      description:
        'IFN-γ signals through JAK1/2 → STAT1, driving expression of CXCL9, CXCL10, and CXCL11 ' +
        'chemokines that recruit additional T cells perifollicularly. This axis is the actionable ' +
        'therapeutic target for JAK inhibitors in moderate-severe disease.',
      pathway: 'IFN-γ → JAK1/2 → STAT1 → CXCL9/CXCL10/CXCL11 → further T-cell recruitment',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'IL-15 Amplification Loop',
      description:
        'IL-15 produced by bulb keratinocytes and infiltrating T cells maintains the cytotoxic ' +
        'environment via positive-feedback signaling. Blocking IL-15 is an emerging therapeutic ' +
        'strategy.',
      pathway: 'IL-15 ↔ CD8+ T-cell positive-feedback loop',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Regulatory T-cell Insufficiency',
      description:
        'FOXP3+ regulatory T cells normally suppress autoreactive responses. In active AA the Treg ' +
        'compartment is functionally insufficient, permitting autoreactive CD8+ persistence.',
      pathway: 'Treg insufficiency → loss of peripheral tolerance',
      evidenceLevel: 'MODERATE',
    },
    {
      label: 'Hair Follicle Stem Cell Sparing',
      description:
        'Bulge-resident K15+/LGR5+ hair follicle stem cells are generally spared in classical ' +
        'non-scarring AA, preserving the regenerative capacity of the follicle. This is why ' +
        'regrowth remains biologically possible — even after extended disease — provided the ' +
        'immune attack resolves.',
      pathway: 'Bulge HFSC preservation → reversibility of cycle shutdown',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Forced Catagen Entry',
      description:
        'Affected anagen follicles are driven into premature catagen by the immune attack, ' +
        'producing the synchronized shedding within active patches. Cycle re-entry is possible ' +
        'once immune activity resolves.',
      pathway: 'Cytotoxic stress → premature catagen → telogen → potential anagen re-entry',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Melanocyte Targeting',
      description:
        'Pigment-producing melanocytes are early targets of the immune attack — explaining the ' +
        'initially white or unpigmented regrowth that is often seen as patches begin to recover.',
      pathway: 'Melanocyte cytotoxicity → pigment incontinence → white regrowth phase',
      evidenceLevel: 'STRONG',
    },
  ],
  triggers: [
    {
      label: 'Genetic Susceptibility',
      description: 'HLA-DQB1*03 and HLA-DRB1*04 alleles; PTPN22, ULBP loci; family history common.',
      rootCause: 'AUTOIMMUNE',
      modifiable: false,
    },
    {
      label: 'Viral / Vaccine Immune Perturbation',
      description: 'CMV, EBV, SARS-CoV-2 implicated in onset and flare; rare reports following vaccination.',
      rootCause: 'AUTOIMMUNE',
      modifiable: false,
    },
    {
      label: 'Psychological Stress',
      description:
        'Sympathetic and HPA-axis activation cross-talks with skin immune compartment; CRH and ' +
        'substance P can disrupt follicular immune privilege.',
      rootCause: 'STRESS',
      modifiable: true,
    },
    {
      label: 'Comorbid Autoimmunity',
      description: 'Hashimoto thyroiditis, Graves disease, vitiligo, atopic dermatitis frequently coexist.',
      rootCause: 'AUTOIMMUNE',
      modifiable: false,
    },
    {
      label: 'Vitamin D Insufficiency',
      description:
        'Immunomodulatory role for vitamin D; deficiency associates with severity and treatment ' +
        'resistance in AA cohorts.',
      rootCause: 'POOR_NUTRITION',
      modifiable: true,
    },
  ],
  symptoms: [
    { symptom: 'Discrete round or oval hair-loss patches', onset: 'Sudden over days to weeks', severity: 'MODERATE', visible: true },
    { symptom: 'Exclamation-mark hairs at patch periphery', onset: 'Concurrent with patch', severity: 'MILD', visible: true },
    { symptom: 'Yellow dots and black dots on trichoscopy', onset: 'Concurrent', severity: 'MILD', visible: true },
    { symptom: 'Nail pitting (trachyonychia)', onset: 'Variable; ~30% of cases', severity: 'MILD', visible: true },
    { symptom: 'Eyebrow / eyelash involvement', onset: 'Variable; indicates broader disease', severity: 'MODERATE', visible: true },
    { symptom: 'Alopecia totalis or universalis', onset: 'Late or aggressive disease', severity: 'SEVERE', visible: true },
    { symptom: 'Psychological distress and anxiety', onset: 'Concurrent with visible loss', severity: 'MODERATE', visible: false },
  ],
  progression: [
    {
      stage: 1,
      label: 'Patchy AA',
      description: 'Discrete round/oval patches involving ≤ 50% of the scalp; classical presentation.',
      clinicalMarkers: ['Coin-sized patches', 'Exclamation hairs at edges', 'Preserved follicular ostia'],
      reversible: true,
    },
    {
      stage: 2,
      label: 'Extensive AA',
      description: '> 50% scalp involvement; SALT-graded; lower spontaneous regrowth rate.',
      clinicalMarkers: ['Multiple confluent patches', 'SALT score > 50'],
      reversible: true,
    },
    {
      stage: 3,
      label: 'Alopecia Totalis',
      description: 'Complete or near-complete loss of scalp hair.',
      clinicalMarkers: ['Total scalp involvement', 'Preserved follicular ostia (non-scarring)'],
      reversible: true,
    },
    {
      stage: 4,
      label: 'Alopecia Universalis',
      description: 'Complete loss of scalp, body, and facial hair.',
      clinicalMarkers: ['Total body involvement', 'Eyebrow and eyelash loss'],
      reversible: true,
    },
    {
      stage: 5,
      label: 'Ophiasis Pattern',
      description: 'Band-like temporal–occipital pattern; lower regrowth prognosis.',
      clinicalMarkers: ['Posterior occipital band', 'Treatment-resistant pattern'],
      reversible: true,
    },
  ],
  prognosis: [
    {
      timeframe: 'SHORT_TERM',
      withTreatment: 'Patch stabilisation often within 2–3 months; early regrowth possible (often white initially).',
      withoutTreatment: 'Spontaneous remission within 12 months in many patchy cases; relapse is common.',
      caveat: 'Extensive disease, ophiasis pattern, nail involvement, and onset under 10 years of age predict reduced regrowth.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      withTreatment: 'Repigmentation of regrown hair over 12–24 weeks; SALT score reduction.',
      withoutTreatment: 'Variable course; relapse-remitting in 30–50% of cases.',
    },
    {
      timeframe: 'LONG_TERM',
      withTreatment: 'Sustained remission possible; recurrent flares require ongoing management. Moderate-severe cases benefit from JAK-inhibitor consideration under dermatology.',
      withoutTreatment: 'Risk of progression to totalis/universalis in subset of patients.',
    },
  ],
  recommendedTherapies: [
    'IMMUNE_MODULATION',
    'ANTIOXIDANT_SUPPORT',
    'CIRCADIAN_RESET',
    'FOLLICLE_STIMULATION',
  ],
  contraindications: [
    {
      label: 'Concurrent Immunosuppression',
      description: 'Concurrent immunosuppressant medication requires clinical supervision before adding immune-modulating supplements.',
      severity: 'CAUTION',
      affectedTherapies: ['IMMUNE_MODULATION'],
    },
    {
      label: 'Pregnancy',
      description: 'Several AA-kit ingredients (curcumin, melatonin at high dose, kelp) require pregnancy review.',
      severity: 'RELATIVE',
      affectedTherapies: ['IMMUNE_MODULATION', 'ANTIOXIDANT_SUPPORT'],
    },
  ],
  confidenceFactors: [
    { factor: 'Discrete round/oval patch with exclamation hairs', direction: 'INCREASES_CONFIDENCE', weight: 0.95 },
    { factor: 'Preserved follicular ostia on dermoscopy', direction: 'INCREASES_CONFIDENCE', weight: 0.90 },
    { factor: 'Comorbid thyroid autoimmunity', direction: 'INCREASES_CONFIDENCE', weight: 0.60 },
    { factor: 'Nail pitting', direction: 'INCREASES_CONFIDENCE', weight: 0.55 },
    { factor: 'Loss of follicular ostia', direction: 'DECREASES_CONFIDENCE', weight: 0.90 },
    { factor: 'Strict pattern distribution (Norwood / Ludwig)', direction: 'DECREASES_CONFIDENCE', weight: 0.80 },
    { factor: 'Diffuse shedding without patches', direction: 'DECREASES_CONFIDENCE', weight: 0.70 },
  ],
  relatedConditions: ['SCALP_INFLAM', 'CHRONIC_MEDICAL'],
  rootCauses: ['AUTOIMMUNE', 'STRESS', 'OXIDATIVE_STRESS'],
  prevalence:
    'Lifetime prevalence approximately 2% globally; onset peaks in second and third decades but ' +
    'can occur at any age. Comorbid autoimmune disease in 15–25% of patients.',
  evidenceLevel: 'STRONG',
  references: [
    'Pratt CH et al. Alopecia areata. Nat Rev Dis Primers 2017;3:17011',
    'King BA et al. Two phase 3 trials of baricitinib for alopecia areata. N Engl J Med 2022',
    'Gilhar A et al. Alopecia areata: animal models illuminate immune privilege. JID Symp 2013',
  ],
  lastReviewed: '2026-06-05',
};
