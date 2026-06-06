/**
 * ADAPTOGEN & SLEEP-AXIS INGREDIENTS
 *
 * Stress, cortisol, sleep, and circadian regulators referenced across
 * HAIR FACT TE GOLD, PRO IMMUNE GOLD, HAIR FACT ALOPECIA AREATA,
 * META B, F-PCOS-1 / PRO FACT META B PCOS, and PHENOTYPE INFLAMATION.
 *
 * Source: All Kits Info.docx + HAIROS_CLINICAL_INTELLIGENCE_MASTER_KNOWLEDGE_MODEL.
 */

import type { IngredientKnowledge } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Ashwagandha — Withania somnifera
// ─────────────────────────────────────────────────────────────────────────────

export const ASHWAGANDHA: IngredientKnowledge = {
  ingredientId: 'ashwagandha',
  displayName: 'Ashwagandha (Withania somnifera)',
  aliases: ['Withania somnifera', 'Indian Ginseng', 'Winter Cherry', 'KSM-66'],
  category: 'ADAPTOGEN',
  mechanismsOfAction: [
    'HPA-axis modulation — lowers serum cortisol and dampens stress-driven catagen induction in scalp follicles.',
    'Suppresses pro-inflammatory cytokines TNF-α, IL-1β and superoxide production around perifollicular immune cells.',
    'In peri-menopausal women: phyto-estrogenic effect raises serum estradiol and reduces FSH and LH without affecting testosterone (Gopal 2021, n=91 RCT).',
    'Increases CD4+ helper T-cells and NK/CD56+ cells, supporting balanced immunity in stress-driven and autoimmune profiles.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET', 'INFLAMMATION_CONTROL', 'HORMONAL_REBALANCING'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Gopal 2021 (J Obstet Gynaecol Res, n=100 perimenopausal women, 300 mg BID, 8 weeks): ' +
    'significant reductions in MRS total score (p<0.0001), psychological, somato-vegetative ' +
    'and urogenital domains; significant increase in estradiol and reduction in FSH/LH. ' +
    'Speers 2021 (Curr Neuropharmacol): documented anxiolytic and stress-reducing effect. ' +
    'Multiple meta-analyses confirm cortisol-lowering and anxiolytic action.',
  contraindications: [
    'Pregnancy (uterotonic concerns at higher doses)',
    'Active hyperthyroidism (rare case reports of thyrotoxicosis)',
    'Concurrent immunosuppressant therapy (theoretical antagonism)',
    'Autoimmune disease — use under clinical supervision (theoretical immune stimulation)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '300–600 mg KSM-66 root extract per day',
    minimum: '125 mg per day',
    maximum: '1200 mg per day under supervision',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Take with meals to reduce GI sensitivity; allow 6–8 weeks for stress-axis effects to manifest.',
  },
  interactions: [
    { ingredient: 'Sedatives / benzodiazepines', type: 'SYNERGISTIC', note: 'Additive sedation; reduce dose if combined.' },
    { ingredient: 'Thyroid hormone replacement', type: 'NEUTRAL', note: 'Monitor TSH; case reports of additive thyroid effect.' },
    { ingredient: 'Immunosuppressants', type: 'ANTAGONISTIC', note: 'May reduce immunosuppressant efficacy.' },
  ],
  sideEffects: [
    'Mild GI upset at high doses',
    'Drowsiness (uncommon)',
    'Rare thyroid stimulation in susceptible individuals',
  ],
  onsetOfAction: 'Stress and sleep effects begin within 2 weeks; full HPA-axis modulation by 6–8 weeks.',
  references: [
    'Gopal S et al. J Obstet Gynaecol Res 2021;47(12):4414-4425',
    'Speers AB et al. Curr Neuropharmacol 2021;19(9):1468-1495',
    'Mikulska P et al. Pharmaceutics 2023;15(4):1057',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Melatonin
// ─────────────────────────────────────────────────────────────────────────────

export const MELATONIN: IngredientKnowledge = {
  ingredientId: 'melatonin',
  displayName: 'Melatonin',
  aliases: ['N-acetyl-5-methoxytryptamine'],
  category: 'HORMONE_MODULATOR',
  mechanismsOfAction: [
    'MT1/MT2 receptor agonism on dermal papilla cells and outer root sheath prolongs anagen and delays anagen-to-catagen transition.',
    'Stimulates hair follicle stem cell proliferation, supporting cycle re-entry in stress-driven and autoimmune profiles.',
    'Direct free-radical scavenger and mitochondrial protectant; supports glutathione and reduces lipid peroxidation in follicular cells.',
    'Modest local 5α-reductase modulation at follicle level (TE GOLD docx).',
    'In peri/post-menopause: reduces frequency and severity of hot flashes, vaginal dryness, night sweats; improves mood and sleep quality.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET', 'ANTIOXIDANT_SUPPORT', 'FOLLICLE_STIMULATION'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Demirhan Kayacik 2024 (Arch Womens Ment Health): meta-analysis supports melatonin for ' +
    'mood and anxiety in postmenopausal women. Topical 0.1% melatonin shown to prolong anagen ' +
    'in scalp organ culture and increase anagen-hair proportion in clinical pilot studies. ' +
    'RCT-grade evidence for sleep quality; moderate evidence for hair-cycle effects.',
  contraindications: [
    'Concurrent CNS depressants without supervision',
    'Anticoagulant therapy (potentiation reported)',
    'Pregnancy (limited safety data)',
    'Autoimmune disease — clinical judgement (used in HAIR FACT ALOPECIA AREATA kit; docx supports use)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '0.5–3 mg at bedtime (oral); 0.1% topical for scalp protocols',
    minimum: '0.3 mg',
    maximum: '5 mg oral',
    unit: 'mg',
    frequency: 'Once daily at bedtime',
    notes: 'Start at lowest effective dose; tolerance is rare. Topical formulations applied to scalp once daily evening.',
  },
  interactions: [
    { ingredient: 'Benzodiazepines / Z-drugs', type: 'SYNERGISTIC', note: 'Additive sedation.' },
    { ingredient: 'Warfarin', type: 'SYNERGISTIC', note: 'May potentiate anticoagulation — monitor INR.' },
    { ingredient: 'Antihypertensives', type: 'NEUTRAL', note: 'Mild additive blood pressure effect at high dose.' },
  ],
  sideEffects: [
    'Morning grogginess at higher doses',
    'Vivid dreams',
    'Headache (uncommon)',
  ],
  onsetOfAction: 'Sleep effect within 1–2 nights; hair-cycle effects manifest over 3–6 months.',
  references: [
    'Demirhan Kayacik A. Arch Womens Ment Health 2024;27:265-273',
    'Toffol E et al. Menopause 2014;21(5):493-500',
    'Parandavar N et al. Iran J Public Health 2014;43(10):1405-16',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// L-Theanine
// ─────────────────────────────────────────────────────────────────────────────

export const L_THEANINE: IngredientKnowledge = {
  ingredientId: 'l_theanine',
  displayName: 'L-Theanine',
  aliases: ['γ-glutamylethylamide', 'r-glutamylethylamide'],
  category: 'ADAPTOGEN',
  mechanismsOfAction: [
    'Partial agonism at NMDA receptors; modulates glutamatergic tone reducing stress-driven cortical hyperactivation.',
    'Modulates GABA, dopamine, and serotonin; promotes alpha-wave EEG activity associated with calm focus.',
    'Reduces anxiety without sedation — clinically meaningful in stress-driven hair-loss profiles.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple randomised crossover trials demonstrate acute anxiolytic and attentional benefit at 200 mg. ' +
    'Used in PRO IMMUNE GOLD and HAIR FACT ALOPECIA AREATA kits as part of stress-control bundle.',
  contraindications: [
    'Concurrent CNS depressants (additive effect — monitor)',
    'Pregnancy (limited safety data)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '100–200 mg per day',
    maximum: '400 mg per day',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Onset within 30–40 minutes; safe for sustained daily use.',
  },
  interactions: [
    { ingredient: 'Caffeine', type: 'SYNERGISTIC', note: 'Improves focus and reduces caffeine jitteriness.' },
    { ingredient: 'Antihypertensives', type: 'SYNERGISTIC', note: 'Mild additive BP-lowering effect.' },
  ],
  sideEffects: ['Mild headache (uncommon)', 'GI upset (rare)'],
  onsetOfAction: 'Acute calming effect within 30–40 minutes; chronic stress reduction over weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// L-Tyrosine
// ─────────────────────────────────────────────────────────────────────────────

export const L_TYROSINE: IngredientKnowledge = {
  ingredientId: 'l_tyrosine',
  displayName: 'L-Tyrosine',
  aliases: ['Tyrosine', 'L-tyr'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Substrate for tyrosine hydroxylase producing L-DOPA → dopamine → norepinephrine; supports catecholaminergic stress resilience.',
    'Thyroid hormone synthesis substrate — supports T4/T3 production in thyroid-related hair-cycle disruption.',
    'Cognitive performance preservation under acute physical or psychological stress.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET', 'THYROID_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Acute stress and military trials demonstrate preservation of working memory and cognitive ' +
    'flexibility under stress. Used in PRO IMMUNE GOLD, MPHL/FPHL, PHENOTYPE INFLAMATION, and ' +
    'PCOS bundles as part of stress and neurotransmitter support.',
  contraindications: [
    'Hyperthyroidism',
    'Concurrent MAOIs',
    'Phenylketonuria',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1000 mg per day',
    maximum: '2000 mg per day',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Take on empty stomach for best absorption; avoid late evening dosing.',
  },
  interactions: [
    { ingredient: 'MAOIs', type: 'ANTAGONISTIC', note: 'Risk of hypertensive crisis.' },
    { ingredient: 'Levodopa', type: 'ANTAGONISTIC', note: 'Reduces L-DOPA efficacy.' },
    { ingredient: 'Thyroid replacement', type: 'NEUTRAL', note: 'Monitor TSH; mild additive thyroid effect possible.' },
  ],
  sideEffects: ['GI upset', 'Headache', 'Insomnia if dosed late'],
  onsetOfAction: 'Cognitive effects within 60–90 minutes; thyroid effects over weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Valerian Root
// ─────────────────────────────────────────────────────────────────────────────

export const VALERIAN_ROOT: IngredientKnowledge = {
  ingredientId: 'valerian_root',
  displayName: 'Valerian Root (Valeriana officinalis)',
  aliases: ['Valeriana officinalis', 'Garden valerian'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'Valerenic acid acts as positive allosteric modulator at GABA-A receptors — promotes sleep onset.',
    'Antioxidant and mild anti-inflammatory effects documented in vitro.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Multiple RCTs demonstrate modest improvement in subjective sleep quality (PSQI). ' +
    'Used in PRO IMMUNE GOLD bundle for sleep cycle regulation.',
  contraindications: [
    'Pregnancy and lactation',
    'Concurrent CNS depressants (additive sedation)',
    'Hepatic impairment (rare hepatotoxicity reports with prolonged use)',
  ],
  pregnancySafe: false,
  breastfeedingSafe: false,
  dosageGuidance: {
    typical: '300–600 mg standardized extract before bedtime',
    maximum: '900 mg',
    unit: 'mg',
    frequency: 'Once daily at bedtime',
    notes: 'Allow 2–4 weeks for cumulative sleep benefit. Avoid driving until tolerance is established.',
  },
  interactions: [
    { ingredient: 'Benzodiazepines / Z-drugs / antihistamines', type: 'SYNERGISTIC', note: 'Additive sedation.' },
    { ingredient: 'Alcohol', type: 'SYNERGISTIC', note: 'Avoid combination.' },
  ],
  sideEffects: ['Morning drowsiness', 'Vivid dreams', 'GI upset (uncommon)'],
  onsetOfAction: 'Sleep onset effect within 30–60 minutes; full effect within 2–4 weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Chamomile
// ─────────────────────────────────────────────────────────────────────────────

export const CHAMOMILE: IngredientKnowledge = {
  ingredientId: 'chamomile',
  displayName: 'Chamomile (Matricaria recutita)',
  aliases: ['Matricaria recutita', 'German chamomile'],
  category: 'BOTANICAL',
  mechanismsOfAction: [
    'Apigenin binds benzodiazepine site on GABA-A receptors producing modest anxiolytic effect.',
    'Phenolic compounds provide antioxidant, anti-inflammatory and mild anti-allergic activity (mast-cell stabilization).',
    'RCT-grade reduction in generalized anxiety symptoms.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET', 'INFLAMMATION_CONTROL'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Mao 2016 (Phytomedicine) and Amsterdam 2009 (J Clin Psychopharmacol) demonstrate clinically ' +
    'meaningful reductions in GAD symptoms. Used in PRO IMMUNE GOLD and HAIR FACT ALOPECIA AREATA ' +
    'as part of stress and sleep support bundle.',
  contraindications: [
    'Asteraceae family allergy (ragweed, marigold)',
    'Concurrent anticoagulants (theoretical additive bleeding risk at high doses)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '220–500 mg standardized extract per day',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Apigenin content is the standardization target; allow 4–8 weeks for anxiety effects.',
  },
  interactions: [
    { ingredient: 'Warfarin / anticoagulants', type: 'SYNERGISTIC', note: 'Theoretical additive effect — monitor at high doses.' },
    { ingredient: 'CYP3A4 substrates', type: 'NEUTRAL', note: 'Mild CYP3A4 modulation at high doses.' },
  ],
  sideEffects: ['Allergic skin reactions in Asteraceae-sensitive patients', 'GI upset (rare)'],
  onsetOfAction: 'Anxiety reduction over 4–8 weeks; acute calming effect within hours.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tryptophan
// ─────────────────────────────────────────────────────────────────────────────

export const TRYPTOPHAN: IngredientKnowledge = {
  ingredientId: 'tryptophan',
  displayName: 'L-Tryptophan',
  aliases: ['L-Trp', 'Tryptophan'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Substrate for serotonin (5-HT) and melatonin biosynthesis — supports mood and circadian rhythm.',
    'Niacin precursor (kynurenine pathway) when B6 sufficient.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Documented mood and sleep-onset benefit in low-tryptophan states; modest effect in replete adults. ' +
    'Used in HAIR FACT TE GOLD as part of stress-modulation bundle.',
  contraindications: [
    'Concurrent SSRIs/MAOIs (serotonin syndrome risk)',
    'Eosinophilia-myalgia syndrome history (historical contamination)',
  ],
  pregnancySafe: 'CONSULT_REQUIRED',
  breastfeedingSafe: 'CONSULT_REQUIRED',
  dosageGuidance: {
    typical: '500–1000 mg evening',
    maximum: '2000 mg',
    unit: 'mg',
    frequency: 'Once daily evening',
    notes: 'Pair with B6 for kynurenine pathway efficiency; avoid concurrent SSRIs.',
  },
  interactions: [
    { ingredient: 'SSRIs / SNRIs / MAOIs', type: 'ANTAGONISTIC', note: 'Serotonin syndrome risk — avoid combination.' },
  ],
  sideEffects: ['GI upset', 'Drowsiness'],
  onsetOfAction: 'Sleep onset within 1–2 hours; mood effects over weeks.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Magnesium
// ─────────────────────────────────────────────────────────────────────────────

export const MAGNESIUM: IngredientKnowledge = {
  ingredientId: 'magnesium',
  displayName: 'Magnesium',
  aliases: ['Magnesium glycinate', 'Magnesium citrate', 'Magnesium L-threonate'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Endogenous NMDA receptor antagonist — reduces glutamatergic hyperactivation contributing to anxiety.',
    'Cofactor for >300 enzymes including ATP synthesis (mitochondrial OXPHOS).',
    'Supports GABAergic tone and sleep architecture.',
    'Clinical trials show modest anxiolytic and antidepressant effects in deficiency.',
  ],
  targetedNeeds: ['CIRCADIAN_RESET', 'METABOLIC_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Boyle 2017 (Nutrients) meta-analysis: magnesium supplementation associated with modest reductions ' +
    'in anxiety and depression symptoms. Used in HAIR FACT ALOPECIA AREATA, F-PCOS-1, and ' +
    'META B kits for stress regulation.',
  contraindications: [
    'Severe renal impairment (risk of hypermagnesemia)',
    'High-grade heart block (high-dose IV magnesium)',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '200–400 mg elemental magnesium per day',
    maximum: '600 mg',
    unit: 'mg',
    frequency: 'Once or twice daily',
    notes: 'Glycinate and threonate forms preferred for sleep/anxiety; citrate has laxative effect.',
  },
  interactions: [
    { ingredient: 'Tetracyclines / quinolones', type: 'ANTAGONISTIC', note: 'Chelates and reduces absorption — separate by 2 hours.' },
    { ingredient: 'Bisphosphonates', type: 'ANTAGONISTIC', note: 'Reduced absorption.' },
  ],
  sideEffects: ['Loose stools (citrate form)', 'Mild GI cramping'],
  onsetOfAction: 'Sleep and anxiety effects over 1–4 weeks.',
};
