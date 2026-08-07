import type { OnePageReportViewModel } from "../viewModel";
import {
  getConditionAsset,
  getProductAsset,
  getRecoveryStageIllustration,
  getTopicalAsset,
  reportAssets,
} from "../productAssets";
import { resolveClinicalOptionAsset } from "../clinicalOptionAssets";

/**
 * Turn C fixture — Rahul. Male MPHL Norwood II case with 3 kits + 3
 * topicals. Duration + Pattern of Shedding are "Not Applicable" — the
 * PatientBlock collapse rule must hide those rows entirely. Verifies the
 * 3-row density mode (packshots ~88px, comfortable padding, no crop).
 */

const cond = (code: string, alt: string) =>
  getConditionAsset(code) ?? {
    key: code,
    src: "/report-assets/conditions/fallback-neutral-ai-lite.png",
    alt,
  };

const kit = (code: string, alt: string) =>
  getProductAsset(code) ?? { key: code, src: "", alt };

const topical = (code: string, alt: string) =>
  getTopicalAsset(code) ?? { key: code, src: "", alt };

const recovery = (code: string) =>
  getRecoveryStageIllustration(code) ?? reportAssets.recoveryStages.DAY_0_30;

const clinical = (label: string) => {
  const resolved = resolveClinicalOptionAsset({ label });
  return { optionCode: resolved.optionCode, label, asset: resolved.asset, assetStatus: resolved.status };
};

const iconValidation = (labels: string[]) =>
  labels.map((label) => {
    const resolved = resolveClinicalOptionAsset({ label });
    return { optionCode: resolved.optionCode, label, status: resolved.status, assetPath: resolved.asset.src };
  });

