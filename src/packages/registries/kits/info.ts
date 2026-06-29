/**
 * Kit Information Registry
 *
 * Source of truth: All Kits Info.docx (clinical content authored by the
 * dermatology team). Each entry mirrors the document's five-section
 * structure: Diagnosis Insight, Treatment Objective, Therapeutic Strategy,
 * Formulation Rationale (with ingredient groups), Expected Response.
 *
 * Consumed by the report-engine to build the structured patient report
 * shown in the preview and PDF.
 */

export interface IngredientGroup {
  /** Functional grouping shown as a sub-heading, e.g. "DHT Modulators". */
  group: string;
  /** Ingredients in this group, exactly as named in the source doc. */
  ingredients: string[];
  /** What this group does for the follicle / system — one sentence. */
  action: string;
}

export interface ExpectedResponseWindow {
  /** Time window, e.g. "Weeks 2–4". */
  timeframe: string;
  /** Outcome the patient should see in that window. */
  outcome: string;
}

export interface KitInfo {
  /** Display title used in the report. */
  displayName: string;
  /** One-paragraph dermatologist-tone description of the condition the kit treats. */
  diagnosisInsight: string;
  /** Why this kit — one sentence. */
  treatmentObjective: string;
  /** 4-6 mechanism-level levers the kit pulls. */
  therapeuticStrategy: string[];
  /** Ingredient groups with mechanisms — verbatim from the source doc. */
  formulationRationale: IngredientGroup[];
  /** Time-windowed outcome expectations. */
  expectedResponse: ExpectedResponseWindow[];
  /** Optional dermatologist note about chronicity / sequencing / relapse risk. */
  clinicalNote?: string;
}

/**
 * Canonical entries keyed by display label. The kit-id-to-info resolver
 * maps every KitId variant (veg / non-veg / plus) to one of these.
 */
