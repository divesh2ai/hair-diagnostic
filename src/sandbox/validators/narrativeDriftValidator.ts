import type { ExpectedNarrativePatterns } from "../types";

export interface NarrativeDriftResult {
  passed: boolean;
  missingPhrases: string[];
  forbiddenFound: string[];
  warnings: string[];
}

export function validateNarrativeDrift(
  doctorNarrative: string,
  patientNarrative: string,
  expected: ExpectedNarrativePatterns
): NarrativeDriftResult {
  const missingPhrases: string[] = [];
  const forbiddenFound: string[] = [];
  const warnings: string[] = [];

  const combined = `${doctorNarrative}\n${patientNarrative}`.toLowerCase();

  for (const phrase of expected.doctorNarrativeMustContain ?? []) {
    if (!doctorNarrative.toLowerCase().includes(phrase.toLowerCase())) {
      missingPhrases.push(`[doctor] ${phrase}`);
    }
  }

  for (const phrase of expected.patientNarrativeMustContain ?? []) {
    if (!patientNarrative.toLowerCase().includes(phrase.toLowerCase())) {
      missingPhrases.push(`[patient] ${phrase}`);
    }
  }

  for (const forbidden of expected.mustNotContain ?? []) {
    if (combined.includes(forbidden.toLowerCase())) {
      forbiddenFound.push(forbidden);
    }
  }

  if (missingPhrases.length > 0) {
    warnings.push(`${missingPhrases.length} required narrative phrase(s) absent`);
  }

  return {
    passed: forbiddenFound.length === 0 && missingPhrases.length === 0,
    missingPhrases,
    forbiddenFound,
    warnings,
  };
}
