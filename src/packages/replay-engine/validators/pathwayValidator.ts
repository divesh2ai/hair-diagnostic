/**
 * Validates signal extraction + pathway activation against the
 * case's expectedSignals + expectedPathways assertions.
 */

import { ClinicalReplayCase, ReplayResult, ValidatorOutcome } from "../types";
import { finding, scoreOf, anyCritical } from "./utils";

export function validatePathway(
  c: ClinicalReplayCase,
  r: ReplayResult
): ValidatorOutcome {
  const findings = [];
  let lost = 0;
  const totalWeight = 100;

  const sigBy = new Map(r.intermediates.extractedSignals.map((s) => [s.signalId, s] as const));
  const pwBy = new Map(r.intermediates.activatedPathways.map((p) => [p.pathwayId, p] as const));

  // (50) Signal assertions
  const sigSlice = 50 / Math.max(1, c.expectedSignals.length);
  for (const e of c.expectedSignals) {
    const got = sigBy.get(e.signalId);
    if (!got) {
      findings.push(finding(
        "SIGNAL_MISSING", "major", "SIGNAL_FAILURE",
        e, null,
        `Expected signal "${e.signalId}" not extracted.`,
        e.signalId, "MISSING"
      ));
      lost += sigSlice;
      continue;
    }
    if (got.confidence + 1e-9 < e.minConfidence) {
      findings.push(finding(
        "SIGNAL_CONFIDENCE_LOW", "minor", "SIGNAL_FAILURE",
        e, got,
        `Signal "${e.signalId}" confidence ${got.confidence} below ${e.minConfidence}.`,
        e.signalId, "BELOW_MIN"
      ));
      lost += sigSlice * 0.5;
    }
    if (e.mustBePrimary && !got.primary) {
      findings.push(finding(
        "SIGNAL_NOT_PRIMARY", "minor", "SIGNAL_FAILURE",
        { ...e, mustBePrimary: true }, got,
        `Signal "${e.signalId}" expected to be primary but was not.`,
        e.signalId, "NOT_PRIMARY"
      ));
      lost += sigSlice * 0.25;
    }
  }

  // (50) Pathway assertions
  const pwSlice = 50 / Math.max(1, c.expectedPathways.length);
  for (const e of c.expectedPathways) {
    const got = pwBy.get(e.pathwayId);
    if (!got || got.activation + 1e-9 < e.minActivation) {
      const sev = e.role === "leading" && (e.minActivation - (got?.activation ?? 0)) > 0.15 ? "critical" : "major";
      findings.push(finding(
        "PATHWAY_ACTIVATION_BELOW_MIN", sev, "PATHWAY_FAILURE",
        e, got ?? null,
        `Pathway "${e.pathwayId}" activation ${got?.activation ?? 0} below ${e.minActivation}.`,
        e.pathwayId, "BELOW_MIN"
      ));
      lost += pwSlice;
    }
  }

  const score = scoreOf(totalWeight, lost);
  return { pass: !anyCritical(findings) && score >= 70, score, findings };
}
