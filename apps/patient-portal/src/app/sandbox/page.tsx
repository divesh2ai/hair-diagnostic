"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FlaskConical, Play, Loader2, CheckCircle, XCircle,
  ChevronRight, User, Tag, AlertCircle,
} from "lucide-react";
import { QAScorecard, type ScorecardItem } from "@/components/sandbox/QAScorecard";
import { NormalizedSignalsPanel } from "@/components/sandbox/NormalizedSignalsPanel";
import { RecommendationViewer } from "@/components/sandbox/RecommendationViewer";
import { NarrativeViewer } from "@/components/sandbox/NarrativeViewer";
import { OrchestrationTimeline } from "@/components/sandbox/OrchestrationTimeline";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FixtureMetadata {
  id: string;
  title: string;
  description: string;
  condition: string;
  severity: string;
  tags: string[];
  budget: "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";
  expectedKits: string[];
  patient: { age: number; sex: string };
}

interface PipelineResult {
  fixtureId: string;
  fixture: {
    metadata: FixtureMetadata;
    expected: {
      diagnoses: string[];
      scalpStates: string[];
      rootCauses: string[];
      therapyNeeds: string[];
      mustIncludeKits: string[];
      mustExcludeKits: string[];
    };
  };
  pipeline: {
    clinical: {
      primaryDiagnosis: string;
      primaryScore: number;
      secondaryDiagnoses: { key: string; score: number }[];
      allScores: Record<string, number>;
      scalpStates: string[];
      rootCauses: string[];
      severity: string;
      flags: string[];
    };
    therapy: {
      needs: string[];
      needReasons: Record<string, string>;
    };
    recommendations: {
      rankedKits: { kitId: string; score: number; phase: string; matchedNeeds: string[]; reasons: string[] }[];
      protocolLabel: string;
      protocolRationale: string;
      selectionJustification: string;
      appliedRules: string[];
      ruleTrace: unknown[];
    };
    narrative: {
      doctorSummary: string;
      patientSummary: string;
      fullNarrative: string;
      length: string;
    };
  };
  validation: {
    diagnosisMatch: boolean;
    missingKits: string[];
    presentExcluded: string[];
    passed: boolean;
  };
  stageTiming: Record<string, number>;
  scorecards: ScorecardItem[];
}

type ResultTab = "scorecard" | "signals" | "recommendations" | "narrative" | "timeline";

// ─── Severity colours ─────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  MILD: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25",
  MODERATE: "text-amber-400 bg-amber-500/15 border-amber-500/25",
  SEVERE: "text-rose-400 bg-rose-500/15 border-rose-500/25",
  CRITICAL: "text-red-400 bg-red-500/15 border-red-500/25",
};

const BUDGET_COLORS: Record<string, string> = {
  ESSENTIAL: "text-teal-400 bg-teal-500/15 border-teal-500/25",
  STANDARD: "text-sky-400 bg-sky-500/15 border-sky-500/25",
  COMPREHENSIVE: "text-violet-400 bg-violet-500/15 border-violet-500/25",
};

// ─── Fixture card ─────────────────────────────────────────────────────────────

