/* ===========================================================================
   ONE-PAGE CARE-PLAN CLINICAL COPY — SINGLE SOURCE OF TRUTH
   ===========================================================================

   Owns the two patient-facing copy columns of the "HOW YOUR FACTORS MAP TO
   YOUR CARE PLAN" band:

     CLINICAL MEANING          → clinicalMeaningForKit()
     HOW THIS SUPPORT WILL HELP → supportBenefitsForKit()

   Content is derived from two approved clinical documents:
     • Dr. FACT One-Pager — Clinical-to-Kit Content Master
     • Kit definition master (approved kit purposes)

   ── Copy rules enforced by tests/reports/clinical-meaning-copy.test.ts ──────

   CLINICAL MEANING
     1. 18–32 words. One combined explanation, never two source paragraphs
        pasted together.
     2. States ONE primary mechanism and at most two contributing mechanisms.
     3. Hedged language only ("may", "can", "is consistent with") — the
        one-pager never asserts a confirmed cause.
     4. Must never name a factor the patient did not report. Variants are
        gated on the trigger chips the row actually displays, so a row
        showing "Redness + Recurrent acne" can never explain smoking.

   HOW THIS SUPPORT WILL HELP
     5. 1–2 lines, 8–14 words each, expressing the kit's purpose only.
     6. MUST NOT repeat the trigger list — that is the first column's job
        (Content Master §1 and §2.6). The kit's purpose is what earns this
        column's space.

   Both rules are machine-checked; see the invariant tests.
   =========================================================================== */

export type KitCopyFamily =
  | "phenotype_inflammation"
  | "oxidative_stress"
  | "meta_b"
  | "meta_b_pcos"
  | "meta_b_hypothyroid"
  | "meta_b_menopause"
  | "thyroid_care"
  | "hypothyroid_post_m3"
  | "te_gold"
  | "iron_up"
  | "gi_gold"
  | "pro_immune"
  | "alopecia_areata"
  | "fphl"
  | "mphl"
  | "hbr"
  | "ttm"
  | "night_shift"
  | "frequent_flyers"
  | "peri_menopause"
  | "hysterectomy"
  | "lactihealth"
  | "healthy_9"
  | "rwl_shield"
  | "fh_well_3"
  | "early_greying";

/**
 * A meaning variant fires only when the row's displayed trigger chips match.
 * `all` requires every pattern (used for genuinely combined presentations,
 * e.g. scalp inflammation AND an oxidative-lifestyle factor); `when` requires
 * the single pattern. Variants are evaluated in order — most specific first.
 */
type MeaningVariant = { all?: RegExp[]; when?: RegExp; text: string };

type KitCopy = {
  /** Neutral combined meaning. Never names a specific patient factor. */
  meaning: string;
  /** Trigger-gated variants, most specific first. */
  variants?: MeaningVariant[];
  /** Kit purpose from the approved kit definition. Max 2 lines. */
  support: readonly [string] | readonly [string, string];
};

// ── Shared trigger-group patterns ───────────────────────────────────────────
// Grouped so a "combined" variant can require two distinct mechanism families
// rather than two chips from the same family (Dandruff + Itching is one
// mechanism, not two).
const SCALP_INFLAMMATION =
  /redness|burning|irritation|boil|folliculitis|psoriasis|dandruff|flake|seborr|itch|oily scalp|dry scalp/i;
const OXIDATIVE_LIFESTYLE = /alcohol|smok|vaping/i;
const SKIN_INFLAMMATION = /acne|skin rash|eczema/i;