const ENTRIES: Record<string, KitInfo> = {
  TE_GOLD: {
    displayName: "Telogen Effluvium Stabilisation",
    diagnosisInsight:
      "The shedding pattern is consistent with Telogen Effluvium — a temporary disruption of the hair cycle where follicles prematurely shift into the resting (shedding) phase. This is typically triggered by systemic stressors such as physiological stress, illness, or nutritional depletion.",
    treatmentObjective:
      "Interrupt active shedding and restore normal follicular cycling by correcting internal imbalances.",
    therapeuticStrategy: [
      "Inflammation control → reduces follicular stress signals",
      "Nutritional repletion → restores iron, vitamins, amino acids",
      "Metabolic optimisation → improves cellular energy and growth signalling",
      "Hormonal modulation → supports a healthy follicular environment",
      "Stress regulation → normalises cortisol and sleep cycles",
    ],
    formulationRationale: [
      {
        group: "Nutritional activation & cellular repair",
        ingredients: ["Essential amino acids (Leucine, Isoleucine, Lysine)", "Vitamin D3", "B6", "Folic Acid", "Vitamin C"],
        action: "Provide keratin substrate, enhance follicular activation and immune balance, shift hair from telogen to anagen.",
      },
      {
        group: "Anti-inflammatory & antioxidant support",
        ingredients: ["Curcumin", "Kelp Seaweed Extract", "Moringa Extract"],
        action: "Reduce oxidative stress and stimulate IGF-1 / VEGF growth factors.",
      },
      {
        group: "Hormonal & follicle protection",
        ingredients: ["Melatonin", "Moringa Leaf Extract (phytosterols)"],
        action: "Regulate cortisol, modulate 5-alpha reductase, protect follicle integrity.",
      },
      {
        group: "Iron metabolism & recovery",
        ingredients: ["Lactoferrin"],
        action: "Improves iron absorption and ferritin levels — critical for chronic or prolonged TE.",
      },
      {
        group: "Gut & absorption optimisation",
        ingredients: ["Probiotics", "Bioperine", "Colostrum"],
        action: "Improve nutrient absorption, repair gut lining, supply growth factors for regeneration.",
      },
      {
        group: "Stress modulation & adaptogens",
        ingredients: ["Ashwagandha"],
        action: "Reduces cortisol and improves resilience to stress-induced hair fall.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Noticeable reduction in daily hair fall" },
      { timeframe: "Weeks 6–8", outcome: "Improved hair strength and reduced shedding variability" },
      { timeframe: "Weeks 10–12", outcome: "Visible early regrowth and cycle normalisation" },
    ],
    clinicalNote:
      "Foundational phase. Attempting growth stimulation without first stabilising shedding often leads to suboptimal or short-lived results.",
  },

  PRO_IMMUNE_GOLD: {
    displayName: "Pro-Immune Restoration",
    diagnosisInsight:
      "Recommended for hair fall and skin compromise associated with weakened immunity, chronic inflammation, or poor recovery from prior insults.",
    treatmentObjective:
      "Restore immune balance, reduce systemic inflammation, and create an internal environment that supports hair growth and skin repair.",
    therapeuticStrategy: [
      "Immune modulation → strengthens innate and adaptive immunity",
      "Inflammation control → reduces cytokine-driven follicular damage",
      "Oxidative stress reduction → protects follicles and skin cells",
      "Stress & sleep regulation → normalises cortisol and recovery cycles",
      "Gut–skin axis optimisation → improves nutrient absorption and immune signalling",
    ],
    formulationRationale: [
      {
        group: "Immune activators",
        ingredients: ["Colostrum", "Lactoferrin", "Vitamin C"],
        action: "Enhance immune defence, improve cellular repair, and stimulate dermal papilla cell activity.",
      },
      {
        group: "Hair growth support",
        ingredients: ["Vitamin D3", "Pine Bark Extract"],
        action: "Promote follicular differentiation and improve scalp microcirculation.",
      },
      {
        group: "Adaptogens & neuro support",
        ingredients: ["Ashwagandha", "L-Theanine", "L-Tyrosine"],
        action: "Reduce stress-mediated inflammation and support neurotransmitter balance.",
      },
      {
        group: "Sleep regulators",
        ingredients: ["Melatonin", "Valerian root", "Chamomile"],
        action: "Improve sleep quality and prolong the anagen growth phase.",
      },
      {
        group: "Antioxidant complex",
        ingredients: ["CoQ10", "Green Tea Extract", "Resveratrol", "Quercetin"],
        action: "Neutralise oxidative damage and protect follicular and skin cells.",
      },
      {
        group: "Anti-inflammatory agents",
        ingredients: ["Vitamin D", "Mushroom Extracts", "Resveratrol"],
        action: "Downregulate TNF-α, IL-6, NF-κB inflammatory pathways.",
      },
      {
        group: "Gut optimisation",
        ingredients: ["Lactobacillus", "Digestive Enzymes", "Bioperine"],
        action: "Restore microbiome balance and enhance nutrient bioavailability.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Improved energy, reduced fatigue, early reduction in hair fall" },
      { timeframe: "Weeks 4–8", outcome: "Better scalp health, improved skin texture, reduced inflammation" },
      { timeframe: "Weeks 8–12", outcome: "Stronger hair growth, improved density, enhanced overall recovery" },
    ],
    clinicalNote:
      "Designed to rebuild internal resilience — strengthening immunity, stabilising inflammation, and supporting long-term hair and skin health.",
  },

  PHENOTYPE_INFLAMMATION: {
    displayName: "Inflammation Control",
    diagnosisInsight:
      "Recommended for chronic low-grade inflammation contributing to persistent hair fall, weak follicles, and poor hair cycle recovery.",
    treatmentObjective:
      "Reduce systemic inflammation, stabilise the hair cycle, and protect follicles from ongoing damage.",
    therapeuticStrategy: [
      "Cytokine suppression → reduces follicular stress signals",
      "Immune modulation → restores balanced immune response",
      "Androgen sensitivity control → limits inflammation-driven DHT impact",
      "Oxidative protection → prevents cellular damage",
      "Stress regulation → reduces cortisol-driven inflammation",
    ],
    formulationRationale: [
      {
        group: "Anti-inflammatory agents",
        ingredients: ["Curcumin", "NAC", "Resveratrol", "Vitamin D"],
        action: "Downregulate pro-inflammatory pathways (TNF-α, IL-6, NF-κB).",
      },
      {
        group: "Immune modulators",
        ingredients: ["Colostrum", "Kelp", "Mushroom Extracts"],
        action: "Support immune balance and reduce chronic inflammatory activation.",
      },
      {
        group: "Androgen sensitivity modulators",
        ingredients: ["Beta-sitosterol", "Ginseng", "Stinging Nettle"],
        action: "Reduce follicular sensitivity aggravated by inflammation.",
      },
      {
        group: "Antioxidant & nutritional support",
        ingredients: ["CoQ10", "Vitamin C", "Vitamin E", "Zinc"],
        action: "Protect follicular cells and improve repair capacity.",
      },
      {
        group: "Stress regulators",
        ingredients: ["Ashwagandha", "L-Tyrosine", "Mulberry Extract"],
        action: "Lower cortisol and neuro-inflammatory triggers.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 3–5", outcome: "Reduction in scalp irritation and shedding variability" },
      { timeframe: "Weeks 6–8", outcome: "Improved scalp stability and reduced inflammation signs" },
      { timeframe: "Weeks 8–12", outcome: "Better hair strength and recovery response" },
    ],
    clinicalNote:
      "Chronic inflammation is often a hidden driver across TE, AGA, PCOS, and AA. Without addressing it, results remain incomplete or inconsistent.",
  },

  MPHL: {
    displayName: "Male Pattern Hair Loss (MPHL) — AGA Protocol",
    diagnosisInsight:
      "The thinning pattern is consistent with Androgenetic Alopecia — a progressive condition driven by androgen (DHT) activity, follicular sensitivity, inflammation, and metabolic imbalance. This produces gradual follicle miniaturisation, reduced density, and shorter growth cycles.",
    treatmentObjective:
      "Slow follicle miniaturisation, reduce hair fall, and improve density by targeting hormonal, inflammatory, and metabolic triggers.",
    therapeuticStrategy: [
      "DHT & androgen control → reduces hormonal impact on follicles",
      "Follicle rejuvenation → supports stronger, healthier hair growth",
      "Inflammation & oxidative stress reduction → protects follicular cells",
      "Metabolic correction → improves cellular energy and signalling",
      "Scalp & structural support → strengthens the hair shaft and environment",
      "Stress & gut balance → reduces indirect triggers of hair fall",
    ],
    formulationRationale: [
      { group: "DHT modulators", ingredients: ["Beta-sitosterol", "MSM"], action: "Inhibit 5-alpha reductase and reduce androgen-driven follicle shrinkage." },
      { group: "Cellular energy & anti-ageing", ingredients: ["NMN", "CoQ10", "NAC"], action: "Improve mitochondrial function and slow follicular ageing." },
      { group: "Follicle rejuvenators", ingredients: ["Quercetin", "Horsetail Extract"], action: "Support hair matrix repair and growth signalling." },
      { group: "Immune & nutritional support", ingredients: ["Lactoferrin", "Colostrum", "Vitamin D", "Iron"], action: "Improve follicle environment and correct deficiencies." },
      { group: "Scalp health & structural support", ingredients: ["NEM", "Brewer's Yeast", "Omega 3s"], action: "Enhance hair strength, elasticity, and scalp condition." },
      { group: "Stress & neuro support", ingredients: ["Ashwagandha", "L-Tyrosine"], action: "Reduce cortisol-related hair fall." },
      { group: "Gut & absorption support", ingredients: ["Probiotics", "Amla", "Omega 3s"], action: "Improve nutrient uptake and reduce systemic inflammation." },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–8", outcome: "Reduction in hair fall and improved scalp condition" },
      { timeframe: "Weeks 8–12", outcome: "Improved hair thickness and reduced shedding" },
      { timeframe: "Months 3–6", outcome: "Visible improvement in density and slowing of progression" },
    ],
    clinicalNote:
      "AGA is a chronic, progressive condition. Consistency and multi-pathway correction are essential for long-term results.",
  },

  FPHL: {
    displayName: "Female Pattern Hair Loss (FPHL) — Pattern Hair Loss Protocol",
    diagnosisInsight:
      "The thinning pattern is consistent with Female Pattern Hair Loss, driven by a combination of androgen (DHT) activity, follicular sensitivity, inflammation, oxidative stress, and metabolic dysfunction. Over time this produces progressive thinning, weaker strands, and reduced density.",
    treatmentObjective:
      "Slow progression, strengthen follicles, and improve hair density by targeting both hormonal and metabolic root causes.",
    therapeuticStrategy: [
      "Androgen regulation → reduces DHT impact on follicles",
      "Follicle rejuvenation → supports stronger, thicker hair growth",
      "Inflammation control → protects follicles from damage",
      "Metabolic correction → restores healthy hair-cycle signalling",
      "Scalp & structural support → improves hair quality and resilience",
    ],
    formulationRationale: [
      { group: "DHT & androgen modulators", ingredients: ["Beta-sitosterol", "MSM"], action: "Reduce follicle miniaturisation by limiting androgen activity." },
      { group: "Cellular energy & anti-ageing", ingredients: ["NMN", "CoQ10", "NAC"], action: "Improve follicular energy and slow ageing processes." },
      { group: "Growth & follicle support", ingredients: ["Quercetin", "Horsetail Extract"], action: "Enhance hair matrix repair and growth signalling." },
      { group: "Nutritional & immune support", ingredients: ["Lactoferrin", "Colostrum", "Vitamin D", "Iron"], action: "Improve follicle environment and correct deficiencies." },
      { group: "Scalp & hair structure", ingredients: ["NEM", "Brewer's Yeast", "Omega 3s"], action: "Strengthen the hair shaft and improve scalp condition." },
      { group: "Stress & gut support", ingredients: ["Ashwagandha", "L-Tyrosine", "Probiotics"], action: "Reduce indirect triggers and improve nutrient absorption." },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–8", outcome: "Reduced hair fall and improved scalp health" },
      { timeframe: "Weeks 8–12", outcome: "Increased hair strength and reduced thinning" },
      { timeframe: "Months 3–6", outcome: "Visible improvement in density and slowing of progression" },
    ],
    clinicalNote:
      "Pattern hair loss is progressive. Early and consistent intervention significantly improves long-term outcomes.",
  },

  ALOPECIA_AREATA: {
    displayName: "Alopecia Areata Support",
    diagnosisInsight:
      "Consistent with Alopecia Areata, an autoimmune disorder where the immune system targets its own hair follicles, producing patchy hair loss that can vary from small patches to more extensive loss. First-line therapy (immunosuppressants) controls flares but weakens immunity; nutritional support modulates immunity and augments therapeutic outcome.",
    treatmentObjective:
      "Modulate immune response, reduce inflammation, and reactivate hair follicles in a controlled supportive environment alongside medical therapy.",
    therapeuticStrategy: [
      "Immune regulation → prevents autoimmune attack on follicles via Nrf2 / NF-κB modulation",
      "Hair growth stimulation → reactivates dormant follicles even when immunosuppressants are in use",
      "Oxidative stress control → prevents MICA / ULBP expression that collapses follicular immune privilege",
      "Stress & anxiety management → reduces neuro-inflammatory flare triggers via GABA / cortisol pathways",
    ],
    formulationRationale: [
      { group: "Immune modulators", ingredients: ["Colostrum", "Lactoferrin", "Curcumin"], action: "Colostrum + Lactoferrin deliver immunoglobulins and EGF to support dermal papilla cell proliferation and repair damaged cells. Curcumin inhibits NF-κB–driven pro-inflammatory cytokines, stabilises mast cells and eosinophils, and enhances Nrf2-mediated antioxidant defences." },
      { group: "Growth activators", ingredients: ["Vitamin D", "Melatonin", "Kelp Extract"], action: "Vitamin D acts on VDR to promote follicular differentiation while reducing inflammatory cytokines and raising T-regulatory output. Melatonin facilitates DNA repair, neutralises free radicals, stimulates follicle stem cell proliferation and prolongs anagen. Kelp regulates overall immune function and alleviates autoimmune reactions impacting follicles." },
      { group: "Stress regulators", ingredients: ["L-Theanine", "Magnesium", "Chamomile"], action: "L-Theanine raises GABA and dopamine to reduce anxiety without sedation. Chamomile flavonoids modulate GABA receptors and produce clinically meaningful reductions in generalised anxiety. Magnesium repletion improves chronic stress, depression, and anxiety scores." },
      { group: "Antioxidant protection", ingredients: ["Moringa", "Vitamin E", "Selenium"], action: "Moringa supplies ascorbic acid, flavonoids, phenolics and carotenoids for broad antioxidant action. Vitamin E neutralises free radicals and prevents lipid peroxidation; Selenium boosts glutathione peroxidase activity — together preserving the hair follicle immune privilege." },
    ],
    expectedResponse: [
      { timeframe: "Initial", outcome: "Stabilisation of patch progression" },
      { timeframe: "Intermediate", outcome: "Early signs of regrowth (fine / soft hair)" },
      { timeframe: "Sustained", outcome: "Visible thickening and patch recovery" },
    ],
    clinicalNote:
      "Alopecia Areata is relapsing. This protocol supports immune balance and enhances treatment outcomes — it does not replace medical therapy when systemic immunosuppression is indicated.",
  },

  PERI_MENOPAUSE: {
    displayName: "Peri-Menopause Hair Stabilisation",
    diagnosisInsight:
      "Hair fall is consistent with peri-menopausal hair changes — often presenting similarly to Female Pattern Hair Loss or Telogen Effluvium. The cause is declining estrogen, a relative rise in androgens, fluctuating progesterone, thyroid shifts, elevated cortisol, and accompanying nutritional decline (iron, ferritin, calcium, vitamin D, B-vitamins, zinc). Digestive enzyme production declines with age, so malabsorption is a parallel problem.",
    treatmentObjective:
      "Restore hormonal balance, improve nutrient availability, and stabilise the follicular environment to reduce thinning and support regrowth.",
    therapeuticStrategy: [
      "Hormonal balance → corrects estrogen–androgen shift and supports adrenal output",
      "Follicular protection → reduces DHT-driven miniaturisation",
      "Nutritional restoration → corrects age-related iron, vitamin D, B-vitamin and zinc deficiencies",
      "Stress & sleep regulation → lowers cortisol, addresses hot flashes and sleep disturbance",
      "Inflammation & circulation → enhances scalp health and blood flow",
    ],
    formulationRationale: [
      { group: "Hormonal modulators", ingredients: ["Ashwagandha", "Beta-sitosterol", "Milk Thistle"], action: "Ashwagandha (300 mg twice daily) is shown in an 8-week RCT to significantly improve menopause rating scale and QoL, with hormonal (estradiol / FSH / LH) and stress (cortisol) modulation. Beta-sitosterol inhibits 5-alpha reductase to reduce androgen-driven follicle shrinkage and adds anti-inflammatory protection. Milk Thistle exerts mild phyto-estrogenic action that reduces hot flashes and mood disturbances." },
      { group: "Growth & follicle support", ingredients: ["Vitamin D", "NAC"], action: "Vitamin D regulates estrogen / progesterone signalling, supports mood and immune function, and acts on VDR for follicular differentiation. NAC mitigates oxidative stress, supports regular ovulation / menstrual cycles, and improves follicular health during the transition." },
      { group: "Immune & repair", ingredients: ["Colostrum", "Lactoferrin"], action: "Lactoferrin modulates immune function, stimulates osteoblasts to counter peri-menopausal bone loss, and balances inflammation. Colostrum supplies immunoglobulins, growth factors and supports gut integrity — improving nutrient absorption when digestive enzyme output is declining." },
      { group: "Stress & sleep regulators", ingredients: ["Melatonin", "Magnesium"], action: "Melatonin reduces frequency / severity of hot flashes, night sweats and vaginal dryness, alleviates mood swings, and provides antioxidant protection. Magnesium supports stress, anxiety and sleep quality." },
      { group: "Anti-inflammatory & antioxidant", ingredients: ["Curcumin", "CoQ10"], action: "Reduce chronic inflammation and oxidative stress affecting follicles, joints and skin during the transition." },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–6", outcome: "Reduction in hair fall and improved energy / sleep" },
      { timeframe: "Weeks 6–10", outcome: "Better hair texture, reduced thinning" },
      { timeframe: "Weeks 10–16", outcome: "Visible improvement in density and scalp health" },
    ],
    clinicalNote:
      "During peri-menopause, nutrient absorption declines and hormonal fluctuations intensify. Addressing these internal changes is essential for sustainable hair recovery.",
  },

  PCOS: {
    displayName: "PCOS Hair & Skin Regulation",
    diagnosisInsight:
      "Symptoms are consistent with PCOS-related hair and skin changes, driven by hormonal imbalance, insulin resistance, and chronic inflammation. These disruptions produce hair fall / thinning, acne, and occasional hirsutism.",
    treatmentObjective:
      "Rebalance hormones, improve insulin sensitivity, and restore a metabolic environment that supports healthy hair growth and skin function.",
    therapeuticStrategy: [
      "Hormonal regulation → reduces androgen excess",
      "Insulin sensitisation → improves metabolic control",
      "Inflammation reduction → protects follicles and skin",
      "Metabolic optimisation → supports weight and energy balance",
      "Stress & recovery support → normalises cortisol and sleep",
    ],
    formulationRationale: [
      { group: "Hormone modulators", ingredients: ["Beta-sitosterol", "Stinging Nettle", "Myo-Inositol"], action: "Beta-sitosterol inhibits 5-alpha reductase, blocking testosterone-to-DHT conversion and limiting androgen substrate. Stinging Nettle reduces free testosterone. Myo-Inositol reduces testosterone and androstenedione by raising sex hormone–binding globulin (SHBG)." },
      { group: "Insulin sensitisers", ingredients: ["Myo-Inositol", "Resveratrol"], action: "Myo-Inositol improves insulin sensitivity and augments metformin outcomes. Resveratrol reduces insulin resistance, alleviates dyslipidaemia, regulates reproductive hormones and lowers oxidative stress." },
      { group: "Hair growth support", ingredients: ["Vitamin D"], action: "Vitamin D acts on VDR for follicular differentiation, downregulates cytotoxic T cells and raises T-regulatory cells — lowering inflammatory pressure at the follicle." },
      { group: "Anti-inflammatory & antioxidants", ingredients: ["Curcumin", "NAC", "Resveratrol"], action: "Curcumin improves glycaemic control (fasting blood glucose) and downregulates TNF-α, IL-6, IL-1β via NF-κB inhibition. NAC is a glutathione precursor that reduces interleukin-mediated inflammation. Resveratrol reinforces antioxidant defence and hormonal regulation." },
      { group: "Stress regulators", ingredients: ["Melatonin", "L-Tyrosine", "Magnesium"], action: "Melatonin regulates sleep cycle, lowers LDL/triglycerides and prolongs anagen by slowing the catagen transition. L-Tyrosine is a precursor for dopamine and norepinephrine. Magnesium repletion improves chronic stress, depression and anxiety scores." },
      { group: "Metabolic enhancers", ingredients: ["Garcinia Cambogia", "Mulberry Extract"], action: "Garcinia raises basal metabolic rate, reduces BMI and abdominal fat, suppresses appetite and inhibits carbohydrate-to-fat conversion. Mulberry alkaloids are comparable to acarbose and increase carbohydrate excretion." },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–6", outcome: "Reduction in hair fall and oiliness / acne" },
      { timeframe: "Weeks 6–10", outcome: "Improved cycle regularity and scalp condition" },
      { timeframe: "Weeks 10–16", outcome: "Visible improvement in hair density and skin clarity" },
    ],
    clinicalNote:
      "PCOS is a chronic metabolic-hormonal condition. Sustainable results require continuous internal correction, not just symptomatic treatment.",
  },

  OXIDATIVE_STRESS: {
    displayName: "Oxidative Stress Correction",
    diagnosisInsight:
      "Recommended for patients with high oxidative load — smoking, alcohol, pollution, or chronic inflammation — producing cellular damage, weak hair structure, and reduced growth capacity.",
    treatmentObjective:
      "Neutralise free radicals, restore cellular energy, and improve follicle strength and hair quality.",
    therapeuticStrategy: [
      "Free radical neutralisation → reduces cellular damage",
      "Mitochondrial support → improves ATP production",
      "Hair growth stimulation → enhances follicular activity",
      "Gut & immune support → improves nutrient utilisation and resilience",
    ],
    formulationRationale: [
      { group: "Antioxidant complex", ingredients: ["Spirulina", "Resveratrol", "Lycopene", "Selenium", "Vitamin C", "Zinc"], action: "Neutralise oxidative stress and protect follicular cells." },
      { group: "Hair growth promoters", ingredients: ["Pine Bark Extract", "Arginine", "Pumpkin Seed Oil", "Ginseng"], action: "Improve scalp circulation and follicular nourishment." },
      { group: "Gut & immune support", ingredients: ["Lactobacillus", "Colostrum", "Lactoferrin"], action: "Enhance absorption and support systemic recovery." },
      { group: "Anti-inflammatory support", ingredients: ["Ashwagandha", "Vitamin D", "Ginseng", "Gymnema"], action: "Reduce inflammation linked to oxidative stress." },
    ],
    expectedResponse: [
      { timeframe: "Weeks 3–6", outcome: "Improved energy levels and reduced hair fragility" },
      { timeframe: "Weeks 6–10", outcome: "Better hair texture and reduced breakage" },
      { timeframe: "Weeks 10–14", outcome: "Enhanced hair quality and growth support" },
    ],
    clinicalNote:
      "Oxidative stress accelerates follicular ageing and miniaturisation, especially in AGA and ageing-related hair loss.",
  },

  META_B: {
    displayName: "Pro Fact Meta B — Cyclical Metabolic Reset",
    diagnosisInsight:
      "Recommended when the patient profile shows signs of slow metabolism — fatigue and lethargy, mood swings and poor concentration, weight gain or difficulty losing weight, hair and skin damage, hormone disruption, and digestive imbalance. A slowed metabolic engine starves follicles of substrate and disrupts hair-cycle signalling; correcting metabolic terrain is upstream of pattern, hormonal and inflammatory therapy.",
    treatmentObjective:
      "Restart the metabolic engine — improve insulin sensitivity and adipose-tissue handling, restore cellular energy (NAD+), rebalance hormones, lift mood and sleep, and repair digestion — so downstream hair therapy lands on a responsive system.",
    therapeuticStrategy: [
      "Weight & adipose-tissue management → reduces BMI, suppresses appetite, limits carbohydrate-to-fat conversion",
      "Hair & skin protection → DHT modulation, follicular VDR signalling, scalp microcirculation",
      "Mood & cortisol regulation → adaptogenic and circadian support lowers stress-driven metabolic disruption",
      "Hormone rebalancing → insulin sensitisation and endocrine support across the female and thyroid axes",
      "Cellular energy restoration → NAD+ precursors restore mitochondrial output and reverse fatigue",
      "Digestion optimisation → enzyme support and essential-fatty-acid–driven gut-lining repair",
    ],
    formulationRationale: [
      {
        group: "Weight & adipose-tissue management",
        ingredients: ["Garcinia Cambogia", "Berberine"],
        action:
          "Garcinia Cambogia reduces BMI and abdominal fat accumulation, raises basal metabolic rate, suppresses appetite, and inhibits carbohydrate-to-fat conversion. Berberine is antihyperlipidaemic, antihyperglycaemic and acts as a prebiotic; it suppresses adipocyte differentiation from stem cells, improves insulin sensitivity, and enhances glucose uptake and metabolism.",
      },
      {
        group: "Hair & skin protection",
        ingredients: ["Beta-sitosterol", "Vitamin D", "Pine Bark Extract", "Mushroom Extract"],
        action:
          "Beta-sitosterol inhibits 5-alpha reductase and limits DHT-driven follicle shrinkage. Vitamin D acts on VDR receptors for follicular differentiation and immune balance. Pine Bark Extract improves microcirculation to the hair follicles, supporting growth and nourishment. Mushroom Extract delivers β-glucan immune balance and antioxidant cover for skin and follicular health.",
      },
      {
        group: "Mood & cortisol regulation",
        ingredients: ["Ashwagandha", "Melatonin", "Chamomile"],
        action:
          "Ashwagandha lowers serum cortisol and reduces anxiety, supporting resilience to stress-driven metabolic disruption. Melatonin regulates the sleep–wake cycle, provides cytoprotection via free-radical neutralisation, and prolongs anagen. Chamomile flavonoids modulate GABA receptors to improve sleep quality and ease anxiety.",
      },
      {
        group: "Hormone rebalancing",
        ingredients: ["Inositol", "Shatavari", "Milk Thistle"],
        action:
          "Inositol improves insulin sensitivity and reduces circulating androgens by raising sex hormone–binding globulin. Shatavari supports female endocrine balance and reproductive-axis homeostasis. Milk Thistle exerts mild phyto-estrogenic action and supports hepatic clearance of excess hormones.",
      },
      {
        group: "Cellular energy restoration",
        ingredients: ["Nicotinamide Mononucleotide (NMN)", "Nicotinamide Riboside (NR)"],
        action:
          "NMN and NR are direct NAD+ precursors. Restoring NAD+ improves mitochondrial output, reverses fatigue and lethargy, supports DNA repair, and re-energises the cellular pathways that drive follicular and metabolic recovery.",
      },
      {
        group: "Digestion optimisation",
        ingredients: ["Digestive enzymes", "Cod Liver Oil"],
        action:
          "Digestive enzymes restore breakdown and assimilation of macronutrients, correcting the absorption gap that follows slowed metabolism. Cod Liver Oil supplies omega-3 EFAs and fat-soluble vitamins (A, D) that repair the gut lining and reduce systemic inflammation.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Energy lifts, cravings reduce, sleep stabilises, and bloating eases as digestion recovers" },
      { timeframe: "Weeks 4–8", outcome: "Mood and concentration improve, weight begins to trend down, and oily/dry skin imbalance settles" },
      { timeframe: "Weeks 8–12", outcome: "Hormonal cycles steady, hair fall slows, and downstream pattern / inflammation therapy starts to take hold" },
    ],
    clinicalNote:
      "Pro Fact Meta B is a CYCLICAL · COMPREHENSIVE · CURATED metabolic-reset kit. It is upstream of pattern, hormonal and follicular therapy — when slow-metabolism signs are present, metabolic correction is non-negotiable, and the kit is included even when no overt obesity / sedentary signal is reported.",
  },

  GI_GOLD: {
    displayName: "Gut–Hair Axis Restoration (GI Gold)",
    diagnosisInsight:
      "Recommended for GERD, IBS, or leaky-gut signals that disrupt nutrient absorption, increase systemic inflammation, and compromise hair, skin, and immune function. The gut acts as the central hub for immune activity and nutrient bioavailability — disruption upstream blocks every downstream intervention.",
    treatmentObjective:
      "Strengthen the intestinal barrier, restore microbiome balance, and improve nutrient absorption so subsequent hair-directed therapy can take effect.",
    therapeuticStrategy: [
      "Mucosal immunity → boosts the gut's natural defence",
      "Microbiome restoration → promotes beneficial flora",
      "Barrier integrity → manages leaky-gut permeability",
      "Inflammation control → mitigates pathogen-driven damage",
      "Nutrient bioavailability → improves absorption across the gut–skin axis",
    ],
    formulationRationale: [
      { group: "Barrier & mucosal repair", ingredients: ["Colostrum", "Lactoferrin", "Glutamine"], action: "Repair gut lining and provide growth factors for regeneration." },
      { group: "Microbiome support", ingredients: ["Lactobacillus", "Probiotic blend"], action: "Restore beneficial flora and reduce systemic inflammation." },
      { group: "Digestive optimisation", ingredients: ["Digestive enzymes", "Bioperine"], action: "Improve nutrient breakdown and uptake at the villi." },
      { group: "Anti-inflammatory support", ingredients: ["Curcumin", "Vitamin D"], action: "Reduce cytokine load driving leaky-gut and follicular inflammation." },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Reduced bloating, acidity, and gut discomfort" },
      { timeframe: "Weeks 4–8", outcome: "Improved nutrient absorption and skin clarity" },
      { timeframe: "Weeks 8–12", outcome: "Hair fall reduction as upstream substrate delivery is restored" },
    ],
    clinicalNote:
      "Gut healing is upstream of metabolic, hormonal, and inflammatory layers. When any gut symptom is present, this kit must precede other phases — otherwise downstream therapy is poorly absorbed.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Trichotillomania (TTM) Support
  // ───────────────────────────────────────────────────────────────────────────
  TTM_SUPPORT: {
    displayName: "Trichotillomania (TTM) Support",
    diagnosisInsight:
      "Recommended for trichotillomania — a behavioural disorder characterised by repetitive hair pulling, often linked to stress, anxiety, and neurochemical imbalance. Hair loss in TTM is not due to follicle damage alone but to mechanical pulling combined with internal triggers.",
    treatmentObjective:
      "Reduce hair-pulling behaviour, support emotional regulation, and create conditions for safe and sustained hair regrowth.",
    therapeuticStrategy: [
      "Stress & impulse regulation → reduces urge-driven behaviour",
      "Nutritional correction → supports brain and cellular function",
      "Follicle recovery → promotes regrowth in affected areas",
    ],
    formulationRationale: [
      {
        group: "Neuro & stress modulators",
        ingredients: ["Melatonin", "Alpha Lipoic Acid", "NAC"],
        action: "Support neurotransmitter balance, reduce compulsive tendencies, and improve sleep and emotional stability.",
      },
      {
        group: "Hair growth support",
        ingredients: ["Curcumin", "Green Tea Extract", "CoQ10"],
        action: "Reduce inflammation and support follicular recovery in affected areas.",
      },
      {
        group: "Nutritional repletion",
        ingredients: ["Vitamin D", "Vitamin E", "Niacinamide"],
        action: "Improve cellular health and repair capacity.",
      },
      {
        group: "Deficiency correction",
        ingredients: ["Vitamin C", "B12", "Iron", "Magnesium", "Zinc"],
        action: "Address deficiencies associated with both hair loss and behavioural imbalance.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Improved sleep and reduced stress triggers" },
      { timeframe: "Weeks 4–8", outcome: "Reduction in urge frequency and intensity" },
      { timeframe: "Weeks 8–12", outcome: "Visible regrowth in affected areas (if pulling is controlled)" },
    ],
    clinicalNote:
      "TTM is a behavioural condition. This kit supports internal balance, but best outcomes occur when combined with behavioural therapy or counselling.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Hair Breakage Repair (HBR)
  // ───────────────────────────────────────────────────────────────────────────
  HBR: {
    displayName: "Hair Breakage Repair (HBR)",
    diagnosisInsight:
      "Recommended for hair breakage where strands weaken and break due to nutritional deficiencies, environmental damage, and structural stress rather than root-level hair loss. Common triggers include heat styling, chemical treatments, pollution, nutritional gaps, and scalp inflammation.",
    treatmentObjective:
      "Strengthen the hair shaft, restore internal nutrition, and improve scalp health to reduce breakage and improve hair quality.",
    therapeuticStrategy: [
      "Structural repair → strengthens the hair fibre and reduces fragility",
      "Nutritional replenishment → corrects deficiencies affecting hair quality",
      "Scalp protection → reduces inflammation and environmental damage",
      "Moisture retention → improves elasticity and reduces dryness",
      "Stress regulation → minimises stress-related weakening",
    ],
    formulationRationale: [
      {
        group: "Nutritional support",
        ingredients: ["Iron", "Folic Acid", "Protein Hydrolysates", "Amino Acids"],
        action: "Support keratin production and improve hair strength and elasticity.",
      },
      {
        group: "Mineral repletion",
        ingredients: ["Zinc", "Magnesium", "Iodine"],
        action: "Improve hair structure and scalp health.",
      },
      {
        group: "UV & environmental protection",
        ingredients: ["Vitamin C", "Quercetin", "Mushroom Extracts"],
        action: "Protect hair from oxidative and environmental damage.",
      },
      {
        group: "Moisture & elasticity support",
        ingredients: ["Lutein", "Zeaxanthin", "Mushroom Extracts"],
        action: "Improve hydration and reduce dryness-related breakage.",
      },
      {
        group: "Hair growth & strength support",
        ingredients: ["Vitamin D", "Omega 3 (EPA/DHA)", "Pumpkin Seed Oil"],
        action: "Support follicular health and reduce excessive shedding.",
      },
      {
        group: "Stress regulators",
        ingredients: ["Ashwagandha", "L-Tyrosine", "Mulberry Extract"],
        action: "Reduce stress-related impact on hair quality.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 3–5", outcome: "Reduced dryness and improved hair texture" },
      { timeframe: "Weeks 6–8", outcome: "Noticeable reduction in breakage and snapping-related hair fall" },
      { timeframe: "Weeks 8–12", outcome: "Improved shine, elasticity, and overall hair strength" },
    ],
    clinicalNote:
      "Hair breakage is often misinterpreted as hair fall. Addressing internal nutrition and external damage together is essential for visible improvement.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Early Greying Care Gold
  // ───────────────────────────────────────────────────────────────────────────
  EARLY_GREYING_CARE_GOLD: {
    displayName: "Early Greying Care (EG Care Gold)",
    diagnosisInsight:
      "Recommended for premature greying, early pigment loss, stress-associated hair ageing, nutritional deficiencies, or premature greying accompanied by hair shedding. Melanocytes are particularly sensitive to oxidative stress, nutritional gaps, and chronic physiological stress.",
    treatmentObjective:
      "Support melanocyte function, reduce oxidative stress, optimise nutrient availability, and maintain the biological processes responsible for healthy hair pigmentation and growth.",
    therapeuticStrategy: [
      "Oxidative stress protection → shields pigment-producing melanocytes from free-radical damage",
      "Melanocyte function support → supports cellular pathways for melanin synthesis",
      "Stress & neuroendocrine regulation → reduces cortisol-driven pigment loss",
      "Nutritional repletion → provides essential cofactors for melanin production",
      "Follicular health & longevity → preserves scalp health and follicular function",
    ],
    formulationRationale: [
      {
        group: "Antioxidant protection complex",
        ingredients: ["Quercetin", "Grape Seed Extract", "Green Tea Extract"],
        action: "Broad-spectrum antioxidant support to protect melanocytes and follicular cells from oxidative stress.",
      },
      {
        group: "Immune & follicular support",
        ingredients: ["Colostrum", "Lactoferrin"],
        action: "Support immune resilience and maintain a healthy follicular environment.",
      },
      {
        group: "Stress modulation complex",
        ingredients: ["Melatonin", "Ashwagandha", "L-Tyrosine"],
        action: "Support healthy stress adaptation, sleep quality, and neurotransmitter balance involved in pigment preservation.",
      },
      {
        group: "Pigmentation nutrient complex",
        ingredients: ["Iron", "Zinc", "Vitamin D", "Vitamin C", "Vitamin E"],
        action: "Supply essential cofactors for melanin synthesis, cellular metabolism, and antioxidant defence.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–8", outcome: "Improved nutritional support and antioxidant protection of melanocytes" },
      { timeframe: "Weeks 8–12", outcome: "Reduced stress-related burden and improved scalp and follicular health" },
      { timeframe: "Months 3–6", outcome: "Slowing of progressive premature greying in susceptible individuals" },
    ],
    clinicalNote:
      "Premature greying may occur when melanocyte activity declines or pigment production is impaired. Antioxidant defence, nutritional adequacy, and stress regulation together preserve the environment required for healthy pigmentation.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Pro Fact Thyroid Care (Hyperthyroid)
  // ───────────────────────────────────────────────────────────────────────────
  PRO_FACT_THYROID_CARE: {
    displayName: "Pro Fact Thyroid Care (Hyperthyroid Support)",
    diagnosisInsight:
      "Recommended for hyperthyroidism with increased nutritional demand, hair shedding, reduced hair quality, fatigue, oxidative stress, weight changes, or metabolic imbalance associated with accelerated thyroid activity.",
    treatmentObjective:
      "Replenish nutrients consumed by increased metabolic activity, support healthy thyroid function, reduce oxidative stress, maintain hair follicle health, and promote overall resilience.",
    therapeuticStrategy: [
      "Nutritional repletion → replaces vitamins, minerals, amino acids depleted by hypermetabolism",
      "Thyroid metabolic support → maintains balance during periods of high thyroid activity",
      "Oxidative stress protection → counters free-radical generation from heightened turnover",
      "Hair follicle & growth support → provides keratin substrate and supports cycling",
      "Cellular energy & recovery → supports oxygen delivery, mitochondria, tissue regeneration",
      "Stress & neuroendocrine balance → supports recovery and adaptation",
    ],
    formulationRationale: [
      {
        group: "Thyroid support complex",
        ingredients: ["Selenium", "Zinc", "Magnesium", "Vitamin D3", "Iron"],
        action: "Support healthy thyroid hormone metabolism, enzymatic activity, and overall metabolic regulation.",
      },
      {
        group: "Hair growth & structural support",
        ingredients: ["Biotin", "L-Lysine", "Protein Hydrolysate", "Folic Acid"],
        action: "Provide building blocks for keratin synthesis, follicular function, and healthy hair cycling.",
      },
      {
        group: "Antioxidant protection complex",
        ingredients: ["N-Acetyl Cysteine", "Pine Bark Extract", "Green Tea Extract", "Grape Seed Extract", "Vitamin C", "Moringa Extract"],
        action: "Reduce oxidative stress and protect follicular and thyroid tissue.",
      },
      {
        group: "Energy & cellular metabolism",
        ingredients: ["Vitamin B12", "Folic Acid"],
        action: "Support oxygen transport, DNA synthesis, and cellular renewal.",
      },
      {
        group: "Metabolic wellness",
        ingredients: ["Fenugreek Extract", "Cinnamon Extract", "Gymnema Extract"],
        action: "Support healthy glucose metabolism, appetite regulation, and metabolic health.",
      },
      {
        group: "Stress adaptation",
        ingredients: ["Brahmi"],
        action: "Support stress resilience, cognitive wellbeing, and recovery.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Improved nutritional status and reduced fatigue" },
      { timeframe: "Weeks 4–8", outcome: "Enhanced antioxidant protection and cellular recovery" },
      { timeframe: "Weeks 8–12", outcome: "Improved hair quality and reduced thyroid-associated shedding" },
    ],
    clinicalNote:
      "Hyperthyroidism accelerates utilisation of vitamins, minerals, and antioxidants. Nutritional support helps maintain physiological balance alongside endocrine therapy.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Rapid Weight Loss Shield
  // ───────────────────────────────────────────────────────────────────────────
  RWL_SHIELD: {
    displayName: "Rapid Weight Loss Shield (RWL Shield)",
    diagnosisInsight:
      "Recommended for rapid weight loss, prolonged calorie restriction, appetite-suppression therapies (including GLP-1 agonists), or significant dietary changes with nutritional deficiencies, hair shedding, fatigue, reduced recovery, gut dysfunction, or loss of muscle and bone health.",
    treatmentObjective:
      "Restore nutritional adequacy, protect lean tissue, support gut health, strengthen immune resilience, and maintain hair, skin, and physiological function during weight loss.",
    therapeuticStrategy: [
      "Nutritional repletion → replaces commonly depleted vitamins and minerals",
      "Gut health & nutrient absorption → supports microbiome and intestinal integrity",
      "Muscle & skeletal support → preserves lean tissue and bone integrity",
      "Immune & recovery support → maintains tissue repair capacity",
      "Neuroendocrine & mood balance → supports stress adaptation",
      "Hair & skin vitality → maintains follicular metabolism and scalp health",
    ],
    formulationRationale: [
      {
        group: "Essential micronutrient repletion",
        ingredients: ["Vitamin B12", "Vitamin B9 (Folate)", "Vitamin K1", "Vitamin K2", "Zinc", "Iron", "Vitamin C", "Vitamin A", "Vitamin B1", "Vitamin B2"],
        action: "Replenish key nutrients for cellular metabolism, oxygen transport, immune function, and healthy hair growth.",
      },
      {
        group: "Iron utilisation & cellular energy",
        ingredients: ["Ferrous Bisglycinate"],
        action: "Support haemoglobin synthesis, oxygen delivery, and follicular metabolic activity.",
      },
      {
        group: "Gut restoration complex",
        ingredients: ["Lactobacillus acidophilus", "Bacillus subtilis", "Colostrum", "Lactoferrin"],
        action: "Support microbiome diversity, intestinal barrier function, and nutrient absorption.",
      },
      {
        group: "Musculoskeletal protection",
        ingredients: ["Omega-3 Fatty Acids", "Glucosamine", "Chondroitin Sulphate", "Green-Lipped Mussel Extract", "Natural Eggshell Membrane", "Vitamin D"],
        action: "Support joint, connective-tissue, and skeletal integrity during weight reduction.",
      },
      {
        group: "Stress & mood support",
        ingredients: ["L-Tyrosine", "Withania somnifera", "Valeriana wallichii"],
        action: "Support neurotransmitter balance, stress resilience, and adaptation to dietary change.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Improved nutritional status and digestive comfort" },
      { timeframe: "Weeks 4–8", outcome: "Enhanced energy, recovery capacity, and mood stability" },
      { timeframe: "Weeks 8–12", outcome: "Reduced risk of nutrition-related hair shedding and preserved lean tissue" },
    ],
    clinicalNote:
      "Rapid weight loss may place high demands on the body. Supporting nutritional adequacy and cellular recovery helps maintain healthier long-term outcomes while pursuing weight goals.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // FH Well 3 (Endometriosis Support)
  // ───────────────────────────────────────────────────────────────────────────
  FH_WELL_3: {
    displayName: "F-H Well 3 (Endometriosis Support)",
    diagnosisInsight:
      "Recommended for women with endometriosis experiencing chronic inflammation, pelvic discomfort, hormonal imbalance, fatigue, oxidative stress, hair shedding, or skin concerns.",
    treatmentObjective:
      "Support inflammatory balance, immune regulation, antioxidant defence, hormonal equilibrium, and cellular health while maintaining healthy hair and skin function.",
    therapeuticStrategy: [
      "Inflammation control → modulates pathways linked to chronic pelvic and systemic inflammation",
      "Immune regulation → supports balanced immune responses",
      "Oxidative stress reduction → protects cells from free-radical damage",
      "Hormonal balance support → maintains healthy endocrine signalling",
      "Cellular health & tissue integrity → supports normal turnover and repair",
      "Hair & skin vitality → maintains follicular and scalp health under inflammatory burden",
    ],
    formulationRationale: [
      {
        group: "Omega-3 anti-inflammatory",
        ingredients: ["EPA", "DHA"],
        action: "Support inflammatory balance and healthy cellular membrane function.",
      },
      {
        group: "Antioxidant & circadian support",
        ingredients: ["Melatonin"],
        action: "Provide antioxidant protection, support cellular recovery and healthy sleep regulation.",
      },
      {
        group: "Cellular regulation",
        ingredients: ["Quercetin"],
        action: "Support inflammatory control, antioxidant defence, and healthy hormonal balance.",
      },
      {
        group: "Immune modulation",
        ingredients: ["Lactoferrin"],
        action: "Support immune regulation and maintain a healthy tissue microenvironment.",
      },
      {
        group: "Cellular protection",
        ingredients: ["N-Acetyl Cysteine"],
        action: "Support glutathione production, antioxidant defence, and cellular repair.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–6", outcome: "Improved inflammatory balance and cellular resilience" },
      { timeframe: "Weeks 6–10", outcome: "Reduced oxidative-stress burden and enhanced immune regulation" },
      { timeframe: "Weeks 10–16", outcome: "Support for healthy hair growth and improved overall wellbeing" },
    ],
    clinicalNote:
      "Endometriosis involves chronic inflammation, immune dysregulation, oxidative stress, and hormonal disturbances — all of which influence skin and hair quality. Addressing the underlying biology helps support more consistent long-term outcomes.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Iron Up Gold
  // ───────────────────────────────────────────────────────────────────────────
  IRON_UP_GOLD: {
    displayName: "Iron Up Gold (Iron Homeostasis & Hair Recovery)",
    diagnosisInsight:
      "Recommended for iron deficiency, low ferritin levels, increased hair shedding, telogen effluvium, diffuse hair loss, nutritional anaemia, or hair loss associated with impaired iron metabolism.",
    treatmentObjective:
      "Restore healthy iron stores, improve iron utilisation, support oxygen delivery and cellular metabolism, and create an environment for healthy hair follicle function and regrowth.",
    therapeuticStrategy: [
      "Iron store restoration → replenishes depleted reserves required for cellular and follicular function",
      "Follicular metabolic support → supports iron-dependent processes in hair growth and cycling",
      "Oxygen transport & cellular energy → enhances haemoglobin and oxygen delivery to follicles",
      "Iron utilisation optimisation → supports absorption, transport, and bioavailability",
      "Oxidative stress balance → maintains healthy iron homeostasis during replenishment",
    ],
    formulationRationale: [
      {
        group: "Bioavailable iron",
        ingredients: ["Ferrous Bisglycinate"],
        action: "Highly absorbable iron to restore iron stores, haemoglobin synthesis, and follicular activity.",
      },
      {
        group: "Iron utilisation cofactors",
        ingredients: ["Vitamin C", "Vitamin B2", "Vitamin B12", "Folate"],
        action: "Enhance iron absorption, support red blood cell formation, and facilitate efficient utilisation.",
      },
      {
        group: "Cellular metabolism support",
        ingredients: ["Copper"],
        action: "Support enzymatic pathways involved in iron transport, energy production, and tissue repair.",
      },
      {
        group: "Antioxidant protection",
        ingredients: ["Vitamin C", "Vitamin E"],
        action: "Support cellular defence and balanced iron metabolism during replenishment.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–8", outcome: "Restoration of healthy iron and ferritin trajectory" },
      { timeframe: "Weeks 8–12", outcome: "Reduction in excessive hair shedding associated with iron deficiency" },
      { timeframe: "Weeks 12–16", outcome: "Improved follicular function, energy, and scalp vitality" },
    ],
    clinicalNote:
      "Iron is essential for oxygen transport, DNA synthesis, and follicular metabolism. Repletion needs both bioavailable iron AND cofactors that support absorption, transport, and utilisation.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Hair Fact Night Shift
  // ───────────────────────────────────────────────────────────────────────────
  NIGHT_SHIFT: {
    displayName: "Hair Fact Night Shift (Shift-Worker Recovery)",
    diagnosisInsight:
      "Recommended for night-shift or rotating-shift workers with hair fall, premature greying, poor sleep, fatigue, increased stress, or lifestyle-related disruption of biological rhythms.",
    treatmentObjective:
      "Restore circadian rhythm balance, improve sleep quality, reduce physiological stress, address shift-related nutritional gaps, and support healthy hair growth and overall wellbeing.",
    therapeuticStrategy: [
      "Circadian rhythm regulation → supports synchronisation of the internal clock",
      "Sleep & recovery optimisation → enhances sleep quality and repair processes",
      "Stress & inflammation control → reduces cortisol burden from disrupted sleep",
      "Nutritional & metabolic support → addresses shift-related insufficiencies",
      "Hair growth & pigmentation support → protects against premature ageing",
    ],
    formulationRationale: [
      {
        group: "Circadian support",
        ingredients: ["Melatonin"],
        action: "Regulate sleep-wake cycles, improve sleep efficiency, and restore circadian alignment.",
      },
      {
        group: "Stress & inflammation modulation",
        ingredients: ["Omega-3 Fatty Acids"],
        action: "Support inflammatory balance and follicular function under chronic stress.",
      },
      {
        group: "Immune & follicular support",
        ingredients: ["Lactoferrin"],
        action: "Provide antioxidant and immune-modulatory support and promote dermal papilla cell activity.",
      },
      {
        group: "Adaptogenic recovery",
        ingredients: ["Moringa Leaf Extract"],
        action: "Supply vitamins, minerals, and phytonutrients that support stress adaptation and follicular activity.",
      },
      {
        group: "Deficiency correction",
        ingredients: ["Vitamin D3"],
        action: "Correct the vitamin D insufficiency commonly observed in shift workers and support follicular differentiation.",
      },
      {
        group: "Nutritional restoration",
        ingredients: ["Spirulina"],
        action: "Provide proteins, amino acids, vitamins, minerals, and antioxidants that support metabolic function and hair growth.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Improved sleep quality and reduced fatigue" },
      { timeframe: "Weeks 4–8", outcome: "Better adaptation to shift schedules and reduced stress symptoms" },
      { timeframe: "Weeks 8–12", outcome: "Improved hair quality and reduced shedding" },
    ],
    clinicalNote:
      "Shift work disrupts the circadian rhythm and may lead to sleep disturbances, increased cortisol exposure, nutritional imbalance, and chronic low-grade inflammation that affect hair growth and scalp health.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Hair Fact Frequent Flyers
  // ───────────────────────────────────────────────────────────────────────────
  FREQUENT_FLYERS: {
    displayName: "Hair Fact Frequent Flyers (Travel Recovery)",
    diagnosisInsight:
      "Recommended for individuals with frequent air travel, disrupted sleep cycles, high stress exposure, fatigue, increased environmental stressors, hair fall, premature greying, dry hair, or skin concerns associated with frequent flying.",
    treatmentObjective:
      "Minimise the biological impact of recurrent travel, support circadian regulation, reduce oxidative stress, strengthen immune resilience, and maintain healthy hair, skin, and overall wellbeing.",
    therapeuticStrategy: [
      "Circadian rhythm optimisation → supports sleep architecture and time-zone adaptation",
      "Stress regulation & recovery → reduces travel-associated physiological stress",
      "Oxidative stress protection → protects against environmental free-radical damage",
      "Immune system support → strengthens defence and recovery mechanisms",
      "Hair & skin vitality support → maintains follicular health under lifestyle stress",
    ],
    formulationRationale: [
      {
        group: "Immune resilience",
        ingredients: ["Colostrum", "Lactoferrin"],
        action: "Provide bioactive immune factors that support barrier function, gut health, and recovery from environmental stressors.",
      },
      {
        group: "Nutrient restoration",
        ingredients: ["Spirulina"],
        action: "Supply proteins, amino acids, vitamins, minerals, and phytonutrients for metabolic health and cellular repair.",
      },
      {
        group: "Adaptogenic recovery",
        ingredients: ["Moringa Leaf Extract"],
        action: "Support stress adaptation, antioxidant protection, and scalp health under physical and mental demand.",
      },
      {
        group: "Sleep & circadian support",
        ingredients: ["Melatonin"],
        action: "Regulate sleep-wake cycles, improve recovery quality, and minimise the effects of jet lag.",
      },
      {
        group: "Hair growth & immune support",
        ingredients: ["Vitamin D"],
        action: "Support follicular function, immune regulation, and dermal papilla cell activity.",
      },
      {
        group: "Antioxidant & cellular protection",
        ingredients: ["Vitamin C"],
        action: "Provide antioxidant protection, support immune function, and promote collagen synthesis.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 2–4", outcome: "Improved sleep and time-zone adaptation" },
      { timeframe: "Weeks 4–8", outcome: "Reduced travel-related fatigue and stress, enhanced immune resilience" },
      { timeframe: "Weeks 8–12", outcome: "Improved hair texture, scalp health, and reduced shedding" },
    ],
    clinicalNote:
      "Frequent travel exposes the body to circadian disruption, sleep deprivation, oxidative stress, and irregular dietary patterns. Supporting recovery pathways and nutritional status helps mitigate cumulative effects.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Pro Fact Meta B Hypothyroid
  // ───────────────────────────────────────────────────────────────────────────
  META_B_HYPOTHYROID: {
    displayName: "Pro Fact Meta B Hypothyroid Support",
    diagnosisInsight:
      "Recommended for individuals experiencing hair fall, weight gain, reduced metabolic activity, or nutritional insufficiencies associated with hypothyroidism.",
    treatmentObjective:
      "Support thyroid-related metabolic function, optimise nutrient availability, improve body composition, and create a physiological environment that supports healthy hair growth and overall wellbeing.",
    therapeuticStrategy: [
      "Nutritional repletion → provides nutrients required for metabolic activity and thyroid hormone utilisation",
      "Metabolic optimisation → supports energy expenditure and improved metabolic efficiency",
      "Thyroid function support → maintains physiological activity through targeted cofactors",
      "Oxidative stress reduction → enhances antioxidant defence",
      "Hair growth environment enhancement → improves nutrient delivery to follicles",
    ],
    formulationRationale: [
      {
        group: "Metabolic support",
        ingredients: ["Garcinia Cambogia Extract (HCA)"],
        action: "Support healthy body composition, fat metabolism, and metabolic efficiency.",
      },
      {
        group: "Thyroid nutrient complex",
        ingredients: ["Kelp Seaweed"],
        action: "Provide naturally occurring nutrients that support thyroid hormone synthesis and metabolic regulation.",
      },
      {
        group: "Weight management support",
        ingredients: ["Pumpkin Seed Extract"],
        action: "Supply fibre, protein, and fatty acids that support satiety and metabolic health.",
      },
      {
        group: "Metabolic & endocrine support",
        ingredients: ["Moringa Leaf Extract"],
        action: "Support healthy metabolic function, body composition management, and nutritional status.",
      },
      {
        group: "Antioxidant support",
        ingredients: ["Vitamin C"],
        action: "Reduce oxidative stress, support cellular repair, and contribute to efficient energy metabolism.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–8", outcome: "Improved metabolic efficiency and energy levels" },
      { timeframe: "Weeks 8–12", outcome: "Enhanced antioxidant protection and body composition support" },
      { timeframe: "Weeks 12–16", outcome: "Gradual improvement in hair quality and reduction in thyroid-associated shedding" },
    ],
    clinicalNote:
      "Hair growth and thyroid function are closely interconnected. Addressing nutritional gaps, oxidative stress, and metabolic slowing supports more consistent hair-growth outcomes alongside medical thyroid management.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Lactihealth (Postpartum Recovery & Hair Support)
  // ───────────────────────────────────────────────────────────────────────────
  LACTIHEALTH: {
    displayName: "Lactihealth (Postpartum Recovery & Hair Support)",
    diagnosisInsight:
      "Recommended for women experiencing postpartum hair shedding, nutritional depletion, fatigue, reduced recovery, or increased physiological demands following pregnancy and breastfeeding.",
    treatmentObjective:
      "Replenish nutritional reserves depleted during pregnancy, support postpartum recovery, reduce excessive hair shedding, and create an optimal environment for healthy hair regrowth and maternal wellbeing.",
    therapeuticStrategy: [
      "Nutritional repletion → restores vitamins, minerals, proteins depleted during pregnancy and lactation",
      "Postpartum recovery support → supports tissue repair and cellular recovery after delivery",
      "Hair cycle normalisation → supports transition from pregnancy retention to healthy cycling and regrowth",
      "Metabolic & energy restoration → addresses demands of recovery, childcare, and breastfeeding",
      "Maternal wellness → promotes overall health and nutritional adequacy postpartum",
    ],
    formulationRationale: [
      {
        group: "Hair growth nutrients",
        ingredients: ["Iron", "Zinc", "Vitamin D", "Vitamin A", "B-Complex Vitamins"],
        action: "Support follicular metabolism, keratin production, and healthy hair cycle regulation.",
      },
      {
        group: "Postpartum recovery",
        ingredients: ["Iron", "Folate", "Vitamin B12"],
        action: "Assist tissue repair, cellular regeneration, and restoration of depleted reserves.",
      },
      {
        group: "Breastfeeding nutritional support",
        ingredients: ["Calcium", "Iodine", "Selenium", "Omega-3 Fatty Acids"],
        action: "Meet the increased nutritional requirements of lactation and maternal recovery.",
      },
      {
        group: "Metabolic & energy support",
        ingredients: ["B Vitamins", "Copper"],
        action: "Support energy production, oxygen transport, and normal metabolic function.",
      },
      {
        group: "Antioxidant & cellular protection",
        ingredients: ["Vitamin C", "Selenium"],
        action: "Reduce oxidative stress and support healthy cellular function during recovery.",
      },
    ],
    expectedResponse: [
      { timeframe: "Weeks 4–8", outcome: "Improved nutritional status and energy" },
      { timeframe: "Weeks 8–12", outcome: "Reduction in excessive postpartum hair shedding" },
      { timeframe: "Months 3–6", outcome: "Progressive return to normal hair growth density over subsequent cycles" },
    ],
    clinicalNote:
      "Postpartum telogen effluvium is physiologically normal, but nutritional depletion and lactation demands can increase severity and prolong recovery. Targeted nutritional support helps optimise recovery and regrowth.",
  },
};

/**
 * Map every KitId variant in production to one of the canonical entries.
 * Keys are matched by exact equality (case-sensitive) against the kit id
 * persisted in the recommendations artifact.
 */
const KIT_ID_TO_ENTRY: Record<string, keyof typeof ENTRIES> = {
  // Telogen Effluvium
  "HAIR FACT TE GOLD": "TE_GOLD",
  "HAIR FACT TE GOLD VEG": "TE_GOLD",
  // Pro Immune
  "PRO IMMUNE GOLD": "PRO_IMMUNE_GOLD",
  "PRO IMMUNE GOLD PLUS": "PRO_IMMUNE_GOLD",
  "PRO IMMUNE VEG": "PRO_IMMUNE_GOLD",
  // Phenotype Inflammation
  "PHENOTYPE INFLAMATION": "PHENOTYPE_INFLAMMATION",
  "PHENOTYPE INFLAMMATION": "PHENOTYPE_INFLAMMATION",
  // MPHL
  "MPHL": "MPHL",
  "MPHL PLUS": "MPHL",
  // FPHL
  "FPHL": "FPHL",
  "FPHL PLUS": "FPHL",
  // Alopecia areata
  "HAIR FACT ALOPECIA AREATA": "ALOPECIA_AREATA",
  // Peri-meno / meno / post-meno
  "HAIR FACT PERI MENOPAUSE": "PERI_MENOPAUSE",
  "HAIR FACT PERI MENOPAUSE VEG": "PERI_MENOPAUSE",
  "PRO FACT META B MENOPAUSE": "PERI_MENOPAUSE",
  "PRO FACT META B MENOPAUSE VEG": "PERI_MENOPAUSE",
  "PRO FACT META B POSTMENOPAUSE": "PERI_MENOPAUSE",
  "PRO FACT META B POSTMENOPAUSE VEG": "PERI_MENOPAUSE",
  // PCOS
  "F-PCOS -1": "PCOS",
  "F-PCOS VEG -1": "PCOS",
  "PRO FACT META B PCOS": "PCOS",
  // Meta B (metabolic reset — upstream of pattern / hormonal / inflammation)
  "PRO FACT META B": "META_B",
  "PRO FACT META B VEG": "META_B",
  // Oxidative stress
  "OXIDATIVE STRESS": "OXIDATIVE_STRESS",
  // GI gold
  "PRO FACT GI GOLD": "GI_GOLD",
  "PRO FACT GI GOLD VEG": "GI_GOLD",
  // Trichotillomania (TTM) — behavioural / OCD-driven pulling
  "TTM": "TTM_SUPPORT",
  "HAIR FACT TTM (OCD)": "TTM_SUPPORT",
  "HAIR FACT TTM": "TTM_SUPPORT",
  // Hair Breakage Repair (HBR) — shaft-level breakage repair
  "HBR": "HBR",
  "HAIR FACT HBR": "HBR",
  "HAIR FACT HAIR BREAKAGE REPAIR (HBR)": "HBR",
  "HAIR FACT HAIR BREAKAGE REPAIR(HBR)": "HBR",
  // Early Greying Care Gold
  "EARLY GREYING CARE GOLD": "EARLY_GREYING_CARE_GOLD",
  "EARLY GREYING CARE VEG": "EARLY_GREYING_CARE_GOLD",
  "EARLY GREYING CARE": "EARLY_GREYING_CARE_GOLD",
  "HAIR FACT EG CARE": "EARLY_GREYING_CARE_GOLD",
  // Pro Fact Thyroid Care (hyperthyroid)
  "PRO FACT THYROID CARE": "PRO_FACT_THYROID_CARE",
  "PRO FACT THYROID CARE VEG": "PRO_FACT_THYROID_CARE",
  // Rapid Weight Loss Shield (incl. GLP-1 recovery)
  "RAPID WEIGHT LOSS SHIELD": "RWL_SHIELD",
  "RWL SHIELD": "RWL_SHIELD",
  // FH Well 3 (endometriosis support)
  "FH WELL 3": "FH_WELL_3",
  // Iron Up Gold
  "IRON UP GOLD": "IRON_UP_GOLD",
  "IRON UP GOLD VEG": "IRON_UP_GOLD",
  // Hair Fact Night Shift
  "HAIR FACT NIGHT SHIFT": "NIGHT_SHIFT",
  "NIGHT SHIFT": "NIGHT_SHIFT",
  // Hair Fact Frequent Flyers
  "HAIR FACT FREQUENT FLYERS": "FREQUENT_FLYERS",
  "FREQUENT FLYERS": "FREQUENT_FLYERS",
  // Pro Fact Meta B Hypothyroid
  "PRO FACT META B HYPOTHYROID": "META_B_HYPOTHYROID",
  "META B HYPOTHYROID": "META_B_HYPOTHYROID",
  "PRO FACT META B HYPOTHYROID VEG": "META_B_HYPOTHYROID",
  // Lactihealth (postpartum recovery)
  "LACTIHEALTH": "LACTIHEALTH",
  "HAIR FACT LACTIHEALTH": "LACTIHEALTH",
};

/**
 * Resolve a runtime KitId (as it appears in the recommendations artifact)
 * to its KitInfo entry. Returns null when no entry is documented yet —
 * callers should render a minimal kit card from the KitId alone in that case.
 */
export function getKitInfo(kitId: string): KitInfo | null {
  const key = KIT_ID_TO_ENTRY[kitId];
  if (!key) return null;
  return ENTRIES[key];
}

/**
 * Whether a documented KitInfo entry exists for this kit. Useful when
 * deciding which kits in the rankedKits list will produce a rich card.
 */
export function hasKitInfo(kitId: string): boolean {
  return kitId in KIT_ID_TO_ENTRY;
}