function FixtureCard({
  fixture,
  isSelected,
  isRunning,
  onRun,
}: {
  fixture: FixtureMetadata;
  isSelected: boolean;
  isRunning: boolean;
  onRun: () => void;
}) {
  const severityClass = SEVERITY_COLORS[fixture.severity] ?? "text-white/50 bg-white/5 border-white/10";
  const budgetClass = BUDGET_COLORS[fixture.budget] ?? "text-white/50 bg-white/5 border-white/10";

  return (
    <button
      type="button"
      onClick={onRun}
      disabled={isRunning}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        isSelected
          ? "border-sky-500/50 bg-sky-500/8 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
          : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]"
      } disabled:opacity-60`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{fixture.title}</p>
          <p className="text-xs text-white/40 font-mono mt-0.5 truncate">{fixture.id}</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${severityClass}`}>
            {fixture.severity}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${budgetClass}`}>
            {fixture.budget}
          </span>
        </div>
      </div>

      {/* Patient */}
      <div className="flex items-center gap-2 text-xs text-white/45 mb-2">
        <User className="h-3 w-3 shrink-0" />
        <span>{fixture.patient.sex}, {fixture.patient.age} yrs</span>
        <span className="text-white/20">·</span>
        <span className="truncate">{fixture.condition}</span>
      </div>

      {/* Tags */}
      {fixture.tags.length > 0 && (
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <Tag className="h-3 w-3 text-white/20 shrink-0" />
          {fixture.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] text-white/35 bg-white/5 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
          {fixture.tags.length > 3 && (
            <span className="text-[10px] text-white/25">+{fixture.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Expected kits */}
      {fixture.expectedKits.length > 0 && (
        <div className="text-[10px] text-white/30 truncate">
          Expect: {fixture.expectedKits.slice(0, 2).join(", ")}
          {fixture.expectedKits.length > 2 && ` +${fixture.expectedKits.length - 2}`}
        </div>
      )}

      {/* Run button */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-sky-400">
        {isRunning && isSelected ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            Run full pipeline
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
      </div>
    </button>
  );
}

// ─── Result tabs ─────────────────────────────────────────────────────────────

const TABS: { id: ResultTab; label: string }[] = [
  { id: "scorecard", label: "Scorecard" },
  { id: "signals", label: "Signals" },
  { id: "recommendations", label: "Kits" },
  { id: "narrative", label: "Narrative" },
  { id: "timeline", label: "Timeline" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const [fixtures, setFixtures] = useState<FixtureMetadata[]>([]);
  const [fixturesError, setFixturesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("scorecard");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sandbox/fixtures")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.fixtures)) {
          setFixtures(d.fixtures);
        } else {
          setFixturesError("Unexpected fixture list format");
        }
      })
      .catch(() => setFixturesError("Failed to load fixture library"));
  }, []);

  const runFixture = async (fixtureId: string) => {
    setSelected(fixtureId);
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveTab("scorecard");
    try {
      const res = await fetch("/api/sandbox/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId }),
      });
      const data = (await res.json()) as PipelineResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredFixtures = fixtures.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.id.toLowerCase().includes(q) ||
      f.condition.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      f.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#0a0f14] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <FlaskConical className="h-5 w-5 text-sky-400 shrink-0" />
        <div>
          <h1 className="text-base font-semibold">Clinical QA Sandbox</h1>
          <p className="text-xs text-white/35">Fixture replay · full pipeline · regression scoring</p>
        </div>
        <Link href="/" className="ml-auto text-xs text-white/40 hover:text-white/70 transition-colors">
          ← Home
        </Link>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid lg:grid-cols-[300px_1fr] gap-6">
        {/* ── Fixture sidebar ── */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-white/30">
              Fixture library ({filteredFixtures.length}{search ? `/${fixtures.length}` : ""})
            </p>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter fixtures…"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-sky-500/50 focus:bg-white/8 transition-colors"
          />

          {/* Fixture list */}
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-2 pr-1">
            {fixturesError && (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
                {fixturesError}
              </div>
            )}
            {fixtures.length === 0 && !fixturesError && (
              <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-8 text-center text-xs text-white/25">
                Loading fixtures…
              </div>
            )}
            {filteredFixtures.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                isSelected={selected === fixture.id}
                isRunning={loading && selected === fixture.id}
                onRun={() => runFixture(fixture.id)}
              />
            ))}
            {filteredFixtures.length === 0 && fixtures.length > 0 && (
              <p className="text-xs text-white/25 text-center py-4">No fixtures match "{search}"</p>
            )}
          </div>
        </aside>

        {/* ── Main panel ── */}
        <main className="space-y-6 min-w-0">
          {/* Empty state */}
          {!selected && !loading && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] py-20 text-center">
              <FlaskConical className="h-10 w-10 text-white/15 mb-4" />
              <p className="text-sm text-white/40">Select a fixture to run the full clinical pipeline</p>
              <p className="text-xs text-white/20 mt-1">
                Clinical → Therapy → Recommendations → Narrative
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/5 py-16 gap-4">
              <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-sky-300">Running clinical pipeline…</p>
                <p className="text-xs text-white/35 mt-1">{selected}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/25">
                {["Clinical Engine", "Therapy Engine", "Recommendation Engine", "Narrative Engine"].map((s, i) => (
                  <span key={s} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3" />}
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-5 py-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-300">Pipeline error</p>
                <p className="text-xs text-rose-200/70 mt-1 font-mono">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              {/* Result header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">{result.fixture.metadata.title}</h2>
                  <p className="text-xs text-white/40 mt-0.5 font-mono">{result.fixtureId}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
                  result.validation.passed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}>
                  {result.validation.passed ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {result.validation.passed ? "All checks passed" : "Validation failed"}
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Primary Diagnosis", value: result.pipeline.clinical.primaryDiagnosis, mono: false },
                  { label: "Severity", value: result.pipeline.clinical.severity, mono: false },
                  { label: "Kits Recommended", value: String(result.pipeline.recommendations.rankedKits.length), mono: true },
                  { label: "Pipeline Time", value: `${Object.values(result.stageTiming).reduce((a, b) => a + b, 0)}ms`, mono: true },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3">
                    <p className="text-xs text-white/35 mb-1">{stat.label}</p>
                    <p className={`text-sm font-semibold text-white truncate ${stat.mono ? "font-mono" : ""}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tab bar */}
              <div className="flex items-center gap-1 border-b border-white/10 pb-0">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? "border-sky-400 text-sky-300"
                        : "border-transparent text-white/40 hover:text-white/65"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="min-h-[400px]">
                {activeTab === "scorecard" && (
                  <div className="space-y-4">
                    {/* Inline validation */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Diagnosis", pass: result.validation.diagnosisMatch },
                        { label: "Required kits", pass: result.validation.missingKits.length === 0 },
                        { label: "No excluded kits", pass: result.validation.presentExcluded.length === 0 },
                      ].map((check) => (
                        <div
                          key={check.label}
                          className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${
                            check.pass
                              ? "border-emerald-500/20 bg-emerald-500/6"
                              : "border-rose-500/20 bg-rose-500/6"
                          }`}
                        >
                          {check.pass ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                          )}
                          <span className={`text-xs font-medium ${check.pass ? "text-emerald-300" : "text-rose-300"}`}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {result.scorecards.length > 0 ? (
                      <QAScorecard items={result.scorecards} />
                    ) : (
                      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-8 text-center">
                        <p className="text-sm text-white/30 italic">No QA scorecard available</p>
                        <p className="text-xs text-white/20 mt-1">The QA session may have failed or was skipped</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "signals" && (
                  <NormalizedSignalsPanel
                    clinical={result.pipeline.clinical}
                    expected={result.fixture.expected}
                  />
                )}

                {activeTab === "recommendations" && (
                  <RecommendationViewer
                    recommendations={result.pipeline.recommendations}
                    validation={result.validation}
                    expected={{
                      mustIncludeKits: result.fixture.expected.mustIncludeKits,
                      mustExcludeKits: result.fixture.expected.mustExcludeKits,
                    }}
                  />
                )}

                {activeTab === "narrative" && (
                  <NarrativeViewer narrative={result.pipeline.narrative} />
                )}

                {activeTab === "timeline" && (
                  <OrchestrationTimeline stageTiming={result.stageTiming} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
