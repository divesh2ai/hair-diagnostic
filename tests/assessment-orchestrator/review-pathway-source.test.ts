import { describe, expect, it } from "vitest";
import { REVIEW_PATHWAY_CLASSIFIER_VERSION } from "../../packages/shared/review-pathway";
import { computeReviewPathwaySource } from "../../src/packages/assessment-orchestrator/review-pathway/computeReviewPathwaySource";
import type { ReviewPathwayBuildResult } from "../../src/packages/assessment-orchestrator/review-pathway/buildReviewPathwayInput";

function buildSource(normalizedInput: Record<string, unknown>): ReviewPathwayBuildResult {
  return {
    classifierInput: {} as never,
    normalizedInput,
    consultationExists: false,
    readinessSnapshotState: "ABSENT",
  };
}

describe("review pathway source signature", () => {
  it("stays stable when object key order changes", () => {
    const left = computeReviewPathwaySource({
      ...buildSource({
        assessmentStatus: "CLINICAL_READY",
        consultationExists: false,
        readinessSnapshotState: "ABSENT",
        clinicalSignals: {
          primaryDiagnosis: "AGA_FEMALE_123",
          rootCauses: ["PCOS", "IRON_DEFICIENCY"],
          flags: {
            isPregnant: false,
            hasActiveShedding: false,
          },
        },
        pathwaySignals: {
          pregnancy: false,
          postpartumOrBreastfeeding: false,
        },
      }),
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      evaluatedFrom: "PHASE_A",
    });

    const right = computeReviewPathwaySource({
      ...buildSource({
        consultationExists: false,
        readinessSnapshotState: "ABSENT",
        assessmentStatus: "CLINICAL_READY",
        pathwaySignals: {
          postpartumOrBreastfeeding: false,
          pregnancy: false,
        },
        clinicalSignals: {
          flags: {
            hasActiveShedding: false,
            isPregnant: false,
          },
          rootCauses: ["IRON_DEFICIENCY", "PCOS"],
          primaryDiagnosis: "AGA_FEMALE_123",
        },
      }),
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      evaluatedFrom: "PHASE_A",
    });

    expect(left.sourceSignature).toBe(right.sourceSignature);
  });

  it("changes when the classifier version changes", () => {
    const base = {
      ...buildSource({
        assessmentStatus: "CLINICAL_READY",
        consultationExists: false,
        readinessSnapshotState: "ABSENT",
        pathwaySignals: { pregnancy: true },
      }),
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      evaluatedFrom: "PHASE_A" as const,
    };

    const left = computeReviewPathwaySource(base);
    const right = computeReviewPathwaySource({
      ...base,
      classifierVersion: `${REVIEW_PATHWAY_CLASSIFIER_VERSION}-next`,
    });

    expect(left.sourceSignature).not.toBe(right.sourceSignature);
  });
});