export const KIT_CLINICAL_COPY: Record<KitCopyFamily, KitCopy> = {
  // ── E. Immune and inflammatory support ────────────────────────────────────
  phenotype_inflammation: {
    meaning:
      "Combined inflammatory and oxidative stress may create an unfavourable follicular environment, slowing cellular repair and reducing normal hair-growth activity.",
    variants: [
      {
        // Scalp signs AND an oxidative-lifestyle factor — the genuinely
        // combined presentation from the Content Master worked example.
        all: [SCALP_INFLAMMATION, OXIDATIVE_LIFESTYLE],
        text: "Scalp inflammation together with oxidative load may create an unfavourable follicular environment, slowing cellular repair and holding back normal hair-growth activity.",
      },
      {
        when: /redness|burning|irritation|boil|folliculitis/i,
        text: "Active scalp inflammation alters the tissue environment around the follicle, and sustained inflammatory pressure may slow cellular repair and normal hair-cycle activity.",
      },
      {
        when: /dandruff|flake|seborr|oily scalp|itch/i,
        text: "Sebum and flaking can support microbial overgrowth that raises scalp inflammation and oxidative stress, leaving an environment in which the hair cycle recovers slowly.",
      },
      {
        when: /psoriasis/i,
        text: "Chronic scalp psoriasis raises the local and systemic inflammatory load, which may disturb the follicular environment and slow the return to normal hair-growth activity.",
      },
      {
        when: /alcohol/i,
        text: "Regular alcohol intake may raise oxidative and hepatic load while reducing nutrient absorption, leaving a follicular environment that repairs and recovers more slowly.",
      },
      {
        when: /smok|vaping/i,
        text: "Smoking or vaping raises oxidative load and narrows scalp vessels, which can reduce follicular oxygenation and slow the cellular repair hair growth depends on.",
      },
      {
        when: SKIN_INFLAMMATION,
        text: "Recurrent skin inflammation reflects a sebaceous-follicular inflammatory pattern that can extend to the scalp and reduce the environment's support for hair growth.",
      },
      {
        when: /dry scalp/i,
        text: "Chronic perifollicular inflammation can reduce sebaceous support at the follicle opening, leaving a dry, reactive scalp that slows normal hair-cycle recovery.",
      },
    ],
    support: [
      "Counters inflammatory mediators and the oxidative stress driving them",
      "Repairs cellular damage and restores normal function for hair growth",
    ],
  },

  oxidative_stress: {
    meaning:
      "Free radicals and metabolic by-products may overwhelm natural antioxidant defences, reducing the efficiency of cellular metabolism and repair around the follicle.",
    support: [
      "Neutralises free radicals and the metabolic by-products generating oxidative stress",
      "Restores antioxidant systems and cellular metabolism to support hair growth",
    ],
  },

  pro_immune: {
    meaning:
      "Altered or weakened immune activity may raise inflammatory stress and impair the cellular environment the follicle depends on for healthy recovery.",
    variants: [
      {
        when: /areata|autoimmune/i,
        text: "Autoimmune activity directed at the follicle can restrict the active growth phase, and broader immune support helps ease inflammatory pressure on surrounding follicles.",
      },
      {
        when: /mouth ulcer|tongue ulcer|\bulcer\b/i,
        text: "Recurrent mouth or tongue ulcers may reflect immune inflammation and micronutrient strain that can extend to the follicle and compromise hair growth.",
      },
      {
        when: SKIN_INFLAMMATION,
        text: "Recurrent skin inflammation suggests an altered immune response that can extend to the follicle, raising inflammatory pressure and impairing normal hair growth.",
      },
      {
        when: /allerg|asthma/i,
        text: "Allergy or asthma indicates an overactive immune response that may extend to the follicle, adding inflammatory load and compromising normal hair growth.",
      },
      {
        when: /infection|frequent/i,
        text: "Frequent infections may indicate inflammation and reduced immune reserve that can extend to the follicle and compromise the conditions needed for growth.",
      },
    ],
    support: [
      "Builds immunity and repairs cellular damage from altered immune response",
      "Improves cellular metabolism and supports normal hair growth",
    ],
  },

  alopecia_areata: {
    meaning:
      "Loss of immune privilege at the follicle can drive a localised autoimmune response that restricts the active growth phase in the affected patches.",
    support: [
      "Counters the autoimmune response and builds immune balance",
      "Repairs cellular damage and supports new hair growth",
    ],
  },

  // ── D. Metabolic, thyroid and hormonal support ────────────────────────────
  meta_b: {
    meaning:
      "Insulin resistance and metabolic slowdown may raise oxidative and inflammatory stress, reducing the energy follicles use for normal growth and recovery.",
    variants: [
      {
        all: [/hypothyroid/i, /obes|weight|sedentary/i],
        text: "Hypothyroidism with difficulty managing weight may reflect slower metabolic activity, reducing the follicular energy supply and delaying the hair cycle's recovery.",
      },
      {
        when: /hypothyroid/i,
        text: "Thyroid-related metabolic slowing may reduce the energy available to the hair cycle, while added oxidative and inflammatory stress delays follicular recovery.",
      },
      {
        when: /pcos|pcod|pmos/i,
        text: "PCOS combines hormonal imbalance, insulin resistance and inflammation, which together may accelerate follicular miniaturisation and slow the return to active growth.",
      },
      {
        when: /diabet|insulin/i,
        text: "Insulin resistance and metabolic dysregulation may raise oxidative and inflammatory stress, reducing the follicular energy supply and slowing the hair cycle.",
      },
      {
        when: /obes|weight|sedentary/i,
        text: "Metabolic strain from weight or activity levels may slow cellular metabolism and reduce the energy delivered to follicles, blunting the hair-cycle response.",
      },
      {
        when: /genetic|family history|polygenic/i,
        text: "Pattern hair loss is polygenic, and the inherited genes can also carry impaired amino-acid and lipid metabolism with insulin resistance that dysregulates hair growth.",
      },
    ],
    support: [
      "Improves insulin sensitivity and restores efficient cellular metabolism",
      "Helps reduce the oxidative stress and inflammation affecting growth",
    ],
  },

  meta_b_pcos: {
    meaning:
      "PCOS combines hormonal imbalance, insulin resistance, inflammation and oxidative stress, which together may worsen follicular miniaturisation and increase visible shedding.",
    support: [
      "Addresses hormonal imbalance and improves insulin sensitivity in PCOS",
      "Counters inflammation to restore efficient cellular metabolism and growth",
    ],
  },

  meta_b_hypothyroid: {
    meaning:
      "Thyroid dysfunction may impair metabolism and hair-cycle activity while raising oxidative and inflammatory stress in the environment surrounding the follicle.",
    support: [
      "Supports thyroid-related metabolism and restores efficient cellular function",
      "Helps reduce the inflammation and oxidative stress affecting growth",
    ],
  },

  meta_b_menopause: {
    meaning:
      "Declining estrogen may leave a relative androgen excess with metabolic slowdown and inflammatory tendency, making pattern-sensitive follicles more vulnerable and recovery less efficient.",
    support: [
      "Supports the hormonal and metabolic transition through menopause",
      "Helps control inflammation while protecting androgen-sensitive follicles from further stress",
    ],
  },

  thyroid_care: {
    meaning:
      "Thyroid imbalance directly disturbs hair-cycle regulation and can create metabolic and nutritional strain that slows the follicle's return to active growth.",
    support: [
      "Provides nutritional support for thyroid function and cellular metabolism",
      "Helps reduce oxidative stress and counter inflammation affecting growth",
    ],
  },

  hypothyroid_post_m3: {
    meaning:
      "Thyroid-related metabolic slowing and menopausal hormonal change may jointly reduce hair-cycle activity and increase inflammatory and androgen-related stress on the follicle.",
    support: [
      "Provides nutritional support for thyroid function and menopausal metabolic needs",
      "Helps control inflammation while protecting androgen-sensitive follicles from further stress",
    ],
  },

  peri_menopause: {
    meaning:
      "Declining estrogen may create a relative androgen excess with metabolic slowdown and a greater inflammatory tendency, making follicular recovery less efficient.",
    support: [
      "Supports the hormonal and metabolic transition of perimenopause",
      "Helps control inflammation while protecting androgen-sensitive follicles from further stress",
    ],
  },

  hysterectomy: {
    meaning:
      "Hormonal change after hysterectomy or during hormone-replacement may disturb the hair cycle for several months while the body's healing demands stay elevated.",
    support: [
      "Supports the body's raised healing and nutritional demands",
      "Maintains nutrient availability for hair, skin and tissue repair",
    ],
  },

  fh_well_3: {
    meaning:
      "Combined hormonal, immune and inflammatory activity may promote fibrotic stress and create an environment that is less supportive of follicular recovery.",
    support: [
      "Addresses hormonal imbalance while countering inflammation and immune response",
      "Helps protect the follicle from fibrosis-related cellular stress",
    ],
  },

  rwl_shield: {
    meaning:
      "Sudden calorie and nutrient restriction can suppress cellular metabolism and push a larger number of follicles into premature shedding.",
    variants: [
      {
        when: /glp|semaglutide|tirzepatide|ozempic|wegovy|mounjaro/i,
        text: "GLP-1 therapy slows gastric emptying and shifts gut function, and the resulting nutrient deficit may push more follicles into premature shedding.",
      },
    ],
    support: [
      "Addresses the nutritional deficit and metabolic suppression during weight loss",
      "Supports follicular recovery while weight reduction safely continues",
    ],
  },

  // ── A. Shedding and pattern support ───────────────────────────────────────
  te_gold: {
    meaning:
      "Physical, emotional or nutritional stress may shift more follicles into the resting phase, causing diffuse shedding and slower re-entry into active growth.",
    variants: [
      {
        when: /stress|anxiet|depress/i,
        text: "Stress raises cortisol and neuroendocrine mediators while increasing nutrient demand, which may shift more follicles into the resting phase and increase shedding.",
      },
      {
        when: /illness|surgery|medication/i,
        text: "Illness, surgery or prolonged medication diverts nutrients towards healing and recovery, which may leave follicles without the resources to sustain active growth.",
      },
      {
        when: /crash|rapid weight|fasting/i,
        text: "Sudden calorie restriction and acute nutrient shortage can arrest active growth, shifting a larger wave of follicles into the resting phase.",
      },
    ],
    support: [
      "Addresses the follicular stress and weakness causing telogen effluvium",
      "Also protects follicles carrying androgen sensitivity during the recovery phase",
    ],
  },

  fphl: {
    meaning:
      "The pattern suggests progressive miniaturisation of hormone-sensitive follicles, with perifollicular inflammation reducing density across the mid-scalp and temporal areas.",
    support: [
      "Addresses perifollicular inflammation and counters the underlying hormonal imbalance",
      "Supports growth and protects pattern-sensitive follicles from further miniaturisation",
    ],
  },

  mphl: {
    meaning:
      "The distribution of thinning is consistent with progressive miniaturisation of androgen-sensitive follicles, with perifollicular inflammation and hormonal factors reducing normal growth activity.",
    support: [
      "Addresses perifollicular inflammation and counters the underlying hormonal imbalance",
      "Supports growth and protects androgen-sensitive follicles from further miniaturisation",
    ],
  },

  // ── B. Hair-shaft and localised support ───────────────────────────────────
  hbr: {
    meaning:
      "Damage to the cuticle and hair shaft is causing breakage and reduced hair quality, while the underlying root structure may remain capable of growth.",
    support: [
      "Strengthens the hair shaft and improves overall hair quality",
      "Supports cellular metabolism and protects follicles carrying androgen sensitivity",
    ],
  },

  ttm: {
    meaning:
      "Repeated compulsive pulling can mechanically damage growing hairs and stress the affected follicles, interrupting recovery across the areas that are pulled.",
    support: [
      "Provides nutrients reported to benefit OCD and cellular metabolism",
      "Complements, but does not replace, behavioural or medical management",
    ],
  },

  // ── C. Circadian and travel-related support ───────────────────────────────
  night_shift: {
    meaning:
      "Circadian disruption can disturb endocrine timing, cellular metabolism and nutritional regularity, weakening the conditions the hair cycle needs for consistent growth.",
    support: [
      "Counters the circadian, stress, hormonal and nutritional strain involved",
      "Supports oxidative balance and protects follicles carrying androgen sensitivity",
    ],
  },

  frequent_flyers: {
    meaning:
      "Repeated travel may combine circadian disruption, work stress, irregular nutrition and oxidative strain, which together disturb normal hair-cycle activity.",
    support: [
      "Counters travel-related stress with hormonal and nutritional irregularity",
      "Supports oxidative balance and protects follicles carrying androgen sensitivity",
    ],
  },

  // ── F. Deficiency, pregnancy, lactation and gut support ───────────────────
  iron_up: {
    meaning:
      "Low iron stores can reduce follicular oxygenation and interfere with DNA repair and thyroid-hormone conversion, directly disrupting normal hair-cycle activity.",
    variants: [
      {
        when: /heavy bleed|menorrhag|menstrual/i,
        text: "Heavy menstrual bleeding causes ongoing iron and ferritin depletion, and low iron stores can directly arrest the hair cycle and reduce follicular oxygenation.",
      },
    ],
    support: [
      "Improves absorption, assimilation and biological utilisation of iron",
      "Delivers that iron support without causing gastric discomfort",
    ],
  },

  gi_gold: {
    meaning:
      "Impaired digestion, dysbiosis or a weakened gut barrier may reduce nutrient absorption and raise inflammatory and oxidative stress that slows hair recovery.",
    variants: [
      {
        when: /gerd|acid reflux|acidity|heartburn/i,
        text: "Acid reflux is associated with gastritis and inflammation that may impair digestion, reducing the nutrients absorbed and available to sustain the hair cycle.",
      },
      {
        when: /ibs|crohn|leaky/i,
        text: "Gut microbial toxins and inflammatory mediators may cross a weakened intestinal barrier into circulation, raising inflammation and altering the follicle's tissue response.",
      },
    ],
    support: [
      "Improves digestion, epithelial integrity and gut microbial balance",
      "Helps reduce stress-mediated, inflammatory and oxidative cellular damage",
    ],
  },

  healthy_9: {
    meaning:
      "Pregnancy raises metabolic and nutritional requirements, which can reduce the nutrients available to sustain normal hair-cycle activity through the pregnancy.",
    support: [
      "Supports the raised metabolic and nutritional requirement of pregnancy",
      "Maintains the cellular environment for maternal health and hair growth",
    ],
  },

  lactihealth: {
    meaning:
      "Lactation increases maternal nutrient demand by priority, which may leave fewer nutrients available to sustain the active hair-growth cycle.",
    support: [
      "Supports the nutritional requirements of maternal health and lactation",
      "Neutralises the factors causing hair loss and promotes growth",
    ],
  },

  // ── G. Pigmentation support ───────────────────────────────────────────────
  early_greying: {
    meaning:
      "Accumulated oxidative stress and premature melanocyte exhaustion may reduce pigment production earlier than expected, alongside their effect on follicular growth.",
    support: [
      "Counters the free-radical and cellular-toxin accumulation driving premature ageing",
      "Restores active melanocyte and cellular function in the follicle",
    ],
  },
};

