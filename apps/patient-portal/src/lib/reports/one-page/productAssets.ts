export type ProductAsset = {
  src: string;
  alt: string;
  key: string;
};

export type PatientImageResolution = ProductAsset & {
  source: "real_portrait" | "approved_upload" | "gender_fallback" | "neutral_fallback" | "initials";
};

const KIT_ASSET_BASE = "/product-assets/kits";
const CONDITION_ASSET_BASE = "/report-assets/conditions";
const PATIENT_ASSET_BASE = "/report-assets/patient";
const RECOVERY_ASSET_BASE = "/report-assets/recovery";

const portraits = {
  femaleFallback: { key: "PATIENT_FEMALE_FALLBACK", src: `${PATIENT_ASSET_BASE}/female-fallback-premium-lite.png`, alt: "Female patient fallback portrait" },
  maleFallback: { key: "PATIENT_MALE_FALLBACK", src: `${PATIENT_ASSET_BASE}/male-fallback-premium-lite.png`, alt: "Male patient fallback portrait" },
  neutralFallback: { key: "PATIENT_NEUTRAL_FALLBACK", src: `${PATIENT_ASSET_BASE}/neutral-fallback-premium-lite.png`, alt: "Neutral patient fallback portrait" },
} satisfies Record<string, ProductAsset>;

// Condition illustrations: prefer the "-ai" variants (~250 KB each) over the
// "-premium" variants (~2.5 MB each). At ~10 conditions per report this
// alone drops the printed PDF from ~28 MB to ~2–3 MB with negligible
// visual difference at the render size on the one-pager.
const conditions = {
  CHRONIC_IRON_LOSS: { key: "CHRONIC_IRON_LOSS", src: `${CONDITION_ASSET_BASE}/chronic-iron-loss-ai.png`, alt: "Chronic iron loss blood-cell illustration" },
  SCALP_INFLAMMATION: { key: "SCALP_INFLAMMATION", src: `${CONDITION_ASSET_BASE}/scalp-inflammation-ai.png`, alt: "Scalp inflammation and dandruff illustration" },
  METABOLIC_DYSFUNCTION: { key: "METABOLIC_DYSFUNCTION", src: `${CONDITION_ASSET_BASE}/metabolic-dysfunction-ai.png`, alt: "Metabolic dysfunction illustration" },
  CHRONIC_STRESS: { key: "CHRONIC_STRESS", src: `${CONDITION_ASSET_BASE}/stress-shedding-ai.png`, alt: "Chronic stress shedding illustration" },
  // No `-ai` variant for "smoking-alcohol"; the generic oxidative-stress-ai
  // conveys the same clinical driver at 1/10 the size.
  OXIDATIVE_STRESS: { key: "OXIDATIVE_STRESS", src: `${CONDITION_ASSET_BASE}/oxidative-stress-ai.png`, alt: "Oxidative stress from smoking or alcohol illustration" },
  RAPID_WEIGHT_LOSS: { key: "RAPID_WEIGHT_LOSS", src: `${CONDITION_ASSET_BASE}/rapid-weight-loss-ai.png`, alt: "Rapid weight loss trigger illustration" },
  GENETIC_PREDISPOSITION: { key: "GENETIC_PREDISPOSITION", src: `${CONDITION_ASSET_BASE}/genetic-pattern-ai.png`, alt: "Genetic predisposition illustration" },
  FEMALE_PATTERN_HAIR_LOSS: { key: "FEMALE_PATTERN_HAIR_LOSS", src: `${CONDITION_ASSET_BASE}/female-pattern-ai.png`, alt: "Female pattern hair loss illustration" },
  // No `-ai` for "norwood-scale"; male-pattern-ai depicts the same driver.
  MALE_PATTERN_HAIR_LOSS: { key: "MALE_PATTERN_HAIR_LOSS", src: `${CONDITION_ASSET_BASE}/male-pattern-ai.png`, alt: "Male pattern hair loss illustration" },
  TELOGEN_EFFLUVIUM: { key: "TELOGEN_EFFLUVIUM", src: `${CONDITION_ASSET_BASE}/telogen-effluvium-ai.png`, alt: "Telogen effluvium shedding illustration" },
  HORMONAL_CONTRIBUTOR: { key: "HORMONAL_CONTRIBUTOR", src: `${CONDITION_ASSET_BASE}/hormonal-contributor-ai.png`, alt: "Hormonal contributor illustration" },
  NUTRITIONAL_DEFICIENCY: { key: "NUTRITIONAL_DEFICIENCY", src: `${CONDITION_ASSET_BASE}/nutritional-risk-ai.png`, alt: "Diet and nutritional risk illustration" },
  // No `-ai` for "lifestyle-modifier"; recovery/stress-shedding-ai reads as
  // the same lifestyle driver visual bucket.
  LIFESTYLE_MODIFIER: { key: "LIFESTYLE_MODIFIER", src: `${CONDITION_ASSET_BASE}/stress-shedding-ai.png`, alt: "Lifestyle modifier hair recovery illustration" },
  IMMUNE_CONTRIBUTOR: { key: "IMMUNE_CONTRIBUTOR", src: `${CONDITION_ASSET_BASE}/immune-ai-lite.png`, alt: "Immune contributor illustration" },
  FOLLICLE_GENERAL: { key: "FOLLICLE_GENERAL", src: `${CONDITION_ASSET_BASE}/fallback-neutral-ai-lite.png`, alt: "General follicle illustration" },
} satisfies Record<string, ProductAsset>;

