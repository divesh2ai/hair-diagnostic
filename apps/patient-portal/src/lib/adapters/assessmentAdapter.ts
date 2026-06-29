import { z } from "zod";
import type {
  AssessmentArtifact,
  AssessmentNarratives,
  AssessmentReportPayload,
  AssessmentStatusResponse,
} from "@shared/types/assessment";
import { artifactMapByType, normalizeArtifacts, safeArray, safeObject } from "@/lib/safeData";
import { normalizeArtifactsResponse, verifyArtifactShape } from "@/lib/artifacts/normalizeResponse";
import { liftNarratives } from "@/lib/narratives/liftNarratives";

const statusValues = [
  "PENDING",
  "QUEUED",
  "NORMALIZING",
  "RUNNING_CLINICAL_ENGINE",
  "GENERATING_RECOMMENDATIONS",
  "GENERATING_REPORT",
  "COMPLETED",
  "FAILED",
  "PARTIAL_FAILURE",
] as const;

const artifactSchema = z.object({
  id: z.string().catch("unknown-artifact"),
  type: z.string().catch("UNKNOWN"),
  content: z.unknown().optional().default({}),
  createdAt: z.string().catch(new Date(0).toISOString()),
  generationMs: z.number().nullable().optional().default(null),
  schemaVersion: z.string().nullable().optional(),
  engineVersion: z.string().nullable().optional(),
});

const eventSchema = z.object({
  id: z.string().catch("unknown-event"),
  type: z.string().catch("UNKNOWN"),
  stage: z.string().nullable().optional().default(null),
  message: z.string().nullable().optional().default(null),
  durationMs: z.number().nullable().optional().default(null),
  createdAt: z.string().catch(new Date(0).toISOString()),
});

const logSchema = z.object({
  id: z.string().catch("unknown-log"),
  stage: z.string().catch("unknown"),
  status: z.string().catch("UNKNOWN"),
  durationMs: z.number().nullable().optional().default(null),
  error: z.string().nullable().optional().default(null),
  createdAt: z.string().catch(new Date(0).toISOString()),
});

const statusResponseSchema = z
  .object({
    success: z.boolean().catch(false),
    assessmentId: z.string().optional(),
    status: z.enum(statusValues).or(z.string()).optional().default("PENDING"),
    progressPercent: z.number().optional().default(0),
    isStuck: z.boolean().optional().default(false),
    startedAt: z.string().nullable().optional().default(null),
    updatedAt: z.string().nullable().optional().default(null),
    completedAt: z.string().nullable().optional().default(null),
    artifacts: z.unknown().optional(),
    artifactPresence: z.record(z.string(), z.boolean()).optional().default({}),
    errors: z.array(z.string()).optional().default([]),
    events: z.array(eventSchema).optional().default([]),
    orchestration: z
      .object({
        stage: z.string().nullable().optional().default(null),
        executionId: z.string().nullable().optional().default(null),
        retryCount: z.number().optional().default(0),
        lastCompletedStage: z.string().nullable().optional().default(null),
        logs: z.array(logSchema).optional().default([]),
      })
      .optional()
      .default({
        stage: null,
        executionId: null,
        retryCount: 0,
        lastCompletedStage: null,
        logs: [],
      }),
  })
  .passthrough();

export function parseAssessmentStatusResponse(raw: unknown): AssessmentStatusResponse {
  const parsed = statusResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[assessmentAdapter] Invalid status response", parsed.error.flatten());
    return { success: false, status: "PENDING", artifacts: [], errors: ["Malformed status response"] };
  }
  return parsed.data as AssessmentStatusResponse;
}

