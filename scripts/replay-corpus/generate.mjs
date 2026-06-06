#!/usr/bin/env node
/**
 * Deterministic generator for HAIROS Clinical Replay Corpus V2 cases.
 *
 * Each category has a parametrized template grounded in:
 *   src/packages/registries/signals/registry.json
 *   src/packages/registries/pathways/registry.json
 *   src/packages/registries/causes/registry.json
 *
 * Output: tests/fixtures/replay-corpus-v2/cases/<caseId>.json
 *         tests/fixtures/replay-corpus-v2/index.json
 *
 * Rerunnable: identical inputs ⇒ byte-identical outputs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CASES_DIR = path.join(ROOT, "tests", "fixtures", "replay-corpus-v2", "cases");
const INDEX_PATH = path.join(ROOT, "tests", "fixtures", "replay-corpus-v2", "index.json");

fs.mkdirSync(CASES_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic helpers
// ─────────────────────────────────────────────────────────────────────────────

const pickBand = (i, n, bands) => bands[Math.floor((i / n) * bands.length)];
const pickCycle = (i, arr) => arr[i % arr.length];

function pad2(n) { return String(n).padStart(2, "0"); }

// ─────────────────────────────────────────────────────────────────────────────
// Static, registry-grounded enums
// ─────────────────────────────────────────────────────────────────────────────

const SIG = {
  patternThinning: "pattern-thinning-marker",
  diffuseShedding: "diffuse-shedding-marker",
  shaftBreakage: "shaft-breakage-marker",
  patchyLoss: "patchy-loss-marker",
  sheddingMild: "active-shedding-mild",
  sheddingHeavy: "active-shedding-heavy",
  thinningNoShed: "thinning-without-shedding",
  acute: "acute-duration-marker",
  subacute: "subacute-duration-marker",
  chronic: "chronic-duration-marker",
  grade123: "grade123-severity-marker",
  grade45: "grade45-severity-marker",
  dandruff: "dandruff-presence",
  dandruffItch: "dandruff-with-itching",
  oily: "oily-scalp",
  dry: "dry-scalp",
  redness: "scalp-redness",
  pustules: "scalp-pustules",
  burning: "scalp-burning",
  psoriaticScalp: "psoriatic-scalp",
  normalScalp: "normal-scalp",
  genetic: "genetic-predisposition-reported",
  stress: "chronic-stress-reported",
  trich: "trichotillomania-behavior",
  selfReportedNutritional: "nutritional-cause-self-reported",
  postIllness: "post-illness-recovery",
  postpartumLact: "postpartum-lactating",
  postpartumNoLact: "postpartum-not-lactating",
  glp1Recent: "glp1-recent",
  glp1Late: "glp1-late",
  crashDiet: "crash-diet-pattern",
  irregularDiet: "irregular-diet-pattern",
  vegetarian: "vegetarian-diet",
  vegan: "vegan-diet",
  highProtein: "high-protein-diet",
  ironDef: "iron-deficiency-reported",
  vitDDef: "vitamin-d-deficiency-reported",
  b12Def: "vitamin-b12-deficiency-reported",
  hypo: "hypothyroid-diagnosis",
  hyper: "hyperthyroid-diagnosis",
  prediab: "prediabetes-state",
  diabetes: "diabetes-state",
  obese: "obesity-sedentary",
  bodybuild: "bodybuilding-pattern",
  smoke: "smoking-exposure",
  alcohol: "alcohol-exposure",
  nightShift: "night-shift-exposure",
  flying: "frequent-flying-exposure",
  aaHistory: "alopecia-areata-history",
  recurrentInfection: "recurrent-infection-pattern",
  allergyCluster: "allergy-cluster",
  asthma: "asthma-history",
  skinRash: "skin-rash-history",
  scarring: "scarring-alopecia-history",
  mouthUlcers: "mouth-ulcers-cooccurrence",
  gerd: "gerd-symptoms",
  ibs: "ibs-or-constipation",
  bloating: "bloating-symptoms",
  pcos: "pcos-diagnosis",
  pcosMetabolic: "pcos-with-metabolic",
  endometriosis: "endometriosis-diagnosis",
  pregnancy: "pregnancy-state",
  perimeno: "perimenopause-state",
  meno: "menopause-state",
  postmeno: "postmenopause-state",
  hrt: "hrt-use",
  chronicMed: "chronic-medical-on-medication",
  heat: "heat-styling-exposure",
  chemical: "chemical-treatment-exposure",
  hardWater: "hard-water-exposure",
  earlyGrey: "early-greying-presence",
  ageYoung: "age-young-modifier",
  ageMid: "age-mid-modifier",
  ageMature: "age-mature-modifier",
  ageSenior: "age-senior-modifier",
  male: "sex-male",
  female: "sex-female",
  regrow: "regrow-goal",
};

const PW = {
  miniaturization: "follicular-miniaturization",
  telogen: "telogen-cycle-disruption",
  scalpInflam: "scalp-inflammation",
  hormonal: "hormonal-dysregulation",
  immune: "immune-dysregulation",
  metabolic: "metabolic-dysfunction",
  oxidative: "oxidative-stress",
  gut: "gut-hair-axis-dysfunction",
  nutritional: "nutritional-limitation",
  shaft: "hair-shaft-damage",
};

const C = {
  andro: "androgen-driven-miniaturization",
  te: "stress-driven-telogen-effluvium",
  nutr: "nutritional-hair-stress",
  hormonal: "hormonal-hair-loss",
  metab: "metabolic-hair-dysfunction",
  autoimmune: "autoimmune-hair-loss",
  gut: "gut-hair-axis-dysfunction",
  inflam: "inflammatory-scalp-dysfunction",
  shaft: "hair-shaft-damage-syndrome",
  multi: "multifactorial-hair-loss",
};

const ageBucketSignal = (age) =>
  age < 25 ? SIG.ageYoung
  : age < 40 ? SIG.ageMid
  : age < 55 ? SIG.ageMature
  : SIG.ageSenior;

const severityFromGrade = (g) => (g <= 2 ? "mild" : g <= 4 ? "moderate" : "severe");

// ─────────────────────────────────────────────────────────────────────────────
// Per-category templates
// Each emits ONE case given (i: 0..n-1, n: count)
// ─────────────────────────────────────────────────────────────────────────────

function maleAGA(i, n) {
  const ages = [19, 22, 24, 27, 29, 31, 33, 35, 37, 39, 42, 45, 48, 51, 54, 57, 60, 64, 68, 72];
  const age = ages[i % ages.length];
  const grade = pickCycle(i, [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]);
  const sev = severityFromGrade(grade);
  const presentation =
    i % 10 === 0 ? "ambiguous" : i % 13 === 0 ? "conflicting" : i % 17 === 0 ? "edge_case" : "clear";

  const adversarialFlavor = i % 5 === 0; // 10/50 adversarial
  const ironLow = adversarialFlavor && i % 10 === 0;
  const heavyInflam = adversarialFlavor && i % 10 === 5;
  const stressed = i % 7 === 0;
  const oily = grade >= 2 && i % 3 !== 0;
  const family = i % 4 !== 0;
  const duration = grade >= 4 ? "More than 1 year" : grade >= 2 ? "6–12 months" : "3–6 months";
  const cnt = "thinning visible, minimal fall";

  const caseId = `male_aga_${pad2(i + 1)}_g${grade}_age${age}${ironLow ? "_ironlow" : ""}${heavyInflam ? "_inflam" : ""}`;
  const desc = `Male AGA Norwood ${grade}, ${age}y${ironLow ? ", with ferritin deficiency (adversarial)" : ""}${heavyInflam ? ", with seborrheic dermatitis (adversarial)" : ""}.`;

  const answers = {
    sex: "Male",
    age: String(age),
    goal: grade >= 4 ? ["Reduce hair fall"] : ["Reduce hair fall", "Regrow lost hair"],
    grade: `Grade ${grade}`,
    scalp: oily ? ["Oily scalp"] : ["Normal scalp"],
    cause: family ? ["Family history"] : [],
    lifestyle: stressed ? ["Chronic stress", "Poor sleep"] : [],
    thyroid: [],
    hormonal: [],
    immunity: [],
    deficiency: ironLow ? ["Iron deficiency"] : [],
    gut: [],
    diet: [],
    hairtype: grade >= 4 ? ["Thinning at crown", "Receding hairline"] : ["Receding hairline"],
    treatment: [],
    duration,
    count: cnt,
  };
  if (heavyInflam) answers.scalp = ["Oily scalp", "Dandruff with itching"];

  const expectedSignals = [
    { signalId: SIG.patternThinning, minConfidence: 0.75, mustBePrimary: true },
    { signalId: SIG.thinningNoShed, minConfidence: 0.55 },
    { signalId: grade >= 4 ? SIG.grade45 : SIG.grade123, minConfidence: 0.75 },
    { signalId: SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
  ];
  if (family) expectedSignals.push({ signalId: SIG.genetic, minConfidence: 0.7 });
  if (oily) expectedSignals.push({ signalId: SIG.oily, minConfidence: 0.7 });
  if (ironLow) expectedSignals.push({ signalId: SIG.ironDef, minConfidence: 0.75 });
  if (heavyInflam) {
    expectedSignals.push({ signalId: SIG.dandruffItch, minConfidence: 0.75 });
  }
  if (stressed) expectedSignals.push({ signalId: SIG.stress, minConfidence: 0.6 });

  const expectedPathways = [
    { pathwayId: PW.miniaturization, minActivation: 0.6, role: "leading" },
  ];
  if (heavyInflam) expectedPathways.push({ pathwayId: PW.scalpInflam, minActivation: 0.45, role: "supporting" });
  if (ironLow) expectedPathways.push({ pathwayId: PW.nutritional, minActivation: 0.4, role: "supporting" });
  if (stressed) expectedPathways.push({ pathwayId: PW.telogen, minActivation: 0.35, role: "modulator" });

  const expectedRootCauses = [
    { causeId: C.andro, minPosterior: 0.45, surfaceAs: "lead" },
  ];
  if (ironLow) expectedRootCauses.push({ causeId: C.nutr, minPosterior: 0.15, surfaceAs: "candidate" });
  if (heavyInflam) expectedRootCauses.push({ causeId: C.inflam, minPosterior: 0.15, surfaceAs: "candidate" });

  const legacy = grade >= 4 ? "AGA_MALE_45" : "AGA_MALE_123";
  const protocolClass = "MPHL";
  const mustIncludeKits = ["MPHL"];
  const mustExcludeKits = ["HAIR FACT TE GOLD", "HAIR FACT TE GOLD VEG"];
  if (heavyInflam) mustIncludeKits.push("PHENOTYPE INFLAMATION");
  if (ironLow) mustIncludeKits.push("IRON");
  const mustTriggerRules = grade >= 4 ? ["NO_VISIBLE_FALL", "GRADE45_LOCK"] : ["NO_VISIBLE_FALL"];
  const mustBlockRules = ["ACTIVE_SHEDDING", "PREGNANCY_LOCK"];

  const therapyNeeds = ["DHT_SUPPRESSION", "INFLAMMATION_CONTROL"];
  if (heavyInflam) therapyNeeds.push("SCALP_DECONGESTION");
  if (ironLow) therapyNeeds.push("NUTRITIONAL_REPLETION");

  const monitoring = {
    required: ["GLOBAL_PHOTO_3M", "TRICHOSCOPY_6M"],
    recommended: ["SHED_COUNT_MONTHLY"],
    forbidden: ["MENSTRUAL_DIARY", "ANDROGEN_PANEL_6M"],
  };
  if (ironLow) monitoring.required.push("FERRITIN_4M");
  if (heavyInflam) monitoring.required.push("SCALP_EXAM_3M");

  const narrative = {
    themes: ["ANDROGENIC_PROGRESSION", "EXPECTATION_SETTING_SLOW"],
    mustContainTokens: ["androgen", "miniatur"],
    mustNotContainTokens: ["guaranteed regrowth", "cure"],
  };
  if (heavyInflam) narrative.themes.push("INFLAMMATORY_QUIESCENCE");
  if (ironLow) narrative.themes.push("NUTRITIONAL_RESTORATION");

  const competitors = {
    [C.te]: "Architectural thinning without heavy diffuse shedding makes a telogen-driven explanation weaker; TE would require a synchronized precipitant and acute timing that this case does not show.",
    [C.inflam]: heavyInflam
      ? "Scalp inflammation co-presents but does not lead because the underlying pattern thinning is anatomically androgenic; inflammation is downstream amplifier, not the named driver."
      : "Normal/oily scalp without burning, pustules, or psoriatic plaques does not support inflammation as the primary explanation.",
    [C.autoimmune]: "No patchy loss, no areata history, no scarring markers — autoimmune cause is excluded at the signal layer.",
    [C.nutr]: ironLow
      ? "Iron deficiency is a real co-driver but the pattern topology and grade progression cannot be explained by substrate insufficiency alone; nutrition is repleted in parallel without leading the explanation."
      : "No reported deficiency markers and no nutritional risk pattern.",
    [C.multi]: "Only one or two pathways exceed 0.40 activation; compositeRule (≥3 pathways) is not satisfied so multifactorial cannot lead.",
  };

  const whyPrimary = `Male, age ${age}, with progressive Norwood-${grade} pattern thinning concentrated at crown/temporal regions, ${family ? "family history positive, " : ""}${oily ? "seborrheic scalp tendency, " : ""}and minimal active shedding. The pattern topology (terminal-to-vellus transition without diffuse shed) is the definitional signature of androgen-driven miniaturization. Pathway activation is dominated by follicular miniaturization (≥0.60) with the telogen pathway only modestly activated, which the cause registry's log-likelihood weights resolve into a dominant posterior for androgen-driven miniaturization. The case therefore leads on the androgenic cause with the standard MPHL protocol class and Norwood-grade-locked kit gating.`;

  const rationale = { whyPrimary, whyNotCompetitors: competitors };

  const c = {
    caseId,
    corpusVersion: "2.0.0",
    description: desc,
    category: "MALE_AGA",
    severity: sev,
    presentationClarity: presentation,
    demographicProfile: { sex: "Male", age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals,
    expectedPathways,
    expectedRootCauses,
    expectedDiagnosis: {
      primary: C.andro,
      secondary: ironLow ? [C.nutr] : heavyInflam ? [C.inflam] : [],
      legacyDiagnosisKey: legacy,
      legacyDiagnosisKeyAlternates: grade >= 4 ? ["AGA_GRADE45_LOCK"] : [],
    },
    expectedSeverity: sev,
    expectedProtocolClass: protocolClass,
    expectedTherapyNeeds: therapyNeeds,
    expectedMonitoringRequirements: monitoring,
    expectedNarrativeThemes: narrative,
    clinicalRationale: rationale,
  };
  if (adversarialFlavor) {
    c.adversarial = {
      isAdversarial: true,
      expectedPrimaryDriver: C.andro,
      expectedSecondaryDrivers: ironLow ? [C.nutr] : heavyInflam ? [C.inflam] : [C.te],
      commonFailureModes: [
        ironLow
          ? { failureMode: "NUTRITIONAL_OVERTAKES_ANDROGENIC", impactedComponent: "ROOTCAUSE", description: "Iron-deficiency signal weight can push a naive Bayes ranker into nutritional cause leadership; the pattern signature must outweigh it." }
          : heavyInflam
          ? { failureMode: "INFLAMMATION_MASKS_AGA", impactedComponent: "ROOTCAUSE", description: "Heavy scalp-inflammation signals can suppress miniaturization activation in a naive pathway engine; miniaturization minActivation must be respected." }
          : { failureMode: "STRESS_TE_FALSE_POSITIVE", impactedComponent: "ROOTCAUSE", description: "Chronic stress reporting can spuriously route to TE without active diffuse shedding." },
      ],
    };
    if (heavyInflam) c.adversarial.commonFailureModes.push({
      failureMode: "INFLAMMATORY_PROTOCOL_OVERRIDE",
      impactedComponent: "PROTOCOL",
      description: "Protocol must combine MPHL with PHENOTYPE INFLAMATION rather than shifting class to INFLAMMATORY.",
    });
  }
  return c;
}

function fphl(i, n) {
  const ages = [28, 32, 36, 40, 44, 48, 50, 52, 54, 56, 58, 60, 62, 65, 68];
  const age = ages[i % ages.length];
  const ludwig = pickCycle(i, [1, 1, 2, 2, 2, 3, 3]);
  const grade = ludwig + 1;
  const sev = severityFromGrade(grade);
  const meno = age >= 55 ? "post" : age >= 48 ? "peri" : null;
  const adversarial = i % 4 === 0;
  const ironLow = adversarial && i % 8 === 0;
  const hypoCo = adversarial && i % 8 === 4;
  const presentation = i % 7 === 0 ? "ambiguous" : "clear";
  const caseId = `fphl_${pad2(i + 1)}_lud${ludwig}_age${age}${meno ? "_" + meno : ""}${ironLow ? "_ironlow" : ""}${hypoCo ? "_hypo" : ""}`;
  const description = `Female AGA Ludwig ${ludwig}, ${age}y${meno ? `, ${meno}menopausal` : ""}${ironLow ? ", ferritin deficient (adversarial)" : ""}${hypoCo ? ", hypothyroid co-driver (adversarial)" : ""}.`;
  const answers = {
    sex: "Female",
    age: String(age),
    goal: ["Reduce hair fall", "Regrow lost hair"],
    grade: `Grade ${grade}`,
    scalp: ["Normal scalp"],
    cause: ["Family history"],
    lifestyle: [],
    thyroid: hypoCo ? ["Hypothyroidism"] : [],
    hormonal: meno === "post" ? ["Postmenopause"] : meno === "peri" ? ["Perimenopause"] : [],
    immunity: [],
    deficiency: ironLow ? ["Iron deficiency"] : [],
    gut: [],
    diet: [],
    hairtype: ["Widening parting", "Thinning at crown"],
    treatment: [],
    duration: "More than 1 year",
    count: "thinning visible, minimal fall",
  };
  const expectedSignals = [
    { signalId: SIG.patternThinning, minConfidence: 0.75, mustBePrimary: true },
    { signalId: SIG.thinningNoShed, minConfidence: 0.55 },
    { signalId: grade >= 4 ? SIG.grade45 : SIG.grade123, minConfidence: 0.7 },
    { signalId: SIG.female, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
    { signalId: SIG.genetic, minConfidence: 0.7 },
  ];
  if (meno === "post") expectedSignals.push({ signalId: SIG.postmeno, minConfidence: 0.85 });
  if (meno === "peri") expectedSignals.push({ signalId: SIG.perimeno, minConfidence: 0.8 });
  if (ironLow) expectedSignals.push({ signalId: SIG.ironDef, minConfidence: 0.75 });
  if (hypoCo) expectedSignals.push({ signalId: SIG.hypo, minConfidence: 0.85 });
  const expectedPathways = [
    { pathwayId: PW.miniaturization, minActivation: 0.55, role: "leading" },
    { pathwayId: PW.hormonal, minActivation: 0.4, role: "supporting" },
  ];
  if (ironLow) expectedPathways.push({ pathwayId: PW.nutritional, minActivation: 0.4, role: "supporting" });

  const expectedRootCauses = [
    { causeId: C.andro, minPosterior: 0.3, surfaceAs: "co-lead" },
    { causeId: C.hormonal, minPosterior: 0.3, surfaceAs: "co-lead" },
  ];
  if (ironLow) expectedRootCauses.push({ causeId: C.nutr, minPosterior: 0.12, surfaceAs: "candidate" });

  const c = {
    caseId,
    corpusVersion: "2.0.0",
    description,
    category: "FPHL",
    severity: sev,
    presentationClarity: presentation,
    demographicProfile: { sex: "Female", age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals,
    expectedPathways,
    expectedRootCauses,
    expectedDiagnosis: {
      primary: C.andro,
      secondary: [C.hormonal].concat(ironLow ? [C.nutr] : []),
      legacyDiagnosisKey: grade >= 4 ? "AGA_FEMALE_45" : "AGA_FEMALE_123",
      legacyDiagnosisKeyAlternates: meno === "post" ? ["MENOPAUSAL_HAIRLOSS"] : meno === "peri" ? ["PERIMENOPAUSE_HAIRLOSS"] : [],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "FPHL",
    expectedTherapyNeeds: ["DHT_SUPPRESSION", "ENDOCRINE_OPTIMIZATION", "INFLAMMATION_CONTROL"].concat(ironLow ? ["NUTRITIONAL_REPLETION"] : []),
    expectedMonitoringRequirements: {
      required: ["GLOBAL_PHOTO_3M", "TRICHOSCOPY_6M"].concat(ironLow ? ["FERRITIN_4M", "VITAMIN_D_4M"] : []).concat(hypoCo ? ["TSH_3M", "FREE_T4_3M"] : []),
      recommended: ["SHED_COUNT_MONTHLY"],
      forbidden: ["ANDROGEN_PANEL_6M"],
    },
    expectedNarrativeThemes: {
      themes: ["ANDROGENIC_PROGRESSION", "ENDOCRINE_REBALANCE", "EXPECTATION_SETTING_SLOW"].concat(ironLow ? ["NUTRITIONAL_RESTORATION"] : []),
      mustContainTokens: ["androgen", meno ? "menopaus" : "hormonal"],
      mustNotContainTokens: ["guaranteed regrowth"],
    },
    clinicalRationale: {
      whyPrimary: `Female, age ${age}, Ludwig ${ludwig} pattern with widening parting, ${meno ? meno + "menopausal endocrine state, " : ""}family history positive, minimal active shedding. The crown-emphasized topology with intact frontal hairline is the female-pattern signature of androgen-driven miniaturization expressed within an endocrine context. Both miniaturization (≥0.55) and hormonal-dysregulation (≥0.40) pathways activate, producing a co-leading androgenic + hormonal cause posterior — the legacy DiagnosisKey for FPHL maps directly to this co-explanation.`,
      whyNotCompetitors: {
        [C.te]: "No acute precipitant, no synchronized diffuse shedding lagging a known stressor by 2–4 months; chronic timing without heavy shed weakens TE.",
        [C.autoimmune]: "No patchy loss or areata/scarring history.",
        [C.inflam]: "Scalp surface is unremarkable; inflammation signals do not fire above background.",
        [C.nutr]: ironLow ? "Iron deficiency is a co-driver but does not produce pattern topology; corrected in parallel without taking leadership." : "No deficiency signals.",
        [C.multi]: "Only two pathways exceed 0.40; compositeRule (≥3 pathways) not met.",
      },
    },
  };
  if (adversarial) {
    c.adversarial = {
      isAdversarial: true,
      expectedPrimaryDriver: C.andro,
      expectedSecondaryDrivers: [C.hormonal].concat(ironLow ? [C.nutr] : hypoCo ? [C.hormonal] : []),
      commonFailureModes: [
        ironLow
          ? { failureMode: "FEMALE_AGA_MISSED_AS_NUTRITIONAL", impactedComponent: "ROOTCAUSE", description: "In women, ferritin deficiency frequently drowns out pattern signal; topology weight must dominate." }
          : hypoCo
          ? { failureMode: "FEMALE_AGA_MISSED_AS_HORMONAL_ONLY", impactedComponent: "ROOTCAUSE", description: "Hypothyroid signal can take exclusive leadership; androgenic co-explanation must be preserved." }
          : { failureMode: "FEMALE_AGA_UNDERSCORED", impactedComponent: "ROOTCAUSE", description: "Female AGA frequently surfaces below male-equivalent due to lower base rate priors." },
      ],
    };
  }
  return c;
}

function pcosCase(i, n) {
  const ages = [19, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48];
  const age = ages[i % ages.length];
  const lean = i % 5 === 0;
  const normoAndrogen = i % 7 === 0;
  const postBariatric = i % 11 === 0;
  const adversarial = lean || normoAndrogen || postBariatric;
  const sev = adversarial ? "moderate" : pickCycle(i, ["mild", "moderate", "severe"]);
  const grade = sev === "severe" ? 4 : sev === "moderate" ? 3 : 2;
  const caseId = `pcos_${pad2(i + 1)}_age${age}${lean ? "_lean" : ""}${normoAndrogen ? "_normoandrogen" : ""}${postBariatric ? "_postbariatric" : ""}`;
  const desc = `PCOS-associated hair loss, ${age}y${lean ? ", lean phenotype (adversarial)" : ""}${normoAndrogen ? ", normal androgen panel (adversarial)" : ""}${postBariatric ? ", post-bariatric surgery (adversarial)" : ""}.`;
  const answers = {
    sex: "Female",
    age: String(age),
    goal: ["Reduce hair fall", "Regrow lost hair"],
    grade: `Grade ${grade}`,
    scalp: ["Oily scalp"],
    cause: ["Family history"],
    lifestyle: [],
    thyroid: [],
    hormonal: ["PCOS"].concat(lean ? [] : ["Irregular periods"]),
    immunity: [],
    deficiency: postBariatric ? ["Iron deficiency", "Vitamin B12 deficiency"] : [],
    gut: postBariatric ? ["Bloating"] : [],
    diet: postBariatric ? ["Post-bariatric"] : [],
    hairtype: ["Widening parting", "Thinning at crown"],
    treatment: [],
    duration: "More than 1 year",
    count: "thinning visible with moderate fall",
  };
  const expectedSignals = [
    { signalId: SIG.patternThinning, minConfidence: 0.65 },
    { signalId: SIG.pcos, minConfidence: 0.95, mustBePrimary: true },
    { signalId: SIG.female, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
    { signalId: SIG.oily, minConfidence: 0.7 },
    { signalId: grade >= 4 ? SIG.grade45 : SIG.grade123, minConfidence: 0.65 },
  ];
  if (!lean) expectedSignals.push({ signalId: SIG.pcosMetabolic, minConfidence: 0.65 });
  if (postBariatric) {
    expectedSignals.push({ signalId: SIG.ironDef, minConfidence: 0.8 });
    expectedSignals.push({ signalId: SIG.b12Def, minConfidence: 0.75 });
    expectedSignals.push({ signalId: SIG.bloating, minConfidence: 0.7 });
  }
  const expectedPathways = [
    { pathwayId: PW.hormonal, minActivation: 0.6, role: "leading" },
    { pathwayId: PW.miniaturization, minActivation: 0.45, role: "supporting" },
  ];
  if (!lean) expectedPathways.push({ pathwayId: PW.metabolic, minActivation: 0.45, role: "supporting" });
  if (postBariatric) expectedPathways.push({ pathwayId: PW.nutritional, minActivation: 0.5, role: "supporting" });

  const expectedRootCauses = [
    { causeId: C.hormonal, minPosterior: 0.4, surfaceAs: "lead" },
    { causeId: C.andro, minPosterior: 0.18, surfaceAs: "co-lead" },
  ];
  if (!lean) expectedRootCauses.push({ causeId: C.metab, minPosterior: 0.12, surfaceAs: "candidate" });
  if (postBariatric) expectedRootCauses.push({ causeId: C.nutr, minPosterior: 0.15, surfaceAs: "candidate" });

  const c = {
    caseId,
    corpusVersion: "2.0.0",
    description: desc,
    category: "PCOS",
    severity: sev,
    presentationClarity: adversarial ? "ambiguous" : "clear",
    demographicProfile: { sex: "Female", age: String(age), region: null, dietType: "Mixed", bmiBand: lean ? "normal" : "overweight" },
    questionnaireAnswers: answers,
    expectedSignals,
    expectedPathways,
    expectedRootCauses,
    expectedDiagnosis: {
      primary: C.hormonal,
      secondary: [C.andro].concat(!lean ? [C.metab] : []).concat(postBariatric ? [C.nutr] : []),
      legacyDiagnosisKey: !lean ? "PCOS_METABOLIC" : "PCOS_HAIRLOSS",
      legacyDiagnosisKeyAlternates: ["PCOS_HAIRLOSS"],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "PCOS",
    expectedTherapyNeeds: ["ENDOCRINE_OPTIMIZATION", "DHT_SUPPRESSION", "INFLAMMATION_CONTROL"].concat(!lean ? ["METABOLIC_OPTIMIZATION"] : []).concat(postBariatric ? ["NUTRITIONAL_REPLETION", "GUT_REPAIR"] : []),
    expectedMonitoringRequirements: {
      required: ["GLOBAL_PHOTO_3M", "ANDROGEN_PANEL_6M", "MENSTRUAL_DIARY"].concat(!lean ? ["HBA1C_3M", "WEIGHT_MONTHLY"] : []).concat(postBariatric ? ["FERRITIN_4M", "B12_4M", "VITAMIN_D_4M"] : []),
      recommended: ["SHED_COUNT_MONTHLY"],
      forbidden: [],
    },
    expectedNarrativeThemes: {
      themes: ["ENDOCRINE_REBALANCE", "ANDROGENIC_PROGRESSION"].concat(!lean ? ["MULTIFACTORIAL_COORDINATION"] : []).concat(postBariatric ? ["NUTRITIONAL_RESTORATION"] : []),
      mustContainTokens: ["pcos", "androgen"],
      mustNotContainTokens: ["guaranteed", "cure"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old woman with PCOS diagnosis${!lean ? " and metabolic features" : ""}, oily scalp, pattern thinning at crown, ${grade >= 4 ? "Grade 4-5 severity" : "Grade " + grade + " severity"}, family history positive. The endocrine driver (PCOS) carries the strongest log-likelihood weight in the cause registry for this signal mix; miniaturization activates as a downstream mechanism but the named driver is hormonal because endocrine signals dominate. ${postBariatric ? "Post-bariatric nutritional state co-activates nutritional-limitation pathway requiring parallel repletion. " : ""}${!lean ? "Metabolic-dysfunction pathway co-activates via insulin–androgen cross-talk. " : ""}Protocol class is PCOS with mandatory metabolic and endocrine monitoring.`,
      whyNotCompetitors: {
        [C.andro]: "Androgenic cause co-explains but the named upstream driver is endocrine (PCOS) — captured by the legacy 'co-explanation' parity strategy in the cause registry.",
        [C.te]: "No acute precipitant, no synchronized telogen wave.",
        [C.autoimmune]: "No patchy loss markers.",
        [C.inflam]: "Oily scalp without inflammatory markers (no itching, redness, pustules); insufficient for primary inflammation lead.",
        [C.multi]: "Two-to-three pathways activate but causal hierarchy is clear — endocrine leads.",
      },
    },
  };
  if (adversarial) {
    c.adversarial = {
      isAdversarial: true,
      expectedPrimaryDriver: C.hormonal,
      expectedSecondaryDrivers: [C.andro].concat(postBariatric ? [C.nutr] : !lean ? [C.metab] : []),
      commonFailureModes: [
        lean
          ? { failureMode: "PCOS_LEAN_MISSED", impactedComponent: "SIGNAL", description: "Lean PCOS without metabolic comorbidity often fails to trigger pcos-with-metabolic; pcos-diagnosis alone must still carry leading endocrine weight." }
          : normoAndrogen
          ? { failureMode: "PCOS_NORMO_MISCLASS", impactedComponent: "ROOTCAUSE", description: "Normal serum androgens at sampling do not exclude follicular sensitivity; cause must remain hormonal." }
          : { failureMode: "POST_BARIATRIC_NUTRITIONAL_OVERTAKE", impactedComponent: "ROOTCAUSE", description: "Deficiency stack can suppress PCOS leadership; nutritional cause must remain candidate-level." },
      ],
    };
  }
  return c;
}

function acuteTE(i, n) {
  const flavors = [
    { key: "post_fever", label: "post-fever", signals: [SIG.postIllness] },
    { key: "postpartum_lact", label: "postpartum-lactating", signals: [SIG.postpartumLact] },
    { key: "postpartum_no_lact", label: "postpartum-not-lactating", signals: [SIG.postpartumNoLact] },
    { key: "crash_diet", label: "crash-diet", signals: [SIG.crashDiet] },
    { key: "surgical", label: "post-surgical", signals: [SIG.postIllness] },
    { key: "drug_induced", label: "drug-induced", signals: [SIG.chronicMed] },
    { key: "stress_acute", label: "acute-severe-stress", signals: [SIG.stress] },
  ];
  const f = flavors[i % flavors.length];
  const sex = f.key.startsWith("postpartum") ? "Female" : (i % 2 === 0 ? "Female" : "Male");
  const age = sex === "Female" ? [22, 26, 29, 31, 33, 36, 39, 42][i % 8] : [24, 28, 32, 36, 40, 44][i % 6];
  const sev = pickCycle(i, ["mild", "moderate", "moderate", "severe"]);
  const adversarial = i % 4 === 0;
  const caseId = `te_acute_${pad2(i + 1)}_${f.key}_age${age}`;
  const desc = `Acute telogen effluvium, ${f.label}, ${age}y ${sex}.`;
  const answers = {
    sex, age: String(age),
    goal: ["Reduce hair fall"],
    grade: "Grade 1",
    scalp: ["Normal scalp"],
    cause: f.key === "stress_acute" ? ["Stress"] : f.key === "crash_diet" ? ["Crash diet"] : f.key.startsWith("postpartum") ? ["Postpartum"] : f.key === "drug_induced" ? ["Medications"] : ["Recent illness"],
    lifestyle: f.key === "stress_acute" ? ["Chronic stress", "Poor sleep"] : [],
    thyroid: [],
    hormonal: f.key === "postpartum_lact" ? ["Postpartum"] : f.key === "postpartum_no_lact" ? ["Postpartum"] : [],
    immunity: [],
    deficiency: f.key === "crash_diet" ? ["Iron deficiency"] : [],
    gut: [],
    diet: f.key === "crash_diet" ? ["Crash dieting"] : [],
    hairtype: ["Diffuse shedding"],
    treatment: f.key === "drug_induced" ? ["Recently on medication"] : [],
    duration: sev === "mild" ? "Less than 3 months" : "3–6 months",
    count: sev === "severe" ? "more than 200 hairs/day" : "100–200 hairs/day",
  };
  const expectedSignals = [
    { signalId: SIG.diffuseShedding, minConfidence: 0.85, mustBePrimary: true },
    { signalId: sev === "mild" ? SIG.sheddingMild : SIG.sheddingHeavy, minConfidence: 0.75 },
    { signalId: SIG.acute, minConfidence: 0.8 },
    { signalId: sex === "Female" ? SIG.female : SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
    ...f.signals.map((s) => ({ signalId: s, minConfidence: 0.75 })),
  ];
  if (f.key === "crash_diet") expectedSignals.push({ signalId: SIG.ironDef, minConfidence: 0.75 });

  const expectedPathways = [
    { pathwayId: PW.telogen, minActivation: 0.6, role: "leading" },
  ];
  if (f.key === "crash_diet") expectedPathways.push({ pathwayId: PW.nutritional, minActivation: 0.45, role: "supporting" });
  if (f.key.startsWith("postpartum")) expectedPathways.push({ pathwayId: PW.hormonal, minActivation: 0.4, role: "supporting" });

  const expectedRootCauses = [
    { causeId: C.te, minPosterior: 0.45, surfaceAs: "lead" },
  ];
  if (f.key === "crash_diet") expectedRootCauses.push({ causeId: C.nutr, minPosterior: 0.18, surfaceAs: "co-lead" });
  if (f.key.startsWith("postpartum")) expectedRootCauses.push({ causeId: C.hormonal, minPosterior: 0.18, surfaceAs: "co-lead" });

  const legacy = f.key.startsWith("postpartum") ? "POSTPARTUM_TE" : f.key === "post_fever" || f.key === "surgical" ? "POST_ILLNESS_TE" : f.key === "crash_diet" ? "NUTRITIONAL_TE" : "ACUTE_TE";

  const c = {
    caseId, corpusVersion: "2.0.0", description: desc, category: "ACUTE_TE",
    severity: sev, presentationClarity: adversarial ? "ambiguous" : "clear",
    demographicProfile: { sex, age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals, expectedPathways, expectedRootCauses,
    expectedDiagnosis: {
      primary: C.te,
      secondary: f.key === "crash_diet" ? [C.nutr] : f.key.startsWith("postpartum") ? [C.hormonal] : [],
      legacyDiagnosisKey: legacy,
      legacyDiagnosisKeyAlternates: ["ACUTE_TE"],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "TE_ACUTE",
    expectedTherapyNeeds: ["CYCLE_RESTORATION", "STRESS_DOWNREGULATION", "NUTRITIONAL_REPLETION"],
    expectedMonitoringRequirements: {
      required: ["SHED_COUNT_MONTHLY", "GLOBAL_PHOTO_3M"].concat(f.key === "crash_diet" ? ["FERRITIN_4M", "VITAMIN_D_4M"] : []).concat(f.key.startsWith("postpartum") ? ["TSH_3M"] : []),
      recommended: ["STRESS_PHQ_MONTHLY"],
      forbidden: ["ANDROGEN_PANEL_6M"],
    },
    expectedNarrativeThemes: {
      themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "STRESS_RECOVERY"].concat(f.key === "crash_diet" ? ["NUTRITIONAL_RESTORATION"] : []),
      mustContainTokens: ["telogen", "reversible"],
      mustNotContainTokens: ["permanent loss"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old ${sex.toLowerCase()} presenting with diffuse synchronized shedding lagging a clear precipitant (${f.label}) by the expected 2–4 month telogen cycle. Shedding intensity (${answers.count}), acute duration, and absence of pattern topology produce a dominant telogen-cycle-disruption activation. Architectural follicle integrity is preserved — this is cycle-timing pathology, fully reversible, and protocol class TE_ACUTE applies with cycle-restoration and stress-downregulation therapy needs. ${f.key === "crash_diet" ? "Nutritional-limitation co-activates and is repleted in parallel as co-explanation." : f.key.startsWith("postpartum") ? "Postpartum hormonal shift co-explains and is acknowledged in the narrative." : ""}`,
      whyNotCompetitors: {
        [C.andro]: "No pattern thinning topology, no Norwood/Ludwig progression, and active heavy shedding without architectural change weighs against miniaturization.",
        [C.autoimmune]: "No patchy loss, no areata history.",
        [C.inflam]: "Scalp surface is unremarkable.",
        [C.nutr]: f.key === "crash_diet" ? "Co-driver, surfaced as co-lead." : "No deficiency markers.",
        [C.multi]: "A single clear precipitant + single dominant pathway means compositeRule is not met.",
      },
    },
  };
  if (adversarial) {
    c.adversarial = {
      isAdversarial: true,
      expectedPrimaryDriver: C.te,
      expectedSecondaryDrivers: f.key === "crash_diet" ? [C.nutr] : f.key.startsWith("postpartum") ? [C.hormonal] : [],
      commonFailureModes: [
        { failureMode: "TE_AS_AGA", impactedComponent: "ROOTCAUSE", description: "Crown-emphasized telogen patterns can be misread as AGA when grade markers fire defensively." },
      ],
    };
  }
  return c;
}

function chronicTE(i, n) {
  const flavors = ["chronic_stress", "chronic_illness", "idiopathic", "shift_work", "chronic_dieter"];
  const f = flavors[i % flavors.length];
  const sex = i % 2 === 0 ? "Female" : "Male";
  const age = [28, 32, 36, 40, 44, 48, 52][i % 7];
  const sev = pickCycle(i, ["mild", "moderate", "severe"]);
  const adversarial = i % 4 === 0; // ~5 adversarial
  const caseId = `te_chronic_${pad2(i + 1)}_${f}_age${age}_${sex.toLowerCase()}`;
  const desc = `Chronic telogen effluvium, ${f.replace("_", " ")}, ${age}y ${sex}.`;
  const answers = {
    sex, age: String(age),
    goal: ["Reduce hair fall"],
    grade: "Grade 1",
    scalp: ["Normal scalp"],
    cause: f === "chronic_stress" ? ["Stress"] : f === "chronic_illness" ? ["Chronic medical condition"] : [],
    lifestyle: f === "chronic_stress" ? ["Chronic stress", "Poor sleep"] : f === "shift_work" ? ["Night shifts"] : [],
    thyroid: [], hormonal: [], immunity: [],
    deficiency: f === "chronic_dieter" ? ["Iron deficiency", "Vitamin D deficiency"] : [],
    gut: [], diet: f === "chronic_dieter" ? ["Irregular meals"] : [],
    hairtype: ["Diffuse shedding"], treatment: [],
    duration: "More than 1 year",
    count: sev === "severe" ? "more than 200 hairs/day" : "100–200 hairs/day",
  };
  const expectedSignals = [
    { signalId: SIG.diffuseShedding, minConfidence: 0.8, mustBePrimary: true },
    { signalId: SIG.chronic, minConfidence: 0.85 },
    { signalId: sev === "severe" ? SIG.sheddingHeavy : SIG.sheddingMild, minConfidence: 0.7 },
    { signalId: sex === "Female" ? SIG.female : SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
  ];
  if (f === "chronic_stress") expectedSignals.push({ signalId: SIG.stress, minConfidence: 0.85 });
  if (f === "chronic_illness") expectedSignals.push({ signalId: SIG.chronicMed, minConfidence: 0.8 });
  if (f === "shift_work") expectedSignals.push({ signalId: SIG.nightShift, minConfidence: 0.8 });
  if (f === "chronic_dieter") { expectedSignals.push({ signalId: SIG.ironDef, minConfidence: 0.75 }); expectedSignals.push({ signalId: SIG.vitDDef, minConfidence: 0.7 }); expectedSignals.push({ signalId: SIG.irregularDiet, minConfidence: 0.7 }); }

  const expectedPathways = [{ pathwayId: PW.telogen, minActivation: 0.55, role: "leading" }];
  if (f === "chronic_dieter") expectedPathways.push({ pathwayId: PW.nutritional, minActivation: 0.5, role: "supporting" });

  const expectedRootCauses = [{ causeId: C.te, minPosterior: 0.4, surfaceAs: "lead" }];
  if (f === "chronic_dieter") expectedRootCauses.push({ causeId: C.nutr, minPosterior: 0.2, surfaceAs: "co-lead" });

  const c = {
    caseId, corpusVersion: "2.0.0", description: desc, category: "CHRONIC_TE",
    severity: sev, presentationClarity: adversarial ? "ambiguous" : "clear",
    demographicProfile: { sex, age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals, expectedPathways, expectedRootCauses,
    expectedDiagnosis: {
      primary: C.te,
      secondary: f === "chronic_dieter" ? [C.nutr] : [],
      legacyDiagnosisKey: f === "chronic_stress" ? "STRESS_TE" : f === "chronic_dieter" ? "NUTRITIONAL_TE" : "CHRONIC_TE",
      legacyDiagnosisKeyAlternates: ["CHRONIC_TE"],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "TE_CHRONIC",
    expectedTherapyNeeds: ["CYCLE_RESTORATION", "STRESS_DOWNREGULATION", "NUTRITIONAL_REPLETION"],
    expectedMonitoringRequirements: {
      required: ["SHED_COUNT_MONTHLY", "GLOBAL_PHOTO_3M", "FERRITIN_4M", "VITAMIN_D_4M", "TSH_3M"],
      recommended: ["STRESS_PHQ_MONTHLY"], forbidden: [],
    },
    expectedNarrativeThemes: {
      themes: ["CYCLE_RESET", "STRESS_RECOVERY", "EXPECTATION_SETTING_SLOW"].concat(f === "chronic_dieter" ? ["NUTRITIONAL_RESTORATION"] : []),
      mustContainTokens: ["chronic", "telogen"],
      mustNotContainTokens: ["guaranteed"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old ${sex.toLowerCase()} with persistent diffuse shedding > 12 months, no architectural pattern change, ${f === "chronic_stress" ? "documented chronic stress load" : f === "chronic_dieter" ? "persistent nutritional risk pattern" : f === "shift_work" ? "circadian disruption from sustained night shift exposure" : "no identifiable single precipitant despite thorough workup"}. Chronic-duration marker plus diffuse shedding without pattern topology produces telogen-cycle-disruption leadership at modest but sustained activation. Reversibility is partial-to-full once the chronic driver is addressed; protocol class TE_CHRONIC mandates comprehensive deficiency workup in monitoring.`,
      whyNotCompetitors: {
        [C.andro]: "No pattern signal above background; chronic diffuse shed without thinning topology weighs against miniaturization.",
        [C.autoimmune]: "No patchy/areata markers.",
        [C.inflam]: "Unremarkable scalp surface.",
        [C.nutr]: f === "chronic_dieter" ? "Co-driver and co-lead." : "No documented deficiency.",
        [C.multi]: "Only one dominant pathway (two when nutritional co-activates) — compositeRule not met.",
      },
    },
  };
  if (adversarial) c.adversarial = { isAdversarial: true, expectedPrimaryDriver: C.te, expectedSecondaryDrivers: f === "chronic_dieter" ? [C.nutr] : [], commonFailureModes: [{ failureMode: "CHRONIC_TE_AS_AGA", impactedComponent: "ROOTCAUSE", description: "Long-duration TE with mild crown thinning can be misread as low-grade AGA — duration and shedding intensity must keep TE leading." }] };
  return c;
}

function postCovidTE(i, n) {
  const phase = i < 5 ? "acute" : "late";
  const age = [24, 32, 40, 48, 56][i % 5];
  const sex = i % 2 === 0 ? "Female" : "Male";
  const sev = pickCycle(i, ["moderate", "severe", "moderate"]);
  const adversarial = i % 3 === 0;
  const caseId = `te_postcovid_${pad2(i + 1)}_${phase}_age${age}_${sex.toLowerCase()}`;
  const desc = `Post-COVID telogen effluvium, ${phase}-phase, ${age}y ${sex}.`;
  const answers = {
    sex, age: String(age),
    goal: ["Reduce hair fall"],
    grade: "Grade 1",
    scalp: ["Normal scalp"],
    cause: ["Recent illness"],
    lifestyle: phase === "late" ? ["Chronic stress"] : [], thyroid: [], hormonal: [], immunity: [],
    deficiency: [], gut: [], diet: [],
    hairtype: ["Diffuse shedding"], treatment: [],
    duration: phase === "acute" ? "3–6 months" : "6–12 months",
    count: sev === "severe" ? "more than 200 hairs/day" : "100–200 hairs/day",
  };
  const expectedSignals = [
    { signalId: SIG.diffuseShedding, minConfidence: 0.85, mustBePrimary: true },
    { signalId: SIG.postIllness, minConfidence: 0.85 },
    { signalId: phase === "acute" ? SIG.acute : SIG.subacute, minConfidence: 0.7 },
    { signalId: SIG.sheddingHeavy, minConfidence: 0.7 },
    { signalId: sex === "Female" ? SIG.female : SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
  ];
  if (phase === "late") expectedSignals.push({ signalId: SIG.stress, minConfidence: 0.6 });

  const c = {
    caseId, corpusVersion: "2.0.0", description: desc, category: "POST_COVID_TE",
    severity: sev, presentationClarity: adversarial ? "ambiguous" : "clear",
    demographicProfile: { sex, age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals,
    expectedPathways: [
      { pathwayId: PW.telogen, minActivation: 0.65, role: "leading" },
      { pathwayId: PW.oxidative, minActivation: 0.35, role: "modulator" },
    ],
    expectedRootCauses: [{ causeId: C.te, minPosterior: 0.5, surfaceAs: "lead" }],
    expectedDiagnosis: {
      primary: C.te, secondary: [],
      legacyDiagnosisKey: "POST_ILLNESS_TE",
      legacyDiagnosisKeyAlternates: ["ACUTE_TE", "CHRONIC_TE"],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "TE_POST_ILLNESS",
    expectedTherapyNeeds: ["CYCLE_RESTORATION", "STRESS_DOWNREGULATION", "NUTRITIONAL_REPLETION"],
    expectedMonitoringRequirements: {
      required: ["SHED_COUNT_MONTHLY", "GLOBAL_PHOTO_3M", "FERRITIN_4M", "VITAMIN_D_4M"], recommended: ["STRESS_PHQ_MONTHLY"], forbidden: [],
    },
    expectedNarrativeThemes: {
      themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "STRESS_RECOVERY"],
      mustContainTokens: ["recovery", "telogen"],
      mustNotContainTokens: ["permanent", "guaranteed"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old ${sex.toLowerCase()} with diffuse heavy shedding ${phase === "acute" ? "2–4 months" : "6–12 months"} post-COVID infection. The post-illness signal carries the strongest cause-registry log-likelihood for telogen-driven shedding; cytokine-driven oxidative stress contributes as a modulator pathway. Reversibility is expected on standard TE timeline (one telogen cycle from removal of stressor). Protocol class TE_POST_ILLNESS isolates this from idiopathic chronic TE in monitoring cadence.`,
      whyNotCompetitors: {
        [C.andro]: "No pattern topology; the precipitant is clear and the shedding is diffuse.",
        [C.autoimmune]: "No patchy markers, no AA history.",
        [C.inflam]: "Scalp surface unremarkable.",
        [C.nutr]: "No documented deficiency markers in this case; supplementation is precautionary, not causal.",
        [C.multi]: "Single dominant precipitant + pathway; multifactorial gate not met.",
      },
    },
  };
  if (adversarial) c.adversarial = { isAdversarial: true, expectedPrimaryDriver: C.te, expectedSecondaryDrivers: [], commonFailureModes: [{ failureMode: "POST_COVID_AS_CHRONIC_TE", impactedComponent: "PROTOCOL", description: "Phase classification must remain POST_ILLNESS rather than collapsing to CHRONIC_TE." }] };
  return c;
}

function alopeciaAreata(i, n) {
  const flavors = ["patchy_single", "patchy_multifocal", "ophiasis", "totalis_trajectory", "diffuse_incipient_aa", "relapsing_aa"];
  const f = flavors[i % flavors.length];
  const age = [12, 18, 22, 28, 34, 40, 46][i % 7];
  const sex = i % 2 === 0 ? "Female" : "Male";
  const adversarial = f === "diffuse_incipient_aa" || f === "relapsing_aa" || i % 3 === 0;
  const sev = f === "totalis_trajectory" ? "severe" : f === "ophiasis" ? "severe" : pickCycle(i, ["mild", "moderate"]);
  const caseId = `aa_${pad2(i + 1)}_${f}_age${age}_${sex.toLowerCase()}`;
  const desc = `Alopecia areata — ${f.replace(/_/g, " ")}, ${age}y ${sex}.`;
  const answers = {
    sex, age: String(age),
    goal: ["Reduce hair fall"],
    grade: "Grade 1",
    scalp: ["Normal scalp"],
    cause: ["Autoimmune"],
    lifestyle: [], thyroid: [],
    hormonal: [],
    immunity: f === "relapsing_aa" ? ["Alopecia areata history", "Recurrent infections"] : ["Alopecia areata history"],
    deficiency: [], gut: [], diet: [],
    hairtype: f === "diffuse_incipient_aa" ? ["Diffuse shedding"] : ["Patchy bald spots"],
    treatment: [],
    duration: f === "totalis_trajectory" ? "3–6 months" : "Less than 3 months",
    count: f === "diffuse_incipient_aa" ? "100–200 hairs/day" : "patches without diffuse fall",
  };
  const expectedSignals = [
    { signalId: f === "diffuse_incipient_aa" ? SIG.diffuseShedding : SIG.patchyLoss, minConfidence: f === "diffuse_incipient_aa" ? 0.7 : 0.9, mustBePrimary: true },
    { signalId: SIG.aaHistory, minConfidence: 0.85 },
    { signalId: sex === "Female" ? SIG.female : SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
  ];
  if (f === "relapsing_aa") expectedSignals.push({ signalId: SIG.recurrentInfection, minConfidence: 0.7 });

  const expectedPathways = [{ pathwayId: PW.immune, minActivation: 0.6, role: "leading" }];

  const c = {
    caseId, corpusVersion: "2.0.0", description: desc, category: "ALOPECIA_AREATA",
    severity: sev, presentationClarity: adversarial ? (f === "diffuse_incipient_aa" ? "edge_case" : "ambiguous") : "clear",
    demographicProfile: { sex, age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals, expectedPathways,
    expectedRootCauses: [{ causeId: C.autoimmune, minPosterior: 0.55, surfaceAs: "lead" }],
    expectedDiagnosis: {
      primary: C.autoimmune, secondary: [],
      legacyDiagnosisKey: "ALOPECIA_AREATA",
      legacyDiagnosisKeyAlternates: [],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "AUTOIMMUNE_AA",
    expectedTherapyNeeds: ["AUTOIMMUNE_QUIESCENCE", "IMMUNE_MODULATION", "INFLAMMATION_CONTROL"],
    expectedMonitoringRequirements: {
      required: ["GLOBAL_PHOTO_3M", "SCALP_EXAM_3M"], recommended: ["TRICHOSCOPY_6M"], forbidden: ["ANDROGEN_PANEL_6M"],
    },
    expectedNarrativeThemes: {
      themes: ["AUTOIMMUNE_CONTROL", "EXPECTATION_SETTING_SLOW"],
      mustContainTokens: ["immune", "areata"],
      mustNotContainTokens: ["guaranteed regrowth", "cure"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old ${sex.toLowerCase()} with ${f === "diffuse_incipient_aa" ? "diffuse shed presenting on a background of prior areata history (incipient AA pattern)" : "well-demarcated patchy loss"} and confirmed alopecia areata history. The patchy-loss-marker and alopecia-areata-history signals together carry the strongest LLRs in the autoimmune cause definition; immune-dysregulation pathway leads at ≥0.60 activation. Protocol class is AUTOIMMUNE_AA — treatment focuses on immune quiescence and expectation setting for relapse/remission rather than miniaturization-style intervention.`,
      whyNotCompetitors: {
        [C.andro]: "Pattern signal is structurally different (patchy vs gradient) and miniaturization pathway is exclusionary in autoimmune cause definition.",
        [C.te]: f === "diffuse_incipient_aa" ? "Diffuse incipient AA can mimic TE, but the areata history signal carries leading weight." : "Patchy topology is incompatible with TE.",
        [C.inflam]: "Inflammatory scalp surface signals do not fire above background.",
        [C.nutr]: "No deficiency signals.",
        [C.multi]: "Single dominant pathway; multifactorial not met.",
      },
    },
  };
  if (adversarial) c.adversarial = { isAdversarial: true, expectedPrimaryDriver: C.autoimmune, expectedSecondaryDrivers: [], commonFailureModes: [{ failureMode: f === "diffuse_incipient_aa" ? "AA_MISSED_AS_TE" : "PATCHY_DISMISSED", impactedComponent: "ROOTCAUSE", description: "Incipient diffuse AA can be classified as TE without the alopecia-areata-history signal forcing autoimmune leadership." }] };
  return c;
}

function inflammatory(i, n) {
  const flavors = ["seborrheic_mild", "seborrheic_severe", "psoriatic", "folliculitis_decalvans", "dandruff_oily_combo"];
  const f = flavors[i % flavors.length];
  const sex = i % 2 === 0 ? "Male" : "Female";
  const age = [22, 28, 34, 40, 46, 52][i % 6];
  const sev = pickCycle(i, ["mild", "moderate", "severe"]);
  const adversarial = i % 3 === 0;
  const caseId = `inflam_${pad2(i + 1)}_${f}_age${age}_${sex.toLowerCase()}`;
  const desc = `Inflammatory scalp dysfunction — ${f.replace(/_/g, " ")}, ${age}y ${sex}.`;
  const answers = {
    sex, age: String(age),
    goal: ["Reduce hair fall"],
    grade: "Grade 1",
    scalp: f === "psoriatic" ? ["Psoriasis on scalp"] : f === "folliculitis_decalvans" ? ["Scalp pustules"] : f === "seborrheic_severe" ? ["Oily scalp", "Dandruff with itching", "Scalp redness"] : f === "dandruff_oily_combo" ? ["Oily scalp", "Dandruff"] : ["Dandruff with itching"],
    cause: ["Scalp infection"],
    lifestyle: [], thyroid: [], hormonal: [], immunity: [],
    deficiency: [], gut: [], diet: [],
    hairtype: ["Diffuse shedding"], treatment: [],
    duration: "6–12 months",
    count: "100–200 hairs/day",
  };
  const expectedSignals = [
    { signalId: sex === "Female" ? SIG.female : SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
  ];
  if (f === "psoriatic") expectedSignals.push({ signalId: SIG.psoriaticScalp, minConfidence: 0.9, mustBePrimary: true });
  else if (f === "folliculitis_decalvans") expectedSignals.push({ signalId: SIG.pustules, minConfidence: 0.9, mustBePrimary: true });
  else if (f === "seborrheic_severe") { expectedSignals.push({ signalId: SIG.dandruffItch, minConfidence: 0.85, mustBePrimary: true }); expectedSignals.push({ signalId: SIG.redness, minConfidence: 0.75 }); expectedSignals.push({ signalId: SIG.oily, minConfidence: 0.7 }); }
  else if (f === "dandruff_oily_combo") { expectedSignals.push({ signalId: SIG.dandruff, minConfidence: 0.8 }); expectedSignals.push({ signalId: SIG.oily, minConfidence: 0.7 }); }
  else expectedSignals.push({ signalId: SIG.dandruffItch, minConfidence: 0.85, mustBePrimary: true });

  const expectedPathways = [
    { pathwayId: PW.scalpInflam, minActivation: 0.6, role: "leading" },
  ];
  if (f === "folliculitis_decalvans") expectedPathways.push({ pathwayId: PW.immune, minActivation: 0.4, role: "supporting" });

  const c = {
    caseId, corpusVersion: "2.0.0", description: desc, category: "INFLAMMATORY_SCALP",
    severity: sev, presentationClarity: adversarial ? "ambiguous" : "clear",
    demographicProfile: { sex, age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals, expectedPathways,
    expectedRootCauses: [{ causeId: C.inflam, minPosterior: 0.45, surfaceAs: "lead" }],
    expectedDiagnosis: {
      primary: C.inflam, secondary: [],
      legacyDiagnosisKey: f === "psoriatic" ? "PSORIATIC_SCALP" : f === "seborrheic_mild" || f === "seborrheic_severe" || f === "dandruff_oily_combo" ? "SEBORRHEIC_DERMATITIS" : "INFLAMMATORY_SCALP",
      legacyDiagnosisKeyAlternates: ["INFLAMMATORY_SCALP"],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "INFLAMMATORY",
    expectedTherapyNeeds: ["INFLAMMATION_CONTROL", "SCALP_DECONGESTION"],
    expectedMonitoringRequirements: {
      required: ["SCALP_EXAM_3M", "GLOBAL_PHOTO_3M"], recommended: ["TRICHOSCOPY_6M"], forbidden: [],
    },
    expectedNarrativeThemes: {
      themes: ["INFLAMMATORY_QUIESCENCE", "REVERSIBILITY_REASSURANCE"],
      mustContainTokens: ["inflammation", "scalp"],
      mustNotContainTokens: ["guaranteed"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old ${sex.toLowerCase()} with dominant scalp-surface inflammation signals (${f.replace(/_/g, " ")}) and mild associated shedding. Scalp-inflammation pathway leads with ≥0.60 activation; pattern signal is absent, so the inflammatory cause is the named driver rather than a downstream modifier. Protocol class INFLAMMATORY focuses on scalp decongestion and topical inflammation control; once the surface dermatosis quiets, follicle cycling normalizes.`,
      whyNotCompetitors: {
        [C.andro]: "Pattern signal absent; miniaturization not above floor.",
        [C.te]: "Shedding is mild and explained by inflammatory shed; no synchronized telogen precipitant.",
        [C.autoimmune]: f === "folliculitis_decalvans" ? "Immune pathway co-activates as supporting role but does not lead; primary signal is perifollicular pustular inflammation." : "No patchy/areata markers.",
        [C.nutr]: "No deficiency signals.",
        [C.multi]: "Single dominant pathway.",
      },
    },
  };
  if (adversarial) c.adversarial = { isAdversarial: true, expectedPrimaryDriver: C.inflam, expectedSecondaryDrivers: [], commonFailureModes: [{ failureMode: "INFLAMMATION_DISMISSED_AS_AGA", impactedComponent: "ROOTCAUSE", description: "Oily-scalp signal can falsely route to AGA when paired with mild shed; inflammation must lead when surface dermatosis dominates." }] };
  return c;
}

function multifactorial(i, n) {
  const flavors = [
    "aga_te_overlap", "aga_inflam_overlap", "pcos_te_nutritional",
    "aga_pcos_nutritional", "fphl_hypo_iron", "male_aga_dandruff_stress",
    "fphl_perimeno_ferritin_stress",
  ];
  const f = flavors[i % flavors.length];
  const sex = f.startsWith("male") || f === "aga_inflam_overlap" || f === "aga_te_overlap" || f === "male_aga_dandruff_stress" ? "Male" : "Female";
  const age = sex === "Male" ? [28, 32, 36, 40, 44][i % 5] : [30, 36, 42, 48, 52][i % 5];
  const sev = pickCycle(i, ["moderate", "severe", "moderate"]);
  const grade = sev === "severe" ? 4 : 3;
  const adversarial = true; // all multifactorial are adversarial by definition
  const caseId = `multi_${pad2(i + 1)}_${f}_age${age}_${sex.toLowerCase()}`;
  const desc = `Multifactorial — ${f.replace(/_/g, " ")}, ${age}y ${sex}.`;
  const answers = {
    sex, age: String(age),
    goal: ["Reduce hair fall", "Regrow lost hair"],
    grade: `Grade ${grade}`,
    scalp: f.includes("inflam") || f.includes("dandruff") ? ["Oily scalp", "Dandruff with itching"] : ["Normal scalp"],
    cause: ["Family history"],
    lifestyle: f.includes("stress") ? ["Chronic stress", "Poor sleep"] : [],
    thyroid: f.includes("hypo") ? ["Hypothyroidism"] : [],
    hormonal: f.includes("pcos") ? ["PCOS"] : f.includes("perimeno") ? ["Perimenopause"] : [],
    immunity: [],
    deficiency: f.includes("nutritional") || f.includes("iron") || f.includes("ferritin") ? ["Iron deficiency", "Vitamin D deficiency"] : [],
    gut: [], diet: [],
    hairtype: ["Thinning at crown", "Diffuse shedding"],
    treatment: [],
    duration: "More than 1 year",
    count: "100–200 hairs/day",
  };
  const expectedSignals = [
    { signalId: SIG.patternThinning, minConfidence: 0.65 },
    { signalId: SIG.diffuseShedding, minConfidence: 0.65 },
    { signalId: grade >= 4 ? SIG.grade45 : SIG.grade123, minConfidence: 0.65 },
    { signalId: SIG.chronic, minConfidence: 0.75 },
    { signalId: sex === "Female" ? SIG.female : SIG.male, minConfidence: 0.99 },
    { signalId: ageBucketSignal(age), minConfidence: 0.99 },
    { signalId: SIG.genetic, minConfidence: 0.6 },
  ];
  if (f.includes("inflam") || f.includes("dandruff")) { expectedSignals.push({ signalId: SIG.dandruffItch, minConfidence: 0.75 }); expectedSignals.push({ signalId: SIG.oily, minConfidence: 0.7 }); }
  if (f.includes("stress")) expectedSignals.push({ signalId: SIG.stress, minConfidence: 0.7 });
  if (f.includes("hypo")) expectedSignals.push({ signalId: SIG.hypo, minConfidence: 0.85 });
  if (f.includes("pcos")) expectedSignals.push({ signalId: SIG.pcos, minConfidence: 0.9 });
  if (f.includes("perimeno")) expectedSignals.push({ signalId: SIG.perimeno, minConfidence: 0.85 });
  if (f.includes("nutritional") || f.includes("iron") || f.includes("ferritin")) { expectedSignals.push({ signalId: SIG.ironDef, minConfidence: 0.8 }); expectedSignals.push({ signalId: SIG.vitDDef, minConfidence: 0.7 }); }

  const expectedPathways = [
    { pathwayId: PW.miniaturization, minActivation: 0.45, role: "supporting" },
    { pathwayId: PW.telogen, minActivation: 0.45, role: "supporting" },
  ];
  if (f.includes("inflam") || f.includes("dandruff")) expectedPathways.push({ pathwayId: PW.scalpInflam, minActivation: 0.45, role: "supporting" });
  if (f.includes("hypo") || f.includes("pcos") || f.includes("perimeno")) expectedPathways.push({ pathwayId: PW.hormonal, minActivation: 0.45, role: "supporting" });
  if (f.includes("nutritional") || f.includes("iron") || f.includes("ferritin")) expectedPathways.push({ pathwayId: PW.nutritional, minActivation: 0.45, role: "supporting" });

  const expectedRootCauses = [
    { causeId: C.multi, minPosterior: 0.25, surfaceAs: "lead" },
    { causeId: C.andro, minPosterior: 0.18, surfaceAs: "co-lead" },
    { causeId: C.te, minPosterior: 0.15, surfaceAs: "co-lead" },
  ];

  const c = {
    caseId, corpusVersion: "2.0.0", description: desc, category: "MULTIFACTORIAL",
    severity: sev, presentationClarity: "conflicting",
    demographicProfile: { sex, age: String(age), region: null, dietType: "Mixed" },
    questionnaireAnswers: answers,
    expectedSignals, expectedPathways, expectedRootCauses,
    expectedDiagnosis: {
      primary: C.multi,
      secondary: [C.andro, C.te].concat(f.includes("hormonal") || f.includes("pcos") || f.includes("hypo") || f.includes("perimeno") ? [C.hormonal] : []).concat(f.includes("nutritional") || f.includes("iron") || f.includes("ferritin") ? [C.nutr] : []),
      legacyDiagnosisKey: "MULTI",
      legacyDiagnosisKeyAlternates: ["MULTIFACTORIAL_HAIR"],
    },
    expectedSeverity: sev,
    expectedProtocolClass: "MULTIFACTORIAL",
    expectedTherapyNeeds: ["DHT_SUPPRESSION", "CYCLE_RESTORATION", "INFLAMMATION_CONTROL", "NUTRITIONAL_REPLETION", "ENDOCRINE_OPTIMIZATION"],
    expectedMonitoringRequirements: {
      required: ["GLOBAL_PHOTO_3M", "TRICHOSCOPY_6M", "FERRITIN_4M", "VITAMIN_D_4M", "TSH_3M"],
      recommended: ["SHED_COUNT_MONTHLY", "STRESS_PHQ_MONTHLY"],
      forbidden: [],
    },
    expectedNarrativeThemes: {
      themes: ["MULTIFACTORIAL_COORDINATION", "EXPECTATION_SETTING_SLOW"],
      mustContainTokens: ["multiple", "address"],
      mustNotContainTokens: ["single cause", "guaranteed"],
    },
    clinicalRationale: {
      whyPrimary: `${age}-year-old ${sex.toLowerCase()} with simultaneously activated miniaturization, telogen-cycle-disruption, and a third driver pathway (${f.replace(/_/g, " ")}). The compositeRule in the cause registry (≥3 pathways above 0.40 AND single-cause dissent gap < 0.06) is the only path by which multifactorial-hair-loss promotes to lead — naive Bayes would surface AGA or TE alone, missing the composite reality. Protocol class MULTIFACTORIAL coordinates therapy combinatorics across DHT suppression, cycle restoration, inflammation control, and substrate repletion.`,
      whyNotCompetitors: {
        [C.andro]: "Pathway is active but does not dominate; pure androgenic explanation undercounts the telogen and ${f.includes('nutritional') ? 'nutritional' : 'hormonal'} drivers.",
        [C.te]: "Same — active but not dominant.",
        [C.autoimmune]: "No patchy/areata markers; immune pathway absent.",
        [C.inflam]: f.includes("inflam") || f.includes("dandruff") ? "Active and contributory but not primary by topology weighting." : "Below activation floor.",
        [C.nutr]: f.includes("nutritional") || f.includes("iron") || f.includes("ferritin") ? "Co-active driver; surfaced as secondary in diagnosis." : "Below floor.",
      },
    },
    adversarial: {
      isAdversarial: true,
      expectedPrimaryDriver: C.multi,
      expectedSecondaryDrivers: [C.andro, C.te],
      commonFailureModes: [
        { failureMode: "COMPOSITE_RULE_NOT_EVALUATED", impactedComponent: "ROOTCAUSE", description: "Ranker may emit a single dominant cause without checking compositeRule, missing the multifactorial verdict." },
        { failureMode: "SINGLE_CAUSE_OVERCONFIDENCE", impactedComponent: "ROOTCAUSE", description: "Top-1 cause posterior can artificially inflate when conflicting pathways' competing LLRs are not subtracted." },
        { failureMode: "MONO_PROTOCOL_SHIPPED", impactedComponent: "PROTOCOL", description: "Protocol can default to MPHL/TE_ACUTE instead of the MULTIFACTORIAL coordination class." },
      ],
    },
  };
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit
// ─────────────────────────────────────────────────────────────────────────────

const plan = [
  { name: "MALE_AGA", n: 50, gen: maleAGA },
  { name: "FPHL", n: 25, gen: fphl },
  { name: "PCOS", n: 25, gen: pcosCase },
  { name: "ACUTE_TE", n: 20, gen: acuteTE },
  { name: "CHRONIC_TE", n: 20, gen: chronicTE },
  { name: "POST_COVID_TE", n: 10, gen: postCovidTE },
  { name: "ALOPECIA_AREATA", n: 15, gen: alopeciaAreata },
  { name: "INFLAMMATORY_SCALP", n: 15, gen: inflammatory },
  { name: "MULTIFACTORIAL", n: 20, gen: multifactorial },
];

const allCases = [];
for (const block of plan) {
  for (let i = 0; i < block.n; i++) {
    const c = block.gen(i, block.n);
    allCases.push(c);
  }
}

// Coverage / adversarial guarantee
const adversarialCount = allCases.filter((c) => c.adversarial?.isAdversarial).length;
if (adversarialCount < 50) {
  throw new Error(`Adversarial count ${adversarialCount} < 50; corpus invariant violated`);
}

// Write
for (const c of allCases) {
  const p = path.join(CASES_DIR, `${c.caseId}.json`);
  fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
}

const index = {
  corpusVersion: "2.0.0",
  generatedAt: "2026-06-06",
  total: allCases.length,
  adversarialCount,
  byCategory: plan.map((b) => ({ category: b.name, count: b.n })),
  caseIds: allCases.map((c) => c.caseId),
};
fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + "\n");

console.log(`Wrote ${allCases.length} cases (${adversarialCount} adversarial) to ${CASES_DIR}`);
console.log(`Index: ${INDEX_PATH}`);
