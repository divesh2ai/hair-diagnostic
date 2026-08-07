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
 * Turn B fixture — Harsh (MPHL, Norwood I). Male case with 2 kits + 1
 * topical. Preserves the CEO-approved Ruchi visual system; only the
 * clinical content is different. Verifies the layout stays balanced with
 * a small kit count (no giant empty rows).
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

export const harshFixture: OnePageReportViewModel = {
  assessmentId: "fixture-harsh",
  layoutMode: "standard",
  generatedAt: "31 Jul 2026",
  patient: {
    name: "Harsh",
    age: "29 yrs",
    gender: "Male",
    imageUrl: null,
    imageAsset: {
      ...reportAssets.portraits.maleFallback,
      source: "gender_fallback",
    },
    goal: "Stop early hair fall and protect the hairline",
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
    primary: "Male Pattern Hair Loss (MPHL) — Norwood I",
    supportingLine: "Early temple recession",
    conclusion:
      "Your responses indicate the earliest stage of androgenetic hair loss with mild temple recession only. Family history of pattern loss and an active lifestyle amplify pattern sensitivity, but the follicle miniaturisation is still limited. Your plan therefore focuses on protecting the temple and vertex follicles early with targeted androgen support and a doctor-guided topical routine.",
    reviewedBy: "Reviewed by Divesh (Test Doctor)",
  },
  driverStory: [
    {
      id: "drv-pattern",
      title: "Male pattern predisposition",
      priority: "Primary Driver",
      trigger: "Family history of MPHL",
      explanation: "Androgen-driven miniaturisation begins at the temples and vertex.",
      illustration: "hormonal",
      conditionCode: "MALE_PATTERN_HAIR_LOSS",
      asset: cond("MALE_PATTERN_HAIR_LOSS", "MPHL illustration"),
      tone: "gold",
    },
  ],
  snapshotStrip: [
    { label: "Duration", value: "6–12 months", illustration: "recovery" },
    { label: "Shedding", value: "~30–50 strands (Mild)", illustration: "follicle" },
    { label: "Pattern", value: "MPHL — Norwood I", illustration: "follicle" },
  ],
  patternScale: {
    type: "Norwood",
    patientStage: "Norwood I",
    stages: [
      {
        label: "I",
        value: "Norwood I",
        selected: true,
        asset: {
          key: "NORWOOD_I",
          src: "/clinical-visuals/grade/norwood/i.jpg",
          alt: "Norwood I clinical stage",
        },
      },
      {
        label: "II",
        value: "Norwood II",
        selected: false,
        asset: {
          key: "NORWOOD_II",
          src: "/clinical-visuals/grade/norwood/ii.jpg",
          alt: "Norwood II clinical stage",
        },
      },
      {
        label: "III",
        value: "Norwood III",
        selected: false,
        asset: {
          key: "NORWOOD_III",
          src: "/clinical-visuals/grade/norwood/iii.jpg",
          alt: "Norwood III clinical stage",
        },
      },
    ],
  },
  keyClinicalSnapshot: [
    clinical("Family history of MPHL"),
    clinical("Bodybuilding / Heavy gym"),
    clinical("High protein diet"),
    clinical("Stress / Anxiety"),
    clinical("Inconsistent sleep"),
    clinical("Vaping / Alcohol"),
  ],
  treatmentPlan: [
    {
      id: "row-1",
      sequence: "1",
      role: "Pattern protection",
      priority: "Primary Driver",
      name: "MPHL Pro",
      kitCode: "MPHL",
      selectedBecause: "Protect temple / vertex follicles from early androgen pressure.",
      mappedDriverId: "drv-pattern",
      mappedCondition: "Male pattern hair loss",
      mappedInterpretation: "Androgen-sensitive follicles beginning early miniaturisation",
      linkedDrivers: ["Norwood I pattern", "Family history of MPHL"],
      benefits: ["Protect temple / vertex follicles from early androgen pressure."],
      asset: kit("MPHL", "MPHL Pro kit"),
    },
    {
      id: "row-2",
      sequence: "2",
      role: "Metabolic support",
      priority: "Secondary Driver",
      name: "Pro Fact Meta B",
      kitCode: "PRO_FACT_META_B",
      selectedBecause: "Support metabolic drive and reduce lifestyle-linked follicle stress.",
      mappedDriverId: "drv-pattern",
      mappedCondition: "Metabolic pressure",
      mappedInterpretation: "Lifestyle-driven metabolic and oxidative stress on active follicles",
      linkedDrivers: ["Bodybuilding / Heavy gym", "High protein diet", "Vaping / Alcohol"],
      benefits: ["Support metabolic drive and reduce lifestyle-linked follicle stress."],
      asset: kit("PRO_FACT_META_B", "Pro Fact Meta B kit"),
    },
  ],
  additionalCare: [],
  topicalCare: [
    {
      name: "F-Extend 5% Minoxidil",
      topicalCode: "F_EXTEND_5",
      purpose: "For pattern thinning and responsive scalp areas",
      usage: "Apply once daily as prescribed. Massage gently. Do not rinse.",
      asset: topical("F_EXTEND_5", "F-Extend 5% Minoxidil topical"),
    },
  ],
  topicalNote:
    "Start minoxidil only after doctor confirmation and after any scalp irritation is controlled.",
  recoveryJourney: [
    {
      window: "Day 0–30",
      title: "Establish routine and tolerance",
      outcomes: ["Establish routine and tolerance"],
      illustration: "scalp",
      stageCode: "DAY_0_30",
      asset: recovery("DAY_0_30"),
    },
    {
      window: "Day 30–60",
      title: "Reduce shedding and steady the hairline",
      outcomes: ["Reduce shedding and steady the hairline"],
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
      title: "Consolidate coverage and maintain",
      outcomes: ["Consolidate coverage and maintain"],
      illustration: "recovery",
      stageCode: "BEYOND_120",
      asset: recovery("BEYOND_120"),
    },
  ],
  lifestyleSupport: {
    supports: [
      "Follow the prescribed treatment plan",
      "Adequate protein intake",
      "Consistent sleep routine",
      "Regular walking or movement",
      "Stress-management practice",
      "Hydration",
    ],
    slows: [
      "Inconsistent treatment use",
      "Vaping or alcohol",
      "Excessive heat / chemical styling",
      "Skipping the topical routine",
    ],
  },
  guideUrl: "https://drfact.example/guide/harsh",
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
      { kitCode: "MPHL", name: "MPHL Pro", status: "valid" },
      { kitCode: "PRO_FACT_META_B", name: "Pro Fact Meta B", status: "valid" },
    ],
    topicals: [
      { topicalCode: "F_EXTEND_5", name: "F-Extend 5% Minoxidil", status: "valid" },
    ],
    clinicalIcons: iconValidation(["Family history of MPHL", "Bodybuilding / Heavy gym", "High protein diet", "Stress / Anxiety", "Inconsistent sleep", "Vaping / Alcohol"]),
  },
};