const kits = {
  HAIR_FACT_TE_GOLD: { key: "HAIR_FACT_TE_GOLD", src: `${KIT_ASSET_BASE}/hair_fact_te_gold.png`, alt: "Hair Fact TE Gold kit" },
  HAIR_FACT_TE_GOLD_VEG: { key: "HAIR_FACT_TE_GOLD_VEG", src: `${KIT_ASSET_BASE}/hair_fact_te_gold_veg.png`, alt: "Hair Fact TE Gold Veg kit" },
  PRO_IMMUNE_GOLD: { key: "PRO_IMMUNE_GOLD", src: `${KIT_ASSET_BASE}/pro_immune_gold.png`, alt: "Pro Immune 5 kit" },
  PRO_IMMUNE_GOLD_PLUS: { key: "PRO_IMMUNE_GOLD_PLUS", src: `${KIT_ASSET_BASE}/Pro Immune - 5.png`, alt: "Pro Immune 5 kit" },
  PRO_IMMUNE_VEG: { key: "PRO_IMMUNE_VEG", src: `${KIT_ASSET_BASE}/pro_immune_veg.png`, alt: "Pro Immune 5 kit" },
  PHENOTYPE_INFLAMMATION: { key: "PHENOTYPE_INFLAMMATION", src: `${KIT_ASSET_BASE}/phenotype_inflamation.png`, alt: "Phenotype Inflammation kit" },
  MPHL: { key: "MPHL", src: `${KIT_ASSET_BASE}/mphl_v2.png`, alt: "MPHL Pro kit" },
  MPHL_PLUS: { key: "MPHL", src: `${KIT_ASSET_BASE}/mphl_v2.png`, alt: "MPHL Pro kit" },
  FPHL: { key: "FPHL", src: `${KIT_ASSET_BASE}/fphl_v2.png`, alt: "FPHL Pro kit" },
  FPHL_PLUS: { key: "FPHL", src: `${KIT_ASSET_BASE}/fphl_v2.png`, alt: "FPHL Pro kit" },
  HAIR_FACT_ALOPECIA_AREATA: { key: "HAIR_FACT_ALOPECIA_AREATA", src: `${KIT_ASSET_BASE}/alopecia_areata_v1.png`, alt: "Hair Fact Alopecia Areata kit" },
  HAIR_FACT_PERI_MENOPAUSE: { key: "HAIR_FACT_PERI_MENOPAUSE", src: `${KIT_ASSET_BASE}/peri_menopause.png`, alt: "Hair Fact Peri Menopause kit" },
  PRO_FACT_META_B_POSTMENOPAUSE: { key: "PRO_FACT_META_B_POSTMENOPAUSE", src: `${KIT_ASSET_BASE}/pro_fact_meta_b_post_menopause.png`, alt: "Pro Fact Meta B Postmenopause kit" },
  F_PCOS_1: { key: "F_PCOS_1", src: `${KIT_ASSET_BASE}/f_pcos_1.png`, alt: "F-PCOS kit" },
  F_PCOS_VEG_1: { key: "F_PCOS_VEG_1", src: `${KIT_ASSET_BASE}/f_pcos.png`, alt: "F-PCOS Veg kit" },
  PRO_FACT_META_B_PCOS: { key: "PRO_FACT_META_B_PCOS", src: `${KIT_ASSET_BASE}/pro_fact_meta_b_pcos.png`, alt: "Pro Fact Meta B PCOS kit" },
  PRO_FACT_META_B: { key: "PRO_FACT_META_B", src: `${KIT_ASSET_BASE}/pro_fact_meta_b.png`, alt: "Pro Fact Meta B kit" },
  OXIDATIVE_STRESS: { key: "OXIDATIVE_STRESS", src: `${KIT_ASSET_BASE}/phenotype_oxidative_stress.png`, alt: "Oxidative Stress kit" },
  PRO_FACT_GI_GOLD: { key: "PRO_FACT_GI_GOLD", src: `${KIT_ASSET_BASE}/pro_fact_gi_gold.png`, alt: "Pro Fact GI Gold kit" },
  TTM: { key: "TTM", src: `${KIT_ASSET_BASE}/ttm.png`, alt: "TTM kit" },
  HAIR_FACT_TTM_OCD: { key: "HAIR_FACT_TTM_OCD", src: `${KIT_ASSET_BASE}/ttm_boost.png`, alt: "Hair Fact TTM OCD kit" },
  HBR: { key: "HBR", src: `${KIT_ASSET_BASE}/hair_fact_hbr_v1.png`, alt: "Hair Fact HBR kit" },
  HBR_V2: { key: "HBR_V2", src: `${KIT_ASSET_BASE}/hair_fact_hbr_v2.png`, alt: "Hair Fact Hair Breakage Repair kit" },
  EARLY_GREYING_CARE: { key: "EARLY_GREYING_CARE", src: `${KIT_ASSET_BASE}/early_greying_care_gold.png`, alt: "Early Greying Care Gold kit" },
  HEALTHY_9: { key: "HEALTHY_9", src: `${KIT_ASSET_BASE}/healthy_9.png`, alt: "Healthy-9 pregnancy kit" },
  PRO_FACT_POST_HYSTERECTOMY: { key: "PRO_FACT_POST_HYSTERECTOMY", src: `${KIT_ASSET_BASE}/Post Hysterectomy Reset.png`, alt: "Pro Fact Post Hysterectomy Reset kit" },
  PRO_FACT_THYROID_CARE: { key: "PRO_FACT_THYROID_CARE", src: `${KIT_ASSET_BASE}/thyroid_care.png`, alt: "Pro Fact Thyroid Care kit" },
  RAPID_WEIGHT_LOSS_SHIELD: { key: "RAPID_WEIGHT_LOSS_SHIELD", src: `${KIT_ASSET_BASE}/rapid_weight_loss_shield.png`, alt: "Rapid Weight Loss Shield kit" },
  FH_WELL_3: { key: "FH_WELL_3", src: `${KIT_ASSET_BASE}/f_h_well.png`, alt: "FH Well 3 kit" },
  IRON_UP_GOLD: { key: "IRON_UP_GOLD", src: `${KIT_ASSET_BASE}/iron_up.png`, alt: "Iron Up Gold kit" },
  IRON_UP_GOLD_VEG: { key: "IRON_UP_GOLD_VEG", src: `${KIT_ASSET_BASE}/pro_fact_iron_up.png`, alt: "Iron Up Gold Veg kit" },
  HAIR_FACT_NIGHT_SHIFT: { key: "HAIR_FACT_NIGHT_SHIFT", src: `${KIT_ASSET_BASE}/hair_fact_night_shift.png`, alt: "Hair Fact Night Shift kit" },
  HAIR_FACT_FREQUENT_FLYERS: { key: "HAIR_FACT_FREQUENT_FLYERS", src: `${KIT_ASSET_BASE}/hair_fact_frequent_flyer.png`, alt: "Hair Fact Frequent Flyers kit" },
  PRO_FACT_META_B_HYPOTHYROID: { key: "PRO_FACT_META_B_HYPOTHYROID", src: `${KIT_ASSET_BASE}/pro_fact_meta_b_hypothyroid.png`, alt: "Pro Fact Meta B Hypothyroid kit" },
  PRO_FACT_META_B_HYPOTHYROID_VEG: { key: "PRO_FACT_META_B_HYPOTHYROID_VEG", src: `${KIT_ASSET_BASE}/post_m_hypothyroid.png`, alt: "Pro Fact Meta B Hypothyroid Veg kit" },
  LACTIHEALTH: { key: "LACTIHEALTH", src: `${KIT_ASSET_BASE}/lactihealth.jpeg`, alt: "Lactihealth kit" },
  LACTIHEALTH_VEG: { key: "LACTIHEALTH_VEG", src: `${KIT_ASSET_BASE}/lactihealth_veg.jpeg`, alt: "Lactihealth Veg kit" },
} satisfies Record<string, ProductAsset>;

