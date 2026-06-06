import type { DiagnosisKey } from '../../../types';
import type { EducationalInsight } from '../types';

// ─── Condition → Educational Content ─────────────────────────────────────────

const CONDITION_EDUCATION: Record<DiagnosisKey, readonly EducationalInsight[]> = {
  AGA_MALE_123: [
    {
      topic: 'Why hair follicles miniaturise in AGA',
      patientFriendlyExplanation:
        'In androgenetic alopecia, certain hair follicles carry a genetic sensitivity to DHT — a hormone derived from testosterone. Over time, DHT causes these follicles to shrink and produce progressively thinner, shorter hairs until they stop producing hair altogether.',
      clinicalContext:
        'Type II 5α-reductase converts testosterone to DHT, which binds AR receptors in susceptible dermal papilla cells, triggering TGF-β1 and DKK-1 expression that inhibits follicle cycling and promotes miniaturisation.',
      relevantBecause:
        'Your hair loss follows this classic androgenetic pattern, making DHT suppression central to your treatment.',
    },
    {
      topic: 'Why early treatment achieves better outcomes',
      patientFriendlyExplanation:
        'Once a follicle has fully miniaturised and lost its blood supply, it cannot regrow hair. Treating early — when follicles are still present but shrinking — dramatically improves the chance of recovery.',
      clinicalContext:
        'Early intervention targets the miniaturisation cascade before dermal papilla cell apoptosis renders follicles permanently fibrotic.',
      relevantBecause:
        'Your Grade 1–3 presentation means a significant proportion of your follicles are still salvageable.',
    },
  ],
  AGA_MALE_45: [
    {
      topic: 'Advanced AGA: stabilisation first',
      patientFriendlyExplanation:
        'At Grade 4–5, many follicles have already miniaturised significantly. The primary goal of treatment shifts to preserving remaining follicles and preventing further loss, with secondary regrowth where follicles are still viable.',
      clinicalContext:
        'Grade 4–5 AGA features extensive bitemporal recession and vertex thinning. Dermal papilla cell populations are substantially reduced but not absent; aggressive therapy can still yield meaningful stabilisation.',
      relevantBecause:
        'Your advanced presentation requires a high-intensity, sustained protocol. Expectations for regrowth should be realistic — stabilisation is the primary win.',
    },
  ],
  AGA_FEMALE_123: [
    {
      topic: 'Female pattern hair loss is different from male AGA',
      patientFriendlyExplanation:
        'Female pattern hair loss typically appears as diffuse thinning across the crown and top of the scalp, preserving the frontal hairline. It is driven by a combination of genetic sensitivity, hormonal changes, and often nutritional factors — not just DHT.',
      clinicalContext:
        'FPHL involves a mix of DHT sensitivity (Type I 5α-reductase in frontal scalp), oestrogen decline, and prostaglandin D2 upregulation. The Ludwig classification grades diffuse vertex thinning distinct from Hamilton-Norwood patterns.',
      relevantBecause:
        'Understanding the female-specific mechanism helps explain why your protocol includes hormonal and nutritional components alongside topical therapy.',
    },
  ],
  AGA_FEMALE_45: [
    {
      topic: 'Advanced female AGA requires multi-modal support',
      patientFriendlyExplanation:
        'Advanced female pattern hair loss involves significant thinning that may feel distressing. However, unlike in men, most women retain their frontal hairline, and comprehensive treatment can still achieve meaningful improvement.',
      clinicalContext:
        'Ludwig Grade III FPHL may still respond to aggressive topical + systemic therapy; complete follicle loss is less common than in advanced male AGA due to lower androgen levels and different follicle receptor distribution.',
      relevantBecause:
        'Your grade indicates the need for sustained, multi-layered intervention — your protocol reflects this.',
    },
  ],
  TE_STRESS: [
    {
      topic: 'How stress triggers hair loss 2–3 months later',
      patientFriendlyExplanation:
        'Stress forces large numbers of hair follicles into a resting (telogen) phase simultaneously. When these hairs shed 2–3 months later, it can feel alarming — but the underlying growth cycles are intact and recovery follows once the trigger is removed.',
      clinicalContext:
        'Substance P and CRH from stress signalling shift follicles from anagen to telogen via glucocorticoid receptor activation in dermal papilla cells. The 2–3 month lag corresponds to the normal telogen duration before shedding.',
      relevantBecause:
        'Identifying and addressing your stress trigger is as important as the topical and nutritional support in your protocol.',
    },
  ],
  TE_NUTRITION: [
    {
      topic: 'Nutritional deficiencies and hair growth',
      patientFriendlyExplanation:
        'Hair follicles have very high energy and nutrient demands. When key nutrients (iron, zinc, protein, B vitamins) fall below optimal levels, the body prioritises vital organs and hair growth is the first casualty.',
      clinicalContext:
        'Ferritin, serum zinc, and biotin deficiencies directly impair keratinocyte proliferation and follicular matrix cell division. Protein restriction reduces cysteine availability for disulphide bond formation in hair keratin.',
      relevantBecause:
        'Nutritional correction is the primary driver of your recovery and directly addresses the root cause identified in your assessment.',
    },
  ],
  TE_POSTPREG: [
    {
      topic: 'Post-partum hair loss is expected and temporary',
      patientFriendlyExplanation:
        'During pregnancy, high oestrogen levels keep follicles in continuous growth, giving many women their thickest hair ever. After delivery, oestrogen drops suddenly, causing those follicles to shed simultaneously. This is normal and self-limiting.',
      clinicalContext:
        'Post-partum TE occurs as oestrogen-extended anagen follicles transition to telogen en masse following parturition. The process is physiological and typically self-resolves within 6–12 months.',
      relevantBecause:
        'Your protocol supports recovery and optimises the regrowth window without interfering with breastfeeding.',
    },
  ],
  TE_DELIVERY: [
    {
      topic: 'Post-delivery hair loss timeline',
      patientFriendlyExplanation:
        'The dramatic hormonal shift that occurs after delivery causes many follicles to enter a resting phase simultaneously. Peak shedding typically occurs 2–4 months post-delivery and naturally resolves over the following 6–12 months.',
      clinicalContext:
        'Parturition-associated TE: rapid oestrogen withdrawal triggers synchronised anagen-to-telogen shift. Recovery is generally complete without intervention in healthy patients; nutritional support accelerates timeline.',
      relevantBecause:
        'Your protocol focuses on nutritional support and shedding arrest to accelerate natural recovery.',
    },
  ],
  TE_ILLNESS: [
    {
      topic: 'How illness triggers hair loss',
      patientFriendlyExplanation:
        'Any significant physical illness — whether an infection, surgery, or fever — creates a physiological stress response that can push hair follicles into a resting phase. Hair sheds 2–3 months after the illness itself.',
      clinicalContext:
        'Systemic illness-associated TE: inflammatory cytokines (IL-1β, TNF-α) disrupt follicular growth signalling. Recovery follows restoration of systemic homeostasis.',
      relevantBecause:
        'Your protocol supports recovery and prevents the secondary nutritional depletion that can extend post-illness TE.',
    },
  ],
  THYROID_HYPO: [
    {
      topic: 'Hypothyroidism and hair growth cycles',
      patientFriendlyExplanation:
        'Thyroid hormones regulate the speed of many body processes, including hair growth cycles. When thyroid levels are low, hair follicles slow down, producing finer hairs and eventually causing increased shedding.',
      clinicalContext:
        'TSH-regulated T3/T4 directly modulates follicular cycling via thyroid hormone receptors in dermal papilla cells. Hypothyroidism prolongs telogen and shortens anagen, producing diffuse TE and reduced hair calibre.',
      relevantBecause:
        'Thyroid normalisation is the most critical step in your recovery — your topical and nutritional protocol supports this process.',
    },
  ],
  THYROID_HYPER: [
    {
      topic: 'Hyperthyroidism and hair loss',
      patientFriendlyExplanation:
        'Excess thyroid hormone over-accelerates body processes, including hair cycling. Follicles move through growth phases too quickly, leading to premature shedding and reduced hair density.',
      clinicalContext:
        'Hyperthyroidism accelerates catagen via excess T3 stimulation, shortening anagen duration and increasing synchronous shedding. Hair loss typically resolves with thyroid management.',
      relevantBecause:
        'Your hair loss is secondary to thyroid dysregulation; thyroid management is the primary intervention, supported by your hair protocol.',
    },
  ],
  PCOS_ONLY: [
    {
      topic: 'PCOS and androgenic hair loss',
      patientFriendlyExplanation:
        'In PCOS, the ovaries produce excess androgens (male hormones). At genetically sensitive follicles, these androgens are converted to DHT, triggering the same miniaturisation process seen in genetic hair loss — but driven by hormonal imbalance rather than genetics alone.',
      clinicalContext:
        'PCOS-associated hyperandrogenism elevates free testosterone and DHEAS. Increased peripheral 5α-reductase activity and reduced SHBG amplify follicular androgen exposure, driving AGA-pattern miniaturisation.',
      relevantBecause:
        'Addressing PCOS-driven androgen excess through hormonal and systemic therapy is as important as topical intervention in your protocol.',
    },
  ],
  PCOS_OBESITY: [
    {
      topic: 'Metabolic syndrome amplifies androgenic hair loss',
      patientFriendlyExplanation:
        'When PCOS is combined with metabolic factors like insulin resistance or excess weight, androgen production is further elevated, making hair loss more aggressive and harder to treat without addressing the metabolic component.',
      clinicalContext:
        'Insulin resistance in PCOS reduces hepatic SHBG synthesis, increasing bioavailable testosterone and DHT. Adipose aromatase also dysregulates androgen-to-oestrogen ratios, compounding follicular stress.',
      relevantBecause:
        'Your protocol targets both the androgenic and metabolic drivers simultaneously for maximum efficacy.',
    },
  ],
  PERI_MENOPAUSE: [
    {
      topic: 'Peri-menopausal hormonal shifts and hair',
      patientFriendlyExplanation:
        'In the years before menopause, oestrogen and progesterone levels begin to fluctuate unpredictably. These hormonal shifts can reduce the protective effect oestrogen has on hair follicles, leading to thinning particularly at the crown.',
      clinicalContext:
        'Peri-menopausal oestradiol fluctuation reduces ERα signalling in follicles, shortening anagen and increasing catagen frequency. Progesterone decline further diminishes 5α-reductase inhibition, increasing DHT exposure.',
      relevantBecause:
        'Your protocol addresses the hormonal component alongside topical follicle support.',
    },
  ],
  MENOPAUSE: [
    {
      topic: 'Oestrogen decline and hair follicles',
      patientFriendlyExplanation:
        'After menopause, oestrogen levels drop significantly. Oestrogen normally prolongs the active growth phase of hair follicles. Without this protection, follicles shorten their growth cycles and produce progressively finer hairs.',
      clinicalContext:
        'Post-menopausal oestrogen deficiency accelerates AGA progression via reduced ERα/ERβ-mediated anagen prolongation. Concurrent androgen dominance amplifies miniaturisation in susceptible follicles.',
      relevantBecause:
        'Long-term management is expected. Your protocol is designed for sustained use with regular review.',
    },
  ],
  POST_MENOPAUSE: [
    {
      topic: 'Post-menopausal hair management',
      patientFriendlyExplanation:
        'Years after menopause, sustained oestrogen deficiency and relatively higher androgen levels continue to affect hair follicles. This is a chronic, manageable condition — the goal is maximising the density you have and preventing further decline.',
      clinicalContext:
        'Chronic post-menopausal oestrogen deficiency creates a persistent androgen-dominant milieu at follicles. Long-term topical and systemic support is the standard of care.',
      relevantBecause:
        'Your protocol is designed for long-term maintenance with annual reviews.',
    },
  ],
  IRON_DEFICIENCY: [
    {
      topic: 'Ferritin levels and hair health',
      patientFriendlyExplanation:
        'Ferritin (your iron storage protein) is essential for hair follicle cell division. Levels below 40 ng/mL are consistently associated with hair loss, even when standard blood tests show "normal" iron. Many labs use a lower cutoff that misses hair-relevant deficiency.',
      clinicalContext:
        'Ferritin below 40 ng/mL impairs ribonucleotide reductase activity in rapidly proliferating hair matrix cells. Correction to >70 ng/mL is associated with hair loss resolution in nutritional TE.',
      relevantBecause:
        'Iron repletion is the most direct intervention for your condition and forms the cornerstone of your protocol.',
    },
  ],
  ALOPECIA_AREATA: [
    {
      topic: 'Alopecia areata is an immune condition',
      patientFriendlyExplanation:
        'In alopecia areata, the immune system mistakenly attacks hair follicles, causing them to stop producing hair. The follicles themselves remain alive and capable of regrowth — which is why spontaneous recovery is possible and treatment can reactivate them.',
      clinicalContext:
        'AA is a T-cell mediated autoimmune condition targeting anagen follicle immune privilege. CD8+ T cells infiltrate the follicular bulb, suppressing growth. JAK-STAT signalling pathway dysregulation is a key therapeutic target.',
      relevantBecause:
        'Immune modulation is the central focus of your protocol, alongside scalp support.',
    },
  ],
  PREGNANCY: [
    {
      topic: 'Pregnancy and hair changes',
      patientFriendlyExplanation:
        'Pregnancy-related hair changes are largely driven by the high oestrogen levels that extend hair growth cycles during pregnancy. Most hair concerns during pregnancy resolve post-partum. Safe supportive care focuses on nutrition.',
      clinicalContext:
        'Oestrogen-extended anagen during pregnancy prevents normal shedding. Post-partum TE follows as hormones normalise. Safety of all interventions must be assessed against pregnancy contraindication profiles.',
      relevantBecause:
        'Your protocol uses only pregnancy-safe ingredients and focuses on optimal nutritional support.',
    },
  ],
  WEIGHT_LOSS: [
    {
      topic: 'Rapid weight loss and telogen effluvium',
      patientFriendlyExplanation:
        'Losing weight quickly — whether through caloric restriction, surgery, or illness — deprives follicles of the energy and nutrients they need to maintain active growth. This triggers widespread shedding 2–3 months after the weight loss period.',
      clinicalContext:
        'Caloric restriction below 1000 kcal/day and protein insufficiency (<50g/day) suppress follicle matrix cell mitosis. Surgical weight loss patients may also develop iron, zinc, and biotin deficiencies.',
      relevantBecause:
        'Nutritional stabilisation and replenishment of depleted micronutrients are the primary recovery strategies in your protocol.',
    },
  ],
  GUT_ISSUES: [
    {
      topic: 'Gut health and nutrient absorption for hair',
      patientFriendlyExplanation:
        'Even if you eat a nutrient-rich diet, gut health issues can prevent those nutrients from being properly absorbed. This creates deficiencies that affect hair follicles despite adequate dietary intake.',
      clinicalContext:
        'Intestinal permeability, dysbiosis, and inflammatory bowel conditions impair absorption of iron, zinc, B12, and amino acids — all essential for follicle cell division and keratin synthesis.',
      relevantBecause:
        'Your protocol addresses gut restoration alongside topical care, as nutrient delivery to follicles cannot be optimised without addressing absorption.',
    },
  ],
  SCALP_INFLAM: [
    {
      topic: 'How scalp inflammation damages follicles',
      patientFriendlyExplanation:
        'Chronic scalp inflammation — from conditions like seborrhoeic dermatitis, dandruff, or psoriasis — creates an environment hostile to healthy hair growth. Inflammatory mediators can accelerate miniaturisation and shorten growth cycles.',
      clinicalContext:
        'Scalp inflammation elevates prostaglandin D2 (PGD2) and IL-1α at the follicular infundibulum, inhibiting anagen entry and promoting catagen. Malassezia-driven inflammation further compounds the effect.',
      relevantBecause:
        'Resolving your scalp condition is a prerequisite for successful hair recovery.',
    },
  ],
  HAIR_BREAKAGE: [
    {
      topic: 'Structural breakage vs. true hair loss',
      patientFriendlyExplanation:
        'Not all hair loss involves follicle damage. When hair fibres break mid-shaft due to chemical damage, heat, or structural weakness, it can mimic hair loss. Treatment focuses on strengthening the hair structure from root to tip.',
      clinicalContext:
        'Hair shaft fracture at the cuticle-cortex interface due to disulphide bond disruption from chemical or thermal insults. Restoration requires cysteine/methionine replenishment and cuticle-sealing treatments.',
      relevantBecause:
        'Your protocol targets structural repair, which should produce rapid visible improvement.',
    },
  ],
  OXIDATIVE: [
    {
      topic: 'Oxidative stress and follicle damage',
      patientFriendlyExplanation:
        'Free radicals — generated by UV exposure, pollution, stress, and metabolic processes — can damage follicle cells. When antioxidant defences are overwhelmed, this oxidative damage accelerates follicle ageing and hair loss.',
      clinicalContext:
        'Reactive oxygen species (ROS) cause mitochondrial dysfunction in follicle matrix cells and dermal papilla. Catalase depletion in follicles is associated with premature greying and growth cycle disruption.',
      relevantBecause:
        'Antioxidant support is a core component of your protocol to neutralise ongoing follicle damage.',
    },
  ],
  NIGHT_SHIFT: [
    {
      topic: 'Circadian rhythm and hair growth cycles',
      patientFriendlyExplanation:
        'Hair follicles have their own internal clock synchronised to the body\'s circadian rhythm. Chronic disruption of this rhythm — from shift work or irregular sleep — desynchronises follicle cycles, increasing shedding and impairing growth.',
      clinicalContext:
        'Clock genes (BMAL1, PER1) regulate anagen/catagen cycling in follicle stem cells. Circadian disruption via light-at-night or shift work dysregulates melatonin-mediated follicle cycle gating.',
      relevantBecause:
        'Circadian reset support and lifestyle adjustments are included in your protocol.',
    },
  ],
  FREQUENT_FLYING: [
    {
      topic: 'Frequent flying and hair health',
      patientFriendlyExplanation:
        'Frequent long-haul travel exposes hair follicles to circadian disruption, radiation at altitude, cabin dehydration, and pressure changes. These stressors can cumulatively impact hair cycling.',
      clinicalContext:
        'Time zone crossing and hypoxic cabin environments disrupt melatonin regulation and increase oxidative load. Cumulative circadian stress in frequent flyers can trigger chronic TE in susceptible individuals.',
      relevantBecause:
        'Your protocol includes protective and restorative support tailored to high-travel lifestyle demands.',
    },
  ],
  DIABETES: [
    {
      topic: 'Metabolic dysfunction and follicle health',
      patientFriendlyExplanation:
        'Elevated blood sugar damages blood vessels and nerves throughout the body, including those supplying hair follicles. Reduced blood flow and elevated insulin can impair follicle function and accelerate androgenic hair loss.',
      clinicalContext:
        'Hyperglycaemia-induced microvascular damage reduces follicle papilla perfusion. Insulin resistance amplifies IGF-1 and androgen levels, accelerating miniaturisation. Mitochondrial dysfunction from glycation further impairs anagen maintenance.',
      relevantBecause:
        'Metabolic support is a key pillar of your protocol alongside topical therapy.',
    },
  ],
  CHRONIC_MEDICAL: [
    {
      topic: 'How chronic illness affects hair',
      patientFriendlyExplanation:
        'Chronic illnesses create sustained physiological stress that can disrupt hair growth cycles, deplete nutrients, and impair the body\'s ability to maintain follicle health. Hair loss in this context is often multifactorial.',
      clinicalContext:
        'Chronic systemic disease creates persistent inflammatory cytokine elevation, nutritional depletion, and HPA axis dysregulation — all of which impair follicle cycling. Medication side effects may compound direct disease effects.',
      relevantBecause:
        'Your protocol is adapted for your medical context with contraindication review applied.',
    },
  ],
  TTM: [
    {
      topic: 'Trichotillomania and follicle recovery',
      patientFriendlyExplanation:
        'Trichotillomania causes direct trauma to hair follicles through repetitive pulling. While follicles can recover with time and behavioural support, repeated trauma to the same follicle may eventually cause permanent damage.',
      clinicalContext:
        'TTM-induced mechanical trauma disrupts the hair follicle bulge — the stem cell reservoir. Acute damage is reversible; chronic repeated pulling can cause permanent fibrous scarring of the follicular unit.',
      relevantBecause:
        'Your hair protocol works alongside the behavioural support component to maximise follicle recovery.',
    },
  ],
  ENDOMETRIOSIS: [
    {
      topic: 'Endometriosis and hormonal hair loss',
      patientFriendlyExplanation:
        'Endometriosis disrupts hormone balance, particularly the relationship between oestrogen and progesterone. This hormonal dysregulation can contribute to hair thinning, particularly in women with concurrent androgenic sensitivity.',
      clinicalContext:
        'Endometriosis-associated hormone dysregulation, combined with medication effects (GnRH analogues, progestins) and chronic inflammatory cytokine elevation, creates a complex environment for follicle health.',
      relevantBecause:
        'Your protocol is adapted for endometriosis-related hormonal patterns with appropriate contraindication review.',
    },
  ],
  EARLY_GREY: [
    {
      topic: 'Premature greying and melanocyte health',
      patientFriendlyExplanation:
        'Grey hair results from the depletion of melanocyte stem cells within the hair follicle. This can be accelerated by oxidative stress, genetic factors, nutritional deficiencies, and certain health conditions.',
      clinicalContext:
        'Melanocyte stem cell depletion in the follicle bulge is driven by accumulated ROS (H2O2) from catalase depletion, MITF dysregulation, and genetic factors. Reversal is limited once melanocytes are depleted.',
      relevantBecause:
        'Your protocol supports melanocyte protection to slow progression, with realistic expectations set around reversibility.',
    },
  ],
  MOUTH_ULCERS: [
    {
      topic: 'Nutritional and immune complex in hair',
      patientFriendlyExplanation:
        'Recurrent mouth ulcers alongside hair loss often signals an underlying nutritional deficiency (particularly B12, folate, or iron) or an immune-mediated process. Both need to be addressed together.',
      clinicalContext:
        'B12/folate deficiency and coeliac-associated immune dysregulation commonly present as a complex of aphthous stomatitis and diffuse TE. Autoimmune screen and nutritional panel are recommended.',
      relevantBecause:
        'Your protocol addresses the nutritional and immune components together.',
    },
  ],
  MULTI: [
    {
      topic: 'Mixed pathology hair loss requires a layered approach',
      patientFriendlyExplanation:
        'When multiple conditions contribute to hair loss simultaneously, treatment is more complex — but also more powerful when each factor is addressed directly. Your personalised protocol targets each identified driver.',
      clinicalContext:
        'Mixed aetiology hair loss (e.g., AGA + TE + nutritional) requires simultaneous addressing of androgenic, nutritional, and stress-axis components. Phased sequencing optimises response.',
      relevantBecause:
        'Your multi-driver presentation is reflected in the layered approach of your protocol.',
    },
  ],
  REGROW_ONLY: [
    {
      topic: 'Regrowth optimisation protocol',
      patientFriendlyExplanation:
        'This protocol focuses on maximising follicle activation and density in areas that have thinned. The goal is to coax existing dormant follicles back into active growth rather than treating a specific disease.',
      clinicalContext:
        'Regrowth optimisation targets the follicular stem cell niche through VEGF upregulation, Wnt/β-catenin pathway stimulation, and prostaglandin E2 promotion, combined with nutritional optimisation for anagen support.',
      relevantBecause:
        'Your protocol is built around follicle stimulation and density maximisation.',
    },
  ],
};

export function mapConditionToEducation(
  diagnosis: DiagnosisKey
): readonly EducationalInsight[] {
  return CONDITION_EDUCATION[diagnosis] ?? [];
}
