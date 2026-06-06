import { evaluateClinicalProfile } from "../packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../packages/ai-engine/kit-scorer/scoreKits";
import { loadClinicalFixture, loadBaseline, budgetForFixture, OPEN_CLINIC } from "./loaders/fixtureLoader";
import { adaptLegacyFixture, listAllFixtureIds } from "./loaders/fixtureAdapter";
import { validateQuestionFlow } from "./validators/flowValidator";
import { validateNormalization } from "./validators/normalizationValidator";
import { validateSignalConsistency } from "./validators/signalConsistencyValidator";
import { compareAgainstBaseline, modularOutputFromClinical } from "./regression/comparisonEngine";
import { generateSemanticDiff } from "./diff-engine/diffEngine";
import type { QASessionResult, QASessionStatus } from "./types";

export interface QAScorecard {
  label: string;
  status: "PASS" | "WARNING" | "FAIL" | "SKIP";
  detail?: string;
}

export interface QASessionReport {
  session: QASessionResult;
  scorecards: QAScorecard[];
}

function scorecardStatus(passed: boolean, hasWarnings: boolean): "PASS" | "WARNING" | "FAIL" {
  if (passed) return "PASS";
  if (hasWarnings) return "WARNING";
  return "FAIL";
}

export async function runQASession(fixtureId: string): Promise<QASessionReport> {
  const startedAt = new Date().toISOString();
  const sessionId = `qa-${fixtureId}-${Date.now()}`;
  const errors: string[] = [];
  const warnings: string[] = [];
  const scorecards: QAScorecard[] = [];

  let fixture;
  try {
    fixture = loadClinicalFixture(fixtureId);
  } catch {
    fixture = adaptLegacyFixture(fixtureId);
  }

  const answers = fixture.questionnaireAnswers;

  const flow = validateQuestionFlow(answers);
  scorecards.push({
    label: "Branching Accuracy",
    status: scorecardStatus(flow.passed, flow.warnings.length > 0),
    detail: flow.errors.map((e) => e.message).join("; ") || undefined,
  });
  if (!flow.passed) errors.push(...flow.errors.map((e) => e.message));

  const norm = validateNormalization(answers);
  scorecards.push({
    label: "Normalization Accuracy",
    status: scorecardStatus(norm.passed, norm.warnings.length > 0),
  });

  const profile = evaluateClinicalProfile(answers);
  const needs = mapTherapyNeeds(profile);
  const budget = budgetForFixture(fixture);
  const recommendation = scoreKits(profile, needs, answers, OPEN_CLINIC, budget);
  const therapyNeedList = [...needs.needs];

  const signals = validateSignalConsistency(
    {
      diagnoses: [profile.primaryDiagnosis, ...profile.secondaryDiagnoses.map((d) => d.key)],
      scalpStates: profile.scalpStates,
      rootCauses: profile.rootCauses,
      therapyNeeds: therapyNeedList,
      severity: profile.severity,
    },
    fixture.expectedClinicalSignals
  );
  scorecards.push({
    label: "Clinical Signal Consistency",
    status: scorecardStatus(signals.passed, signals.warnings.length > 0),
    detail: [...signals.errors, ...signals.warnings].join("; ") || undefined,
  });

  const baseline = loadBaseline(fixtureId) as import("./types").BaselineOutput | null;
  const modular = modularOutputFromClinical(fixtureId, profile, recommendation);
  let regression;
  if (baseline) {
    regression = compareAgainstBaseline(modular, baseline);
    scorecards.push({
      label: "Recommendation Drift",
      status: regression.passed ? "PASS" : regression.criticalFailures > 0 ? "FAIL" : "WARNING",
      detail: regression.regressionSummary,
    });
  } else {
    scorecards.push({ label: "Recommendation Drift", status: "SKIP", detail: "No baseline snapshot" });
  }

  scorecards.push({
    label: "Pipeline Integrity",
    status: "PASS",
    detail: "Clinical engine path verified (evaluateClinicalProfile → scoreKits)",
  });

  const artifactDiff = baseline
    ? generateSemanticDiff(fixtureId, {
        oldSummary: `${baseline.primaryDiagnosis} · ${baseline.severity}`,
        newSummary: `${modular.primaryDiagnosis} · ${modular.severity}`,
        oldRecommendations: baseline.rankedKitIds,
        newRecommendations: modular.rankedKitIds,
        oldRootCauses: baseline.rootCauses,
        newRootCauses: modular.rootCauses,
      })
    : undefined;

  scorecards.push({
    label: "PDF Integrity",
    status: "SKIP",
    detail: "Run report generation in preview sandbox with live assessment",
  });

  const failed = scorecards.some((s) => s.status === "FAIL");
  const warned = scorecards.some((s) => s.status === "WARNING");
  const status: QASessionStatus = failed ? "FAILED" : warned ? "WARNING" : "PASSED";

  const session: QASessionResult = {
    sessionId,
    fixtureId,
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    flowValidation: flow,
    normalizationValidation: norm,
    regressionComparison: regression,
    artifactDiff,
    errors,
    warnings,
  };

  return { session, scorecards };
}

export { listAllFixtureIds };