const topicals = {
  F_BIWASH: { key: "F_BIWASH", src: `${KIT_ASSET_BASE}/f_biwash.png`, alt: "F-Biwash topical packshot" },
  F_BIWASH_PLUS: { key: "F_BIWASH_PLUS", src: `${KIT_ASSET_BASE}/f_biwashplus.png`, alt: "F-Biwash Plus topical packshot" },
  F_EMUGROW_MC: { key: "F_EMUGROW_MC", src: `${KIT_ASSET_BASE}/f_emugrow_mc.png`, alt: "F-Emugrow MC topical packshot" },
  F_EMUGROW_MCR: { key: "F_EMUGROW_MCR", src: `${KIT_ASSET_BASE}/f_emugrow_mcr.png`, alt: "F-Emugrow MCR topical packshot" },
  F_EMUGROW_MC_R: { key: "F_EMUGROW_MC_R", src: `${KIT_ASSET_BASE}/f_emugrow_mc_r.png`, alt: "F-Emugrow MC R topical packshot" },
  F_EMUGROW_MCRD: { key: "F_EMUGROW_MCRD", src: `${KIT_ASSET_BASE}/f_emugrow_mcrd.png`, alt: "F-Emugrow MCRD topical packshot" },
  F_EMUGROW_MC_R_D: { key: "F_EMUGROW_MC_R_D", src: `${KIT_ASSET_BASE}/f_emugrow_mc_r_d.png`, alt: "F-Emugrow MC R D topical packshot" },
  F_TRICHOSILK: { key: "F_TRICHOSILK", src: `${KIT_ASSET_BASE}/f_trichosilk.png`, alt: "F-Trichosilk topical packshot" },
  F_TRICHOSILK_DF_WITH_TREATMENT: { key: "F_TRICHOSILK_DF_WITH_TREATMENT", src: `${KIT_ASSET_BASE}/f_trichosilk_dandfwt.png`, alt: "F-Trichosilk D and F with treatment" },
  F_TRICHOSILK_DF_WITHOUT_TREATMENT: { key: "F_TRICHOSILK_DF_WITHOUT_TREATMENT", src: `${KIT_ASSET_BASE}/f_trichosilk_dandfwot.png`, alt: "F-Trichosilk D and F without treatment" },
  F_TRICHOSILK_FNH: { key: "F_TRICHOSILK_FNH", src: `${KIT_ASSET_BASE}/f_trichosilk_fnh.png`, alt: "F-Trichosilk FNH topical packshot" },
  F_EXTEND_2: { key: "F_EXTEND_2", src: `${KIT_ASSET_BASE}/f_extend_2.png`, alt: "F-Extend 2% Minoxidil topical packshot" },
  F_EXTEND_5: { key: "F_EXTEND_5", src: `${KIT_ASSET_BASE}/f_extend_5.png`, alt: "F-Extend 5% Minoxidil topical packshot" },
  F_TRICHOGAIN: { key: "F_TRICHOGAIN", src: `${KIT_ASSET_BASE}/f_trichogain.png`, alt: "F-Trichogain topical packshot" },
  // ── Oral combination tablets (Oroxidil family) ────────────────────────────
  // These are SYSTEMIC tablets, not scalp solutions. They previously fell
  // through to the F-Extend bottle packshots because `topicalAssetCode`
  // matched them on the bare "MINOXIDIL" token, which put a topical bottle
  // on the sheet for an oral prescription. Each now carries its own carton.
  ORAL_MINOXIDIL_SPIRONOLACTONE: { key: "ORAL_MINOXIDIL_SPIRONOLACTONE", src: `${KIT_ASSET_BASE}/Oral Minoxidil + Spironolactone.png`, alt: "F-S-Oroxidil 1.25-25 — Oral Minoxidil 1.25mg and Spironolactone 25mg tablets" },
  ORAL_MINOXIDIL_SPIRONOLACTONE_50: { key: "ORAL_MINOXIDIL_SPIRONOLACTONE_50", src: `${KIT_ASSET_BASE}/F-S-Oroxidil 1.25-50.png`, alt: "F-S-Oroxidil 1.25-50 — Oral Minoxidil 1.25mg and Spironolactone 50mg tablets" },
  ORAL_MINOXIDIL_BICALUTAMIDE: { key: "ORAL_MINOXIDIL_BICALUTAMIDE", src: `${KIT_ASSET_BASE}/Oral Minoxidil + bicalutamide.png`, alt: "F-B-Oroxidil 1.25-50 — Oral Minoxidil 1.25mg and Bicalutamide 50mg tablets" },
} satisfies Record<string, ProductAsset>;

