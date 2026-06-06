"use client";

import type { EventData, OrchestrationLogData } from "./AssessmentDashboard";
import { safeArray } from "@/lib/safeData";

interface EventTimelineProps {
  events: EventData[];
  logs: OrchestrationLogData[];
}

// Merge events + orchestration logs into one chronological stream
interface TimelineItem {
  id: string;
  kind: "event" | "log";
  timestamp: string;
  label: string;
  sublabel?: string;
  status: "success" | "failed" | "running" | "info";
  durationMs?: number | null;
  detail?: string | null;
}

const EVENT_LABELS: Record<string, { label: string; status: TimelineItem["status"] }> = {
  SUBMITTED:               { label: "Assessment submitted",          status: "info" },
  QUEUED:                  { label: "Queued for orchestration",      status: "info" },
  ORCHESTRATION_STARTED:   { label: "Orchestration started",         status: "info" },
  NORMALIZATION_COMPLETE:  { label: "Signal normalization complete",  status: "success" },
  CLINICAL_ENGINE_COMPLETE:{ label: "Clinical engine complete",       status: "success" },
  RECOMMENDATIONS_COMPLETE:{ label: "Recommendations complete",       status: "success" },
  REPORT_GENERATED:        { label: "Report generated",              status: "success" },
  ARTIFACT_CREATED:        { label: "Artifact created",              status: "success" },
  FAILED:                  { label: "Stage failed",                  status: "failed" },
  RETRY_STARTED:           { label: "Retry initiated",               status: "info" },
  RETRY_SUCCEEDED:         { label: "Pipeline completed",            status: "success" },
  RETRY_FAILED:            { label: "Retry failed",                  status: "failed" },
};

const LOG_STATUS: Record<string, TimelineItem["status"]> = {
  SUCCESS: "success",
  FAILED: "failed",
  RUNNING: "running",
};

const STATUS_ICON: Record<TimelineItem["status"], string> = {
  success: "✓",
  failed: "✕",
  running: "…",
  info: "·",
};

const STATUS_CLASSES: Record<TimelineItem["status"], { dot: string; text: string; bg: string }> = {
  success: { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
  failed:  { dot: "bg-rose-400",    text: "text-rose-700",    bg: "bg-rose-50" },
  running: { dot: "bg-sky-400",     text: "text-sky-700",     bg: "bg-sky-50" },
  info:    { dot: "bg-gray-300",    text: "text-gray-600",    bg: "bg-gray-50" },
};

export function EventTimeline({ events, logs }: EventTimelineProps) {
  const safeEvents = safeArray<EventData>(events);
  const safeLogs = safeArray<OrchestrationLogData>(logs);
  const items: TimelineItem[] = [
    ...safeEvents.map((e): TimelineItem => ({
      id: `event-${e.id}`,
      kind: "event",
      timestamp: e.createdAt,
      label: EVENT_LABELS[e.type]?.label ?? e.type,
      sublabel: e.stage ? `Stage: ${e.stage}` : undefined,
      status: EVENT_LABELS[e.type]?.status ?? "info",
      durationMs: e.durationMs,
      detail: e.message,
    })),
    ...safeLogs.map((l): TimelineItem => ({
      id: `log-${l.id}`,
      kind: "log",
      timestamp: l.createdAt,
      label: `${l.stage} — ${l.status.toLowerCase()}`,
      sublabel: "Orchestration log",
      status: LOG_STATUS[l.status] ?? "info",
      durationMs: l.durationMs,
      detail: l.error,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No events recorded yet.</p>
        <p className="text-xs text-gray-300 mt-1">Events will appear here as orchestration progresses.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Event Timeline</h3>
        <p className="text-xs text-gray-500 mt-0.5">{items.length} events — chronological pipeline execution</p>
      </div>

      <div className="divide-y divide-gray-50">
        {items.map((item, idx) => {
          const cls = STATUS_CLASSES[item.status];
          const isLast = idx === items.length - 1;

          return (
            <div key={item.id} className="flex gap-4 px-5 py-3">
              {/* Timeline rail */}
              <div className="flex flex-col items-center pt-1 shrink-0">
                <div
                  className={[
                    "h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                    cls.bg,
                  ].join(" ")}
                >
                  <span className={cls.text}>{STATUS_ICON[item.status]}</span>
                </div>
                {!isLast && <div className="flex-1 w-px bg-gray-100 mt-1 min-h-[16px]" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${cls.text}`}>{item.label}</p>
                    {item.sublabel && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.sublabel}</p>
                    )}
                    {item.detail && (
                      <p className="text-xs text-rose-600 font-mono mt-1 break-all">{item.detail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    {item.durationMs != null && (
                      <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                        {item.durationMs}ms
                      </span>
                    )}
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
