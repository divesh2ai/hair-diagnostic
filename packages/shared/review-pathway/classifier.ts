import {
  REVIEW_PATHWAY_CLASSIFIER_VERSION,
  REVIEW_PATHWAY_REASON_CODES,
  REVIEW_PATHWAYS,
  type ReviewPathwayClassifierInput,
  type ReviewPathwayDecision,
  type ReviewPathwayReasonCode,
  type ReviewReadinessSnapshot,
} from "./types";

function unique(reasonCodes: ReviewPathwayReasonCode[]): readonly ReviewPathwayReasonCode[] {
  return Object.freeze(Array.from(new Set(reasonCodes)));
}

function isReadinessSnapshot(value: unknown): value is ReviewReadinessSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schemaVersion === 1 &&
    typeof snapshot.isReadyForApproval === "boolean" &&
    Array.isArray(snapshot.groundingViolations) &&
    Array.isArray(snapshot.reasoningGaps)
  );
}

function buildDecision(
  pathway: ReviewPathwayDecision["pathway"],
  reasonCodes: ReviewPathwayReasonCode[],
): ReviewPathwayDecision {
  return Object.freeze({
    classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
    pathway,
    reasonCodes: unique(reasonCodes),
  });
}

function classifyResolution(
  input: ReviewPathwayClassifierInput,
): ReviewPathwayReasonCode[] {
  const reasons: ReviewPathwayReasonCode[] = [];

  if (input.assessmentStatus === "FAILED") {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_ASSESSMENT_FAILED);
  }
  if (input.assessmentStatus === "PARTIAL_FAILURE") {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_PARTIAL_FAILURE);
  }

  if (input.consultationExists) {
    if (!isReadinessSnapshot(input.readinessSnapshot)) {
      reasons.push(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_READINESS_SNAPSHOT_MALFORMED);
      return reasons;
    }

    if (input.readinessSnapshot.groundingViolations.length > 0) {
      reasons.push(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_GROUNDING_VIOLATION);
    }
    if (input.readinessSnapshot.reasoningGaps.length > 0) {
      reasons.push(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_REASONING_GAP);
    }
    if (
      input.readinessSnapshot.approvalBlocked === true ||
      input.readinessSnapshot.isReadyForApproval === false
    ) {
      reasons.push(REVIEW_PATHWAY_REASON_CODES.RESOLUTION_APPROVAL_BLOCKED);
    }
  }

  return reasons;
}

function classifyExamination(input: ReviewPathwayClassifierInput): ReviewPathwayReasonCode[] {
  const reasons: ReviewPathwayReasonCode[] = [];

  if (input.circularOrCoinSizedBaldPatches) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.EXAM_PATCHY_HAIR_LOSS);
  }
  if (input.selfReportedAlopeciaAreata) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.EXAM_ALOPECIA_AREATA_REPORTED);
  }
  if (input.scalpBoilsOrPustules) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.EXAM_SCALP_BOILS_OR_PUSTULES);
  }

  return reasons;
}

function classifyFocused(input: ReviewPathwayClassifierInput): ReviewPathwayReasonCode[] {
  const reasons: ReviewPathwayReasonCode[] = [];

  if (input.pregnancy) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.FOCUSED_PREGNANCY);
  }
  if (input.postpartumOrBreastfeeding) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.FOCUSED_POSTPARTUM_OR_BREASTFEEDING);
  }
  if (
    input.heavyBleeding &&
    (input.structuredIronOrNutritionalIndicators || input.significantSheddingIndicators)
  ) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.FOCUSED_HEAVY_BLEEDING_WITH_IRON_INDICATORS);
  }
  if (input.rapidWeightLoss && input.rapidWeightLossTreatmentImpact) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.FOCUSED_RAPID_WEIGHT_LOSS_TREATMENT_IMPACT);
  }
  if (input.glp1Use && input.glp1TreatmentImpact) {
    reasons.push(REVIEW_PATHWAY_REASON_CODES.FOCUSED_GLP1_TREATMENT_IMPACT);
  }

  return reasons;
}

export function classifyReviewPathway(
  input: ReviewPathwayClassifierInput,
): ReviewPathwayDecision {
  const resolutionReasons = classifyResolution(input);
  if (resolutionReasons.length > 0) {
    return buildDecision(REVIEW_PATHWAYS.RESOLUTION_REQUIRED, resolutionReasons);
  }

  const examinationReasons = classifyExamination(input);
  if (examinationReasons.length > 0) {
    return buildDecision(REVIEW_PATHWAYS.EXAMINATION_REQUIRED, examinationReasons);
  }

  const focusedReasons = classifyFocused(input);
  if (focusedReasons.length > 0) {
    return buildDecision(REVIEW_PATHWAYS.FOCUSED_REVIEW, focusedReasons);
  }

  return buildDecision(REVIEW_PATHWAYS.ROUTINE_REVIEW, []);
}