const recoveryStages = {
  DAY_0_30: { key: "DAY_0_30", src: `${RECOVERY_ASSET_BASE}/day-0-30-ai-lite.png`, alt: "Recovery stage day 0 to 30 follicle illustration" },
  DAY_30_60: { key: "DAY_30_60", src: `${RECOVERY_ASSET_BASE}/day-30-60-ai-lite.png`, alt: "Recovery stage day 30 to 60 follicle illustration" },
  DAY_60_120: { key: "DAY_60_120", src: `${RECOVERY_ASSET_BASE}/day-60-120-ai-lite.png`, alt: "Recovery stage day 60 to 120 follicle illustration" },
  BEYOND_120: { key: "BEYOND_120", src: `${RECOVERY_ASSET_BASE}/beyond-120-ai-lite.png`, alt: "Recovery stage beyond day 120 follicle illustration" },
} satisfies Record<string, ProductAsset>;

export const reportAssets = { portraits, conditions, kits, topicals, recoveryStages };
export const CONDITION_ASSET_REGISTRY = conditions;
export const KIT_ASSET_REGISTRY = kits;
export const TOPICAL_ASSET_REGISTRY = topicals;
export const RECOVERY_STAGE_ASSET_REGISTRY = recoveryStages;

function normalizeCode(value: string): string {
  return value.trim().replace(/[\s-]+/g, "_").replace(/[^A-Z0-9_]/gi, "").toUpperCase();
}

