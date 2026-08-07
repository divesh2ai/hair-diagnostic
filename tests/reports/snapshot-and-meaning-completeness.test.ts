import { describe, expect, it } from "vitest";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type {
  ClinicalReport,
  TreatmentPhase,
} from "../../src/packages/ai-engine/report-engine/types";

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

function makeReport(phases: TreatmentPhase[], selections: Record<string, unknown>): ClinicalReport {
  return {
    patientSummary: {
      name: "Test",
      age: 35,
      gender: "Female",
      goal: ["Reduce hair fall"],
      hairLossPattern: [],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: selections,
      clinicalInterpretation: [],
    },
    rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
    treatmentStrategy: phases,
    topicalRecommendations: [],
    topicalCautions: [],
    recoveryRoadmap: [],
    recoveryMilestones: [],
    dietAndLifestyle: [],
    generatedAt: "2026-08-04T00:00:00.000Z",
    schemaVersion: "v4",
  } as unknown as ClinicalReport;
}

const context: OnePageReportContext = {
  assessmentId: "snapshot-completeness",
  approval: { status: "APPROVED", approvedAt: "2026-08-04T00:00:00.000Z" },
};

describe("Key Clinical Snapshot — completeness", () => {
  it("surfaces every clinically meaningful patient selection (no 6-tile cap)", () => {
    // 12 distinct clinical selections across the field set the spec requires
    // to appear: duration, count, grade, hairtype, scalp, hormonal, thyroid,
    // immunity, gut, deficiency, cause, diet, lifestyle, treatment, goal.
    const selections: Record<string, unknown> = {
      duration: "3–6 months",
      count: "50-100 strands",
      grade: "Grade 2 — Ludwig 2",
      hairtype: ["Widening parting"],
      scalp: ["Dandruff / itchy scalp"],
      hormonal: ["Peri-menopause"],
      thyroid: ["Hypothyroidism"],
      immunity: ["Allergies"],
      gut: ["IBS / Crohn's"],
      deficiency: ["Iron / Anaemia"],
      cause: ["Stress / Anxiety / Depression"],
      diet: ["Non-vegetarian"],
      lifestyle: ["Sedentary"],
      treatment: ["Chemical treatment (colour / keratin)"],
      goal: ["Reduce hair fall"],
    };
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [phase({ phase: 1, kitId: "HAIR FACT PERI MENOPAUSE", displayName: "Hair Fact Peri Menopause", whySelected: "Peri-menopausal." })],
        selections,
      ),
      context,
    );
    const labels = view.keyClinicalSnapshot.map((t) => t.label.toLowerCase());
    // At least 10 tiles surface (multi-signal fixtures should be dense, not
    // capped at 6 — the earlier hard-coded slice(0, 6) was the bug).
    expect(view.keyClinicalSnapshot.length).toBeGreaterThanOrEqual(10);
    // Duration, grade and shedding COUNT are intentionally NOT tiles. The
    // snapshot carries contributor signals; measurements belong to the
    // patient-metadata card on the left (Duration, Shedding) and to the
    // Doctor-Reviewed Result, which states both. Repeating a measurement here
    // spends a tile on something already shown twice.
    expect(labels.some((l) => /^\d+\s*[–-]\s*\d+\s+months$/.test(l))).toBe(false);
    expect(labels.some((l) => /norwood|ludwig/.test(l))).toBe(false);
    expect(labels.some((l) => /\d+\s*-\s*\d+\s+strands/.test(l))).toBe(false);
    // Every selected CONTRIBUTOR signal is present as a tile.
    for (const signal of [
      "widening parting",
      "dandruff / itchy scalp",
      "peri-menopause",
      "hypothyroidism",
      "allergies",
      "ibs / crohn's",
      "iron / anaemia",
      "stress / anxiety / depression",
    ]) {
      expect(labels.some((l) => l.includes(signal))).toBe(true);
    }
  });

  it("does not duplicate signals or introduce unselected conditions", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron." })],
        {
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia", "Iron / Anaemia"], // duplicate on purpose
          scalp: ["Not flagged"],
        },
      ),
      context,
    );
    const labels = view.keyClinicalSnapshot.map((t) => t.label.toLowerCase());
    // Duplicate is collapsed.
    expect(labels.filter((l) => l === "iron / anaemia")).toHaveLength(1);
    // Not-flagged is excluded.
    expect(labels).not.toContain("not flagged");
    // No PCOS / thyroid / stress tile — none selected.
    for (const banned of ["pcos", "hypothyroidism", "stress / anxiety"]) {
      expect(labels.some((l) => l.includes(banned))).toBe(false);
    }
  });
});