/**
 * Kit identity → copy family. Ordering is load-bearing: every variant kit
 * (Meta B PCOS, Meta B Hypothyroid, …) must be tested before its base family,
 * and named-condition kits before the mechanism kits they overlap with.
 */
export function resolveKitCopyFamily(kitCode: string, name: string): KitCopyFamily | null {
  const text = `${kitCode} ${name}`.toUpperCase().replace(/_/g, " ");

  if (/PHENOTYPE.*INFLAM/.test(text)) return "phenotype_inflammation";
  if (/OXIDATIVE STRESS/.test(text)) return "oxidative_stress";
  if (/ALOPECIA AREATA/.test(text)) return "alopecia_areata";
  if (/PRO IMMUNE/.test(text)) return "pro_immune";

  if (/HYPOTHYROID POST M/.test(text)) return "hypothyroid_post_m3";
  if (/META\s?-?\s?B.*PCOS/.test(text)) return "meta_b_pcos";
  if (/META\s?-?\s?B.*(HYPOTHYROID|THYROID)/.test(text)) return "meta_b_hypothyroid";
  if (/META\s?-?\s?B.*(POST|MENOPAUSE)/.test(text)) return "meta_b_menopause";
  if (/META\s?-?\s?B/.test(text)) return "meta_b";
  if (/THYROID CARE|HYPERTHYROID/.test(text)) return "thyroid_care";

  if (/PERI\s?-?\s?MENOPAUSE/.test(text)) return "peri_menopause";
  if (/POST\s?-?\s?HYSTERECTOMY|HYSTERECTOMY|\bHRT\b/.test(text)) return "hysterectomy";
  if (/FH WELL 3|ENDOMETRIOSIS/.test(text)) return "fh_well_3";
  if (/RAPID WEIGHT|\bRWL\b/.test(text)) return "rwl_shield";

  if (/TE GOLD|TELOGEN/.test(text)) return "te_gold";
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "fphl";
  if (/\bMPHL\b|MALE PATTERN/.test(text)) return "mphl";
  if (/\bHBR\b|BREAKAGE/.test(text)) return "hbr";
  if (/\bTTM\b|TRICHOTILLO/.test(text)) return "ttm";

  if (/NIGHT SHIFT/.test(text)) return "night_shift";
  if (/FREQUENT FLY/.test(text)) return "frequent_flyers";

  if (/IRON UP/.test(text)) return "iron_up";
  if (/GI GOLD/.test(text)) return "gi_gold";
  if (/HEALTHY\s?-?\s?9|PREGNANCY/.test(text)) return "healthy_9";
  if (/LACTI/.test(text)) return "lactihealth";
  if (/EARLY GREYING/.test(text)) return "early_greying";

  return null;
}

