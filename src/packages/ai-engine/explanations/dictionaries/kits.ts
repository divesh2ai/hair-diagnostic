import type { KitDictionary } from '../types';

// Explanations for every Kit ID used across all protocols.
// Keys match the string values in PROTOCOL_SEQUENCER phases[] arrays exactly.
// expectedOutcomes are patient-measurable outcomes, not mechanism descriptions.
export const KIT_EXPLANATIONS: KitDictionary = {

  'HAIR FACT TE GOLD': {
    clinical:
      'Telogen effluvium arrest formula. Combines ashwagandha (cortisol modulation), standardised tocotrienols, biotin, zinc, and amino acid precursors to stabilise telogen-anagen cycling.',
    patient:
      'A comprehensive shedding-arrest supplement that gives your follicles the stabilising support they need to stop the excessive hair fall.',
    expectedOutcomes: [
      'Noticeable reduction in daily hair shedding within 6–10 weeks',
      'Improved hair texture and reduced scalp sensitivity',
      'Stabilised hair growth cycle with fewer hairs in the resting phase',
    ],
    mechanismOfAction:
      'Cortisol modulation via adaptogenic compounds; micronutrient repletion of follicular matrix cells; anti-inflammatory support to stabilise anagen phase.',
    targetNeeds: ['SHEDDING_ARREST', 'INFLAMMATION_CONTROL'],
    category: 'shedding',
  },

  'PHENOTYPE INFLAMATION': {
    clinical:
      'Broad-spectrum scalp and systemic anti-inflammatory formula. NF-kB and TNF-α inhibition via curcumin-piperine complex, quercetin, and omega-3s to restore the perifollicular microenvironment.',
    patient:
      'A targeted anti-inflammatory supplement that clears the scalp and systemic inflammation creating a hostile environment for your hair follicles.',
    expectedOutcomes: [
      'Reduced scalp redness, sensitivity, or oiliness within 4–8 weeks',
      'Improved scalp environment conducive to new hair growth',
      'Reduced systemic inflammatory markers supporting overall wellbeing',
    ],
    mechanismOfAction:
      'NF-kB pathway inhibition; TNF-α and IL-6 downregulation via curcumin complex, quercetin, and long-chain omega-3 fatty acids.',
    targetNeeds: ['INFLAMMATION_CONTROL'],
    category: 'inflammation',
  },

  'MPHL': {
    clinical:
      'Male pattern hair loss formula. Saw palmetto (5α-reductase inhibition), lycopene, beta-sitosterol, and pumpkin seed oil for DHT suppression and follicular androgen receptor modulation.',
    patient:
      'A male-specific formula that blocks the DHT hormone responsible for shrinking your hair follicles and causing pattern hair loss.',
    expectedOutcomes: [
      'Reduced progression of hairline recession and vertex thinning',
      'Improved hair density in thinning areas over 3–6 months',
      'Reduced scalp oiliness associated with androgenic activity',
    ],
    mechanismOfAction:
      '5α-reductase type II inhibition via saw palmetto extract; androgen receptor modulation; reduction in scalp DHT concentration.',
    targetNeeds: ['DHT_SUPPRESSION', 'INFLAMMATION_CONTROL'],
    category: 'pattern_loss',
  },

  'FPHL': {
    clinical:
      'Female pattern hair loss formula. Spearmint, DIM, and adaptogenic compounds targeting female-pattern androgenetic miniaturisation without compromising oestrogen balance.',
    patient:
      'A female-specific formula designed to address the hormonal thinning pattern across the crown and top of the scalp.',
    expectedOutcomes: [
      'Reduced progression of diffuse crown thinning',
      'Improved hair density and diameter at the scalp surface',
      'More balanced hormonal environment supporting follicle health',
    ],
    mechanismOfAction:
      'Selective androgen receptor modulation; 5α-reductase inhibition via spearmint; DIM-mediated oestrogen pathway support.',
    targetNeeds: ['DHT_SUPPRESSION', 'ANDROGENIC_CORRECTION'],
    category: 'pattern_loss',
  },

  'PRO FACT META B': {
    clinical:
      'Metabolic terrain correction formula. Berberine (AMPK activator), chromium, alpha-lipoic acid, and B-complex for insulin sensitivity correction, SHBG upregulation, and androgenic axis normalisation.',
    patient:
      'A metabolic support formula that corrects the blood sugar and hormonal imbalances that are indirectly driving hair thinning.',
    expectedOutcomes: [
      'Improved insulin sensitivity and metabolic markers over 8–12 weeks',
      'Reduced free androgen levels contributing to hair thinning',
      'Better energy levels and reduced systemic inflammation',
    ],
    mechanismOfAction:
      'AMPK pathway activation via berberine; insulin sensitisation; SHBG upregulation to reduce free androgen bioavailability.',
    targetNeeds: ['METABOLIC_SUPPORT', 'DHT_SUPPRESSION'],
    category: 'metabolic',
  },

  'PRO IMMUNE GOLD': {
    clinical:
      'Immune-nutritional regrowth formula. Colostrum, lactoferrin, EGF precursors, vitamin D3, zinc, and selenium for immune rebalancing and follicular anagen phase re-entry stimulation.',
    patient:
      'A premium immune and regrowth formula that rebuilds immune resilience while providing the growth signals your follicles need to produce new hair.',
    expectedOutcomes: [
      'Improved immune resilience and reduced frequency of illness',
      'Visible new hair growth in previously thinning areas over 3–6 months',
      'Improved hair thickness and tensile strength',
    ],
    mechanismOfAction:
      'Treg-mediated immune rebalancing; EGF/IGF-1 pathway support via colostrum/lactoferrin; antioxidant protection via selenium and vitamin D3.',
    targetNeeds: ['IMMUNE_MODULATION', 'FOLLICLE_STIMULATION'],
    category: 'immune',
  },

  'LACTIHEALTH': {
    clinical:
      'Lactation-specific nutritional formula. Elevated-dose iron, DHA, iodine, B12, zinc, and folate at prenatal-equivalent safety levels to address the heightened demands of breastfeeding.',
    patient:
      'A breastfeeding-specific nutritional supplement that addresses the exceptional nutrient demands of lactation to protect both your health and your hair.',
    expectedOutcomes: [
      'Maintained energy levels and nutritional status during breastfeeding',
      'Reduced post-partum shedding caused by lactation-driven nutrient depletion',
      'Support for healthy milk production and maternal wellbeing',
    ],
    mechanismOfAction:
      'Replaces micronutrients consumed at elevated rates during lactation; reduces nutritional TE triggered by lactational demand exceeding dietary supply.',
    targetNeeds: ['LACTATION_SUPPORT', 'SHEDDING_ARREST'],
    category: 'maternal',
  },

  'F-PCOS -1': {
    clinical:
      'PCOS-specific androgen correction formula. Myo-inositol, D-chiro-inositol (40:1 ratio), spearmint extract, and zinc for insulin-sensitisation and 5α-reductase inhibition in PCOS without metabolic co-morbidity.',
    patient:
      'A PCOS-specific formula that directly addresses the hormonal and insulin imbalances causing your hair thinning.',
    expectedOutcomes: [
      'Reduced androgenic hair thinning at crown and temples over 3–6 months',
      'Improved hormonal regularity and cycle balance',
      'Reduced scalp oiliness associated with PCOS androgen excess',
    ],
    mechanismOfAction:
      'Inositol-mediated insulin sensitisation reducing LH-stimulated androgen synthesis; spearmint 5α-reductase inhibition; zinc-mediated AR downregulation.',
    targetNeeds: ['ANDROGENIC_CORRECTION', 'DHT_SUPPRESSION'],
    category: 'hormonal',
  },

  'PRO FACT META B PCOS': {
    clinical:
      'PCOS-metabolic integrated formula. Combines berberine AMPK activation with myo-inositol androgen correction and spearmint 5α-reductase inhibition for PCOS with concurrent insulin resistance.',
    patient:
      'A powerful integrated formula that simultaneously addresses both the hormonal and metabolic sides of PCOS, designed for cases where both are active.',
    expectedOutcomes: [
      'Improved insulin sensitivity and reduced androgen-driven thinning',
      'More regulated hormonal cycle alongside improved hair density',
      'Reduced scalp oiliness and androgenic inflammation',
    ],
    mechanismOfAction:
      'AMPK activation (berberine) + inositol insulin sensitisation + 5α-reductase inhibition (spearmint). Replaces F-PCOS-1 in metabolic PCOS to avoid ingredient duplication.',
    targetNeeds: ['ANDROGENIC_CORRECTION', 'METABOLIC_SUPPORT', 'DHT_SUPPRESSION'],
    category: 'hormonal',
  },

  'PRO FACT META B HYPOTHYROID': {
    clinical:
      'Hypothyroid-specific metabolic support formula. Iodine, selenium, zinc, tyrosine, ashwagandha (KSH66), and B-complex for thyroid hormone synthesis co-factor support and TSH normalisation.',
    patient:
      'A formula specifically designed to support thyroid hormone production and help restore your metabolism, which is the foundation of your hair recovery.',
    expectedOutcomes: [
      'Improved energy levels and reduced cold sensitivity over 8–12 weeks',
      'Reduced diffuse shedding as thyroid function stabilises',
      'Support for TSH normalisation and metabolic rate recovery',
    ],
    mechanismOfAction:
      'Provides rate-limiting co-factors for T4 synthesis (iodine, selenium, tyrosine); reduces TSH-driven inflammation via adaptogenic support.',
    targetNeeds: ['THYROID_SUPPORT', 'METABOLIC_SUPPORT'],
    category: 'endocrine',
  },

  'PRO FACT THYROID CARE': {
    clinical:
      'Hyperthyroid support formula. Bugleweed, lemon balm, antioxidant complex, and magnesium for modulation of thyroid overactivity and reduction of hyperthyroid-driven oxidative follicular stress.',
    patient:
      'A formula that helps calm and support the overactive thyroid state, reducing the oxidative stress it creates in your hair follicles.',
    expectedOutcomes: [
      'Reduced symptoms of thyroid overactivity such as palpitations or heat intolerance',
      'Reduced oxidative follicular stress and improved hair stability',
      'Support for a more balanced thyroid metabolic state',
    ],
    mechanismOfAction:
      'Thyroid hormone synthesis modulation via bugleweed; antioxidant quenching of hyperthyroid-driven ROS; magnesium-mediated NMDA receptor stabilisation.',
    targetNeeds: ['THYROID_SUPPORT', 'ANTIOXIDANT_SUPPORT'],
    category: 'endocrine',
  },

  'HAIR FACT ALOPECIA AREATA': {
    clinical:
      'Alopecia areata-specific immune privilege restoration formula. Zinc, selenium, quercetin, vitamin D3, and adaptogenic compounds to restore Treg-mediated perifollicular immune tolerance.',
    patient:
      'A specialist formula designed to calm the immune response specifically targeting your hair follicles and create the conditions for regrowth.',
    expectedOutcomes: [
      'Arrest of new patchy hair loss episodes',
      'Visible regrowth in existing bald patches over 3–6 months',
      'Improved immune balance and reduced systemic inflammatory burden',
    ],
    mechanismOfAction:
      'Treg upregulation via vitamin D3 and quercetin; IL-10-mediated perifollicular immune suppression; antioxidant protection of follicular bulge immune privilege zone.',
    targetNeeds: ['IMMUNE_MODULATION', 'INFLAMMATION_CONTROL'],
    category: 'autoimmune',
  },

  'HAIR FACT PERI MENOPAUSE': {
    clinical:
      'Peri-menopausal hormonal stabilisation formula. Black cohosh, chasteberry, evening primrose oil, and phytoestrogens to modulate the hormonal fluctuation driving follicular vulnerability in peri-menopause.',
    patient:
      'A formula specifically designed for the peri-menopausal hormonal transition, helping to stabilise the fluctuations that are making your hair more vulnerable.',
    expectedOutcomes: [
      'Reduced hot flushes and hormonal fluctuation symptoms',
      'Stabilised hair density and reduced shedding episodes within 8–12 weeks',
      'Improved overall hormonal balance and wellbeing during transition',
    ],
    mechanismOfAction:
      'Phytoestrogenic modulation of declining oestrogen receptor activity; chasteberry-mediated LH/FSH balance; EPO-derived GLA reducing inflammatory prostaglandins.',
    targetNeeds: ['HORMONAL_REBALANCING', 'SHEDDING_ARREST'],
    category: 'hormonal',
  },

  'PRO FACT META B MENOPAUSE': {
    clinical:
      'Menopausal metabolic-hormonal correction formula. Phytoestrogen complex, berberine, and adaptogenic compounds targeting the oestrogen decline, metabolic shift, and androgenic acceleration of menopause.',
    patient:
      'A formula that addresses the combined hormonal and metabolic changes of menopause that are contributing to hair thinning.',
    expectedOutcomes: [
      'Improved hormonal balance and reduced menopausal symptoms',
      'Stabilised hair density and reduced progression of thinning',
      'Improved metabolic markers including blood sugar regulation',
    ],
    mechanismOfAction:
      'Phytoestrogen receptor modulation; AMPK-mediated metabolic correction; reduction of menopause-accelerated androgenic follicular susceptibility.',
    targetNeeds: ['HORMONAL_REBALANCING', 'METABOLIC_SUPPORT'],
    category: 'hormonal',
  },

  'PRO FACT META B POSTMENOPAUSE': {
    clinical:
      'Post-menopausal long-term metabolic-hormonal correction formula. Sustained phytoestrogen support, berberine, and antioxidant complex for the chronic low-oestrogen, insulin-resistant post-menopausal state.',
    patient:
      'A formula designed for the long-term hormonal and metabolic changes of post-menopause, addressing the sustained conditions driving ongoing hair thinning.',
    expectedOutcomes: [
      'Reduced progression of post-menopausal pattern hair thinning',
      'Improved bone and metabolic markers alongside hair improvement',
      'Better long-term hormonal resilience and reduced inflammatory burden',
    ],
    mechanismOfAction:
      'Sustained phytoestrogenic signalling; chronic insulin resistance correction via berberine; antioxidant protection of follicles under chronic low-oestrogen conditions.',
    targetNeeds: ['HORMONAL_REBALANCING', 'METABOLIC_SUPPORT', 'ANTIOXIDANT_SUPPORT'],
    category: 'hormonal',
  },

  'FH WELL 3': {
    clinical:
      'Endometriosis hormonal-inflammatory balance formula. DIM, omega-3 complex, and anti-inflammatory phytonutrients targeting the oestrogen-dominant prostaglandin-driven inflammatory pattern of endometriosis.',
    patient:
      'A formula that targets the specific hormonal-inflammatory balance associated with endometriosis, addressing its effects on your overall health and hair.',
    expectedOutcomes: [
      'Reduced pain and inflammation associated with endometriosis symptoms',
      'Improved hormonal balance and reduced oestrogen dominance markers',
      'Positive effect on hair health through shared inflammatory pathway correction',
    ],
    mechanismOfAction:
      'DIM-mediated oestrogen metabolism modulation; omega-3 prostaglandin pathway competition; broad-spectrum anti-inflammatory phytonutrient complex.',
    targetNeeds: ['HORMONAL_REBALANCING', 'INFLAMMATION_CONTROL'],
    category: 'hormonal',
  },

  'HEALTHY - 9': {
    clinical:
      'Pregnancy-safe comprehensive prenatal formula. Methylfolate, haem and non-haem iron, DHA, iodine, B12, D3, calcium, and zinc at evidence-based prenatal dosing with full foetal safety profile.',
    patient:
      'A complete prenatal supplement that supports your health and your baby\'s development throughout pregnancy, with every ingredient carefully selected for safety.',
    expectedOutcomes: [
      'Complete nutritional coverage for mother and foetal development',
      'Reduced risk of pregnancy-related nutrient deficiencies',
      'Support for healthy foetal neural and skeletal development',
    ],
    mechanismOfAction:
      'Complete prenatal micronutrient coverage at EFSA/NHS evidence-based doses; zero androgenic or stimulatory compounds; foetal-safe across all trimesters.',
    targetNeeds: ['PREGNANCY_SUPPORT'],
    category: 'maternal',
  },

  'IRON UP GOLD': {
    clinical:
      'High-bioavailability iron repletion formula. Ferrous bisglycinate chelate with vitamin C cofactor, copper, and B12 for optimised ferritin restoration without gastrointestinal side effects.',
    patient:
      'A gentle but highly effective iron supplement specifically designed to rebuild your iron stores quickly, without the digestive discomfort of conventional iron tablets.',
    expectedOutcomes: [
      'Measurable increase in serum ferritin within 8–12 weeks',
      'Significant reduction in shedding as ferritin levels reach therapeutic threshold',
      'Improved energy levels and reduced fatigue alongside hair improvement',
    ],
    mechanismOfAction:
      'Ferrous bisglycinate provides superior absorption with minimal GI irritation; vitamin C cofactor maximises non-haem iron bioavailability; copper supports haemoglobin synthesis.',
    targetNeeds: ['IRON_REPLETION', 'SHEDDING_ARREST'],
    category: 'nutritional',
  },

  'RAPID WEIGHT LOSS SHIELD': {
    clinical:
      'GLP-1/rapid weight loss telogen effluvium prevention formula. Protein matrix, ferritin precursors, zinc, and IGF-1 pathway support compounds to counteract the nutritional TE trigger of rapid weight reduction.',
    patient:
      'A protective shield formula specifically designed for people losing weight quickly, to protect your hair follicles from the nutritional stress of the weight loss process.',
    expectedOutcomes: [
      'Significantly reduced shedding during the active weight loss phase',
      'Maintained nutritional status for hair follicles despite caloric restriction',
      'Protection of ferritin and protein levels critical for hair growth',
    ],
    mechanismOfAction:
      'Replaces protein, ferritin, and IGF-1 precursors depleted by caloric restriction or GLP-1-driven appetite suppression; prevents the nutritional TE trigger threshold from being reached.',
    targetNeeds: ['WEIGHT_LOSS_RECOVERY', 'SHEDDING_ARREST'],
    category: 'nutritional',
  },

  'HAIR FACT TTM (OCD)': {
    clinical:
      'Trichotillomania neurological support formula. NAC (glutamate pathway modulation), inositol (serotonin sensitisation), magnesium glycinate, B6, zinc, and ashwagandha for OCD-spectrum compulsion reduction.',
    patient:
      'A neurological support formula that addresses the compulsive pathways involved in hair pulling, to help reduce the urge and support the recovery of affected follicles.',
    expectedOutcomes: [
      'Gradual reduction in the frequency or intensity of hair-pulling urges',
      'Improved anxiety and OCD-related symptom burden over 8–12 weeks',
      'Support for follicle recovery as pulling episodes reduce',
    ],
    mechanismOfAction:
      'NAC modulates glutamatergic pathways implicated in compulsive behaviour; inositol sensitises serotonin receptors; magnesium/B6 support GABA inhibitory neurotransmission.',
    targetNeeds: ['NEUROLOGICAL_OCD_SUPPORT'],
    category: 'neurological',
  },

  'HAIR FACT NIGHT SHIFT': {
    clinical:
      'Shift work circadian reset formula. Melatonin (physiological dose), L-theanine, magnesium bisglycinate, and adaptogenic complex to restore circadian rhythm, suppress nocturnal cortisol, and re-synchronise GH pulsatility.',
    patient:
      'A formula that helps reset your body clock and the hormonal rhythms disrupted by night shift work, creating the conditions for healthy hair growth.',
    expectedOutcomes: [
      'Improved sleep quality and circadian rhythm regularity',
      'Reduced morning cortisol levels and improved stress resilience',
      'Stabilised hair growth cycle as hormonal rhythms normalise over 6–12 weeks',
    ],
    mechanismOfAction:
      'Physiological-dose melatonin restores circadian entrainment; adaptogenic compounds normalise cortisol diurnal rhythm; magnesium supports parasympathetic sleep quality.',
    targetNeeds: ['CIRCADIAN_RESET', 'SHEDDING_ARREST'],
    category: 'circadian',
  },

  'HAIR FACT FREQUENT FLYERS': {
    clinical:
      'Travel stress and circadian desynchrony formula. Melatonin, vitamin C, antioxidant complex, and immune-modulatory compounds for transmeridian travel-associated circadian and oxidative stress.',
    patient:
      'A formula designed for frequent travellers that addresses the circadian disruption, immune stress, and oxidative effects of regular long-haul travel on hair health.',
    expectedOutcomes: [
      'Faster circadian readjustment after time zone changes',
      'Reduced immune vulnerability and travel-associated fatigue',
      'Protection of hair follicles from travel-related oxidative and immune stress',
    ],
    mechanismOfAction:
      'Melatonin-mediated circadian resynchronisation; antioxidant buffering against cosmic radiation-induced oxidative stress; immune support against travel-associated immune suppression.',
    targetNeeds: ['CIRCADIAN_RESET', 'IMMUNE_MODULATION', 'ANTIOXIDANT_SUPPORT'],
    category: 'circadian',
  },

  'OXIDATIVE STRESS': {
    clinical:
      'Systemic antioxidant and free radical neutralisation formula. Astaxanthin, glutathione precursors (NAC), CoQ10, alpha-lipoic acid, and resveratrol for comprehensive ROS burden reduction.',
    patient:
      'A powerful antioxidant formula that neutralises the free radical damage from lifestyle factors that is aging and weakening your hair follicles.',
    expectedOutcomes: [
      'Reduced oxidative markers and improved antioxidant capacity over 8–12 weeks',
      'Protection of hair follicles from further free radical damage',
      'Improved skin, scalp, and overall cellular health',
    ],
    mechanismOfAction:
      'Multi-pathway ROS neutralisation via glutathione precursors, mitochondrial CoQ10, lipophilic astaxanthin, and resveratrol-mediated SIRT1 activation.',
    targetNeeds: ['ANTIOXIDANT_SUPPORT', 'INFLAMMATION_CONTROL'],
    category: 'oxidative',
  },

  'PRO FACT GI GOLD': {
    clinical:
      'Gut microbiome restoration formula. Multi-strain probiotic complex (Lactobacillus/Bifidobacterium), prebiotic FOS, L-glutamine, and zinc carnosine for intestinal mucosal barrier repair and dysbiosis correction.',
    patient:
      'A comprehensive gut health formula that restores your microbiome and repairs your gut lining, so your body can properly absorb the nutrients your hair needs.',
    expectedOutcomes: [
      'Improved digestive comfort and reduced bloating or IBS symptoms within 4–8 weeks',
      'Improved nutrient absorption supporting hair follicle nutrition',
      'Reduced systemic inflammatory markers linked to gut permeability',
    ],
    mechanismOfAction:
      'Multi-strain probiotic recolonisation; FOS prebiotic substrate provision; L-glutamine enterocyte repair; zinc carnosine mucosal barrier restoration.',
    targetNeeds: ['GUT_RESTORATION', 'INFLAMMATION_CONTROL'],
    category: 'gastrointestinal',
  },

  'EARLY GREYING CARE GOLD': {
    clinical:
      'Premature canities correction formula. Copper (tyrosinase co-factor), PABA, B12, folic acid, catalase precursors, and melanocyte-protective antioxidants to slow melanocyte apoptosis and support pigment synthesis.',
    patient:
      'A specialist formula targeting the nutritional and oxidative causes of premature greying, to slow the process and protect your remaining pigment-producing cells.',
    expectedOutcomes: [
      'Slowed progression of new grey hair growth over 3–6 months',
      'Improved hair pigmentation in areas of early or partial greying',
      'Enhanced antioxidant protection of melanocyte stem cells',
    ],
    mechanismOfAction:
      'Copper-dependent tyrosinase activation for melanin synthesis; catalase upregulation to neutralise follicular H2O2 accumulation driving melanocyte apoptosis; PABA structural support.',
    targetNeeds: ['MELANOCYTE_PROTECTION', 'ANTIOXIDANT_SUPPORT'],
    category: 'pigmentation',
  },

  'HAIR FACT HAIR BREAKAGE REPAIR(HBR)': {
    clinical:
      'Hair shaft structural repair formula. Hydrolysed keratin, marine collagen peptides, silicon dioxide, biotin, and cysteine for cortical keratin cross-linking restoration and cuticle layer repair.',
    patient:
      'A hair shaft repair formula that rebuilds the structural integrity of your hair from within, reducing breakage and restoring smoothness and strength.',
    expectedOutcomes: [
      'Visibly reduced hair breakage and split ends within 6–8 weeks',
      'Improved hair tensile strength and resistance to physical stress',
      'Smoother hair texture with improved shine',
    ],
    mechanismOfAction:
      'Hydrolysed keratin peptide uptake provides disulphide bond repair substrates; marine collagen supports cortical fibre integrity; silicon strengthens the cuticle layer.',
    targetNeeds: ['SHAFT_REPAIR'],
    category: 'structural',
  },
};
