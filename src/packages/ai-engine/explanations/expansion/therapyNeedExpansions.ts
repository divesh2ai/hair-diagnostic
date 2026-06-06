/**
 * THERAPY NEED EXPANSIONS
 *
 * Transforms raw therapy enum values into rich clinical explanations.
 * Each need maps to: title, clinical rationale, patient explanation,
 * therapeutic goal, supporting signals, and expected outcomes.
 *
 * Used to populate preview renderers and narrative sections with
 * non-placeholder, clinically coherent content.
 */

export interface TherapyNeedExpansion {
  readonly key: string;
  readonly title: string;
  readonly clinicalRationale: string;
  readonly patientExplanation: string;
  readonly therapeuticGoal: string;
  readonly supportingSignals: string[];
  readonly expectedOutcomes: string[];
}

export const THERAPY_NEED_EXPANSIONS: Record<string, TherapyNeedExpansion> = {
  GUT_RESTORATION: {
    key: "GUT_RESTORATION",
    title: "Gastrointestinal Integrity Restoration",
    clinicalRationale:
      "Compromised intestinal barrier function reduces nutrient bioavailability and increases systemic inflammation. Hair follicles are particularly sensitive to malabsorption states, especially iron, zinc, and B vitamins. Restoring gut mucosal integrity and barrier function is foundational for nutrient repletion.",
    patientExplanation:
      "Your gut health directly impacts nutrient absorption. When the intestinal lining is compromised, even good nutrition doesn't get properly absorbed. Restoring gut function helps your body properly absorb the minerals and vitamins your hair needs to regrow.",
    therapeuticGoal:
      "Restore intestinal epithelial integrity, reduce permeability, support commensal microbiota, and normalize digestive enzyme function",
    supportingSignals: [
      "History of IBS, food sensitivities, or digestive complaints",
      "Elevated zonulin or fecal calprotectin markers",
      "Associated nutrient deficiencies (iron, B12, folate)",
      "Concurrent bloating, gas, or stool irregularities",
    ],
    expectedOutcomes: [
      "Improved nutrient absorption within 4-6 weeks",
      "Reduced GI symptoms (bloating, discomfort)",
      "Stabilized microbiota diversity",
      "Enhanced bioavailability of oral supplementation",
    ],
  },

  THYROID_SUPPORT: {
    key: "THYROID_SUPPORT",
    title: "Thyroid Function Optimization",
    clinicalRationale:
      "Thyroid hormones regulate metabolic rate and hair growth cycle. Both hypothyroidism and thyroid autoimmunity (TPO antibodies) impair anagen duration and increase telogen shedding. TSH > 2.5 mIU/L is associated with hair loss risk even in subclinical ranges. Thyroid support normalizes metabolic environment for hair follicles.",
    patientExplanation:
      "Your thyroid controls your metabolic rate and how quickly your body can grow hair. When thyroid function is low, your hair growth cycle slows down and more hair enters the shedding phase. Supporting thyroid function helps restore the metabolic conditions your hair needs.",
    therapeuticGoal:
      "Normalize TSH to <2.5 mIU/L, reduce thyroid peroxidase antibodies, support thyroid hormone conversion and utilization",
    supportingSignals: [
      "Elevated TSH (subclinical or clinical hypothyroidism)",
      "Elevated TPO or thyroglobulin antibodies",
      "Symptoms: fatigue, cold intolerance, weight gain",
      "Concurrent telogen-predominant alopecia",
    ],
    expectedOutcomes: [
      "TSH normalization within 6-8 weeks of optimization",
      "Reduced cold sensitivity and fatigue",
      "Improved basal metabolic rate",
      "Decreased shedding as metabolic rate recovers",
    ],
  },

  METABOLIC_SUPPORT: {
    key: "METABOLIC_SUPPORT",
    title: "Metabolic Rate and Glucose Homeostasis Optimization",
    clinicalRationale:
      "Metabolic dysfunction (insulin resistance, impaired glucose tolerance) drives androgenic alopecia by increasing 5-alpha reductase activity and DHT production, while reducing insulin-dependent growth factors like IGF-1. PCOS, diabetes, and metabolic syndrome dramatically accelerate hair loss. Restoring insulin sensitivity and metabolic health is critical.",
    patientExplanation:
      "When your metabolism isn't working efficiently, your body produces more DHT (the hormone that shrinks hair follicles). Improving your metabolic health reduces DHT production and restores growth factors your hair needs to thrive.",
    therapeuticGoal:
      "Restore insulin sensitivity, normalize fasting glucose and HbA1c, reduce visceral adiposity, upregulate IGF-1 signaling",
    supportingSignals: [
      "Elevated fasting glucose (>100 mg/dL) or HbA1c (>5.7%)",
      "Elevated insulin resistance markers (HOMA-IR > 2.0)",
      "PCOS diagnosis or hyperandrogenism",
      "Abdominal obesity (increased waist circumference)",
    ],
    expectedOutcomes: [
      "Fasting glucose normalization within 4-6 weeks",
      "Improved insulin sensitivity (decreased HOMA-IR)",
      "Reduced DHT-driven hair loss",
      "Increased IGF-1 levels supporting anagen duration",
    ],
  },

  ANTIOXIDANT_SUPPORT: {
    key: "ANTIOXIDANT_SUPPORT",
    title: "Oxidative Stress Mitigation and Antioxidant Defense",
    clinicalRationale:
      "Environmental insults (smoking, UV exposure, pollution) and metabolic stress generate excessive reactive oxygen species (ROS) that damage hair follicles, impair stem cell function, and trigger premature catagen. Antioxidant depletion (low vitamin E, selenium, CoQ10) accelerates follicle senescence. Antioxidant support protects follicles from oxidative damage.",
    patientExplanation:
      "Smoking, stress, and pollution create harmful molecules (free radicals) that damage your hair follicles. Antioxidants neutralize these molecules and protect your hair roots from damage, allowing them to remain in the growth phase longer.",
    therapeuticGoal:
      "Reduce systemic oxidative stress markers, restore antioxidant enzyme capacity (SOD, catalase, GPX), protect follicle stem cells",
    supportingSignals: [
      "Active smoking or vaping",
      "Occupational or environmental exposure to pollutants",
      "Elevated reactive oxygen species markers",
      "Low antioxidant nutrient levels (vitamin E, selenium, CoQ10)",
    ],
    expectedOutcomes: [
      "Reduced oxidative stress biomarkers within 2-3 weeks",
      "Improved hair follicle resilience",
      "Decreased environmental damage to new growth",
      "Enhanced stem cell longevity",
    ],
  },

  INFLAMMATION_CONTROL: {
    key: "INFLAMMATION_CONTROL",
    title: "Systemic Inflammation Suppression and Immune Tolerance",
    clinicalRationale:
      "Chronic low-grade inflammation (elevated TNF-α, IL-6, CRP) and autoimmune activation (positive AA or alopecia areata-associated antibodies) destabilize hair follicles and accelerate catagen transition. Inflammatory cytokines upregulate substance P in hair follicles, promoting premature cycle progression. Anti-inflammatory therapy is essential for stabilizing follicles.",
    patientExplanation:
      "Chronic inflammation is like an alarm that won't turn off in your scalp. This constant inflammation signals hair follicles to stop growing and shed. Reducing inflammation helps calm this signal and allows your hair to stay in the growth phase.",
    therapeuticGoal:
      "Reduce systemic inflammatory markers (CRP, TNF-α, IL-6), promote Th17/Treg balance, suppress follicle-damaging autoimmune responses",
    supportingSignals: [
      "Elevated CRP or ESR",
      "Elevated TNF-α, IL-6, or IL-17",
      "Concurrent autoimmune or inflammatory conditions",
      "Follicle-specific antibodies (AA serology)",
    ],
    expectedOutcomes: [
      "Reduced inflammatory markers within 2-4 weeks",
      "Decreased scalp inflammation and erythema",
      "Stabilized hair shedding (reduced telogen)",
      "Improved immune tolerance in follicle microenvironment",
    ],
  },

  ANDROGENIC_CORRECTION: {
    key: "ANDROGENIC_CORRECTION",
    title: "Androgen Sensitivity Modulation and DHT Suppression",
    clinicalRationale:
      "Androgenetic alopecia is driven by DHT sensitivity in genetically predisposed follicles. 5-alpha reductase inhibition (finasteride/dutasteride) reduces intrafollicular DHT by 70%, shifting follicles from miniaturization back to terminal morphology. Androgen receptor antagonism (spironolactone) provides additional DHT-independent benefit. Both are necessary in moderate-to-severe cases.",
    patientExplanation:
      "DHT is the hormone that shrinks hair follicles in genetically sensitive people. Blocking DHT production prevents this shrinkage and allows follicles to return to their normal size, producing thicker, stronger hairs.",
    therapeuticGoal:
      "Reduce intrafollicular DHT concentration by 70-90%, reverse follicle miniaturization, restore terminal hair morphology",
    supportingSignals: [
      "High serum testosterone or free testosterone",
      "Elevated DHT levels",
      "Strong family history of androgenetic alopecia",
      "Pattern consistent with androgen-driven loss",
    ],
    expectedOutcomes: [
      "DHT reduction within 1-2 weeks (physiological effect)",
      "Hair cycle stabilization within 3-4 months",
      "Reversal of miniaturization over 6-12 months",
      "Visible thickening and regrowth by 6 months",
    ],
  },

  IRON_REPLETION: {
    key: "IRON_REPLETION",
    title: "Iron Status Normalization",
    clinicalRationale:
      "Iron deficiency (ferritin < 30 ng/mL) impairs follicle growth and increases telogen shedding. Hair follicles require iron for oxygen transport and synthesis of catalase, a critical antioxidant enzyme. Women of reproductive age with heavy menstrual bleeding are particularly at risk. Iron repletion stabilizes the hair cycle.",
    patientExplanation:
      "Iron is essential for transporting oxygen to your hair roots. Without enough iron, hair follicles can't get the oxygen they need and are more likely to shed prematurely. Restoring iron levels helps keep follicles healthy and in the growth phase.",
    therapeuticGoal:
      "Restore serum ferritin to >30 ng/mL, normalize hemoglobin, optimize iron-dependent enzyme function",
    supportingSignals: [
      "Serum ferritin < 30 ng/mL",
      "Low hemoglobin or hematocrit",
      "Heavy menstrual bleeding or GI blood loss",
      "Vegetarian/vegan diet without adequate iron sources",
    ],
    expectedOutcomes: [
      "Serum ferritin normalization within 3-6 months",
      "Reduced telogen shedding within 4-8 weeks",
      "Improved energy and exercise tolerance",
      "Stabilized hair cycle length",
    ],
  },

  IMMUNE_MODULATION: {
    key: "IMMUNE_MODULATION",
    title: "Post-Partum Immune Recovery and Thyroid Antibody Normalization",
    clinicalRationale:
      "Post-partum period involves dramatic immune system rebalancing (Th1 to Th2 shift recovery). Thyroid antibodies peak 3-6 months post-delivery. Concurrent telogen effluvium is expected, but immune modulation (selenium, zinc, omega-3) accelerates hair cycle recovery. Women with underlying autoimmunity are at higher risk of persistent hair loss.",
    patientExplanation:
      "After pregnancy, your immune system goes through major changes. This can temporarily increase hair shedding. Supporting your immune recovery helps normalize your hair growth cycle more quickly.",
    therapeuticGoal:
      "Restore Th1/Th2 balance, normalize thyroid antibody production, support lactation-safe immune rebalancing",
    supportingSignals: [
      "Telogen effluvium onset 3-4 months post-delivery",
      "Elevated thyroid antibodies (TPO, thyroglobulin)",
      "History of autoimmune conditions",
      "Concurrent fatigue or low mood",
    ],
    expectedOutcomes: [
      "Hair cycle normalization within 6-9 months",
      "Reduced thyroid antibody titers",
      "Improved energy and mood recovery",
      "Return to baseline shedding rate",
    ],
  },

  MELANOCYTE_PROTECTION: {
    key: "MELANOCYTE_PROTECTION",
    title: "Melanocyte Preservation and Grey Hair Prevention",
    clinicalRationale:
      "Early greying reflects oxidative stress and melanocyte stem cell senescence. Catalase deficiency and hydrogen peroxide accumulation in follicles trigger melanocyte apoptosis. Antioxidants (SOD mimetics, catalase substrates) and L-DOPA precursors support melanocyte preservation. Prevention is more effective than reversal once depigmentation is established.",
    patientExplanation:
      "Grey hairs develop when melanocytes (color-producing cells) in your hair roots are damaged by oxidative stress. Protecting these cells with antioxidants and nutrients can slow greying and potentially help maintain pigmentation.",
    therapeuticGoal:
      "Prevent melanocyte oxidative damage, preserve hydrogen peroxide metabolism, maintain L-DOPA synthesis capacity",
    supportingSignals: [
      "Early-onset greying (before age 35-40)",
      "Rapid progression of grey hairs",
      "Family history of early greying",
      "High oxidative stress biomarkers",
    ],
    expectedOutcomes: [
      "Slowed grey hair progression",
      "Maintenance of pigmentation in new growth",
      "Potential repigmentation in early-stage grey follicles",
      "Improved hair color vitality",
    ],
  },
};

/**
 * Get expansion for a therapy need, or undefined if not found
 */
export function getTherapyNeedExpansion(
  need: string
): TherapyNeedExpansion | undefined {
  return THERAPY_NEED_EXPANSIONS[need];
}

/**
 * Get all expansions as array
 */
export function getAllTherapyNeedExpansions(): TherapyNeedExpansion[] {
  return Object.values(THERAPY_NEED_EXPANSIONS);
}
