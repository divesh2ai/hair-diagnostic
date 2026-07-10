import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type AssessmentEventType =
  | "SUBMITTED"
  | "QUEUED"
  | "ORCHESTRATION_STARTED"
  | "NORMALIZATION_COMPLETE"
  | "CLINICAL_ENGINE_COMPLETE"
  | "RECOMMENDATIONS_COMPLETE"
  | "REPORT_GENERATED"
  | "ARTIFACT_CREATED"
  | "FAILED"
  | "RETRY_STARTED"
  | "RETRY_SUCCEEDED"
  | "RETRY_FAILED"
  | "PHASE_A_RECLAIMED"
  | "REVIEW_PATHWAY_EVALUATION_ATTEMPTED"
  | "REVIEW_PATHWAY_PERSISTED"
  | "REVIEW_PATHWAY_SKIPPED"
  | "REVIEW_PATHWAY_PERSIST_FAILED"
  | "REVIEW_PATHWAY_INPUT_MALFORMED";

export interface EventOptions {
  stage?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
}

export async function logAssessmentEvent(
  prisma: PrismaClient,
  assessmentId: string,
  type: AssessmentEventType,
  opts: EventOptions = {},
): Promise<void> {
  await prisma.assessmentEvent.create({
    data: {
      assessmentId,
      type,
      stage: opts.stage ?? null,
      message: opts.message ?? null,
      metadata: opts.metadata === null ? Prisma.JsonNull : (opts.metadata as Prisma.InputJsonValue | undefined),
      durationMs: opts.durationMs ?? null,
    },
  });
}