import { buildRuntimeFixture } from "./_runtime";
import { scoreKits } from "@hairos/packages/ai-engine/kit-scorer/scoreKits";
import { evaluateClinicalProfile } from "@hairos/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "@hairos/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import type { PatientAnswers } from "@hairos/packages/types";
import type { ClinicConfig, BudgetProfile } from "@hairos/packages/ai-engine/kit-scorer/types";
import type { TreatmentPhase } from "@hairos/packages/ai-engine/report-engine/types";

// Post-menopause + Obesity — a 58-year-old female. The treatment plan is NOT
// hand-written: it is produced by running the ACTIVE kit-selection engine on
// the synthetic answers and feeding its ranked kits straight through the
// runtime view-model pipeline. So this dev preview renders exactly what the
// engine selects (PRO FACT META B POSTMENOPAUSE, never Peri, never generic
// Meta B) with the production identity / packshot / rationale rules applied.
//
// Dev-only (the fixture route 404s in production).

const ANSWERS: PatientAnswers = {
  sex: "Female",
  age: "58",
  grade: "Grade 2",
  thyroid: [],
  hormonal: ["Post-menopause"],
  lifestyle: ["Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight"],
  diet: [],
  cause: [],
  scalp: [],
  immunity: [],
  deficiency: [],
  gut: [],
  hairtype: [],
  treatment: [],
  goal: ["Reduce hair fall"],
  duration: "3–6 months",
  count: "50–100 strands",
} as PatientAnswers;

const CLINIC: ClinicConfig = {
  clinicId: "acube-aesthetics",
  availableKits: [
    "HAIR FACT TE GOLD",
    "PRO FACT META B",
    "PRO FACT META B POSTMENOPAUSE",
    "FPHL",
    "RAPID WEIGHT LOSS SHIELD",
    "PRO FACT GI GOLD",
    "PHENOTYPE INFLAMATION",
    "PRO IMMUNE GOLD",
    "HAIR FACT PERI MENOPAUSE",
  ],
};
const BUDGET: BudgetProfile = { tier: "COMPREHENSIVE", maxKits: 7 };

const profile = evaluateClinicalProfile(ANSWERS);
const ranked = scoreKits(profile, mapTherapyNeeds(profile), ANSWERS, CLINIC, BUDGET).rankedKits;

const phases: Array<Partial<TreatmentPhase> & { kitId: string; displayName: string }> = ranked.map(
  (k) => ({
    kitId: k.kitId,
    displayName: k.kitId,
    whySelected:
      "Engine-selected for the post-menopausal metabolic hair-loss profile (Post-menopause + Obesity).",
    supportingConditions: ["Post-menopause", "Metabolic / weight"],
    mechanismOfAction: [
      "Targets post-menopausal metabolic drivers of hair loss",
      "Supports follicular energy and hair-cycle drive",
    ],
  }),
);

export const postmenoRuntimeFixture = buildRuntimeFixture({
  assessmentId: "fixture-postmeno",
  patient: {
    name: "Postmenopause Acceptance",
    age: 58,
    sex: "Female",
    goal: ["Reduce hair fall"],
  },
  generatedAt: "14 Oct 2026",
  selections: {
    grade: "Grade 2",
    duration: "3–6 months",
    count: "~50-100 strands (Noticeable)",
    hormonal: ["Post-menopause"],
    lifestyle: ["Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight"],
    goal: ["Reduce hair fall"],
  },
  clinicalInterpretation: [
    {
      signal: "Post-menopause",
      condition: "Post-menopausal metabolic hair loss",
      interpretation:
        "Declared post-menopause with a metabolic/weight signal points to the post-menopausal metabolic hair-loss picture.",
    },
  ],
  phases,
});
