import { describe, expect, it } from "vitest";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type {
  ClinicalReport,
  TreatmentPhase,
} from "../../src/packages/ai-engine/report-engine/types";

// The one-pager's mapping-row CLINICAL MEANING column must prefer the
// patient-specific interpretation produced by the clinical engine (populated
// on `patientSummary.clinicalInterpretation` and matched to a kit by
// `interpretationLookupForKit`) over the generic kit-family template. This
// test locks that priority on the view model.

function phase(overrides: Partial<TreatmentPhase>): TreatmentPhase {
  return {
    phase: 1,
    kitId: "",
    displayName: "",
    whySelected: "",
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
    ...overrides,
  };
}

const context: OnePageReportContext = {
  assessmentId: "clinical-meaning-priority",
  approval: { status: "APPROVED", approvedAt: "2026-08-04T00:00:00.000Z" },
};

describe("Clinical Meaning column — patient-specific interpretation leads", () => {
  it("uses the clinical engine's interpretation for the kit when available", () => {
    const patientSpecific =
      "In addition to oxygenation, iron is essential for DNA repair, conversion of thyroid hormone T4 to T3.";
    const report = {
      patientSummary: {
        name: "Interpretation Test",
        age: 34,
        gender: "Female",
        goal: ["Hair recovery"],
        hairLossPattern: [],
        scalpConcerns: [],
        lifestyleFactors: [],
        medicalFactors: [],
        previousTreatments: [],
        questionnaireSelections: {
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia"],
        },
        // Signal + condition + interpretation — the row that
        // interpretationLookupForKit matches to Iron Up via kitTagPattern.
        clinicalInterpretation: [
          {
            signal: "Iron / Anaemia",
            condition: "Iron deficiency hair loss",
            interpretation: patientSpecific,
          },
        ],
      },
      rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
      treatmentStrategy: [
        phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron deficiency reported." }),
      ],
      topicalRecommendations: [],
      topicalCautions: [],
      recoveryRoadmap: [],
      recoveryMilestones: [],
      dietAndLifestyle: [],
      generatedAt: "2026-08-04T00:00:00.000Z",
      schemaVersion: "v4",
    } as unknown as ClinicalReport;

    const view = mapClinicalReportToPrintPresentation(report, context);
    const iron = view.treatmentPlan.find((k) => k.kitCode === "IRON_UP_GOLD");
    expect(iron).toBeDefined();
    // mappedInterpretation carries the patient-specific line onto the kit
    // (source of truth for the CLINICAL MEANING column). The rendering
    // helper conciseClinicalMeaning() in the component reads this first.
    expect(iron?.mappedInterpretation).toBe(patientSpecific);
    // mappedCondition also comes from the interpretation, not a kit-family
    // default.
    expect(iron?.mappedCondition).toBe("Iron deficiency hair loss");
  });

  it("falls back to the kit-family template only when no patient-specific interpretation matches", () => {
    const report = {
      patientSummary: {
        name: "Fallback Test",
        age: 34,
        gender: "Female",
        goal: ["Hair recovery"],
        hairLossPattern: [],
        scalpConcerns: [],
        lifestyleFactors: [],
        medicalFactors: [],
        previousTreatments: [],
        questionnaireSelections: {
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia"],
        },
        // Empty — no patient-specific interpretation available.
        clinicalInterpretation: [],
      },
      rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
      treatmentStrategy: [
        phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron deficiency reported." }),
      ],
      topicalRecommendations: [],
      topicalCautions: [],
      recoveryRoadmap: [],
      recoveryMilestones: [],
      dietAndLifestyle: [],
      generatedAt: "2026-08-04T00:00:00.000Z",
      schemaVersion: "v4",
    } as unknown as ClinicalReport;

    const view = mapClinicalReportToPrintPresentation(report, context);
    const iron = view.treatmentPlan.find((k) => k.kitCode === "IRON_UP_GOLD");
    expect(iron?.mappedInterpretation).toBeNull();
    // mappedCondition falls through to the canonical kit indication.
    expect(iron?.mappedCondition).toBe("Iron deficiency / heavy menstrual bleeding");
  });
});
