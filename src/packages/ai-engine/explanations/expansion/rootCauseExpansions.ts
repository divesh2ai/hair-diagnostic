/**
 * ROOT CAUSE EXPLANATIONS
 *
 * Maps root cause enums to clinical explanations and patient-friendly descriptions.
 * Used to populate narrative sections and provide context for why specific
 * therapy needs are being recommended.
 */

export interface RootCauseExplanation {
  readonly key: string;
  readonly title: string;
  readonly clinicalContext: string;
  readonly patientFriendly: string;
  readonly whyItMatters: string;
}

export const ROOT_CAUSE_EXPLANATIONS: Record<
  string,
  RootCauseExplanation
> = {
  IRON_DEFICIENCY: {
    key: "IRON_DEFICIENCY",
    title: "Iron Deficiency",
    clinicalContext:
      "Serum ferritin < 30 ng/mL indicates depleted iron stores. Hair follicles require iron for hemoglobin synthesis and catalase antioxidant function. Iron deficiency impairs follicle vitality and increases telogen shedding.",
    patientFriendly:
      "Your iron levels are lower than optimal. Iron carries oxygen to your hair roots and supports the proteins that protect them. Low iron leads to increased hair shedding.",
    whyItMatters:
      "Iron repletion stabilizes the hair cycle and reduces telogen shedding within 4-8 weeks. Ferritin should be restored to >30 ng/mL.",
  },

  GUT_MALABSORPTION: {
    key: "GUT_MALABSORPTION",
    title: "Gastrointestinal Malabsorption",
    clinicalContext:
      "Markers of intestinal permeability (elevated zonulin) or mucosal inflammation (elevated fecal calprotectin, low fecal elastase) indicate compromised nutrient absorption. Malabsorption reduces bioavailability of critical nutrients even when supplemented.",
    patientFriendly:
      "Your digestive system isn't absorbing nutrients properly. This means even when you eat or take supplements with good nutrients, your body isn't getting the full benefit. Your gut lining may be inflamed or leaky.",
    whyItMatters:
      "Restoring intestinal integrity improves nutrient absorption significantly within 4-6 weeks. This is foundational before increasing micronutrient supplementation.",
  },

  OXIDATIVE_STRESS: {
    key: "OXIDATIVE_STRESS",
    title: "Oxidative Stress and Free Radical Damage",
    clinicalContext:
      "Elevated free radical activity (measured via lipid peroxides, 8-OHdG) exceeds antioxidant capacity (low SOD, catalase, GPX). Sources include smoking, UV exposure, pollution, and metabolic stress. Oxidative stress damages follicle stem cells and triggers premature catagen.",
    patientFriendly:
      "Your body is experiencing damage from free radicals — harmful molecules from smoking, UV exposure, pollution, and stress. These molecules attack your hair follicles and force them out of the growth phase too early.",
    whyItMatters:
      "Antioxidant supplementation and lifestyle modifications reduce oxidative stress biomarkers within 2-3 weeks, protecting follicle stem cells from further damage.",
  },

  METABOLIC: {
    key: "METABOLIC",
    title: "Metabolic Dysfunction and Insulin Resistance",
    clinicalContext:
      "Elevated fasting glucose (>100 mg/dL), elevated HbA1c (>5.7%), or elevated HOMA-IR (>2.0) indicate metabolic dysfunction. Insulin resistance increases 5-alpha reductase activity (DHT production) while reducing IGF-1 signaling. This is a powerful driver of androgenetic alopecia.",
    patientFriendly:
      "Your metabolism isn't processing glucose efficiently. This causes your body to produce more DHT (a hormone that shrinks hair follicles) while reducing protective growth factors. Metabolic dysfunction is a major driver of hair loss.",
    whyItMatters:
      "Correcting insulin sensitivity normalizes DHT production and restores IGF-1 signaling within 4-6 weeks. This is critical for reversing miniaturization.",
  },

  HYPOTHYROID: {
    key: "HYPOTHYROID",
    title: "Hypothyroidism or Thyroid Dysfunction",
    clinicalContext:
      "Elevated TSH (>2.5 mIU/L) even in subclinical ranges, or elevated thyroid antibodies (TPO, thyroglobulin) indicate thyroid dysfunction. Thyroid hormones regulate metabolic rate and hair growth cycle. Low thyroid function increases anagen exit rate.",
    patientFriendly:
      "Your thyroid isn't producing enough hormone, or your immune system is attacking it. This slows your metabolism and disrupts the signals that keep hair growing. Even slightly low thyroid function can increase hair shedding.",
    whyItMatters:
      "Thyroid optimization normalizes TSH to <2.5 mIU/L within 6-8 weeks. This restores metabolic conditions necessary for hair growth and reduces telogen-driven shedding.",
  },

  POST_PARTUM: {
    key: "POST_PARTUM",
    title: "Post-Partum Immune and Hormonal Rebalancing",
    clinicalContext:
      "Post-partum period involves dramatic immune system rebalancing (Th1→Th2 reversal) and thyroid antibody production (peak at 3-6 months post-delivery). This triggers expected telogen effluvium but can persist if immune recovery is delayed. Concurrent thyroid autoimmunity increases risk of persistent hair loss.",
    patientFriendly:
      "After pregnancy, your immune system and hormones are going through major changes. This causes temporary increased hair shedding (telogen effluvium). Supporting your immune recovery helps your hair cycle normalize faster.",
    whyItMatters:
      "Immune-supportive supplementation accelerates recovery within 6-9 months. Without support, telogen effluvium can persist longer, sometimes triggering delayed-onset alopecia.",
  },

  ANDROGEN_SENSITIVITY: {
    key: "ANDROGEN_SENSITIVITY",
    title: "Androgen-Driven Follicle Miniaturization",
    clinicalContext:
      "High serum testosterone or free testosterone, or clinical pattern consistent with androgenetic alopecia (vertex/frontal pattern in genetically predisposed individuals). DHT sensitivity shrinks hair follicles progressively. Strong family history increases genetic predisposition.",
    patientFriendly:
      "Your hair loss is driven by genetic sensitivity to DHT, a male-pattern hormone. Even normal hormone levels can shrink hair follicles if you're genetically predisposed. This pattern typically runs in families.",
    whyItMatters:
      "DHT suppression via finasteride or dutasteride prevents continued miniaturization and allows follicle recovery. This is the most effective intervention for androgen-driven hair loss.",
  },

  INFLAMMATION: {
    key: "INFLAMMATION",
    title: "Chronic Systemic Inflammation",
    clinicalContext:
      "Elevated inflammatory markers (CRP > 3 mg/L, ESR, TNF-α, IL-6, IL-17) indicate chronic low-grade inflammation. Systemic inflammation upregulates substance P in hair follicles, promoting premature catagen transition and follicle damage. Often associated with concurrent autoimmune or inflammatory conditions.",
    patientFriendly:
      "Your body is in a state of chronic inflammation. This constant inflammatory state signals your hair follicles to stop growing and shed prematurely. Reducing inflammation helps calm this signal.",
    whyItMatters:
      "Anti-inflammatory therapy reduces inflammatory markers within 2-4 weeks. This stabilizes the follicle microenvironment and prevents premature cycle progression.",
  },

  NUTRITIONAL_DEFICIENCY: {
    key: "NUTRITIONAL_DEFICIENCY",
    title: "Micronutrient Deficiencies",
    clinicalContext:
      "Low B vitamins (B12, folate), low zinc, low copper, low selenium, or low vitamin D despite normal diet indicates absorption issues or dietary insufficiency. Hair follicles require these cofactors for protein synthesis, antioxidant defense, and immune function.",
    patientFriendly:
      "You're missing key nutrients that your hair roots need. This could be because you're not eating enough of them, your body isn't absorbing them properly, or you're using them up faster due to stress or inflammation.",
    whyItMatters:
      "Micronutrient repletion (via supplementation and/or improved absorption) restores follicle vitality within 4-8 weeks. This is most effective when combined with gut restoration if absorption is compromised.",
  },
};

/**
 * Get expansion for a root cause, or undefined if not found
 */
export function getRootCauseExplanation(
  cause: string
): RootCauseExplanation | undefined {
  return ROOT_CAUSE_EXPLANATIONS[cause];
}

/**
 * Get all expansions as array
 */
export function getAllRootCauseExplanations(): RootCauseExplanation[] {
  return Object.values(ROOT_CAUSE_EXPLANATIONS);
}
