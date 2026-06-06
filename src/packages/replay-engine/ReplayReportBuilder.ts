/**
 * ReplayReportBuilder — emits the three canonical artifacts:
 *
 *   replay-report.json   (full per-case results + validations + failures)
 *   replay-summary.md    (human-readable executive summary)
 *   benchmark.json       (release-gate scoreboard + drift baseline write)
 *
 * Drift is computed against an optional benchmark baseline JSON written by
 * the most recent green release.
 */

import fs from "node:fs";
import path from "node:path";
import {
  BenchmarkScoreboard,
  CaseValidation,
  ClinicalReplayCase,
  DimensionScore,
  ReplayResult,
} from "./types";
import { FailureEntry, FailureRegistry } from "./FailureRegistry";
import { VALIDATION_WEIGHTS } from "./ValidationEngine";

interface BuildArgs {
  replayId: string;
  corpusVersion: string;
  startedAt: string;
  cases: ClinicalReplayCase[];
  results: ReplayResult[];
  validations: CaseValidation[];
  registry: FailureRegistry;
  outDir: string;
  baselinePath?: string;
}

const FLOORS = {
  rootCause: 90,
  pathway: 90,
  treatment: 90,
  narrative: 85,
  governance: 90,
  overall: 90,
} as const;

const CATEGORY_FLOOR = 85;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = xs.reduce((a, b) => a + b, 0);
  return Number((s / xs.length).toFixed(2));
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return Number(sorted[idx]!.toFixed(3));
}

function dim(score: number, floor: number): DimensionScore {
  return { score, floor, pass: score >= floor };
}

export class ReplayReportBuilder {
  build(args: BuildArgs): BenchmarkScoreboard {
    fs.mkdirSync(args.outDir, { recursive: true });

    const scoreboard = this.buildScoreboard(args);
    this.writeReport(args, scoreboard);
    this.writeBenchmark(args, scoreboard);
    this.writeSummary(args, scoreboard);
    return scoreboard;
  }

