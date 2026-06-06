/**
 * Kit Knowledge Base — Registry Index
 *
 * Structured kit composition + clinical rationale + target diagnoses, therapy
 * needs, ingredients, contraindications, expected outcomes, and time-to-effect.
 *
 * Bridges Kit → keyIngredients (resolvable to kb/ingredients/*.ts) →
 * mechanism → biomarker → pathway → root cause.
 *
 * Source: All Kits Info.docx + PROTOCOL_SEQUENCER rationale strings +
 * KIT_EXPLANATIONS prose. No new biology introduced.
 */

import type { KitKnowledgeRegistry } from '../../types';

export const KITS_KB: KitKnowledgeRegistry = {
  // ───────────────────────────────────────────────────────────────────────────
  // PHASE-1 SHEDDING ARREST
  // ───────────────────────────────────────────────────────────────────────────
  'HAIR FACT TE GOLD': {
    kitId: 'HAIR FACT TE GOLD',
    displayName: 'Hair Fact TE Gold',
    shortName: 'TE Gold',
    category: 'shedding-arrest',
    description:
      'Telogen effluvium stabilization formula. Arrests active shedding via HPA-axis cortisol ' +
      'modulation, micronutrient repletion, and anti-inflammatory cytokine modulation.',
    clinicalRationale:
      'Phase 1 (non-negotiable) of TE protocols. Stops the synchronized catagen signal driving ' +
      'shedding so subsequent regrowth-supportive phases can be effective. Combines adaptogenic ' +
      'cortisol control with substrate (iron, B-complex, amino acids), IGF-1/VEGF stimulation ' +
      '(kelp, vitamin C), and gut-absorption support.',
    targetDiagnoses: ['TE_STRESS', 'TE_NUTRITION', 'TE_POSTPREG', 'TE_DELIVERY', 'TE_ILLNESS'],
    targetTherapyNeeds: [
      'SHEDDING_ARREST',
      'INFLAMMATION_CONTROL',
      'IRON_REPLETION',
      'CIRCADIAN_RESET',
      'METABOLIC_SUPPORT',
    ],
    components: [
      { type: 'ORAL', productId: 'te_gold_capsule', displayName: 'TE Gold capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'ashwagandha',
      'lactoferrin',
      'colostrum',
      'biotin',
      'zinc',
      'vitamin_d3',
      'vitamin_c',
      'curcumin',
      'kelp_extract',
      'moringa_oleifera',
      'melatonin',
      'l_lysine',
      'l_leucine',
      'l_isoleucine',
      'tryptophan',
      'lactobacillus',
      'bioperine',
      'fenugreek',
      'gymnema',
    ],
    contraindications: ['Pregnancy', 'Hyperthyroidism', 'Concurrent immunosuppressants'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Noticeable reduction in daily shed count within 6–10 weeks',
      'Negative pull test by 12 weeks',
      'Improved ferritin where iron-deficient at baseline',
      'Improved sleep and reduced subjective stress',
    ],
    timeToEffect: '6–12 weeks',
    phaseCompatibility: [1, 2],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // PHASE-2 INFLAMMATION CLEARANCE
  // ───────────────────────────────────────────────────────────────────────────
  'PHENOTYPE INFLAMATION': {
    kitId: 'PHENOTYPE INFLAMATION',
    displayName: 'Phenotype Inflammation',
    shortName: 'Phenotype Inflammation',
    category: 'inflammation-control',
    description:
      'Broad-spectrum scalp and systemic anti-inflammatory formula. Targets NF-κB-mediated ' +
      'cytokine cascade driving perifollicular inflammation.',
    clinicalRationale:
      'NF-κB pathway inhibition + TNF-α/IL-6 downregulation via curcumin-piperine, quercetin, ' +
      'NAC, and omega-3. Reduces inflammatory amplification of DHT-driven miniaturization in AGA ' +
      'and dampens stress-driven perifollicular inflammation in TE.',
    targetDiagnoses: ['SCALP_INFLAM', 'AGA_MALE_123', 'AGA_MALE_45', 'AGA_FEMALE_123', 'AGA_FEMALE_45', 'TE_STRESS'],
    targetTherapyNeeds: ['INFLAMMATION_CONTROL', 'ANTIOXIDANT_SUPPORT', 'IMMUNE_MODULATION', 'CIRCADIAN_RESET'],
    components: [
      { type: 'ORAL', productId: 'phenotype_inflammation_capsule', displayName: 'Phenotype Inflammation capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'curcumin',
      'nac',
      'resveratrol',
      'vitamin_d3',
      'colostrum',
      'kelp_extract',
      'mushroom_extract',
      'beta_sitosterol',
      'ginseng',
      'stinging_nettle',
      'coq10',
      'vitamin_c',
      'zinc',
      'ashwagandha',
      'l_tyrosine',
      'mulberry_extract',
      'bioperine',
    ],
    contraindications: ['Pregnancy', 'Active bile duct obstruction', 'Concurrent anticoagulants at high curcumin dose'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Reduced scalp redness and pruritus within 4–8 weeks',
      'Reduced inflammatory markers (hs-CRP modest)',
      'Improved scalp environment supporting subsequent growth phases',
    ],
    timeToEffect: '4–8 weeks',
    phaseCompatibility: [2, 3],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // ANDROGEN MODULATION
  // ───────────────────────────────────────────────────────────────────────────
  'MPHL': {
    kitId: 'MPHL',
    displayName: 'Male Pattern Hair Loss Formula',
    shortName: 'MPHL',
    category: 'pattern-loss',
    description:
      'Male-specific formula targeting DHT modulation, follicle rejuvenation, and metabolic ' +
      'correction. Layered onto inflammatory clearance (Phenotype Inflammation) and immune ' +
      'rebuild (Pro Immune Gold) in advanced cases.',
    clinicalRationale:
      'Phyto-modulation of 5α-reductase (beta-sitosterol, pumpkin seed oil, MSM, saw palmetto where ' +
      'present), mitochondrial support (CoQ10, NMN), antioxidant defense (NAC, quercetin), and ' +
      'structural substrate (horsetail, NEM, brewer\'s yeast). Designed to layer with topical ' +
      'Dutasteride/Redensyl/Caffeine (F-Emugrow MCRD or equivalent).',
    targetDiagnoses: ['AGA_MALE_123', 'AGA_MALE_45'],
    targetTherapyNeeds: [
      'DHT_SUPPRESSION',
      'INFLAMMATION_CONTROL',
      'FOLLICLE_STIMULATION',
      'METABOLIC_SUPPORT',
      'ANTIOXIDANT_SUPPORT',
    ],
    components: [
      { type: 'ORAL', productId: 'mphl_capsule', displayName: 'MPHL capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'beta_sitosterol',
      'msm',
      'pumpkin_seed_oil',
      'nmn',
      'coq10',
      'nac',
      'quercetin',
      'horsetail_extract',
      'lactoferrin',
      'colostrum',
      'vitamin_d3',
      'iron_bisglycinate',
      'nem',
      'brewers_yeast',
      'omega_3',
      'ashwagandha',
      'l_tyrosine',
      'lactobacillus',
      'amla',
      'bioperine',
    ],
    contraindications: ['Pregnancy', 'Sitosterolemia (rare)'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Reduced progression of hairline recession and vertex thinning',
      'Improved hair density in thinning areas over 3–6 months',
      'Reduced scalp oiliness from androgenic activity',
    ],
    timeToEffect: '3–6 months',
    phaseCompatibility: [3, 4],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },

  'FPHL': {
    kitId: 'FPHL',
    displayName: 'Female Pattern Hair Loss Formula',
    shortName: 'FPHL',
    category: 'pattern-loss',
    description:
      'Female-specific androgenetic modulation formula. Targets miniaturization while ' +
      'preserving estrogen balance.',
    clinicalRationale:
      'Mild androgen modulation via beta-sitosterol and stinging nettle (SHBG-elevating) with ' +
      'NAC for hormonal balance and oxidative support. Layered onto inflammation clearance and ' +
      'metabolic correction in multifactorial female AGA presentations.',
    targetDiagnoses: ['AGA_FEMALE_123', 'AGA_FEMALE_45'],
    targetTherapyNeeds: [
      'DHT_SUPPRESSION',
      'HORMONAL_REBALANCING',
      'INFLAMMATION_CONTROL',
      'ANTIOXIDANT_SUPPORT',
    ],
    components: [
      { type: 'ORAL', productId: 'fphl_capsule', displayName: 'FPHL capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'beta_sitosterol',
      'stinging_nettle',
      'nac',
      'vitamin_d3',
      'lactoferrin',
      'colostrum',
      'coq10',
      'quercetin',
      'horsetail_extract',
      'iron_bisglycinate',
      'omega_3',
      'ashwagandha',
      'magnesium',
      'lactobacillus',
      'bioperine',
    ],
    contraindications: ['Pregnancy', 'Estrogen-sensitive cancers'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Reduced progression of diffuse crown thinning',
      'Improved hair density and diameter over 3–6 months',
      'More balanced hormonal environment supporting follicle health',
    ],
    timeToEffect: '3–6 months',
    phaseCompatibility: [3, 4],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // IMMUNE / OXIDATIVE REBUILD
  // ───────────────────────────────────────────────────────────────────────────
  'PRO IMMUNE GOLD': {
    kitId: 'PRO IMMUNE GOLD',
    displayName: 'Pro Immune Gold',
    shortName: 'Pro Immune Gold',
    category: 'immune-rebuild',
    description:
      'Comprehensive booster formula combining DPC proliferation support, antioxidant defense, ' +
      'stress/sleep regulation, and gut-axis restoration.',
    clinicalRationale:
      'Multi-system foundation. EGF-mediated DPC proliferation (colostrum, lactoferrin), ' +
      'antioxidant defense (vitamin C/D, pine bark, CoQ10, EGCG, resveratrol), stress and ' +
      'sleep regulation (ashwagandha, L-theanine, L-tyrosine, melatonin, valerian, chamomile), ' +
      'and gut microbiome support (lactobacillus, bioperine, digestive enzymes).',
    targetDiagnoses: ['ALOPECIA_AREATA', 'TE_ILLNESS', 'AGA_MALE_45', 'SCALP_INFLAM'],
    targetTherapyNeeds: [
      'IMMUNE_MODULATION',
      'INFLAMMATION_CONTROL',
      'ANTIOXIDANT_SUPPORT',
      'CIRCADIAN_RESET',
      'GUT_RESTORATION',
    ],
    components: [
      { type: 'ORAL', productId: 'pro_immune_gold_capsule', displayName: 'Pro Immune Gold capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'colostrum',
      'lactoferrin',
      'vitamin_c',
      'vitamin_d3',
      'pine_bark_extract',
      'l_theanine',
      'l_tyrosine',
      'ashwagandha',
      'melatonin',
      'valerian_root',
      'chamomile',
      'coq10',
      'green_tea_egcg',
      'mushroom_extract',
      'resveratrol',
      'lactobacillus',
      'bioperine',
      'digestive_enzymes',
    ],
    contraindications: ['Pregnancy (some components)', 'Severe immunocompromise (probiotic)', 'Active autoimmune flare without clinical supervision'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Improved energy and reduced fatigue within 2–4 weeks',
      'Better sleep quality and reduced stress PRO within 4 weeks',
      'Reduced systemic inflammation; improved scalp resilience by 8–12 weeks',
    ],
    timeToEffect: '4–12 weeks',
    phaseCompatibility: [1, 4, 5],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // METABOLIC / HORMONAL
  // ───────────────────────────────────────────────────────────────────────────
  'PRO FACT META B': {
    kitId: 'PRO FACT META B',
    displayName: 'Pro Fact Meta B',
    shortName: 'Meta B',
    category: 'metabolic',
    description:
      'Metabolic and hormonal stabilization formula for peri/post-menopausal women and ' +
      'metabolic-dysfunction profiles.',
    clinicalRationale:
      'Hormonal balance via ashwagandha (phyto-estrogenic) and milk thistle (mild ER-β activity); ' +
      'androgen modulation via beta-sitosterol; antioxidant + oxidative balance via NAC; ' +
      'DPC support via colostrum and lactoferrin; sleep regulation via melatonin and magnesium.',
    targetDiagnoses: ['PERI_MENOPAUSE', 'MENOPAUSE', 'POST_MENOPAUSE', 'METABOLIC', 'AGA_FEMALE_123', 'AGA_FEMALE_45'],
    targetTherapyNeeds: [
      'HORMONAL_REBALANCING',
      'METABOLIC_SUPPORT',
      'DHT_SUPPRESSION',
      'CIRCADIAN_RESET',
      'IRON_REPLETION',
    ],
    components: [
      { type: 'ORAL', productId: 'pro_fact_meta_b_capsule', displayName: 'Pro Fact Meta B capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'ashwagandha',
      'beta_sitosterol',
      'milk_thistle',
      'vitamin_d3',
      'nac',
      'colostrum',
      'lactoferrin',
      'melatonin',
      'magnesium',
      'iron_bisglycinate',
    ],
    contraindications: ['Pregnancy', 'Estrogen-sensitive cancers', 'Active hyperthyroidism'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Reduced peri-menopausal symptoms within 4–6 weeks',
      'Improved hair density 8–12 weeks',
      'Improved sleep and reduced hot flashes',
    ],
    timeToEffect: '4–12 weeks',
    phaseCompatibility: [3, 4],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },

  'PRO FACT META B PCOS': {
    kitId: 'PRO FACT META B PCOS',
    displayName: 'Pro Fact Meta B PCOS',
    shortName: 'Meta B PCOS',
    category: 'pcos',
    description:
      'PCOS-specific formula combining insulin sensitization, androgen suppression, ' +
      'anti-inflammatory action, and stress regulation.',
    clinicalRationale:
      'AMPK/insulin correction via myo-inositol and resveratrol; androgen suppression via ' +
      'beta-sitosterol and stinging nettle; anti-inflammatory action via curcumin and NAC; ' +
      'metabolic support via mulberry, garcinia, gymnema; stress regulation via melatonin, ' +
      'L-tyrosine, magnesium.',
    targetDiagnoses: ['PCOS_ONLY', 'PCOS_OBESITY'],
    targetTherapyNeeds: [
      'HORMONAL_REBALANCING',
      'METABOLIC_SUPPORT',
      'DHT_SUPPRESSION',
      'INFLAMMATION_CONTROL',
      'CIRCADIAN_RESET',
    ],
    components: [
      { type: 'ORAL', productId: 'pro_fact_meta_b_pcos_capsule', displayName: 'Pro Fact Meta B PCOS capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'myo_inositol',
      'beta_sitosterol',
      'stinging_nettle',
      'resveratrol',
      'curcumin',
      'nac',
      'vitamin_d3',
      'melatonin',
      'l_tyrosine',
      'magnesium',
      'mulberry_extract',
      'garcinia_cambogia',
      'gymnema',
      'fenugreek',
      'bioperine',
    ],
    contraindications: ['Pregnancy', 'Concurrent sulfonylureas without monitoring', 'Estrogen-sensitive cancers'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Reduced hair fall and oiliness within 4–6 weeks',
      'Improved cycle regularity 6–10 weeks',
      'Improved HOMA-IR and free testosterone over 12 weeks',
    ],
    timeToEffect: '6–16 weeks',
    phaseCompatibility: [2, 3, 4],
    evidenceLevel: 'STRONG',
    lastReviewed: '2026-06-05',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // AUTOIMMUNE
  // ───────────────────────────────────────────────────────────────────────────
  'HAIR FACT ALOPECIA AREATA': {
    kitId: 'HAIR FACT ALOPECIA AREATA',
    displayName: 'Hair Fact Alopecia Areata',
    shortName: 'AA Kit',
    category: 'autoimmune',
    description:
      'Immune-modulation and follicular-resilience formula for alopecia areata. Adjunctive to ' +
      'medical care; does not replace dermatologic management.',
    clinicalRationale:
      'Immune modulation via colostrum, lactoferrin, curcumin (NF-κB suppression); growth-cycle ' +
      'support via vitamin D, melatonin (anagen prolongation), kelp; stress regulation via ' +
      'L-theanine, chamomile, magnesium; antioxidant defense via moringa, vitamin E, selenium.',
    targetDiagnoses: ['ALOPECIA_AREATA'],
    targetTherapyNeeds: [
      'IMMUNE_MODULATION',
      'ANTIOXIDANT_SUPPORT',
      'CIRCADIAN_RESET',
      'FOLLICLE_STIMULATION',
    ],
    components: [
      { type: 'ORAL', productId: 'aa_kit_capsule', displayName: 'AA Kit capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'curcumin',
      'colostrum',
      'lactoferrin',
      'vitamin_d3',
      'melatonin',
      'kelp_extract',
      'l_theanine',
      'chamomile',
      'magnesium',
      'moringa_oleifera',
      'selenium',
    ],
    contraindications: ['Pregnancy', 'Hyperthyroidism (kelp)', 'Concurrent immunosuppressants — clinical supervision'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Patch stabilisation',
      'Early signs of regrowth (often initially white)',
      'Visible thickening and patch recovery over 12–24 weeks',
    ],
    timeToEffect: '8–24 weeks',
    phaseCompatibility: [1, 2, 3],
    evidenceLevel: 'EMERGING',
    lastReviewed: '2026-06-05',
  },

  // ───────────────────────────────────────────────────────────────────────────
  // OXIDATIVE STRESS
  // ───────────────────────────────────────────────────────────────────────────
  'OXIDATIVE STRESS SHIELD': {
    kitId: 'OXIDATIVE STRESS SHIELD',
    displayName: 'Oxidative Stress Shield',
    shortName: 'Ox Stress Shield',
    category: 'antioxidant',
    description:
      'Antioxidant + mitochondrial + microcirculatory formula for high-oxidative-load profiles ' +
      '(smoking, pollution, high stress, sedentary).',
    clinicalRationale:
      'Free-radical neutralization (spirulina, resveratrol, lycopene, vitamin C, selenium, zinc); ' +
      'microcirculatory support (pine bark, arginine, pumpkin seed oil, ginseng); gut and immune ' +
      'support (lactobacillus, colostrum, lactoferrin); anti-inflammatory adjuncts (ashwagandha, ' +
      'vitamin D, ginseng, gymnema).',
    targetDiagnoses: ['OXIDATIVE', 'AGA_MALE_45', 'NIGHT_SHIFT', 'FREQUENT_FLYING'],
    targetTherapyNeeds: [
      'ANTIOXIDANT_SUPPORT',
      'METABOLIC_SUPPORT',
      'FOLLICLE_STIMULATION',
      'GUT_RESTORATION',
    ],
    components: [
      { type: 'ORAL', productId: 'oxidative_shield_capsule', displayName: 'Oxidative Stress Shield capsules', role: 'Primary oral', optional: false },
    ],
    keyIngredients: [
      'spirulina',
      'resveratrol',
      'lycopene',
      'selenium',
      'vitamin_c',
      'zinc',
      'pine_bark_extract',
      'arginine',
      'pumpkin_seed_oil',
      'ginseng',
      'lactobacillus',
      'colostrum',
      'lactoferrin',
      'ashwagandha',
      'vitamin_d3',
      'gymnema',
    ],
    contraindications: ['Pregnancy', 'Active bleeding', 'Hyperthyroidism (selenium high dose)'],
    pregnancySafe: false,
    expectedOutcomes: [
      'Improved energy and reduced hair fragility within 3–6 weeks',
      'Better hair texture and reduced breakage 6–10 weeks',
      'Enhanced hair quality and growth support 10–14 weeks',
    ],
    timeToEffect: '3–14 weeks',
    phaseCompatibility: [2, 3, 4],
    evidenceLevel: 'MODERATE',
    lastReviewed: '2026-06-05',
  },
} as const;
