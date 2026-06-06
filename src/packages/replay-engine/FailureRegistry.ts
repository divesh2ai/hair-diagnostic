/**
 * FailureRegistry — collects, aggregates and queries findings produced
 * by the ValidationEngine.
 *
 * Persistence is the caller's responsibility (ReplayReportBuilder
 * writes the JSON). This class is the in-memory aggregate.
 */

import {
  CaseValidation,
  FailureComponent,
  FailureSeverity,
  Finding,
} from "./types";

export interface FailureEntry {
  replayId: string;
  caseId: string;
  component: FailureComponent;
  expected: unknown;
  actual: unknown;
  severity: FailureSeverity;
  rootCauseAnalysis: string;
  remediation: string;
  patternKey: string;
}

export class FailureRegistry {
  private readonly entries: FailureEntry[] = [];

  constructor(public readonly replayId: string, public readonly corpusVersion: string) {}

  ingest(validations: CaseValidation[]): void {
    for (const v of validations) {
      for (const f of this.flat(v)) {
        // Skip "info" — registry holds minor+ only.
        if (f.severity === "info") continue;
        this.entries.push({
          replayId: this.replayId,
          caseId: v.caseId,
          component: f.component,
          expected: f.expected,
          actual: f.actual,
          severity: f.severity,
          rootCauseAnalysis: f.message,
          remediation: this.suggestRemediation(f),
          patternKey: f.patternKey,
        });
      }
    }
  }

  private flat(v: CaseValidation): Finding[] {
    return [v.rootCause, v.pathway, v.treatment, v.narrative, v.governance].flatMap((o) => o.findings);
  }

  private suggestRemediation(f: Finding): string {
    switch (f.code) {
      case "DIAG_PRIMARY_MISMATCH":
        return "Audit cause-ranker LLR weights for the affected cause; verify pathway activation gates.";
      case "DIAG_LEGACY_KEY_MISMATCH":
        return "Update legacyKeyFor mapping in diagnosisSynth.ts to match cause registry parity strategy.";
      case "SIGNAL_MISSING":
        return "Add or fix questionnaire→signal rule in signalExtractor.ts for this answer pattern.";
      case "SIGNAL_CONFIDENCE_LOW":
        return "Raise rule-level confidence or increase corroborating signal weight.";
      case "PATHWAY_ACTIVATION_BELOW_MIN":
        return "Inspect supportingSignals weights or saturation denominator in pathwayActivator.ts.";
      case "MONITORING_REQUIRED_MISSING":
        return "Extend monitoringPlanner.ts switch for the protocol class to include this lab.";
      case "MONITORING_FORBIDDEN_PRESENT":
        return "Remove the over-broad add path that injected this lab; trace via patternKey.";
      case "NARRATIVE_THEME_MISSING":
        return "Update NARRATIVES table in narrativeComposer.ts to include the missing theme.";
      case "NARRATIVE_TOKEN_FORBIDDEN":
        return "CRITICAL: forbidden token leaked into framing — purge from NARRATIVES table immediately.";
      case "UNKNOWN_SIGNAL_ID":
      case "UNKNOWN_PATHWAY_ID":
      case "UNKNOWN_CAUSE_ID":
        return "Pipeline emitted an ID outside the registry — fix the emitter, do not extend the registry.";
      case "ADVERSARIAL_DRIVER_MISS":
        return "Adversarial gate — open triage with case fixture + intermediates; pipeline regression.";
      case "COMPOSITE_RULE_UNSATISFIED":
        return "Multifactorial leadership granted incorrectly; verify compositeRule evaluation in causeRanker.ts.";
      default:
        return "Triage via patternKey aggregation; cross-reference adjacent cases with same patternKey.";
    }
  }

  all(): FailureEntry[] { return [...this.entries]; }

  query(filter: {
    caseId?: string;
    component?: FailureComponent;
    severity?: FailureSeverity[];
    patternKey?: string;
  }): FailureEntry[] {
    return this.entries.filter((e) =>
      (!filter.caseId || e.caseId === filter.caseId) &&
      (!filter.component || e.component === filter.component) &&
      (!filter.severity || filter.severity.includes(e.severity)) &&
      (!filter.patternKey || e.patternKey === filter.patternKey)
    );
  }

  topPatterns(k = 10): Array<{ patternKey: string; count: number }> {
    const m = new Map<string, number>();
    for (const e of this.entries) m.set(e.patternKey, (m.get(e.patternKey) ?? 0) + 1);
    return [...m.entries()]
      .map(([patternKey, count]) => ({ patternKey, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, k);
  }

  /**
   * Patterns that recur in ≥ 5% of cases (rate ≥ 0.05) OR critical-severity
   * patterns recurring in ≥ 3 cases.
   */
  highRiskPatterns(corpusSize: number): Array<{ patternKey: string; count: number; rate: number }> {
    const counts = new Map<string, { count: number; anyCritical: boolean }>();
    for (const e of this.entries) {
      const cur = counts.get(e.patternKey) ?? { count: 0, anyCritical: false };
      cur.count += 1;
      if (e.severity === "critical") cur.anyCritical = true;
      counts.set(e.patternKey, cur);
    }
    return [...counts.entries()]
      .map(([patternKey, v]) => ({ patternKey, count: v.count, rate: v.count / Math.max(1, corpusSize), critical: v.anyCritical }))
      .filter((p) => p.rate >= 0.05 || (p.critical && p.count >= 3))
      .map(({ critical: _critical, ...rest }) => rest)
      .sort((a, b) => b.count - a.count);
  }

  criticalCount(): number { return this.entries.filter((e) => e.severity === "critical").length; }
  warningCount(): number { return this.entries.filter((e) => e.severity === "major" || e.severity === "minor").length; }
}
