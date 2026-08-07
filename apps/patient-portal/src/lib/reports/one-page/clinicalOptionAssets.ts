import type { ProductAsset } from "./productAssets";

export type ClinicalIconUsage = "snapshot" | "trigger" | "clinical_meaning";
export type ClinicalOptionAssetStatus = "exact" | "fallback" | "needs_replacement";

export type ClinicalOptionAsset = {
  optionCode: string;
  label: string;
  assetPath: string;
  domainFallbackPath: string;
  altText: string;
  status: ClinicalOptionAssetStatus;
  sourceSheet?: string;
  sourceCrop?: { x: number; y: number; width: number; height: number };
};

export type ResolvedClinicalOptionAsset = {
  optionCode: string;
  label: string;
  asset: ProductAsset;
  status: ClinicalOptionAssetStatus;
  registryEntry: ClinicalOptionAsset | null;
};

const BASE = "/report-assets/clinical-options";
const CONDITION_BASE = "/report-assets/conditions";
const SNAPSHOT_SHEET = "clinical_snapshot_library";

const exact = (
  optionCode: string,
  label: string,
  crop: { x: number; y: number; width: number; height: number },
  domainFallbackPath: string,
  status: ClinicalOptionAssetStatus = "exact",
): ClinicalOptionAsset => ({
  optionCode,
  label,
  assetPath: `${BASE}/${optionCode}.png`,
  domainFallbackPath,
  altText: `${label} clinical illustration`,
  status,
  sourceSheet: SNAPSHOT_SHEET,
  sourceCrop: crop,
});

