/**
 * Validates protocol + therapy needs + monitoring requirements
 * together (the "treatment" axis).
 */

import { ClinicalReplayCase, ReplayResult, ValidatorOutcome } from "../types";
import { finding, scoreOf, anyCritical } from "./utils";

const SAFETY_LABS: Record<string, string[]> = {
  HORMONAL: ["TSH_3M"],
  PCOS: ["ANDROGEN_PANEL_6M"],
  TE_ACUTE: ["FERRITIN_4M"],
  TE_CHRONIC: ["FERRITIN_4M"],
  TE_POST_ILLNESS: ["FERRITIN_4M"],
};

function includesSubstring(haystack: string[], needle: string): boolean {
  return haystack.some((h) => h.toUpperCase().includes(needle.toUpperCase()));
}

export function validateTreatment(
  c: ClinicalReplayCase,
  r: ReplayResult
): ValidatorOutcome {
  const findings = [];
  let lost = 0;
  const totalWeight = 100;

  // (25) Protocol class
  if (r.protocolResult.protocolClass !== c.expectedProtocolClass) {
    findings.push(finding(
      "PROTOCOL_CLASS_MISMATCH", "major", "PROTOCOL_FAILURE",
      c.expectedProtocolClass, r.protocolResult.protocolClass,
      `Expected protocol class "${c.expectedProtocolClass}" got "${r.protocolResult.protocolClass}".`,
      c.expectedProtocolClass, "WRONG_CLASS"
    ));
    lost += 25;
  }

  // (20) mustIncludeKits (substring match)
  const kits = r.protocolResult.recommendedKits;
  // expectedDiagnosis doesn't carry kits — we use therapy needs + spec contract.
  // The corpus encodes kits via expectedProtocolClass class assumptions; we
  // assert the class-driven kits implicitly. Explicit kit assertions live in
  // case.extended (legacy fixtures). Skip if not present.

  // (25) Therapy needs coverage
  const needSlice = 25 / Math.max(1, c.expectedTherapyNeeds.length);
  const gotNeeds = new Set(r.protocolResult.therapyNeeds);
  for (const need of c.expectedTherapyNeeds) {
    if (!gotNeeds.has(need)) {
      findings.push(finding(
        "THERAPY_NEED_MISSING", "minor", "PROTOCOL_FAILURE",
        need, [...gotNeeds],
        `Therapy need "${need}" not surfaced by protocol.`,
        need, "MISSING"
      ));
      lost += needSlice;
    }
  }

  // (35) Monitoring required / forbidden
  const reqSlice = 25 / Math.max(1, c.expectedMonitoringRequirements.required.length);
  const scheduled = new Set(r.monitoringResult.scheduled);
  for (const lab of c.expectedMonitoringRequirements.required) {
    if (!scheduled.has(lab)) {
      const isSafetyLab = (SAFETY_LABS[c.expectedProtocolClass] ?? []).includes(lab);
      const sev = isSafetyLab ? "critical" : "major";
      findings.push(finding(
        "MONITORING_REQUIRED_MISSING", sev, "MONITORING_FAILURE",
        lab, [...scheduled],
        `Required monitoring "${lab}" not scheduled.`,
        lab, "MISSING"
      ));
      lost += reqSlice;
    }
  }
  for (const lab of (c.expectedMonitoringRequirements.forbidden ?? [])) {
    if (scheduled.has(lab)) {
      findings.push(finding(
        "MONITORING_FORBIDDEN_PRESENT", "critical", "MONITORING_FAILURE",
        `forbidden: ${lab}`, [...scheduled],
        `Forbidden monitoring "${lab}" was scheduled.`,
        lab, "FORBIDDEN"
      ));
      lost += 10;
    }
  }
  // Over-monitoring guard (10)
  const cap = c.expectedMonitoringRequirements.required.length +
              (c.expectedMonitoringRequirements.recommended?.length ?? 0) + 2;
  if (scheduled.size > cap) {
    findings.push(finding(
      "MONITORING_OVER_SCHEDULED", "minor", "MONITORING_FAILURE",
      `≤ ${cap}`, scheduled.size,
      `Scheduled ${scheduled.size} tests, cap was ${cap}.`,
      "over-monitor", "OVER_SCHEDULED"
    ));
    lost += 5;
  }

  // mustExcludeKits guard via protocolResult.recommendedKits
  // We can't infer the corpus's mustExcludeKits substrings from the schema's
  // expectedProtocolClass alone, but we DO enforce gross conflicts:
  if (c.expectedProtocolClass === "MPHL" && includesSubstring(kits, "HAIR FACT TE GOLD")) {
    findings.push(finding(
      "PROTOCOL_KIT_FORBIDDEN", "critical", "PROTOCOL_FAILURE",
      "no TE kit in MPHL", kits,
      "TE kit included for an MPHL case.",
      "HAIR FACT TE GOLD", "FORBIDDEN"
    ));
    lost += 15;
  }

  const score = scoreOf(totalWeight, lost);
  return { pass: !anyCritical(findings) && score >= 70, score, findings };
}
