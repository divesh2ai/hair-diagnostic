/**
 * ANDROGEN MODULATORS, HORMONAL & METABOLIC BOTANICALS
 *
 * Beta-sitosterol, Stinging Nettle, Ginseng, Mulberry, Milk Thistle,
 * Myo-Inositol, Garcinia, Pumpkin Seed Oil, Spirulina, Lycopene, Arginine,
 * Moringa, Kelp, Fenugreek, Gymnema.
 *
 * Source: All Kits Info.docx + Master KB §14, §20, §21, §22.
 */

import type { IngredientKnowledge } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Beta-sitosterol
// ─────────────────────────────────────────────────────────────────────────────

export const BETA_SITOSTEROL: IngredientKnowledge = {
  ingredientId: 'beta_sitosterol',
  displayName: 'Beta-sitosterol',
  aliases: ['β-sitosterol', 'Plant sterol', 'Phytosterol'],
  category: 'DHT_INHIBITOR',
  mechanismsOfAction: [
    'Competitive 5α-reductase inhibition — reduces testosterone-to-DHT conversion in scalp follicles.',
    'Reduces available cholesterol for conversion to androgens (PCOS docx).',
    'Anti-inflammatory — protects hair follicles from inflammation-induced damage (peri-menopause docx).',
    'Adjunctive female pattern hair loss support by targeting androgenetic factors.',
  ],
  targetedNeeds: ['DHT_SUPPRESSION', 'HORMONAL_REBALANCING', 'INFLAMMATION_CONTROL'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Upadhyay 2012 (Arch Dermatol Res): phyto-vesicles of β-sitosterol demonstrated androgenetic ' +
    'alopecia benefit. Sadgrove 2023 (Cosmetics): mechanistic review supporting phytosterol class. ' +
    'Used in PHENOTYPE INFLAMATION, MPHL/FPHL, META B (peri-meno), F-PCOS-1.',
  contraindications: [
    'Sitosterolemia (rare genetic condition)',
    'Concurrent ezetimibe (reduces absorption)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '60–130 mg per day',
    maximum: '400 mg',
    unit: 'mg',
    frequency: 'Once or twice daily with meals',
    notes: 'Mixed phytosterol blends sometimes deliver higher total sterol content.',
  },
  interactions: [
    { ingredient: 'Ezetimibe', type: 'ANTAGONISTIC', note: 'Reduces absorption of both.' },
    { ingredient: 'Statins', type: 'NEUTRAL', note: 'Additive cholesterol-lowering effect.' },
  ],
  sideEffects: ['Mild GI upset'],
  onsetOfAction: 'Modest androgenetic effects over 3–6 months.',
  references: ['Upadhyay K et al. Arch Dermatol Res 2012;304:511-519'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Stinging Nettle
// ─────────────────────────────────────────────────────────────────────────────

export const STINGING_NETTLE: IngredientKnowledge = {
  ingredientId: 'stinging_nettle',
  displayName: 'Stinging Nettle (Urtica dioica)',
  aliases: ['Urtica dioica', 'Nettle root'],
  category: 'DHT_INHIBITOR',
  mechanismsOfAction: [
    'Nettle-root lignans bind sex hormone binding globulin (SHBG) inhibiting DHT-SHBG complex.',
    'Promotes hair growth by reducing free testosterone (PCOS docx).',
    'Mild anti-inflammatory and diuretic action.',
  ],
  targetedNeeds: ['HORMONAL_REBALANCING', 'DHT_SUPPRESSION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple studies demonstrate modest reduction in free testosterone via SHBG modulation. ' +
    'Used in PHENOTYPE INFLAMATION and F-PCOS-1 / META B PCOS bundles.',
  contraindications: [
    'Pregnancy (uterotonic concerns)',
    'Concurrent diuretics (additive effect)',
    'Concurrent antihypertensives (additive BP-lowering effect)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '300–600 mg nettle root extract per day',
    maximum: '1200 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Root extract preferred for SHBG modulation; leaf is more diuretic.',
  },
  interactions: [
    { ingredient: 'Diuretics', type: 'SYNERGISTIC', note: 'Additive diuretic effect.' },
    { ingredient: 'Antihypertensives', type: 'SYNERGISTIC', note: 'Mild BP-lowering synergy.' },
    { ingredient: 'Lithium', type: 'NEUTRAL', note: 'May affect lithium levels via diuretic action.' },
  ],
  sideEffects: ['GI upset', 'Mild diuresis'],
  onsetOfAction: 'Hormonal effects over 8–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Ginseng
// ─────────────────────────────────────────────────────────────────────────────

export const GINSENG: IngredientKnowledge = {
  ingredientId: 'ginseng',
  displayName: 'Ginseng (Panax ginseng)',
  aliases: ['Panax ginseng', 'Korean ginseng', 'Asian ginseng'],
  category: 'ADAPTOGEN',
  mechanismsOfAction: [
    'Ginsenoside Rg1/Rb1 activate eNOS via PI3K/Akt pathway improving scalp microcirculation.',
    'HPA-axis modulation supporting stress resilience.',
    'NF-κB suppression — mild anti-inflammatory action.',
    'Improves follicular nourishment via microcirculatory support (OXIDATIVE STRESS SHIELD docx).',
  ],
  targetedNeeds: ['FOLLICLE_STIMULATION', 'CIRCADIAN_RESET', 'INFLAMMATION_CONTROL'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple trials document cognitive and vascular benefits. Used in PHENOTYPE INFLAMATION ' +
    'and OXIDATIVE STRESS SHIELD bundles.',
  contraindications: [
    'Concurrent anticoagulants (additive bleeding risk)',
    'Acute febrile illness (traditional caution)',
    'Insomnia (may worsen)',
    'Concurrent MAOIs',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '200–400 mg standardized to 4% ginsenosides per day',
    maximum: '600 mg',
    unit: 'mg',
    frequency: 'Once daily morning',
    notes: 'Avoid evening dosing due to mild stimulant effect.',
  },
  interactions: [
    { ingredient: 'Warfarin', type: 'ANTAGONISTIC', note: 'May reduce warfarin efficacy.' },
    { ingredient: 'MAOIs', type: 'ANTAGONISTIC', note: 'Risk of manic-like symptoms.' },
    { ingredient: 'Hypoglycemic agents', type: 'SYNERGISTIC', note: 'Mild hypoglycemic effect.' },
  ],
  sideEffects: ['Insomnia', 'Headache', 'GI upset'],
  onsetOfAction: 'Stress and microcirculatory effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mulberry Extract
// ─────────────────────────────────────────────────────────────────────────────

export const MULBERRY_EXTRACT: IngredientKnowledge = {
  ingredientId: 'mulberry_extract',
  displayName: 'Mulberry Extract (Morus alba)',
  aliases: ['Morus alba', 'White mulberry', 'DNJ-rich extract'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    '1-deoxynojirimycin (DNJ) competitively inhibits intestinal α-glucosidase reducing postprandial glucose.',
    'Acarbose-comparable efficacy in carbohydrate absorption modulation (PCOS docx).',
    'Mild cortisol-lowering and neuro-inflammatory dampening (PHENOTYPE INFLAMATION docx).',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT', 'CIRCADIAN_RESET'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented reductions in postprandial glucose in T2DM and pre-diabetic states. Used in ' +
    'PHENOTYPE INFLAMATION and F-PCOS-1 bundles.',
  contraindications: [
    'Concurrent sulfonylureas or insulin without close glucose monitoring',
    'Hypoglycaemia history',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1000 mg DNJ-standardized extract per day',
    unit: 'mg',
    frequency: 'Take before main carbohydrate-containing meals',
    notes: 'Best taken 15 minutes before meals for optimal α-glucosidase blockade.',
  },
  interactions: [
    { ingredient: 'Sulfonylureas / insulin', type: 'SYNERGISTIC', note: 'Hypoglycaemia risk — monitor glucose.' },
  ],
  sideEffects: ['GI bloating', 'Mild gas (during initial weeks)'],
  onsetOfAction: 'Postprandial glucose effects immediate; HbA1c effects over 8–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Milk Thistle
// ─────────────────────────────────────────────────────────────────────────────

export const MILK_THISTLE: IngredientKnowledge = {
  ingredientId: 'milk_thistle',
  displayName: 'Milk Thistle (Silybum marianum)',
  aliases: ['Silybum marianum', 'Silymarin', 'Silybin'],
  category: 'HORMONE_MODULATOR',
  mechanismsOfAction: [
    'Silybin scavenges ROS, stabilizes hepatocyte membranes, restores glutathione.',
    'Mild phyto-estrogenic effect at ER-β — supports peri-menopausal estrogen decline (META B docx).',
    'Modulates vasomotor symptoms (hot flashes); improves mood and quality of life.',
    'Hepatoprotective via antioxidant action.',
  ],
  targetedNeeds: ['HORMONAL_REBALANCING', 'ANTIOXIDANT_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Murphy 2020: 12-week study showed significant climacteric symptom improvement. ' +
    'Used in META B / Hair Fact Peri-Menopause Kit.',
  contraindications: [
    'Estrogen-sensitive cancers',
    'Pregnancy',
    'Asteraceae family allergy',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '200–400 mg silymarin per day',
    maximum: '600 mg',
    unit: 'mg',
    frequency: 'Once or twice daily with meals',
    notes: 'Phytosome formulations have improved bioavailability.',
  },
  interactions: [
    { ingredient: 'CYP3A4 substrates', type: 'NEUTRAL', note: 'Mild CYP3A4 modulation at high doses.' },
    { ingredient: 'Estrogen therapy', type: 'NEUTRAL', note: 'Phyto-estrogenic — clinical relevance unclear.' },
  ],
  sideEffects: ['GI upset', 'Allergic reactions (Asteraceae)'],
  onsetOfAction: 'Climacteric effects over 8–12 weeks.',
  references: ['Murphy L. 2020. Milk Thistle for Menopause Relief.'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Myo-Inositol
// ─────────────────────────────────────────────────────────────────────────────

export const MYO_INOSITOL: IngredientKnowledge = {
  ingredientId: 'myo_inositol',
  displayName: 'Myo-Inositol',
  aliases: ['Inositol', 'Myo-inositol', 'Vitamin B8 (legacy)'],
  category: 'HORMONE_MODULATOR',
  mechanismsOfAction: [
    'Inositol phosphoglycan (IPG) second messenger restores insulin signaling.',
    'Reduces ovarian theca androgen synthesis; raises SHBG; reduces free testosterone and androstenedione.',
    'Improves outcomes of metformin treatment in PCOS (docx).',
    'Pairs with D-chiro-inositol at 40:1 ratio in clinical PCOS protocols.',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT', 'HORMONAL_REBALANCING'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Costantino 2009 (Eur Rev Med Pharmacol Sci) and multiple subsequent RCTs: 2 g BID myo-inositol ' +
    'improves HOMA-IR, reduces free testosterone, improves ovulation and AMH in PCOS. ' +
    'Used in F-PCOS-1 / PRO FACT META B PCOS.',
  contraindications: ['None absolute'],
  pregnancySafe: true,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '2000 mg twice daily (4 g/day) in PCOS protocols',
    maximum: '4000 mg',
    unit: 'mg',
    frequency: 'Twice daily',
    notes: 'Combine with D-chiro-inositol at 40:1 ratio for optimal PCOS effect.',
  },
  interactions: [
    { ingredient: 'Metformin', type: 'SYNERGISTIC', note: 'Improves PCOS outcomes vs metformin alone.' },
    { ingredient: 'Sulfonylureas / insulin', type: 'SYNERGISTIC', note: 'Mild additive glucose effects — monitor.' },
  ],
  sideEffects: ['Mild GI upset', 'Headache (uncommon)'],
  onsetOfAction: 'HOMA-IR improvement within 8 weeks; androgen effects over 12 weeks.',
  references: ['Costantino D et al. Eur Rev Med Pharmacol Sci 2009;13:105-110'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Garcinia Cambogia
// ─────────────────────────────────────────────────────────────────────────────

export const GARCINIA_CAMBOGIA: IngredientKnowledge = {
  ingredientId: 'garcinia_cambogia',
  displayName: 'Garcinia Cambogia',
  aliases: ['Hydroxycitric acid (HCA)', 'Malabar tamarind'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    '(-)-Hydroxycitric acid inhibits ATP-citrate lyase reducing fatty acid synthesis.',
    'Modulates serotonin appetite signaling.',
    'Modest weight-management effect; reduces BMI and abdominal fat (PCOS docx).',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT', 'WEIGHT_LOSS_RECOVERY'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Mixed clinical evidence; modest weight effects in some trials. Used in F-PCOS-1 ' +
    'metabolic correction bundle.',
  contraindications: [
    'Hepatic impairment (rare hepatotoxicity case reports)',
    'Pregnancy / breastfeeding',
    'Concurrent SSRIs (serotonin modulation)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '500–1000 mg before meals',
    maximum: '3000 mg per day',
    unit: 'mg',
    frequency: 'Three times daily before meals',
    notes: 'Monitor LFTs with prolonged use.',
  },
  interactions: [
    { ingredient: 'SSRIs', type: 'ANTAGONISTIC', note: 'Theoretical serotonin syndrome risk.' },
    { ingredient: 'Statins', type: 'SYNERGISTIC', note: 'Additive lipid effects.' },
  ],
  sideEffects: ['GI upset', 'Headache', 'Rare hepatotoxicity'],
  onsetOfAction: 'Weight effects over 8–12 weeks if present.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Pumpkin Seed Oil
// ─────────────────────────────────────────────────────────────────────────────

export const PUMPKIN_SEED_OIL: IngredientKnowledge = {
  ingredientId: 'pumpkin_seed_oil',
  displayName: 'Pumpkin Seed Oil',
  aliases: ['Cucurbita pepo oil'],
  category: 'DHT_INHIBITOR',
  mechanismsOfAction: [
    'Phytosterol-rich (β-sitosterol present at active levels) — mild 5α-reductase inhibition.',
    'Supports scalp circulation and follicular nourishment (OXIDATIVE STRESS SHIELD docx).',
  ],
  targetedNeeds: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Cho 2014: 24-week RCT in male AGA demonstrated ~40% increase in hair count with 400 mg/day ' +
    'pumpkin seed oil. Used in OXIDATIVE STRESS SHIELD and topical formulations.',
  contraindications: ['Pumpkin seed allergy'],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '400 mg per day',
    maximum: '800 mg',
    unit: 'mg',
    frequency: 'Once or twice daily with meals',
    notes: 'Cold-pressed oil retains phytosterol content.',
  },
  interactions: [
    { ingredient: 'Antihypertensives', type: 'SYNERGISTIC', note: 'Mild additive BP-lowering effect.' },
  ],
  sideEffects: ['GI upset'],
  onsetOfAction: 'AGA effects emerge over 24 weeks per RCT data.',
  references: ['Cho YH et al. Evid Based Complement Alternat Med 2014'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Spirulina
// ─────────────────────────────────────────────────────────────────────────────

export const SPIRULINA: IngredientKnowledge = {
  ingredientId: 'spirulina',
  displayName: 'Spirulina',
  aliases: ['Arthrospira platensis', 'Cyanobacterial extract'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'C-phycocyanin scavenges peroxyl radicals and inhibits COX-2.',
    'Documented antioxidant and modest immunomodulatory effects.',
    'Protein-rich (~60% by dry weight) with complete amino acid profile.',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple meta-analyses document antioxidant, lipid, and modest BP-lowering effects. ' +
    'Used in OXIDATIVE STRESS SHIELD.',
  contraindications: [
    'PKU (phenylalanine content)',
    'Autoimmune disease (theoretical immune activation)',
    'Source contamination risk — choose tested products',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '1–3 g per day',
    maximum: '10 g',
    unit: 'g',
    frequency: 'Once or twice daily',
    notes: 'Source contamination (microcystin, heavy metals) is a real concern — choose tested products.',
  },
  interactions: [
    { ingredient: 'Immunosuppressants', type: 'ANTAGONISTIC', note: 'May reduce efficacy.' },
  ],
  sideEffects: ['GI upset', 'Allergic reactions (rare)'],
  onsetOfAction: 'Antioxidant effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Lycopene
// ─────────────────────────────────────────────────────────────────────────────

export const LYCOPENE: IngredientKnowledge = {
  ingredientId: 'lycopene',
  displayName: 'Lycopene',
  aliases: ['Tomato carotenoid'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'Highest singlet oxygen quenching rate among dietary carotenoids.',
    'Reduces LDL oxidation; supports cardiovascular health.',
    'Protects follicular cell membranes from oxidative damage (OXIDATIVE STRESS SHIELD docx).',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'MELANOCYTE_PROTECTION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented cardiovascular antioxidant benefits across multiple studies. Used in ' +
    'OXIDATIVE STRESS SHIELD and Grey Reversal bundles.',
  contraindications: ['None absolute'],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '10–30 mg per day',
    maximum: '60 mg',
    unit: 'mg',
    frequency: 'Once daily with fatty meal',
    notes: 'Fat-soluble — absorption requires dietary fat. Cooked tomato products enhance bioavailability.',
  },
  interactions: [],
  sideEffects: ['GI upset', 'Mild skin yellowing at very high doses'],
  onsetOfAction: 'Antioxidant effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Arginine
// ─────────────────────────────────────────────────────────────────────────────

export const ARGININE: IngredientKnowledge = {
  ingredientId: 'arginine',
  displayName: 'L-Arginine',
  aliases: ['L-arg', 'Arginine'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Substrate for endothelial nitric oxide synthase (eNOS) producing NO.',
    'Supports vasodilation; improves flow-mediated dilation in deficient states.',
    'Improves scalp circulation and follicular nourishment (OXIDATIVE STRESS SHIELD docx).',
  ],
  targetedNeeds: ['FOLLICLE_STIMULATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented vascular benefits in supplementation trials. Used in OXIDATIVE STRESS SHIELD.',
  contraindications: [
    'Recent myocardial infarction (caution)',
    'Active herpes simplex lesions (may trigger reactivation)',
    'Concurrent PDE5 inhibitors (additive vasodilation)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '3–6 g per day',
    maximum: '10 g',
    unit: 'g',
    frequency: 'Divided doses',
    notes: 'Split dosing improves tolerance and NO production curve.',
  },
  interactions: [
    { ingredient: 'PDE5 inhibitors', type: 'SYNERGISTIC', note: 'Additive vasodilation effect.' },
    { ingredient: 'Antihypertensives', type: 'SYNERGISTIC', note: 'Additive BP-lowering effect.' },
  ],
  sideEffects: ['GI upset', 'Herpes reactivation in susceptible patients'],
  onsetOfAction: 'Vascular effects within weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Moringa Oleifera
// ─────────────────────────────────────────────────────────────────────────────

export const MORINGA_OLEIFERA: IngredientKnowledge = {
  ingredientId: 'moringa_oleifera',
  displayName: 'Moringa Oleifera',
  aliases: ['Drumstick tree', 'Moringa leaf'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'Quercetin, kaempferol, isothiocyanates — antioxidant and anti-inflammatory effects.',
    'Phytosterols (β-sitosterol present) — mild androgen modulation (TE GOLD docx).',
    'Nutrient-dense — supports nutrient repletion and antioxidant defense (TE GOLD, AA bundles).',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'DHT_SUPPRESSION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented antioxidant and modest androgen-modulating effects. Used in HAIR FACT TE GOLD ' +
    'and HAIR FACT ALOPECIA AREATA.',
  contraindications: [
    'Pregnancy (uterotonic concerns at high doses)',
    'Concurrent thyroid medication (mild thyroid effect possible)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–2000 mg leaf powder per day',
    maximum: '6000 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Powdered leaf and standardized extracts both used.',
  },
  interactions: [
    { ingredient: 'Thyroid medication', type: 'NEUTRAL', note: 'Monitor TSH.' },
  ],
  sideEffects: ['GI upset', 'Laxative effect at high doses'],
  onsetOfAction: 'Antioxidant effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Kelp Extract
// ─────────────────────────────────────────────────────────────────────────────

export const KELP_EXTRACT: IngredientKnowledge = {
  ingredientId: 'kelp_extract',
  displayName: 'Kelp / Seaweed Extract',
  aliases: ['Brown algae extract', 'Laminaria', 'Fucus'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Iodine substrate for thyroid hormone synthesis (T3/T4).',
    'Selenium content supports deiodinase activity.',
    'Documented IGF-1 and VEGF upregulation in follicle cultures (TE GOLD docx).',
    'Modulates immune function; alleviates autoimmune reactions affecting follicles (AA docx).',
  ],
  targetedNeeds: ['THYROID_SUPPORT', 'FOLLICLE_STIMULATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Iodine and selenium are established thyroid cofactors. Used in HAIR FACT TE GOLD, ' +
    'HAIR FACT ALOPECIA AREATA, META B (peri-meno).',
  contraindications: [
    'Hyperthyroidism / active thyrotoxicosis',
    'Hashimoto thyroiditis with concern for iodine load',
    'Pregnancy (excess iodine concern)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '150–600 mcg iodine equivalent per day',
    maximum: '1000 mcg iodine',
    unit: 'mcg iodine',
    frequency: 'Once daily',
    notes: 'Check TSH baseline before initiation if any thyroid history.',
  },
  interactions: [
    { ingredient: 'Thyroid medication', type: 'NEUTRAL', note: 'Monitor TSH.' },
    { ingredient: 'Lithium', type: 'NEUTRAL', note: 'May affect lithium thyroid effects.' },
  ],
  sideEffects: ['Thyroid dysfunction at excess iodine', 'GI upset'],
  onsetOfAction: 'Thyroid effects over 6–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Fenugreek
// ─────────────────────────────────────────────────────────────────────────────

export const FENUGREEK: IngredientKnowledge = {
  ingredientId: 'fenugreek',
  displayName: 'Fenugreek',
  aliases: ['Trigonella foenum-graecum', 'Methi'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'Galactomannan-rich soluble fiber reduces gastric emptying and glucose absorption.',
    'Trigonelline and 4-hydroxyisoleucine modulate insulin response.',
    'Improves cellular energy and insulin sensitivity (TE GOLD docx).',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented reductions in postprandial glucose and improvements in glycemic markers. ' +
    'Used in HAIR FACT TE GOLD and metabolic bundles.',
  contraindications: [
    'Pregnancy (uterotonic, possible birth defect concerns)',
    'Concurrent sulfonylureas or insulin without monitoring',
    'Anticoagulants (additive bleeding risk)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1000 mg per day',
    maximum: '6000 mg',
    unit: 'mg',
    frequency: 'Twice daily with meals',
    notes: 'May cause maple-syrup-like body odor.',
  },
  interactions: [
    { ingredient: 'Hypoglycemic agents', type: 'SYNERGISTIC', note: 'Hypoglycaemia risk.' },
    { ingredient: 'Warfarin', type: 'SYNERGISTIC', note: 'Additive bleeding risk.' },
  ],
  sideEffects: ['GI upset', 'Maple syrup body odor', 'Mild diarrhoea'],
  onsetOfAction: 'Glycemic effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Gymnema
// ─────────────────────────────────────────────────────────────────────────────

export const GYMNEMA: IngredientKnowledge = {
  ingredientId: 'gymnema',
  displayName: 'Gymnema (Gymnema sylvestre)',
  aliases: ['Gymnema sylvestre', 'Gurmar'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'Gymnemic acids competitively block intestinal SGLT1 glucose absorption.',
    'Modest insulinotropic effect documented in T2DM trials.',
    'Improves cellular energy and insulin sensitivity (TE GOLD docx); reduces intestinal sugar absorption (OXIDATIVE STRESS SHIELD docx).',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented HbA1c reduction in T2DM trials. Used in HAIR FACT TE GOLD metabolic correction ' +
    'and OXIDATIVE STRESS SHIELD bundles.',
  contraindications: [
    'Concurrent sulfonylureas or insulin without close glucose monitoring',
    'Hypoglycaemia history',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '200–400 mg standardized to 25% gymnemic acids per day',
    maximum: '600 mg',
    unit: 'mg',
    frequency: 'Twice daily before meals',
    notes: 'Temporarily blocks sweet taste perception when held in mouth.',
  },
  interactions: [
    { ingredient: 'Hypoglycaemic agents', type: 'SYNERGISTIC', note: 'Hypoglycaemia risk — monitor glucose.' },
  ],
  sideEffects: ['Hypoglycaemia at high doses with hypoglycemic agents', 'Loss of sweet taste'],
  onsetOfAction: 'Glycemic effects over 4–12 weeks.',
};