function stableExternalImageUrl(value: string): boolean {
  if (/^data:image\//i.test(value)) return true;
  if (value.startsWith("/")) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(value)) return true;
  return /^https:\/\/[^?]+\.(png|jpe?g|webp|svg)$/i.test(value);
}

export function conditionCodeForText(text: string): string {
  if (/female pattern|fphl|ludwig/i.test(text)) return "FEMALE_PATTERN_HAIR_LOSS";
  if (/male pattern|mphl|norwood/i.test(text)) return "MALE_PATTERN_HAIR_LOSS";
  if (/iron|ferritin|blood|bleed|anaemi|anemi/i.test(text)) return "CHRONIC_IRON_LOSS";
  if (/scalp|dandruff|itch|inflam|sebum|flake|seborr/i.test(text)) return "SCALP_INFLAMMATION";
  if (/metabolic|insulin|weight|diabetes|prediabetes|glp|obesity/i.test(text)) return "METABOLIC_DYSFUNCTION";
  if (/oxidative|smoking|vaping|alcohol/i.test(text)) return "OXIDATIVE_STRESS";
  if (/stress|sleep|cortisol|shift/i.test(text)) return "CHRONIC_STRESS";
  if (/genetic|androgen|dht|pattern/i.test(text)) return "GENETIC_PREDISPOSITION";
  if (/rapid weight|crash|extreme diet|crash diet|fasting|starvation|calorie restriction/i.test(text)) return "RAPID_WEIGHT_LOSS";
  if (/hormone|pcos|thyroid|menopause/i.test(text)) return "HORMONAL_CONTRIBUTOR";
  if (/nutrition|diet|deficien|gut|protein|vegetarian|micronutrient|iron-rich/i.test(text)) return "NUTRITIONAL_DEFICIENCY";
  if (/immune|autoimmune|areata|allerg/i.test(text)) return "IMMUNE_CONTRIBUTOR";
  if (/telogen|shedding|hair fall/i.test(text)) return "TELOGEN_EFFLUVIUM";
  if (/lifestyle|sedentary|movement|exercise|hydration|routine|heat styling|chemical treatment/i.test(text)) return "LIFESTYLE_MODIFIER";
  return "FOLLICLE_GENERAL";
}
export function getPatientPortrait(imageUrl: string | null | undefined, gender: string): PatientImageResolution {
  if (imageUrl && stableExternalImageUrl(imageUrl)) {
    const source = imageUrl.startsWith("data:image/") || imageUrl.startsWith("/") ? "approved_upload" : "real_portrait";
    return { key: "PATIENT_IMAGE", src: imageUrl, alt: "Patient portrait", source };
  }
  const genderKey = /female|woman/i.test(gender) ? "femaleFallback" : /male|man/i.test(gender) ? "maleFallback" : "neutralFallback";
  const asset = reportAssets.portraits[genderKey] ?? reportAssets.portraits.neutralFallback;
  return { ...asset, source: genderKey === "neutralFallback" ? "neutral_fallback" : "gender_fallback" };
}

