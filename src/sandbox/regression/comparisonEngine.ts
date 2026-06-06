// ─────────────────────────────────────────────────────────────────────────────
// Regression Comparison Engine
// Compares NEW modular pipeline output against OLD monolithic baseline.
// Detects recommendation drift, missing outputs, severity changes, and
// protocol degradation — the most critical safety check in the system.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BaselineOutput,
  RegressionComparisonResult,
  DriftItem,
  MissingOutputItem,
  DriftSeverity,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types for modular pipeline output (what we compare against)
// ─────────────────────────────────────────────────────────────────────────────

export interface ModularPipelineOutput {
  fixtureId: string;
  primaryDiagnosis: string;
  scalpStates: string[];
  rootCauses: string[];
  therapyNeeds: string[];
  severity: string;
  rankedKitIds: string[];
  appliedRules: string[];
  protocolLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main comparison engine
// ─────────────────────────────────────────────────────────────────────────────

export function compareAgainstBaseline(
  modular: ModularPipelineOutput,
  baseline: BaselineOutput
): RegressionComparisonResult {
  const drifts: DriftItem[] = [];
  const missingOutputs: MissingOutputItem[] = [];

  // 1. Primary diagnosis
  if (modular.primaryDiagnosis !== baseline.primaryDiagnosis) {
    drifts.push({
      field: "primaryDiagnosis",
      severity: "CRITICAL",
      oldValue: baseline.primaryDiagnosis,
      newValue: modular.primaryDiagnosis,
      description: `Primary diagnosis changed from "${baseline.primaryDiagnosis}" to "${modular.primaryDiagnosis}". This is a CRITICAL regression.`,
    });
  }

  // 2. Severity change
  if (modular.severity !== baseline.severity) {
    drifts.push({
      field: "severity",
      severity: "HIGH",
      oldValue: baseline.severity,
      newValue: modular.severity,
      description: `Severity changed from "${baseline.severity}" to "${modular.severity}". Clinical implications may differ.`,
    });
  }

  // 3. Protocol label
  if (modular.protocolLabel !== baseline.protocolLabel) {
    drifts.push({
      field: "protocolLabel",
      severity: "HIGH",
      oldValue: baseline.protocolLabel,
      newValue: modular.protocolLabel,
      description: `Protocol label changed from "${baseline.protocolLabel}" to "${modular.protocolLabel}".`,
    });
  }

  // 4. Ranked kit IDs — check for missing kits from baseline
  const missingKits = baseline.rankedKitIds.filter(
    (kitId) => !modular.rankedKitIds.includes(kitId)
  );
  const addedKits = modular.rankedKitIds.filter(
    (kitId) => !baseline.rankedKitIds.includes(kitId)
  );

  for (const kitId of missingKits) {
    missingOutputs.push({
      field: "rankedKitIds",
      expectedValue: kitId,
      description: `Kit "${kitId}" was present in baseline output but is MISSING from new modular output.`,
      severity: "CRITICAL",
    });
  }

  if (addedKits.length > 0) {
    drifts.push({
      field: "rankedKitIds (added)",
      severity: "MEDIUM",
      oldValue: baseline.rankedKitIds,
      newValue: modular.rankedKitIds,
      description: `New kits added that were not in baseline: [${addedKits.join(", ")}]. Verify these are intentional.`,
    });
  }

  // 5. Kit ordering (Phase 1 kit must remain stable — CRITICAL)
  const oldTopKit = baseline.rankedKitIds[0];
  const newTopKit = modular.rankedKitIds[0];
  if (oldTopKit && newTopKit && oldTopKit !== newTopKit) {
    drifts.push({
      field: "rankedKitIds[0] (Phase 1 kit)",
      severity: "CRITICAL",
      oldValue: oldTopKit,
      newValue: newTopKit,
      description: `Phase 1 kit changed from "${oldTopKit}" to "${newTopKit}". This is a CRITICAL ordering regression.`,
    });
  }

  // 6. Applied rules — check for missing rules from baseline
  const missingRules = baseline.appliedRules.filter(
    (rule) => !modular.appliedRules.some((r) => r.includes(rule) || rule.includes(r))
  );
  for (const rule of missingRules) {
    missingOutputs.push({
      field: "appliedRules",
      expectedValue: rule,
      description: `Rule "${rule}" fired in baseline but did NOT fire in new modular output.`,
      severity: "HIGH",
    });
  }

  // 7. Root causes — missing root causes
  const missingRootCauses = baseline.rootCauses.filter(
    (rc) => !modular.rootCauses.includes(rc)
  );
  for (const rc of missingRootCauses) {
    missingOutputs.push({
      field: "rootCauses",
      expectedValue: rc,
      description: `Root cause "${rc}" detected in baseline but MISSING from new modular output.`,
      severity: "HIGH",
    });
  }

  // 8. Therapy needs — missing therapy needs
  const missingNeeds = baseline.therapyNeeds.filter(
    (tn) => !modular.therapyNeeds.includes(tn)
  );
  for (const tn of missingNeeds) {
    missingOutputs.push({
      field: "therapyNeeds",
      expectedValue: tn,
      description: `Therapy need "${tn}" was in baseline but MISSING from new modular output.`,
      severity: "MEDIUM",
    });
  }

  // 9. Scalp states — missing scalp states
  const missingScalpStates = baseline.scalpStates.filter(
    (ss) => !modular.scalpStates.includes(ss)
  );
  for (const ss of missingScalpStates) {
    missingOutputs.push({
      field: "scalpStates",
      expectedValue: ss,
      description: `Scalp state "${ss}" was in baseline but MISSING from new modular output.`,
      severity: "MEDIUM",
    });
  }

  const criticalFailures = [
    ...drifts.filter((d) => d.severity === "CRITICAL"),
    ...missingOutputs.filter((m) => m.severity === "CRITICAL"),
  ].length;

  const totalDrifts = drifts.length + missingOutputs.length;

  const passed = criticalFailures === 0 && totalDrifts === 0;

  return {
    fixtureId: modular.fixtureId,
    passed,
    criticalFailures,
    totalDrifts,
    drifts,
    missingOutputs,
    regressionSummary: buildSummary(modular.fixtureId, passed, criticalFailures, totalDrifts, drifts, missingOutputs),
    comparedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch comparison — run all fixtures at once
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchRegressionResult {
  totalFixtures: number;
  passed: number;
  failed: number;
  criticalRegressions: number;
  results: RegressionComparisonResult[];
  generatedAt: string;
}

export function batchCompare(
  modularOutputs: ModularPipelineOutput[],
  baselines: Map<string, BaselineOutput>
): BatchRegressionResult {
  const results: RegressionComparisonResult[] = [];
  let passed = 0;
  let failed = 0;
  let criticalRegressions = 0;

  for (const modular of modularOutputs) {
    const baseline = baselines.get(modular.fixtureId);
    if (!baseline) {
      results.push({
        fixtureId: modular.fixtureId,
        passed: false,
        criticalFailures: 1,
        totalDrifts: 1,
        drifts: [],
        missingOutputs: [{
          field: "baseline",
          expectedValue: modular.fixtureId,
          description: `No baseline found for fixture "${modular.fixtureId}". Cannot compare.`,
          severity: "HIGH",
        }],
        regressionSummary: `SKIP: No baseline for "${modular.fixtureId}"`,
        comparedAt: new Date().toISOString(),
      });
      failed++;
      continue;
    }

    const result = compareAgainstBaseline(modular, baseline);
    results.push(result);
    if (result.passed) {
      passed++;
    } else {
      failed++;
      criticalRegressions += result.criticalFailures;
    }
  }

  return {
    totalFixtures: modularOutputs.length,
    passed,
    failed,
    criticalRegressions,
    results,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(
  fixtureId: string,
  passed: boolean,
  critical: number,
  total: number,
  drifts: DriftItem[],
  missing: MissingOutputItem[]
): string {
  if (passed) return `✓ PASS [${fixtureId}] No regressions detected.`;

  const lines: string[] = [`✗ FAIL [${fixtureId}] ${critical} critical / ${total} total regressions`];
  for (const d of drifts) lines.push(`  DRIFT [${d.severity}] ${d.field}: ${d.description}`);
  for (const m of missing) lines.push(`  MISSING [${m.severity}] ${m.field}: ${m.description}`);
  return lines.join("\n");
}

/**
 * Derive a baseline-compatible output from the existing clinical-engine pipeline
 * (for use when generating baselines for the first time).
 */
import type { ClinicalProfile } from "../../packages/ai-engine/clinical-engine/types";
import type { KitRecommendation } from "../../packages/ai-engine/kit-scorer/types";

export function modularOutputFromClinical(
  fixtureId: string,
  profile: ClinicalProfile,
  recommendation: KitRecommendation
): ModularPipelineOutput {
  return {
    fixtureId,
    primaryDiagnosis: profile.primaryDiagnosis,
    scalpStates: [...profile.scalpStates],
    rootCauses: [...profile.rootCauses],
    therapyNeeds: [],
    severity: profile.severity,
    rankedKitIds: recommendation.rankedKits.map((k) => k.kitId),
    appliedRules: [...recommendation.appliedRules],
    protocolLabel: recommendation.protocolLabel,
  };
}

export function buildBaselineFromPipelineOutput(
  fixtureId: string,
  pipelineOutput: {
    primaryDiagnosis: string;
    scalpStates: string[];
    rootCauses: string[];
    therapyNeeds: string[];
    severity: string;
    rankedKitIds: string[];
    appliedRules: string[];
    protocolLabel: string;
  }
): BaselineOutput {
  return {
    fixtureId,
    generatedAt: new Date().toISOString(),
    pipelineVersion: "1.0.0",
    ...pipelineOutput,
  };
}
