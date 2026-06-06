import type { TopicalKnowledge } from '../../types';

export const MINOXIDIL_5PCT: TopicalKnowledge = {
  topicalId: 'minoxidil_5pct',
  displayName: 'Minoxidil 5% Topical Solution',
  formulation: 'Topical solution (propylene glycol vehicle)',
  activeIngredients: ['Minoxidil 5%'],
  ingredientIds: ['minoxidil'],
  scalpPenetration: {
    depth: 'FOLLICULAR',
    mechanism:
      'Passive diffusion through the follicular opening; the lipophilic follicular pathway ' +
      'concentrates minoxidil at the dermal papilla. Propylene glycol vehicle enhances penetration ' +
      'by disrupting stratum corneum lipid bilayers.',
    enhancers: ['Propylene glycol', 'Ethanol (vehicle component)'],
    onset: 'Measurable follicular levels within 30 minutes of application',
  },
  follicularTargeting: {
    targeted: true,
    mechanism:
      'Minoxidil sulphate (active metabolite produced by sulphotransferase in the outer root sheath) ' +
      'acts directly on ATP-sensitive potassium channels in dermal papilla cells.',
    specificity: 'MODERATE',
    phase: 'ALL_PHASES',
    description:
      'Preferential accumulation in the follicular infundibulum; dermal papilla cells ' +
      'receive minoxidil via direct follicular penetration and perifollicular vasculature.',
  },
  applicationGuidance: {
    frequency: 'Twice daily',
    amount: '1 mL per application',
    method: 'Apply directly to dry scalp using dropper; distribute over affected area',
    timing: 'Morning and evening, minimum 8 hours apart',
    hairStatus: 'DRY',
    coverage: 'Entire affected scalp area, not hair shaft',
    duration: 'Continuous use; do not discontinue — benefit reverses within 6–12 months',
    notes: [
      'Wash hands immediately after application',
      'Allow to dry fully (2–4 hours) before styling or bed',
      'Foam formulation preferred if scalp sensitivity or dermatitis to propylene glycol',
      'Avoid contact with face, eyes, and broken skin',
    ],
  },
  irritationRisks: {
    riskLevel: 'MODERATE',
    commonReactions: [
      'Contact dermatitis (often due to propylene glycol vehicle, not minoxidil itself)',
      'Scalp dryness and flaking',
      'Pruritus at application site',
    ],
    riskFactors: [
      'Pre-existing eczema or sensitive scalp',
      'Propylene glycol intolerance',
      'Broken or abraded scalp skin',
    ],
    monitoringAdvice:
      'Switch to foam formulation if contact dermatitis occurs — foam is propylene-glycol-free. ' +
      'Persistent irritation warrants dermatology review.',
    escalationCriteria: [
      'Spreading redness or weeping beyond application site',
      'Systemic symptoms (dizziness, hypotension)',
      'Failure to resolve with formulation change',
    ],
  },
  inflammationModulation: {
    modulates: false,
    targets: [],
    expectedEffect: 'NEUTRAL',
    clinicalNote:
      'Minoxidil itself has no direct anti-inflammatory activity. VEGF upregulation may ' +
      'indirectly reduce ischaemia-related follicular stress.',
  },
  targetScalpStates: ['NORMAL_SCALP', 'DRY_SCALP', 'OILY_SCALP'],
  targetTherapyNeeds: ['FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
  contraindications: [
    'Pregnancy and breastfeeding',
    'Known hypersensitivity to minoxidil or propylene glycol',
    'Inflamed, irritated, or broken scalp skin (defer application)',
    'Concomitant antihypertensive medication (additive hypotension)',
  ],
  pregnancySafe: false,
  mechanisms: [
    'ATP-sensitive potassium channel activation → arteriolar vasodilation → increased scalp perfusion',
    'VEGF upregulation → perifollicular angiogenesis',
    'Direct anagen prolongation via potassium channel activation in dermal papilla cells',
  ],
  evidenceLevel: 'STRONG',
  lastReviewed: '2025-01-01',
};

export const MINOXIDIL_FINASTERIDE_COMBO: TopicalKnowledge = {
  topicalId: 'minoxidil_finasteride_topical',
  displayName: 'Minoxidil 5% + Finasteride 0.1% Topical Solution',
  formulation: 'Topical solution (alcohol-based vehicle)',
  activeIngredients: ['Minoxidil 5%', 'Finasteride 0.1%'],
  ingredientIds: ['minoxidil', 'finasteride'],
  scalpPenetration: {
    depth: 'FOLLICULAR',
    mechanism:
      'Dual-component penetration via follicular pathway. Topical finasteride at 0.1% achieves ' +
      'local scalp DHT suppression (~60%) with minimal systemic absorption, reducing systemic ' +
      'side effect risk compared to oral finasteride.',
    enhancers: ['Ethanol vehicle', 'Follicular pathway delivery'],
    onset: 'Scalp DHT reduction measurable within 2 hours of application',
  },
  follicularTargeting: {
    targeted: true,
    mechanism:
      'Finasteride acts on Type II 5α-reductase in the outer root sheath and dermal papilla. ' +
      'Minoxidil sulphate acts on potassium channels in the dermal papilla. ' +
      'Both components deliver via the follicular infundibulum.',
    specificity: 'HIGH',
    phase: 'ALL_PHASES',
    description:
      'Combination targets both the androgenic miniaturisation pathway (finasteride) ' +
      'and the vasodilatory follicle stimulation pathway (minoxidil) at the follicular level.',
  },
  applicationGuidance: {
    frequency: 'Once or twice daily',
    amount: '1 mL per application',
    method: 'Apply to dry scalp; distribute with fingertips over the affected zone',
    timing: 'Evening application preferred; once-daily use acceptable for maintenance',
    hairStatus: 'DRY',
    coverage: 'Affected scalp region — typically crown and vertex (male) or central partition (female)',
    duration: 'Continuous long-term use; cessation leads to rebound loss',
    notes: [
      'Systemic finasteride absorption from 0.1% topical is 50–70% lower than oral 1 mg — ' +
        'reduced systemic side effect profile',
      'Women of childbearing potential: use with caution; do not use if pregnant or planning pregnancy',
      'Allow to dry before sleep to avoid transfer to pillow',
    ],
  },
  irritationRisks: {
    riskLevel: 'MODERATE',
    commonReactions: [
      'Alcohol-base dryness',
      'Scalp erythema',
      'Mild irritation in first 2–4 weeks',
    ],
    riskFactors: ['Sensitive scalp', 'Concurrent scalp inflammation'],
    monitoringAdvice: 'Use once daily if twice-daily causes irritation. Discontinue if persistent.',
    escalationCriteria: [
      'Significant scalp erythema or eczematous reaction',
      'Systemic side effects (libido change, gynecomastia)',
    ],
  },
  inflammationModulation: {
    modulates: false,
    targets: [],
    expectedEffect: 'NEUTRAL',
    clinicalNote: 'No direct anti-inflammatory activity from either component at topical doses.',
  },
  targetScalpStates: ['NORMAL_SCALP', 'OILY_SCALP'],
  targetTherapyNeeds: ['FOLLICLE_STIMULATION', 'DHT_SUPPRESSION', 'SHEDDING_ARREST'],
  contraindications: [
    'Pregnancy (finasteride is Category X)',
    'Women of childbearing potential without contraception',
    'Known hypersensitivity to either ingredient',
  ],
  pregnancySafe: false,
  mechanisms: [
    'Topical finasteride 0.1%: Type II 5α-reductase inhibition → scalp DHT suppression ~60%',
    'Minoxidil 5%: VEGF upregulation + potassium channel activation → anagen prolongation',
    'Dual-pathway combination: superior to monotherapy for moderate-severe AGA',
  ],
  evidenceLevel: 'MODERATE',
  lastReviewed: '2025-01-01',
};

export const KETOCONAZOLE_SHAMPOO: TopicalKnowledge = {
  topicalId: 'ketoconazole_shampoo_2pct',
  displayName: 'Ketoconazole 2% Medicated Shampoo',
  formulation: 'Medicated shampoo',
  activeIngredients: ['Ketoconazole 2%'],
  ingredientIds: ['ketoconazole'],
  scalpPenetration: {
    depth: 'EPIDERMAL',
    mechanism:
      'Ketoconazole penetrates into the stratum corneum and upper epidermis during the ' +
      '3–5 minute contact time. Limited dermal penetration with shampoo use; ' +
      'sufficient for antifungal and surface anti-inflammatory effect.',
    enhancers: ['Contact time (3–5 min dwell time)', 'Shampoo vehicle surfactants'],
    onset: 'Surface antifungal effect within first applications',
  },
  follicularTargeting: {
    targeted: false,
    mechanism: 'Indirect: reduction of Malassezia colonisation reduces perifollicular inflammation.',
    specificity: 'LOW',
    phase: 'ALL_PHASES',
    description:
      'Ketoconazole does not directly target follicular structures but reduces the ' +
      'inflammatory microenvironment that contributes to follicular damage and seborrhoeic scalp conditions.',
  },
  applicationGuidance: {
    frequency: '2–3 times per week',
    amount: 'Sufficient to lather scalp',
    method: 'Apply to wet scalp; massage into scalp (not primarily hair)',
    timing: 'During shower; leave on scalp 3–5 minutes before rinsing',
    hairStatus: 'DAMP',
    coverage: 'Full scalp',
    duration: 'Long-term use for maintenance; can alternate with regular shampoo',
    notes: [
      'Focus application on scalp rather than hair length',
      'Can be used as maintenance 1× per week once condition controlled',
      'Compatible with other topical treatments applied after shampooing',
    ],
  },
  irritationRisks: {
    riskLevel: 'LOW',
    commonReactions: [
      'Scalp dryness with excessive use',
      'Mild burning sensation on first use',
      'Hair texture changes (reversible)',
    ],
    riskFactors: ['Existing scalp eczema or psoriasis', 'Daily use (excessive frequency)'],
    monitoringAdvice: 'Reduce to once weekly if scalp dryness occurs.',
    escalationCriteria: [
      'Contact dermatitis spreading beyond scalp',
      'No improvement in seborrhoeic dermatitis after 4 weeks',
    ],
  },
  inflammationModulation: {
    modulates: true,
    mechanism:
      'Eradication of Malassezia removes a key driver of scalp IL-1α and TNF-α production. ' +
      'Ketoconazole also has direct anti-inflammatory properties via CYP-mediated ' +
      'leukotriene and thromboxane synthesis inhibition.',
    targets: ['Malassezia furfur', 'IL-1α', 'TNF-α', 'Perifollicular lymphocytic infiltrate'],
    expectedEffect: 'REDUCES',
    clinicalNote:
      'Seborrhoeic dermatitis and Malassezia-associated scalp inflammation are significant ' +
      'co-factors in AGA acceleration and TE. Reducing scalp inflammation is a disease-modifying adjunct.',
  },
  targetScalpStates: ['DANDRUFF', 'OILY_SCALP', 'INFLAMED_SCALP', 'NORMAL_SCALP'],
  targetTherapyNeeds: ['INFLAMMATION_CONTROL'],
  contraindications: [
    'Known hypersensitivity to ketoconazole',
    'Avoid oral ketoconazole (hepatotoxicity; not relevant for shampoo)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  mechanisms: [
    'Ergosterol synthesis inhibition → Malassezia eradication → reduced scalp inflammation',
    'Direct anti-inflammatory: leukotriene and prostaglandin pathway inhibition',
    'Mild androgen receptor competition at scalp level',
  ],
  evidenceLevel: 'MODERATE',
  lastReviewed: '2025-01-01',
};
