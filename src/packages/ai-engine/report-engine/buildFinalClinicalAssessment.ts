/**
 * Final Clinical Assessment builder — HairOS Patient Video Narrative Engine.
 *
 * Produces a personalised four-scene doctor-avatar video script:
 *
 *   Scene 1 — WHAT WE FOUND               (15–20s)
 *   Scene 2 — WHY IT IS HAPPENING         (10–15s)
 *   Scene 3 — YOUR PERSONALIZED THERAPY   (25–35s)
 *   Scene 4 — WHAT TO EXPECT              (15–20s)
 *
 * Voice: second-person, warm, professional, reassuring, clinically accurate.
 * No marketing, sales, fear, or AI/system references; no kits, products,
 * ingredients, formulations, packages, brands, prices, percentages, or
 * unsupported timelines.
 *
 * Scene 3 rule: every therapy mentioned must be tied to a finding identified
 * in the assessment. Strict structure for each therapy block:
 *
 *   "We identified [problem]. To address this, we have recommended
 *    [therapy]. This is intended to help [outcome]."
 *
 * Target length: 140–220 words total.
 */

import type { PatientAnswers, RootCause, Severity } from "../../types";
import type { ClinicalProfile } from "../clinical-engine/types";
import type { KitRecommendation } from "../kit-scorer/types";
import type {
  FinalClinicalAssessment,
  RootCauseAnalysis,
  RootCauseCondition,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Diagnosis → plain-language phrase
// ─────────────────────────────────────────────────────────────────────────────

const DIAGNOSIS_PHRASE: Record<string, string> = {
  AGA_MALE_123:    "male pattern hair loss",
  AGA_MALE_45:     "advanced male pattern hair loss",
  AGA_FEMALE_123:  "female pattern hair loss",
  AGA_FEMALE_45:   "advanced female pattern hair loss",
  TE_STRESS:       "stress-driven hair shedding",
  TE_NUTRITION:    "nutrition-driven hair shedding",
  TE_POSTPREG:     "post-partum hair shedding",
  TE_DELIVERY:     "post-delivery hair shedding",
  TE_ILLNESS:      "post-illness hair shedding",
  THYROID_HYPO:    "hypothyroid-associated hair loss",
  THYROID_HYPER:   "hyperthyroid-associated hair loss",
  PCOS_ONLY:       "PCOS-associated hair loss",
  PCOS_OBESITY:    "PCOS with metabolic involvement",
  PERI_MENOPAUSE:  "peri-menopausal hair changes",
  MENOPAUSE:       "menopausal hair changes",
  POST_MENOPAUSE:  "post-menopausal hair changes",
  IRON_DEFICIENCY: "iron-deficiency hair loss",
  ALOPECIA_AREATA: "alopecia areata",
  PREGNANCY:       "pregnancy-related hair changes",
  WEIGHT_LOSS:     "rapid weight-loss-related hair shedding",
  GUT_ISSUES:      "gut-axis-driven hair loss",
  SCALP_INFLAM:    "scalp inflammation–driven hair loss",
  HAIR_BREAKAGE:   "hair shaft breakage",
  OXIDATIVE:       "oxidative-stress-driven hair loss",
  NIGHT_SHIFT:     "shift-work-related hair loss",
  FREQUENT_FLYING: "travel-stress-related hair loss",
  DIABETES:        "diabetes-associated hair loss",
  CHRONIC_MEDICAL: "chronic medical hair loss",
  TTM:             "behavioural pulling–driven hair loss",
  ENDOMETRIOSIS:   "endometriosis-associated hair changes",
  EARLY_GREY:      "premature greying",
  MOUTH_ULCERS:    "immune-mediated hair loss",
  MULTI:           "multifactorial hair loss",
  REGROW_ONLY:     "hair growth and density support",
};

const AGA_KEYS = new Set([
  "AGA_MALE_123",
  "AGA_MALE_45",
  "AGA_FEMALE_123",
  "AGA_FEMALE_45",
]);
const TE_KEYS = new Set([
  "TE_STRESS",
  "TE_NUTRITION",
  "TE_POSTPREG",
  "TE_DELIVERY",
  "TE_ILLNESS",
]);

function diagnosisPhrase(clinical: ClinicalProfile): string {
  const base = DIAGNOSIS_PHRASE[clinical.primaryDiagnosis] ?? "hair loss";
  const rc = new Set(clinical.rootCauses);
  const hasAGA = AGA_KEYS.has(clinical.primaryDiagnosis) || rc.has("DHT") || rc.has("GENETICS");
  const hasTE =
    TE_KEYS.has(clinical.primaryDiagnosis)
    || rc.has("STRESS")
    || rc.has("POOR_NUTRITION")
    || rc.has("ILLNESS")
    || rc.has("RAPID_WEIGHT_LOSS");
  if (hasAGA && hasTE && !TE_KEYS.has(clinical.primaryDiagnosis)) {
    return `${base} together with an active shedding phase`;
  }
  return base;
}

function severityPhrase(s: Severity | undefined): string {
  if (!s) return "";
  switch (s) {
    case "MILD":     return "early-stage";
    case "MODERATE": return "moderate";
    case "SEVERE":   return "advanced";
    default:         return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contributing factors (plain language, max 2 named in prose)
// ─────────────────────────────────────────────────────────────────────────────

const IMPACT_ORDER: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

const FACTOR_PHRASE: Record<RootCause, string> = {
  STRESS:               "chronic stress",
  DHT:                  "androgen pressure on the follicles",
  GENETICS:             "an inherited follicular sensitivity",
  IRON_DEFICIENCY:      "low iron stores",
  HYPOTHYROID:          "an underactive thyroid",
  HYPERTHYROID:         "an overactive thyroid",
  PCOS:                 "PCOS-related hormonal imbalance",
  METABOLIC:            "metabolic dysfunction",
  POOR_NUTRITION:       "nutritional gaps",
  POST_PARTUM:          "the post-partum hormonal shift",
  GUT_MALABSORPTION:    "gut-axis disruption affecting nutrient absorption",
  OXIDATIVE_STRESS:     "ongoing oxidative stress",
  MEDICATION:           "a medication-related contribution",
  ILLNESS:              "recovery from a recent systemic illness",
  RAPID_WEIGHT_LOSS:    "rapid weight loss",
  AUTOIMMUNE:           "an immune-mediated process",
  CIRCADIAN_DISRUPTION: "disrupted sleep and circadian rhythm",
  TRICHOTILLOMANIA:     "compulsive pulling",
  HORMONAL_SHIFT:       "an ongoing hormonal transition",
};

function topFactorPhrases(
  analysis: RootCauseAnalysis,
  clinical: ClinicalProfile,
  max: number,
): string[] {
  const all: RootCauseCondition[] = [
    ...analysis.primary,
    ...analysis.secondary,
    ...analysis.amplifiers,
  ];
  const sorted = [...all].sort((a, b) => {
    const ai = IMPACT_ORDER[a.impact] ?? 0;
    const bi = IMPACT_ORDER[b.impact] ?? 0;
    if (ai !== bi) return bi - ai;
    return b.supportingSignals.length - a.supportingSignals.length;
  });

  const seen = new Set<string>();
  const out: string[] = [];

  for (const cond of sorted) {
    const rcMatch = (Object.keys(FACTOR_PHRASE) as RootCause[]).find((rc) =>
      cond.condition.toLowerCase().includes(rc.toLowerCase().split("_")[0])
    );
    const phrase = rcMatch ? FACTOR_PHRASE[rcMatch] : cond.condition.toLowerCase();
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
    if (out.length >= max) return out;
  }

  for (const rc of clinical.rootCauses) {
    const phrase = FACTOR_PHRASE[rc];
    if (!phrase || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
    if (out.length >= max) return out;
  }

  return out;
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scalp + hair findings — translate raw signals to plain-language phrases
// ─────────────────────────────────────────────────────────────────────────────

const SCALP_PHRASE_RULES: Array<{ match: RegExp; phrase: string }> = [
  { match: /dandruff/i,                phrase: "dandruff" },
  { match: /flak/i,                    phrase: "flaking" },
  { match: /oily|seborrh/i,            phrase: "oiliness" },
  { match: /dry scalp/i,               phrase: "dryness" },
  { match: /itch/i,                    phrase: "itching" },
  { match: /redness|burning|irritat/i, phrase: "redness or irritation" },
  { match: /boils|folliculitis/i,      phrase: "follicular inflammation" },
  { match: /psoriasis/i,               phrase: "psoriatic activity" },
];

function scalpFindingPhrases(ans: PatientAnswers): string[] {
  const raw = (ans.scalp ?? []).filter((s) => !/none|no\s/i.test(s));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sig of raw) {
    const rule = SCALP_PHRASE_RULES.find((r) => r.match.test(sig));
    if (!rule || seen.has(rule.phrase)) continue;
    seen.add(rule.phrase);
    out.push(rule.phrase);
  }
  return out;
}

const HAIR_PHRASE_RULES: Array<{ match: RegExp; phrase: string }> = [
  { match: /thinning at crown|crown/i,          phrase: "thinning at the crown" },
  { match: /widening parting|parting/i,         phrase: "a widening parting" },
  { match: /receding|temple/i,                  phrase: "a receding hairline" },
  { match: /diffuse|all over/i,                 phrase: "diffuse thinning across the scalp" },
  { match: /patchy|circular|patches/i,          phrase: "patchy hair loss" },
  { match: /broken|short|breakage/i,            phrase: "mid-shaft breakage" },
];

function hairFindingPhrases(ans: PatientAnswers): string[] {
  const raw = ans.hairtype ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sig of raw) {
    const rule = HAIR_PHRASE_RULES.find((r) => r.match.test(sig));
    if (!rule || seen.has(rule.phrase)) continue;
    seen.add(rule.phrase);
    out.push(rule.phrase);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kit-id → therapy block.
//
// Each recommended kit becomes a problem → therapy → benefit triplet in
// scene 3. Therapy labels are generic, plain-language categories — they never
// reveal kit names, brand names, or ingredients.
// ─────────────────────────────────────────────────────────────────────────────

interface TherapyBlock {
  problem: string;
  therapy: string;
  benefit: string;
}

interface KitTherapyRule {
  match: RegExp;
  build: () => TherapyBlock;
}

const KIT_THERAPY_RULES: KitTherapyRule[] = [
  {
    match: /TE\s*GOLD/i,
    build: () => ({
      problem: "ongoing active shedding driven by internal stress and recovery factors",
      therapy: "targeted shedding-control care",
      benefit: "stabilise day-to-day hair fall and bring your hair cycle back into a normal rhythm",
    }),
  },
  {
    match: /PHENOTYPE\s*INFLAM/i,
    build: () => ({
      problem: "inflammation affecting your scalp environment",
      therapy: "scalp-inflammation care",
      benefit: "cool the scalp, calm irritation, and give your follicles a healthier base to grow from",
    }),
  },
  {
    match: /META\s*B\s*HYPOTHYROID/i,
    build: () => ({
      problem: "an underactive thyroid affecting your hair cycle",
      therapy: "thyroid-support care",
      benefit: "support healthy thyroid metabolism and steady follicular activity",
    }),
  },
  {
    match: /THYROID\s*CARE/i,
    build: () => ({
      problem: "thyroid-related metabolic demand affecting your hair",
      therapy: "thyroid-support care",
      benefit: "support healthy thyroid metabolism and protect your hair through this period",
    }),
  },
  {
    match: /META\s*B\s*PCOS|F[-\s]?PCOS|^PCOS/i,
    build: () => ({
      problem: "PCOS-related hormonal and insulin imbalance contributing to hair fall",
      therapy: "hormonal and metabolic balance care",
      benefit: "ease the hormonal pressure on your follicles and support steady hair recovery",
    }),
  },
  {
    match: /META\s*B/i,
    build: () => ({
      problem: "metabolic factors limiting how well your follicles can recover",
      therapy: "metabolic-balance care",
      benefit: "improve cellular energy and create a stronger foundation for hair growth",
    }),
  },
  {
    match: /PERI\s*MENOPAUSE/i,
    build: () => ({
      problem: "hormonal changes of the peri-menopausal transition",
      therapy: "hormonal-transition care",
      benefit: "ease the transition and stabilise your hair through this phase",
    }),
  },
  {
    match: /META\s*B\s*POSTMENOPAUSE|POST\s*MENOPAUSE/i,
    build: () => ({
      problem: "the post-menopausal hormonal and metabolic shift contributing to hair thinning",
      therapy: "post-menopausal metabolic and hormonal support",
      benefit: "restore long-term hormonal balance and protect hair density through this stage",
    }),
  },
  {
    match: /META\s*B\s*MENOPAUSE/i,
    build: () => ({
      problem: "declining oestrogen and rising androgen activity at the menopause transition",
      therapy: "menopausal metabolic and hormonal care",
      benefit: "balance the hormonal shift, support your metabolism, and stabilise your hair",
    }),
  },
  {
    match: /^MPHL/i,
    build: () => ({
      problem: "androgen-driven follicle miniaturisation in the male pattern",
      therapy: "pattern hair-loss care",
      benefit: "reduce the androgen pressure on susceptible follicles and protect existing density",
    }),
  },
  {
    match: /^FPHL/i,
    build: () => ({
      problem: "pattern thinning at the parting and crown",
      therapy: "pattern hair-loss care",
      benefit: "stabilise the thinning area and rebuild density over time",
    }),
  },
  {
    match: /ALOPECIA\s*AREATA/i,
    build: () => ({
      problem: "an immune-mediated process targeting your follicles",
      therapy: "immune-balance care",
      benefit: "calm the immune attack on the follicle and create space for regrowth",
    }),
  },
  {
    match: /OXIDATIVE\s*STRESS/i,
    build: () => ({
      problem: "ongoing oxidative stress wearing down your follicles",
      therapy: "antioxidant care",
      benefit: "protect follicles from oxidative damage and improve hair quality",
    }),
  },
  {
    match: /GI\s*GOLD|GUT.*RESTOR|GI\s*HEALTH/i,
    build: () => ({
      problem: "gut imbalance limiting how well you absorb the nutrients your follicles need",
      therapy: "gut and absorption care",
      benefit: "restore steady nutrient delivery to your hair and skin",
    }),
  },
  {
    match: /PRO\s*IMMUNE/i,
    build: () => ({
      problem: "an immunity gap slowing your overall recovery",
      therapy: "immune-resilience care",
      benefit: "consolidate the regrowth you build and protect your scalp long-term",
    }),
  },
  {
    match: /IRON\s*UP/i,
    build: () => ({
      problem: "low iron stores limiting healthy follicle function",
      therapy: "iron-repletion care",
      benefit: "restore your iron reserves and support a steady reduction in shedding",
    }),
  },
  {
    match: /TTM/i,
    build: () => ({
      problem: "behavioural pulling affecting hair growth in the involved areas",
      therapy: "stress and impulse-regulation care",
      benefit: "reduce the urge-driven cycle and create space for regrowth where it is safe",
    }),
  },
  {
    match: /HBR|HAIR\s*BREAKAGE/i,
    build: () => ({
      problem: "hair shaft breakage rather than root-level loss",
      therapy: "hair-structure care",
      benefit: "strengthen the strand, reduce snapping, and improve hair quality",
    }),
  },
  {
    match: /EARLY\s*GREY|EG\s*CARE/i,
    build: () => ({
      problem: "stress, oxidative and nutritional factors driving early pigment loss",
      therapy: "pigmentation-support care",
      benefit: "protect the pigment-producing cells and support healthier hair colour over time",
    }),
  },
  {
    match: /RAPID\s*WEIGHT\s*LOSS|RWL\s*SHIELD/i,
    build: () => ({
      problem: "nutritional depletion from rapid weight loss affecting your hair and recovery",
      therapy: "nutritional-recovery care",
      benefit: "replenish your reserves and protect your hair through this period",
    }),
  },
  {
    match: /FH\s*WELL\s*3|ENDOMETR/i,
    build: () => ({
      problem: "chronic inflammation linked to endometriosis affecting your hair and skin",
      therapy: "inflammation-balance care",
      benefit: "ease the inflammatory load and support healthier hair growth",
    }),
  },
  {
    match: /NIGHT\s*SHIFT/i,
    build: () => ({
      problem: "circadian disruption from shift work affecting hair growth and recovery",
      therapy: "circadian-recovery care",
      benefit: "restore better sleep quality and reduce the toll on your follicles",
    }),
  },
  {
    match: /FREQUENT\s*FLYER/i,
    build: () => ({
      problem: "the cumulative toll of frequent travel on your scalp, sleep, and recovery",
      therapy: "travel-recovery care",
      benefit: "buffer the travel load and keep your hair growth steady",
    }),
  },
  {
    match: /LACTIHEALTH/i,
    build: () => ({
      problem: "post-partum nutritional depletion driving increased shedding",
      therapy: "post-partum recovery care",
      benefit: "replenish your reserves and ease the post-partum shedding phase",
    }),
  },
];

function therapyBlockForKit(kitId: string): TherapyBlock | null {
  for (const rule of KIT_THERAPY_RULES) {
    if (rule.match.test(kitId)) return rule.build();
  }
  return null;
}

function therapyBlocksForRecommendation(
  kits: KitRecommendation,
  max: number,
): TherapyBlock[] {
  const out: TherapyBlock[] = [];
  const seenTherapies = new Set<string>();
  for (const sk of kits.rankedKits) {
    const block = therapyBlockForKit(sk.kitId);
    if (!block) continue;
    if (seenTherapies.has(block.therapy)) continue;
    seenTherapies.add(block.therapy);
    out.push(block);
    if (out.length >= max) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene composers
// ─────────────────────────────────────────────────────────────────────────────

function composeScene1(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
): string {
  const diag = diagnosisPhrase(clinical);
  const sev = severityPhrase(clinical.severity);
  const sevPhrase = sev ? `, at ${prefixArticle(sev)} ${sev} stage,` : "";
  const top = topFactorPhrases(analysis, clinical, 2);
  const factors = top.length > 0
    ? ` The main factors contributing to this are ${joinPhrases(top)}.`
    : "";
  const activity = clinical.flags.hasActiveShedding
    ? " The process is currently active, which is why you may be noticing ongoing shedding and reduced hair density."
    : " The process is not in an actively shedding phase right now, but the underlying drivers need to be addressed to protect what you have.";

  return `Your assessment shows a clinical picture consistent with ${diag}${sevPhrase}.${factors}${activity}`;
}

function prefixArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function composeScene2(
  clinical: ClinicalProfile,
  ans: PatientAnswers,
): string {
  const scalp = scalpFindingPhrases(ans);
  const hair = hairFindingPhrases(ans);

  const parts: string[] = [];
  parts.push(
    "What this means biologically is that the natural growth and renewal cycle of your hair has been disturbed.",
  );

  if (scalp.length > 0) {
    parts.push(`On your scalp, we noticed ${joinPhrases(scalp)}, which weakens the environment your follicles need to thrive.`);
  } else {
    parts.push("Your scalp environment plays a key role here, and supporting it is part of the plan.");
  }

  if (hair.length > 0) {
    parts.push(`In the hair itself, the pattern shows ${joinPhrases(hair)}.`);
  } else if (clinical.flags.hasActiveShedding) {
    parts.push("In the hair itself, follicles are spending less time in the active growth phase, which is why you see more shedding.");
  } else {
    parts.push("In the hair itself, follicles are gradually becoming less efficient at producing strong strands.");
  }

  return parts.join(" ");
}

function composeScene3(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
  ans: PatientAnswers,
  kits: KitRecommendation,
): string {
  const blocks = therapyBlocksForRecommendation(kits, 3);

  if (blocks.length === 0) {
    // Fallback: derive a single generic block from the top factor.
    const top = topFactorPhrases(analysis, clinical, 1)[0]
      ?? "the biological drivers behind your hair changes";
    return `Here is what we have recommended for you, and why. We identified ${top}. To address this, we have recommended targeted hair-recovery care. This is intended to help protect your follicles and support healthy long-term hair growth.`;
  }

  const opener = "Here is what we have recommended for you, and why.";
  const lines = blocks.map(
    (b) =>
      `We identified ${b.problem}. To address this, we have recommended ${b.therapy}. This is intended to help ${b.benefit}.`,
  );
  return [opener, ...lines].join(" ");
}

function composeScene4(): string {
  return "With consistent care, early improvements often appear as reduced shedding and better scalp comfort in the first couple of months. Existing hair then becomes stronger, with gradual density gains in the months that follow. How much you see depends on how long the issue has been active and how closely you follow the plan.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Forbidden-vocabulary guard
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_TOKENS: RegExp[] = [
  // Section / process language we never want in this block
  /\bkits?\b/i,
  /\bprotocols?\b/i,
  /\bsupplements?\b/i,
  /\bingredients?\b/i,
  /\bformulations?\b/i,
  /\bproducts?\b/i,
  /\bpackages?\b/i,
  /\bbrands?\b/i,
  // AI / engine / model / algorithm references
  /\bAI\b/,
  /\balgorithms?\b/i,
  /\bscoring\b/i,
  // Common ingredient names that have appeared in marketing copy
  /\bcurcumin\b/i,
  /\bmelatonin\b/i,
  /\bbiotin\b/i,
  /\blactoferrin\b/i,
  /\bashwagandha\b/i,
  /\bmoringa\b/i,
  /\bcolostrum\b/i,
  /\bquercetin\b/i,
  /\bresveratrol\b/i,
  /\bminoxidil\b/i,
  /\bfinasteride\b/i,
  /\bketoconazole\b/i,
  // HairOS product / kit family labels
  /\bhair\s*fact\b/i,
  /\bpro\s*immune\b/i,
  /\bpro\s*fact\b/i,
  /\bgi\s*gold\b/i,
  /\bmeta\s*b\b/i,
  /\bte\s*gold\b/i,
  /\bphenotype\s*inflam/i,
  /\bmphl\b/i,
  /\bfphl\b/i,
  // Guarantee / pricing language
  /\bguarantee/i,
  /\bdiscount/i,
  /\boffer\b/i,
];

function findForbidden(text: string): string | null {
  for (const re of FORBIDDEN_TOKENS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

function assertNoForbiddenTerms(a: FinalClinicalAssessment): void {
  const offender = findForbidden(a.fullNarration);
  if (offender) {
    const msg = `[buildFinalClinicalAssessment] forbidden term in fullNarration: "${offender}"`;
    if (process.env.NODE_ENV === "production") {
      console.warn(msg);
    } else {
      throw new Error(msg);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Length enforcement (~140–220 words). When scene 3 grows large with many
// therapies, drop the lowest-priority therapy block until we land in band.
// ─────────────────────────────────────────────────────────────────────────────

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const MAX_WORDS = 220;
const MIN_THERAPY_BLOCKS = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildFinalClinicalAssessment(
  clinical: ClinicalProfile,
  analysis: RootCauseAnalysis,
  kits: KitRecommendation,
  ans: PatientAnswers,
): FinalClinicalAssessment {
  const scene1 = composeScene1(clinical, analysis);
  const scene2 = composeScene2(clinical, ans);
  let scene3 = composeScene3(clinical, analysis, ans, kits);
  const scene4 = composeScene4();

  // If the full narration exceeds the hard cap, drop therapy blocks from
  // scene 3 one at a time (lowest priority first) until we fit.
  let allBlocks = therapyBlocksForRecommendation(kits, 4);
  let total = wordCount(scene1) + wordCount(scene2) + wordCount(scene3) + wordCount(scene4);
  while (total > MAX_WORDS && allBlocks.length > MIN_THERAPY_BLOCKS) {
    allBlocks = allBlocks.slice(0, -1);
    const opener = "Here is what we have recommended for you, and why.";
    const lines = allBlocks.map(
      (b) =>
        `We identified ${b.problem}. To address this, we have recommended ${b.therapy}. This is intended to help ${b.benefit}.`,
    );
    scene3 = [opener, ...lines].join(" ");
    total = wordCount(scene1) + wordCount(scene2) + wordCount(scene3) + wordCount(scene4);
  }

  const videoTitle = `Your hair assessment — ${diagnosisPhrase(clinical)}`;
  const fullNarration = [scene1, scene2, scene3, scene4].join("\n\n");

  const out: FinalClinicalAssessment = {
    videoTitle,
    scene1,
    scene2,
    scene3,
    scene4,
    fullNarration,
  };
  assertNoForbiddenTerms(out);
  return out;
}
