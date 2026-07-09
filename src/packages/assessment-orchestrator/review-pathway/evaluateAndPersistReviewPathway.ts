import type { PrismaClient } from "@prisma/client";
import { classifyReviewPathway, REVIEW_PATHWAY_CLASSIFIER_VERSION } from "../../../../packages/shared/review-pathway";
import type { AssessmentEventType } from "../events";
import { logAssessmentEvent } from "../events";
import {
  buildReviewPathwayInput,
  type ReviewPathwayBuildArgs,
  type ReviewPathwayEvaluationFrom,
  type ReviewPathwaySnapshotState,
} from "./buildReviewPathwayInput";
import {
  computeReviewPathwaySource,
  type ReviewPathwaySourceRecord,
} from "./computeReviewPathwaySource";
import { persistReviewPathway } from "./persistReviewPathway";

export type ReviewPathwayAction = "WRITTEN" | "SKIPPED" | "FAILED" | "DISABLED";

export interface ReviewPathwayEvaluationResult {
  assessmentId: string;
  pathway: ReturnType<typeof classifyReviewPathway>["pathway"];
  reasonCodes: string[];
  classifierVersion: string;
  sourceSignature: string;
  action: ReviewPathwayAction;
  skipReason?: "UNCHANGED";
  errorCode?: string;
}

export interface EvaluateAndPersistReviewPathwayArgs extends ReviewPathwayBuildArgs {
  readonly prisma: PrismaClient;
  readonly assessmentId: string;
  readonly clinicId: string;
  readonly evaluatedFrom: ReviewPathwayEvaluationFrom;
}

export interface EvaluateAndPersistReviewPathwayDeps {
  readonly classifier?: typeof classifyReviewPathway;
  readonly persist?: typeof persistReviewPathway;
  readonly logEvent?: typeof logAssessmentEvent;
  readonly now?: () => Date;
}

function isShadowEnabled(): boolean {
  return process.env.FEATURE_REVIEW_PATHWAY_SHADOW === "true";
}

function extractSourceSignature(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.sourceSignature === "string" ? record.sourceSignature : null;
}

function normalizeErrorCode(err: unknown): string {
  if (err instanceof Error && err.name) return err.name;
  return "UnknownError";
}

async function emitEvent(
  logEvent: typeof logAssessmentEvent | undefined,
  prisma: PrismaClient,
  assessmentId: string,
  type: AssessmentEventType,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!logEvent) return;
  try {
    await logEvent(prisma, assessmentId, type, {
      stage: "review_pathway",
      metadata,
    });
  } catch {
    // Best-effort observability only.
  }
}

export async function evaluateAndPersistReviewPathway(
  args: EvaluateAndPersistReviewPathwayArgs,
  deps: EvaluateAndPersistReviewPathwayDeps = {},
): Promise<ReviewPathwayEvaluationResult> {
  const classifier = deps.classifier ?? classifyReviewPathway;
  const persist = deps.persist ?? persistReviewPathway;
  const now = deps.now ?? (() => new Date());

  try {
    const built = buildReviewPathwayInput(args);
    const source = computeReviewPathwaySource({
      ...built,
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      evaluatedFrom: args.evaluatedFrom,
    });
    const decision = classifier(built.classifierInput);

    if (!isShadowEnabled()) {
      return {
        assessmentId: args.assessmentId,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        action: "DISABLED",
      };
    }

    await emitEvent(deps.logEvent, args.prisma, args.assessmentId, "REVIEW_PATHWAY_EVALUATION_ATTEMPTED", {
      assessmentId: args.assessmentId,
      clinicId: args.clinicId,
      classifierVersion: source.classifierVersion,
      sourceSignature: source.sourceSignature,
      pathway: decision.pathway,
      reasonCodes: [...decision.reasonCodes],
      evaluatedFrom: args.evaluatedFrom,
      consultationExists: source.consultationExists,
      readinessSnapshotState: source.readinessSnapshotState,
    });

    const existing = (await (args.prisma.assessment.findUnique as any)({
      where: { id: args.assessmentId },
      select: {
        reviewPathwayVersion: true,
        reviewPathwaySource: true,
      },
    })) as { reviewPathwayVersion?: string | null; reviewPathwaySource?: unknown } | null;

    const existingSourceSignature = extractSourceSignature(existing?.reviewPathwaySource);
    if (
      existing?.reviewPathwayVersion === source.classifierVersion &&
      existingSourceSignature === source.sourceSignature
    ) {
      await emitEvent(deps.logEvent, args.prisma, args.assessmentId, "REVIEW_PATHWAY_SKIPPED", {
        assessmentId: args.assessmentId,
        clinicId: args.clinicId,
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        evaluatedFrom: args.evaluatedFrom,
        consultationExists: source.consultationExists,
        readinessSnapshotState: source.readinessSnapshotState,
        skipReason: "UNCHANGED",
      });
      return {
        assessmentId: args.assessmentId,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        action: "SKIPPED",
        skipReason: "UNCHANGED",
      };
    }

    try {
      await persist(args.prisma, {
        assessmentId: args.assessmentId,
        decision,
        source,
        evaluatedAt: now(),
      });

      await emitEvent(deps.logEvent, args.prisma, args.assessmentId, "REVIEW_PATHWAY_PERSISTED", {
        assessmentId: args.assessmentId,
        clinicId: args.clinicId,
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        evaluatedFrom: args.evaluatedFrom,
        consultationExists: source.consultationExists,
        readinessSnapshotState: source.readinessSnapshotState,
      });

      return {
        assessmentId: args.assessmentId,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        action: "WRITTEN",
      };
    } catch (err) {
      await emitEvent(deps.logEvent, args.prisma, args.assessmentId, "REVIEW_PATHWAY_PERSIST_FAILED", {
        assessmentId: args.assessmentId,
        clinicId: args.clinicId,
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        evaluatedFrom: args.evaluatedFrom,
        consultationExists: source.consultationExists,
        readinessSnapshotState: source.readinessSnapshotState,
        errorCode: normalizeErrorCode(err),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return {
        assessmentId: args.assessmentId,
        pathway: decision.pathway,
        reasonCodes: [...decision.reasonCodes],
        classifierVersion: source.classifierVersion,
        sourceSignature: source.sourceSignature,
        action: "FAILED",
        errorCode: normalizeErrorCode(err),
      };
    }
  } catch (err) {
    await emitEvent(deps.logEvent, args.prisma, args.assessmentId, "REVIEW_PATHWAY_INPUT_MALFORMED", {
      assessmentId: args.assessmentId,
      clinicId: args.clinicId,
      evaluatedFrom: args.evaluatedFrom,
      errorCode: normalizeErrorCode(err),
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return {
      assessmentId: args.assessmentId,
      pathway: "ROUTINE_REVIEW",
      reasonCodes: [],
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      sourceSignature: "",
      action: "FAILED",
      errorCode: normalizeErrorCode(err),
    };
  }
}