function matchesVariant(variant: MeaningVariant, triggerBag: string): boolean {
  if (variant.all && !variant.all.every((pattern) => pattern.test(triggerBag))) return false;
  if (variant.when && !variant.when.test(triggerBag)) return false;
  return Boolean(variant.all || variant.when);
}

/**
 * CLINICAL MEANING for one care-plan row.
 *
 * `triggers` MUST be the chips the row actually renders — not the full linked-
 * driver bag. A variant can only fire on a factor the patient can see, which
 * is what prevents the column asserting a driver that never reached the row.
 *
 * `patientInterpretation` (the clinical engine's per-signal line) is used only
 * when the kit has no entry in the registry. The engine's rows are written in
 * clinician voice and routinely exceed the 18–32-word patient-facing budget,
 * so they cannot lead this column; the registry variants carry the same
 * patient specificity in the approved voice.
 */
export function clinicalMeaningForKit(input: {
  kitCode: string;
  name: string;
  triggers: readonly string[];
  patientInterpretation?: string | null;
}): string | null {
  const family = resolveKitCopyFamily(input.kitCode, input.name);
  if (!family) return null;
  const copy = KIT_CLINICAL_COPY[family];
  const triggerBag = input.triggers.join(" ");
  const variant = copy.variants?.find((candidate) => matchesVariant(candidate, triggerBag));
  return variant?.text ?? copy.meaning;
}

/** HOW THIS SUPPORT WILL HELP — the kit's purpose, never the trigger list. */
export function supportBenefitsForKit(kitCode: string, name: string): string[] | null {
  const family = resolveKitCopyFamily(kitCode, name);
  if (!family) return null;
  return [...KIT_CLINICAL_COPY[family].support];
}
