import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ArtifactType } from "@prisma/client";
import type {
  AssessmentArtifact,
  AssessmentStatusResponse,
  VideoExperienceBlock,
} from "@shared/types/assessment";
import { liftNarratives } from "@/lib/narratives/liftNarratives";

// ─── Constants ────────────────────────────────────────────────────────────────

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

const PROGRESS_BY_STATUS: Record<string, number> = {
  PENDING: 0,
  QUEUED: 5,
  NORMALIZING: 15,
  RUNNING_CLINICAL_ENGINE: 30,
  GENERATING_RECOMMENDATIONS: 45,
  GENERATING_NARRATIVE: 55,
  GENERATING_VIDEO_SCRIPT: 65,
  RENDERING_VIDEO: 80,
  GENERATING_REPORT: 90,
  COMPLETED: 100,
  PARTIAL_FAILURE: 90,
  FAILED: 0,
};

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "PARTIAL_FAILURE"]);
const CUID_PATTERN = /^c[a-z0-9]{20,30}$/;

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  console.log("[STATUS] POLL", { assessmentId: id });

  // ── Strict ID validation ───────────────────────────────────────────────────
  if (!id || typeof id !== "string" || !CUID_PATTERN.test(id.trim())) {
    return NextResponse.json(
      { success: false, error: "Invalid assessment id — must be a valid CUID" },
      { status: 400 }
    );
  }

  const assessmentId = id.trim();

  try {
    // ── Fetch sequentially, NOT in parallel ────────────────────────────────
    // The Vercel + Supabase + Prisma combo runs each serverless invocation
    // with connection_limit=1 on the transaction-pooler. Firing four
    // findMany() calls in parallel makes three of them wait for the pool
    // and then trip the 10s pool_timeout, returning 500 even though the
    // data is ready. Serialising costs ~3x latency on a cold call but
    // never times out. (See Vercel runtime logs around any /api/assessment/
    // status burst for the exact stack.) Pair this with a higher
    // connection_limit in DATABASE_URL when you're ready to revisit.
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        status: true,
        orchestrationStage: true,
        orchestrationMeta: true,
        executionId: true,
        retryCount: true,
        lastCompletedStage: true,
        lastError: true,
        submittedAt: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
        updatedAt: true,
        patient: { select: { name: true, age: true, gender: true } },
        clinic: { select: { name: true } },
      },
    });

    if (!assessment) {
      console.warn("[STATUS] NOT FOUND", { assessmentId });
      return NextResponse.json(
        { success: false, error: "Assessment not found" },
        { status: 404 }
      );
    }

    const artifacts = await prisma.aIArtifact.findMany({
      where: { assessmentId },
      select: {
        id: true,
        type: true,
        content: true,
        createdAt: true,
        generationMs: true,
        schemaVersion: true,
        engineVersion: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Events + logs are diagnostic-only. Skip them once the run has
    // settled (COMPLETED / FAILED / PARTIAL_FAILURE) — the preview page
    // doesn't render anything from them in that state, and they are by
    // far the heaviest of the four reads as run history grows.
    const terminal = TERMINAL_STATUSES.has(assessment.status);
    const events = terminal
      ? []
      : await prisma.assessmentEvent.findMany({
          where: { assessmentId },
          select: { id: true, type: true, stage: true, message: true, durationMs: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
    const logs = terminal
      ? []
      : await prisma.orchestrationLog.findMany({
          where: { assessmentId },
          select: { id: true, stage: true, status: true, durationMs: true, error: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });

    console.log("[STATUS] FOUND", { assessmentId, status: assessment.status });

    // ── GATE #3: Canonical artifact array format ──────────────────────────────
    // Artifacts ALWAYS hydrate as array to prevent frontend crashes.
    // See: normalizeArtifactsResponse() in safeData.ts for frontend verification.
    const artifactTypes = new Set(artifacts.map((artifact) => artifact.type));
    const artifactPresence = {
      clinicalReasoning: artifactTypes.has(ArtifactType.CLINICAL_REASONING),
      severityAnalysis: artifactTypes.has(ArtifactType.SEVERITY_ANALYSIS),
      therapyPlan: artifactTypes.has(ArtifactType.THERAPY_PLAN),
      recommendations: artifactTypes.has(ArtifactType.RECOMMENDATIONS),
      narratives: artifactTypes.has(ArtifactType.NARRATIVES),
      visualJourney: artifactTypes.has(ArtifactType.VISUAL_JOURNEY),
      report: artifactTypes.has(ArtifactType.REPORT),
      videoScript: artifactTypes.has(ArtifactType.VIDEO_SCRIPT),
      video: artifactTypes.has(ArtifactType.AVATAR_VIDEO),
    };

    // ── Derived video block — never exposes providerJobId/internal status ────
    const videoArtifact = artifacts.find((a) => a.type === ArtifactType.AVATAR_VIDEO);
    const video: VideoExperienceBlock = deriveVideoBlock(videoArtifact?.content);

    // Transform to canonical array format: never object map
    const artifactArray: AssessmentArtifact[] = artifacts.map((artifact) => ({
      id: artifact.id,
      type: artifact.type,
      content: artifact.content,
      createdAt: artifact.createdAt.toISOString(),
      generationMs: artifact.generationMs,
      schemaVersion: artifact.schemaVersion,
      engineVersion: artifact.engineVersion,
    }));

    const narrativesArtifact = artifacts.find((artifact) => artifact.type === ArtifactType.NARRATIVES);
    const narratives = narrativesArtifact ? liftNarratives(narrativesArtifact.content) : null;

    // ── Stuck detection ───────────────────────────────────────────────────
    const errors: string[] = [];
    if (assessment.lastError) errors.push(assessment.lastError);

    const isTerminal = TERMINAL_STATUSES.has(assessment.status);
    const timeSinceUpdate = Date.now() - assessment.updatedAt.getTime();
    const isStuck = !isTerminal && timeSinceUpdate > STUCK_THRESHOLD_MS;

    if (isStuck) {
      errors.push(
        `Orchestration appears stuck — no progress in ${Math.floor(timeSinceUpdate / 60_000)} minutes`
      );
    }

    // ── Timing ────────────────────────────────────────────────────────────
    const queueLatencyMs =
      assessment.startedAt && assessment.queuedAt
        ? assessment.startedAt.getTime() - assessment.queuedAt.getTime()
        : null;

    const orchestrationDurationMs =
      assessment.startedAt && assessment.completedAt
        ? assessment.completedAt.getTime() - assessment.startedAt.getTime()
        : assessment.startedAt && !isTerminal
        ? Date.now() - assessment.startedAt.getTime()
        : null;

    // ── Progress ──────────────────────────────────────────────────────────
    const progressPercent = PROGRESS_BY_STATUS[assessment.status] ?? 0;

    // ── Build response with canonical array artifacts ─────────────────────────
    const body: AssessmentStatusResponse & {
      patient: { name: string; age: number | null; gender: string | null };
      clinic: { name: string };
    } = {
      success: true,
      assessmentId: assessment.id,
      status: assessment.status,
      progressPercent,
      isStuck,
      startedAt: assessment.startedAt?.toISOString() ?? null,
      updatedAt: assessment.updatedAt.toISOString(),
      completedAt: assessment.completedAt?.toISOString() ?? null,
      artifacts: artifactArray, // GATE #3: Always array, never object map
      artifactPresence,
      narratives,
      video,
      patient: assessment.patient,
      clinic: assessment.clinic,
      timing: {
        queueLatencyMs,
        orchestrationDurationMs,
      },
      errors,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        stage: e.stage,
        message: e.message,
        durationMs: e.durationMs,
        createdAt: e.createdAt.toISOString(),
      })),
      orchestration: {
        stage: assessment.orchestrationStage,
        executionId: assessment.executionId,
        retryCount: assessment.retryCount,
        lastCompletedStage: assessment.lastCompletedStage,
        logs: logs.map((l) => ({
          id: l.id,
          stage: l.stage,
          status: l.status,
          durationMs: l.durationMs,
          error: l.error,
          createdAt: l.createdAt.toISOString(),
        })),
      },
    };

    console.log("[STATUS] RESPONSE", {
      assessmentId,
      status: assessment.status,
      progressPercent,
      artifactCount: artifacts.length,
      eventCount: events.length,
      isStuck,
      errors: errors.length,
    });

    // ── GATE #3: Log hydration shape ─────────────────────────────────────────
    console.log(`[GATE #3] ARTIFACTS HYDRATION: array format with ${artifactArray.length} items`);

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Assessment-Status": assessment.status,
        "X-Assessment-Progress": String(progressPercent),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[STATUS] ERROR", { assessmentId, error: message });

    return NextResponse.json(
      { success: false, error: "Failed to fetch assessment status" },
      { status: 500 }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveVideoBlock(content: unknown): VideoExperienceBlock {
  if (!content || typeof content !== "object") {
    return { state: "PENDING", url: null, thumbnailUrl: null, durationSec: null };
  }
  const v = content as Record<string, unknown>;
  const status = typeof v.status === "string" ? v.status : "PENDING";

  if (status === "READY" && typeof v.videoUrl === "string") {
    return {
      state: "READY",
      url: v.videoUrl,
      thumbnailUrl: typeof v.thumbnailUrl === "string" ? v.thumbnailUrl : null,
      durationSec: typeof v.durationSec === "number" ? v.durationSec : null,
    };
  }
  if (status === "FAILED") {
    return { state: "UNAVAILABLE", url: null, thumbnailUrl: null, durationSec: null };
  }
  if (status === "RENDERING") {
    return { state: "RENDERING", url: null, thumbnailUrl: null, durationSec: null };
  }
  return { state: "PENDING", url: null, thumbnailUrl: null, durationSec: null };
}
