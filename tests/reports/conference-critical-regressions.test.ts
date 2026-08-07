import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type {
  ClinicalReport,
  TreatmentPhase,
} from "../../src/packages/ai-engine/report-engine/types";

// Conference-pilot regressions. Each test here corresponds to a defect that
// reached a deployed build and would have been visible to a doctor.

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

function makeReport(
  phases: TreatmentPhase[],
  selections: Record<string, unknown>,
): ClinicalReport {
  return {
    patientSummary: {
      name: "Regression",
      age: 41,
      gender: "Male",
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
    generatedAt: "2026-08-07T00:00:00.000Z",
    schemaVersion: "v4",
  } as unknown as ClinicalReport;
}

const context: OnePageReportContext = {
  assessmentId: "conference-regression",
  approval: { status: "APPROVED", approvedAt: "2026-08-07T00:00:00.000Z" },
};

const RWL_PHASES = [
  phase({ phase: 1, kitId: "RAPID WEIGHT LOSS SHIELD", displayName: "Rapid Weight Loss Shield", whySelected: "Rapid weight loss." }),
];

const GLP1_PATTERN = /glp[-\s]?1|semaglutide|tirzepatide|ozempic|wegovy|mounjaro/i;

describe("GLP-1 is never inferred from rapid weight loss", () => {
  it("rapid weight loss / crash diet alone never mentions GLP-1", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(RWL_PHASES, {
        grade: "Grade 3 — Norwood III",
        duration: "3–6 months",
        count: "50-100 strands",
        cause: ["Rapid weight loss / Crash diet"],
      }),
      context,
    );
    const conclusion = view.clinicalResult.conclusion;
    expect(conclusion).not.toMatch(GLP1_PATTERN);
    expect(view.narrative.primaryActiveDriver?.label).not.toMatch(GLP1_PATTERN);
    // …and says what actually happened instead.
    expect(conclusion).toMatch(/rapid weight loss and associated nutritional strain/i);
    // Nothing anywhere in the rendered model may name a GLP-1 drug.
    expect(JSON.stringify(view)).not.toMatch(GLP1_PATTERN);
  });

  it("a crash-diet-only lifestyle signal also never mentions GLP-1", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(RWL_PHASES, {
        grade: "Grade 3 — Norwood III",
        duration: "3–6 months",
        count: "50-100 strands",
        lifestyle: ["Crash / Keto / Intermittent fasting"],
        cause: ["Rapid weight loss / Crash diet"],
      }),
      context,
    );
    expect(JSON.stringify(view)).not.toMatch(GLP1_PATTERN);
  });

  it("an explicit GLP-1 selection MAY use GLP-1 wording", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(RWL_PHASES, {
        grade: "Grade 3 — Norwood III",
        duration: "3–6 months",
        count: "50-100 strands",
        cause: ["Post GLP-1 receptor agonist (hair loss within 3 months)"],
      }),
      context,
    );
    expect(view.clinicalResult.conclusion).toMatch(/GLP-1/);
    expect(view.narrative.primaryActiveDriver?.label).toMatch(/GLP-1/);
  });
});

describe("low-signal summaries are valid without padding", () => {
  // The minimal case that previously rendered
  // "Error: Doctor-Reviewed Result is too short (37 words)".
  const lowSignalView = () =>
    mapClinicalReportToPrintPresentation(
      makeReport(
        [phase({ phase: 1, kitId: "FPHL", displayName: "FPHL Pro", whySelected: "Pattern." })],
        {
          grade: "Grade 1 — Ludwig 1",
          duration: "3–6 months",
          count: "50-100 strands",
          cause: ["Stress / Anxiety / Depression"],
          scalp: ["Normal scalp"],
        },
      ),
      context,
    );

  it("a concise summary carrying every required element raises no error", () => {
    const view = lowSignalView();
    const words = view.clinicalResult.conclusion.trim().split(/\s+/).length;
    expect(words).toBeLessThan(55);
    expect(words).toBeGreaterThanOrEqual(35);
    // No hard error — this is a legitimate low-signal case.
    expect(view.validation.errors).toEqual([]);
  });

  it("states diagnosis, contributors and strategy despite being short", () => {
    const c = lowSignalView().clinicalResult.conclusion;
    expect(c).toMatch(/Ludwig 1/);
    expect(c).toMatch(/may contribute further to slower recovery|may be linked to/);
    expect(c).toMatch(/addresses these factors through|Treatment begins with/);
  });

  it("does not pad the summary to reach a word count", () => {
    const c = lowSignalView().clinicalResult.conclusion;
    expect(c.trim().split(/\s+/).length).toBeLessThan(55);
  });
});

describe("internal validation output never reaches the rendered report", () => {
  const PAGE_SRC = readFileSync(
    "apps/patient-portal/src/app/reports/[assessmentId]/one-page/page.tsx",
    "utf8",
  );
  const REPORT_SRC = readFileSync(
    "apps/patient-portal/src/components/reports/one-page/OnePageHairReport.tsx",
    "utf8",
  );

  it("the report route renders no validation banner", () => {
    expect(PAGE_SRC).not.toContain("op-validation");
    expect(PAGE_SRC).not.toMatch(/Error:\s*\{/);
    expect(PAGE_SRC).not.toContain("validation.errors.map");
  });

  it("the report component never renders validation output", () => {
    expect(REPORT_SRC).not.toContain("op-validation");
    expect(REPORT_SRC).not.toContain("validation.errors");
  });

  it("validation results are still produced for tests and logs", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(RWL_PHASES, {
        grade: "Grade 3 — Norwood III",
        duration: "3–6 months",
        count: "50-100 strands",
        cause: ["Rapid weight loss / Crash diet"],
      }),
      context,
    );
    expect(view.validation).toBeDefined();
    expect(Array.isArray(view.validation.errors)).toBe(true);
    expect(Array.isArray(view.validation.warnings)).toBe(true);
  });
});
