/**
 * IMMUNE MODULATORS, STRUCTURAL SUPPORT, AND VASCULAR/MITOCHONDRIAL INGREDIENTS
 *
 * Lactoferrin, Colostrum, CoQ10, NMN, Pine Bark, GHK-Cu, Pumpkin Seed Oil, Arginine,
 * Spirulina, Lycopene, MSM, Horsetail, NEM, Brewer's Yeast, Amla, Probiotics,
 * Bioperine, Digestive Enzymes.
 *
 * Source: All Kits Info.docx + Master KB §15, §22.
 */

import type { IngredientKnowledge } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Lactoferrin
// ─────────────────────────────────────────────────────────────────────────────

export const LACTOFERRIN: IngredientKnowledge = {
  ingredientId: 'lactoferrin',
  displayName: 'Lactoferrin',
  aliases: ['Bovine lactoferrin', 'LF'],
  category: 'GROWTH_FACTOR',
  mechanismsOfAction: [
    'Iron-binding glycoprotein — facilitates intestinal iron uptake via lactoferrin receptors; improves ferritin reserves.',
    'Modulates innate and adaptive immunity via TLR engagement and balanced cytokine production.',
    'Improves dermal papilla cell proliferation via EGF-related growth-factor signaling (PRO IMMUNE GOLD docx).',
    'Antimicrobial via iron sequestration.',
    'Supports mucosal barrier and reduces inflammatory tone (peri-menopause docx).',
  ],
  targetedNeeds: ['IRON_REPLETION', 'IMMUNE_MODULATION', 'GUT_RESTORATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    "D'Auria 2020 (Nutrients): immunomodulatory evidence. An 2019 (Nutrients): bone formation/resorption " +
    'in osteoporosis. Used across HAIR FACT TE GOLD, PRO IMMUNE GOLD, HAIR FACT ALOPECIA AREATA, ' +
    'MPHL/FPHL, META B (peri-menopause).',
  contraindications: [
    'Cow-milk protein allergy',
    'Hemochromatosis / iron overload disorders',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '200–400 mg per day',
    maximum: '600 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Pair with vitamin C for iron absorption synergy.',
  },
  interactions: [
    { ingredient: 'Iron supplements', type: 'SYNERGISTIC', note: 'Improves iron absorption and reserves.' },
    { ingredient: 'Calcium / antacids', type: 'ANTAGONISTIC', note: 'Reduces iron absorption — separate by 2 hours.' },
  ],
  sideEffects: ['Mild GI upset', 'Allergic reactions in milk-allergic patients'],
  onsetOfAction: 'Ferritin improvement over 8–12 weeks; immune effects within 4 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Colostrum
// ─────────────────────────────────────────────────────────────────────────────

export const COLOSTRUM: IngredientKnowledge = {
  ingredientId: 'colostrum',
  displayName: 'Bovine Colostrum',
  aliases: ['First milk', 'Hyperimmune colostrum'],
  category: 'GROWTH_FACTOR',
  mechanismsOfAction: [
    'Source of IgG immunoglobulins, lactoferrin, and growth factors (EGF, IGF-1, TGF-β).',
    'EGF and IGF-1 promote epithelial and dermal papilla cell proliferation.',
    'Secretory IgA reinforces mucosal barrier; reduces systemic LPS translocation (gut-hair axis).',
    'TGF-β in regulatory milieu supports immune tolerance — used in HAIR FACT ALOPECIA AREATA.',
    'Repairs gut lining and provides regenerative growth factors (TE GOLD context).',
  ],
  targetedNeeds: ['IMMUNE_MODULATION', 'GUT_RESTORATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Ochoa 2009 (J Pediatr Gastroenterol Nutr): GI health benefit. Kelleher 2016: ' +
    'immune system role. Used across HAIR FACT TE GOLD, PRO IMMUNE GOLD, ' +
    'HAIR FACT ALOPECIA AREATA, PHENOTYPE INFLAMATION, MPHL/FPHL, META B.',
  contraindications: [
    'Cow-milk protein allergy',
    'Severe lactose intolerance',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '500–2000 mg per day',
    maximum: '3000 mg',
    unit: 'mg',
    frequency: 'Once or twice daily on empty stomach',
    notes: 'Best taken 30 minutes before meals; quality varies — choose IgG-standardized products.',
  },
  interactions: [
    { ingredient: 'Probiotics', type: 'SYNERGISTIC', note: 'Complementary gut-axis support.' },
  ],
  sideEffects: ['Bloating during initial weeks', 'Allergic reactions in milk-allergic patients'],
  onsetOfAction: 'GI comfort within 2–4 weeks; immune effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Coenzyme Q10
// ─────────────────────────────────────────────────────────────────────────────

export const COQ10: IngredientKnowledge = {
  ingredientId: 'coq10',
  displayName: 'Coenzyme Q10',
  aliases: ['Ubiquinone', 'Ubiquinol', 'CoQ10'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'Electron carrier in mitochondrial ETC Complexes I–III; supports ATP synthesis.',
    'Lipid-soluble antioxidant; regenerates α-tocopherol (vitamin E).',
    'Reduces hs-CRP, TNF-α, IL-6 in inflammatory states.',
    'Protects melanocyte function — adjunctive for premature greying.',
    'Documented mitochondrial support in stress-driven and ageing follicles.',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'METABOLIC_SUPPORT', 'MELANOCYTE_PROTECTION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Meta-analyses confirm reduction in CRP, TNF-α, IL-6. Cardiovascular and ' +
    'mitochondrial benefits well-documented. Used in PRO IMMUNE GOLD, PHENOTYPE INFLAMATION, ' +
    'MPHL/FPHL, Grey Reversal bundles.',
  contraindications: [
    'Concurrent warfarin (modest interaction)',
    'Hypotension (mild BP-lowering effect)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '100–200 mg per day; ubiquinol form preferred over 40 years',
    maximum: '400 mg',
    unit: 'mg',
    frequency: 'Once daily with fatty meal',
    notes: 'Fat-soluble — absorption requires dietary fat. Ubiquinol has superior bioavailability after age 40.',
  },
  interactions: [
    { ingredient: 'Warfarin', type: 'ANTAGONISTIC', note: 'May reduce warfarin efficacy.' },
    { ingredient: 'Statins', type: 'SYNERGISTIC', note: 'Replenishes statin-depleted CoQ10.' },
  ],
  sideEffects: ['Mild GI upset', 'Insomnia if dosed late'],
  onsetOfAction: 'Energetic effects within 2–4 weeks; inflammatory markers over 8–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// NMN
// ─────────────────────────────────────────────────────────────────────────────

export const NMN: IngredientKnowledge = {
  ingredientId: 'nmn',
  displayName: 'Nicotinamide Mononucleotide',
  aliases: ['NMN', 'β-NMN'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'NAD+ precursor — raises cellular NAD+ levels through enzymatic conversion.',
    'Activates SIRT1/3 with downstream effects on PGC-1α and mitochondrial biogenesis.',
    'Slows follicular ageing in MPHL/FPHL context (docx).',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT', 'ANTIOXIDANT_SUPPORT'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Early human trials show modest insulin-sensitizing effects and elevation of NAD+ blood markers. ' +
    'Long-term safety still emerging. Used in MPHL/FPHL anti-ageing bundle.',
  contraindications: [
    'Active malignancy (theoretical sirtuin concern)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '250–500 mg per day',
    maximum: '900 mg',
    unit: 'mg',
    frequency: 'Once daily morning',
    notes: 'Sublingual forms may have improved bioavailability; cycle with NR (nicotinamide riboside) optional.',
  },
  interactions: [],
  sideEffects: ['Mild nausea', 'Flushing (uncommon)'],
  onsetOfAction: 'NAD+ levels rise within days; clinical effects emerge over 8–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Pine Bark Extract (Pycnogenol)
// ─────────────────────────────────────────────────────────────────────────────

export const PINE_BARK_EXTRACT: IngredientKnowledge = {
  ingredientId: 'pine_bark_extract',
  displayName: 'Pine Bark Extract (Pycnogenol)',
  aliases: ['Pycnogenol', 'Pinus pinaster bark extract', 'Maritime pine extract'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'Proanthocyanidins (procyanidin B1/B3) induce eNOS activation via PI3K/Akt pathway.',
    'Improves microcirculation to hair follicles ensuring oxygen and nutrient delivery (PRO IMMUNE GOLD docx).',
    'Antioxidant via direct radical scavenging.',
    'Modest improvement in flow-mediated dilation documented.',
  ],
  targetedNeeds: ['FOLLICLE_STIMULATION', 'ANTIOXIDANT_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple trials demonstrate cardiovascular and microcirculatory benefits at 100–200 mg/day. ' +
    'Used in PRO IMMUNE GOLD and OXIDATIVE STRESS SHIELD bundles.',
  contraindications: [
    'Active bleeding or pre-operative period',
    'Autoimmune disease (theoretical immune stimulation)',
    'Concurrent anticoagulants',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '100–200 mg per day',
    maximum: '300 mg',
    unit: 'mg',
    frequency: 'Once daily with meal',
    notes: 'Standardized extracts deliver consistent procyanidin content.',
  },
  interactions: [
    { ingredient: 'Anticoagulants / antiplatelets', type: 'SYNERGISTIC', note: 'Additive bleeding risk.' },
    { ingredient: 'Antihypertensives', type: 'SYNERGISTIC', note: 'Mild additive BP-lowering effect.' },
  ],
  sideEffects: ['Mild GI upset', 'Dizziness (uncommon)'],
  onsetOfAction: 'Microcirculatory effects within 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// MSM
// ─────────────────────────────────────────────────────────────────────────────

export const MSM: IngredientKnowledge = {
  ingredientId: 'msm',
  displayName: 'Methylsulfonylmethane (MSM)',
  aliases: ['MSM', 'Dimethyl sulfone'],
  category: 'KERATIN_SUPPORT',
  mechanismsOfAction: [
    'Organic sulfur donor — provides bioavailable sulfur for cysteine-based disulfide bond formation in keratin.',
    'Mild anti-inflammatory effect documented.',
    'Adjunctive 5α-R modulation in MPHL/FPHL context (docx).',
  ],
  targetedNeeds: ['SHAFT_REPAIR', 'DHT_SUPPRESSION'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Small clinical trials show modest hair strength and growth benefits. Used in MPHL/FPHL ' +
    'as part of structural support bundle.',
  contraindications: ['None absolute'],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '1000–3000 mg per day',
    maximum: '6000 mg',
    unit: 'mg',
    frequency: 'Twice daily with meals',
    notes: 'Build up dose gradually to avoid GI symptoms.',
  },
  interactions: [],
  sideEffects: ['GI upset', 'Headache', 'Skin reactions (rare)'],
  onsetOfAction: 'Hair quality improvements over 12–16 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Horsetail Extract
// ─────────────────────────────────────────────────────────────────────────────

export const HORSETAIL_EXTRACT: IngredientKnowledge = {
  ingredientId: 'horsetail_extract',
  displayName: 'Horsetail Extract (Equisetum arvense)',
  aliases: ['Equisetum arvense', 'Common horsetail', 'Silica-rich botanical'],
  category: 'KERATIN_SUPPORT',
  mechanismsOfAction: [
    'Bioavailable silica source — supports hydroxyproline synthesis and collagen cross-linking.',
    'Supports hair matrix repair and growth signalling (MPHL/FPHL docx).',
  ],
  targetedNeeds: ['SHAFT_REPAIR'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Silica supplementation associated with modest improvements in hair tensile strength. ' +
    'Used in MPHL/FPHL structural bundle.',
  contraindications: [
    'Thiamine deficiency (anti-thiamine factor in raw plant)',
    'Pregnancy (limited safety data)',
    'Concurrent diuretics (additive diuretic effect)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '300–500 mg standardized extract per day',
    maximum: '900 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Use thiaminase-free standardized extracts; avoid raw plant.',
  },
  interactions: [
    { ingredient: 'Thiazide diuretics', type: 'SYNERGISTIC', note: 'Additive diuretic effect.' },
    { ingredient: 'Lithium', type: 'NEUTRAL', note: 'May increase lithium levels via diuretic action.' },
  ],
  sideEffects: ['GI upset', 'Thiamine depletion with raw plant'],
  onsetOfAction: 'Shaft quality improvements over months.',
};

// ─────────────────────────────────────────────────────────────────────────────
// NEM (Natural Eggshell Membrane)
// ─────────────────────────────────────────────────────────────────────────────

export const NEM: IngredientKnowledge = {
  ingredientId: 'nem',
  displayName: 'Natural Eggshell Membrane (NEM)',
  aliases: ['NEM', 'Eggshell membrane'],
  category: 'KERATIN_SUPPORT',
  mechanismsOfAction: [
    'Source of structural proteins: collagen (~3%), hyaluronic acid (~2%), elastin, glucosamine, keratin.',
    'Supports connective tissue and shaft integrity (MPHL/FPHL docx).',
  ],
  targetedNeeds: ['SHAFT_REPAIR'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Documented joint and connective tissue benefits in small clinical trials. ' +
    'Used in MPHL/FPHL as structural support adjunct.',
  contraindications: [
    'Egg allergy',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500 mg per day',
    maximum: '1000 mg',
    unit: 'mg',
    frequency: 'Once daily',
    notes: 'Standardized extracts deliver consistent GAG content.',
  },
  interactions: [],
  sideEffects: ['Allergic reactions in egg-allergic patients'],
  onsetOfAction: 'Structural effects over 8–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Brewer's Yeast
// ─────────────────────────────────────────────────────────────────────────────

export const BREWERS_YEAST: IngredientKnowledge = {
  ingredientId: 'brewers_yeast',
  displayName: "Brewer's Yeast (Saccharomyces cerevisiae)",
  aliases: ['Saccharomyces cerevisiae', 'Nutritional yeast (deactivated)'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Source of B-complex (B1, B2, B3, B5, B6, B7, B9), protein, and chromium-GTF.',
    'Chromium glucose-tolerance factor assists insulin signaling.',
    'Supports hair strength and scalp condition (MPHL/FPHL docx).',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT', 'SHAFT_REPAIR'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Long-standing nutritional adjunct for B-vitamin repletion; limited modern hair-specific trials. ' +
    'Used in MPHL/FPHL bundle.',
  contraindications: [
    'Active Crohn\'s disease',
    'Yeast hypersensitivity',
    'Concurrent MAOI therapy (tyramine content)',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '1–2 g per day',
    maximum: '5 g',
    unit: 'g',
    frequency: 'Once daily with meals',
    notes: 'Choose deactivated (non-fermenting) form to avoid yeast overgrowth.',
  },
  interactions: [
    { ingredient: 'MAOIs', type: 'ANTAGONISTIC', note: 'Tyramine content — hypertensive crisis risk.' },
  ],
  sideEffects: ['Bloating', 'Allergic reactions in yeast-sensitive patients'],
  onsetOfAction: 'Nutrient repletion over weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Amla (Indian Gooseberry)
// ─────────────────────────────────────────────────────────────────────────────

export const AMLA: IngredientKnowledge = {
  ingredientId: 'amla',
  displayName: 'Amla (Emblica officinalis)',
  aliases: ['Emblica officinalis', 'Indian Gooseberry'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'High bioavailable vitamin C content plus polyphenols (gallic acid, ellagic acid).',
    'Antioxidant via direct radical scavenging; reduces oxidative markers.',
    'Modest anti-inflammatory effect; supports gut-mucosal absorption.',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'GUT_RESTORATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Traditional Ayurvedic adjunct with documented antioxidant and lipid-modifying effects. ' +
    'Used in MPHL/FPHL gut and absorption bundle.',
  contraindications: [
    'Anticoagulant therapy at high doses (additive bleeding risk)',
    'Diabetes (mild hypoglycemic effect — monitor)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1000 mg standardized extract per day',
    maximum: '3000 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Standardized to tannin content for consistency.',
  },
  interactions: [
    { ingredient: 'Warfarin', type: 'SYNERGISTIC', note: 'Theoretical additive bleeding risk at high doses.' },
  ],
  sideEffects: ['GI upset', 'Loose stools'],
  onsetOfAction: 'Antioxidant effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Lactobacillus (Probiotic)
// ─────────────────────────────────────────────────────────────────────────────

export const LACTOBACILLUS: IngredientKnowledge = {
  ingredientId: 'lactobacillus',
  displayName: 'Lactobacillus / Probiotic Blend',
  aliases: ['Lactobacillus rhamnosus', 'Lactobacillus acidophilus', 'Multi-strain probiotic'],
  category: 'PROBIOTIC',
  mechanismsOfAction: [
    'Strain-specific support of tight-junction proteins (claudin-1, occludin) and intestinal barrier integrity.',
    'SCFA (short-chain fatty acid) production — butyrate supports colonocyte function and Treg expansion.',
    'Balances microbiota composition and beneficial immune signaling (PRO IMMUNE GOLD docx).',
    'Reduces systemic inflammatory tone indirectly via gut-axis.',
  ],
  targetedNeeds: ['GUT_RESTORATION', 'IMMUNE_MODULATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple strain-specific RCTs document GI and immune benefits. Used in HAIR FACT TE GOLD, ' +
    'PRO IMMUNE GOLD, MPHL/FPHL, and OXIDATIVE STRESS SHIELD bundles.',
  contraindications: [
    'Severe immunocompromise (rare bacteremia)',
    'Central venous catheters in place (translocation risk)',
    'Active SIBO (small intestinal bacterial overgrowth)',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '10–50 billion CFU per day',
    maximum: '100 billion CFU',
    unit: 'CFU',
    frequency: 'Once or twice daily',
    notes: 'Take with food; refrigerate where indicated. Strain identity matters more than CFU count.',
  },
  interactions: [
    { ingredient: 'Broad-spectrum antibiotics', type: 'ANTAGONISTIC', note: 'Take 2 hours apart to preserve viability.' },
  ],
  sideEffects: ['Initial bloating', 'Gas during first 1–2 weeks'],
  onsetOfAction: 'GI comfort within 1–4 weeks; immune effects over 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Bioperine (Piperine)
// ─────────────────────────────────────────────────────────────────────────────

export const BIOPERINE: IngredientKnowledge = {
  ingredientId: 'bioperine',
  displayName: 'Bioperine (Piperine)',
  aliases: ['Piperine', 'Black pepper extract'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'Inhibits intestinal P-glycoprotein and hepatic UGT enzymes — raises plasma curcumin ~20×.',
    'Strengthens gut microvilli and improves general nutrient absorption (PRO IMMUNE GOLD docx).',
    'Mild anti-inflammatory action via cytokine modulation.',
    'TRPV1 modulation supporting GI motility.',
  ],
  targetedNeeds: ['GUT_RESTORATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Shoba 1998 (Planta Med) demonstrated 2000% increase in curcumin bioavailability. Used in ' +
    'every kit containing curcumin or polyphenols to maximize absorption.',
  contraindications: [
    'Active GI ulcerative disease',
    'Concurrent narrow-therapeutic-index drugs (CYP/UGT modulation)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '5–10 mg standardized piperine per day',
    maximum: '20 mg',
    unit: 'mg',
    frequency: 'With each curcumin/polyphenol dose',
    notes: 'Always pair with curcumin or fat-soluble actives for synergistic absorption.',
  },
  interactions: [
    { ingredient: 'Curcumin', type: 'SYNERGISTIC', note: '~20× bioavailability boost.' },
    { ingredient: 'CYP3A4 substrate drugs', type: 'ANTAGONISTIC', note: 'May raise plasma levels of co-administered drugs.' },
    { ingredient: 'Phenytoin / theophylline', type: 'ANTAGONISTIC', note: 'Plasma level elevation possible.' },
  ],
  sideEffects: ['Mild GI burning at high doses'],
  onsetOfAction: 'Absorption enhancement is immediate with co-administered actives.',
  references: ['Shoba G et al. Planta Med 1998;64:353-356'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Digestive Enzymes
// ─────────────────────────────────────────────────────────────────────────────

export const DIGESTIVE_ENZYMES: IngredientKnowledge = {
  ingredientId: 'digestive_enzymes',
  displayName: 'Digestive Enzymes (Plant-derived)',
  aliases: ['Lipase/Protease/Amylase blend', 'Bromelain', 'Papain'],
  category: 'PROBIOTIC',
  mechanismsOfAction: [
    'Exogenous protease, lipase, and amylase support macronutrient hydrolysis and absorption.',
    'Reduces undigested food load reaching the colon, supporting microbiome balance.',
  ],
  targetedNeeds: ['GUT_RESTORATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Plant and pancreatic enzyme blends documented for functional dyspepsia and macronutrient ' +
    'absorption. Used in PRO IMMUNE GOLD bundle.',
  contraindications: [
    'Acute pancreatitis',
    'Pancreatic insufficiency (requires medical-grade pancreatic enzymes, not OTC plant-derived)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '1 capsule with each main meal',
    unit: 'capsule',
    frequency: 'With meals',
    notes: 'Choose broad-spectrum plant enzyme blends for vegetarian-friendly formulations.',
  },
  interactions: [],
  sideEffects: ['Mild GI upset'],
  onsetOfAction: 'Improvement in digestive comfort within days.',
};
