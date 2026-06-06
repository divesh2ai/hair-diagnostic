/**
 * Governance validator — enforces case-level invariants that are NOT
 * about clinical correctness but about corpus integrity & pipeline
 * contract compliance:
 *
 *  - Case corpusVersion matches engine corpus contract.
 *  - All emitted signalIds exist in the signal registry.
 *  - All emitted pathwayIds exist in the pathway registry.
 *  - All emitted causeIds exist in the cause registry.
 *  - Adversarial cases: primary cause MUST match adversarial.expectedPrimaryDriver
 *    (overrides numeric scoring per Release Gate spec §3).
 *  - ReplayResult schema sanity (no NaN, no negative durations).
 */

import { ClinicalReplayCase, ReplayResult, ValidatorOutcome } from "../types";
import { loadRegistries } from "../pipeline/registryLoader";
import { finding, scoreOf, anyCritical } from "./utils";

const SUPPORTED_CORPUS = new Set(["2.0.0"]);

export function validateGovernance(
  c: ClinicalReplayCase,
  r: ReplayResult
): ValidatorOutcome {
  const findings = [];
  let lost = 0;
  const total = 100;
  const { signals, pathways, causes } = loadRegistries();

  // (15) corpus version
  if (!SUPPORTED_CORPUS.has(c.corpusVersion)) {
    findings.push(finding(
      "CORPUS_VERSION_UNSUPPORTED", "critical", "GOVERNANCE_FAILURE",
      [...SUPPORTED_CORPUS], c.corpusVersion,
      `Case corpusVersion "${c.corpusVersion}" unsupported.`,
      c.corpusVersion, "UNSUPPORTED_VERSION"
    ));
    lost += 30;
  }

  // (25) signal IDs registered
  for (const s of r.intermediates.extractedSignals) {
    if (!signals.has(s.signalId)) {
      findings.push(finding(
        "UNKNOWN_SIGNAL_ID", "critical", "GOVERNANCE_FAILURE",
        "registered", s.signalId,
        `Emitted signal "${s.signalId}" not in registry.`,
        s.signalId, "UNKNOWN"
      ));
      lost += 5;
    }
  }
  // pathway IDs
  for (const p of r.intermediates.activatedPathways) {
    if (!pathways.has(p.pathwayId)) {
      findings.push(finding(
        "UNKNOWN_PATHWAY_ID", "critical", "GOVERNANCE_FAILURE",
        "registered", p.pathwayId,
        `Emitted pathway "${p.pathwayId}" not in registry.`,
        p.pathwayId, "UNKNOWN"
      ));
      lost += 5;
    }
  }
  // cause IDs
  for (const cp of r.intermediates.causePosteriors) {
    if (!causes.has(cp.causeId)) {
      findings.push(finding(
        "UNKNOWN_CAUSE_ID", "critical", "GOVERNANCE_FAILURE",
        "registered", cp.causeId,
        `Emitted cause "${cp.causeId}" not in registry.`,
        cp.causeId, "UNKNOWN"
      ));
      lost += 5;
    }
  }

  // (25) Adversarial primary driver gate
  if (c.adversarial?.isAdversarial) {
    if (r.diagnosisResult.primary !== c.adversarial.expectedPrimaryDriver) {
      findings.push(finding(
        "ADVERSARIAL_DRIVER_MISS", "critical", "GOVERNANCE_FAILURE",
        c.adversarial.expectedPrimaryDriver, r.diagnosisResult.primary,
        `Adversarial case primary driver mismatch — release-gate sentinel.`,
        c.adversarial.expectedPrimaryDriver, "ADVERSARIAL_MISS"
      ));
      lost += 25;
    }
  }

  // (10) Determinism / numeric sanity
  if (r.durationMs < 0 || Number.isNaN(r.durationMs)) {
    findings.push(finding(
      "REPLAY_DURATION_INVALID", "minor", "GOVERNANCE_FAILURE",
      "≥ 0", r.durationMs, "Replay duration invalid.", "duration", "INVALID"
    ));
    lost += 5;
  }
  for (const p of r.intermediates.causePosteriors) {
    if (Number.isNaN(p.posterior) || p.posterior < 0 || p.posterior > 1) {
      findings.push(finding(
        "POSTERIOR_OUT_OF_RANGE", "critical", "GOVERNANCE_FAILURE",
        "[0,1]", p.posterior,
        `Posterior for "${p.causeId}" out of range.`,
        p.causeId, "OUT_OF_RANGE"
      ));
      lost += 10;
    }
  }

  // (25) Confidence consistency: sum of posteriors should be ≈ 1.0
  const sum = r.intermediates.causePosteriors.reduce((a, b) => a + b.posterior, 0);
  if (Math.abs(sum - 1) > 0.01) {
    findings.push(finding(
      "POSTERIOR_SUM_DRIFT", "minor", "GOVERNANCE_FAILURE",
      "1.0 ± 0.01", sum,
      `Posterior sum drifted to ${sum.toFixed(4)}.`,
      "posterior-sum", "DRIFT"
    ));
    lost += 5;
  }

  const score = scoreOf(total, lost);
  return { pass: !anyCritical(findings) && score >= 70, score, findings };
}
