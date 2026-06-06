/**
 * ANTI-INFLAMMATORY & ANTIOXIDANT INGREDIENTS
 *
 * Cytokine, NF-κB, Nrf2, and oxidative-load modulators referenced across
 * PHENOTYPE INFLAMATION, PRO IMMUNE GOLD, HAIR FACT ALOPECIA AREATA,
 * F-PCOS-1, MPHL/FPHL, and OXIDATIVE STRESS SHIELD.
 *
 * Source: All Kits Info.docx + Master KB §15, §22.
 */

import type { IngredientKnowledge } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Curcumin
// ─────────────────────────────────────────────────────────────────────────────

export const CURCUMIN: IngredientKnowledge = {
  ingredientId: 'curcumin',
  displayName: 'Curcumin',
  aliases: ['Turmeric extract', 'Diferuloylmethane', 'Curcuma longa extract'],
  category: 'ANTI_INFLAMMATORY',
  mechanismsOfAction: [
    'Inhibits NF-κB-driven pro-inflammatory cytokine production (IKK-β inhibition → blocked NF-κB nuclear translocation).',
    'Reduces TNF-α, IL-6, and IL-1β — the cytokines driving perifollicular inflammation in AGA and AA.',
    'Activates Nrf2/Keap1 antioxidant response element pathway, restoring redox defense.',
    'Stabilizes mast cells and eosinophils via histamine release suppression.',
    'In PCOS: improves glycemic control via AMPK activation; reduces fasting glucose.',
    'Supports gut microbiome balance (TE GOLD bundle context).',
  ],
  targetedNeeds: ['INFLAMMATION_CONTROL', 'IMMUNE_MODULATION', 'ANTIOXIDANT_SUPPORT'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Multiple meta-analyses (Aggarwal 2007; Sahebkar 2014) confirm reductions in CRP, TNF-α, IL-6. ' +
    'PCOS trials show glycemic and inflammatory improvement at 500–1500 mg/day for 8–12 weeks. ' +
    'Bioavailability is the limiting factor; co-formulation with piperine (Bioperine) raises ' +
    'plasma curcumin ~20×.',
  contraindications: [
    'Bile duct obstruction or active gallstones',
    'Anticoagulant therapy at high doses (additive bleeding risk)',
    'Iron deficiency (curcumin chelates iron in vitro)',
    'Pregnancy at therapeutic doses (uterotonic concerns)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1500 mg standardized to 95% curcuminoids per day',
    maximum: '2000 mg',
    unit: 'mg',
    frequency: 'Once or twice daily with meals',
    notes: 'Always pair with piperine 5–10 mg or use phytosome (Meriva) formulation for absorption.',
  },
  interactions: [
    { ingredient: 'Piperine (Bioperine)', type: 'SYNERGISTIC', note: 'Raises plasma curcumin ~20× via UGT inhibition.' },
    { ingredient: 'Warfarin / DOACs', type: 'SYNERGISTIC', note: 'Additive bleeding risk — monitor INR.' },
    { ingredient: 'Iron supplements', type: 'ANTAGONISTIC', note: 'May chelate iron; separate by 2 hours.' },
  ],
  sideEffects: ['GI upset', 'Yellow stool discolouration', 'Headache (uncommon)'],
  onsetOfAction: 'Inflammatory marker reduction over 4–8 weeks; clinical scalp benefit by 8–12 weeks.',
  references: [
    'Aggarwal BB. Adv Exp Med Biol 2007',
    'Sahebkar A. Phytother Res 2014',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// N-Acetyl Cysteine (NAC)
// ─────────────────────────────────────────────────────────────────────────────

export const NAC: IngredientKnowledge = {
  ingredientId: 'nac',
  displayName: 'N-Acetyl Cysteine',
  aliases: ['NAC', 'N-acetylcysteine'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'Cysteine donor — rate-limiting substrate for glutathione (GSH) biosynthesis, the master intracellular antioxidant.',
    'Reduces interleukin-mediated inflammation (IL-6, IL-1β).',
    'PCOS-specific: supports hormone balance, reduces hormonal dysfunction, improves ovulation and menstrual regularity in clinical trials.',
    'Supports follicle health and oxidative balance during peri-menopausal hormonal flux.',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'HORMONAL_REBALANCING', 'INFLAMMATION_CONTROL'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Thakker 2015 (Obstet Gynecol Int) meta-analysis: NAC improves PCOS ovulation rates and ' +
    'reduces free testosterone. Multiple trials show GSH restoration and reduced oxidative ' +
    'stress markers. Standard 600–1800 mg/day; PCOS trials use 1200–1800 mg/day.',
  contraindications: [
    'Active asthma (rare bronchospasm with inhaled form)',
    'Concurrent nitrate therapy (potentiation)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '600–1200 mg per day; 1200–1800 mg/day in PCOS protocols',
    maximum: '1800 mg',
    unit: 'mg',
    frequency: 'Twice daily with meals',
    notes: 'GI tolerance improves with food. Effects on glutathione status emerge over 2–4 weeks.',
  },
  interactions: [
    { ingredient: 'Nitroglycerin / nitrates', type: 'SYNERGISTIC', note: 'Potentiates vasodilation.' },
    { ingredient: 'Activated charcoal', type: 'ANTAGONISTIC', note: 'Reduces absorption.' },
  ],
  sideEffects: ['GI upset', 'Sulfurous odor', 'Headache (uncommon)'],
  onsetOfAction: 'Redox effects within 2–4 weeks; PCOS hormonal effects over 8–12 weeks.',
  references: ['Thakker D et al. Obstet Gynecol Int 2015'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Resveratrol
// ─────────────────────────────────────────────────────────────────────────────

export const RESVERATROL: IngredientKnowledge = {
  ingredientId: 'resveratrol',
  displayName: 'Resveratrol',
  aliases: ['trans-Resveratrol', '3,5,4-trihydroxystilbene'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'Allosteric SIRT1 activator — supports mitochondrial biogenesis and stress response.',
    'Inhibits IKK-β reducing NF-κB nuclear translocation; downregulates TNF-α, IL-1β, IL-6.',
    'Suppresses MAPK p38 and JNK signaling.',
    'PCOS: improves insulin sensitivity via AMPK activation; reduces dyslipidaemia and regulates reproductive hormones.',
    'Supports immune cell function and dampens pro-inflammatory pathways.',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'INFLAMMATION_CONTROL', 'METABOLIC_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Banaszewska 2016 (J Clin Endocrinol Metab) RCT: 1500 mg/day resveratrol in PCOS reduced ' +
    'total testosterone (-23%) and DHEA-S (-22%) over 3 months. Anti-inflammatory effects ' +
    'documented across multiple inflammatory conditions.',
  contraindications: [
    'Estrogen-sensitive cancers (phyto-estrogenic activity)',
    'Anticoagulant therapy (additive bleeding risk at high doses)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '150–500 mg per day (cosmetic); 1000–1500 mg/day in PCOS trials',
    maximum: '1500 mg',
    unit: 'mg',
    frequency: 'Once or twice daily with meals',
    notes: 'Bioavailability is limited; micronized or liposomal forms preferred.',
  },
  interactions: [
    { ingredient: 'Warfarin / DOACs', type: 'SYNERGISTIC', note: 'Additive bleeding risk.' },
    { ingredient: 'CYP3A4 substrates', type: 'NEUTRAL', note: 'Mild CYP3A4 inhibition at high doses.' },
  ],
  sideEffects: ['GI upset', 'Headache (uncommon)'],
  onsetOfAction: 'Anti-inflammatory effects 4–8 weeks; PCOS hormonal effects 8–12 weeks.',
  references: ['Banaszewska B et al. J Clin Endocrinol Metab 2016;101:4322-4328'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Quercetin
// ─────────────────────────────────────────────────────────────────────────────

export const QUERCETIN: IngredientKnowledge = {
  ingredientId: 'quercetin',
  displayName: 'Quercetin',
  aliases: ['Quercetin dihydrate', 'Sophoretin'],
  category: 'ANTI_INFLAMMATORY',
  mechanismsOfAction: [
    'Mast cell stabilizer — inhibits calcium influx and histamine release.',
    'Inhibits 5-lipoxygenase (LOX) and phospholipase A2 (PLA2) reducing leukotriene generation.',
    'Modulates NF-κB; suppresses TNF-α and IL-6.',
    'Direct antioxidant — scavenges peroxyl and hydroxyl radicals.',
    'Supports hair matrix repair and growth signalling (MPHL/FPHL docx context).',
  ],
  targetedNeeds: ['INFLAMMATION_CONTROL', 'ANTIOXIDANT_SUPPORT', 'FOLLICLE_STIMULATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Mast-cell stabilization and antihistamine effects documented in vitro and ex-vivo. ' +
    'Used in PRO IMMUNE GOLD and MPHL/FPHL as part of antioxidant + anti-inflammatory bundle.',
  contraindications: [
    'Concurrent cyclosporine (raises cyclosporine levels)',
    'High-dose CYP3A4 substrate drugs (mild CYP modulation)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1000 mg per day',
    maximum: '1500 mg',
    unit: 'mg',
    frequency: 'Twice daily with meals',
    notes: 'Pair with bromelain or vitamin C for improved absorption.',
  },
  interactions: [
    { ingredient: 'Cyclosporine', type: 'ANTAGONISTIC', note: 'Raises cyclosporine plasma levels.' },
    { ingredient: 'Quinolones', type: 'ANTAGONISTIC', note: 'May reduce antibacterial efficacy at high doses.' },
  ],
  sideEffects: ['Headache', 'Tingling sensation (uncommon)', 'GI upset'],
  onsetOfAction: 'Anti-inflammatory effects 4–8 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Green Tea Extract (EGCG)
// ─────────────────────────────────────────────────────────────────────────────

export const GREEN_TEA_EGCG: IngredientKnowledge = {
  ingredientId: 'green_tea_egcg',
  displayName: 'Green Tea Extract (EGCG)',
  aliases: ['Camellia sinensis extract', 'Epigallocatechin gallate', 'EGCG'],
  category: 'ANTIOXIDANT',
  mechanismsOfAction: [
    'EGCG inhibits IKK-β and NF-κB nuclear translocation; downregulates IL-1β and TNF-α.',
    'Reduces neutrophil chemotaxis (accumulation, travel speed, distance) and ROS release.',
    'Free-radical scavenger; reduces lipid peroxide formation.',
    'Weak 5α-reductase inhibition documented in vitro — adjunctive androgen modulation.',
    'Modulates STAT3 inflammatory signaling.',
  ],
  targetedNeeds: ['ANTIOXIDANT_SUPPORT', 'INFLAMMATION_CONTROL'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Multiple meta-analyses confirm anti-inflammatory and cardiovascular benefits. EGCG ' +
    'at 200–400 mg/day demonstrates reductions in CRP and oxidative markers. Used in HAIR ' +
    'FACT TE GOLD and PRO IMMUNE GOLD.',
  contraindications: [
    'Hepatic impairment (rare hepatotoxicity at high-dose extracts)',
    'Pregnancy at high doses (folate competition)',
    'Iron deficiency (catechins chelate iron — separate by 2 hours)',
    'Concurrent stimulants (caffeine content)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '200–400 mg EGCG per day',
    maximum: '800 mg',
    unit: 'mg',
    frequency: 'Once or twice daily with food',
    notes: 'Take with food to reduce hepatotoxicity risk; monitor LFTs if prolonged high-dose use.',
  },
  interactions: [
    { ingredient: 'Iron supplements', type: 'ANTAGONISTIC', note: 'Catechins chelate iron — separate by 2 hours.' },
    { ingredient: 'Beta-blockers (Nadolol)', type: 'ANTAGONISTIC', note: 'Reduces absorption.' },
    { ingredient: 'Anticoagulants', type: 'SYNERGISTIC', note: 'Mild additive bleeding risk.' },
  ],
  sideEffects: ['GI upset', 'Headache from caffeine content', 'Rare hepatotoxicity at high doses'],
  onsetOfAction: 'Antioxidant effects within 2–4 weeks; clinical benefit over 8–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mushroom Extract (Reishi/Lion's Mane blend)
// ─────────────────────────────────────────────────────────────────────────────

export const MUSHROOM_EXTRACT: IngredientKnowledge = {
  ingredientId: 'mushroom_extract',
  displayName: 'Medicinal Mushroom Extract',
  aliases: ['Reishi (Ganoderma lucidum)', "Lion's Mane (Hericium erinaceus)", 'Beta-glucan extract'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'β-glucans engage dectin-1 and TLR2 modulating innate immunity.',
    'Inhibits IL-1β, NF-κB, ICAM-1, COX-2, iNOS (PRO IMMUNE GOLD docx).',
    'Cholesterol-lowering — decreases VLDL, improves lipid metabolism, inhibits HMG-CoA reductase.',
    'Modest immune-modulatory effect supporting balanced inflammatory tone.',
  ],
  targetedNeeds: ['IMMUNE_MODULATION', 'INFLAMMATION_CONTROL'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple species (Reishi, Lion\'s Mane, Maitake) documented for immunomodulatory and lipid effects. ' +
    'Used in PRO IMMUNE GOLD and PHENOTYPE INFLAMATION bundles.',
  contraindications: [
    'Mushroom allergy',
    'Concurrent anticoagulants (mild antiplatelet effect)',
    'Active autoimmune flare (theoretical immune activation — use under supervision)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1500 mg β-glucan-standardized extract per day',
    maximum: '3000 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Look for ≥30% β-glucan standardization for immune effects.',
  },
  interactions: [
    { ingredient: 'Anticoagulants', type: 'SYNERGISTIC', note: 'Mild antiplatelet effect.' },
    { ingredient: 'Immunosuppressants', type: 'ANTAGONISTIC', note: 'May reduce efficacy.' },
  ],
  sideEffects: ['GI upset', 'Allergic reactions in mushroom-allergic patients'],
  onsetOfAction: 'Immune and lipid effects emerge over 4–12 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Omega-3 (EPA/DHA)
// ─────────────────────────────────────────────────────────────────────────────

export const OMEGA_3: IngredientKnowledge = {
  ingredientId: 'omega_3',
  displayName: 'Omega-3 EPA/DHA',
  aliases: ['Fish oil', 'EPA', 'DHA', 'Eicosapentaenoic acid', 'Docosahexaenoic acid'],
  category: 'ANTI_INFLAMMATORY',
  mechanismsOfAction: [
    'EPA precursor to resolvin E series; DHA precursor to resolvin D series and protectin D1 — active resolution of inflammation.',
    'Competitive substrate for COX/LOX shifting eicosanoid balance away from pro-inflammatory products.',
    'Reduces TNF-α, IL-6, CRP in inflammatory states.',
    'Supports cell membrane phospholipid composition in scalp keratinocytes.',
    'Enhances hair strength and elasticity; improves scalp condition (MPHL/FPHL docx).',
  ],
  targetedNeeds: ['INFLAMMATION_CONTROL', 'ANTIOXIDANT_SUPPORT', 'SHAFT_REPAIR'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Calder 2017 (Biochem Soc Trans): comprehensive review of EPA/DHA anti-inflammatory mechanisms. ' +
    'Documented cardiovascular and anti-inflammatory benefits. Hair-specific data more limited but ' +
    'consistent with scalp-inflammation reduction.',
  contraindications: [
    'Active bleeding or pre-operative period at high doses (>3 g/day)',
    'Fish allergy (use algal DHA alternative)',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '1000–2000 mg combined EPA+DHA per day',
    maximum: '3000 mg combined',
    unit: 'mg',
    frequency: 'Once or twice daily with meals',
    notes: 'Triglyceride form preferred over ethyl ester for absorption; refrigerate to prevent oxidation.',
  },
  interactions: [
    { ingredient: 'Warfarin / DOACs', type: 'SYNERGISTIC', note: 'Additive bleeding risk at high doses (>3 g/day).' },
    { ingredient: 'Antiplatelet agents', type: 'SYNERGISTIC', note: 'Monitor for bleeding signs.' },
  ],
  sideEffects: ['Fish-oil burp', 'GI upset', 'Mild loose stools'],
  onsetOfAction: 'Anti-inflammatory effects within 4–8 weeks; shaft quality changes over months.',
  references: ['Calder PC. Biochem Soc Trans 2017'],
};
