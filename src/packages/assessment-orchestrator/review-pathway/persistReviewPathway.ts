import type { PrismaClient } from "@prisma/client";
import type {
  ReviewPathwayDecision,
  ReviewPathway,
} from "../../../../packages/shared/review-pathway";
import type { ReviewPathwaySourceRecord } from "./computeReviewPathwaySource";

export interface PersistReviewPathwayInput {
  readonly assessmentId: string;
  readonly decision: ReviewPathwayDecision;
  readonly source: ReviewPathwaySourceRecord;
  readonly evaluatedAt?: Date;
}

export async function persistReviewPathway(
  prisma: PrismaClient,
  input: PersistReviewPathwayInput,
): Promise<void> {
  await prisma.assessment.update({
    where: { id: input.assessmentId },
    data: {
      reviewPathway: input.decision.pathway as ReviewPathway,
      reviewPathwayReasons: Array.from(new Set(input.decision.reasonCodes)),
      reviewPathwayVersion: input.decision.classifierVersion,
      reviewPathwayEvaluatedAt: input.evaluatedAt ?? new Date(),
      reviewPathwaySource: input.source,
    } as any,
  });
}