export const CLINICAL_OPTION_ASSETS: Record<string, ClinicalOptionAsset> = {
  stress_anxiety_depression: exact("stress_anxiety_depression", "Stress / Anxiety / Depression", { x: 48, y: 132, width: 226, height: 128 }, `${CONDITION_BASE}/stress-shedding-ai.png`),
  smoking_vaping: exact("smoking_vaping", "Smoking / Vaping", { x: 316, y: 132, width: 224, height: 128 }, `${CONDITION_BASE}/oxidative-stress-ai.png`),
  bodybuilding_heavy_gym: exact("bodybuilding_heavy_gym", "Bodybuilding / Heavy gym", { x: 579, y: 132, width: 229, height: 128 }, `${CONDITION_BASE}/metabolic-dysfunction-ai.png`),
  endometriosis: exact("endometriosis", "Endometriosis", { x: 848, y: 132, width: 224, height: 128 }, `${CONDITION_BASE}/hormonal-contributor-ai.png`),
  post_hysterectomy: exact("post_hysterectomy", "Post-hysterectomy", { x: 48, y: 339, width: 226, height: 130 }, `${CONDITION_BASE}/hormonal-contributor-ai.png`, "needs_replacement"),
  hypothyroidism: exact("hypothyroidism", "Hypothyroidism", { x: 316, y: 339, width: 224, height: 130 }, `${CONDITION_BASE}/hormonal-contributor-ai.png`),
  recurrent_acne_acne_prone_skin: exact("recurrent_acne_acne_prone_skin", "Recurrent Acne / Acne-prone skin", { x: 579, y: 339, width: 229, height: 130 }, `${CONDITION_BASE}/immune-ai-lite.png`),
  indigestion: exact("indigestion", "Indigestion", { x: 848, y: 339, width: 224, height: 130 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  constipation: exact("constipation", "Constipation", { x: 48, y: 555, width: 226, height: 130 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  high_protein_diet: exact("high_protein_diet", "High protein diet", { x: 316, y: 555, width: 224, height: 130 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  vegetarian: exact("vegetarian", "Vegetarian", { x: 579, y: 555, width: 229, height: 130 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  chemical_treatment: exact("chemical_treatment", "Chemical treatment (colour / keratin)", { x: 848, y: 555, width: 224, height: 130 }, `${CONDITION_BASE}/stress-shedding-ai.png`),
  genetics_family_history: exact("genetics_family_history", "Genetics / Family history", { x: 48, y: 757, width: 226, height: 132 }, `${CONDITION_BASE}/genetic-pattern-ai.png`),
  age_above_40: exact("age_above_40", "Age above 40", { x: 316, y: 757, width: 224, height: 132 }, `${CONDITION_BASE}/metabolic-dysfunction-ai.png`),
  pre_diabetes: exact("pre_diabetes", "Pre diabetes", { x: 579, y: 757, width: 229, height: 132 }, `${CONDITION_BASE}/metabolic-dysfunction-ai.png`),
  bloating_gas: exact("bloating_gas", "Bloating / gas", { x: 848, y: 757, width: 224, height: 132 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  ibs_crohns: exact("ibs_crohns", "IBS / Crohn's", { x: 48, y: 964, width: 226, height: 130 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  acid_reflux_gerd: exact("acid_reflux_gerd", "Acid reflux / GERD", { x: 316, y: 964, width: 224, height: 130 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  hard_water: exact("hard_water", "Hard water", { x: 579, y: 964, width: 229, height: 130 }, `${CONDITION_BASE}/stress-shedding-ai.png`),
  post_glp_1_receptor_agonist: exact("post_glp_1_receptor_agonist", "Post GLP-1 receptor agonist", { x: 848, y: 964, width: 224, height: 130 }, `${CONDITION_BASE}/rapid-weight-loss-ai.png`),
  irregular_poor_diet: exact("irregular_poor_diet", "Irregular / poor diet", { x: 48, y: 1156, width: 226, height: 136 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  obesity_sedentary_weight_concern: exact("obesity_sedentary_weight_concern", "Obesity / Sedentary / Struggle to lose weight", { x: 316, y: 1156, width: 224, height: 136 }, `${CONDITION_BASE}/metabolic-dysfunction-ai.png`),
  nutritional_deficiencies: exact("nutritional_deficiencies", "Nutritional deficiencies", { x: 579, y: 1156, width: 229, height: 136 }, `${CONDITION_BASE}/nutritional-risk-ai.png`),
  redness_or_irritation: exact("redness_or_irritation", "Redness or irritation", { x: 848, y: 1156, width: 224, height: 136 }, `${CONDITION_BASE}/scalp-inflammation-ai.png`),
};

const ALIASES: Array<{ pattern: RegExp; optionCode: string }> = [
  { pattern: /stress|anxiety|depression/i, optionCode: "stress_anxiety_depression" },
  { pattern: /smoking|vaping/i, optionCode: "smoking_vaping" },
  { pattern: /bodybuilding|heavy gym/i, optionCode: "bodybuilding_heavy_gym" },
  { pattern: /endometriosis/i, optionCode: "endometriosis" },
  { pattern: /hysterectomy/i, optionCode: "post_hysterectomy" },
  { pattern: /hypothyroid/i, optionCode: "hypothyroidism" },
  { pattern: /recurrent acne|acne.?prone/i, optionCode: "recurrent_acne_acne_prone_skin" },
  { pattern: /indigestion/i, optionCode: "indigestion" },
  { pattern: /constipation/i, optionCode: "constipation" },
  { pattern: /high.?protein/i, optionCode: "high_protein_diet" },
  { pattern: /vegetarian/i, optionCode: "vegetarian" },
  { pattern: /chemical treatment|colour|keratin/i, optionCode: "chemical_treatment" },
  { pattern: /genetics|family history/i, optionCode: "genetics_family_history" },
  { pattern: /age (?:above|over) 40|40\+/i, optionCode: "age_above_40" },
  { pattern: /pre.?diabet/i, optionCode: "pre_diabetes" },
  { pattern: /bloating|gas/i, optionCode: "bloating_gas" },
  { pattern: /ibs|crohn/i, optionCode: "ibs_crohns" },
  { pattern: /acid reflux|gerd|heartburn/i, optionCode: "acid_reflux_gerd" },
  { pattern: /hard water/i, optionCode: "hard_water" },
  { pattern: /glp.?1|receptor agonist/i, optionCode: "post_glp_1_receptor_agonist" },
  { pattern: /irregular.*diet|poor diet/i, optionCode: "irregular_poor_diet" },
  { pattern: /obesity|sedentary|struggle to lose weight|weight concern/i, optionCode: "obesity_sedentary_weight_concern" },
  { pattern: /nutritional deficien/i, optionCode: "nutritional_deficiencies" },
  { pattern: /redness|irritation/i, optionCode: "redness_or_irritation" },
];

const DOMAIN_FALLBACKS: Array<{ pattern: RegExp; path: string; code: string }> = [
  { pattern: /female pattern|fphl|ludwig/i, path: `${CONDITION_BASE}/female-pattern-ai.png`, code: "female_pattern_domain" },
  { pattern: /male pattern|mphl|norwood/i, path: `${CONDITION_BASE}/male-pattern-ai.png`, code: "male_pattern_domain" },
  { pattern: /alopecia|immune|infection|allerg|asthma|\brash(?:es)?\b|eczema|mouth ulcer|psoriasis|circular.*patch|coin.?sized/i, path: `${CONDITION_BASE}/immune-ai-lite.png`, code: "immune_domain" },
  { pattern: /dandruff|scalp|itch|oily|dry|boil|pimple|burning|flak/i, path: `${CONDITION_BASE}/scalp-inflammation-ai.png`, code: "scalp_domain" },
  { pattern: /thyroid|pcos|pcod|hormone|pregnan|post.?partum|post.?delivery|breastfeed|menopause|heavy bleeding|hrt/i, path: `${CONDITION_BASE}/hormonal-contributor-ai.png`, code: "hormonal_domain" },
  { pattern: /iron|anaemi|vitamin|diet|vegan|non.?vegetarian|pescatar|nutrition|gut|digest|outside eating/i, path: `${CONDITION_BASE}/nutritional-risk-ai.png`, code: "nutrition_domain" },
  { pattern: /metabolic|diabet|weight|obes|sedentary/i, path: `${CONDITION_BASE}/metabolic-dysfunction-ai.png`, code: "metabolic_domain" },
  { pattern: /alcohol|oxidative|greying/i, path: `${CONDITION_BASE}/oxidative-stress-ai.png`, code: "oxidative_domain" },
  { pattern: /rapid weight|crash|keto|fasting/i, path: `${CONDITION_BASE}/rapid-weight-loss-ai.png`, code: "rapid_weight_loss_domain" },
  { pattern: /shedding|hair fall|white bulb|pillow|shower|thinning/i, path: `${CONDITION_BASE}/telogen-effluvium-ai.png`, code: "shedding_domain" },
  { pattern: /genetic|androgen|dht|pattern/i, path: `${CONDITION_BASE}/genetic-pattern-ai.png`, code: "genetic_domain" },
  { pattern: /stress|sleep|night shift|hair pulling|trichotillo|frequent flying|heat styling/i, path: `${CONDITION_BASE}/stress-shedding-ai.png`, code: "stress_domain" },
  { pattern: /medication|illness|surgery|medical condition/i, path: `${CONDITION_BASE}/immune-ai-lite.png`, code: "medical_domain" },
];

const NEUTRAL_PATH = `${BASE}/neutral_clinical_context.svg`;

export function clinicalOptionCodeForLabel(label: string): string {
  const alias = ALIASES.find(({ pattern }) => pattern.test(label));
  if (alias) return alias.optionCode;
  return label
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "clinical_context";
}

export function resolveClinicalOptionAsset(input: { optionCode?: string | null; label: string }): ResolvedClinicalOptionAsset {
  const aliasCode = clinicalOptionCodeForLabel(input.label);
  const optionCode = input.optionCode && CLINICAL_OPTION_ASSETS[input.optionCode] ? input.optionCode : aliasCode;
  const entry = CLINICAL_OPTION_ASSETS[optionCode] ?? null;
  if (entry) {
    const useExact = entry.status === "exact";
    return {
      optionCode,
      label: input.label,
      status: entry.status,
      registryEntry: entry,
      asset: {
        key: `CLINICAL_OPTION_${optionCode.toUpperCase()}`,
        src: useExact ? entry.assetPath : entry.domainFallbackPath,
        alt: entry.altText,
      },
    };
  }

  const domain = DOMAIN_FALLBACKS.find(({ pattern }) => pattern.test(input.label));
  return {
    optionCode,
    label: input.label,
    status: "fallback",
    registryEntry: null,
    asset: {
      key: `CLINICAL_OPTION_${(domain?.code ?? "NEUTRAL").toUpperCase()}`,
      src: domain?.path ?? NEUTRAL_PATH,
      alt: `${input.label} clinical context illustration`,
    },
  };
}

export function isClinicalOptionExcluded(label: string): boolean {
  return /^(?:none(?: of the above)?|normal scalp|not applicable|not sure|no (?:gut issues|chronic conditions|heat or chemical treatments)|none \/ not tested)$/i.test(label.trim());
}
