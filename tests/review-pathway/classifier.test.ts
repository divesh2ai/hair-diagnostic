import {
  classifyReviewPathway,
  REVIEW_PATHWAY_CLASSIFIER_VERSION,
  REVIEW_PATHWAY_REASON_CODES,
  REVIEW_PATHWAYS,
  type ReviewPathwayClassifierInput,
} from "../../packages/shared/review-pathway";

function base(overrides: Partial<ReviewPathwayClassifierInput> = {}): ReviewPathwayClassifierInput {
  return {
    consultationExists: false,
    assessmentStatus: "COMPLETED",
    menopause: false,
    perimenopause: false,
    postMenopause: false,
    pcos: false,
    thyroid: false,
    diabetes: false,
    preDiabetes: false,
    endometriosis: false,
    majorGiCondition: false,
    medicationHistory: false,
    scalpBurning: false,
    scalpPsoriasisOrInflammation: false,
    scalpRednessOrIrritation: false,
    pregnancy: false,
    postpartumOrBreastfeeding: false,
    heavyBleeding: false,
    structuredIronOrNutritionalIndicators: false,
    significantSheddingIndicators: false,
    rapidWeightLoss: false,
    rapidWeightLossTreatmentImpact: false,
    glp1Use: false,
    glp1TreatmentImpact: false,
    circularOrCoinSizedBaldPatches: false,
    selfReportedAlopeciaAreata: false,
    scalpBoilsOrPustules: false,
    kitScore: 0,
    kitPosition: 0,
    ...overrides,
  };
}

