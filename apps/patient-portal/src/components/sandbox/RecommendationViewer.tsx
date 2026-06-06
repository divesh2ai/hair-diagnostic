"use client";

import { useState } from "react";
import { Package, CheckCircle, XCircle, ChevronDown, ChevronRight, Zap, Shield } from "lucide-react";

interface RankedKit {
  kitId: string;
  score: number;
  phase: string;
  matchedNeeds: string[];
  reasons: string[];
}

interface Recommendations {
  rankedKits: RankedKit[];
  protocolLabel: string;
  protocolRationale: string;
  selectionJustification: string;
  appliedRules: string[];
  ruleTrace: unknown[];
}

interface Validation {
  diagnosisMatch: boolean;
  missingKits: string[];
  presentExcluded: string[];
  passed: boolean;
}

interface RecommendationViewerProps {
  recommendations: Recommendations;
  validation: Validation;
  expected: {
    mustIncludeKits: string[];
    mustExcludeKits: string[];
  };
}

const PHASE_COLORS: Record<string, string> = {
  PRIMARY: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  SECONDARY: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  ADJUNCT: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  SUPPORT: "bg-white/10 text-white/60 border-white/15",
};

function phaseClass(phase: string) {
  return PHASE_COLORS[phase?.toUpperCase()] ?? PHASE_COLORS.SUPPORT;
}

function KitCard({ kit, rank, mustInclude, mustExclude }: {
  kit: RankedKit;
  rank: number;
  mustInclude: boolean;
  mustExclude: boolean;
}) {
  const [open, setOpen] = useState(false);
  const score = Math.round(Math.min(Math.max(kit.score ?? 0, 0), 1) * 100);

  return (
    <div className={`rounded-xl border transition-colors ${
      mustExclude
        ? "border-rose-500/30 bg-rose-500/5"
        : mustInclude
        ? "border-emerald-500/25 bg-emerald-500/5"
        : "border-white/10 bg-white/[0.025]"
    }`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Rank */}
        <span className="text-xs font-mono text-white/30 w-5 shrink-0">#{rank}</span>

        {/* Kit name */}
        <span className={`flex-1 text-sm font-semibold ${mustExclude ? "text-rose-300" : "text-white"}`}>
          {kit.kitId}
        </span>

        {/* Expected tag */}
        {mustInclude && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> Expected
          </span>
        )}
        {mustExclude && (
          <span className="flex items-center gap-1 text-xs text-rose-400">
            <XCircle className="h-3.5 w-3.5" /> Excluded
          </span>
        )}

        {/* Phase */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${phaseClass(kit.phase)}`}>
          {kit.phase}
        </span>

        {/* Score bar */}
        <div className="flex items-center gap-2 shrink-0 w-24">
          <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full bg-sky-400" style={{ width: `${score}%` }} />
          </div>
          <span className="text-xs text-sky-300 tabular-nums w-7 text-right">{score}</span>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/8 px-4 py-3 space-y-3">
          {kit.matchedNeeds.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Matched therapy needs</p>
              <div className="flex flex-wrap gap-1">
                {kit.matchedNeeds.map((n) => (
                  <span key={n} className="px-2 py-0.5 rounded-md text-xs bg-sky-500/15 text-sky-300 border border-sky-500/20">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {kit.reasons.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Selection reasons</p>
              <ul className="space-y-1">
                {kit.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-white/65 flex gap-2">
                    <span className="text-white/25 shrink-0 mt-px">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RecommendationViewer({ recommendations, validation, expected }: RecommendationViewerProps) {
  const [showTrace, setShowTrace] = useState(false);
  const includeSet = new Set(expected.mustIncludeKits);
  const excludeSet = new Set(expected.mustExcludeKits);

  return (
    <div className="space-y-6">
      {/* Validation banner */}
      <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${
        validation.passed
          ? "bg-emerald-500/8 border-emerald-500/25"
          : "bg-rose-500/8 border-rose-500/25"
      }`}>
        <div className="mt-0.5">
          {validation.passed ? (
            <CheckCircle className="h-5 w-5 text-emerald-400" />
          ) : (
            <XCircle className="h-5 w-5 text-rose-400" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <p className={`text-sm font-semibold ${validation.passed ? "text-emerald-300" : "text-rose-300"}`}>
            {validation.passed ? "All validation checks passed" : "Validation failed"}
          </p>
          {validation.missingKits.length > 0 && (
            <p className="text-xs text-rose-300">
              Missing expected kits: {validation.missingKits.join(", ")}
            </p>
          )}
          {validation.presentExcluded.length > 0 && (
            <p className="text-xs text-rose-300">
              Excluded kits present: {validation.presentExcluded.join(", ")}
            </p>
          )}
          {!validation.diagnosisMatch && (
            <p className="text-xs text-rose-300">Diagnosis mismatch</p>
          )}
        </div>
      </div>

      {/* Protocol */}
      {recommendations.protocolLabel && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">{recommendations.protocolLabel}</h3>
          </div>
          {recommendations.protocolRationale && (
            <p className="text-xs text-white/55 leading-relaxed">{recommendations.protocolRationale}</p>
          )}
          {recommendations.selectionJustification && (
            <p className="text-xs text-white/40 leading-relaxed border-t border-white/8 pt-2 mt-2">
              {recommendations.selectionJustification}
            </p>
          )}
        </div>
      )}

      {/* Ranked kits */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Package className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white">
            Ranked Kits ({recommendations.rankedKits.length})
          </h3>
        </div>
        {recommendations.rankedKits.length === 0 ? (
          <p className="text-xs text-white/35 italic">No kits recommended</p>
        ) : (
          recommendations.rankedKits.map((kit, i) => (
            <KitCard
              key={kit.kitId}
              kit={kit}
              rank={i + 1}
              mustInclude={includeSet.has(kit.kitId)}
              mustExclude={excludeSet.has(kit.kitId)}
            />
          ))
        )}
      </div>

      {/* Applied rules */}
      {recommendations.appliedRules.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">
              Applied Rules ({recommendations.appliedRules.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.appliedRules.map((rule) => (
              <span key={rule} className="px-2 py-0.5 text-xs rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">
                {rule}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rule trace toggle */}
      {Array.isArray(recommendations.ruleTrace) && recommendations.ruleTrace.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-black/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTrace((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <span>Rule trace ({recommendations.ruleTrace.length} entries)</span>
            {showTrace ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showTrace && (
            <pre className="px-4 pb-4 text-xs text-white/40 overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(recommendations.ruleTrace, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
