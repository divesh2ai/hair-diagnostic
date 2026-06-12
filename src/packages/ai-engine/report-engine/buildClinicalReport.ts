/**
 * Clinical Report V4 builder.
 *
 * Spec: HAIROS_REPORT_V4_FINAL_REDESIGN.
 *
 * Hard rules:
 *  - No Executive Summary, no Monitoring Plan, no narratives, no severity /
 *    confidence numbers in output.
 *  - Six sections only; every statement traceable to questionnaire signals.
 *  - Treatment Strategy pulls ingredients + mechanism from the kit knowledge
 *    base (registries/kits/info.ts). No essays, no duplicated ingredients.
 *  - Recovery Roadmap is a SINGLE journey (Month 1/3/6/9/12), never per-kit.
 *  - Diet & Lifestyle recommendations must each map to ≥ 1 detected condition.
 *
 * Deterministic; no AI; all copy grounded in the patient's answers or
 * derived from the clinical engine output.
 */

import type { PatientAnswers, RootCause } from "../../types";
import type { ClinicalProfile } from "../clinical-engine/types";
import type { TherapyNeeds } from "../therapy-engine/types";
import type { KitRecommendation } from "../kit-scorer/types";
import { getKitInfo } from "../../registries/kits/info";
import { recommendTopicals } from "../../registries/topicals/recommendTopicals";
import { buildFinalClinicalAssessment } from "./buildFinalClinicalAssessment";
import { buildClinicalInsightStory } from "./buildClinicalInsightStory";
import type {
  CategoryRationale,
  ClinicalInterpretation,
  ClinicalReport,
  DietLifestyleRecommendation,
  FinalClinicalAssessment,
  GeneralLifestyleGuide,
  ImpactLevel,
  PatientSummary,
  PlanReasoning,
  QuestionnaireSelections,
  RootCauseAnalysis,
  RootCauseCategory,
  RootCauseCondition,
  TopicalRecommendation,
  TreatmentPhase,
  UniversalRecoveryMilestone,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Display maps
// ─────────────────────────────────────────────────────────────────────────────

const DIAGNOSIS_DISPLAY: Record<string, string> = {
  AGA_MALE_123: "Male Pattern Hair Loss (Grade 1–3)",
  AGA_MALE_45: "Male Pattern Hair Loss (Grade 4–5)",
  AGA_FEMALE_123: "Female Pattern Hair Loss (Grade 1–3)",
  AGA_FEMALE_45: "Female Pattern Hair Loss (Grade 4–5)",
  TE_STRESS: "Telogen Effluvium (stress-driven)",
  TE_NUTRITION: "Telogen Effluvium (nutritional)",
  TE_POSTPREG: "Post-partum Telogen Effluvium",
  TE_DELIVERY: "Post-delivery Telogen Effluvium",
  TE_ILLNESS: "Post-illness Telogen Effluvium",
  THYROID_HYPO: "Hypothyroid Hair Loss",
  THYROID_HYPER: "Hyperthyroid Hair Loss",
  PCOS_ONLY: "PCOS-driven Hair Loss",
  PCOS_OBESITY: "PCOS with Metabolic Syndrome",
  ALOPECIA_AREATA: "Alopecia Areata",
  PERI_MENOPAUSE: "Peri-Menopausal Hair Loss",
  MENOPAUSE: "Menopausal Hair Loss",
  POST_MENOPAUSE: "Post-Menopausal Hair Loss",
  ENDOMETRIOSIS: "Endometriotic Hair Loss",
  PREGNANCY: "Pregnancy Hair Support",
  IRON_DEFICIENCY: "Iron-Deficiency Hair Loss",
  SCALP_INFLAM: "Inflammatory Scalp Dysfunction",
  HAIR_BREAKAGE: "Hair Shaft Breakage",
  NIGHT_SHIFT: "Circadian-Disruption Hair Loss",
  FREQUENT_FLYING: "Travel-Stress Hair Loss",
  OXIDATIVE: "Oxidative-Stress Hair Loss",
  WEIGHT_LOSS: "Rapid Weight-Loss Telogen Effluvium",
  TTM: "Trichotillomania",
  CHRONIC_MEDICAL: "Chronic Medical Hair Loss",
  DIABETES: "Diabetic Hair Loss",
  GUT_ISSUES: "Gut–Hair Axis Hair Loss",
  MOUTH_ULCERS: "Immune–Gut Linked Hair Loss",
  MULTI: "Multi-factorial Hair Loss",
  EARLY_GREY: "Early Greying",
  REGROW_ONLY: "Regrowth Support",
};

const ROOT_CAUSE_DISPLAY: Record<RootCause, string> = {
  STRESS: "Chronic stress",
  DHT: "Androgen (DHT) drive",
  GENETICS: "Genetic predisposition",
  IRON_DEFICIENCY: "Iron deficiency",
  HYPOTHYROID: "Hypothyroid axis",
  HYPERTHYROID: "Hyperthyroid axis",
  PCOS: "PCOS hormonal imbalance",
  METABOLIC: "Metabolic dysfunction",
  POOR_NUTRITION: "Nutritional insufficiency",
  POST_PARTUM: "Post-partum hormonal shift",
  GUT_MALABSORPTION: "Gut malabsorption",
  OXIDATIVE_STRESS: "Oxidative stress",
  MEDICATION: "Medication-induced",
  ILLNESS: "Post-illness recovery",
  RAPID_WEIGHT_LOSS: "Rapid weight loss",
  AUTOIMMUNE: "Autoimmune activity",
  CIRCADIAN_DISRUPTION: "Circadian disruption",
  TRICHOTILLOMANIA: "Compulsive pulling",
  HORMONAL_SHIFT: "Hormonal transition",
};

/**
 * Classification of every RootCause into one of the three V4 buckets.
 *  - Primary   → direct biological drivers of hair loss
 *  - Secondary → contributors that worsen follicular recovery
 *  - Amplifier → factors accelerating progression / reducing treatment response
 */
const ROOT_CAUSE_CATEGORY: Record<RootCause, RootCauseCategory> = {
  DHT:               "Primary",
  GENETICS:          "Primary",
  PCOS:              "Primary",
  HYPOTHYROID:       "Primary",
  HYPERTHYROID:      "Primary",
  AUTOIMMUNE:        "Primary",
  POST_PARTUM:       "Primary",
  HORMONAL_SHIFT:    "Primary",
  TRICHOTILLOMANIA:  "Primary",

  IRON_DEFICIENCY:   "Secondary",
  POOR_NUTRITION:    "Secondary",
  GUT_MALABSORPTION: "Secondary",
  METABOLIC:         "Secondary",
  ILLNESS:           "Secondary",
  MEDICATION:        "Secondary",
  RAPID_WEIGHT_LOSS: "Secondary",

  STRESS:               "Amplifier",
  OXIDATIVE_STRESS:     "Amplifier",
  CIRCADIAN_DISRUPTION: "Amplifier",
};

/** One-line clinical relevance per root cause. */
const ROOT_CAUSE_RELEVANCE: Record<RootCause, string> = {
  STRESS:               "HPA-axis activation accelerates anagen-to-telogen transition.",
  DHT:                  "Androgen pressure drives follicle miniaturisation at susceptible scalp zones.",
  GENETICS:             "Inherited follicle sensitivity sets the floor for therapeutic response.",
  IRON_DEFICIENCY:      "Low ferritin blocks matrix proliferation — no other therapy gets traction until corrected.",
  HYPOTHYROID:          "Reduced T3 slows matrix kinetics — euthyroid restoration precedes pattern correction.",
  HYPERTHYROID:         "Accelerated telogen entry — thyroid normalisation required first.",
  PCOS:                 "Insulin–androgen cross-talk amplifies miniaturisation risk.",
  METABOLIC:            "Disrupted insulin / AMPK signalling reduces follicular energy supply.",
  POOR_NUTRITION:       "Substrate insufficiency caps the upper bound of regrowth response.",
  POST_PARTUM:          "Synchronised telogen exit driven by post-partum estrogen withdrawal.",
  GUT_MALABSORPTION:    "Gut-axis disruption upstream of substrate delivery — limits downstream therapy.",
  OXIDATIVE_STRESS:     "Sustained free-radical load damages follicle stem cells.",
  MEDICATION:           "Drug-class effects on follicle cycling — assess timing and substitution.",
  ILLNESS:              "Post-illness systemic inflammation suppressed anagen maintenance.",
  RAPID_WEIGHT_LOSS:    "Acute substrate deficit triggered diffuse telogen release.",
  AUTOIMMUNE:           "Immune privilege loss at the follicle bulge — patch-pattern targeting.",
  CIRCADIAN_DISRUPTION: "Clock-gene desynchronisation disrupts cortisol / follicle cycling.",
  TRICHOTILLOMANIA:     "Neurologically driven mechanical follicle damage.",
  HORMONAL_SHIFT:       "Endocrine transition unmasking follicle vulnerability.",
};

// Signal → clinical interpretation. Rationales are SOURCED VERBATIM from the
// clinical team's condition.md (Q4–Q13 reference table). Match is case-insensitive
// substring/regex. Builder de-dupes by interpretation text and caps at 6.
//
// NOTE: Order matters — more specific patterns must come BEFORE less specific
// ones (e.g. "Post-partum (still feeding)" before "Post-partum").
// Verbatim from condition (3).md — Q4-Q13 reference table. Order matters:
// more specific patterns (e.g. "Post-partum (still feeding)") must come
// BEFORE less specific ones (e.g. "Post-partum"). Builder de-dupes by
// interpretation and caps at 6.
const SIGNAL_INTERPRETATION: Array<{ match: RegExp; group: keyof QuestionnaireSelections; condition: string; interpretation: string }> = [
  // ── Q4 — Suspected cause ─────────────────────────────────────────────────
  { match: /Stress|Anxiety|Depression/i, group: "cause", condition: "Stress-induced TE", interpretation: "Stress releases cortisol which causes hair loss through substance \"P\", neuroendocrine mediators, raised metabolic rate, desire for low nutrient comfort foods and poor nutrient absorption due to increased gut motility contribute to nutritional deficiencies." },
  { match: /Post[-\s]?partum.*(still\s)?feed|Post[-\s]?partum.*lactat|breastfeed/i, group: "cause", condition: "Hormonal TE", interpretation: "Feeding increases nutrient demand by priority depriving essential micro nutrients for the hair cycles." },
  { match: /Post[-\s]?partum/i, group: "cause", condition: "Hormonal TE", interpretation: "During pregnancy the abundant growth factors and hormonal support override follicular telogen and favor the continuation of anagen. After delivery of the baby there is a sudden withdrawal of the hormones and growth factors which cause anagen release leading to acute telogen shedding. Nutrients provide support for the reinitiation of anagen." },
  { match: /Nutritional def|Poor nutrition|Nutrition issue/i, group: "cause", condition: "Nutritional TE", interpretation: "Nutritional deficiencies directly trigger arrest of anagen and extension of telogen." },
  { match: /Family history|Genetics|Genetic/i, group: "cause", condition: "AGA", interpretation: "Hair loss is confirmed to be polygenic and multifactorial, not caused by a single gene but a set of genes which not only transmit genetic androgen sensitivity but are also associated with impaired metabolism of amino acids, lipids and insulin resistance which dysregulate hair growth." },
  { match: /Medication/i, group: "cause", condition: "Systemic hair loss", interpretation: "Prolonged medication, illness & surgery divert the nutrients for healing and recovery depriving the hair follicles of resources for continuation of anagen. Inflammation and active immune response also compound the nutrient diversion, leaving inadequate energy resources for the continuation of hair growth. Certain drugs have hair loss as a side effect." },
  { match: /Recent illness|Surgery|Illness/i, group: "cause", condition: "Post-illness shedding", interpretation: "Prolonged medication, illness & surgery divert the nutrients for healing and recovery depriving the hair follicles of resources for continuation of anagen. Inflammation and active immune response also compound the nutrient diversion, leaving inadequate energy resources for the continuation of hair growth. Certain drugs have hair loss as a side effect." },
  { match: /Hard water/i, group: "cause", condition: "Hair-shaft damage", interpretation: "Hard water causes sedimentation of salts on the hair shaft and scalp, blocking the pores. Minerals in hard water generate oxidative stress on exposure to sunlight and UV rays. Dual mechanism of physical blocking plus oxidative damage." },
  { match: /GLP[-\s]?1|GLP1|Ozempic|Semaglutide|Wegovy|Mounjaro|Tirzepatide/i, group: "cause", condition: "Post GLP-1 receptor agonist", interpretation: "GLP-1 receptor agonists delay gastric emptying and intestinal motility, shift gut microbiota, impair digestion, lead to digestive problems, malabsorption, inflammation and disturb the gut-brain-skin axis. Thus affecting hair growth in many ways." },
  { match: /Pulling|Hair pull|TTM|Trichotillomania|OCD/i, group: "cause", condition: "Trichotillomania", interpretation: "Trichotillomania is an obsessive compulsive disorder (OCD) of hair pulling and breaking arising out of anxiety which is known to benefit from well planned nutritional supplements." },
  { match: /Crash diet|sudden weight loss/i, group: "cause", condition: "Crash Diet", interpretation: "Calorie restriction and sudden acute nutrient deficiency triggers telogen effluvium." },

  // ── Q5 — Scalp ───────────────────────────────────────────────────────────
  { match: /Dandruff.*itch|itching.*dandruff|Dandruff \+ itching|White flakes/i, group: "scalp", condition: "Seborrheic + inflammation", interpretation: "Itching indicates activity of mast cells and inflammatory cells which arrest hair growth. Inflammatory mediators promote scalp epidermal hyperplasia and cause flaking. Loss of scalp hygiene and accumulated build up of dead exfoliated cells invites microbes generating ROS and disrupting the hair cycles." },
  { match: /Dandruff/i, group: "scalp", condition: "Seborrheic scalp", interpretation: "Dandruff and sebum provide a medium for the growth of microbes which alter scalp pH and generate ROS thus, disrupting the hair cycles." },
  { match: /Oily/i, group: "scalp", condition: "DHT + seborrhoea", interpretation: "Androgens increase sebum secretion and are proinflammatory. Oily scalp invites microbes, promotes inflammation and generation of ROS which disrupts the hair cycles." },
  { match: /Dry scalp/i, group: "scalp", condition: "Scalp imbalance", interpretation: "Chronic perifollicular inflammation can shrink or destroy the sebum glands at the follicular infundibulum along with effects of inflammation on hair growth." },
  { match: /Flaking/i, group: "scalp", condition: "Inflammatory scalp", interpretation: "Inflammatory mediators promote scalp epidermal hyperplasia and cause flaking. Loss of scalp hygiene and accumulated build up of dead exfoliated cells invites microbes generating ROS and disrupting the hair cycles." },
  { match: /Boils|Folliculitis|pimples|pustule/i, group: "scalp", condition: "Folliculitis", interpretation: "Active inflammation and infection affects follicles around the area, while multiple long standing boils affect the entire scalp. Boils indicate pro inflammatory factors, inflammation and weak immunity." },
  { match: /Redness|Burning|irritation/i, group: "scalp", condition: "Scalp inflammation", interpretation: "Redness and burning result from inflammatory exudate changing the tissue pH making and converting conditions unfavorable for hair growth." },
  { match: /Psoriasis/i, group: "scalp", condition: "Scalp psoriasis", interpretation: "Chronic scaling dermatosis with elevated systemic inflammatory load that disrupts the follicular environment." },

  // ── Q6 — Immunity ────────────────────────────────────────────────────────
  { match: /cough|cold|fever|Frequent infection/i, group: "immunity", condition: "Immune dysregulation", interpretation: "Indicates poor immunity can potentially extend to the follicles and compromises hair growth." },
  { match: /Allergies|Allergy/i, group: "immunity", condition: "Immune hypersensitivity", interpretation: "Indicates altered or overactive immunity and hypersensitivity which can potentially extend to the follicles and compromises hair growth." },
  { match: /Asthma/i, group: "immunity", condition: "Auto-immune inflammation", interpretation: "Autoimmune or altered immune response from one system can potentially extend to the thyroid, gut skin and hair follicles to compromise hair growth." },
  { match: /Skin rash|Eczema/i, group: "immunity", condition: "Auto-immune", interpretation: "Autoimmune or altered immune response from one system can potentially extend to the thyroid, gut skin and hair follicles to compromise hair growth. Altered immunity impairs the ability to counter inflammation." },
  { match: /Alopecia areata|Areata/i, group: "immunity", condition: "Auto-immune hair loss", interpretation: "Primary loss of immune privilege of the hair follicle generating an autoimmune response." },
  { match: /Scarring alopecia/i, group: "immunity", condition: "Permanent follicle damage", interpretation: "There are progressively variable grades of inflammation spreading from the primary affected area into the surrounding scalp. Follicles subject to partial or intermediate damage in the surrounding scalp can recover with nutrient support." },
  { match: /Tongue.*ulcer|mouth ulcer|Ulcer/i, group: "immunity", condition: "Immune inflammation", interpretation: "Indicates inflammation and poor immunity which can potentially extend to the follicles and compromises hair growth. Can also be an indication of stress." },

  // ── Q7 — Lifestyle ───────────────────────────────────────────────────────
  { match: /Smoking|Vaping/i, group: "lifestyle", condition: "Oxidative stress", interpretation: "Increased hepatic and oxidative load through ROS in addition to the effects of vasoconstriction reducing oxygenation of the tissues." },
  { match: /Alcohol/i, group: "lifestyle", condition: "Oxidative stress", interpretation: "Hepatic and oxidative load along with reduced absorption of nutrients from the gut." },
  { match: /Bodybuilding|Heavy gym|gym/i, group: "lifestyle", condition: "Hormonal / DHT", interpretation: "Exercise generates ROS and metabolic byproducts. Bodybuilding practices causes a rise in exogenous androgens and testosterone levels. High protein intake makes the blood acidic leading to calciuria. Anabolic supplements compound the negative effects on hormonal imbalance affecting skin and hair." },
  { match: /Obesity|Struggle to lose weight|overweight/i, group: "lifestyle", condition: "Metabolic dysfunction", interpretation: "Dyslipidemia and altered lipid metabolism are inherited along with the polygenic AGA genes. Adipose tissue signals coordinate the hair cycles." },
  { match: /Sedentary/i, group: "lifestyle", condition: "Metabolic syndrome", interpretation: "Inactivity slows down metabolic rate and cellular turnover in the tissues." },
  { match: /Diet issue|Poor diet|Irregular meal|erratic|outside eating/i, group: "lifestyle", condition: "Metabolic hair loss", interpretation: "Dietary imbalance affects metabolic efficiency, tissues repair and growth." },
  { match: /Night shift|Poor sleep|Sleep/i, group: "lifestyle", condition: "Circadian disruption", interpretation: "Loss of circadian rhythm affects endocrine cycles and cellular metabolism and growth." },
  { match: /Sudden weight loss|Rapid weight loss/i, group: "lifestyle", condition: "Rapid telogen shedding", interpretation: "Calorie restriction and lack of nutrients arrests hair growth." },
  { match: /Frequent flying|Flying/i, group: "lifestyle", condition: "Circadian + immune stress", interpretation: "Work stress, erratic eating, sleep disturbances, exposure to cosmic radiation, low oxygen pressure in the cabin and loss of circadian rhythm disrupt the hair cycles." },
  { match: /Heat styling|Heat/i, group: "treatment", condition: "Hair-shaft damage", interpretation: "Heat styling and straightening damage cuticle and hair shaft." },
  { match: /Chemical|Bleach|Colour|Color|Perm|Straighten/i, group: "treatment", condition: "Hair-shaft compromise", interpretation: "Chemical damage to the cuticle and the hair shaft with reaction and irritation of the scalp." },

  // ── Q8 — Medical ─────────────────────────────────────────────────────────
  { match: /Chronic condition|Chronic medical|Chronic illness/i, group: "immunity", condition: "Metabolic stress", interpretation: "Continued accumulation and imbalance of ROS and toxic metabolic byproducts weaken the cells to arrest growth." },
  { match: /Autoimmune/i, group: "immunity", condition: "Auto-immune inflammation", interpretation: "Autoimmune or altered immune response from one system can potentially extend to the thyroid, gut skin and hair follicles to compromise hair growth. Altered immunity impairs the ability to counter inflammation." },
  { match: /Pre[-\s]?diabet/i, group: "hormonal", condition: "Pre-diabetic", interpretation: "Causes metabolic imbalance, insulin resistance sluggish immune response and slow down of the metabolic rate." },
  { match: /Diabet/i, group: "hormonal", condition: "Diabetic", interpretation: "Causes metabolic imbalance, insulin resistance sluggish immune response and slow down of the metabolic rate." },

  // ── Q9 — Hormonal / Thyroid ──────────────────────────────────────────────
  { match: /Hypothyroid|Hyperthyroid|Thyroid/i, group: "thyroid", condition: "Thyroid-related", interpretation: "Thyroid hormones directly regulate hair cycles. Both hypo and hyper thyroid states affect hair growth. Hyper thyroid condition consumes high volume of nutrients creating relative deficiencies while retarded metabolism in hypo thyroid status requires nutrient to initiate and propagate active basal metabolism." },
  { match: /PCOS.*Obesity|PCOS.*weight|PCOD.*Obesity/i, group: "hormonal", condition: "PMOS + weight", interpretation: "PCOS/PMOS is a complex condition with an interplay of insulin resistance, dyslipidemia, hormonal imbalance, impaired metabolism, inflammation and oxidative stress governed by genetic traits inherited along with the polygenic cohort of AGA genes." },
  { match: /PCOS|PCOD/i, group: "hormonal", condition: "PMOS-related", interpretation: "PCOS/PMOS is a complex condition with an interplay of insulin resistance, dyslipidemia, hormonal imbalance, impaired metabolism, inflammation and oxidative stress governed by genetic traits inherited along with the polygenic cohort of AGA genes." },
  { match: /Endometr/i, group: "hormonal", condition: "Hormonal inflammation", interpretation: "Endometriosis is primarily driven by: Hormonal, genetic, and inflammatory mechanisms with immune dysregulation, oxidative stress and fibrotic changes." },
  { match: /Pregnan/i, group: "hormonal", condition: "Pregnancy support", interpretation: "Pregnancy increases the metabolic and nutritional requirements which can deprive the hair of adequate nutrients." },
  { match: /Post[-\s]?delivery|Feeding|Lactat|Breastfeed/i, group: "hormonal", condition: "Post-natal TE", interpretation: "Feeding increases nutrient demand by priority, therefore depriving the hair cycles." },
  { match: /Peri[-\s]?menopaus/i, group: "hormonal", condition: "Peri-menopausal TE", interpretation: "Relative androgen excess causes imbalance in the hormonal regulation of the hair cycles. There can also be associated poor absorption and assimilation of nutrients from the gut." },
  { match: /Post[-\s]?menopaus/i, group: "hormonal", condition: "Post Menopausal transition", interpretation: "Relative androgen excess causes imbalance in the hormonal regulation of the hair cycles. There can also be associated poor absorption and assimilation of nutrients from the gut." },
  { match: /Menopaus/i, group: "hormonal", condition: "Menopausal transition", interpretation: "Relative androgen excess causes imbalance in the hormonal regulation of the hair cycles. There can also be associated poor absorption and assimilation of nutrients from the gut." },
  { match: /HRT|Hormone replacement/i, group: "hormonal", condition: "Hormonal therapy support", interpretation: "Hormones can stimulate cellular activity, however, nutritional support is essential for effective cellular function in response to the hormones." },

  // ── Q10 — Gut ────────────────────────────────────────────────────────────
  { match: /GERD|Acid reflux|Acidity|Heartburn/i, group: "gut", condition: "Gut-hair axis disruption", interpretation: "GERD which is Gastro esophageal reflux disease or acid peptic disease is associated with acidity, digestive issues, gastritis and inflammation." },
  { match: /IBS|Leaky gut|Crohn/i, group: "gut", condition: "Gut dysbiosis", interpretation: "Gut microbial toxins and inflammatory mediators leak across and reach into the circulation." },
  { match: /Constipation/i, group: "gut", condition: "Gut dysbiosis", interpretation: "Associated with gut dysbiosis, causes toxin reabsorption from retained intestinal waste, rising ROS levels which also affect gut microbes, influencing hair growth in many ways." },
  { match: /Bloating|Gas/i, group: "gut", condition: "Gut dysfunction", interpretation: "Improper digestion, assimilation and propulsion of food causing nutritional deficiencies." },

  // ── Q11 — Deficiencies ──────────────────────────────────────────────────
  { match: /Iron def|Anaem|Ferritin/i, group: "deficiency", condition: "Iron deficiency hair loss", interpretation: "In addition to oxygenation, iron is essential for DNA repair, conversion of thyroid hormone T4 to T3. Low iron directly affects hair cycles." },
  { match: /Vitamin D/i, group: "deficiency", condition: "Nutritional", interpretation: "Vitamin D acts on dermal papilla regulates inflammation and builds immunity." },
  { match: /B12|Vitamin B12/i, group: "deficiency", condition: "Nutritional", interpretation: "Essential for all cellular metabolic functions for utilization of proteins, carbohydrates and fats." },

  // ── Q12 — Diet ───────────────────────────────────────────────────────────
  { match: /Vegan|Vegetarian|Jain/i, group: "diet", condition: "Veg only", interpretation: "Known to be associated with deficiencies of iron, zinc, amino acids, omega 3 and vitamin D." },
  { match: /Non[-\s]?vegetarian/i, group: "diet", condition: "Standard", interpretation: "Increases blood acidity, urea nitrogenous load and creatinine which are unfavorable for hair growth." },
  { match: /High protein/i, group: "diet", condition: "DHT boost risk", interpretation: "Rise in amino acids makes the blood acidic and leads to calcinuria." },
  { match: /Poor diet|Irregular frequency|Irregular meal/i, group: "diet", condition: "Nutritional gap", interpretation: "Results in multiple nutrition deficiencies." },

  // ── Q13 — Treatments (also matched in Q7 above for safety) ──────────────
  { match: /chemical.*treat|colour.*treat|color.*treat/i, group: "treatment", condition: "Hair-shaft compromise", interpretation: "Chemical damage to the cuticle and the hair shaft with reaction and irritation of the scalp." },
  { match: /Heat treat|Heat styling/i, group: "treatment", condition: "Hair-shaft damage", interpretation: "Heat styling and straightening damage cuticle and hair shaft." },
  { match: /Early Grey|premature grey|grey hair/i, group: "treatment", condition: "Early Greying", interpretation: "Early greying is caused by emotional stress, acute illness, nutrient deficiencies, rising oxidative stress and premature exhaustion of melanocytes. Exposure to UV rays and pollution are external factors that cause greying." },

  // ── Hair pattern (kept from prior — pattern topology insight) ───────────
  { match: /Thinning at crown|Widening parting|Receding hairline|widening|crown|parting/i, group: "hairType", condition: "Pattern miniaturisation", interpretation: "Pattern topology consistent with androgen-driven miniaturisation." },
  { match: /Diffuse|all over/i, group: "hairType", condition: "Diffuse telogen exit", interpretation: "Cycle-wide telogen exit — not a localised pattern process." },
  { match: /Patchy|circular|patches/i, group: "hairType", condition: "Localised follicle attack", interpretation: "Localised follicle attack pattern — autoimmune until proven otherwise." },
  { match: /Broken|short|breakage/i, group: "hairType", condition: "Mid-shaft breakage", interpretation: "Mid-shaft damage — root architecture intact; shaft-repair layer required." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function collectAllSignals(ans: PatientAnswers): string[] {
  return uniq([
    ...(ans.cause ?? []),
    ...(ans.gut ?? []),
    ...(ans.hormonal ?? []),
    ...(ans.deficiency ?? []),
    ...(ans.scalp ?? []),
    ...(ans.lifestyle ?? []),
    ...(ans.immunity ?? []),
    ...(ans.thyroid ?? []),
    ...(ans.hairtype ?? []),
    ...(ans.diet ?? []),
    ...(ans.treatment ?? []),
  ]);
}

function impactFor(signalCount: number): ImpactLevel {
  if (signalCount >= 3) return "High";
  if (signalCount === 2) return "Moderate";
  return "Low";
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Patient Summary
// ─────────────────────────────────────────────────────────────────────────────

function buildPatientSummary(
  patient: { name: string; age: number; gender: string },
  ans: PatientAnswers
): PatientSummary {
  const selections: QuestionnaireSelections = {
    duration: ans.duration || undefined,
    count: ans.count || undefined,
    grade: ans.grade || undefined,
    hairType: ans.hairtype?.length ? ans.hairtype : undefined,
    scalp: ans.scalp?.length ? ans.scalp : undefined,
    cause: ans.cause?.length ? ans.cause : undefined,
    lifestyle: ans.lifestyle?.length ? ans.lifestyle : undefined,
    hormonal: ans.hormonal?.length ? ans.hormonal : undefined,
    thyroid: ans.thyroid?.length
      ? Array.isArray(ans.thyroid) ? ans.thyroid : [String(ans.thyroid)]
      : undefined,
    immunity: ans.immunity?.length ? ans.immunity : undefined,
    deficiency: ans.deficiency?.length ? ans.deficiency : undefined,
    gut: ans.gut?.length ? ans.gut : undefined,
    diet: ans.diet?.length ? ans.diet : undefined,
    treatment: ans.treatment?.length ? ans.treatment : undefined,
    goal: Array.isArray(ans.goal) ? ans.goal : ans.goal ? [ans.goal] : undefined,
  };

  const allSignals = collectAllSignals(ans);
  const interpretationRaw: ClinicalInterpretation[] = [];
  const seen = new Set<string>();
  for (const sig of allSignals) {
    const rule = SIGNAL_INTERPRETATION.find((r) => r.match.test(sig));
    if (rule && !seen.has(rule.interpretation)) {
      interpretationRaw.push({
        signal: sig,
        condition: rule.condition,
        interpretation: rule.interpretation,
      });
      seen.add(rule.interpretation);
    }
  }
  // Spec caps clinical interpretation at 4-6 observations.
  const interpretation = interpretationRaw.slice(0, 6);

  // Bucket-level medical / lifestyle factors for the patient card.
  const medicalFactors = uniq([
    ...(ans.hormonal ?? []),
    ...(Array.isArray(ans.thyroid) ? ans.thyroid : ans.thyroid ? [String(ans.thyroid)] : []),
    ...(ans.deficiency ?? []),
    ...(ans.gut ?? []),
    ...(ans.immunity ?? []),
  ]).filter((s) => !/none|no /i.test(s));

  return {
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    goal: selections.goal ?? [],
    hairLossDuration: ans.duration || undefined,
    hairLossPattern: uniq(ans.hairtype ?? []),
    scalpConcerns: uniq(ans.scalp ?? []).filter((s) => !/none|no /i.test(s)),
    lifestyleFactors: uniq(ans.lifestyle ?? []).filter((s) => !/none|no /i.test(s)),
    medicalFactors,
    previousTreatments: uniq(ans.treatment ?? []).filter((s) => !/none|no /i.test(s)),
    questionnaireSelections: selections,
    clinicalInterpretation: interpretation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Root Cause Analysis (categorised)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the patient signals that support a given root cause. */
function signalsForCause(rc: RootCause, ans: PatientAnswers): string[] {
  const out: string[] = [];
  const all = collectAllSignals(ans);
  const push = (re: RegExp) => {
    for (const s of all) if (re.test(s)) out.push(s);
  };

  switch (rc) {
    case "STRESS":               push(/Stress|Anxiety|Depression|Poor sleep|Chronic stress/i); break;
    case "DHT":                  push(/Thinning at crown|Widening parting|Receding hairline|Family history|Genetics|Bodybuilding/i); break;
    case "GENETICS":             push(/Family history|Genetics/i); break;
    case "IRON_DEFICIENCY":      push(/Iron def|Anaem/i); break;
    case "HYPOTHYROID":          push(/Hypothyroid/i); break;
    case "HYPERTHYROID":         push(/Hyperthyroid/i); break;
    case "PCOS":                 push(/PCOS|Irregular periods/i); break;
    case "METABOLIC":            push(/Obesity|Sedentary|Diabetes|Weight gain|Pre diabetes/i); break;
    case "POOR_NUTRITION":       push(/Nutrition|Crash diet|Irregular meals|Vitamin/i); break;
    case "POST_PARTUM":          push(/Postpartum/i); break;
    case "GUT_MALABSORPTION":    push(/GERD|IBS|Bloating|Constipation|Acid|Crohn/i); break;
    case "OXIDATIVE_STRESS":     push(/Smoking|Vaping|Alcohol|Pollution/i); break;
    case "MEDICATION":           push(/Medications|Chronic medical/i); break;
    case "ILLNESS":              push(/Recent illness|Surgery/i); break;
    case "RAPID_WEIGHT_LOSS":    push(/Crash diet|Sudden weight|GLP/i); break;
    case "AUTOIMMUNE":           push(/Alopecia areata|Areata|Autoimmune|Scarring alopecia|Skin rashes/i); break;
    case "CIRCADIAN_DISRUPTION": push(/Night shift|Frequent flying|Poor sleep/i); break;
    case "TRICHOTILLOMANIA":     push(/Pulling|TTM/i); break;
    case "HORMONAL_SHIFT":       push(/Peri|Menopause|Postmeno|HRT|Endometr/i); break;
  }
  return uniq(out);
}

function buildRootCauseAnalysis(
  clinical: ClinicalProfile,
  ans: PatientAnswers
): RootCauseAnalysis {
  const buckets: RootCauseAnalysis = { primary: [], secondary: [], amplifiers: [] };
  for (const rc of clinical.rootCauses ?? []) {
    const supporting = signalsForCause(rc, ans);
    // V4 hard rule: condition must be signal-gated. Skip if no evidence.
    if (supporting.length === 0) continue;

    const category = ROOT_CAUSE_CATEGORY[rc] ?? "Secondary";
    const row: RootCauseCondition = {
      condition: ROOT_CAUSE_DISPLAY[rc] ?? rc,
      category,
      impact: impactFor(supporting.length),
      supportingSignals: supporting,
      clinicalRelevance: ROOT_CAUSE_RELEVANCE[rc] ?? "",
    };
    if (category === "Primary") buckets.primary.push(row);
    else if (category === "Secondary") buckets.secondary.push(row);
    else buckets.amplifiers.push(row);
  }

  const sortByImpact = (a: RootCauseCondition, b: RootCauseCondition) =>
    a.supportingSignals.length === b.supportingSignals.length
      ? 0
      : b.supportingSignals.length - a.supportingSignals.length;
  buckets.primary.sort(sortByImpact);
  buckets.secondary.sort(sortByImpact);
  buckets.amplifiers.sort(sortByImpact);

  return buckets;
}

// ─────────────────────────────────────────────────────────────────────────────
// §3-4 — Treatment Strategy (kit-name driven, KB-sourced ingredients/mechanism)
// ─────────────────────────────────────────────────────────────────────────────

/** Builds a per-patient evidence chain for why this kit was selected. */
function whyKitSelected(
  kitId: string,
  ans: PatientAnswers,
  clinical: ClinicalProfile
): string {
  const reasons: string[] = [];

  if (/GI GOLD/i.test(kitId) && (ans.gut ?? []).some((g) => /IBS|GERD|Acid|Crohn/i.test(g))) {
    reasons.push("strong gut-axis signal (IBS / GERD / Crohn's / acid reflux)");
  }
  if (/IRON UP GOLD/i.test(kitId) && (ans.deficiency ?? []).some((d) => /Iron|Anaem/i.test(d))) {
    reasons.push("iron deficiency reported — repletion is non-negotiable");
  }
  if (/PERI MENOPAUSE/i.test(kitId) && ans.hormonal?.some((h) => /Peri/i.test(h))) {
    reasons.push("perimenopausal transition selected");
  }
  if (/META B HYPOTHYROID/i.test(kitId) && ans.thyroid?.includes("Hypothyroidism")) {
    reasons.push("hypothyroid axis confirmed");
  }
  if (/META B PCOS/i.test(kitId) && ans.hormonal?.includes("PCOS")) {
    reasons.push("PCOS with metabolic involvement");
  }
  if (/^F-PCOS/i.test(kitId) && ans.hormonal?.includes("PCOS")) {
    reasons.push("PCOS hormonal pattern reported");
  }
  if (/FH WELL 3/i.test(kitId) && ans.hormonal?.some((h) => /Endometr/i.test(h))) {
    reasons.push("endometriosis reported");
  }
  if (/LACTIHEALTH/i.test(kitId)) {
    reasons.push("lactation period — elevated nutritional demand");
  }
  if (/^MPHL/i.test(kitId) && clinical.rootCauses.includes("DHT")) {
    reasons.push("androgen-driven miniaturisation with male topology");
  }
  if (/^FPHL/i.test(kitId)) {
    reasons.push("female pattern topology with androgen pressure");
  }
  if (/ALOPECIA AREATA/i.test(kitId)) {
    reasons.push("autoimmune follicular targeting reported");
  }
  if (/PHENOTYPE INFLAM/i.test(kitId) && (ans.scalp?.length ?? 0) > 0) {
    reasons.push(`scalp inflammation signals (${ans.scalp!.slice(0, 2).join(", ")})`);
  }
  if (/OXIDATIVE STRESS/i.test(kitId) && ans.lifestyle?.some((l) => /Smoking|Alcohol|Vaping/i.test(l))) {
    reasons.push("oxidative lifestyle exposures reported");
  }
  if (/PRO IMMUNE/i.test(kitId)) {
    reasons.push("consolidation phase — lock in regrowth after upstream correction");
  }
  if (/TE GOLD/i.test(kitId) && clinical.flags.hasActiveShedding) {
    reasons.push("active shedding confirmed — TE arrest is non-negotiable");
  }
  if (/NIGHT SHIFT/i.test(kitId) && ans.lifestyle?.some((l) => /Night shift/i.test(l))) {
    reasons.push("night-shift exposure reported");
  }
  if (/FREQUENT FLYERS/i.test(kitId) && ans.lifestyle?.some((l) => /Frequent flying/i.test(l))) {
    reasons.push("frequent flying reported");
  }
  if (/HBR|HAIR BREAKAGE/i.test(kitId) && ans.hairtype?.some((h) => /breakage|broken|short/i.test(h))) {
    reasons.push("shaft breakage reported");
  }

  if (reasons.length === 0) {
    return `Selected as part of the protocol for ${DIAGNOSIS_DISPLAY[clinical.primaryDiagnosis] ?? clinical.primaryDiagnosis}.`;
  }
  return reasons.join("; ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

/** Returns which RootCauseAnalysis conditions this kit addresses. */
function supportingConditionsFor(
  kitId: string,
  analysis: RootCauseAnalysis
): string[] {
  const all = [...analysis.primary, ...analysis.secondary, ...analysis.amplifiers];
  const conditionNames = (test: (cond: string) => boolean) =>
    all.filter((c) => test(c.condition.toLowerCase())).map((c) => c.condition);

  if (/GI GOLD/i.test(kitId))       return conditionNames((c) => /gut/i.test(c));
  if (/IRON UP GOLD/i.test(kitId))  return conditionNames((c) => /iron/i.test(c));
  if (/PERI MENOPAUSE/i.test(kitId)) return conditionNames((c) => /hormonal|menopaus/i.test(c));
  if (/META B HYPOTHYROID/i.test(kitId)) return conditionNames((c) => /hypothyroid/i.test(c));
  if (/META B PCOS|F-PCOS/i.test(kitId)) return conditionNames((c) => /pcos/i.test(c));
  if (/META B/i.test(kitId))        return conditionNames((c) => /metabolic|insulin/i.test(c));
  if (/ALOPECIA AREATA/i.test(kitId)) return conditionNames((c) => /autoimmune/i.test(c));
  if (/^MPHL|^FPHL/i.test(kitId))    return conditionNames((c) => /androgen|genetic/i.test(c));
  if (/PHENOTYPE INFLAM/i.test(kitId)) return conditionNames((c) => /oxidative|stress|gut|hormonal/i.test(c));
  if (/OXIDATIVE STRESS/i.test(kitId)) return conditionNames((c) => /oxidative/i.test(c));
  if (/NIGHT SHIFT|FREQUENT FLYERS/i.test(kitId)) return conditionNames((c) => /circadian|stress/i.test(c));
  if (/TE GOLD/i.test(kitId))        return conditionNames((c) => /stress|nutrition|illness/i.test(c));
  if (/PRO IMMUNE/i.test(kitId))     return ["Follicular recovery consolidation"];
  return [];
}

/** Flatten the kit knowledge base's ingredient groups into a deduped, capped list. */
function flattenIngredients(
  groups: ReadonlyArray<{ ingredients: string[] }> | undefined,
  alreadyUsed: Set<string>,
  cap = 6
): string[] {
  if (!groups) return [];
  const out: string[] = [];
  for (const g of groups) {
    for (const ing of g.ingredients) {
      if (out.length >= cap) break;
      const key = ing.toLowerCase().split("(")[0].trim();
      if (alreadyUsed.has(key)) continue;
      alreadyUsed.add(key);
      out.push(ing);
    }
    if (out.length >= cap) break;
  }
  return out;
}

function buildTreatmentStrategy(
  kits: KitRecommendation,
  ans: PatientAnswers,
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis
): TreatmentPhase[] {
  // De-duplicate ingredients across phases — V4 explicitly forbids duplication.
  const ingredientsUsed = new Set<string>();

  return kits.rankedKits.map((sk): TreatmentPhase => {
    const info = getKitInfo(sk.kitId);
    const displayName = info?.displayName ?? sk.kitId;
    const mechanism = info?.therapeuticStrategy?.slice(0, 6) ?? [];
    const ingredients = flattenIngredients(info?.formulationRationale, ingredientsUsed);
    const formulationGroups = (info?.formulationRationale ?? []).map((g) => ({
      group: g.group,
      ingredients: [...g.ingredients],
      action: g.action,
    }));

    return {
      phase: sk.phase,
      kitId: sk.kitId,
      displayName,
      whySelected: whyKitSelected(sk.kitId, ans, clinical),
      supportingConditions: supportingConditionsFor(sk.kitId, analysis),
      keyIngredients: ingredients,
      mechanismOfAction: mechanism,
      formulationGroups,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Universal Recovery Milestones (identical for every report).
//
// The previous per-kit "Recovery Journey" exposed internal sequencing,
// kit names, and protocol phases. The patient report must not surface
// any of that — replaced by a fixed, universal expectation framework.
// ─────────────────────────────────────────────────────────────────────────────

export const UNIVERSAL_RECOVERY_MILESTONES: UniversalRecoveryMilestone[] = [
  {
    window: "1–2 Months",
    bullets: [
      "Reduction in active hair fall",
      "Improvement in scalp health and comfort",
      "Better hair texture and overall hair quality",
    ],
  },
  {
    window: "3rd Month",
    bullets: [
      "Early signs of follicular recovery",
      "Improvement in hair caliber (thickness)",
      "Appearance of fine new (vellus) hair growth",
    ],
  },
  {
    window: "4th Month",
    bullets: [
      "Visible improvement in hair volume and density",
      "Reduced scalp show-through in responsive areas",
      "Continued strengthening of existing follicles",
    ],
  },
  {
    window: "5th Month Onwards",
    bullets: [
      "Further improvement in density and coverage",
      "Consolidation of regrowth achieved",
      "Long-term maintenance and stabilization of results",
    ],
  },
];

// (The per-kit `kitRoadmapCopy` + `buildRecoveryRoadmap` helpers were
//  removed together with the "Your Recovery Journey" page. The patient
//  report now uses the universal `UNIVERSAL_RECOVERY_MILESTONES` block
//  above so internal kit names / phase numbers are never exposed.)

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Why HairOS Chose This Plan
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_WHY: Record<RootCauseCategory, string> = {
  Primary:
    "Primary conditions are the direct biological drivers of this patient's hair loss. The protocol must correct these before downstream therapy can take hold.",
  Secondary:
    "Secondary conditions impede follicular recovery — even after the primary driver is addressed, untreated secondary causes cap the response ceiling.",
  Amplifier:
    "Amplifiers accelerate progression and dampen treatment response. They are addressed in parallel so the corrective work in the primary phase is not eroded.",
};

function buildPlanReasoning(
  clinical: ClinicalProfile,
  kits: KitRecommendation,
  analysis: RootCauseAnalysis
): PlanReasoning {
  const categories: CategoryRationale[] = [];
  if (analysis.primary.length > 0) {
    categories.push({
      category: "Primary",
      whyItMatters: CATEGORY_WHY.Primary,
      conditions: analysis.primary.map((c) => c.condition),
    });
  }
  if (analysis.secondary.length > 0) {
    categories.push({
      category: "Secondary",
      whyItMatters: CATEGORY_WHY.Secondary,
      conditions: analysis.secondary.map((c) => c.condition),
    });
  }
  if (analysis.amplifiers.length > 0) {
    categories.push({
      category: "Amplifier",
      whyItMatters: CATEGORY_WHY.Amplifier,
      conditions: analysis.amplifiers.map((c) => c.condition),
    });
  }

  const leadKit = kits.rankedKits[0]?.kitId;
  const leadInfo = leadKit ? getKitInfo(leadKit) : null;
  const leadDisplay = leadInfo?.displayName ?? leadKit ?? "(none)";

  const sequencingRationale = kits.rankedKits.length === 0
    ? "No kits were selected — the assessment did not surface a confident protocol."
    : `Phase 1 leads with ${leadDisplay} because it targets the highest-leverage primary driver in this profile. Subsequent phases layer downstream once that upstream factor is contained — matching standard sequencing for ${DIAGNOSIS_DISPLAY[clinical.primaryDiagnosis] ?? clinical.primaryDiagnosis}.`;

  const kitNames = kits.rankedKits.map((k) => getKitInfo(k.kitId)?.displayName ?? k.kitId);
  const collectiveRationale = kitNames.length <= 1
    ? "A single kit fully addresses the detected biological picture in this case."
    : `Together, ${kitNames.slice(0, -1).join(", ")} and ${kitNames[kitNames.length - 1]} cover the upstream driver, the secondary contributors that would otherwise cap recovery, and the consolidation phase that prevents relapse — a complete biological picture rather than a single-point intervention.`;

  return { categories, sequencingRationale, collectiveRationale };
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Personalized Diet & Lifestyle (condition-mapped only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recommendation templates. Each template fires only when its `appliesWhen`
 * function detects the supporting condition in the analysis — guaranteeing
 * every recommendation is traceable to a detected condition. No generic advice.
 */
interface RecommendationTemplate {
  /** Detected condition substring(s) the recommendation maps to. */
  conditionTest: RegExp;
  recommendation: string;
  expectedBenefit: string;
}

const RECOMMENDATION_TEMPLATES: RecommendationTemplate[] = [
  // Gut
  {
    conditionTest: /gut|gerd|ibs/i,
    recommendation: "Eat slowly, avoid late dinners, include daily fermented food (curd / kefir / kanji); reduce caffeine and ultra-processed foods.",
    expectedBenefit: "Reduces visceral inflammation, supports microbiome diversity, restores absorption of iron, B12, and amino acids.",
  },
  // Iron / nutrition
  {
    conditionTest: /iron|nutrition/i,
    recommendation: "Pair iron-rich foods (greens, lentils, red meat if non-veg) with vitamin C; separate from tea / coffee by 1 hour.",
    expectedBenefit: "Improves ferritin trajectory and matrix-proliferation substrate.",
  },
  // Thyroid
  {
    conditionTest: /hypothyroid|hyperthyroid|thyroid/i,
    recommendation: "Maintain consistent iodine and selenium intake (eggs, fish, brazil nuts); avoid raw goitrogens in large quantities.",
    expectedBenefit: "Supports thyroid hormone synthesis alongside endocrine therapy.",
  },
  // PCOS / metabolic
  {
    conditionTest: /pcos|metabolic|insulin/i,
    recommendation: "Low-glycaemic plate (50% non-starchy vegetables, 25% lean protein, 25% slow carbs); 30 minutes of brisk walking 5 days a week.",
    expectedBenefit: "Improves insulin sensitivity, reduces bioavailable androgen pressure on follicles.",
  },
  // Stress
  {
    conditionTest: /stress/i,
    recommendation: "Daily 10-minute breathwork or guided meditation; fixed wake/sleep window; one no-screen hour before bed.",
    expectedBenefit: "Lowers HPA-axis tone, reduces cortisol-driven anagen-to-telogen transition.",
  },
  // Circadian
  {
    conditionTest: /circadian/i,
    recommendation: "Anchor 7+ hours of sleep within a consistent window; morning daylight exposure within 30 minutes of waking.",
    expectedBenefit: "Re-aligns cortisol / melatonin rhythm, supports follicle cycling.",
  },
  // Oxidative
  {
    conditionTest: /oxidative/i,
    recommendation: "Polyphenol-rich foods daily (berries, green tea, olive oil, dark greens); eliminate smoking / vaping; cap alcohol at 2 units / week.",
    expectedBenefit: "Reduces oxidative load on follicle stem cells.",
  },
  // Autoimmune
  {
    conditionTest: /autoimmune/i,
    recommendation: "Anti-inflammatory diet pattern (omega-3 fish or flax/walnuts; turmeric; reduce ultra-processed foods); avoid known personal triggers.",
    expectedBenefit: "Supports immune balance alongside medical therapy.",
  },
  // Hormonal transition
  {
    conditionTest: /hormonal|menopaus/i,
    recommendation: "Include phytoestrogen sources (soy, flax) and adequate protein at every meal; weight-bearing exercise twice weekly.",
    expectedBenefit: "Supports estrogen-decline transition and follicle environment.",
  },
  // Post-partum
  {
    conditionTest: /post-partum|postpartum/i,
    recommendation: "Sustain prenatal-level nutrition during the post-partum window; iron-rich meals; hydration with breastfeeding.",
    expectedBenefit: "Replenishes maternal substrate stores, supports follicle recovery.",
  },
  // Medication
  {
    conditionTest: /medication/i,
    recommendation: "Maintain medication adherence; review timing and meal pairing with prescribing clinician.",
    expectedBenefit: "Stabilises the underlying condition that triggered medication-related shedding.",
  },
];

function buildDietAndLifestyle(
  analysis: RootCauseAnalysis
): DietLifestyleRecommendation[] {
  const allConditions = [
    ...analysis.primary,
    ...analysis.secondary,
    ...analysis.amplifiers,
  ].map((c) => c.condition);

  const recs: DietLifestyleRecommendation[] = [];
  const seenTemplates = new Set<RecommendationTemplate>();
  for (const condition of allConditions) {
    for (const tpl of RECOMMENDATION_TEMPLATES) {
      if (seenTemplates.has(tpl)) continue;
      if (tpl.conditionTest.test(condition)) {
        recs.push({
          condition,
          recommendation: tpl.recommendation,
          expectedBenefit: tpl.expectedBenefit,
        });
        seenTemplates.add(tpl);
      }
    }
  }
  return recs;
}

// ─────────────────────────────────────────────────────────────────────────────
// §8 — Topical Recommendations
//
// Delegates to the canonical topical engine in
// src/packages/registries/topicals/recommendTopicals.ts — itself ported from
// topical-engine.schema.json (decision tree + auto-inject rules).
// ─────────────────────────────────────────────────────────────────────────────

function buildTopicalRecommendationsForReport(
  patient: { name: string; age: number; sex: string },
  ans: PatientAnswers,
): { recommended: TopicalRecommendation[]; cautions: { name: string; reason: string }[] } {
  const decision = recommendTopicals({ age: patient.age, sex: patient.sex }, ans);
  return {
    recommended: decision.recommended.map((r) => ({
      name: r.name,
      usage: r.usage,
      note: r.note,
      whySelected: r.whySelected,
    })),
    cautions: decision.cautions.map((c) => ({ name: c.name, reason: c.reason })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Generic Diet & Lifestyle Guide (condition-agnostic, same for all)
// ─────────────────────────────────────────────────────────────────────────────

const GENERAL_LIFESTYLE_GUIDE: GeneralLifestyleGuide = {
  foodsToAvoid: [
    "Chicken — not more than twice a week (prefer grilled).",
    "Beef, Pork, Lamb, Fish, Seafood — any of which not more than 2–3 times a week.",
    "Eggs — limit to 1–2 eggs twice a week; high-protein diet acidifies the blood and contributes to hair loss.",
    "Potato, Pasta, Cream and melted cheese — not more than twice a week.",
    "Chips, Fries, Tortillas, Nachos, Doritos, processed snacks.",
    "Sugar foods — Chocolates, Pastries, Cakes, Ice cream, desserts.",
    "Colas, Coke, Pepsi, soft drinks and all pre-packed juices.",
    "Bakery foods — Biscuits, Puffs, Rolls, Croissants, Doughnuts, white bread.",
    "Chinese foods containing ajinomoto / Chinese salt.",
    "Fast foods — Pizzas, Burgers, canned foods.",
    "Alcohol — restrict to two beers or two hard drinks, 2–3 times a week.",
    "Coffee and tea — restrict to 2–3 cups per day.",
    "Strictly NO SMOKING — keep away from second-hand smoke as well.",
  ],
  foodsToAdd: [
    "Steamed sprouts — 2 times a week.",
    "Green leafy vegetables — 2 times a week.",
    "Lima Beans, Fava Beans, French Beans, Broad Beans, Coloured Beans, Black Beans, Kidney Beans — rotate the choice 2–3 times a week.",
    "Salads with one meal every day — Beetroot, Carrot, Cucumber, Tomato, Greens; add salt, pepper, a dash of lime. No mayonnaise, no salad dressing, no sauces.",
    "Cottage Cheese, Chick Peas, Tofu, Mushroom, Lentils — rotate the choice 2–3 times a week.",
    "10–12 non-salted Walnuts, Almonds, Flaxseeds, Pumpkin Seeds — once or twice a week by rotation. Avoid peanuts, cashews and macadamia.",
    "Low-fat dairy products, a slice of cheese, olive-oil dressing — 3 times a week.",
    "Two fresh fruits per day — cut and eat, with skin when possible. Freshly squeezed juice consumed within 10–15 minutes; no packed juice.",
    "2–3 cups of green tea or hot water every day.",
    "1.5–2 litres of water every day.",
    "Balanced diet — avoid high protein intake, avoid regular whey protein (have it twice a week max). Do not follow fat-free, zero-carb, keto or any extreme diet.",
  ],
  lifestyleRecommendations: [
    "Maintain a fixed sleep / wake window — 7+ hours of consistent sleep.",
    "Get morning daylight exposure within 30 minutes of waking.",
    "30 minutes of brisk walking 5 days a week.",
    "Daily 10-minute breathwork or guided meditation to lower cortisol.",
    "One no-screen hour before bed to support melatonin onset.",
    "Strictly no smoking and no second-hand smoke exposure.",
    "Keep alcohol within the limits above; hydrate well after any consumption.",
    "Avoid harsh chemical hair treatments and excessive heat styling.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildClinicalReport(
  patient: { name: string; age: number; sex: string },
  clinical: ClinicalProfile,
  _therapyNeeds: TherapyNeeds,
  kits: KitRecommendation,
  ans: PatientAnswers
): ClinicalReport {
  const patientShape = { name: patient.name, age: patient.age, gender: patient.sex };
  const patientSummary = buildPatientSummary(patientShape, ans);
  const rootCauseAnalysis = buildRootCauseAnalysis(clinical, ans);
  const treatmentStrategy = buildTreatmentStrategy(kits, ans, clinical, rootCauseAnalysis);
  const whyHairosChoseThisPlan = buildPlanReasoning(clinical, kits, rootCauseAnalysis);
  const dietAndLifestyle = buildDietAndLifestyle(rootCauseAnalysis);
  const { recommended: topicalRecommendations, cautions: topicalCautions } =
    buildTopicalRecommendationsForReport(patient, ans);
  const finalClinicalAssessment: FinalClinicalAssessment =
    buildFinalClinicalAssessment(clinical, rootCauseAnalysis, kits, ans);
  const clinicalInsightStory =
    buildClinicalInsightStory(clinical, rootCauseAnalysis, kits, ans);

  return {
    patientSummary,
    rootCauseAnalysis,
    treatmentStrategy,
    topicalRecommendations,
    topicalCautions,
    recoveryRoadmap: [],
    recoveryMilestones: UNIVERSAL_RECOVERY_MILESTONES,
    finalClinicalAssessment,
    clinicalInsightStory,
    whyHairosChoseThisPlan,
    dietAndLifestyle,
    generalLifestyleGuide: GENERAL_LIFESTYLE_GUIDE,
    schemaVersion: "v4",
    generatedAt: new Date().toISOString(),
  };
}
