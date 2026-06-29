"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { StatusBanner } from "./StatusBanner";
import { ArtifactCard } from "./ArtifactCard";
import { EventTimeline } from "./EventTimeline";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { mergeStatusIntoReport } from "@/lib/adapters/assessmentAdapter";
import type {
  AssessmentArtifact,
  AssessmentEventPayload,
  AssessmentOrchestrationLog,
  AssessmentReportPayload,
} from "@shared/types/assessment";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArtifactData = AssessmentArtifact;

export type EventData = AssessmentEventPayload;

export type OrchestrationLogData = AssessmentOrchestrationLog;

export interface AssessmentViewData {
  assessmentId: string;
  status: string;
  progressPercent: number;
  isStuck: boolean;
  startedAt: string | null;
  completedAt: string | null;
  submittedAt: string;
  updatedAt: string;
  patient: { name: string; age: number | null; gender: string | null };
  clinic: { name: string };
  artifacts: {
    clinicalReasoning: ArtifactData | null;
    severityAnalysis: ArtifactData | null;
    therapyPlan: ArtifactData | null;
    recommendations: ArtifactData | null;
    visualJourney: ArtifactData | null;
    report: ArtifactData | null;
  };
  orchestration: {
    stage: string | null;
    executionId: string | null;
    retryCount: number;
    lastCompletedStage: string | null;
    lastError: string | null;
    logs: OrchestrationLogData[];
  };
  events: EventData[];
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "clinical" | "therapy" | "recommendations" | "timeline";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "clinical", label: "Clinical" },
  { id: "therapy", label: "Therapy" },
  { id: "recommendations", label: "Recommendations" },
  { id: "timeline", label: "Timeline" },
];

const TERMINAL = new Set(["COMPLETED", "FAILED", "PARTIAL_FAILURE"]);

// ─── Component ────────────────────────────────────────────────────────────────

