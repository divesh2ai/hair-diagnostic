import type { ClinicalReport, TreatmentPhase } from "@hairos/packages/ai-engine/report-engine/types";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
  type OnePageReportViewModel,
} from "../viewModel";

// Helper used by fixture files that want the runtime viewModel pipeline to
// generate their view model from a raw ClinicalReport-like input. Anything
// that flows through here honours the current narrative + snapshot +
// clinical-meaning rules automatically, so the design-preview PDFs stay in
// sync with the production code path.

export type RuntimeFixtureInput = {
  assessmentId: string;
  patient: { name: string; age: number; sex: "Male" | "Female"; goal: string[] };
  selections: Record<string, unknown>;
  clinicalInterpretation?: Array<{ signal: string; condition?: string; interpretation: string }>;
  phases: Array<Partial<TreatmentPhase> & { kitId: string; displayName: string; whySelected?: string }>;
  topicalRecommendations?: Array<{ name: string; usage: string; note: string; whySelected: string }>;
  approval?: OnePageReportContext["approval"];
  clinic?: OnePageReportContext["clinic"];
  clinician?: OnePageReportContext["clinician"];
  generatedAt?: string;
};

export function buildRuntimeFixture(input: RuntimeFixtureInput): OnePageReportViewModel {
  const phases: TreatmentPhase[] = input.phases.map((p, i) => ({
    phase: i + 1,
    kitId: p.kitId,
    displayName: p.displayName,
    whySelected: p.whySelected ?? "",
    supportingConditions: p.supportingConditions ?? [],
    keyIngredients: p.keyIngredients ?? [],
    mechanismOfAction: p.mechanismOfAction ?? [],
    formulationGroups: p.formulationGroups ?? [],
  }));
  const report = {
    patientSummary: {
      name: input.patient.name,
      age: input.patient.age,
      gender: input.patient.sex,
      goal: input.patient.goal,
      hairLossPattern: [],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: input.selections,
      clinicalInterpretation: input.clinicalInterpretation ?? [],
    },
    rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
    treatmentStrategy: phases,
    topicalRecommendations: input.topicalRecommendations ?? [],
    topicalCautions: [],
    recoveryRoadmap: [],
    recoveryMilestones: [],
    dietAndLifestyle: [],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    schemaVersion: "v4",
  } as unknown as ClinicalReport;

  const context: OnePageReportContext = {
    assessmentId: input.assessmentId,
    patient: { name: input.patient.name, age: input.patient.age, gender: input.patient.sex },
    approval: input.approval ?? {
      status: "APPROVED",
      approvedAt: input.generatedAt ?? new Date().toISOString(),
      approvedBy: "Divesh (Test Doctor)",
    },
    clinic: input.clinic ?? { name: "DrFACT Mumbai" },
    clinician: input.clinician ?? { name: "Divesh (Test Doctor)", title: "Reviewing doctor" },
    generatedAt: input.generatedAt,
  };
  return mapClinicalReportToPrintPresentation(report, context);
}