describe("review pathway classifier", () => {
  it("defaults to Routine Review when only non-trigger clinical factors are present", () => {
    const cases: Array<[string, Partial<ReviewPathwayClassifierInput>]> = [
      ["menopause", { menopause: true }],
      ["pcos", { pcos: true }],
      ["thyroid", { thyroid: true }],
      ["gi condition", { majorGiCondition: true }],
      ["medication history", { medicationHistory: true }],
      ["burning alone", { scalpBurning: true }],
    ];

    for (const [name, overrides] of cases) {
      const decision = classifyReviewPathway(base(overrides));
      expect(decision.classifierVersion).toBe(REVIEW_PATHWAY_CLASSIFIER_VERSION);
      expect(decision.pathway, name).toBe(REVIEW_PATHWAYS.ROUTINE_REVIEW);
      expect(decision.reasonCodes).toEqual([]);
    }
  });

  it("routes pregnancy, postpartum, heavy bleeding, rapid weight loss, and GLP-1 to Focused Review only when eligible", () => {
    expect(classifyReviewPathway(base({ pregnancy: true })).pathway).toBe(
      REVIEW_PATHWAYS.FOCUSED_REVIEW,
    );

    expect(
      classifyReviewPathway(
        base({ postpartumOrBreastfeeding: true, pregnancy: false }),
      ).pathway,
    ).toBe(REVIEW_PATHWAYS.FOCUSED_REVIEW);

    expect(
      classifyReviewPathway(
        base({
          heavyBleeding: true,
          structuredIronOrNutritionalIndicators: true,
        }),
      ).pathway,
    ).toBe(REVIEW_PATHWAYS.FOCUSED_REVIEW);

    expect(
      classifyReviewPathway(
        base({
          heavyBleeding: true,
          significantSheddingIndicators: true,
        }),
      ).pathway,
    ).toBe(REVIEW_PATHWAYS.FOCUSED_REVIEW);

    expect(
      classifyReviewPathway(
        base({
          rapidWeightLoss: true,
          rapidWeightLossTreatmentImpact: true,
        }),
      ).pathway,
    ).toBe(REVIEW_PATHWAYS.FOCUSED_REVIEW);

    expect(
      classifyReviewPathway(
        base({
          glp1Use: true,
          glp1TreatmentImpact: true,
        }),
      ).pathway,
    ).toBe(REVIEW_PATHWAYS.FOCUSED_REVIEW);
  });

  it("keeps heavy bleeding, rapid weight loss, and GLP-1 routine when the treatment-selection condition is absent", () => {
    expect(classifyReviewPathway(base({ heavyBleeding: true })).pathway).toBe(
      REVIEW_PATHWAYS.ROUTINE_REVIEW,
    );

    expect(classifyReviewPathway(base({ rapidWeightLoss: true })).pathway).toBe(
      REVIEW_PATHWAYS.ROUTINE_REVIEW,
    );

    expect(classifyReviewPathway(base({ glp1Use: true })).pathway).toBe(
      REVIEW_PATHWAYS.ROUTINE_REVIEW,
    );
  });

  it("routes patchy loss, alopecia areata, and scalp boils/pustules to Examination Required", () => {
    expect(
      classifyReviewPathway(base({ circularOrCoinSizedBaldPatches: true })).pathway,
    ).toBe(REVIEW_PATHWAYS.EXAMINATION_REQUIRED);

    expect(
      classifyReviewPathway(base({ selfReportedAlopeciaAreata: true })).pathway,
    ).toBe(REVIEW_PATHWAYS.EXAMINATION_REQUIRED);

    expect(classifyReviewPathway(base({ scalpBoilsOrPustules: true })).pathway).toBe(
      REVIEW_PATHWAYS.EXAMINATION_REQUIRED,
    );
  });

  it("keeps burning, redness, and psoriasis as clinical flags only", () => {
    const decision = classifyReviewPathway(
      base({
        scalpBurning: true,
        scalpRednessOrIrritation: true,
        scalpPsoriasisOrInflammation: true,
      }),
    );

    expect(decision.pathway).toBe(REVIEW_PATHWAYS.ROUTINE_REVIEW);
    expect(decision.reasonCodes).toEqual([]);
  });

  it("classifies failed, partial-failure, malformed, grounding, and reasoning resolution cases", () => {
    expect(
      classifyReviewPathway(base({ assessmentStatus: "FAILED" })).reasonCodes,
    ).toContain(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_ASSESSMENT_FAILED);

    expect(
      classifyReviewPathway(base({ assessmentStatus: "PARTIAL_FAILURE" })).reasonCodes,
    ).toContain(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_PARTIAL_FAILURE);

    expect(
      classifyReviewPathway(
        base({
          consultationExists: true,
          readinessSnapshot: undefined,
        }),
      ).reasonCodes,
    ).toContain(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_READINESS_SNAPSHOT_MALFORMED);

    const grounded = classifyReviewPathway(
      base({
        consultationExists: true,
        readinessSnapshot: {
          schemaVersion: 1,
          isReadyForApproval: false,
          groundingViolations: [{ ruleId: "x" }],
          reasoningGaps: [],
        },
      }),
    );
    expect(grounded.reasonCodes).toContain(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_GROUNDING_VIOLATION);

    const reasoning = classifyReviewPathway(
      base({
        consultationExists: true,
        readinessSnapshot: {
          schemaVersion: 1,
          isReadyForApproval: false,
          groundingViolations: [],
          reasoningGaps: [{ kind: "gap" }],
        },
      }),
    );
    expect(reasoning.reasonCodes).toContain(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_REASONING_GAP);
  });

  it("lets Resolution Required override Examination and Focused", () => {
    const decision = classifyReviewPathway(
      base({
        consultationExists: true,
        readinessSnapshot: {
          schemaVersion: 1,
          isReadyForApproval: false,
          groundingViolations: [],
          reasoningGaps: [],
        },
        pregnancy: true,
        circularOrCoinSizedBaldPatches: true,
      }),
    );

    expect(decision.pathway).toBe(REVIEW_PATHWAYS.RESOLUTION_REQUIRED);
    expect(decision.reasonCodes).toContain(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_APPROVAL_BLOCKED);
    expect(decision.reasonCodes).not.toContain(REVIEW_PATHWAY_REASON_CODES.FOCUSED_PREGNANCY);
    expect(decision.reasonCodes).not.toContain(REVIEW_PATHWAY_REASON_CODES.EXAM_PATCHY_HAIR_LOSS);
  });

  it("lets Examination Required override Focused", () => {
    const decision = classifyReviewPathway(
      base({
        pregnancy: true,
        circularOrCoinSizedBaldPatches: true,
      }),
    );

    expect(decision.pathway).toBe(REVIEW_PATHWAYS.EXAMINATION_REQUIRED);
    expect(decision.reasonCodes).toContain(REVIEW_PATHWAY_REASON_CODES.EXAM_PATCHY_HAIR_LOSS);
    expect(decision.reasonCodes).not.toContain(REVIEW_PATHWAY_REASON_CODES.FOCUSED_PREGNANCY);
  });

  it("does not emit a non-routine pathway without a reason", () => {
    const decision = classifyReviewPathway(base());
    expect(decision.pathway).toBe(REVIEW_PATHWAYS.ROUTINE_REVIEW);
    expect(decision.reasonCodes).toHaveLength(0);
  });

  it("ignores kit score and kit position", () => {
    const decision = classifyReviewPathway(
      base({
        kitScore: 999,
        kitPosition: 0,
        menopause: true,
      }),
    );

    expect(decision.pathway).toBe(REVIEW_PATHWAYS.ROUTINE_REVIEW);
    expect(decision.reasonCodes).toEqual([]);
  });
});
