import type { ExpectedClinicalSignals } from "../types";

export interface SignalConsistencyResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSignalConsistency(
  actual: {
    diagnoses: string[];
    scalpStates: string[];
    rootCauses: string[];
    therapyNeeds: string[];
    severity: string;
  },
  expected: ExpectedClinicalSignals
): SignalConsistencyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const d of expected.diagnoses) {
    if (!actual.diagnoses.includes(d)) {
      errors.push(`Missing expected diagnosis: ${d}`);
    }
  }

  for (const s of expected.scalpStates) {
    if (!actual.scalpStates.includes(s)) {
      warnings.push(`Expected scalp state not detected: ${s}`);
    }
  }

  for (const rc of expected.rootCauses) {
    if (!actual.rootCauses.includes(rc)) {
      warnings.push(`Expected root cause not detected: ${rc}`);
    }
  }

  if (actual.severity !== expected.severity) {
    errors.push(`Severity mismatch: expected ${expected.severity}, got ${actual.severity}`);
  }

  return { passed: errors.length === 0, errors, warnings };
}
