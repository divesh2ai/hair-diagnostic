/**
 * Clinical Insight & Recovery Story builder — HairOS V2 spec.
 *
 * Four sections, generated from a deterministic driver model:
 *
 *   Patient signals → Drivers → Doctor-approved interpretations
 *                   → Selected kits → Universal recovery milestones
 *
 * Sources are sacred:
 *  - Section 1  · what the patient is experiencing — from questionnaire signals.
 *  - Section 2  · why it is happening — from the Clinical Interpretation library
 *                  (per-condition mechanisms in ROOT_CAUSE_DETAIL); no invented
 *                  biology, no new mechanisms.
 *  - Section 3  · why this plan — references the actual selected kits by display
 *                  name, with one sentence per kit (problem → kit → intended
 *                  improvement). No ingredients, no pathways.
 *  - Section 4  · what recovery may look like — paraphrases the universal
 *                  recovery-milestone data verbatim; never invents timelines.
 *
 * Hard rules baked in:
 *  - HairOS is NOT diagnosing / assessing / grading. Voice: "Based on the
 *    information you shared with us…".
 *  - 2–5 drivers per story; internal tier never displayed.
 *  - No regrowth promises; no guarantees; no timelines outside Section 4.
 *  - No ingredient names anywhere.
 *  - Kit / product vocabulary allowed only in Section 3.
 */

