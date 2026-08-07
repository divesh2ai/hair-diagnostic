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
 * Turn A fixture — CEO-approved Ruchi (FPHL, Ludwig 2, 5 kits, 1 topical).
 * Mirrors the reference screenshot pixel-for-pixel in content so the visual
 * baseline can be verified before wiring the real view-model in Turn B.
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

const iconValidation = (labels: string[]) => labels.map((label) => {
  const resolved = resolveClinicalOptionAsset({ label });
  return { optionCode: resolved.optionCode, label, status: resolved.status, assetPath: resolved.asset.src };
});

export const ruchiFixture: OnePageReportViewModel = {
  assessmentId: "fixture-ruchi",
  layoutMode: "dense",
  generatedAt: "31 Jul 2026",
  patient: {
    name: "Ruchi",
    age: "34 yrs",
    gender: "Female",
    imageUrl: null,
    imageAsset: {
      ...reportAssets.portraits.femaleFallback,
      source: "gender_fallback",
    },
    goal: "Reduce hair fall and support quality growth",
    phone: null,
  },
  clinic: {
    name: "DrFACT Mumbai",
    address: "",
    phone: "",
    logoUrl: null,
  },
  clinician: {
    name: "Divesh (Test Doctor)",
    title: "Doctor approved plan",
  },
  clinicalResult: {
    primary: "Female Pattern Hair Loss (FPHL) — Ludwig 2",
    supportingLine: "Noticeable shedding",
    conclusion:
      "Over the past 3–6 months, your responses indicate active female pattern hair loss with noticeable shedding. This pattern appears influenced by hormonal inflammation, thyroid-related metabolic slowing, scalp irritation, smoking-related oxidative stress, and overall inflammatory burden. Your plan therefore focuses on calming inflammation, restoring internal support, and protecting pattern-sensitive follicles.",
    reviewedBy: "Reviewed by Divesh (Test Doctor)",
  },
  driverStory: [
    {
      id: "drv-endo",
      title: "Endometriosis",
      priority: "Primary Driver",
      trigger: "Hormonal inflammatory burden",
      explanation: "Reproductive-hormone imbalance amplifies follicle sensitivity.",
      illustration: "hormonal",
      conditionCode: "HORMONAL_CONTRIBUTOR",
      asset: cond("HORMONAL_CONTRIBUTOR", "Endometriosis"),
      tone: "gold",
    },
  ],
  snapshotStrip: [
    { label: "Duration", value: "3–6 months", illustration: "recovery" },
    { label: "Shedding", value: "~50–100 strands (Noticeable)", illustration: "follicle" },
    { label: "Pattern", value: "FPHL — Ludwig 2", illustration: "follicle" },
  ],
  patternScale: {
    type: "Ludwig",
    patientStage: "Ludwig 2",
    stages: [
      {
        label: "1",
        value: "Ludwig 1",
        selected: false,
        asset: {
          key: "LUDWIG_1",
          src: "/clinical-visuals/grade/ludwig/grade1.jpg",
          alt: "Ludwig 1 clinical stage",
        },
      },
      {
        label: "2",
        value: "Ludwig 2",
        selected: true,
        asset: {
          key: "LUDWIG_2",
          src: "/clinical-visuals/grade/ludwig/grade2.jpg",
          alt: "Ludwig 2 clinical stage",
        },
      },
      {
        label: "III",
        value: "Ludwig III",
        selected: false,
        asset: {
          key: "LUDWIG_III",
          src: "/clinical-visuals/grade/ludwig/iii.jpg",
          alt: "Ludwig III clinical stage",
        },
      },
    ],
  },
  keyClinicalSnapshot: [
    clinical("Stress / Anxiety / Depression"),
    clinical("Smoking / Vaping"),
    clinical("Bodybuilding / Heavy gym"),
    clinical("Endometriosis"),
    clinical("Hypothyroidism"),
    clinical("Recurrent Acne / Acne-prone skin"),
    clinical("Indigestion"),
    clinical("High protein diet"),
    clinical("Chemical treatment (colour / keratin)"),
    clinical("Redness or irritation"),
  ],
  treatmentPlan: [
    {
      id: "row-1",
      sequence: "1",
      role: "Foundation",
      priority: "Primary Driver",
      name: "FH Well 3",
      kitCode: "FH_WELL_3",
      selectedBecause: "Foundational hormonal and inflammatory support.",
      mappedDriverId: "drv-endo",
      mappedCondition: "Endometriosis",
      mappedInterpretation: "Hormonal and inflammatory burden",
      linkedDrivers: ["Endometriosis"],
      benefits: ["Foundational hormonal and inflammatory support."],
      asset: kit("FH_WELL_3", "FH Well 3 kit"),
    },
    {
      id: "row-2",
      sequence: "2",
      role: "Inflammation control",
      priority: "Secondary Driver",
      name: "Phenotype Inflammation",
      kitCode: "PHENOTYPE_INFLAMMATION",
      selectedBecause: "Calm the follicle environment and reduce inflammatory stress.",
      mappedDriverId: "drv-endo",
      mappedCondition: "Scalp / oxidative / gut inflammation",
      mappedInterpretation: "Scalp, oxidative, and gut-linked inflammatory stress",
      linkedDrivers: ["Redness / irritation", "Smoking / Vaping", "Indigestion"],
      benefits: ["Calm the follicle environment and reduce inflammatory stress."],
      asset: kit("PHENOTYPE_INFLAMMATION", "Phenotype Inflammation kit"),
    },
    {
      id: "row-3",
      sequence: "3",
      role: "Metabolic support",
      priority: "Secondary Driver",
      name: "Meta B Hypothyroid",
      kitCode: "PRO_FACT_META_B_HYPOTHYROID",
      selectedBecause: "Support metabolic activity and follicular energy.",
      mappedDriverId: "drv-endo",
      mappedCondition: "Hypothyroidism",
      mappedInterpretation: "Thyroid-related metabolic slowing with stress-amplified shedding pressure",
      linkedDrivers: ["Hypothyroidism", "Stress / Anxiety / Depression"],
      benefits: ["Support metabolic activity and follicular energy."],
      asset: kit("PRO_FACT_META_B_HYPOTHYROID", "Meta B Hypothyroid kit"),
    },
    {
      id: "row-4",
      sequence: "4",
      role: "Immune support",
      priority: "Supporting Contributor",
      name: "Pro Immune Gold",
      kitCode: "PRO_IMMUNE_GOLD",
      selectedBecause: "Support balanced inflammatory and immune activity.",
      mappedDriverId: "drv-endo",
      mappedCondition: "Recurrent acne",
      mappedInterpretation: "Immune / sebaceous inflammatory terrain",
      linkedDrivers: ["Recurrent Acne / Acne-prone skin"],
      benefits: ["Support balanced inflammatory and immune activity."],
      asset: kit("PRO_IMMUNE_GOLD", "Pro Immune Gold kit"),
    },
    {
      id: "row-5",
      sequence: "5",
      role: "Pattern protection",
      priority: "Primary Driver",
      name: "FPHL Pro",
      kitCode: "FPHL",
      selectedBecause: "Protect vulnerable follicles and support hair calibre.",
      mappedDriverId: "drv-endo",
      mappedCondition: "Female pattern hair loss",
      mappedInterpretation: "Pattern-sensitive follicular thinning with androgen / metabolic pressure",
      linkedDrivers: ["Ludwig 2 pattern", "Bodybuilding / Heavy gym", "High protein diet"],
      benefits: ["Protect vulnerable follicles and support hair calibre."],
      asset: kit("FPHL", "FPHL Pro kit"),
    },
  ],
  additionalCare: [],
  topicalCare: [
    {
      name: "F-Emugrow MCRD",
      topicalCode: "F_EMUGROW_MCRD",
      purpose: "For pattern thinning and responsive scalp areas",
      usage: "Apply once daily as prescribed. Massage gently. Do not rinse.",
      asset: topical("F_EMUGROW_MCRD", "F-Emugrow MCRD topical"),
    },
  ],
  topicalNote:
    "Minoxidil or prescription changes should be reconsidered only after scalp barrier and dandruff are controlled.",
  recoveryJourney: [
    {
      window: "Day 0–30",
      title: "Calm the scalp and stabilise triggers",
      outcomes: ["Calm the scalp and stabilise triggers"],
      illustration: "scalp",
      stageCode: "DAY_0_30",
      asset: recovery("DAY_0_30"),
    },
    {
      window: "Day 30–60",
      title: "Reduce shedding and rebuild support",
      outcomes: ["Reduce shedding and rebuild support"],
      illustration: "follicle",
      stageCode: "DAY_30_60",
      asset: recovery("DAY_30_60"),
    },
    {
      window: "Day 60–120",
      title: "Early follicular recovery",
      outcomes: ["Early follicular recovery"],
      illustration: "recovery",
      stageCode: "DAY_60_120",
      asset: recovery("DAY_60_120"),
    },
    {
      window: "Beyond Day 120",
      title: "Visible improvement and consolidation",
      outcomes: ["Visible improvement and consolidation"],
      illustration: "recovery",
      stageCode: "BEYOND_120",
      asset: recovery("BEYOND_120"),
    },
  ],
  lifestyleSupport: {
    supports: [
      "Follow the prescribed treatment plan",
      "Iron-rich nutrition",
      "Adequate protein intake",
      "Gentle scalp care",
      "Avoid smoking or vaping",
      "Stress-management practice",
      "Consistent sleep routine",
    ],
    slows: [
      "Smoking or vaping",
      "Inconsistent treatment use",
      "Excess alcohol use",
      "Uncontrolled scalp inflammation",
      "Harsh chemical or heat styling",
    ],
  },
  guideUrl: "https://drfact.example/guide/ruchi",
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
      { kitCode: "FH_WELL_3", name: "FH Well 3", status: "valid" },
      { kitCode: "PHENOTYPE_INFLAMMATION", name: "Phenotype Inflammation", status: "valid" },
      { kitCode: "PRO_FACT_META_B_HYPOTHYROID", name: "Meta B Hypothyroid", status: "valid" },
      { kitCode: "PRO_IMMUNE_GOLD", name: "Pro Immune Gold", status: "valid" },
      { kitCode: "FPHL", name: "FPHL Pro", status: "valid" },
    ],
    topicals: [
      { topicalCode: "F_EMUGROW_MCRD", name: "F-Emugrow MCRD", status: "valid" },
    ],
    clinicalIcons: iconValidation(["Stress / Anxiety / Depression", "Smoking / Vaping", "Bodybuilding / Heavy gym", "Endometriosis", "Hypothyroidism", "Recurrent Acne / Acne-prone skin", "Indigestion", "High protein diet", "Chemical treatment (colour / keratin)", "Redness or irritation"]),
  },
};
