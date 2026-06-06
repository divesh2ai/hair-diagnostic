"use client";

import { CheckCircle, Clock } from "lucide-react";

interface OrchestrationTimelineProps {
  stageTiming: Record<string, number>;
}

const STAGE_META: Record<string, { label: string; description: string; color: string }> = {
  fixture_load: {
    label: "Fixture Load",
    description: "Parse and validate fixture JSON from disk",
    color: "bg-white/40",
  },
  clinical: {
    label: "Clinical Engine",
    description: "Evaluate diagnosis profile, severity, scalp states, root causes",
    color: "bg-sky-400",
  },
  therapy: {
    label: "Therapy Engine",
    description: "Map clinical signals to therapy needs and priorities",
    color: "bg-violet-400",
  },
  recommendations: {
    label: "Recommendation Engine",
    description: "Score and rank kit candidates, apply clinical rules",
    color: "bg-amber-400",
  },
  narrative: {
    label: "Narrative Engine",
    description: "Build doctor summary, patient summary, and full report",
    color: "bg-teal-400",
  },
  qa_session: {
    label: "QA Session",
    description: "Run regression scorecard, branching checks, and signal validation",
    color: "bg-rose-400",
  },
};

const STAGE_ORDER = ["fixture_load", "clinical", "therapy", "recommendations", "narrative", "qa_session"];

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function OrchestrationTimeline({ stageTiming }: OrchestrationTimelineProps) {
  const stages = STAGE_ORDER.filter((s) => s in stageTiming);
  const extras = Object.keys(stageTiming).filter((s) => !STAGE_ORDER.includes(s));
  const allStages = [...stages, ...extras];

  const totalMs = allStages.reduce((sum, s) => sum + (stageTiming[s] ?? 0), 0);
  const maxMs = Math.max(...allStages.map((s) => stageTiming[s] ?? 0), 1);

  if (allStages.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.025] px-5 py-10 text-center">
        <p className="text-sm text-white/30 italic">No timing data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total time header */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-5 py-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Total pipeline time</span>
        </div>
        <span className="text-lg font-bold tabular-nums text-sky-300">{formatMs(totalMs)}</span>
      </div>

      {/* Stage timeline */}
      <div className="space-y-3">
        {allStages.map((stageKey, idx) => {
          const ms = stageTiming[stageKey] ?? 0;
          const pct = (ms / maxMs) * 100;
          const meta = STAGE_META[stageKey] ?? {
            label: stageKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            description: "Custom pipeline stage",
            color: "bg-white/30",
          };

          return (
            <div key={stageKey} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 space-y-2">
              <div className="flex items-center gap-3">
                {/* Step number */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-mono text-white/50">
                  {idx + 1}
                </span>

                {/* Label & description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{meta.label}</p>
                  <p className="text-xs text-white/40">{meta.description}</p>
                </div>

                {/* Check + duration */}
                <div className="flex items-center gap-2 shrink-0">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold tabular-nums text-white/80">{formatMs(ms)}</span>
                </div>
              </div>

              {/* Duration bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${meta.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-white/25 tabular-nums w-10 text-right">
                  {Math.round((ms / totalMs) * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Waterfall visual */}
      <div className="rounded-xl border border-white/8 bg-black/20 p-4 space-y-2 overflow-hidden">
        <p className="text-xs text-white/30 mb-3">Waterfall</p>
        {allStages.map((stageKey) => {
          const ms = stageTiming[stageKey] ?? 0;
          const meta = STAGE_META[stageKey] ?? { label: stageKey, color: "bg-white/30", description: "" };
          const offsetPct = (() => {
            let offset = 0;
            for (const s of allStages) {
              if (s === stageKey) break;
              offset += stageTiming[s] ?? 0;
            }
            return (offset / totalMs) * 100;
          })();
          const widthPct = (ms / totalMs) * 100;

          return (
            <div key={stageKey} className="flex items-center gap-3 h-5">
              <span className="text-xs text-white/30 w-36 shrink-0 truncate">{meta.label}</span>
              <div className="flex-1 relative h-3 rounded bg-white/5">
                <div
                  className={`absolute h-full rounded ${meta.color} opacity-75`}
                  style={{
                    left: `${offsetPct}%`,
                    width: `${Math.max(widthPct, 0.5)}%`,
                  }}
                />
              </div>
              <span className="text-xs text-white/25 tabular-nums w-12 text-right shrink-0">{formatMs(ms)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