export function normalizeAssessmentReportPayload(raw: unknown): AssessmentReportPayload {
  const response = parseAssessmentStatusResponse(raw);

  // ── GATE #3: Runtime Hydration Shape Verification ────────────────────────
  // Ensures artifacts normalize correctly to array format
  try {
    verifyArtifactShape(response.artifacts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[assessmentAdapter] Hydration shape verification failed", message);
    // Continue with normalization — it has defensive fallbacks
  }

  const parsedArtifacts = normalizeArtifacts(response.artifacts as Record<string, AssessmentArtifact> | AssessmentArtifact[]);
  const artifacts = parsedArtifacts
    .map((artifact) => artifactSchema.safeParse(artifact))
    .filter((result) => {
      if (!result.success) console.error("[assessmentAdapter] Invalid artifact payload", result.error.flatten());
      return result.success;
    })
    .map((result) => result.data as AssessmentArtifact);

  const artifactByType = artifactMapByType(artifacts);
  const rawPresence = safeObject<Record<string, unknown>>(response.artifactPresence);
  const artifactPresence = {
    ...Object.fromEntries(Object.keys(artifactByType).map((type) => [type, true])),
    ...Object.fromEntries(Object.entries(rawPresence).map(([key, value]) => [key, value === true])),
  };
  const orchestration = response.orchestration ?? {
    stage: null,
    executionId: null,
    retryCount: 0,
    lastCompletedStage: null,
    logs: [],
  };

  const rawNarratives = safeObject(raw).narratives as AssessmentNarratives | null | undefined;
  const narratives: AssessmentNarratives | null =
    rawNarratives ?? liftNarratives(artifactByType.NARRATIVES?.content) ?? null;

  const rawVideo = safeObject(raw).video as Record<string, unknown> | undefined;
  const videoState = (rawVideo?.state as string | undefined) ?? "PENDING";
  const video: AssessmentReportPayload["video"] = {
    state: (videoState === "READY" || videoState === "RENDERING" || videoState === "UNAVAILABLE"
      ? videoState
      : "PENDING") as AssessmentReportPayload["video"]["state"],
    url: (rawVideo?.url as string | null | undefined) ?? null,
    thumbnailUrl: (rawVideo?.thumbnailUrl as string | null | undefined) ?? null,
    durationSec: (rawVideo?.durationSec as number | null | undefined) ?? null,
  };

  return {
    assessmentId: response.assessmentId ?? "",
    status: response.status ?? "PENDING",
    progressPercent: response.progressPercent ?? 0,
    isStuck: response.isStuck ?? false,
    startedAt: response.startedAt ?? null,
    completedAt: response.completedAt ?? null,
    updatedAt: response.updatedAt ?? null,
    patient: safeObject(raw).patient as AssessmentReportPayload["patient"],
    clinic: safeObject(raw).clinic as AssessmentReportPayload["clinic"],
    artifacts,
    artifactByType,
    artifactPresence,
    narratives,
    video,
    processing: {
      status: (response.status ?? "PENDING") as AssessmentReportPayload["processing"]["status"],
      progressPercent: response.progressPercent ?? 0,
      isStuck: response.isStuck ?? false,
      stage: orchestration.stage ?? null,
      executionId: orchestration.executionId ?? null,
      retryCount: orchestration.retryCount ?? 0,
      lastCompletedStage: orchestration.lastCompletedStage ?? null,
      lastError: safeArray<string>(response.errors)[0] ?? null,
      errors: safeArray<string>(response.errors),
    },
    events: safeArray(response.events),
    orchestrationLogs: safeArray(orchestration.logs),
  };
}

export function mergeStatusIntoReport(
  previous: AssessmentReportPayload,
  raw: unknown
): AssessmentReportPayload {
  const next = normalizeAssessmentReportPayload(raw);
  const artifacts = next.artifacts.length > 0 ? next.artifacts : previous.artifacts;
  const artifactByType = artifactMapByType(artifacts);

  return {
    ...previous,
    ...next,
    assessmentId: next.assessmentId || previous.assessmentId,
    artifacts,
    artifactByType,
    artifactPresence: { ...previous.artifactPresence, ...next.artifactPresence },
    narratives: next.narratives ?? previous.narratives,
    patient: next.patient ?? previous.patient,
    clinic: next.clinic ?? previous.clinic,
    events: next.events.length > 0 ? next.events : previous.events,
    orchestrationLogs: next.orchestrationLogs.length > 0 ? next.orchestrationLogs : previous.orchestrationLogs,
  };
}