export const rahulFixture: OnePageReportViewModel = {
  assessmentId: "fixture-rahul",
  layoutMode: "standard",
  generatedAt: "31 Jul 2026",
  patient: {
    name: "Rahul",
    age: "31 yrs",
    gender: "Male",
    imageUrl: null,
    imageAsset: {
      ...reportAssets.portraits.maleFallback,
      source: "gender_fallback",
    },
    goal: "Protect the hairline and stop lifestyle-driven fall",
    phone: null,
  },
  clinic: { name: "DrFACT Mumbai", address: "", phone: "", logoUrl: null },
  clinician: { name: "Divesh (Test Doctor)", title: "Doctor approved plan" },
  clinicalResult: {
    primary: "Male Pattern Hair Loss (MPHL) — Norwood II",
    supportingLine: "Diffuse thinning with early temple recession",
    // Roughly 65 words — one diagnosis, contributors, one mechanism, one plan sentence.
    conclusion:
      "Your responses indicate early androgenetic thinning with mild temple recession. Scalp inflammation and lifestyle-linked oxidative stress appear to be the strongest contributors, alongside reduced immune resilience. Together these may weaken the follicle environment and accelerate androgen-sensitive miniaturisation. Your plan therefore focuses on calming scalp inflammation, protecting pattern-sensitive follicles, and supporting immune recovery.",
    reviewedBy: "Reviewed by Divesh (Test Doctor)",
  },
  driverStory: [
    {
      id: "drv-pattern",
      title: "Male pattern predisposition",
      priority: "Primary Driver",
      trigger: "Norwood II thinning",
      explanation: "Androgen-driven miniaturisation of temple / vertex follicles.",
      illustration: "hormonal",
      conditionCode: "MALE_PATTERN_HAIR_LOSS",
      asset: cond("MALE_PATTERN_HAIR_LOSS", "MPHL illustration"),
      tone: "gold",
    },
  ],
  snapshotStrip: [
    { label: "Duration", value: "Not Applicable", illustration: "recovery" },
    { label: "Shedding", value: "Not Applicable", illustration: "follicle" },
    { label: "Pattern", value: "MPHL — Norwood II", illustration: "follicle" },
  ],
  patternScale: {
    type: "Norwood",
    patientStage: "Norwood II",
    stages: [
      { label: "I", value: "Norwood I", selected: false, asset: { key: "NORWOOD_I", src: "/clinical-visuals/grade/norwood/i.jpg", alt: "Norwood I clinical stage" } },
      { label: "II", value: "Norwood II", selected: true, asset: { key: "NORWOOD_II", src: "/clinical-visuals/grade/norwood/ii.jpg", alt: "Norwood II clinical stage" } },
      { label: "III", value: "Norwood III", selected: false, asset: { key: "NORWOOD_III", src: "/clinical-visuals/grade/norwood/iii.jpg", alt: "Norwood III clinical stage" } },
    ],
  },
  keyClinicalSnapshot: [
    clinical("Dandruff / flakes"),
    clinical("Recurrent infections"),
    clinical("Smoking / Vaping"),
    clinical("Bodybuilding / Heavy gym"),
    clinical("Stress / Anxiety"),
    clinical("Family history of MPHL"),
    clinical("Inconsistent sleep"),
    clinical("High protein diet"),
  ],
  treatmentPlan: [
    {
      id: "row-1",
      sequence: "1",
      role: "Inflammation control",
      priority: "Primary Driver",
      name: "Phenotype Inflammation",
      kitCode: "PHENOTYPE_INFLAMMATION",
      selectedBecause: "Helps calm scalp inflammation and reduce oxidative stress.",
      mappedDriverId: "drv-pattern",
      mappedCondition: "Scalp inflammation",
      mappedInterpretation:
        "Scalp inflammation and lifestyle-related oxidative stress may weaken the follicle environment.",
      linkedDrivers: ["Scalp inflammation: dandruff, itching, flakes, redness", "Smoking / Vaping"],
      benefits: ["Helps calm scalp inflammation and reduce oxidative stress."],
      asset: kit("PHENOTYPE_INFLAMMATION", "Phenotype Inflammation kit"),
    },
    {
      id: "row-2",
      sequence: "2",
      role: "Immune support",
      priority: "Secondary Driver",
      name: "Pro Immune Gold",
      kitCode: "PRO_IMMUNE_GOLD",
      selectedBecause: "Supports balanced immune activity and follicular recovery.",
      mappedDriverId: "drv-pattern",
      mappedCondition: "Immune depletion",
      mappedInterpretation:
        "Frequent infections may indicate reduced immune resilience affecting follicular recovery.",
      linkedDrivers: ["Recurrent infections", "Stress / Anxiety"],
      benefits: ["Supports balanced immune activity and follicular recovery."],
      asset: kit("PRO_IMMUNE_GOLD", "Pro Immune Gold kit"),
    },
    {
      id: "row-3",
      sequence: "3",
      role: "Pattern protection",
      priority: "Primary Driver",
      name: "MPHL Pro",
      kitCode: "MPHL",
      selectedBecause: "Protects androgen-sensitive follicles and supports stronger growth.",
      mappedDriverId: "drv-pattern",
      mappedCondition: "Male pattern hair loss",
      mappedInterpretation:
        "Genetic and androgen-sensitive pattern thinning may progressively miniaturise vulnerable follicles.",
      linkedDrivers: ["Norwood II pattern", "Family history of MPHL", "Bodybuilding / Heavy gym"],
      benefits: ["Protects androgen-sensitive follicles and supports stronger growth."],
      asset: kit("MPHL", "MPHL Pro kit"),
    },
  ],
  additionalCare: [],
  topicalCare: [
    {
      name: "F-Biwash Pro (Anti-Dandruff Shampoo)",
      topicalCode: "F_BIWASH_PLUS",
      purpose: "Anti-dandruff shampoo for a healthier scalp barrier.",
      usage: "Use 2–3 times weekly as advised.",
      asset: topical("F_BIWASH_PLUS", "F-Biwash Plus topical"),
    },
    {
      name: "F-Emugrow MCRD",
      topicalCode: "F_EMUGROW_MCRD",
      purpose: "Supports responsive scalp areas.",
      usage: "Apply once daily; massage gently, do not rinse.",
      asset: topical("F_EMUGROW_MCRD", "F-Emugrow MCRD topical"),
    },
    {
      name: "F-Extend 5% Minoxidil",
      topicalCode: "F_EXTEND_5",
      purpose: "For pattern-thinning areas after scalp settles.",
      usage: "Start only after doctor confirmation.",
      asset: topical("F_EXTEND_5", "F-Extend 5% Minoxidil topical"),
    },
  ],
  topicalNote:
    "Additional topical or prescription changes should be confirmed in the digital report or during review.",
  recoveryJourney: [
    { window: "Day 0–30", title: "Calm scalp, control dandruff", outcomes: ["Calm scalp, control dandruff"], illustration: "scalp", stageCode: "DAY_0_30", asset: recovery("DAY_0_30") },
    { window: "Day 30–60", title: "Reduce shedding, steady immune load", outcomes: ["Reduce shedding, steady immune load"], illustration: "follicle", stageCode: "DAY_30_60", asset: recovery("DAY_30_60") },
    { window: "Day 60–120", title: "Early follicular recovery", outcomes: ["Early follicular recovery"], illustration: "recovery", stageCode: "DAY_60_120", asset: recovery("DAY_60_120") },
    { window: "Beyond Day 120", title: "Consolidate coverage and maintain", outcomes: ["Consolidate coverage and maintain"], illustration: "recovery", stageCode: "BEYOND_120", asset: recovery("BEYOND_120") },
  ],
  lifestyleSupport: {
    supports: [
      "Follow the prescribed treatment plan",
      "Gentle scalp care",
      "Adequate protein intake",
      "Stress-management practice",
      "Consistent sleep routine",
    ],
    slows: [
      "Smoking or vaping",
      "Inconsistent treatment use",
      "Excess alcohol use",
      "Skipping the topical routine",
    ],
  },
  guideUrl: "https://drfact.example/guide/rahul",
  doctorApproval: {
    state: "APPROVED",
    approvedAt: "31 Jul 2026",
    approvedBy: "Divesh (Test Doctor)",
    nextReviewDate: "To be scheduled",
    signatureUrl: null,
  },
  disclaimer:
    "Based on your submitted assessment and clinical review. This report supports, but does not replace, medical advice.",
  validation: {
    ok: true,
    errors: [],
    warnings: [],
    kits: [
      { kitCode: "PHENOTYPE_INFLAMMATION", name: "Phenotype Inflammation", status: "valid" },
      { kitCode: "PRO_IMMUNE_GOLD", name: "Pro Immune Gold", status: "valid" },
      { kitCode: "MPHL", name: "MPHL Pro", status: "valid" },
    ],
    topicals: [
      { topicalCode: "F_BIWASH_PLUS", name: "F-Biwash Pro (Anti-Dandruff Shampoo)", status: "valid" },
      { topicalCode: "F_EMUGROW_MCRD", name: "F-Emugrow MCRD", status: "valid" },
      { topicalCode: "F_EXTEND_5", name: "F-Extend 5% Minoxidil", status: "valid" },
    ],
    clinicalIcons: iconValidation([
      "Dandruff / flakes",
      "Recurrent infections",
      "Smoking / Vaping",
      "Bodybuilding / Heavy gym",
      "Stress / Anxiety",
      "Family history of MPHL",
      "Inconsistent sleep",
      "High protein diet",
    ]),
  },
};
