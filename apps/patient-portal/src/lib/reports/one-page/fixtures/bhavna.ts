import type { OnePageReportViewModel } from "../viewModel";
import { getConditionAsset, getProductAsset, reportAssets } from "../productAssets";
import { resolveClinicalOptionAsset } from "../clinicalOptionAssets";
import { ruchiFixture } from "./ruchi";

const clinical = (label: string) => {
  const resolved = resolveClinicalOptionAsset({ label });
  return { optionCode: resolved.optionCode, label, asset: resolved.asset, assetStatus: resolved.status };
};

const kit = (code: string, alt: string) => getProductAsset(code) ?? { key: code, src: "", alt };

export const bhavnaFixture: OnePageReportViewModel = {
  ...ruchiFixture,
  assessmentId: "fixture-bhavna",
  layoutMode: "standard",
  patient: {
    name: "Bhavna",
    age: "38 yrs",
    gender: "Female",
    imageUrl: null,
    imageAsset: { ...reportAssets.portraits.femaleFallback, source: "gender_fallback" },
    goal: "Reduce diffuse shedding and rebuild density",
    phone: null,
  },
  clinicalResult: {
    primary: "Female Pattern Hair Loss (FPHL) — Ludwig 1",
    supportingLine: "Diffuse shedding with early part widening",
    conclusion:
      "Your responses indicate early female pattern thinning with active diffuse shedding. PCOS-related hormonal pressure, pre-diabetes, constipation, and nutritional deficiency signals may be slowing follicular recovery. Your plan therefore focuses on hormonal balance, metabolic support, and rebuilding nutritional reserves while protecting pattern-sensitive follicles.",
    reviewedBy: "Reviewed by Divesh (Test Doctor)",
  },
  driverStory: [
    {
      id: "drv-pcos",
      title: "PCOS / PCOD",
      priority: "Primary Driver",
      trigger: "Hormonal and metabolic pressure",
      explanation: "Hormonal imbalance and insulin resistance can amplify pattern-sensitive thinning.",
      illustration: "hormonal",
      conditionCode: "HORMONAL_CONTRIBUTOR",
      asset: getConditionAsset("HORMONAL_CONTRIBUTOR"),
      tone: "gold",
    },
  ],
  snapshotStrip: [
    { label: "Duration", value: "6–12 months", illustration: "recovery" },
    { label: "Shedding", value: "100+ strands (Heavy loss)", illustration: "follicle" },
    { label: "Pattern", value: "FPHL — Ludwig 1", illustration: "follicle" },
  ],
  patternScale: {
    type: "Ludwig",
    patientStage: "Ludwig 1",
    stages: [{ label: "1", value: "Ludwig 1", selected: true, asset: { key: "LUDWIG_1", src: "/clinical-visuals/grade/ludwig/grade1.jpg", alt: "Ludwig 1 clinical stage" } }],
  },
  keyClinicalSnapshot: [
    clinical("PCOS / PCOD"), clinical("Pre diabetes"), clinical("Constipation"),
    clinical("Nutritional deficiencies"), clinical("Vegetarian"),
    clinical("Stress / Anxiety / Depression"), clinical("Redness or irritation"),
  ],
  treatmentPlan: [
    {
      id: "bhavna-row-1", sequence: "1", role: "Hormonal support", priority: "Primary Driver",
      name: "F-PCOS 1", kitCode: "F_PCOS_1",
      selectedBecause: "Support PCOS-linked hormonal pressure affecting the hair cycle.",
      mappedDriverId: "drv-pcos", mappedCondition: "PCOS / PCOD",
      mappedInterpretation: "Hormonal imbalance with pattern-sensitive thinning",
      linkedDrivers: ["PCOS / PCOD", "Ludwig 1 pattern"], benefits: ["Support hormonal balance and follicular recovery."],
      asset: kit("F_PCOS_1", "F-PCOS 1 kit"),
    },
    {
      id: "bhavna-row-2", sequence: "2", role: "Metabolic support", priority: "Secondary Driver",
      name: "Pro Fact Meta B PCOS", kitCode: "PRO_FACT_META_B_PCOS",
      selectedBecause: "Support insulin sensitivity and metabolic drive.",
      mappedDriverId: "drv-pcos", mappedCondition: "Pre diabetes",
      mappedInterpretation: "Insulin resistance may slow follicular energy delivery",
      linkedDrivers: ["Pre diabetes", "PCOS / PCOD"], benefits: ["Support metabolic activity and treatment response."],
      asset: kit("PRO_FACT_META_B_PCOS", "Pro Fact Meta B PCOS kit"),
    },
    {
      id: "bhavna-row-3", sequence: "3", role: "Foundation", priority: "Supporting Contributor",
      name: "Iron Up Gold", kitCode: "IRON_UP_GOLD",
      selectedBecause: "Rebuild nutritional reserves linked to diffuse shedding.",
      mappedDriverId: "drv-pcos", mappedCondition: "Nutritional deficiencies",
      mappedInterpretation: "Nutritional reserve gaps may prolong diffuse shedding",
      linkedDrivers: ["Nutritional deficiencies", "Vegetarian"], benefits: ["Support iron and micronutrient sufficiency."],
      asset: kit("IRON_UP_GOLD", "Iron Up Gold kit"),
    },
  ],
  lifestyleSupport: {
    supports: ["Follow the prescribed treatment plan", "Iron-rich vegetarian nutrition", "Consistent sleep routine", "Regular walking or movement", "Gentle scalp care"],
    slows: ["Inconsistent treatment use", "Irregular meals", "Uncontrolled metabolic risk", "Unaddressed nutritional deficiencies"],
  },
  guideUrl: "https://drfact.example/guide/bhavna",
  validation: {
    ok: true,
    errors: [],
    warnings: ["PCOS / PCOD uses the hormonal-domain fallback pending an exact crop."],
    kits: [
      { kitCode: "F_PCOS_1", name: "F-PCOS 1", status: "valid" },
      { kitCode: "PRO_FACT_META_B_PCOS", name: "Pro Fact Meta B PCOS", status: "valid" },
      { kitCode: "IRON_UP_GOLD", name: "Iron Up Gold", status: "valid" },
    ],
    topicals: ruchiFixture.validation.topicals,
    clinicalIcons: ["PCOS / PCOD", "Pre diabetes", "Constipation", "Nutritional deficiencies", "Vegetarian", "Stress / Anxiety / Depression", "Redness or irritation"].map((label) => {
      const resolved = resolveClinicalOptionAsset({ label });
      return { optionCode: resolved.optionCode, label, status: resolved.status, assetPath: resolved.asset.src };
    }),
  },
};
