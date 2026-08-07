import { describe, expect, it } from "vitest";
import {
  detectSequencingMode,
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type {
  ClinicalReport,
  TreatmentPhase,
} from "../../src/packages/ai-engine/report-engine/types";

// Locks the language-hygiene rules the Doctor-Reviewed Result must honour:
//   - tentative softeners ("may indicate" / "may contribute" / "is consistent
//     with"), never certainty phrasing
//   - unsupported contributors (thyroid / hormonal / stress) never appear
//     when the questionnaire did not select them
//   - Ravsharan-style 5-kit conclusion falls inside the 55–100 word band

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
  patientOverrides: Partial<ClinicalReport["patientSummary"]> = {},
): ClinicalReport {
  const base: Partial<ClinicalReport> = {
    patientSummary: {
      name: "Test",
      age: 40,
      gender: "Male",
      goal: ["Reduce hair fall"],
      hairLossPattern: [],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: selections,
      clinicalInterpretation: [],
      ...patientOverrides,
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
  };
  return base as ClinicalReport;
}

const context: OnePageReportContext = {
  assessmentId: "narrative-hygiene",
  approval: { status: "APPROVED", approvedAt: "2026-08-04T00:00:00.000Z" },
};

describe("narrative language hygiene", () => {
  it("uses softener phrasing (is consistent with / may be linked to / may contribute)", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "RAPID WEIGHT LOSS SHIELD", displayName: "Rapid Weight Loss Shield", whySelected: "RWL." }),
          phase({ phase: 2, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
        ],
        {
          grade: "Grade 3 — Norwood III",
          duration: "3–6 months",
          count: "50-100 strands",
          cause: ["Rapid weight loss / Crash diet"],
          gut: ["IBS / Crohn's"],
        },
      ),
      context,
    );
    const c = view.clinicalResult.conclusion;
    // Diagnosis line uses "is consistent with" instead of a definitive
    // "Your assessment indicates X".
    expect(c).toMatch(/Your assessment is consistent with/);
    // Primary active trigger uses "may be linked to" — never "is caused by".
    expect(c).toMatch(/may be linked to/);
    expect(c).not.toMatch(/\bis caused by\b|\bare caused by\b/i);
    // Secondary contributors use "may contribute further".
    // (Not required for every case — only when secondaryDrivers is non-empty.)
    if (view.narrative.secondaryDrivers.length > 0) {
      expect(c).toMatch(/may contribute further/);
    }
    // Kit order here is a plain 1..N priority ranking, so the closing
    // sentence must not imply chronology.
    expect(c).toMatch(/Your treatment plan addresses these factors through/);
    expect(c).not.toMatch(/Treatment begins with/);
  });

  it("never introduces unsupported contributors (thyroid / hormonal / stress)", () => {
    // No thyroid, hormonal, or stress selections — those contributors must
    // not surface in the narrative.
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron." }),
          phase({ phase: 2, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
        ],
        {
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia"],
          gut: ["IBS / Crohn's"],
        },
      ),
      context,
    );
    const c = view.clinicalResult.conclusion.toLowerCase();
    const secondary = view.narrative.secondaryDrivers.map((s) => s.toLowerCase()).join(" ");
    // These signals were never selected — must not appear anywhere.
    for (const banned of ["thyroid", "hormonal transition", "menopausal", "hyperthyroid", "hypothyroid", "stress-driven"]) {
      expect(c).not.toContain(banned);
      expect(secondary).not.toContain(banned);
    }
  });

  it("ignores selection field values that are Not-flagged / None / No major concern", () => {
    // The clinical snapshot must exclude tiles like "Not flagged", "None",
    // "No gut issues" — these are non-selections, not clinical findings.
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
        ],
        {
          duration: "3–6 months",
          count: "50-100 strands",
          gut: ["IBS / Crohn's"],
          scalp: ["Not flagged"],
          hormonal: ["None"],
          immunity: ["No major concern"],
          thyroid: ["No thyroid history"],
          deficiency: ["No deficiencies"],
        },
      ),
      context,
    );
    const labels = view.keyClinicalSnapshot.map((t) => t.label.toLowerCase());
    for (const label of labels) {
      expect(label).not.toMatch(/^not (flagged|recorded|applicable|sure)/);
      expect(label).not.toMatch(/^none$/);
      expect(label).not.toMatch(/^no (major concern|gut issues|deficiencies|thyroid history|scalp issues|significant|allergies)/);
    }
    // The one actual clinical selection is present.
    expect(labels).toEqual(expect.arrayContaining(["ibs / crohn's"]));
  });

  // ── Content Master §3 summary-selection rules ─────────────────────────────

  it("opens with 'Your responses suggest a combination of' when no pattern grade was captured", () => {
    // No Ludwig/Norwood grade — the summary must not present a contributing
    // driver ("Metabolic dysfunction", "Gut dysfunction") as a diagnosis.
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
          phase({ phase: 2, kitId: "PRO FACT META B", displayName: "Pro Fact Meta B", whySelected: "Metabolic." }),
        ],
        {
          duration: "3–6 months",
          count: "50-100 strands",
          gut: ["IBS / Crohn's"],
          lifestyle: ["Obesity / Struggle to lose weight"],
        },
      ),
      context,
    );
    const c = view.clinicalResult.conclusion;
    expect(view.narrative.underlyingPattern).toBe("");
    expect(c).toMatch(/^Your responses suggest a combination of contributing factors/);
    expect(c).not.toMatch(/Your assessment is consistent with/);
    // The contributors are still named — in the contributors sentence, where
    // they read as contributors rather than as a diagnosis.
    expect(c.toLowerCase()).toContain("gut dysfunction");
  });

  it("keeps the diagnosis opener when a pattern grade IS present", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [phase({ phase: 1, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." })],
        {
          grade: "Grade 3 — Norwood III",
          duration: "3–6 months",
          count: "50-100 strands",
          gut: ["IBS / Crohn's"],
        },
      ),
      context,
    );
    expect(view.clinicalResult.conclusion).toMatch(
      /^Your assessment is consistent with Male Pattern Hair Loss at Norwood III/,
    );
  });

  // ── Treatment sequencing mode ─────────────────────────────────────────────
  // "begins with / followed by" asserts chronology and may only be used when
  // the plan actually encodes clinical phasing. buildKitSequence assigns
  // `phase: i + 1` as a priority index, so the default path is concurrent.

  it("detectSequencingMode: a 1..N per-kit enumeration is ranking, not chronology", () => {
    expect(detectSequencingMode([phase({ phase: 1 }), phase({ phase: 2 }), phase({ phase: 3 })])).toBe(
      "concurrent",
    );
    // Genuine phasing groups several kits under a shared phase number.
    expect(detectSequencingMode([phase({ phase: 1 }), phase({ phase: 1 }), phase({ phase: 2 })])).toBe(
      "sequenced",
    );
    // A single kit carries no sequencing either way.
    expect(detectSequencingMode([phase({ phase: 1 })])).toBe("concurrent");
  });

  it("renders concurrent phrasing when kit order is a priority ranking", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron." }),
          phase({ phase: 2, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
        ],
        {
          grade: "Grade 3 — Norwood III",
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia"],
          gut: ["IBS / Crohn's"],
        },
      ),
      context,
    );
    const c = view.clinicalResult.conclusion;
    expect(c).toContain("Your treatment plan addresses these factors through iron recovery");
    expect(c).not.toContain("Treatment begins with");
    expect(c).not.toContain("followed by");
    // The contentless-phrase validator must not fire on the contentful form.
    expect(view.validation.errors.filter((e) => /generic template phrase/i.test(e))).toEqual([]);
  });

  it("renders sequenced phrasing when the plan carries real clinical phasing", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          // Two kits share phase 1 — a genuine phase GROUP, not an index.
          phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron." }),
          phase({ phase: 1, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
          phase({ phase: 2, kitId: "PHENOTYPE INFLAMATION", displayName: "Phenotype Inflammation", whySelected: "Dandruff." }),
        ],
        {
          grade: "Grade 3 — Norwood III",
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia"],
          gut: ["IBS / Crohn's"],
          scalp: ["Dandruff"],
        },
      ),
      context,
    );
    const c = view.clinicalResult.conclusion;
    expect(c).toContain("Treatment begins with iron recovery");
    expect(c).toContain("followed by");
    expect(c).not.toContain("addresses these factors through");
  });

  it("collapses kits acting on one mechanism into a single purpose", () => {
    // Meta B + Thyroid Care are two kits but one mechanism cluster, so the
    // summary states one purpose rather than padding the prose.
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "PRO FACT META B", displayName: "Pro Fact Meta B", whySelected: "Metabolic." }),
          phase({ phase: 2, kitId: "PRO FACT THYROID CARE", displayName: "Pro Fact Thyroid Care", whySelected: "Thyroid." }),
        ],
        {
          grade: "Grade 3 — Norwood III",
          duration: "3–6 months",
          count: "50-100 strands",
          thyroid: ["Hypothyroidism"],
          lifestyle: ["Obesity / Struggle to lose weight"],
        },
      ),
      context,
    );
    const phrases = view.narrative.treatmentStrategy.map((s) => s.phrase);
    expect(phrases).toEqual(["metabolic and thyroid support", "metabolic and thyroid support"]);
    // Stated once in the prose, and both kits still render in the plan.
    const c = view.clinicalResult.conclusion;
    expect(c.split("metabolic and thyroid support").length - 1).toBe(1);
    expect(view.treatmentPlan).toHaveLength(2);
  });

  it("caps the treatment-purpose chain at five and folds the remainder honestly", () => {
    const view = mapClinicalReportToPrintPresentation(
      makeReport(
        [
          phase({ phase: 1, kitId: "IRON UP GOLD", displayName: "Iron Up Gold", whySelected: "Iron." }),
          phase({ phase: 2, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS." }),
          phase({ phase: 3, kitId: "PHENOTYPE INFLAMATION", displayName: "Phenotype Inflammation", whySelected: "Dandruff." }),
          phase({ phase: 4, kitId: "PRO FACT META B", displayName: "Pro Fact Meta B", whySelected: "Metabolic." }),
          phase({ phase: 5, kitId: "PRO IMMUNE GOLD", displayName: "Pro Immune 5", whySelected: "Allergies." }),
          phase({ phase: 6, kitId: "HAIR FACT HAIR BREAKAGE REPAIR", displayName: "Hair Fact Hair Breakage Repair (HBR)", whySelected: "Breakage." }),
          phase({ phase: 7, kitId: "EARLY GREYING CARE GOLD", displayName: "Early Greying Care Gold", whySelected: "Greying." }),
        ],
        {
          grade: "Grade 3 — Norwood III",
          duration: "3–6 months",
          count: "50-100 strands",
          deficiency: ["Iron / Anaemia"],
          gut: ["IBS / Crohn's"],
          scalp: ["Dandruff"],
          lifestyle: ["Obesity / Struggle to lose weight"],
          immunity: ["Allergies"],
          treatment: ["Chemical treatment"],
        },
      ),
      context,
    );
    const c = view.clinicalResult.conclusion;
    const uniquePhrases = [...new Set(view.narrative.treatmentStrategy.map((s) => s.phrase))];
    expect(uniquePhrases.length).toBeGreaterThan(5);
    // Only the first four purposes are named…
    for (const phrase of uniquePhrases.slice(0, 4)) expect(c).toContain(phrase);
    // …the rest are folded into one honest closing phrase, not dropped silently.
    for (const phrase of uniquePhrases.slice(4)) expect(c).not.toContain(phrase);
    expect(c).toContain("additional support for other identified contributors");
    // Every approved kit still renders in the care-plan band.
    expect(view.treatmentPlan).toHaveLength(7);
    // And the summary stays inside the validation band.
    expect(c.trim().split(/\s+/).length).toBeLessThanOrEqual(100);
  });
});
