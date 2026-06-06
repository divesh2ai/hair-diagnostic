import type { ConditionDictionary } from '../types';

// Explanations for every DiagnosisKey variant.
// Keys are exhaustive — all 34 DiagnosisKey variants are covered.
export const CONDITION_EXPLANATIONS: ConditionDictionary = {

  // ── MALE PATTERN HAIR LOSS ─────────────────────────────────────────────────

  AGA_MALE_123: {
    clinical:
      'Androgenetic alopecia — male pattern, Hamilton-Norwood grade 1–3. DHT-mediated miniaturisation of androgen-sensitive follicles in bitemporal and early vertex distribution.',
    patient:
      'You have early-to-moderate male pattern hair loss caused by DHT hormone sensitivity. At this stage, the condition is very treatable and progression can be effectively slowed.',
    severity: 'moderate',
    category: 'pattern_loss',
  },

  AGA_MALE_45: {
    clinical:
      'Androgenetic alopecia — male pattern, Hamilton-Norwood grade 4–5. Advanced DHT-mediated follicular miniaturisation with extensive vertex involvement and progressive temporal recession.',
    patient:
      'Your hair loss pattern is at a more advanced stage. A structured multi-phase protocol can significantly slow further progression and support partial density recovery.',
    severity: 'high',
    category: 'pattern_loss',
  },

  // ── FEMALE PATTERN HAIR LOSS ───────────────────────────────────────────────

  AGA_FEMALE_123: {
    clinical:
      'Androgenetic alopecia — female pattern, Ludwig grade 1–3. Diffuse central crown thinning with preserved frontal hairline; androgen-mediated follicular miniaturisation.',
    patient:
      'You are experiencing early-to-moderate female pattern hair thinning, primarily across the crown. This responds well to a targeted, multi-layer treatment approach.',
    severity: 'moderate',
    category: 'pattern_loss',
  },

  AGA_FEMALE_45: {
    clinical:
      'Androgenetic alopecia — female pattern, Ludwig grade 4–5. Significant diffuse miniaturisation with markedly reduced density across the crown and temporal regions.',
    patient:
      'Your hair thinning is at a more advanced stage and requires a comprehensive, structured protocol to stabilise and gradually restore density over time.',
    severity: 'high',
    category: 'pattern_loss',
  },

  // ── TELOGEN EFFLUVIUM ──────────────────────────────────────────────────────

  TE_STRESS: {
    clinical:
      'Stress-induced telogen effluvium. Cortisol-mediated premature anagen-to-telogen phase shift producing diffuse shedding, typically presenting 2–3 months after the initiating stressor.',
    patient:
      'Stress is triggering a period of increased shedding where more follicles than usual are entering the resting phase. This is reversible with the right nutritional and anti-inflammatory support.',
    severity: 'moderate',
    category: 'shedding',
  },

  TE_NUTRITION: {
    clinical:
      'Nutritional telogen effluvium. Micronutrient deficiency — most commonly iron, zinc, biotin, or protein — accelerates telogen phase shift and reduces anagen re-entry efficiency.',
    patient:
      'A nutritional imbalance is causing your hair follicles to shed more than usual. Correcting these deficiencies is the primary treatment and results are typically very positive.',
    severity: 'moderate',
    category: 'shedding',
  },

  TE_POSTPREG: {
    clinical:
      'Post-partum telogen effluvium with concurrent breastfeeding. Rapid post-delivery oestrogen decline triggers synchronised telogen shift; lactational demands amplify micronutrient depletion.',
    patient:
      'Post-pregnancy hormonal changes are causing a shedding phase that is extremely common and temporary. Supporting nutrition during breastfeeding is the most important step.',
    severity: 'moderate',
    category: 'shedding',
  },

  TE_DELIVERY: {
    clinical:
      'Post-delivery telogen effluvium (non-breastfeeding). Oestrogen withdrawal-driven synchronised telogen shift without the additional lactational nutritional demand layer.',
    patient:
      'Post-delivery hormonal shifts are causing temporary increased shedding as your body readjusts. This phase is self-limiting and the right support accelerates recovery.',
    severity: 'moderate',
    category: 'shedding',
  },

  TE_ILLNESS: {
    clinical:
      'Telogen effluvium secondary to acute illness, surgery, or medication. Systemic physiological stress triggers diffuse follicular telogen phase advancement with characteristic 6–12 week latency.',
    patient:
      'Your body\'s recovery from illness or the effects of medication have temporarily disrupted your hair growth cycle. Rebuilding immune health restores normal growth patterns.',
    severity: 'moderate',
    category: 'shedding',
  },

  // ── THYROID ────────────────────────────────────────────────────────────────

  THYROID_HYPO: {
    clinical:
      'Hypothyroidism-associated diffuse alopecia. Insufficient thyroid hormone reduces follicular keratinocyte metabolic rate, shortens anagen, and generates TSH-driven chronic systemic inflammation.',
    patient:
      'An underactive thyroid is slowing your body\'s processes, including the energy available to hair follicles. Restoring thyroid function is the single most important first step.',
    severity: 'high',
    category: 'endocrine',
  },

  THYROID_HYPER: {
    clinical:
      'Hyperthyroidism-associated diffuse alopecia. Excess thyroid hormone accelerates cellular turnover, elevates oxidative stress, and creates follicular phase instability.',
    patient:
      'An overactive thyroid is placing your body in a heightened metabolic state that disrupts healthy hair cycles. Stabilising thyroid function is the core treatment goal.',
    severity: 'high',
    category: 'endocrine',
  },

  // ── PCOS ───────────────────────────────────────────────────────────────────

  PCOS_ONLY: {
    clinical:
      'PCOS-associated androgenetic alopecia without significant metabolic co-morbidity. Hyperandrogenism drives frontotemporal miniaturisation and seborrhoea via elevated DHEAS and free testosterone.',
    patient:
      'PCOS-related hormonal imbalances are causing your hair follicles to thin. Correcting androgen excess is the central goal of your treatment plan.',
    severity: 'high',
    category: 'hormonal',
  },

  PCOS_OBESITY: {
    clinical:
      'PCOS with metabolic syndrome. Concurrent insulin resistance amplifies androgen excess via hyperinsulinaemic stimulation of ovarian androgen synthesis and SHBG suppression.',
    patient:
      'The combination of PCOS and metabolic factors is creating a compounded hormonal environment that promotes thinning. Addressing both pathways simultaneously gives the best outcome.',
    severity: 'high',
    category: 'hormonal',
  },

  // ── MENOPAUSE SPECTRUM ─────────────────────────────────────────────────────

  PERI_MENOPAUSE: {
    clinical:
      'Peri-menopausal androgenic alopecia. Fluctuating and progressively declining oestrogen reduces follicular anti-androgenic protection, unmasking latent androgenetic susceptibility.',
    patient:
      'Hormonal fluctuations during the peri-menopausal transition are reducing the natural protection your hair has had. This is manageable with a targeted hormonal and nutritional protocol.',
    severity: 'moderate',
    category: 'hormonal',
  },

  MENOPAUSE: {
    clinical:
      'Menopausal hair loss. Sustained oestrogen deficit elevates the androgen-to-oestrogen ratio at the follicular level, driving progressive diffuse miniaturisation and shedding.',
    patient:
      'The hormonal changes of menopause have created conditions where hair is more susceptible to thinning. A targeted protocol can significantly improve density and slow progression.',
    severity: 'moderate',
    category: 'hormonal',
  },

  POST_MENOPAUSE: {
    clinical:
      'Post-menopausal androgenic alopecia with concurrent metabolic shift. Chronic oestrogen deficiency drives persistent follicular miniaturisation, compounded by insulin resistance and reduced IGF-1 signalling.',
    patient:
      'Post-menopausal hormonal and metabolic changes are contributing to ongoing hair thinning. A comprehensive approach addressing both factors produces the best long-term results.',
    severity: 'moderate',
    category: 'hormonal',
  },

  // ── IRON DEFICIENCY ────────────────────────────────────────────────────────

  IRON_DEFICIENCY: {
    clinical:
      'Iron-deficiency anaemia-associated telogen effluvium. Serum ferritin depletion (typically <30 ng/mL) impairs haemoglobin synthesis, reducing follicular matrix cell oxygen delivery and prolonging telogen phase.',
    patient:
      'Low iron levels are the primary driver of your hair shedding. Restoring iron stores is the single most important step — results are typically excellent once levels are corrected.',
    severity: 'high',
    category: 'nutritional',
  },

  // ── ALOPECIA AREATA ────────────────────────────────────────────────────────

  ALOPECIA_AREATA: {
    clinical:
      'Alopecia areata. CD8+ T-lymphocyte-mediated follicular immune privilege collapse causing patchy non-scarring alopecia with characteristic peribulbar lymphocytic infiltration.',
    patient:
      'Your immune system is temporarily targeting your hair follicles, causing patchy hair loss. With the right immune-modulatory support, significant regrowth is achievable in most cases.',
    severity: 'high',
    category: 'autoimmune',
  },

  // ── PREGNANCY ──────────────────────────────────────────────────────────────

  PREGNANCY: {
    clinical:
      'Active pregnancy state. Absolute protocol lock: only pregnancy-safe supplementation is prescribed. All androgenic, stimulatory, and hormonally active compounds are contraindicated.',
    patient:
      'Your treatment during pregnancy is carefully and specifically selected to be completely safe for you and your baby, prioritising your health and nutritional needs.',
    severity: 'low',
    category: 'special',
  },

  // ── WEIGHT LOSS ────────────────────────────────────────────────────────────

  WEIGHT_LOSS: {
    clinical:
      'Rapid weight loss-induced telogen effluvium. GLP-1 agonist or crash diet-driven caloric deficit suppresses IGF-1, depletes protein reserves, and depletes ferritin — all disrupting anagen maintenance.',
    patient:
      'Rapid weight loss has temporarily reduced the nutritional reserves your hair follicles need, triggering a shedding response. A targeted shield protocol protects follicles during this transition.',
    severity: 'high',
    category: 'nutritional',
  },

  // ── GUT ────────────────────────────────────────────────────────────────────

  GUT_ISSUES: {
    clinical:
      'Gut-hair axis disruption. Intestinal dysbiosis or inflammatory bowel pathology impairs absorption of hair-critical micronutrients and drives systemic low-grade inflammation via LPS-mediated barrier breach.',
    patient:
      'Your gut health is affecting nutrient absorption and creating body-wide inflammation that is impacting your hair. Restoring gut function is the foundational first step in your treatment.',
    severity: 'moderate',
    category: 'gastrointestinal',
  },

  // ── SCALP ──────────────────────────────────────────────────────────────────

  SCALP_INFLAM: {
    clinical:
      'Primary scalp inflammatory condition (seborrhoeic dermatitis or seborrhoea). Malassezia-driven NF-kB/IL-6/TNF-α perifollicular inflammation creates a hostile microenvironment for follicular cycling.',
    patient:
      'Inflammation on your scalp is creating an unfavourable environment for hair growth. Clearing this inflammatory load is the essential first step before any regrowth protocol can be effective.',
    severity: 'moderate',
    category: 'scalp',
  },

  // ── HAIR BREAKAGE ──────────────────────────────────────────────────────────

  HAIR_BREAKAGE: {
    clinical:
      'Mechanical or chemical hair shaft damage. Excessive cosmetic processing, heat application, or hard water mineral deposition weakens cortical keratin integrity, causing mid-shaft fracture rather than true hair loss.',
    patient:
      'Your hair shaft is being damaged by external factors such as heat, chemicals, or water minerals. Repairing and protecting the shaft will restore strength and reduce visible hair loss.',
    severity: 'low',
    category: 'structural',
  },

  // ── OXIDATIVE ──────────────────────────────────────────────────────────────

  OXIDATIVE: {
    clinical:
      'Lifestyle-induced systemic oxidative stress. Chronic tobacco, alcohol, or vaping exposure elevates circulating ROS, depletes antioxidant reserves, and accelerates follicular senescence.',
    patient:
      'Lifestyle factors are creating free radical damage that is aging your hair follicles prematurely. Reducing this oxidative burden significantly improves hair health over time.',
    severity: 'moderate',
    category: 'oxidative',
  },

  // ── CIRCADIAN ──────────────────────────────────────────────────────────────

  NIGHT_SHIFT: {
    clinical:
      'Shift work-associated circadian rhythm disorder driving alopecia. Suppressed nocturnal melatonin, chronic cortisol elevation, and disrupted anagen-promoting growth hormone pulsatility impair follicular cycling.',
    patient:
      'Night shift work is inverting the hormonal rhythms your hair follicles rely on. Resetting your circadian biology is the core treatment priority.',
    severity: 'moderate',
    category: 'circadian',
  },

  FREQUENT_FLYING: {
    clinical:
      'Travel-associated circadian and immune stress driving hair loss. Frequent transmeridian flights create circadian desynchrony, immune suppression, and cosmic radiation-driven oxidative follicular stress.',
    patient:
      'Frequent flying is disrupting your body clock and immune system, both of which have direct effects on the health of your hair growth cycle.',
    severity: 'low',
    category: 'circadian',
  },

  // ── METABOLIC ──────────────────────────────────────────────────────────────

  DIABETES: {
    clinical:
      'Diabetes/pre-diabetes-associated alopecia. Chronic hyperglycaemia drives microvascular damage to follicular papillae, insulin resistance impairs IGF-1 signalling, and elevated HbA1c correlates with TE severity.',
    patient:
      'Blood sugar imbalances are affecting both the blood flow to your hair follicles and the metabolic signals they need for healthy growth. Correcting the metabolic terrain is the primary goal.',
    severity: 'high',
    category: 'metabolic',
  },

  // ── CHRONIC MEDICAL ────────────────────────────────────────────────────────

  CHRONIC_MEDICAL: {
    clinical:
      'Chronic medical condition-associated alopecia. Prolonged systemic medication use, disease-driven inflammation, or sustained physiological stress impairs follicular cycling and immune competence.',
    patient:
      'Your ongoing medical condition is indirectly affecting your hair health. Supporting your immune system and managing inflammation forms the foundation of your treatment.',
    severity: 'moderate',
    category: 'systemic',
  },

  // ── TRICHOTILLOMANIA ───────────────────────────────────────────────────────

  TTM: {
    clinical:
      'Trichotillomania. OCD-spectrum compulsive hair-pulling causing repetitive mechanical follicular trauma; chronicity determines degree of follicular scarring and reversibility.',
    patient:
      'Trichotillomania involves a compulsive urge to pull hair that can be effectively addressed with targeted neurological support, alongside treatment to help follicles recover.',
    severity: 'high',
    category: 'neurological',
  },

  // ── ENDOMETRIOSIS ──────────────────────────────────────────────────────────

  ENDOMETRIOSIS: {
    clinical:
      'Endometriosis-associated alopecia. Oestrogen-dominant, prostaglandin-mediated systemic inflammatory state drives scalp follicular inflammatory load and concurrent hormonal dysregulation.',
    patient:
      'Endometriosis creates a hormonal and inflammatory environment that extends its effects to hair health. Balancing hormones and reducing inflammation are the two treatment pillars.',
    severity: 'moderate',
    category: 'hormonal',
  },

  // ── EARLY GREYING ──────────────────────────────────────────────────────────

  EARLY_GREY: {
    clinical:
      'Premature canities. Oxidative damage to melanocyte stem cells in the follicular bulge, combined with micronutrient deficiency (copper, PABA, B12, folic acid) and accelerated melanocyte apoptosis.',
    patient:
      'Premature greying is linked to oxidative stress and nutritional factors that damage the pigment-producing cells in your follicles. This process can be significantly slowed with the right support.',
    severity: 'moderate',
    category: 'pigmentation',
  },

  // ── MOUTH ULCERS ───────────────────────────────────────────────────────────

  MOUTH_ULCERS: {
    clinical:
      'Recurrent aphthous stomatitis with gut-immune axis dysregulation. Oral mucosal inflammation reflects systemic immune imbalance sharing inflammatory pathways with scalp follicular disease.',
    patient:
      'Recurrent mouth ulcers indicate an immune-gut imbalance that is also contributing to your hair concerns. Addressing this shared root cause benefits both conditions simultaneously.',
    severity: 'low',
    category: 'immune',
  },

  // ── MULTI-FACTORIAL ────────────────────────────────────────────────────────

  MULTI: {
    clinical:
      'Multi-factorial alopecia. Concurrent stress, gut dysbiosis, and androgenetic components create a complex clinical picture requiring a sequenced, multi-layer therapeutic strategy.',
    patient:
      'Multiple factors are contributing to your hair concerns together. A structured, layered protocol addresses each driver systematically, giving a more complete and durable result.',
    severity: 'high',
    category: 'complex',
  },

  // ── REGROW ONLY ────────────────────────────────────────────────────────────

  REGROW_ONLY: {
    clinical:
      'Stable post-TE state with resolved active shedding. Follicles are in extended telogen dwell without anagen re-entry. Clinical goal is anagen phase re-stimulation rather than shedding arrest.',
    patient:
      'The active shedding phase has resolved. The goal now is to encourage dormant follicles to re-enter the growth phase and produce new hair. A different set of tools is needed for this stage.',
    severity: 'low',
    category: 'recovery',
  },
};
