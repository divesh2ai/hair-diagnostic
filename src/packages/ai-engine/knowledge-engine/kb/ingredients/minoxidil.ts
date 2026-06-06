import type { IngredientKnowledge } from '../../types';

export const MINOXIDIL: IngredientKnowledge = {
  ingredientId: 'minoxidil',
  displayName: 'Minoxidil',
  aliases: ['Rogaine', 'Regaine', 'minoxidilum', '2,4-diamino-6-piperidinopyrimidine 3-oxide'],
  category: 'VASODILATOR',
  mechanismsOfAction: [
    'Potassium channel opener: activates ATP-sensitive potassium channels in vascular smooth muscle, ' +
      'inducing arteriolar vasodilation and increasing scalp perfusion.',
    'VEGF upregulation: sulphated minoxidil metabolite (minoxidil sulphate) stimulates vascular ' +
      'endothelial growth factor expression in dermal papilla cells, promoting perifollicular angiogenesis.',
    'Prolongation of anagen: minoxidil delays catagen entry and extends the anagen growth phase, ' +
      'increasing the proportion of terminal hairs.',
    'Potassium channel opening in follicle: K+ channel activation in the dermal papilla may directly ' +
      'stimulate follicular cell proliferation and growth factor release.',
  ],
  targetedNeeds: ['FOLLICLE_STIMULATION', 'SHEDDING_ARREST'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Multiple large RCTs confirm efficacy of topical minoxidil 5% (men) and 2–5% (women) ' +
    'for AGA. The Upjohn phase III trial (n=984) showed 45% of men using 5% reported moderate-to-dense ' +
    'regrowth at 48 weeks vs 7% placebo. Oral minoxidil (0.25–1.25 mg/day) shows superior compliance ' +
    'and comparable efficacy in emerging RCTs.',
  contraindications: [
    'Pregnancy (systemic absorption risk; Category C teratogen in animal studies)',
    'Breastfeeding (excreted in breast milk)',
    'Hypersensitivity to minoxidil or propylene glycol vehicle',
    'Postural hypotension or pre-existing severe hypotension',
    'Concurrent antihypertensive medication (additive hypotensive effect)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '5% topical solution or foam, 1 mL twice daily to affected scalp (men)',
    minimum: '2% topical for women',
    maximum: '5% topical for women or 2.5 mg oral',
    unit: 'mL topical / mg oral',
    frequency: 'Twice daily (topical); once daily (oral)',
    notes:
      'Topical must contact scalp, not hair shaft. Application to dry scalp. ' +
      'Oral minoxidil preferred for improved adherence; initiate at 0.25 mg/day and titrate.',
  },
  interactions: [
    {
      ingredient: 'Finasteride',
      type: 'SYNERGISTIC',
      note:
        'Combination addresses both DHT-mediated miniaturisation (finasteride) and follicle ' +
        'stimulation (minoxidil); additive benefit demonstrated in RCTs.',
    },
    {
      ingredient: 'Dutasteride',
      type: 'SYNERGISTIC',
      note: 'Stronger DHT suppression combined with minoxidil vasodilation for advanced AGA.',
    },
    {
      ingredient: 'Ketoconazole',
      type: 'SYNERGISTIC',
      note:
        'Anti-inflammatory and mild DHT-inhibitory properties of ketoconazole complement ' +
        'minoxidil vasodilation.',
    },
    {
      ingredient: 'Antihypertensives',
      type: 'ANTAGONISTIC',
      note: 'Additive hypotensive effect; blood pressure monitoring required.',
    },
  ],
  sideEffects: [
    'Transient increased shedding in first 4–6 weeks (normal; resolves spontaneously)',
    'Scalp irritation or contact dermatitis (often due to propylene glycol vehicle)',
    'Hypertrichosis (excess facial/body hair) — more common with solution formulation',
    'Scalp dryness or flaking',
    'Systemic hypotension (rare with topical; higher risk with oral)',
    'Fluid retention and peripheral oedema (oral, dose-dependent)',
    'Tachycardia and palpitations (oral; rare at low doses)',
  ],
  onsetOfAction:
    'Shedding arrest: 4–8 weeks. Visible regrowth: 3–6 months. ' +
    'Maximum benefit: 12–18 months of continuous use.',
  references: [
    'Olsen EA et al. A randomized clinical trial of 5% topical minoxidil. J Am Acad Dermatol. 2002.',
    'Sinclair RD et al. Minoxidil: mechanisms of action. J Dermatol Sci. 2011.',
    'Randolph M & Tosti A. Oral minoxidil. J Am Acad Dermatol. 2021.',
  ],
};

export const FINASTERIDE: IngredientKnowledge = {
  ingredientId: 'finasteride',
  displayName: 'Finasteride',
  aliases: ['Propecia', 'Proscar (5 mg)', 'MK-906'],
  category: 'DHT_INHIBITOR',
  mechanismsOfAction: [
    'Type II 5α-reductase inhibition: competitively and irreversibly inhibits the Type II isoform ' +
      'of 5α-reductase, the predominant isoform in scalp dermal papilla cells, reducing local DHT by ~60–70%.',
    'Serum DHT reduction: reduces serum DHT by 60–70%, reducing systemic androgenic drive to susceptible follicles.',
    'Preservation of anagen: by lowering intra-follicular DHT, restores Wnt/β-catenin signalling ' +
      'and IGF-1 production, prolonging the anagen phase.',
  ],
  targetedNeeds: ['DHT_SUPPRESSION', 'SHEDDING_ARREST'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Pivotal 2-year RCT (Finasteride Male Pattern Hair Loss Study Group, n=1,553) demonstrated ' +
    '83% of finasteride 1 mg/day patients maintained or increased hair count vs 28% placebo. ' +
    'PLESS extension trial showed benefit maintained over 5 years. Limited evidence in women (off-label).',
  contraindications: [
    'Pregnancy (Category X teratogen: may cause male foetal genital abnormalities)',
    'Women of childbearing potential not using reliable contraception',
    'Known hypersensitivity to finasteride',
    'Severe hepatic impairment (finasteride is hepatically metabolised)',
    'Prostate cancer — use with caution; discuss PSA monitoring',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '1 mg oral once daily',
    maximum: '5 mg oral once daily (benign prostatic hyperplasia dosing)',
    unit: 'mg',
    frequency: 'Once daily',
    notes:
      'Must be taken continuously; benefit is lost within 6–12 months of cessation. ' +
      'PSA baseline recommended before initiation in males >40 years.',
  },
  interactions: [
    {
      ingredient: 'Minoxidil',
      type: 'SYNERGISTIC',
      note: 'Combination addresses both DHT axis (finasteride) and follicle blood flow (minoxidil).',
    },
    {
      ingredient: 'Dutasteride',
      type: 'ANTAGONISTIC',
      note: 'Redundant; dutasteride inhibits both Type I and II 5α-reductase — do not co-administer.',
    },
  ],
  sideEffects: [
    'Sexual dysfunction (decreased libido, erectile dysfunction): <2% of patients; reversible on cessation',
    'Post-finasteride syndrome (rare, disputed): persistent sexual/cognitive effects after cessation',
    'Breast tenderness or gynaecomastia (<1%)',
    'Reduced PSA levels — affects prostate cancer screening interpretation',
    'Depression (rare; reported in post-marketing surveillance)',
  ],
  onsetOfAction:
    'DHT reduction: within days. Shedding arrest: 3–6 months. Visible regrowth: 6–12 months. ' +
    'Maximum benefit: 18–24 months.',
  references: [
    'Finasteride Male Pattern Hair Loss Study Group. NEJM. 1998.',
    'Kaufman KD et al. Long-term treatment with finasteride. J Am Acad Dermatol. 2002.',
  ],
};

export const DUTASTERIDE: IngredientKnowledge = {
  ingredientId: 'dutasteride',
  displayName: 'Dutasteride',
  aliases: ['Avodart', 'GG745'],
  category: 'DHT_INHIBITOR',
  mechanismsOfAction: [
    'Dual Type I and II 5α-reductase inhibition: inhibits both isoforms, reducing serum DHT by 90–95% ' +
      '(vs 60–70% with finasteride). Type I inhibition provides additional scalp DHT suppression.',
    'Superior follicular DHT reduction: broader isoform coverage results in greater intra-follicular ' +
      'DHT suppression than finasteride.',
  ],
  targetedNeeds: ['DHT_SUPPRESSION', 'SHEDDING_ARREST'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Phase III RCT (0.5 mg dutasteride vs finasteride 1 mg, n=917) showed superior hair count ' +
    'increase with dutasteride at 24 weeks. Approved for AGA in South Korea and Japan. ' +
    'Off-label in most markets for hair loss.',
  contraindications: [
    'Pregnancy (Category X)',
    'Women of childbearing potential',
    'Known hypersensitivity to dutasteride',
    'Prostate cancer — affects PSA monitoring',
    'Severe hepatic impairment',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '0.5 mg oral once daily',
    unit: 'mg',
    frequency: 'Once daily',
    notes:
      'Long half-life (~5 weeks); remains in blood for up to 6 months after cessation. ' +
      'Blood donation not permitted within 6 months of last dose.',
  },
  interactions: [
    {
      ingredient: 'Minoxidil',
      type: 'SYNERGISTIC',
      note: 'Combined DHT suppression and vasodilation for aggressive AGA management.',
    },
    {
      ingredient: 'Finasteride',
      type: 'ANTAGONISTIC',
      note: 'Redundant and not recommended; dutasteride covers all 5α-reductase isoforms.',
    },
  ],
  sideEffects: [
    'Sexual dysfunction: comparable to finasteride; slightly higher rate due to greater DHT suppression',
    'Prolonged PSA suppression',
    'Breast tenderness / gynaecomastia',
    'Very long elimination half-life: effects persist months after discontinuation',
  ],
  onsetOfAction: 'DHT suppression: within days. Hair benefit: 6–12 months. Maximum effect: 18–24 months.',
  references: [
    'Olsen EA et al. The importance of dual 5α-reductase inhibition. J Am Acad Dermatol. 2006.',
    'Harcha WG et al. A randomized comparison of dutasteride vs finasteride for male AGA. J Am Acad Dermatol. 2014.',
  ],
};

export const KETOCONAZOLE: IngredientKnowledge = {
  ingredientId: 'ketoconazole',
  displayName: 'Ketoconazole',
  aliases: ['Nizoral', 'Ketozal'],
  category: 'ANTIFUNGAL',
  mechanismsOfAction: [
    'Antifungal: inhibits ergosterol synthesis via CYP51 inhibition, reducing Malassezia ' +
      'colonisation on the scalp and associated inflammatory response.',
    'Anti-inflammatory: reduces scalp cytokine production (IL-1α, TNF-α) associated with ' +
      'Malassezia-driven perifolliculitis.',
    'Mild DHT inhibition: ketoconazole has weak anti-androgenic activity via partial ' +
      'inhibition of adrenal and gonadal 17,20-lyase and inhibition of DHT receptor binding.',
  ],
  targetedNeeds: ['INFLAMMATION_CONTROL', 'DHT_SUPPRESSION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Small RCT (Piérard-Franchimont et al., 1998) showed ketoconazole 2% shampoo ' +
    'comparable to minoxidil 2% for hair density after 6 months. Frequently used as ' +
    'adjunct therapy rather than monotherapy.',
  contraindications: [
    'Oral ketoconazole contraindicated (hepatotoxicity risk); topical use is safe',
    'Known hypersensitivity to ketoconazole',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '2% shampoo 2–3 times per week',
    unit: 'mL shampoo',
    frequency: '2–3 times per week',
    notes:
      'Leave on scalp for 3–5 minutes before rinsing. Can be alternated with regular shampoo. ' +
      'Avoid oral formulations for hair loss due to systemic hepatotoxicity risk.',
  },
  interactions: [
    {
      ingredient: 'Minoxidil',
      type: 'SYNERGISTIC',
      note: 'Scalp inflammation reduction complements minoxidil follicle stimulation.',
    },
  ],
  sideEffects: [
    'Scalp dryness or irritation',
    'Hair texture changes (reversible)',
    'Mild scalp burning on first use',
  ],
  onsetOfAction: 'Antifungal effect: 2–4 weeks. Hair density improvement: 3–6 months.',
  references: [
    'Piérard-Franchimont C et al. Ketoconazole shampoo for MAGA. Dermatology. 1998.',
  ],
};
