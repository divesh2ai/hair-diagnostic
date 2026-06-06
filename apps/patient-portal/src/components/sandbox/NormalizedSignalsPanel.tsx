"use client";

import { CheckCircle, XCircle, AlertCircle, Activity, Brain, Layers } from "lucide-react";

interface SecondaryDiagnosis {
  key: string;
  score: number;
}

interface AllScores {
  [key: string]: number;
}

interface ClinicalSignals {
  primaryDiagnosis: string;
  primaryScore: number;
  secondaryDiagnoses: SecondaryDiagnosis[];
  allScores: AllScores;
  scalpStates: string[];
  rootCauses: string[];
  severity: string;
  flags: string[];
}

interface Expected {
  diagnoses: string[];
  scalpStates: string[];
  rootCauses: string[];
  therapyNeeds: string[];
  mustIncludeKits: string[];
  mustExcludeKits: string[];
}

interface NormalizedSignalsPanelProps {
  clinical: ClinicalSignals;
  expected: Expected;
}

const SEVERITY_COLORS: Record<string, string> = {
  MILD: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  MODERATE: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  SEVERE: "text-rose-300 bg-rose-500/15 border-rose-500/30",
  CRITICAL: "text-red-300 bg-red-500/15 border-red-500/30",
};

function MatchBadge({ match }: { match: boolean }) {
  return match ? (
    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
  ) : (
    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
  );
}

function SignalTag({ label, matched, expected }: { label: string; matched?: boolean; expected?: boolean }) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border";
  if (expected && !matched) {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/25`}>
        <AlertCircle className="h-3 w-3" />
        {label}
      </span>
    );
  }
  if (matched) {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-300 border-emerald-500/25`}>
        <CheckCircle className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <span className={`${base} bg-white/5 text-white/60 border-white/10`}>
      {label}
    </span>
  );
}

function ScoreBar({ label, score, isPrimary }: { label: string; score: number; isPrimary?: boolean }) {
  const pct = Math.min(Math.max(score, 0), 1);
  const width = `${Math.round(pct * 100)}%`;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs w-40 truncate shrink-0 ${isPrimary ? "text-white font-semibold" : "text-white/55"}`}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isPrimary ? "bg-sky-400" : "bg-white/25"}`}
          style={{ width }}
        />
      </div>
      <span className={`text-xs w-10 text-right shrink-0 tabular-nums ${isPrimary ? "text-sky-300" : "text-white/40"}`}>
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}

export function NormalizedSignalsPanel({ clinical, expected }: NormalizedSignalsPanelProps) {
  const actualDiagnoses = [clinical.primaryDiagnosis, ...clinical.secondaryDiagnoses.map((d) => d.key)];
  const diagnosisMatched = expected.diagnoses.length > 0
    ? expected.diagnoses.some((d) => actualDiagnoses.includes(d))
    : true;

  const scalpMatches = (state: string) => expected.scalpStates.includes(state);
  const rootMatches = (cause: string) => expected.rootCauses.includes(cause);
  const missedScalp = expected.scalpStates.filter((s) => !clinical.scalpStates.includes(s));
  const missedRoot = expected.rootCauses.filter((c) => !clinical.rootCauses.includes(c));

  const severityClass = SEVERITY_COLORS[clinical.severity] ?? "text-white/60 bg-white/5 border-white/10";
  const scores = clinical.allScores ?? {};
  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      {/* Primary diagnosis */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-white">Primary Diagnosis</h3>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MatchBadge match={diagnosisMatched} />
              <span className="text-base font-semibold text-white">{clinical.primaryDiagnosis}</span>
            </div>
            <p className="text-xs text-white/40 mt-1">
              Score: <span className="text-sky-300 font-mono">{Math.round((clinical.primaryScore ?? 0) * 100)}/100</span>
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${severityClass}`}>
            {clinical.severity}
          </span>
        </div>

        {expected.diagnoses.length > 0 && (
          <div className="pt-2 border-t border-white/8">
            <p className="text-xs text-white/40 mb-1.5">Expected diagnoses</p>
            <div className="flex flex-wrap gap-1.5">
              {expected.diagnoses.map((d) => (
                <SignalTag key={d} label={d} matched={actualDiagnoses.includes(d)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All scores */}
      {sortedScores.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Diagnosis Scores</h3>
          </div>
          <div className="space-y-2">
            {sortedScores.map(([key, score]) => (
              <ScoreBar
                key={key}
                label={key}
                score={score}
                isPrimary={key === clinical.primaryDiagnosis}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scalp states */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-teal-400" />
          <h3 className="text-sm font-semibold text-white">Scalp States</h3>
        </div>
        {clinical.scalpStates.length === 0 ? (
          <p className="text-xs text-white/35 italic">No scalp states detected</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {clinical.scalpStates.map((s) => (
              <SignalTag key={s} label={s} matched={scalpMatches(s)} />
            ))}
            {missedScalp.map((s) => (
              <SignalTag key={`miss-${s}`} label={s} expected />
            ))}
          </div>
        )}
      </div>

      {/* Root causes */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Root Causes</h3>
        {clinical.rootCauses.length === 0 ? (
          <p className="text-xs text-white/35 italic">No root causes identified</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {clinical.rootCauses.map((c) => (
              <SignalTag key={c} label={c} matched={rootMatches(c)} />
            ))}
            {missedRoot.map((c) => (
              <SignalTag key={`miss-${c}`} label={c} expected />
            ))}
          </div>
        )}
      </div>

      {/* Secondary diagnoses */}
      {clinical.secondaryDiagnoses.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Secondary Diagnoses</h3>
          <div className="space-y-2">
            {clinical.secondaryDiagnoses.map((d) => (
              <ScoreBar key={d.key} label={d.key} score={d.score} />
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {clinical.flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-300">Clinical Flags</h3>
          <div className="flex flex-wrap gap-1.5">
            {clinical.flags.map((f) => (
              <span key={f} className="px-2 py-0.5 rounded text-xs text-amber-200 bg-amber-500/15 border border-amber-500/25">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
