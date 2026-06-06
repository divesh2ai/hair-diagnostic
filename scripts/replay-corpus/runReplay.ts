#!/usr/bin/env node
/**
 * HairOS Replay CLI.
 *
 * Usage:
 *   ts-node scripts/replay-corpus/runReplay.ts [--filter <id|category>]
 *                                              [--out <reportDir>]
 *                                              [--baseline <file>]
 *                                              [--bail-on-critical]
 *
 * Exit code 0 iff all release gates pass.
 */

import crypto from "node:crypto";
import path from "node:path";
import {
  FailureRegistry,
  RegistryDrivenPipeline,
  ReplayReportBuilder,
  ReplayRunner,
  ValidationEngine,
  loadCorpus,
} from "../../src/packages/replay-engine";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
function flag(name: string): boolean {
  return process.argv.includes(name);
}

function main(): number {
  const filter = arg("--filter");
  const outDir = path.resolve(arg("--out", "tests/fixtures/replay-corpus-v2/_runs/latest")!);
  const baseline = arg("--baseline", path.resolve("src/packages/replay-engine/baselines/baseline.json"));
  const bailOnCritical = flag("--bail-on-critical");

  const cases = loadCorpus({ filter });
  if (cases.length === 0) {
    console.error(`No cases matched filter "${filter ?? ""}".`);
    return 2;
  }
  const corpusVersion = cases[0]!.corpusVersion;
  const replayId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const runner = new ReplayRunner(new RegistryDrivenPipeline());
  const results = runner.runAll(cases);

  const engine = new ValidationEngine();
  const validations = engine.validateAll(cases, results);

  const registry = new FailureRegistry(replayId, corpusVersion);
  registry.ingest(validations);

  if (bailOnCritical && registry.criticalCount() > 0) {
    console.error(`Bail: ${registry.criticalCount()} critical finding(s).`);
  }

  const builder = new ReplayReportBuilder();
  const scoreboard = builder.build({
    replayId, corpusVersion, startedAt,
    cases, results, validations, registry,
    outDir,
    baselinePath: baseline,
  });

  console.log(`Replay ${replayId}`);
  console.log(`Cases: ${scoreboard.cases}`);
  console.log(`Overall: ${scoreboard.dimensions.overall.score} (floor ${scoreboard.dimensions.overall.floor})`);
  console.log(`Pass: ${scoreboard.overallPass ? "✅" : "❌"}`);
  if (!scoreboard.overallPass) {
    for (const r of scoreboard.blockReasons) console.log(`  - ${r}`);
  }
  console.log(`Report: ${outDir}`);

  return scoreboard.overallPass ? 0 : 1;
}

process.exit(main());
