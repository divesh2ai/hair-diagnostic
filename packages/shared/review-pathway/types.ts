export const REVIEW_PATHWAY_CLASSIFIER_VERSION = "1.0.0" as const;

export const REVIEW_PATHWAYS = Object.freeze({
  ROUTINE_REVIEW: "ROUTINE_REVIEW",
  FOCUSED_REVIEW: "FOCUSED_REVIEW",
  EXAMINATION_REQUIRED: "EXAMINATION_REQUIRED",
  RESOLUTION_REQUIRED: "RESOLUTION_REQUIRED",
} as const);

export type ReviewPathway =
  (typeof REVIEW_PATHWAYS)[keyof typeof REVIEW_PATHWAYS];

export const REVIEW_PATHWAY_REASON_CODES = Object.freeze({
  RESOLUTION_ASSESSMENT_FAILED: "RESOLUTION_ASSESSMENT_FAILED",
  RESOLUTION_PARTIAL_FAILURE: "RESOLUTION_PARTIAL_FAILURE",
  RESOLUTION_GROUNDING_VIOLATION: "RESOLUTION_GROUNDING_VIOLATION",
  RESOLUTION_REASONING_GAP: "RESOLUTION_REASONING_GAP",
  RESOLUTION_READINESS_SNAPSHOT_MALFORMED: "RESOLUTION_READINESS_SNAPSHOT_MALFORMED",
  RESOLUTION_APPROVAL_BLOCKED: "RESOLUTION_APPROVAL_BLOCKED",
  EXAM_PATCHY_HAIR_LOSS: "EXAM_PATCHY_HAIR_LOSS",
  EXAM_ALOPECIA_AREATA_REPORTED: "EXAM_ALOPECIA_AREATA_REPORTED",
  EXAM_SCALP_BOILS_OR_PUSTULES: "EXAM_SCALP_BOILS_OR_PUSTULES",
  FOCUSED_PREGNANCY: "FOCUSED_PREGNANCY",
  FOCUSED_POSTPARTUM_OR_BREASTFEEDING: "FOCUSED_POSTPARTUM_OR_BREASTFEEDING",
  FOCUSED_HEAVY_BLEEDING_WITH_IRON_INDICATORS: "FOCUSED_HEAVY_BLEEDING_WITH_IRON_INDICATORS",
  FOCUSED_RAPID_WEIGHT_LOSS_TREATMENT_IMPACT: "FOCUSED_RAPID_WEIGHT_LOSS_TREATMENT_IMPACT",
  FOCUSED_GLP1_TREATMENT_IMPACT: "FOCUSED_GLP1_TREATMENT_IMPACT",
} as const);

export type ReviewPathwayReasonCode =
  (typeof REVIEW_PATHWAY_REASON_CODES)[keyof typeof REVIEW_PATHWAY_REASON_CODES];

export interface ReviewReadinessSnapshot {
  readonly schemaVersion: 1;
  readonly isReadyForApproval: boolean;
  readonly groundingViolations: readonly unknown[];
  readonly reasoningGaps: readonly unknown[];
  readonly approvalBlocked?: boolean;
}

export interface ReviewPathwayClassifierInput {
  readonly consultationExists?: boolean;
  readonly assessmentStatus?: "FAILED" | "PARTIAL_FAILURE" | string | null;
  readonly readinessSnapshot?: ReviewReadinessSnapshot | null;

  // Clinical factors that must remain pathway-neutral unless they create a
  // distinct treatment-suitability or integrity issue.
  readonly menopause?: boolean;
  readonly perimenopause?: boolean;
  readonly postMenopause?: boolean;
  readonly pcos?: boolean;
  readonly thyroid?: boolean;
  readonly diabetes?: boolean;
  readonly preDiabetes?: boolean;
  readonly endometriosis?: boolean;
  readonly majorGiCondition?: boolean;
  readonly medicationHistory?: boolean;
  readonly scalpBurning?: boolean;
  readonly scalpPsoriasisOrInflammation?: boolean;
  readonly scalpRednessOrIrritation?: boolean;

  // Focused review triggers.
  readonly pregnancy?: boolean;
  readonly postpartumOrBreastfeeding?: boolean;
  readonly heavyBleeding?: boolean;
  readonly structuredIronOrNutritionalIndicators?: boolean;
  readonly significantSheddingIndicators?: boolean;
  readonly rapidWeightLoss?: boolean;
  readonly rapidWeightLossTreatmentImpact?: boolean;
  readonly glp1Use?: boolean;
  readonly glp1TreatmentImpact?: boolean;

  // Examination required triggers.
  readonly circularOrCoinSizedBaldPatches?: boolean;
  readonly selfReportedAlopeciaAreata?: boolean;
  readonly scalpBoilsOrPustules?: boolean;

  // Explicitly ignored for pathway selection.
  readonly kitScore?: number;
  readonly kitPosition?: number;
}

export interface ReviewPathwayDecision {
  readonly classifierVersion: typeof REVIEW_PATHWAY_CLASSIFIER_VERSION;
  readonly pathway: ReviewPathway;
  readonly reasonCodes: readonly ReviewPathwayReasonCode[];
}