export function AssessmentDashboard({ initialData }: { initialData: AssessmentViewData }) {
  const [data, setData] = useState<AssessmentViewData>(initialData);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment/status?id=${data.assessmentId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;

      const previousArtifacts = Object.values(data.artifacts).filter(Boolean) as AssessmentArtifact[];
      const normalized = mergeStatusIntoReport(
        {
          assessmentId: data.assessmentId,
          status: data.status,
          progressPercent: data.progressPercent,
          isStuck: data.isStuck,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          updatedAt: data.updatedAt,
          patient: data.patient,
          clinic: data.clinic,
          artifacts: previousArtifacts,
          artifactByType: Object.fromEntries(previousArtifacts.map((artifact) => [artifact.type, artifact])),
          artifactPresence: {},
          narratives: null,
          processing: {
            status: data.status as AssessmentReportPayload["processing"]["status"],
            progressPercent: data.progressPercent,
            isStuck: data.isStuck,
            stage: data.orchestration.stage,
            executionId: data.orchestration.executionId,
            retryCount: data.orchestration.retryCount,
            lastCompletedStage: data.orchestration.lastCompletedStage,
            lastError: data.orchestration.lastError,
            errors: data.orchestration.lastError ? [data.orchestration.lastError] : [],
          },
          events: data.events,
          orchestrationLogs: data.orchestration.logs,
        },
        json
      );

      startTransition(() => {
        setData((prev) => ({
          ...prev,
          status: normalized.status,
          progressPercent: normalized.progressPercent,
          isStuck: normalized.isStuck,
          startedAt: normalized.startedAt ?? prev.startedAt,
          completedAt: normalized.completedAt ?? prev.completedAt,
          updatedAt: normalized.updatedAt ?? prev.updatedAt,
          artifacts: {
            clinicalReasoning: normalized.artifactByType.CLINICAL_REASONING ?? null,
            severityAnalysis: normalized.artifactByType.SEVERITY_ANALYSIS ?? null,
            therapyPlan: normalized.artifactByType.THERAPY_PLAN ?? null,
            recommendations: normalized.artifactByType.RECOMMENDATIONS ?? null,
            visualJourney: normalized.artifactByType.VISUAL_JOURNEY ?? null,
            report: normalized.artifactByType.REPORT ?? null,
          },
          orchestration: {
            ...prev.orchestration,
            stage: normalized.processing.stage ?? prev.orchestration.stage,
            retryCount: normalized.processing.retryCount,
            lastCompletedStage: normalized.processing.lastCompletedStage ?? prev.orchestration.lastCompletedStage,
            lastError: normalized.processing.errors[0] ?? prev.orchestration.lastError,
            logs: normalized.orchestrationLogs,
          },
          events: normalized.events,
        }));
      });
    } catch {
      // Silently ignore network errors during polling
    }
  }, [data.assessmentId]);

  // Auto-poll while not terminal
  useEffect(() => {
    if (TERMINAL.has(data.status)) return;
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, [data.status, refresh]);

  const handleRetry = async () => {
    await fetch("/api/assessment/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId: data.assessmentId }),
    });
    await refresh();
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 print:px-0 print:py-0">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 print:mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1 print:hidden">
            <span>HairOS Clinical Platform</span>
            <span>/</span>
            <span>{data.clinic.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Assessment</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.patient.name}
            {data.patient.age ? `, ${data.patient.age} yrs` : ""}
            {data.patient.gender ? ` · ${data.patient.gender}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={refresh}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Print
          </button>
        </div>
      </div>

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      <StatusBanner
        status={data.status}
        progressPercent={data.progressPercent}
        isStuck={data.isStuck}
        stage={data.orchestration.stage}
        retryCount={data.orchestration.retryCount}
        onRetry={data.status === "FAILED" ? handleRetry : undefined}
      />

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="mt-6 border-b border-gray-200 print:hidden">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab data={data} />}
        {activeTab === "clinical" && (
          <ErrorBoundary title="Clinical reasoning could not be displayed">
            <ArtifactCard
              title="Clinical Reasoning"
              description="Normalized clinical signals extracted from the questionnaire"
              artifact={data.artifacts.clinicalReasoning}
            />
          </ErrorBoundary>
        )}
        {activeTab === "therapy" && (
          <div className="space-y-4">
            <ErrorBoundary title="Severity analysis could not be displayed">
              <ArtifactCard
                title="Severity Analysis"
                description="Clinical evaluation and severity grading per condition"
                artifact={data.artifacts.severityAnalysis}
              />
            </ErrorBoundary>
            <ErrorBoundary title="Therapy plan could not be displayed">
              <ArtifactCard
                title="Therapy Plan"
                description="Mapped therapy needs based on clinical signals"
                artifact={data.artifacts.therapyPlan}
              />
            </ErrorBoundary>
          </div>
        )}
        {activeTab === "recommendations" && (
          <ErrorBoundary title="Recommendations could not be displayed">
            <ArtifactCard
              title="Product Recommendations"
              description="Ranked clinical kit recommendations for this patient"
              artifact={data.artifacts.recommendations}
            />
          </ErrorBoundary>
        )}
        {activeTab === "timeline" && (
          <ErrorBoundary title="Timeline could not be displayed">
            <EventTimeline events={data.events} logs={data.orchestration.logs} />
          </ErrorBoundary>
        )}
      </div>

      {/* ── Print-only: all artifacts ───────────────────────────────────────── */}
      <div className="hidden print:block space-y-8 mt-8">
        <ArtifactCard title="Clinical Reasoning" artifact={data.artifacts.clinicalReasoning} />
        <ArtifactCard title="Severity Analysis" artifact={data.artifacts.severityAnalysis} />
        <ArtifactCard title="Therapy Plan" artifact={data.artifacts.therapyPlan} />
        <ArtifactCard title="Recommendations" artifact={data.artifacts.recommendations} />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="mt-10 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 print:mt-4">
        <span>ID: {data.assessmentId}</span>
        <span>Submitted {new Date(data.submittedAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AssessmentViewData }) {
  const artifactEntries = [
    { key: "clinicalReasoning", label: "Clinical Reasoning", artifact: data.artifacts.clinicalReasoning },
    { key: "severityAnalysis", label: "Severity Analysis", artifact: data.artifacts.severityAnalysis },
    { key: "therapyPlan", label: "Therapy Plan", artifact: data.artifacts.therapyPlan },
    { key: "recommendations", label: "Recommendations", artifact: data.artifacts.recommendations },
    { key: "visualJourney", label: "Visual Journey", artifact: data.artifacts.visualJourney },
    { key: "report", label: "Report", artifact: data.artifacts.report },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Artifact presence grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Artifact Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {artifactEntries.map(({ key, label, artifact }) => (
            <div
              key={key}
              className={[
                "rounded-lg border p-3 flex items-start gap-2.5",
                artifact ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white",
              ].join(" ")}
            >
              <span className={["mt-0.5 text-base", artifact ? "text-emerald-500" : "text-gray-300"].join(" ")}>
                {artifact ? "✓" : "○"}
              </span>
              <div className="min-w-0">
                <p className={["text-sm font-medium", artifact ? "text-emerald-800" : "text-gray-400"].join(" ")}>
                  {label}
                </p>
                {artifact && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {artifact.generationMs != null ? `${artifact.generationMs}ms` : "Ready"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Orchestration info */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Orchestration
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {[
            { label: "Execution ID", value: data.orchestration.executionId ?? "—" },
            { label: "Current stage", value: data.orchestration.stage ?? "—" },
            { label: "Last completed stage", value: data.orchestration.lastCompletedStage ?? "—" },
            { label: "Retry count", value: String(data.orchestration.retryCount) },
            {
              label: "Started at",
              value: data.startedAt ? new Date(data.startedAt).toLocaleString() : "—",
            },
            {
              label: "Completed at",
              value: data.completedAt ? new Date(data.completedAt).toLocaleString() : "—",
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-mono text-gray-800 text-xs truncate max-w-[200px]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Last error */}
      {data.orchestration.lastError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-700 mb-1">Last error</p>
          <p className="text-sm text-rose-600 font-mono break-all">{data.orchestration.lastError}</p>
        </div>
      )}
    </div>
  );
}
