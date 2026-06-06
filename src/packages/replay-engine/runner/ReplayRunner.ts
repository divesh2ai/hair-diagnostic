/**
 * ReplayRunner — orchestrates the pipeline against ClinicalReplayCase[].
 *
 * Deterministic, no AI, no mock layers. Captures intermediates for the
 * Failure Registry. Refuses to run if registry checksums change mid-run.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ClinicalPipeline,
  ClinicalReplayCase,
  ReplayResult,
} from "../types";

const REG_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "src", "packages", "registries");

function registryChecksum(): string {
  const h = crypto.createHash("sha256");
  for (const r of ["signals", "pathways", "causes"]) {
    h.update(fs.readFileSync(path.join(REG_ROOT, r, "registry.json")));
  }
  return h.digest("hex");
}

export class ReplayRunner {
  private readonly initialChecksum: string;
  constructor(private readonly pipeline: ClinicalPipeline) {
    this.initialChecksum = registryChecksum();
  }

  /** Run a single case end-to-end. */
  run(c: ClinicalReplayCase): ReplayResult {
    if (registryChecksum() !== this.initialChecksum) {
      throw new Error("Registry mutated mid-run; refusing to continue (determinism guard)");
    }
    const t0 = process.hrtime.bigint();

    const signals = this.pipeline.extractSignals(c);
    const pathways = this.pipeline.activatePathways(signals);
    const { posteriors, dissent, compositeRuleSatisfied } = this.pipeline.rankCauses(signals, pathways);
    const diag = this.pipeline.buildDiagnosis(c, posteriors, pathways);
    const protocol = this.pipeline.buildProtocol(c, diag, pathways);
    const monitoring = this.pipeline.scheduleMonitoring(c, diag, protocol);
    const narrative = this.pipeline.composeNarrative(c, diag, protocol);

    const t1 = process.hrtime.bigint();
    const durationMs = Number(t1 - t0) / 1e6;

    return {
      caseId: c.caseId,
      startedAt: new Date(0).toISOString(), // wall-clock excluded for determinism; replaced by report builder
      durationMs: Number(durationMs.toFixed(3)),
      diagnosisResult: diag,
      rootCauseResult: { ranked: posteriors, dissent, compositeRuleSatisfied },
      protocolResult: protocol,
      monitoringResult: monitoring,
      narrativeResult: narrative,
      intermediates: {
        extractedSignals: signals,
        activatedPathways: pathways,
        causePosteriors: posteriors,
      },
    };
  }

  /** Run a batch. Results are emitted in input order. */
  runAll(cases: ClinicalReplayCase[]): ReplayResult[] {
    const out: ReplayResult[] = [];
    for (const c of cases) out.push(this.run(c));
    return out;
  }
}
