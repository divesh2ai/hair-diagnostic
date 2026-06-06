/**
 * Validates the diagnosis + cause-ranking layers.
 *
 * Combines the spec's diagnosis + root-cause validators into a single
 * "rootCause" validator (per the requested file layout). Covers:
 *
 *  - Primary cause id match
 *  - Legacy DiagnosisKey match (with alternates tolerance)
 *  - Secondary co-explanations coverage
 *  - Severity agreement
 *  - Expected rootCauses minPosterior + surface role
 *  - Dissent integrity for single-lead vs co-lead
 *  - Composite rule sanity for multifactorial leadership
 *  - Confidence floor based on lead posterior
 */

import { ClinicalReplayCase, ReplayResult, ValidatorOutcome } from "../types";
import { finding, scoreOf, anyCritical } from "./utils";

const MULTI_ID = "multifactorial-hair-loss";

export function validateRootCause(
  c: ClinicalReplayCase,
  r: ReplayResult
): ValidatorOutcome {
  const findings = [];
  const exp = c.expectedDiagnosis;
  const diag = r.diagnosisResult;
  const rc = r.rootCauseResult;
  let lost = 0;

  // (40) Primary cause id match
  if (diag.primary !== exp.primary) {
    const sev = c.presentationClarity === "clear" ? "critical" : "major";
    findings.push(finding(
      "DIAG_PRIMARY_MISMATCH", sev, "ROOTCAUSE_FAILURE",
      exp.primary, diag.primary,
      `Expected primary cause "${exp.primary}" but got "${diag.primary}".`,
      exp.primary, "WRONG_PRIMARY"
    ));
    lost += 40;
  }

  // (20) Legacy DiagnosisKey
  const okLegacy = diag.legacyDiagnosisKey === exp.legacyDiagnosisKey ||
                   (exp.legacyDiagnosisKeyAlternates ?? []).includes(diag.legacyDiagnosisKey);
  if (!okLegacy) {
    findings.push(finding(
      "DIAG_LEGACY_KEY_MISMATCH", "major", "ROOTCAUSE_FAILURE",
      exp.legacyDiagnosisKey, diag.legacyDiagnosisKey,
      `Expected legacy DiagnosisKey "${exp.legacyDiagnosisKey}" (or alternates) but got "${diag.legacyDiagnosisKey}".`,
      exp.legacyDiagnosisKey, "WRONG_LEGACY_KEY"
    ));
    lost += 20;
  }

  // (15) Secondary coverage
  const expSecondary = exp.secondary ?? [];
  const missing = expSecondary.filter((s) => !diag.coExplanations.includes(s));
  if (missing.length > 0) {
    findings.push(finding(
      "DIAG_SECONDARY_MISSING", "minor", "ROOTCAUSE_FAILURE",
      expSecondary, diag.coExplanations,
      `Missing expected co-explanations: ${missing.join(", ")}.`,
      missing[0] ?? "secondary", "MISSING"
    ));
    lost += Math.min(15, missing.length * 5);
  }

  // (15) Severity
  if (diag.severity !== c.expectedSeverity) {
    findings.push(finding(
      "DIAG_SEVERITY_MISMATCH", "minor", "ROOTCAUSE_FAILURE",
      c.expectedSeverity, diag.severity,
      `Expected severity "${c.expectedSeverity}" got "${diag.severity}".`,
      c.expectedSeverity, "WRONG_SEVERITY"
    ));
    lost += 15;
  }

  // (10) Confidence floor — top posterior should exceed minPosterior of lead expected
  const expLead = c.expectedRootCauses.find((e) => e.surfaceAs === "lead");
  if (expLead && diag.confidence + 1e-9 < Math.min(expLead.minPosterior * 0.7, 0.2)) {
    findings.push(finding(
      "DIAG_CONFIDENCE_LOW", "minor", "ROOTCAUSE_FAILURE",
      `≥ ${expLead.minPosterior}`, diag.confidence,
      `Lead posterior confidence ${diag.confidence} below floor.`,
      expLead.causeId, "CONFIDENCE_BELOW_MIN"
    ));
    lost += 10;
  }

  // Expected rootCauses surface checks
  for (const e of c.expectedRootCauses) {
    const got = rc.ranked.find((p) => p.causeId === e.causeId);
    if (!got || got.posterior + 1e-9 < e.minPosterior) {
      const sev = e.surfaceAs === "lead" && (e.minPosterior - (got?.posterior ?? 0)) > 0.10 ? "critical" : "minor";
      findings.push(finding(
        "CAUSE_POSTERIOR_BELOW_MIN", sev, "ROOTCAUSE_FAILURE",
        { causeId: e.causeId, min: e.minPosterior }, got ?? null,
        `Cause "${e.causeId}" posterior below minimum (${got?.posterior ?? 0} < ${e.minPosterior}).`,
        e.causeId, "BELOW_MIN"
      ));
      lost += sev === "critical" ? 20 : 5;
    }
  }

  // Dissent integrity: if any expected cause is single-lead, dissent must be ≥ 0.05
  const expHasSingleLead = c.expectedRootCauses.filter((e) => e.surfaceAs === "lead").length === 1
                           && c.expectedRootCauses.filter((e) => e.surfaceAs === "co-lead").length === 0;
  if (expHasSingleLead && rc.dissent < 0.05 && !rc.compositeRuleSatisfied) {
    findings.push(finding(
      "DISSENT_TOO_LOW_FOR_SINGLE_LEAD", "minor", "ROOTCAUSE_FAILURE",
      "≥ 0.05", rc.dissent,
      `Expected single-lead with dissent ≥ 0.05 but got ${rc.dissent}.`,
      diag.primary, "DISSENT_TOO_LOW"
    ));
    lost += 5;
  }

  // Composite rule sanity for multifactorial leadership
  if (diag.primary === MULTI_ID && !rc.compositeRuleSatisfied) {
    findings.push(finding(
      "COMPOSITE_RULE_UNSATISFIED", "critical", "ROOTCAUSE_FAILURE",
      "compositeRuleSatisfied=true", rc.compositeRuleSatisfied,
      "Multifactorial cause led without compositeRule being satisfied.",
      MULTI_ID, "COMPOSITE_VIOLATION"
    ));
    lost += 30;
  }

  const score = scoreOf(100, lost);
  return { pass: !anyCritical(findings) && score >= 70, score, findings };
}