  private buildScoreboard(args: BuildArgs): BenchmarkScoreboard {
    const { validations, cases, results, registry } = args;

    const rootCause = mean(validations.map((v) => v.rootCause.score));
    const pathway = mean(validations.map((v) => v.pathway.score));
    const treatment = mean(validations.map((v) => v.treatment.score));
    const narrative = mean(validations.map((v) => v.narrative.score));
    const governance = mean(validations.map((v) => v.governance.score));
    const overall = Number((
      rootCause * VALIDATION_WEIGHTS.rootCause +
      pathway * VALIDATION_WEIGHTS.pathway +
      treatment * VALIDATION_WEIGHTS.treatment +
      narrative * VALIDATION_WEIGHTS.narrative +
      governance * VALIDATION_WEIGHTS.governance
    ).toFixed(2));

    // Categorical
    const byCat = new Map<string, number[]>();
    for (let i = 0; i < cases.length; i++) {
      const cat = cases[i]!.category;
      const arr = byCat.get(cat) ?? [];
      arr.push(validations[i]!.overallScore);
      byCat.set(cat, arr);
    }
    const categories = [...byCat.entries()]
      .map(([category, scores]) => ({
        category,
        count: scores.length,
        score: mean(scores),
        pass: mean(scores) >= CATEGORY_FLOOR,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    // Critical / warning
    const criticalFindings = registry.criticalCount();
    const warningFindings = registry.warningCount();

    const topFailurePatterns = registry.topPatterns(10);
    const highRiskFailurePatterns = registry.highRiskPatterns(cases.length);

    // Performance
    const durations = results.map((r) => r.durationMs);
    const sweepMs = Number(durations.reduce((a, b) => a + b, 0).toFixed(2));
    const singleCaseP95Ms = percentile(durations, 0.95);

    // Drift
    const baseline = this.loadBaseline(args.baselinePath);
    const drift = baseline ? {
      baselineFound: true,
      overallDelta: Number((overall - baseline.dimensions.overall.score).toFixed(2)),
      rootCauseDelta: Number((rootCause - baseline.dimensions.rootCause.score).toFixed(2)),
    } : { baselineFound: false, overallDelta: 0, rootCauseDelta: 0 };

    // Gates
    const blockReasons: string[] = [];
    const dims = {
      rootCause: dim(rootCause, FLOORS.rootCause),
      pathway: dim(pathway, FLOORS.pathway),
      treatment: dim(treatment, FLOORS.treatment),
      narrative: dim(narrative, FLOORS.narrative),
      governance: dim(governance, FLOORS.governance),
      overall: dim(overall, FLOORS.overall),
    };
    for (const [name, d] of Object.entries(dims)) {
      if (!d.pass) blockReasons.push(`Dimension ${name} ${d.score} < floor ${d.floor}`);
    }
    for (const c of categories) {
      if (!c.pass) blockReasons.push(`Category ${c.category} ${c.score} < floor ${CATEGORY_FLOOR}`);
    }
    if (criticalFindings > 0) blockReasons.push(`${criticalFindings} critical finding(s)`);
    if (highRiskFailurePatterns.length > 0) blockReasons.push(`${highRiskFailurePatterns.length} high-risk failure pattern(s)`);
    if (drift.baselineFound && drift.overallDelta < -2) blockReasons.push(`Drift gate: overall regressed ${drift.overallDelta}`);

    return {
      corpusVersion: args.corpusVersion,
      replayId: args.replayId,
      startedAt: args.startedAt,
      cases: cases.length,
      dimensions: dims,
      categories,
      criticalFindings,
      warningFindings,
      topFailurePatterns,
      highRiskFailurePatterns,
      driftVsBaseline: drift,
      performance: { sweepMs, singleCaseP95Ms },
      overallPass: blockReasons.length === 0,
      blockReasons,
    };
  }

  private loadBaseline(p?: string): BenchmarkScoreboard | null {
    if (!p) return null;
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")) as BenchmarkScoreboard;
    } catch { return null; }
  }

  private writeReport(args: BuildArgs, scoreboard: BenchmarkScoreboard): void {
    const failures: FailureEntry[] = args.registry.all();
    const payload = {
      replayId: args.replayId,
      corpusVersion: args.corpusVersion,
      startedAt: args.startedAt,
      cases: args.cases.length,
      scoreboard,
      results: args.results,
      validations: args.validations,
      failures,
    };
    fs.writeFileSync(path.join(args.outDir, "replay-report.json"), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(args.outDir, "failure-registry.json"), JSON.stringify({
      replayId: args.replayId,
      corpusVersion: args.corpusVersion,
      startedAt: args.startedAt,
      entries: failures,
    }, null, 2));
  }

  private writeBenchmark(args: BuildArgs, s: BenchmarkScoreboard): void {
    fs.writeFileSync(path.join(args.outDir, "benchmark.json"), JSON.stringify(s, null, 2));
  }

  private writeSummary(args: BuildArgs, s: BenchmarkScoreboard): void {
    const lines: string[] = [];
    lines.push(`# Replay Summary — ${s.replayId}`);
    lines.push("");
    lines.push(`- **Corpus:** ${s.corpusVersion}`);
    lines.push(`- **Cases:** ${s.cases}`);
    lines.push(`- **Started:** ${s.startedAt}`);
    lines.push(`- **Overall pass:** ${s.overallPass ? "✅" : "❌"}`);
    lines.push(`- **Critical findings:** ${s.criticalFindings}`);
    lines.push(`- **Warning findings:** ${s.warningFindings}`);
    lines.push("");
    lines.push("## Dimensions");
    lines.push("| Dimension | Score | Floor | Pass |");
    lines.push("| --- | --- | --- | --- |");
    for (const [k, d] of Object.entries(s.dimensions)) {
      lines.push(`| ${k} | ${d.score} | ${d.floor} | ${d.pass ? "✅" : "❌"} |`);
    }
    lines.push("");
    lines.push("## Categories");
    lines.push("| Category | n | Score | Pass |");
    lines.push("| --- | --- | --- | --- |");
    for (const c of s.categories) lines.push(`| ${c.category} | ${c.count} | ${c.score} | ${c.pass ? "✅" : "❌"} |`);
    lines.push("");
    lines.push("## Performance");
    lines.push(`- Sweep total: ${s.performance.sweepMs} ms`);
    lines.push(`- Single-case p95: ${s.performance.singleCaseP95Ms} ms`);
    lines.push("");
    lines.push("## Drift vs baseline");
    lines.push(`- Baseline found: ${s.driftVsBaseline.baselineFound ? "yes" : "no"}`);
    if (s.driftVsBaseline.baselineFound) {
      lines.push(`- Overall delta: ${s.driftVsBaseline.overallDelta}`);
      lines.push(`- Root-cause delta: ${s.driftVsBaseline.rootCauseDelta}`);
    }
    lines.push("");
    lines.push("## Top failure patterns");
    lines.push("| Pattern | Count |");
    lines.push("| --- | --- |");
    for (const p of s.topFailurePatterns) lines.push(`| ${p.patternKey} | ${p.count} |`);
    lines.push("");
    if (s.highRiskFailurePatterns.length) {
      lines.push("## High-risk failure patterns");
      lines.push("| Pattern | Count | Rate |");
      lines.push("| --- | --- | --- |");
      for (const p of s.highRiskFailurePatterns) lines.push(`| ${p.patternKey} | ${p.count} | ${(p.rate * 100).toFixed(1)}% |`);
      lines.push("");
    }
    if (s.blockReasons.length) {
      lines.push("## Block reasons");
      for (const r of s.blockReasons) lines.push(`- ${r}`);
      lines.push("");
    }
    fs.writeFileSync(path.join(args.outDir, "replay-summary.md"), lines.join("\n") + "\n");
  }
}
