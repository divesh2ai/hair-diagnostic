/**
 * Clinical Insight & Recovery Story builder — FINAL PRODUCTION SPECIFICATION.
 *
 * Four sections, generated from a deterministic driver model:
 *
 *   Selected Conditions → Biological Drivers → Hair Impact → Treatment Goals
 *                       → Narrative
 *
 * Hard rules baked in:
 *  - HairOS is NOT diagnosing / assessing / measuring / grading. Voice uses
 *    "Based on the information you shared with us…", not "Assessment shows…".
 *  - 2–5 drivers per story. Driver tiers are used internally to rank only
 *    and never displayed.
 *  - Section 3 includes the canonical personalisation statement.
 *  - Section 4 is structured Stabilisation → Recovery → Resilience; phase
 *    names are never displayed.
 *  - No timelines, no regrowth promises, no ingredient / kit / product
 *    vocabulary, no assessment / diagnosis language.
 */

import type { PatientAnswers, RootCause } from "../../types";
import type { ClinicalProfile } from "../clinical-engine/types";
import type { KitRecommendation } from "../kit-scorer/types";
import type {
  ClinicalInsightStory,
  InsightDriver,
  RootCauseAnalysis,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Driver model
//
// Each driver carries: label, hairImpact, treatmentGoal, recognitionCue.
// Driver labels are stable, patient-facing strings.
// ─────────────────────────────────────────────────────────────────────────────

type DriverKey =
  | "HORMONAL_METABOLIC"
  | "NUTRITIONAL"
  | "STRESS_SHEDDING"
  | "SCALP_INFLAMMATION"
  | "GENETIC_PATTERN"
  | "POST_ILLNESS_MEDICATION"
  | "IMMUNE_FACTORS"
  | "OXIDATIVE_STRESS"
  | "GUT_DISRUPTION"
  | "CIRCADIAN_DISRUPTION"
  | "GENERAL_INFLUENCES";

const DRIVER_CATALOG: Record<DriverKey, InsightDriver> = {
  HORMONAL_METABOLIC: {
    label: "Hormonal & Metabolic Factors",
    hairImpact: "Can disrupt normal follicle signalling and shorten healthy growth cycles.",
    treatmentGoal: "Support hormonal and metabolic balance.",
    recognitionCue: "Persistent shedding, reduced volume, and progressive thinning.",
  },
  NUTRITIONAL: {
    label: "Nutritional Deficiency",
    hairImpact: "Reduces the resources required for healthy follicle function.",
    treatmentGoal: "Restore nutritional support for hair growth.",
    recognitionCue: "Increased shedding, weaker hair quality, and slower recovery.",
  },
  STRESS_SHEDDING: {
    label: "Stress-Related Shedding",
    hairImpact: "Can push more follicles into the shedding phase.",
    treatmentGoal: "Support follicle recovery and reduce ongoing shedding triggers.",
    recognitionCue: "Sudden increase in hair fall during periods of stress.",
  },
  SCALP_INFLAMMATION: {
    label: "Scalp Inflammation",
    hairImpact: "Creates a less supportive environment for healthy hair growth.",
    treatmentGoal: "Improve scalp health and reduce inflammatory burden.",
    recognitionCue: "Itching, dandruff, oiliness, or scalp discomfort.",
  },
  GENETIC_PATTERN: {
    label: "Genetic & Androgen-Driven Pattern Hair Loss",
    hairImpact: "Increases follicle sensitivity and may contribute to gradual thinning.",
    treatmentGoal: "Support long-term follicle resilience.",
    recognitionCue: "Family history and progressive reduction in density.",
  },
  POST_ILLNESS_MEDICATION: {
    label: "Post-Illness or Medication Recovery",
    hairImpact: "Temporary disruption of the normal hair growth cycle.",
    treatmentGoal: "Support recovery and normal follicle cycling.",
    recognitionCue: "Hair fall following illness, surgery, medication, or physiological stress.",
  },
  IMMUNE_FACTORS: {
    label: "Immune-Related Factors",
    hairImpact: "Can disturb the follicle's natural growth environment.",
    treatmentGoal: "Support balanced immune activity around the follicle.",
    recognitionCue: "Patchy hair loss or autoimmune patterns reported elsewhere.",
  },
  OXIDATIVE_STRESS: {
    label: "Oxidative Stress",
    hairImpact: "Gradually wears down the follicle environment over time.",
    treatmentGoal: "Reduce oxidative load and protect the follicle.",
    recognitionCue: "Smoking, alcohol, or chronic environmental exposure.",
  },
  GUT_DISRUPTION: {
    label: "Gut-Health Disruption",
    hairImpact: "Limits the nutrients reaching the follicle.",
    treatmentGoal: "Restore steady nutrient absorption.",
    recognitionCue: "Digestive symptoms reported alongside hair changes.",
  },
  CIRCADIAN_DISRUPTION: {
    label: "Circadian Disruption",
    hairImpact: "Reduces the body's overnight recovery time for the follicle.",
    treatmentGoal: "Support circadian rhythm and overnight follicle recovery.",
    recognitionCue: "Night-shift work, frequent travel, or chronic sleep disruption.",
  },
  GENERAL_INFLUENCES: {
    label: "General Lifestyle & Environmental Factors",
    hairImpact: "Can subtly influence the conditions follicles rely on for healthy growth.",
    treatmentGoal: "Support overall hair and scalp wellbeing.",
    recognitionCue: "Gradual hair changes without a single clear trigger.",
  },
};

/** Convert an imperative treatment goal ("Support X and reduce Y.") to gerund
 *  form ("supporting X and reducing Y") for fluent in-sentence use in section 3.
 *  Handles both the leading verb and any "and <verb>" mid-phrase. */
function gerundizeGoal(goal: string): string {
  const cleaned = goal.replace(/\.$/, "").trim();
  const verbMap: Record<string, string> = {
    Support: "supporting",
    Restore: "restoring",
    Improve: "improving",
    Reduce: "reducing",
    Protect: "protecting",
    Stabilise: "stabilising",
    Stabilize: "stabilizing",
  };
  let result = cleaned;
  for (const [verb, gerund] of Object.entries(verbMap)) {
    if (result.startsWith(verb + " ")) {
      result = gerund + result.slice(verb.length);
      break;
    }
  }
  for (const [verb, gerund] of Object.entries(verbMap)) {
    const re = new RegExp(`\\band ${verb.toLowerCase()}\\b`, "g");
    result = result.replace(re, `and ${gerund}`);
  }
  return result;
}

// Internal tier — never exposed in output.
type DriverTier = "primary" | "secondary" | "contributing";

const TIER_RANK: Record<DriverTier, number> = {
  primary: 3,
  secondary: 2,
  contributing: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Root cause → driver key mapping (multi-cause merges go to the same driver)
// ─────────────────────────────────────────────────────────────────────────────

const ROOT_CAUSE_TO_DRIVER: Record<RootCause, DriverKey> = {
  DHT:                  "GENETIC_PATTERN",
  GENETICS:             "GENETIC_PATTERN",

  PCOS:                 "HORMONAL_METABOLIC",
  HYPOTHYROID:          "HORMONAL_METABOLIC",
  HYPERTHYROID:         "HORMONAL_METABOLIC",
  POST_PARTUM:          "HORMONAL_METABOLIC",
  HORMONAL_SHIFT:       "HORMONAL_METABOLIC",
  METABOLIC:            "HORMONAL_METABOLIC",

  IRON_DEFICIENCY:      "NUTRITIONAL",
  POOR_NUTRITION:       "NUTRITIONAL",
  RAPID_WEIGHT_LOSS:    "NUTRITIONAL",

  STRESS:               "STRESS_SHEDDING",

  AUTOIMMUNE:           "IMMUNE_FACTORS",
  OXIDATIVE_STRESS:     "OXIDATIVE_STRESS",
  GUT_MALABSORPTION:    "GUT_DISRUPTION",

  ILLNESS:              "POST_ILLNESS_MEDICATION",
  MEDICATION:           "POST_ILLNESS_MEDICATION",

  CIRCADIAN_DISRUPTION: "CIRCADIAN_DISRUPTION",
  TRICHOTILLOMANIA:     "STRESS_SHEDDING",
};

const SCALP_SIGNAL = /dandruff|flak|oily|seborrh|itch|redness|burning|irritat|boils|folliculitis|psoriasis|dry scalp/i;

// ─────────────────────────────────────────────────────────────────────────────
// Driver detection & tier ranking (internal)
// ─────────────────────────────────────────────────────────────────────────────

interface RankedDriver {
  key: DriverKey;
  driver: InsightDriver;
  tier: DriverTier;
  weight: number;
}

function detectDrivers(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
  ans: PatientAnswers,
): RankedDriver[] {
  // Accumulate weight per driver key. Multiple supporting signals raise the
  // weight, which decides tier (primary / secondary / contributing).
  const weights = new Map<DriverKey, number>();

  // Root causes feed directly.
  for (const rc of clinical.rootCauses ?? []) {
    const key = ROOT_CAUSE_TO_DRIVER[rc];
    if (!key) continue;
    weights.set(key, (weights.get(key) ?? 0) + 2);
  }

  // Primary root-cause analysis bucket bumps the driver further.
  for (const cond of analysis.primary ?? []) {
    const supporting = cond.supportingSignals?.length ?? 0;
    // The condition labels map loosely — only nudge for high-signal-count cases.
    if (supporting >= 2) {
      const cause = (clinical.rootCauses ?? []).find(
        (rc) => cond.condition.toLowerCase().includes(rc.toLowerCase().split("_")[0]),
      );
      if (cause) {
        const key = ROOT_CAUSE_TO_DRIVER[cause];
        if (key) weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }

  // Scalp signals → Scalp Inflammation.
  const scalpSignals = (ans.scalp ?? []).filter((s) => SCALP_SIGNAL.test(s));
  if (scalpSignals.length > 0) {
    const bonus = Math.min(scalpSignals.length, 3);
    weights.set("SCALP_INFLAMMATION", (weights.get("SCALP_INFLAMMATION") ?? 0) + bonus);
  }

  // Pattern hair loss diagnosis → Genetic & Androgen-Driven, even if rootCause
  // didn't carry DHT/GENETICS explicitly.
  if (clinical.primaryDiagnosis?.startsWith("AGA_")) {
    weights.set("GENETIC_PATTERN", (weights.get("GENETIC_PATTERN") ?? 0) + 2);
  }

  // Convert to ranked array.
  const sorted = [...weights.entries()].sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    // Neutral floor — never default to a leading attribution like stress.
    return [
      {
        key: "GENERAL_INFLUENCES",
        driver: DRIVER_CATALOG.GENERAL_INFLUENCES,
        tier: "primary",
        weight: 1,
      },
    ];
  }

  // Cap at 5 drivers.
  const capped = sorted.slice(0, 5);
  const topWeight = capped[0][1];

  return capped.map(([key, weight]) => {
    let tier: DriverTier;
    if (weight >= Math.max(topWeight, 3)) tier = "primary";
    else if (weight >= 2) tier = "secondary";
    else tier = "contributing";
    return { key, driver: DRIVER_CATALOG[key], tier, weight };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Friendly experience phrase tailored to the patient's active state.
function experiencePhrase(
  clinical: ClinicalProfile,
  ans: PatientAnswers,
  drivers: RankedDriver[],
): string {
  const active = !!clinical.flags?.hasActiveShedding;
  const scalp = (ans.scalp ?? []).filter((s) => SCALP_SIGNAL.test(s)).length > 0;
  const pattern =
    clinical.primaryDiagnosis?.startsWith("AGA_")
    || drivers.some((d) => d.key === "GENETIC_PATTERN");

  if (active && scalp) {
    return "ongoing hair fall together with scalp changes that haven't been settling on their own";
  }
  if (active && pattern) {
    return "ongoing shedding alongside a gradual change in hair density";
  }
  if (active) {
    return "more hair fall than usual and a sense that the hair has not been recovering";
  }
  if (pattern) {
    return "a steady change in hair density that has felt difficult to slow down";
  }
  if (scalp) {
    return "scalp changes that have made hair feel less supported than usual";
  }
  return "changes in your hair that have felt difficult to interrupt on their own";
}

// ─────────────────────────────────────────────────────────────────────────────
// Section composers
// ─────────────────────────────────────────────────────────────────────────────

/** Section 1 — YOUR HAIR STORY. Target 60–90 words. */
function composeYourHairStory(
  drivers: RankedDriver[],
  clinical: ClinicalProfile,
  ans: PatientAnswers,
): string {
  const labels = drivers.map((d) => d.driver.label);
  const exp = experiencePhrase(clinical, ans, drivers);

  if (drivers.length === 1) {
    const d = drivers[0];
    return (
      `Based on the information you shared with us, one pattern stands out as the dominant influence on your hair right now: ${d.driver.label}. ` +
      `This pattern is commonly associated with ${lowerFirst(d.driver.recognitionCue)} ` +
      `What you have described — ${exp} — fits that picture, and your plan was built around it as the thread to follow first.`
    );
  }

  const lead =
    drivers.length >= 4
      ? "Based on the information you shared with us, several factors appear to be influencing your hair at this time."
      : "Based on the information you shared with us, a few connected factors appear to be influencing your hair at this time.";

  return (
    `${lead} The strongest patterns point toward ${joinList(labels)}. ` +
    `Together, these are commonly associated with ${exp}. ` +
    `Each one plays a distinct role in how your hair grows, sheds and recovers, and your plan was built around the full picture rather than any single factor in isolation.`
  );
}

/** Section 2 — WHY THIS MAY BE HAPPENING. Target 80–120 words. */
function composeWhyThisMayBeHappening(
  drivers: RankedDriver[],
  clinical: ClinicalProfile,
): string {
  const active = !!clinical.flags?.hasActiveShedding;

  const lead =
    "Hair grows in cycles. When that rhythm is disturbed, follicles spend less time in their active growth phase and more time shedding or resting.";

  // Cap impact sentences at the top 2 drivers so we land inside 80–120 words.
  const topImpacts = drivers
    .slice(0, 2)
    .map((d) => `${d.driver.label} ${lowerFirst(d.driver.hairImpact)}`)
    .join(" ");

  const interplay =
    drivers.length >= 2
      ? " Because more than one of these is in play, they reinforce each other — making any single factor harder for your body to manage in isolation."
      : " Because this pattern touches more than one stage of the cycle, even small improvements here have a noticeable downstream effect on how your hair grows and recovers.";

  const visible = active
    ? " That is why you may be noticing more shedding than usual — the cycle has shifted, and follicles are leaving the growth phase faster than they are re-entering it."
    : " Even when shedding is not obvious day to day, this gradual drift slowly reduces hair quality, which is the pattern your plan is designed to interrupt.";

  return `${lead} ${topImpacts}${interplay}${visible}`;
}

/** Section 3 — WHY THIS PLAN WAS RECOMMENDED. Target 80–120 words. */
function composeWhyThisPlanWasRecommended(drivers: RankedDriver[]): string {
  const labels = drivers.map((d) => d.driver.label);
  const goalsGerund = dedupe(drivers.map((d) => gerundizeGoal(d.driver.treatmentGoal)));

  const personalisation =
    "Your recommendations were selected to address the factors highlighted in your responses rather than following a one-size-fits-all approach.";

  const bridge =
    drivers.length === 1
      ? ` Because the dominant pattern is ${labels[0]}, the plan focuses on ${joinList(goalsGerund)}.`
      : ` Because the picture involves ${joinList(labels)}, the plan focuses on ${joinList(goalsGerund)}.`;

  const middle =
    " Each part of the plan ties back to something specific you shared, so the support you receive is matched to the patterns most likely to be influencing your hair. The aim is to ease pressure on your follicles from several directions at once, so progress holds.";

  const finalPersonalisation =
    " In short, this plan reflects your specific picture rather than following a generic profile.";

  return personalisation + bridge + middle + finalPersonalisation;
}

/** Section 4 — WHAT TO EXPECT. Target 60–90 words.
 *  Internal structure: Stabilisation → Recovery → Resilience (phase names never shown).
 *  Five thematic variants keyed to the dominant driver. */
type ExpectationVariant =
  | "SHEDDING_RECOVERY"
  | "HORMONAL_BALANCE"
  | "SCALP_COMFORT"
  | "PATTERN_PROTECTION"
  | "MULTI_SYSTEM_RECOVERY";

function selectExpectationVariant(
  drivers: RankedDriver[],
  active: boolean,
): ExpectationVariant {
  const dominant = drivers[0]?.key;
  if (!dominant) return "SHEDDING_RECOVERY";

  // Shedding-led patient experience overrides any pattern dominance.
  if (
    active
    && (dominant === "STRESS_SHEDDING"
      || dominant === "NUTRITIONAL"
      || dominant === "POST_ILLNESS_MEDICATION")
  ) {
    return "SHEDDING_RECOVERY";
  }

  switch (dominant) {
    case "HORMONAL_METABOLIC":
      return "HORMONAL_BALANCE";
    case "SCALP_INFLAMMATION":
    case "OXIDATIVE_STRESS":
      return "SCALP_COMFORT";
    case "GENETIC_PATTERN":
      return active ? "SHEDDING_RECOVERY" : "PATTERN_PROTECTION";
    case "GUT_DISRUPTION":
    case "IMMUNE_FACTORS":
    case "CIRCADIAN_DISRUPTION":
      return "MULTI_SYSTEM_RECOVERY";
    case "STRESS_SHEDDING":
    case "NUTRITIONAL":
    case "POST_ILLNESS_MEDICATION":
      return "SHEDDING_RECOVERY";
    case "GENERAL_INFLUENCES":
    default:
      return "SHEDDING_RECOVERY";
  }
}

const EXPECTATION_VARIANTS: Record<ExpectationVariant, string> = {
  SHEDDING_RECOVERY:
    "Early on, most people notice their day-to-day shedding starts to settle and the scalp feels calmer than it had been."
    + " As the body responds, hair tends to feel stronger and the cycle settles back into a healthier rhythm."
    + " Over the longer term, the focus shifts to keeping that recovery stable — protecting the gains made and supporting healthier long-term growth."
    + " Progress is gradual and varies from person to person, which is normal and exactly why the plan is structured the way it is.",

  HORMONAL_BALANCE:
    "Early on, most people notice the cycle begins to feel more settled and the hair gradually feels stronger as the underlying balance is supported."
    + " As progress continues, existing hair tends to look healthier and the follicle environment becomes more stable."
    + " Over the longer term, the focus shifts to keeping that balance steady — protecting density and supporting healthier long-term growth."
    + " Improvement tends to build quietly rather than dramatically, which is normal and exactly why the plan is structured the way it is.",

  SCALP_COMFORT:
    "Early on, most people notice their scalp feels noticeably calmer and more comfortable as the environment around the follicles eases."
    + " As things progress, hair tends to feel stronger and the cycle has a better foundation to recover on."
    + " Over the longer term, the focus shifts to keeping that calmer scalp environment stable — protecting what you have and supporting healthier long-term growth."
    + " Improvement is gradual and depends on consistency, which is normal and exactly why the plan is structured the way it is.",

  PATTERN_PROTECTION:
    "Early on, most people notice the hair begins to feel a little stronger and the scalp environment becomes more supportive of healthy growth."
    + " As things progress, existing follicles tend to feel more stable and changes in density tend to slow."
    + " Over the longer term, the focus shifts to long-term resilience — protecting what you have and supporting healthier long-term growth."
    + " Pattern hair changes respond gradually rather than dramatically, which is normal and exactly why the plan is structured the way it is.",

  MULTI_SYSTEM_RECOVERY:
    "Early on, most people notice their day-to-day comfort and scalp feel steadier as the underlying systems begin to support hair growth more reliably."
    + " As things progress, hair tends to feel stronger and the follicle environment becomes more consistent."
    + " Over the longer term, the focus shifts to keeping those systems balanced — protecting what you have and supporting healthier long-term growth."
    + " Recovery is gradual and depends on consistency, which is normal and exactly why the plan is structured the way it is.",
};

function composeWhatToExpect(
  drivers: RankedDriver[],
  clinical: ClinicalProfile,
): string {
  const active = !!clinical.flags?.hasActiveShedding;
  const variant = selectExpectationVariant(drivers, active);
  return EXPECTATION_VARIANTS[variant];
}

// ─────────────────────────────────────────────────────────────────────────────
// Forbidden-vocabulary guard
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_TOKENS: RegExp[] = [
  // Assessment / diagnosis voice
  /\bassessment shows?\b/i,
  /\bwe found\b/i,
  /\bwe detected\b/i,
  /\bwe diagnosed\b/i,
  /\bclinical assessment indicates?\b/i,
  /\byour condition is\b/i,
  /\bdiagnosed\b/i,

  // Product / kit / supplement vocabulary
  /\bkits?\b/i,
  /\bprotocols?\b/i,
  /\bsupplements?\b/i,
  /\bingredients?\b/i,
  /\bformulations?\b/i,
  /\bproducts?\b/i,
  /\bpackages?\b/i,
  /\bbrands?\b/i,

  // AI / engine
  /\bAI\b/,
  /\balgorithms?\b/i,
  /\bscoring\b/i,

  // Marketing / promises
  /\bguarantee/i,
  /\bdiscount/i,
  /\boffer\b/i,
  /\bregrowth\b/i,
  /\bregrow\b/i,

  // Timelines
  /\bweeks?\b/i,
  /\bmonths?\b/i,

  // Internal tier labels (must never leak out)
  /\bprimary driver\b/i,
  /\bsecondary driver\b/i,
  /\bcontributing driver\b/i,

  // Product / kit family labels
  /\bhair\s*fact\b/i,
  /\bpro\s*immune\b/i,
  /\bpro\s*fact\b/i,
  /\bgi\s*gold\b/i,
  /\bmeta\s*b\b/i,
  /\bte\s*gold\b/i,
  /\bphenotype\s*inflam/i,
  /\bmphl\b/i,
  /\bfphl\b/i,

  // Common ingredient names
  /\bbiotin\b/i,
  /\bminoxidil\b/i,
  /\bfinasteride\b/i,
  /\bketoconazole\b/i,
  /\blactoferrin\b/i,
  /\bashwagandha\b/i,
  /\bcolostrum\b/i,
];

function assertNoForbidden(story: ClinicalInsightStory): void {
  const full = [
    story.yourHairStory,
    story.whyThisMayBeHappening,
    story.whyThisPlanWasRecommended,
    story.whatToExpect,
  ].join("\n");
  for (const re of FORBIDDEN_TOKENS) {
    const m = re.exec(full);
    if (m) {
      const msg = `[buildClinicalInsightStory] forbidden term in story: "${m[0]}"`;
      if (process.env.NODE_ENV === "production") {
        console.warn(msg);
      } else {
        throw new Error(msg);
      }
      return;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildClinicalInsightStory(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
  _kits: KitRecommendation,
  ans: PatientAnswers,
): ClinicalInsightStory {
  const ranked = detectDrivers(clinical, analysis, ans);
  // Sort by internal tier then weight; tier itself is never exposed in output.
  ranked.sort((a, b) => {
    const t = TIER_RANK[b.tier] - TIER_RANK[a.tier];
    return t !== 0 ? t : b.weight - a.weight;
  });

  const drivers = ranked.map((r) => r.driver);
  const treatmentGoals = dedupe(drivers.map((d) => d.treatmentGoal));

  const story: ClinicalInsightStory = {
    yourHairStory: composeYourHairStory(ranked, clinical, ans),
    whyThisMayBeHappening: composeWhyThisMayBeHappening(ranked, clinical),
    whyThisPlanWasRecommended: composeWhyThisPlanWasRecommended(ranked),
    whatToExpect: composeWhatToExpect(ranked, clinical),
    drivers,
    treatmentGoals,
  };

  assertNoForbidden(story);
  return story;
}