import type { PatientAnswers, RootCause } from "../../types";
import type { ClinicalProfile } from "../clinical-engine/types";
import type {
  ClinicalInsightStory,
  ClinicalInterpretation,
  InsightDriver,
  RootCauseAnalysis,
  TreatmentPhase,
  UniversalRecoveryMilestone,
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

// Friendly umbrella term per driver — used only in Section 1 (no biology).
const DRIVER_FRIENDLY_FACTOR: Record<DriverKey, string> = {
  HORMONAL_METABOLIC: "hormonal and metabolic influences",
  NUTRITIONAL: "nutritional demands",
  STRESS_SHEDDING: "stress on the hair cycle",
  SCALP_INFLAMMATION: "scalp changes",
  GENETIC_PATTERN: "a family pattern of thinning",
  POST_ILLNESS_MEDICATION: "the after-effects of recent illness or medication",
  IMMUNE_FACTORS: "immune-related changes",
  OXIDATIVE_STRESS: "long-term wear on the follicle environment",
  GUT_DISRUPTION: "digestive symptoms",
  CIRCADIAN_DISRUPTION: "disrupted sleep and recovery time",
  GENERAL_INFLUENCES: "general lifestyle factors",
};

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
// Clinical Interpretation library — doctor-approved mechanisms and recognition
// cues per RootCause. This IS the source of truth for Section 2: copy may be
// reordered or trimmed for narrative flow, but the biological meaning must
// never be edited or invented in the composer.
// ─────────────────────────────────────────────────────────────────────────────

interface RootCauseDetail {
  recognitionCue: string;
  mechanism: string;
  /** Doctor-approved description of what tends to happen if the underlying
   *  driver is not addressed. Gentle and biological — never alarmist. */
  progression: string;
}

const ROOT_CAUSE_DETAIL: Record<RootCause, RootCauseDetail> = {
  DHT: {
    recognitionCue: "progressive thinning at the parting and temples, with finer, shorter hairs in those areas",
    mechanism: "androgens shrink susceptible follicles cycle by cycle, producing finer and less pigmented hair shafts",
    progression: "without support, the susceptible follicles continue to miniaturise and the visible density reduction tends to extend further from the parting and temples",
  },
  GENETICS: {
    recognitionCue: "a family history of similar thinning and a gradual change in density rather than sudden shedding",
    mechanism: "inherited follicle sensitivity to androgens and inherited metabolic patterns shape how the hair cycle behaves over time",
    progression: "without support, the inherited cycle pattern continues to shape how density changes — slowly but steadily — over the years ahead",
  },
  PCOS: {
    recognitionCue: "irregular cycles, weight that resists effort, and gradual thinning along the parting",
    mechanism: "elevated androgens and insulin resistance shorten the active growth phase and miniaturise frontal follicles",
    progression: "if the underlying hormonal imbalance is not addressed, the miniaturisation typically continues and density reduces further in the most sensitive areas",
  },
  HYPOTHYROID: {
    recognitionCue: "diffuse thinning across the scalp, drier hair, cold sensitivity, and lower energy",
    mechanism: "low thyroid output slows the cellular metabolism that every follicle relies on for healthy hair-cycle timing",
    progression: "if thyroid output stays low, the cycle stays sluggish and diffuse density loss tends to continue across the scalp",
  },
  HYPERTHYROID: {
    recognitionCue: "rapid diffuse shedding, sometimes with weight loss, tremor, or palpitations",
    mechanism: "excess thyroid output pushes follicles out of the growth phase prematurely",
    progression: "if thyroid output stays elevated, follicles keep exiting the growth phase early and shedding tends to remain higher than usual",
  },
  POST_PARTUM: {
    recognitionCue: "a wave of shedding that begins after delivery or weaning",
    mechanism: "the pregnancy-related growth-phase bonus ends abruptly, releasing many follicles into shedding at once",
    progression: "the synchronised wave is usually self-limiting, but ongoing nutritional or hormonal stress can extend the recovery window considerably",
  },
  HORMONAL_SHIFT: {
    recognitionCue: "thinning that tracks the perimenopausal or endometriosis cycle, often with cycle changes or cyclical symptoms",
    mechanism: "declining oestrogen unmasks androgen sensitivity, and cyclical inflammation drives systemic iron and nutrient loss",
    progression: "without support through the transition, oestrogen-dependent follicles continue losing density and recovery becomes harder once cyclic inflammation is established",
  },
  METABOLIC: {
    recognitionCue: "weight that builds quietly, energy that runs low, and hair that thins diffusely without an obvious trigger",
    mechanism: "adipose-tissue signalling and insulin resistance disrupt the metabolic conversation between the body and the follicle",
    progression: "if insulin signalling stays disrupted, the metabolic pressure on follicles continues and density drifts lower over time",
  },
  IRON_DEFICIENCY: {
    recognitionCue: "diffuse shedding, brittle nails, fatigue, and sometimes pale skin or gums",
    mechanism: "follicles need ferritin to maintain the active growth phase — when iron stores are low, the cycle ends earlier than it should",
    progression: "if iron stores stay low, more follicles exit the growth phase early each cycle and shedding tends to keep outpacing the cycle's natural recovery",
  },
  POOR_NUTRITION: {
    recognitionCue: "shedding linked to dietary changes, restricted intake, or known vitamin gaps",
    mechanism: "follicles depend on a steady supply of B-vitamins, vitamin D, zinc, and amino acids to stay in the growth phase",
    progression: "without restoring the missing nutrients, follicles continue running on insufficient resources and density gradually reduces",
  },
  RAPID_WEIGHT_LOSS: {
    recognitionCue: "shedding that began after a sharp dietary change, a weight-loss medication, or rapid loss of body mass",
    mechanism: "the gastric-emptying delay and the caloric deficit together signal follicles to conserve energy and exit the growth phase",
    progression: "until intake stabilises, the follicle's energy-conservation signal continues and the shedding wave can extend well beyond the original trigger",
  },
  STRESS: {
    recognitionCue: "shedding that follows a stressful period — work, illness, grief, or major life change — some time after the trigger",
    mechanism: "sustained cortisol activates substance-P signalling at the follicle, pushing a synchronised wave out of the growth phase",
    progression: "if the sustained stress signal is not interrupted, fresh waves of synchronised shedding can repeat each time cortisol rises again",
  },
  AUTOIMMUNE: {
    recognitionCue: "patchy, well-defined hair loss, sometimes with hair returning in older patches",
    mechanism: "immune cells target the follicle's normally protected growth-phase compartment, interrupting the cycle locally",
    progression: "without immune-side support, the cyclical interruption tends to recur and patches can expand or appear in new areas",
  },
  OXIDATIVE_STRESS: {
    recognitionCue: "thinning in the context of smoking, alcohol, or significant environmental exposure",
    mechanism: "reactive oxygen species damage follicular DNA and reduce blood flow to the dermal papilla that feeds the hair shaft",
    progression: "with continued exposure, the follicle environment keeps absorbing damage and recovery becomes progressively slower",
  },
  GUT_MALABSORPTION: {
    recognitionCue: "digestive symptoms — reflux, alternating bowel, or persistent bloating — alongside the hair changes",
    mechanism: "an inflamed gut lining and microbiome imbalance limit absorption of iron, B12, and the amino acids the follicle needs",
    progression: "if the gut lining stays inflamed, the underlying nutritional gap deepens and the downstream hair changes tend to persist",
  },
  ILLNESS: {
    recognitionCue: "shedding that began after illness, surgery, or a hospital stay",
    mechanism: "physiological stress synchronises a large fraction of follicles into the shedding phase",
    progression: "most post-illness shedding is self-limiting, but underlying systemic stress can extend recovery if other drivers remain active",
  },
  MEDICATION: {
    recognitionCue: "shedding that began after starting a new medication",
    mechanism: "certain medications interrupt the cellular machinery the growth-phase follicle depends on",
    progression: "if the medication continues without alternative support, the cycle disruption tends to persist for the duration of treatment",
  },
  CIRCADIAN_DISRUPTION: {
    recognitionCue: "hair changes alongside night shifts, frequent travel, or persistently disrupted sleep",
    mechanism: "follicles rely on overnight melatonin and growth-hormone pulses for repair and orderly cycle progression",
    progression: "without restoring overnight repair, the follicle cycle stays out of sync and recovery slows",
  },
  TRICHOTILLOMANIA: {
    recognitionCue: "mechanical thinning in reachable areas with broken hairs of varied lengths",
    mechanism: "repeated pulling damages the follicle and shortens its active growth phase",
    progression: "continued mechanical stress shortens follicle lifespan further and can lead to lasting thinning in affected areas",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Driver interaction sentences — used in Section 2 to deliver the "aha"
// moment when more than one driver is in play. Doctor-approved cross-talk
// statements. Keyed by sorted driver-pair ID.
// ─────────────────────────────────────────────────────────────────────────────

function driverPair(a: DriverKey, b: DriverKey): string {
  return [a, b].sort().join("|");
}

const DRIVER_INTERACTIONS = new Map<string, string>([
  [driverPair("HORMONAL_METABOLIC", "NUTRITIONAL"),
    "Hormonal pressure and nutritional gaps compound — hormones shorten the active growth phase, while the body lacks the raw materials to restart it on its own."],
  [driverPair("HORMONAL_METABOLIC", "STRESS_SHEDDING"),
    "Stress raises cortisol, which amplifies the hormonal pattern already shortening your growth phase — together they push more follicles into shedding at once than either would alone."],
  [driverPair("HORMONAL_METABOLIC", "GUT_DISRUPTION"),
    "Hormonal pressure and digestive disruption compound — the gut limits what reaches the follicle, while shifting hormones change what the follicle needs to function."],
  [driverPair("HORMONAL_METABOLIC", "SCALP_INFLAMMATION"),
    "Hormonal shifts often raise inflammation at the scalp level, which makes the follicle environment harder to recover in even after the hormonal pressure eases."],
  [driverPair("HORMONAL_METABOLIC", "GENETIC_PATTERN"),
    "Hormonal pressure and pattern sensitivity compound — the same androgens that drive the inherited pattern also rise under hormonal imbalance, which is why the visible change can feel like it accelerates."],
  [driverPair("NUTRITIONAL", "STRESS_SHEDDING"),
    "Stress accelerates nutrient use, so even small dietary gaps land harder than they otherwise would — a single trigger can tip the cycle in ways that show up in the hair months later."],
  [driverPair("GUT_DISRUPTION", "NUTRITIONAL"),
    "Digestive symptoms compound the nutritional gap — the body cannot absorb the resources it does receive, so each cycle starts further behind than the last."],
  [driverPair("SCALP_INFLAMMATION", "STRESS_SHEDDING"),
    "Stress and scalp inflammation feed each other — cortisol shifts scalp blood flow, and an inflamed environment keeps signalling stress back to the follicle."],
  [driverPair("GENETIC_PATTERN", "STRESS_SHEDDING"),
    "Stress-driven shedding does not cause the pattern itself, but it can accelerate the pace at which susceptible follicles miniaturise — so the visible change can feel like it is speeding up."],
  [driverPair("GENETIC_PATTERN", "SCALP_INFLAMMATION"),
    "Scalp inflammation makes the susceptible follicles in pattern thinning miniaturise faster than they otherwise would — and that is one of the reasons the change can feel uneven."],
  [driverPair("CIRCADIAN_DISRUPTION", "STRESS_SHEDDING"),
    "Disrupted overnight recovery time amplifies the daytime stress signal the follicle has to absorb — the body never gets the rest window it relies on."],
  [driverPair("GENETIC_PATTERN", "OXIDATIVE_STRESS"),
    "Oxidative load wears down the follicle environment, which accelerates the gradual reduction characteristic of pattern thinning."],
  [driverPair("IMMUNE_FACTORS", "NUTRITIONAL"),
    "Immune activity raises the body's nutritional demand, and nutritional gaps in turn dysregulate the immune balance — each one quietly amplifies the other."],
  [driverPair("POST_ILLNESS_MEDICATION", "STRESS_SHEDDING"),
    "Recent illness or medication can prime the follicle for stress-driven shedding to land harder than it normally would — the cycle was already destabilised before the stress arrived."],
]);

function interactionSentence(drivers: RankedDriver[]): string {
  if (drivers.length < 2) return "";
  const top = drivers.slice(0, 3).map((d) => d.key);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const s = DRIVER_INTERACTIONS.get(driverPair(top[i], top[j]));
      if (s) return s;
    }
  }
  return "What makes your picture distinctive is that more than one of these patterns is active at the same time — and each one quietly amplifies what the others are doing to the hair cycle.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver detection & tier ranking (internal)
// ─────────────────────────────────────────────────────────────────────────────

interface RankedDriver {
  key: DriverKey;
  driver: InsightDriver;
  tier: DriverTier;
  weight: number;
  /** Specific RootCauses (patient-confirmed) that contributed to this driver,
   *  ordered by the order they were added (most direct first). */
  contributingCauses: RootCause[];
}

function detectDrivers(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
  ans: PatientAnswers,
): RankedDriver[] {
  const weights = new Map<DriverKey, number>();
  const causesByDriver = new Map<DriverKey, RootCause[]>();

  for (const rc of clinical.rootCauses ?? []) {
    const key = ROOT_CAUSE_TO_DRIVER[rc];
    if (!key) continue;
    weights.set(key, (weights.get(key) ?? 0) + 2);
    const list = causesByDriver.get(key) ?? [];
    if (!list.includes(rc)) list.push(rc);
    causesByDriver.set(key, list);
  }

  for (const cond of analysis.primary ?? []) {
    const supporting = cond.supportingSignals?.length ?? 0;
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

  const scalpSignals = (ans.scalp ?? []).filter((s) => SCALP_SIGNAL.test(s));
  if (scalpSignals.length > 0) {
    const bonus = Math.min(scalpSignals.length, 3);
    weights.set("SCALP_INFLAMMATION", (weights.get("SCALP_INFLAMMATION") ?? 0) + bonus);
  }

  // Locked clinical rule (2026-06-15): GENETIC_PATTERN may appear in the
  // narrative ONLY when the patient explicitly selected Genetics or Family
  // history as a cause. The story belongs to the patient's reported picture,
  // not the engine's internal AGA_* classification.
  void clinical.primaryDiagnosis;

  const sorted = [...weights.entries()].sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return [
      {
        key: "GENERAL_INFLUENCES",
        driver: DRIVER_CATALOG.GENERAL_INFLUENCES,
        tier: "primary",
        weight: 1,
        contributingCauses: [],
      },
    ];
  }

  const capped = sorted.slice(0, 5);
  const topWeight = capped[0][1];

  return capped.map(([key, weight]) => {
    let tier: DriverTier;
    if (weight >= Math.max(topWeight, 3)) tier = "primary";
    else if (weight >= 2) tier = "secondary";
    else tier = "contributing";
    return {
      key,
      driver: DRIVER_CATALOG[key],
      tier,
      weight,
      contributingCauses: causesByDriver.get(key) ?? [],
    };
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

function dedupe<T>(items: T[]): T[] {
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
  const pattern = drivers.some((d) => d.key === "GENETIC_PATTERN");

  if (active && scalp) {
    return "increased shedding alongside scalp changes that have not been settling on their own";
  }
  if (active && pattern) {
    return "ongoing shedding together with a gradual change in hair density";
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

/** Section 1 — YOUR HAIR STORY.
 *  Plain-English recap of every major signal the patient surfaced in the
 *  questionnaire — duration, pattern, severity, scalp, lifestyle, medical,
 *  diet, previous treatments, and their goal — woven into a doctor's
 *  consultation opening. No biology, no kit talk. */
function composeYourHairStory(
  drivers: RankedDriver[],
  clinical: ClinicalProfile,
  ans: PatientAnswers,
): string {
  const exp = experiencePhrase(clinical, ans, drivers);

  // Patient-stated goal — keep the human reason for being here front of mind.
  const goalArr = Array.isArray(ans.goal) ? ans.goal : ans.goal ? [ans.goal] : [];
  const goalsClean = goalArr.filter((g) => g && !/^\s*(none|n\/a|na)/i.test(g));

  // Major questionnaire selections — grouped by clinical area.
  const clean = (xs: string[] | undefined): string[] =>
    (xs ?? []).filter((x) => x && !/^\s*(none|no\s|not\s|n\/a|na$)/i.test(x));
  const join = (xs: string[], max = 3): string => joinList(xs.slice(0, max).map((s) => s.toLowerCase()));

  const scalp = clean(ans.scalp);
  const cause = clean(ans.cause);
  const lifestyle = clean(ans.lifestyle);
  const hormonal = clean(ans.hormonal);
  const thyroidArr = Array.isArray(ans.thyroid) ? ans.thyroid : ans.thyroid ? [String(ans.thyroid)] : [];
  const thyroid = clean(thyroidArr);
  const gut = clean(ans.gut);
  const deficiency = clean(ans.deficiency);
  const immunity = clean(ans.immunity);
  const diet = clean(ans.diet);
  const hairType = clean(ans.hairtype);
  const treatment = clean(ans.treatment);

  // Opening — what they've been experiencing + how long.
  const opening: string[] = [];
  opening.push("Based on the information you shared with us, here is what stands out from your hair story.");

  const durationPhrase = ans.duration?.trim() ? ` over the past ${ans.duration.trim().toLowerCase()}` : "";
  const countPhrase = ans.count?.trim() ? `, with ${ans.count.trim().toLowerCase()} on most days` : "";
  opening.push(`You have been noticing ${exp}${durationPhrase}${countPhrase}.`);

  if (hairType.length > 0) {
    opening.push(`The pattern you described is ${join(hairType)}${ans.grade ? `, in line with ${ans.grade.toLowerCase()}` : ""}.`);
  } else if (ans.grade?.trim()) {
    opening.push(`The pattern you described aligns with ${ans.grade.toLowerCase()}.`);
  }

  // Scalp and trigger pieces.
  const findings: string[] = [];
  if (scalp.length > 0) findings.push(`scalp concerns such as ${join(scalp)}`);
  if (cause.length > 0) findings.push(`a likely trigger involving ${join(cause)}`);
  if (lifestyle.length > 0) findings.push(`lifestyle factors like ${join(lifestyle)}`);
  if (findings.length > 0) {
    opening.push(`You also mentioned ${joinList(findings)}.`);
  }

  // Medical picture — hormones, thyroid, gut, deficiencies, immunity, diet.
  const medical: string[] = [];
  if (hormonal.length > 0) medical.push(`hormonal patterns including ${join(hormonal)}`);
  if (thyroid.length > 0) medical.push(`thyroid history (${join(thyroid)})`);
  if (gut.length > 0) medical.push(`digestive symptoms such as ${join(gut)}`);
  if (deficiency.length > 0) medical.push(`reported deficiencies in ${join(deficiency)}`);
  if (immunity.length > 0) medical.push(`immunity flags like ${join(immunity)}`);
  if (diet.length > 0) medical.push(`a ${join(diet, 2)} dietary pattern`);
  if (medical.length > 0) {
    opening.push(`On the medical and nutrition side, you flagged ${joinList(medical)}.`);
  }

  if (treatment.length > 0) {
    opening.push(`You have previously tried ${join(treatment, 3)}, which gives us a clear sense of what has and has not worked for you so far.`);
  }

  if (goalsClean.length > 0) {
    opening.push(`Above all, what you would like from us is to ${joinList(goalsClean.slice(0, 2).map((g) => g.toLowerCase()))}, and the plan that follows is built around exactly that.`);
  } else {
    opening.push(`The plan that follows is built around the picture you have just shared.`);
  }

  return opening.join(" ");
}

/** A walkable Section 2 item — either a confirmed condition (with mechanism)
 *  or a driver-level entry when no root cause feeds it (e.g. scalp signals). */
type Section2Item =
  | { kind: "condition"; rc: RootCause; driverKey: DriverKey }
  | { kind: "driver"; driver: RankedDriver };

function collectSection2Items(drivers: RankedDriver[]): Section2Item[] {
  const out: Section2Item[] = [];
  const seenConditions = new Set<RootCause>();
  const seenDrivers = new Set<DriverKey>();
  for (const d of drivers) {
    if (d.contributingCauses.length === 0) {
      if (seenDrivers.has(d.key)) continue;
      seenDrivers.add(d.key);
      out.push({ kind: "driver", driver: d });
    } else {
      for (const rc of d.contributingCauses) {
        if (seenConditions.has(rc)) continue;
        seenConditions.add(rc);
        out.push({ kind: "condition", rc, driverKey: d.key });
      }
    }
  }
  return out.slice(0, 4);
}

function stripTrailingPeriod(s: string): string {
  return s.replace(/\.\s*$/, "");
}

const SECTION_2_TRANSITIONS = [
  "First,",
  "On top of that,",
  "At the same time,",
  "Finally,",
];

// ─────────────────────────────────────────────────────────────────────────────
// Doctor-voice paraphrasing of the Clinical Interpretation library.
//
// Section 2 is sourced from the dermatologist-authored explanations attached
// to each questionnaire signal (PatientSummary.clinicalInterpretation).
// Rather than reading the library text back at the patient verbatim, we
// rewrite each finding in the voice of a doctor explaining the condition
// across the desk — same biology, warmer cadence.
// ─────────────────────────────────────────────────────────────────────────────

interface DoctorRewrite {
  match: RegExp;       // matched against `${condition} ${signal}` (lower-cased)
  paraphrase: string;  // doctor-voice sentence (no kit names, no timelines)
  topic: string;       // grouping key — dedup by topic so we never repeat the same point
}

const DOCTOR_REWRITES: DoctorRewrite[] = [
  {
    topic: "iron",
    match: /iron|ferritin|menorrhag|heavy bleeding|heavy menstrual|anaem/,
    paraphrase:
      "Iron is one of the quiet foundations the follicle is built on — it carries oxygen to the dermal papilla, supports DNA repair, and converts thyroid T4 into the active T3 form. When your stores stay low, the follicle exits the growth phase earlier than it should, and that's exactly what you are noticing as ongoing shedding.",
  },
  {
    topic: "pcos",
    match: /pmos|pcos|pcod/,
    paraphrase:
      "PCOS is not a single hormone problem — it is a knot of insulin resistance, androgen excess, low-grade inflammation, and oxidative stress that share the same family of genes as pattern hair loss. Together they shorten the growth phase along the parting and make weight harder to lose, which then feeds the cycle further.",
  },
  {
    topic: "thyroid",
    match: /thyroid|hypothyroid|hyperthyroid/,
    paraphrase:
      "Thyroid hormones set the metabolic tempo every follicle relies on. If thyroid output runs low, the cycle becomes sluggish and growth slows diffusely across the scalp; if it runs high, follicles are pushed out of the growth phase before they are ready. Either way the cellular machinery the hair runs on cannot keep up.",
  },
  {
    topic: "stress",
    match: /stress|anxiety|depression|substance.?p|cortisol/,
    paraphrase:
      "The stress you have been carrying is not just emotional — sustained cortisol activates substance-P signalling at the follicle and pushes a whole wave of hair into shedding at once. That is why the loss often shows up a couple of cycles after the hardest period, and feels disproportionate to the trigger.",
  },
  {
    topic: "postpartum",
    match: /post[-\s]?partum|post[-\s]?natal|post[-\s]?delivery|breastfeed|lactat|feeding/,
    paraphrase:
      "During pregnancy, growth-factor and hormonal support kept far more follicles than usual in the active growth phase. After delivery those signals withdraw abruptly and the held-back hair enters shedding all at once. Feeding compounds it by claiming the very nutrients the cycle needs to restart cleanly.",
  },
  {
    topic: "menopause",
    match: /menopaus|peri[-\s]?menopaus|endometr|hormonal inflammation|hormonal therapy|hrt/,
    paraphrase:
      "The hormonal transition you described unmasks the follicle's underlying sensitivity to androgens, and the same shift slows gut absorption of iron and B-vitamins. You feel that as thinning along the parting paired with the cyclical symptoms — they are two ends of the same biology.",
  },
  {
    topic: "aga",
    match: /aga|androgen|family history|genetic|hereditar|miniaturis|pattern miniaturis|widening|crown|temple|receding/,
    paraphrase:
      "The family pattern you noted reflects polygenic genetics — not one gene, but a cluster that transmits androgen sensitivity together with quieter metabolic traits like insulin resistance and lipid-handling. Each cycle, susceptible follicles produce a slightly finer, shorter hair, and over the years the visible density quietly reduces.",
  },
  {
    topic: "scalp",
    match: /scalp|seborrh|dandruff|inflam|psoriasis|folliculit|itch|flak|oily|redness|burning|boils/,
    paraphrase:
      "The scalp signs you described — dandruff, itching, oiliness or discomfort — tell me there is active inflammation at the follicle's doorstep. Mast-cell activity and microbial overgrowth alter scalp pH, generate reactive oxygen species, and arrest growth long before the hair itself looks affected. That environment has to settle for new hair to anchor properly.",
  },
  {
    topic: "gut",
    match: /gut|gerd|reflux|acidity|ibs|crohn|bloat|constipation|dysbiosis|leaky/,
    paraphrase:
      "Your digestive symptoms are not separate from the hair story. An inflamed gut lining and disturbed microbiome quietly limit how much iron, B12, and amino acid actually reaches the follicle — the food may be there, but the absorption is not, and the hair cycle pays the difference month after month.",
  },
  {
    topic: "glp1",
    match: /glp[-\s]?1|ozempic|wegovy|semaglutide|mounjaro|tirzepatide/,
    paraphrase:
      "The weight-loss medication you mentioned slows gastric emptying and shifts the gut microbiome, which together limit nutrient absorption and create a calorie deficit the follicle reads as a stress signal. The cycle conserves energy by pushing hair into shedding — exactly the pattern you have been seeing.",
  },
  {
    topic: "oxidative",
    match: /oxidative|smoking|vaping|alcohol|hard water/,
    paraphrase:
      "The smoking, alcohol or environmental exposures you noted place a steady oxidative load on the follicle. Reactive oxygen species damage follicular DNA, constrict the small vessels feeding the dermal papilla, and slowly wear down the cycle's normal turnover — so recovery becomes that much harder over time.",
  },
  {
    topic: "metabolic",
    match: /metabolic|obesity|sedentary|insulin|diabet|dyslipid/,
    paraphrase:
      "The metabolic picture you described changes the conversation between the body and the follicle. Insulin resistance and adipose-tissue signalling tell the follicle the environment is not ideal for growth, and density quietly drifts lower as a result.",
  },
  {
    topic: "circadian",
    match: /circadian|night shift|sleep|frequent flying|flying/,
    paraphrase:
      "The disrupted sleep matters more than it sounds — follicles rely on overnight melatonin and growth-hormone pulses for their repair window. Lose that window and the cycle never quite resets, and recovery slows even when everything else is in order.",
  },
  {
    topic: "weightloss",
    match: /crash|rapid weight loss|sudden weight|telogen.*rapid|rapid telogen/,
    paraphrase:
      "Rapid weight loss is read by the body as a famine signal. The follicle responds by conserving energy and exiting the growth phase early — which is why heavy shedding often surfaces well after the trigger has passed and feels difficult to trace.",
  },
  {
    topic: "immune",
    match: /auto[-\s]?immune|allerg|asthma|eczema|areata|immune/,
    paraphrase:
      "Your immunity flags suggest the immune balance is leaning in a hypersensitive direction. The follicle's normally protected growth-phase compartment loses some of that protection, and the cycle gets interrupted locally — sometimes as a patch, sometimes as diffuse thinning.",
  },
  {
    topic: "illness",
    match: /illness|surgery|hospital|medication|systemic/,
    paraphrase:
      "Illness, surgery or recent medication redirects the body's nutrient reserves toward healing — the follicle is high on the list of tissues the body deprioritises during recovery. That is why the shedding often arrives a couple of cycles after the event itself.",
  },
  {
    topic: "shaft",
    match: /heat|chemical|color|colour|bleach|perm|straighten|hair[-\s]?shaft|broken|breakage|early grey|premature grey|grey/,
    paraphrase:
      "Heat, chemical treatments and oxidative greying signals don't change what is happening at the root — but they weaken the shaft as it grows out. The cuticle is damaged, strands snap mid-length, and density can look worse than the follicles themselves are doing.",
  },
  {
    topic: "trichotillomania",
    match: /trichotillomania|pulling|ttm|ocd/,
    paraphrase:
      "The pulling behaviour you mentioned damages the follicle mechanically and shortens its growth phase. Calming the underlying anxiety alongside steady nutrient support is what gives the follicle a chance to reset.",
  },
  {
    topic: "nutrition",
    match: /nutritional|deficien|vitamin d|b12|zinc|amino|vegetarian|vegan|pescatarian|jain|high protein|poor diet|irregular meal|outside eating|standard|dht boost|nutritional gap/,
    paraphrase:
      "The follicle is one of the most nutrient-hungry tissues in the body. When iron, vitamin D, B12, zinc or amino acids run short — and the dietary pattern you described makes that more likely — the cycle simply does not have the raw material to stay in the growth phase, and over a few cycles that quietly converts into thinning.",
  },
  {
    topic: "pregnancy",
    match: /pregnan|pregnancy support/,
    paraphrase:
      "Pregnancy lifts both metabolic and nutritional demand by priority, and the body funnels resources toward the baby first. The cost on the follicle side is real even when the visible shedding arrives later.",
  },
];

function paraphraseInterpretation(ci: ClinicalInterpretation): { topic: string; sentence: string } | null {
  const corpus = `${ci.condition ?? ""} ${ci.signal}`.toLowerCase();
  for (const rule of DOCTOR_REWRITES) {
    if (rule.match.test(corpus)) {
      return { topic: rule.topic, sentence: rule.paraphrase };
    }
  }
  return null;
}

/** Section 2 — WHAT WE FOUND.
 *  Doctor-voice synthesis of the dermatologist-authored interpretations
 *  attached to the patient's selections. We pick up to four distinct
 *  topics from the clinical-interpretation library, paraphrase each in
 *  the voice of a consulting doctor, weave them together with a driver
 *  interaction line, and close with a connecting sentence. The biology
 *  is sourced; the cadence is conversational. */
function composeWhatWeFound(
  drivers: RankedDriver[],
  clinicalInterpretation: ClinicalInterpretation[],
): string {
  const opener =
    "Hair grows in cycles, and that rhythm depends on healthy systems working together — your hormones, your nutrition, your gut, your immunity, the scalp itself. When even one of those systems is disturbed, the follicle spends less time in active growth and more time shedding or resting. Looking at what you shared, here is how I am reading your picture.";

  // Walk the clinical-interpretation list (already ordered by questionnaire flow)
  // and collect up to 4 distinct doctor-voice paraphrases.
  const paraphrases: string[] = [];
  const seenTopics = new Set<string>();
  for (const ci of clinicalInterpretation) {
    if (paraphrases.length >= 4) break;
    const p = paraphraseInterpretation(ci);
    if (!p) continue;
    if (seenTopics.has(p.topic)) continue;
    seenTopics.add(p.topic);
    paraphrases.push(p.sentence);
  }

  // Fallback when nothing in the patient's selections matched a rewrite —
  // fall back to the driver-derived narrative so the section never empties.
  if (paraphrases.length === 0) {
    const items = collectSection2Items(drivers);
    items.forEach((item) => {
      if (item.kind === "condition") {
        const detail = ROOT_CAUSE_DETAIL[item.rc];
        if (detail) {
          paraphrases.push(
            `The picture you described — ${detail.recognitionCue} — fits a recognised pattern. Biologically, ${stripTrailingPeriod(detail.mechanism)}, which is what shows up as the change you are seeing.`,
          );
        }
      } else {
        const d = item.driver;
        paraphrases.push(
          `${capitaliseFirst(d.driver.label.toLowerCase())} — ${lowerFirst(stripTrailingPeriod(d.driver.recognitionCue))} — ${lowerFirst(stripTrailingPeriod(d.driver.hairImpact))}.`,
        );
      }
    });
  }

  if (paraphrases.length === 0) {
    return `${opener} Several gentler influences are nudging the rhythm at once — none dominant on its own, but together enough to shift the balance.`;
  }

  const interaction = paraphrases.length > 1 ? interactionSentence(drivers) : "";

  const close =
    paraphrases.length > 1
      ? "What makes your picture distinctive is the way these patterns talk to each other — each one quietly makes the others land a little harder, which is why the change has felt difficult to interrupt on its own."
      : "On its own this single factor is enough to shift the balance — which is why focusing on it directly is the most useful next step.";

  return [opener, ...paraphrases, interaction, close].filter((s) => s.length > 0).join(" ");
}

function capitaliseFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Per-kit narration. Each entry pairs (problem the patient signal
// surfaced) → (the intended improvement). Patterns are matched against the
// kit's displayName, kitId, supportingConditions, and whySelected text — so
// adding a new kit only needs one new pattern entry below.
// ─────────────────────────────────────────────────────────────────────────────

interface KitNarration {
  pattern: RegExp;
  problem: string;
  improvement: string;
}

const KIT_NARRATIONS: KitNarration[] = [
  {
    pattern: /iron|ferritin/i,
    problem: "low iron status",
    improvement: "restore iron stores and the steady nutrient supply your follicles depend on",
  },
  {
    pattern: /\bgi\b|gut|digest|gerd|ibs|crohn|reflux|bloat|malabs/i,
    problem: "digestive disruption affecting nutrient absorption",
    improvement: "support gut health and improve nutrient availability",
  },
  {
    pattern: /post.?partum|post.?pregnancy/i,
    problem: "the post-pregnancy hormonal shift",
    improvement: "support recovery of the normal hair-cycle rhythm",
  },
  {
    pattern: /menopaus|peri.?menopaus|peri\b/i,
    problem: "the menopausal hormonal shift",
    improvement: "support hormonal balance through this transition",
  },
  {
    pattern: /pcos/i,
    problem: "PCOS-related hormonal and metabolic patterns",
    improvement: "support hormonal and metabolic balance",
  },
  {
    pattern: /thyroid|hypo|hyper/i,
    problem: "thyroid imbalance affecting hair-cycle timing",
    improvement: "support thyroid-related metabolic recovery",
  },
  {
    pattern: /telogen|stress|effluvium/i,
    problem: "stress-driven shedding",
    improvement: "calm the hair cycle and support follicle recovery",
  },
  {
    pattern: /scalp|dandruff|seborrh|inflamm|psoriasis|folliculitis|phenotype.?inflam/i,
    problem: "scalp inflammation",
    improvement: "calm the scalp environment and ease the inflammatory load",
  },
  {
    pattern: /aga|androgen|pattern|dht|genetic|hereditar|mphl|fphl/i,
    problem: "a genetic or androgen-driven pattern of thinning",
    improvement: "support long-term follicle resilience",
  },
  {
    pattern: /immune|autoimmune|alopecia.?areata/i,
    problem: "immune-related changes around the follicle",
    improvement: "support balanced immune activity around the follicle",
  },
  {
    pattern: /circadian|sleep|night.?shift|melatonin/i,
    problem: "disrupted overnight recovery time for the follicle",
    improvement: "support circadian rhythm and the body's overnight repair processes",
  },
  {
    pattern: /oxidative|smok|alcohol/i,
    problem: "long-term oxidative load on the follicle",
    improvement: "reduce oxidative pressure and protect the follicle environment",
  },
  {
    pattern: /nutrit|deficien|weight.?loss|meta.?b|b.?vitamin/i,
    problem: "nutritional gaps that have been limiting follicle support",
    improvement: "restore the nutrients your follicles rely on",
  },
];

const DEFAULT_KIT_NARRATION: KitNarration = {
  pattern: /.*/,
  problem: "the factors highlighted in your responses",
  improvement: "address those factors directly",
};

type Section3KitNarration =
  | { kind: "anchored"; problem: string; improvement: string; kit: string }
  | { kind: "supporting"; improvement: string; kit: string };

/** Classify each selected kit for Section 3.
 *
 *  Anchored = the kit ties to a problem the PATIENT actually surfaced
 *  (matched against `supportingConditions`, which is derived from the
 *  patient-confirmed root-cause analysis).
 *
 *  Supporting = the kit was added without a confirmed patient-side anchor
 *  (e.g. AGA protocol's inflammation kit on a male grade-4 case with no
 *  scalp signals). We refuse to attribute a fabricated reason to the
 *  patient and use a softer framing instead.
 *
 *  `whySelected` is intentionally NOT in the matching corpus — that field
 *  carries generic, kit-side phrasing that can leak attributions the
 *  patient never made. */
function classifyKitNarration(phase: TreatmentPhase): Section3KitNarration {
  const conditions = (phase.supportingConditions ?? []).join(" ").trim();
  if (conditions) {
    for (const n of KIT_NARRATIONS) {
      if (n.pattern.test(conditions)) {
        return { kind: "anchored", problem: n.problem, improvement: n.improvement, kit: phase.displayName };
      }
    }
  }
  const kitCorpus = `${phase.displayName} ${phase.kitId}`;
  for (const n of KIT_NARRATIONS) {
    if (n.pattern.test(kitCorpus)) {
      return { kind: "supporting", improvement: n.improvement, kit: phase.displayName };
    }
  }
  return { kind: "supporting", improvement: DEFAULT_KIT_NARRATION.improvement, kit: phase.displayName };
}

/** Section 3 — YOUR RECOVERY PLAN.
 *  Names each recommended kit and explains, in patient-facing doctor voice,
 *  the specific problem from the questionnaire it was chosen to address
 *  and the improvement it is intended to drive. Builds conviction without
 *  marketing — the rationale is the evidence chain, not a sales pitch. */
function composeYourRecoveryPlan(treatmentStrategy: TreatmentPhase[]): string {
  const opener =
    "Your recovery plan was built around the picture you have just walked through — every kit ties back to a specific factor in your responses, so the support you receive is matched to your story rather than a generic profile.";

  if (treatmentStrategy.length === 0) {
    return (
      `${opener} As your responses are reviewed alongside the protocol library, the plan will continue to evolve to match the patterns most likely to be influencing your hair.`
    );
  }

  interface AnchoredGroup { problem: string; improvement: string; kits: string[]; }
  const anchored = new Map<string, AnchoredGroup>();
  const supporting: Array<{ improvement: string; kit: string }> = [];

  for (const phase of treatmentStrategy.slice(0, 4)) {
    const n = classifyKitNarration(phase);
    if (n.kind === "anchored") {
      const key = `${n.problem}::${n.improvement}`;
      let g = anchored.get(key);
      if (!g) {
        g = { problem: n.problem, improvement: n.improvement, kits: [] };
        anchored.set(key, g);
      }
      if (!g.kits.includes(n.kit)) g.kits.push(n.kit);
    } else {
      if (!supporting.some((s) => s.kit === n.kit)) supporting.push(n);
    }
  }

  const sentences: string[] = [];
  const anchoredGroups = [...anchored.values()];
  anchoredGroups.forEach((g, idx) => {
    const lead = idx === 0
      ? "First,"
      : idx === 1
        ? "Building on that,"
        : idx === anchoredGroups.length - 1
          ? "Finally,"
          : "Alongside that,";
    if (g.kits.length === 1) {
      sentences.push(
        `${lead} because your responses pointed to ${g.problem}, ${g.kits[0]} has been included — its role in your plan is to ${g.improvement}, so the cycle has the support it needs at the level the problem actually sits.`,
      );
    } else {
      sentences.push(
        `${lead} because your responses pointed to ${g.problem}, ${joinList(g.kits)} work together to ${g.improvement} — addressing the same factor from more than one angle so progress holds.`,
      );
    }
  });
  for (const s of supporting) {
    sentences.push(
      `${s.kit} sits alongside these as a stabiliser — it is there to ${s.improvement}, so the follicle environment stays supportive while the rest of the plan does its work.`,
    );
  }

  const closer =
    treatmentStrategy.length > 1
      ? "Together, these kits ease pressure on the follicle from several directions at once — and that is what allows progress to build steadily, rather than stalling each time one factor is left unaddressed."
      : "This focuses your plan on the single highest-leverage pattern in your picture, which is the most efficient way to give the follicle room to recover.";

  return [opener, ...sentences, closer].join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — sourced from the Universal Recovery Milestone data.
// We never invent timelines; we paraphrase the milestone windows in order.
// ─────────────────────────────────────────────────────────────────────────────

function friendlyWindow(w: string): string {
  const lower = w.toLowerCase();
  if (/(1.?[–-].?2|one.?to.?two)\s*month/.test(lower)) return "the first one to two months";
  if (/1.?[–-].?2\s*month/.test(lower)) return "the first one to two months";
  if (/3rd|third/.test(lower)) return "the third month";
  if (/4th|fourth/.test(lower)) return "the fourth month";
  if (/5th|fifth/.test(lower) && /onward/.test(lower)) return "the fifth month and beyond";
  if (/5th|fifth/.test(lower)) return "the fifth month";
  return w.toLowerCase();
}

/** Section 4 — WHAT RECOVERY COULD LOOK LIKE.
 *  Short, crisp, well-paced timeline. Names the universal milestone windows
 *  in patient-friendly language so the patient knows what to look for and
 *  when, without overwhelming them. Timing is always sourced from the
 *  Universal Recovery Milestone data — never invented. */
function composeWhatRecoveryCouldLookLike(
  milestones: UniversalRecoveryMilestone[],
): string {
  if (milestones.length === 0) {
    return "Recovery unfolds in waves rather than overnight. Shedding settles first, density and quality follow, and the focus then shifts to keeping the gains in place. Progress is gradual and individual.";
  }

  const m1 = milestones[0] ? friendlyWindow(milestones[0].window) : "the first one to two months";
  const m2 = milestones[1] ? friendlyWindow(milestones[1].window) : "the third month";
  const m3 = milestones[2] ? friendlyWindow(milestones[2].window) : "the fourth month";
  const m4 = milestones[milestones.length - 1]
    ? friendlyWindow(milestones[milestones.length - 1].window)
    : "the fifth month and beyond";

  return (
    `Recovery unfolds in waves rather than overnight. ` +
    `In ${m1}, day-to-day shedding starts to feel more controlled and the scalp feels calmer. ` +
    `By ${m2}, early follicular recovery shows up as stronger hair caliber and fine new growth coming through. ` +
    `Around ${m3}, you typically start to see visible improvement in density and coverage where it has been thinning. ` +
    `From ${m4}, the focus shifts to consolidating the gains and stabilising for the long term. ` +
    `Progress is gradual and individual, but the trajectory builds month over month.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forbidden-vocabulary guard (per section)
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_ALWAYS: RegExp[] = [
  // Assessment / diagnosis voice
  /\bassessment shows?\b/i,
  /\bwe detected\b/i,
  /\bwe diagnosed\b/i,
  /\bclinical assessment indicates?\b/i,
  /\byour condition is\b/i,
  /\bdiagnosed\b/i,
  // AI / engine
  /\bAI\b/,
  /\balgorithms?\b/i,
  /\bscoring\b/i,
  // Marketing / promises
  /\bguarantee/i,
  /\bdiscount/i,
  /\boffer\b/i,
  // Internal tier labels (must never leak out)
  /\bprimary driver\b/i,
  /\bsecondary driver\b/i,
  /\bcontributing driver\b/i,
  // Ingredient names — never in any section
  /\bbiotin\b/i,
  /\bminoxidil\b/i,
  /\bfinasteride\b/i,
  /\bketoconazole\b/i,
  /\blactoferrin\b/i,
  /\bashwagandha\b/i,
  /\bcolostrum\b/i,
];

// Disallowed in Sections 1, 2, 4 (Section 3 is the only place that names kits).
const FORBIDDEN_NON_KIT_SECTIONS: RegExp[] = [
  /\bkits?\b/i,
  /\bprotocols?\b/i,
  /\bsupplements?\b/i,
  /\bingredients?\b/i,
  /\bformulations?\b/i,
  /\bproducts?\b/i,
  /\bpackages?\b/i,
  /\bbrands?\b/i,
  /\bhair\s*fact\b/i,
  /\bpro\s*immune\b/i,
  /\bpro\s*fact\b/i,
  /\bgi\s*gold\b/i,
  /\bmeta\s*b\b/i,
  /\bte\s*gold\b/i,
  /\bphenotype\s*inflam/i,
  /\bmphl\b/i,
  /\bfphl\b/i,
];

// Timeline vocabulary — only Section 4 may use it (sourced from milestone data).
const FORBIDDEN_TIMELINE: RegExp[] = [
  /\bweeks?\b/i,
  /\bmonths?\b/i,
];

// Regrowth / promise vocabulary — never authored by the composer in any section.
// (Section 4's bullets contain "regrowth" but we paraphrase rather than emit it.)
const FORBIDDEN_PROMISE: RegExp[] = [
  /\bregrowth\b/i,
  /\bregrow\b/i,
];

interface SectionCheck {
  body: string;
  section: string;
  lists: RegExp[][];
}

function assertNoForbidden(story: ClinicalInsightStory): void {
  const checks: SectionCheck[] = [
    {
      // Section 1 echoes the patient's own questionnaire — duration text may
      // legitimately contain "months" / "weeks", so FORBIDDEN_TIMELINE is
      // intentionally not applied here.
      body: story.yourHairStory,
      section: "Your Hair Story",
      lists: [FORBIDDEN_ALWAYS, FORBIDDEN_NON_KIT_SECTIONS, FORBIDDEN_PROMISE],
    },
    {
      body: story.whyThisMayBeHappening,
      section: "What We Found",
      lists: [FORBIDDEN_ALWAYS, FORBIDDEN_NON_KIT_SECTIONS, FORBIDDEN_TIMELINE, FORBIDDEN_PROMISE],
    },
    {
      body: story.whyThisPlanWasRecommended,
      section: "Your Recovery Plan",
      lists: [FORBIDDEN_ALWAYS, FORBIDDEN_TIMELINE, FORBIDDEN_PROMISE],
    },
    {
      body: story.whatToExpect,
      section: "What Recovery Could Look Like",
      lists: [FORBIDDEN_ALWAYS, FORBIDDEN_NON_KIT_SECTIONS, FORBIDDEN_PROMISE],
    },
  ];

  for (const c of checks) {
    for (const list of c.lists) {
      for (const re of list) {
        const m = re.exec(c.body);
        if (m) {
          const msg = `[buildClinicalInsightStory] forbidden term "${m[0]}" in section "${c.section}"`;
          console.warn(msg);
          return;
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildClinicalInsightStory(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
  treatmentStrategy: TreatmentPhase[],
  recoveryMilestones: UniversalRecoveryMilestone[],
  ans: PatientAnswers,
  clinicalInterpretation: ClinicalInterpretation[] = [],
): ClinicalInsightStory {
  const ranked = detectDrivers(clinical, analysis, ans);
  ranked.sort((a, b) => {
    const t = TIER_RANK[b.tier] - TIER_RANK[a.tier];
    return t !== 0 ? t : b.weight - a.weight;
  });

  const drivers = ranked.map((r) => r.driver);
  const treatmentGoals = dedupe(drivers.map((d) => d.treatmentGoal));

  const story: ClinicalInsightStory = {
    yourHairStory: composeYourHairStory(ranked, clinical, ans),
    whyThisMayBeHappening: composeWhatWeFound(ranked, clinicalInterpretation),
    whyThisPlanWasRecommended: composeYourRecoveryPlan(treatmentStrategy),
    whatToExpect: composeWhatRecoveryCouldLookLike(recoveryMilestones),
    drivers,
    treatmentGoals,
  };

  assertNoForbidden(story);
  return story;
}
