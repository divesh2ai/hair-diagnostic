import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArtifactType } from "@prisma/client";
import { AssessmentDashboard } from "@/components/assessment/AssessmentDashboard";
import type { AssessmentViewData } from "@/components/assessment/AssessmentDashboard";

// ─── Data Fetcher ──────────────────────────────────────────────────────────────

async function fetchAssessmentViewData(assessmentId: string): Promise<AssessmentViewData | null> {
  const [assessment, artifacts, events, logs] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        status: true,
        orchestrationStage: true,
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
    }),
    prisma.aIArtifact.findMany({
      where: { assessmentId },
      select: { id: true, type: true, content: true, createdAt: true, generationMs: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assessmentEvent.findMany({
      where: { assessmentId },
      select: { id: true, type: true, stage: true, message: true, durationMs: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orchestrationLog.findMany({
      where: { assessmentId },
      select: { id: true, stage: true, status: true, durationMs: true, error: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!assessment) return null;

  const TERMINAL = new Set(["COMPLETED", "FAILED", "PARTIAL_FAILURE"]);
  const STUCK_THRESHOLD_MS = 10 * 60 * 1000;
  const isStuck =
    !TERMINAL.has(assessment.status) &&
    Date.now() - assessment.updatedAt.getTime() > STUCK_THRESHOLD_MS;

  const PROGRESS: Record<string, number> = {
    PENDING: 0, QUEUED: 5, NORMALIZING: 15,
    RUNNING_CLINICAL_ENGINE: 35, GENERATING_RECOMMENDATIONS: 55,
    GENERATING_REPORT: 75, COMPLETED: 100, PARTIAL_FAILURE: 90, FAILED: 0,
  };

  const artifactByType = Object.fromEntries(
    artifacts.map((a) => [
      a.type,
      {
        id: a.id,
        type: a.type,
        content: a.content,
        createdAt: a.createdAt.toISOString(),
        generationMs: a.generationMs,
      },
    ])
  );

  return {
    assessmentId: assessment.id,
    status: assessment.status,
    progressPercent: PROGRESS[assessment.status] ?? 0,
    isStuck,
    startedAt: assessment.startedAt?.toISOString() ?? null,
    completedAt: assessment.completedAt?.toISOString() ?? null,
    submittedAt: assessment.submittedAt.toISOString(),
    updatedAt: assessment.updatedAt.toISOString(),
    patient: {
      name: assessment.patient.name,
      age: assessment.patient.age,
      gender: assessment.patient.gender,
    },
    clinic: { name: assessment.clinic.name },
    artifacts: {
      clinicalReasoning: artifactByType[ArtifactType.CLINICAL_REASONING] ?? null,
      severityAnalysis: artifactByType[ArtifactType.SEVERITY_ANALYSIS] ?? null,
      therapyPlan: artifactByType[ArtifactType.THERAPY_PLAN] ?? null,
      recommendations: artifactByType[ArtifactType.RECOMMENDATIONS] ?? null,
      visualJourney: artifactByType[ArtifactType.VISUAL_JOURNEY] ?? null,
      report: artifactByType[ArtifactType.REPORT] ?? null,
    },
    orchestration: {
      stage: assessment.orchestrationStage,
      executionId: assessment.executionId,
      retryCount: assessment.retryCount,
      lastCompletedStage: assessment.lastCompletedStage,
      lastError: assessment.lastError,
      logs: logs.map((l) => ({
        id: l.id,
        stage: l.stage,
        status: l.status,
        durationMs: l.durationMs,
        error: l.error,
        createdAt: l.createdAt.toISOString(),
      })),
    },
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      stage: e.stage,
      message: e.message,
      durationMs: e.durationMs,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || typeof id !== "string") notFound();

  const data = await fetchAssessmentViewData(id);

  if (!data) notFound();

  return (
    <main className="min-h-screen bg-gray-50 print:bg-white">
      <AssessmentDashboard initialData={data} />
    </main>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `Clinical Assessment — ${id.slice(0, 8)}…`,
    description: "HairOS clinical assessment report",
  };
}
