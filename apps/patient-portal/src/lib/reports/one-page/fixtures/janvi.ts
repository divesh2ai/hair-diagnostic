import type { OnePageReportViewModel } from "../viewModel";
import { getProductAsset, getTopicalAsset } from "../productAssets";
import { resolveClinicalOptionAsset } from "../clinicalOptionAssets";
import { ruchiFixture } from "./ruchi";

const clinical = (label: string) => {
  const resolved = resolveClinicalOptionAsset({ label });
  return { optionCode: resolved.optionCode, label, asset: resolved.asset, assetStatus: resolved.status };
};

const kit = (code: string, alt: string) =>
  getProductAsset(code) ?? { key: code, src: "", alt };

const topical = (code: string, alt: string) =>
  getTopicalAsset(code) ?? { key: code, src: "", alt };

const snapshotLabels = [
  "Iron / Anaemia",
  "Alcohol",
  "Constipation",
  "Inflammatory scalp signals",
  "Post hysterectomy",
  "Female pattern hair loss",
];

/** Controlled Conference One-Pager V1 evidence fixture: four pathways. */
export const janviFixture: OnePageReportViewModel = {
  ...ruchiFixture,
  assessmentId: "fixture-janvi-conference-v1",
  layoutMode: "standard",
  generatedAt: "3 Aug 2026",
  patient: {
    ...ruchiFixture.patient,
    name: "Janvi",
    age: "42 yrs",
    gender: "Female",
    goal: "Reduce active shedding and support hair-cycle recovery",
  },
  clinicalResult: {
    primary: "Female Pattern Hair Loss (FPHL) - Ludwig 1",
    supportingLine: "Active shedding",
    conclusion:
      "Your assessment shows early female pattern hair loss with active shedding. Low iron stores, gut and inflammatory stress, and post-hysterectomy hormonal transition may be affecting follicle energy and the hair cycle. The doctor-reviewed plan prioritises iron recovery, a healthier follicle environment, hormonal-transition support, and protection for pattern-sensitive follicles.",
    reviewedBy: "Reviewed by Divesh (Test Doctor)",
  },
  snapshotStrip: [
    { label: "Duration", value: "6-12 months", illustration: "recovery" },
    { label: "Shedding", value: "~50-100 strands - Active", illustration: "follicle" },
    { label: "Pattern", value: "FPHL - Ludwig 1", illustration: "follicle" },
  ],
  patternScale: {
    type: "Ludwig",
    patientStage: "Ludwig 1",
    stages: [
      {
        label: "1",
        value: "Ludwig 1",
        selected: true,
        asset: {
          key: "LUDWIG_1",
          src: "/clinical-visuals/grade/ludwig/grade1.jpg",
          alt: "Ludwig 1 clinical stage",
        },
      },
    ],
  },
  keyClinicalSnapshot: snapshotLabels.map(clinical),
  treatmentPlan: [
    {
      id: "janvi-iron",
      sequence: "1",
      role: "Foundation",
      priority: "Primary Driver",
      name: "Iron Up Gold",
      kitCode: "IRON_UP_GOLD",
      selectedBecause: "Low iron and anaemia signals",
      mappedDriverId: "janvi-iron",
      mappedCondition: "Iron / Anaemia",
      mappedInterpretation: "Low iron stores may weaken follicular energy and hair-cycle activity.",
      linkedDrivers: ["Iron / Anaemia"],
      benefits: ["Supports iron and ferritin recovery", "Helps improve oxygen and nutrient support to follicles"],
      asset: kit("IRON_UP_GOLD", "Iron Up Gold kit"),
    },
    {
      id: "janvi-inflammation",
      sequence: "2",
      role: "Inflammation control",
      priority: "Secondary Driver",
      name: "Phenotype Inflammation",
      kitCode: "PHENOTYPE_INFLAMMATION",
      selectedBecause: "Gut, oxidative and inflammatory stress",
      mappedDriverId: "janvi-inflammation",
      mappedCondition: "Inflammatory follicle environment",
      mappedInterpretation: "Gut, oxidative and inflammatory stress affecting the follicle environment.",
      linkedDrivers: ["Alcohol + constipation", "Inflammatory scalp signals"],
      benefits: ["Helps reduce inflammatory and oxidative stress", "Supports a healthier scalp and follicle environment"],
      asset: kit("PHENOTYPE_INFLAMMATION", "Phenotype Inflammation kit"),
    },
    {
      id: "janvi-hysterectomy",
      sequence: "3",
      role: "Hormonal transition",
      priority: "Secondary Driver",
      name: "Pro Fact Post Hysterectomy Reset",
      kitCode: "POST_HYSTERECTOMY_RESET",
      selectedBecause: "Post-hysterectomy hormonal transition",
      mappedDriverId: "janvi-hysterectomy",
      mappedCondition: "Post-hysterectomy",
      mappedInterpretation: "Hormonal-transition support during hair-cycle recovery.",
      linkedDrivers: ["Post-hysterectomy"],
      benefits: ["Supports hormonal-transition recovery", "Helps stabilise the hair cycle during systemic change"],
      asset: kit("PRO_FACT_POST_HYSTERECTOMY", "Pro Fact Post Hysterectomy Reset kit"),
    },
    {
      id: "janvi-fphl",
      sequence: "4",
      role: "Pattern protection",
      priority: "Primary Driver",
      name: "FPHL Pro",
      kitCode: "FPHL",
      selectedBecause: "Ludwig 1 pattern-sensitive thinning",
      mappedDriverId: "janvi-fphl",
      mappedCondition: "Ludwig 1",
      mappedInterpretation: "Early pattern-sensitive follicular thinning.",
      linkedDrivers: ["Ludwig 1"],
      benefits: ["Protects pattern-sensitive follicles", "Supports hair calibre and follicular resilience"],
      asset: kit("FPHL", "FPHL Pro kit"),
    },
  ],
  additionalCare: [],
  topicalCare: [
    {
      name: "F-Emugrow MCRD",
      topicalCode: "F_EMUGROW_MCRD",
      purpose: "Pattern and scalp support",
      usage: "Apply once daily as prescribed. Massage gently. Do not rinse.",
      asset: topical("F_EMUGROW_MCRD", "F-Emugrow MCRD topical"),
    },
    {
      name: "F-Biwash Plus",
      topicalCode: "F_BIWASH_PLUS",
      purpose: "Scalp cleansing support",
      usage: "Use as prescribed. Massage into the scalp. Rinse thoroughly.",
      asset: topical("F_BIWASH_PLUS", "F-Biwash Plus topical"),
    },
  ],
  topicalNote: "",
  lifestyleSupport: {
    supports: ["Follow the prescribed plan", "Iron-rich nutrition", "Gentle scalp care", "Stress management", "Consistent sleep"],
    slows: ["Inconsistent treatment", "Excess alcohol", "Uncontrolled inflammation", "Harsh chemical or heat styling"],
  },
  guideUrl: "https://drfact.example/guide/janvi",
  validation: {
    ok: true,
    errors: [],
    warnings: [],
    kits: [
      { kitCode: "IRON_UP_GOLD", name: "Iron Up Gold", status: "valid" },
      { kitCode: "PHENOTYPE_INFLAMMATION", name: "Phenotype Inflammation", status: "valid" },
      { kitCode: "POST_HYSTERECTOMY_RESET", name: "Pro Fact Post Hysterectomy Reset", status: "valid" },
      { kitCode: "FPHL", name: "FPHL Pro", status: "valid" },
    ],
    clinicalIcons: snapshotLabels.map((label) => {
      const resolved = resolveClinicalOptionAsset({ label });
      return { optionCode: resolved.optionCode, label, status: resolved.status, assetPath: resolved.asset.src };
    }),
  },
};