type ConditionKey = keyof typeof conditions;
type KitKey = keyof typeof kits;
type TopicalKey = keyof typeof topicals;
type RecoveryStageKey = keyof typeof recoveryStages;

export function getConditionIllustration(conditionCode: string): ProductAsset | null {
  const key = normalizeCode(conditionCode) as ConditionKey;
  return (conditions as Record<string, ProductAsset>)[key] ?? null;
}

export function getKitPackshot(kitCode: string): ProductAsset | null {
  const key = normalizeCode(kitCode) as KitKey;
  return (kits as Record<string, ProductAsset>)[key] ?? null;
}

export function getTopicalPackshot(productCode: string): ProductAsset | null {
  const key = normalizeCode(productCode) as TopicalKey;
  return (topicals as Record<string, ProductAsset>)[key] ?? null;
}

export function getRecoveryStageIllustration(stageCode: string): ProductAsset | null {
  const key = normalizeCode(stageCode) as RecoveryStageKey;
  return (recoveryStages as Record<string, ProductAsset>)[key] ?? null;
}

export function getFallbackAsset(assetType: "condition" | "patient" | "recovery"): ProductAsset | null {
  if (assetType === "condition") return reportAssets.conditions.FOLLICLE_GENERAL;
  if (assetType === "patient") return reportAssets.portraits.neutralFallback;
  if (assetType === "recovery") return reportAssets.recoveryStages.DAY_0_30;
  return null;
}

export const getConditionAsset = getConditionIllustration;
export const getProductAsset = getKitPackshot;
export const getTopicalAsset = getTopicalPackshot;
export const resolvePatientImageAsset = getPatientPortrait;


