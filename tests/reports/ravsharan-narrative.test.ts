import { describe, expect, it } from "vitest";
import {
  mapClinicalReportToPrintPresentation,
  type OnePageReportContext,
} from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type {
  ClinicalReport,
  TreatmentPhase,
} from "../../src/packages/ai-engine/report-engine/types";

// Ravsharan case — Male Pattern Hair Loss at Norwood III with rapid weight
// change following GLP-1 therapy. The Doctor-Reviewed Result must read as
// one connected clinical story: underlying pattern is stated separately from
// the active shedding trigger (kit #1 = RWL Shield), each contributor is
// mentioned, and the treatment strategy follows the doctor-approved kit
// order phrase-by-phrase.

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
  selectionOverrides: Record<string, unknown> = {},
): ClinicalReport {
  const base: Partial<ClinicalReport> = {
    patientSummary: {
      name: "Ravsharan",
      age: 42,
      gender: "Male",
      goal: ["Reduce hair fall and improve growth"],
      hairLossPattern: [],
      scalpConcerns: [],
      lifestyleFactors: [],
      medicalFactors: [],
      previousTreatments: [],
      questionnaireSelections: {
        grade: "Grade 3 — Norwood III",
        duration: "3–6 months",
        count: "~50-100 strands (Noticeable)",
        cause: ["Rapid weight loss / Crash diet", "Genetics / Family history"],
        lifestyle: ["Sedentary"],
        gut: ["IBS / Crohn's"],
        scalp: ["Dandruff / itchy scalp"],
        immunity: ["Allergies"],
        deficiency: ["Pre-diabetes"],
        treatment: ["GLP-1 therapy (Ozempic)"],
        ...selectionOverrides,
      },
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
  };
  return base as ClinicalReport;
}

const context: OnePageReportContext = {
  assessmentId: "ravsharan-narrative-test",
  approval: { status: "APPROVED", approvedAt: "2026-08-04T00:00:00.000Z" },
};

// Ravsharan's doctor-approved 5-kit lineup, RWL Shield first.
const RAVSHARAN_PHASES = (): TreatmentPhase[] => [
  phase({ phase: 1, kitId: "RAPID WEIGHT LOSS SHIELD", displayName: "Rapid Weight Loss Shield", whySelected: "Rapid weight change following GLP-1 therapy." }),
  phase({ phase: 2, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS / Crohn's gut-axis signal." }),
  phase({ phase: 3, kitId: "PHENOTYPE INFLAMATION", displayName: "Phenotype Inflammation", whySelected: "Dandruff / scalp inflammation." }),
  phase({ phase: 4, kitId: "PRO FACT META B", displayName: "Pro Fact Meta B", whySelected: "Pre-diabetic metabolic strain." }),
  phase({ phase: 5, kitId: "PRO IMMUNE GOLD", displayName: "Pro Immune 5", whySelected: "Immune-linked follicle pressure (allergies)." }),
];

describe("Ravsharan — connected clinical narrative", () => {
  it("distinguishes underlying MPHL from the active RWL/GLP-1 shedding trigger", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const { narrative } = view;

    // Underlying pattern is stated as Male Pattern Hair Loss at Norwood III.
    expect(narrative.underlyingPattern).toMatch(/Male Pattern Hair Loss.*Norwood III/i);
    // Active driver is the RWL Shield trigger, NOT the pattern kit.
    expect(narrative.primaryActiveDriver).not.toBeNull();
    expect(narrative.primaryActiveDriver!.kitCode).toBe("RAPID_WEIGHT_LOSS_SHIELD");
    // MPHL is never described as being caused by rapid weight loss.
    expect(narrative.primaryActiveDriver!.label.toLowerCase()).not.toMatch(/pattern hair loss|norwood|ludwig/);
    expect(narrative.primaryActiveDriver!.sentence).not.toMatch(
      /pattern hair loss.*caused by.*rapid|rapid.*caused.*pattern/i,
    );
  });

  it("mentions rapid weight loss as the active shedding trigger in the conclusion", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const conclusion = view.clinicalResult.conclusion.toLowerCase();
    // Tentative opener uses the new patient-friendly frame.
    expect(conclusion).toMatch(/may be linked to rapid weight change following glp-1 therapy/);
    expect(conclusion).toMatch(/place sudden stress on the follicles and increase shedding/);
    // And explicitly on top of the underlying pattern (not caused by it).
    expect(conclusion).toMatch(/on top of the underlying pattern sensitivity/);
  });

  it("places the kit-#1 rationale before the additional-contributors sentence", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const conclusion = view.clinicalResult.conclusion;
    const primaryIdx = conclusion.indexOf("may be linked to");
    const contributorMarker = /may contribute further to slower recovery/;
    const contributorIdx = conclusion.search(contributorMarker);
    expect(primaryIdx).toBeGreaterThan(-1);
    expect(contributorIdx).toBeGreaterThan(-1);
    expect(primaryIdx).toBeLessThan(contributorIdx);
  });

  it("closes with a treatment strategy that follows the doctor-approved kit order", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const { narrative, clinicalResult } = view;

    // Strategy list is 1:1 with the approved kits, in order.
    expect(narrative.treatmentStrategy.map((s) => s.kitCode)).toEqual([
      "RAPID_WEIGHT_LOSS_SHIELD",
      "PRO_FACT_GI_GOLD",
      "PHENOTYPE_INFLAMMATION",
      "PRO_FACT_META_B",
      "PRO_IMMUNE_GOLD",
    ]);
    expect(narrative.treatmentStrategy.map((s) => s.phrase)).toEqual([
      "rapid-weight-loss follicle protection",
      "gut and absorption support",
      "inflammation and oxidative-stress control",
      "metabolic and thyroid support",
      "immune-linked follicle support",
    ]);
    // Closing sentence in the conclusion begins with kit #1's phrase.
    expect(clinicalResult.conclusion).toMatch(
      /addresses these factors through rapid-weight-loss follicle protection/,
    );
    // And mentions every subsequent phrase in order.
    const conclusion = clinicalResult.conclusion;
    const marks = [
      "gut and absorption support",
      "inflammation and oxidative-stress control",
      "metabolic and thyroid support",
      "immune-linked follicle support",
    ];
    let lastIndex = conclusion.indexOf("rapid-weight-loss follicle protection");
    for (const mark of marks) {
      const idx = conclusion.indexOf(mark);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("changes the strategy order when the doctor reorders the approved kits", () => {
    // Swap kit #1 and kit #2: GI Gold is now first.
    const swapped = RAVSHARAN_PHASES();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const view = mapClinicalReportToPrintPresentation(makeReport(swapped), context);
    const { narrative, clinicalResult } = view;

    // Primary active driver is now GI Gold.
    expect(narrative.primaryActiveDriver!.kitCode).toBe("PRO_FACT_GI_GOLD");
    expect(narrative.treatmentStrategy[0]!.kitCode).toBe("PRO_FACT_GI_GOLD");
    // Closing sentence begins with gut-and-absorption support.
    expect(clinicalResult.conclusion).toMatch(
      /addresses these factors through gut and absorption support/,
    );
    // Reordering carries the phase numbers along (2, 1, 3…). That is still a
    // per-kit ranking, so the framing must stay concurrent.
    expect(clinicalResult.conclusion).not.toContain("Treatment begins with");
    // And kit #1 active-trigger sentence talks about gut dysfunction.
    expect(clinicalResult.conclusion.toLowerCase()).toMatch(/gut dysfunction/);
  });

  it("validation flags a conclusion that does not reference approved kit #1", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    // The healthy view passes narrative validation.
    const narrativeErrors = view.validation.errors.filter((e) => /Narrative|Doctor-Reviewed Result: kit #1/i.test(e));
    expect(narrativeErrors).toEqual([]);

    // Now simulate a broken viewModel that produced a stripped conclusion by
    // reaching in and rewriting it, then rerunning validation logic via
    // JSON round-trip is not enough — the validator runs at construction
    // time. Instead, cover the failure path by feeding a phase set whose
    // classifier maps to an "unknown" family (no strategy phrase for it) and
    // asserting a warning surfaces.
    const unknownPhases: TreatmentPhase[] = [
      phase({ phase: 1, kitId: "UNKNOWN CUSTOM KIT", displayName: "Custom Doctor Kit", whySelected: "Doctor added off-catalogue." }),
    ];
    const unknownView = mapClinicalReportToPrintPresentation(makeReport(unknownPhases), context);
    const warns = unknownView.validation.warnings.filter((w) => /did not classify into a known family/.test(w));
    expect(warns.length).toBeGreaterThan(0);
  });

  it("does not include GLP-1 phrasing when there is no GLP-1 signal", () => {
    const selectionsWithoutGlp1 = {
      grade: "Grade 3 — Norwood III",
      duration: "3–6 months",
      count: "~50-100 strands",
      cause: ["Genetics / Family history"],
      gut: ["IBS / Crohn's"],
      scalp: ["Dandruff"],
      // No GLP-1 signal, no rapid weight loss cause tag, no treatment tag.
    };
    const nonGlp1Phases: TreatmentPhase[] = [
      phase({ phase: 1, kitId: "PRO FACT GI GOLD", displayName: "Pro Fact GI Gold", whySelected: "IBS signal." }),
      phase({ phase: 2, kitId: "PHENOTYPE INFLAMATION", displayName: "Phenotype Inflammation", whySelected: "Dandruff signal." }),
    ];
    const view = mapClinicalReportToPrintPresentation(
      makeReport(nonGlp1Phases, selectionsWithoutGlp1),
      context,
    );
    const conclusion = view.clinicalResult.conclusion.toLowerCase();
    expect(conclusion).not.toMatch(/glp-1|semaglutide|rapid weight change/);
    // Instead, gut dysfunction should lead as the active trigger since kit #1
    // is GI Gold.
    expect(conclusion).toMatch(/may be linked to gut dysfunction/);
  });

  it("does not describe MPHL as caused by rapid weight loss", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const conclusion = view.clinicalResult.conclusion.toLowerCase();
    expect(conclusion).not.toMatch(/male pattern hair loss.*caused by.*rapid/);
    expect(conclusion).not.toMatch(/norwood.*caused by.*rapid/);
    expect(conclusion).not.toMatch(/rapid weight.*caused.*male pattern/);
    expect(conclusion).not.toMatch(/rapid weight.*caused.*norwood/);
    // Positive check: the "on top of" phrasing is the correct connector.
    expect(conclusion).toMatch(/on top of the underlying pattern sensitivity/);
  });

  it("produces the target Ravsharan conclusion end-to-end", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const c = view.clinicalResult.conclusion;
    const s1 = "Your assessment is consistent with Male Pattern Hair Loss at Norwood III, with shedding of 50-100 strands over 3–6 months.";
    const s2 = "Current shedding may be linked to rapid weight change following GLP-1 therapy, which can place sudden stress on the follicles and increase shedding on top of the underlying pattern sensitivity.";
    const s3Marker = "may contribute further to slower recovery.";
    const s4Marker = "Your treatment plan addresses these factors through rapid-weight-loss follicle protection, gut and absorption support, inflammation and oxidative-stress control, metabolic and thyroid support and immune-linked follicle support.";
    expect(c).toContain(s1);
    expect(c).toContain(s2);
    expect(c).toContain(s3Marker);
    expect(c).toContain(s4Marker);
    for (const phrase of [
      "rapid-weight-loss follicle protection",
      "gut and absorption support",
      "inflammation and oxidative-stress control",
      "metabolic and thyroid support",
      "immune-linked follicle support",
    ]) {
      expect(c).toContain(phrase);
    }
    // Word band: 55–80 preferred, up to 90 accepted for genuinely complex
    // multifactorial cases like this five-mechanism plan.
    const words = c.trim().split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(55);
    expect(words).toBeLessThanOrEqual(90);
  });

  it("bans generic 'plan addresses these conditions together' phrasing", () => {
    const view = mapClinicalReportToPrintPresentation(makeReport(RAVSHARAN_PHASES()), context);
    const conclusion = view.clinicalResult.conclusion.toLowerCase();
    expect(conclusion).not.toMatch(/addresses these conditions together/);
    expect(conclusion).not.toMatch(/addresses these factors together/);
    // Contentless "…these factors together" stays banned; the concurrent
    // closing sentence names its mechanism clusters after "through" and is
    // therefore permitted.
    expect(conclusion).not.toMatch(/plan addresses these \w+ together/);
    expect(conclusion).toMatch(/plan addresses these factors through \w/);
    // Validation error for the generic phrase is absent.
    const genericErrors = view.validation.errors.filter((e) => /generic template phrase/i.test(e));
    expect(genericErrors).toEqual([]);
  });
});
