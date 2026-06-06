/**
 * mapDiagnosisToPrognosis
 *
 * Maps a diagnosis + severity to a structured prognosis narrative.
 * Returns both the raw PrognosisKnowledge and a pre-formatted summary
 * for use in PDF reports, doctor dashboard, and patient narratives.
 */

import type { DiagnosisKey, Severity, PrognosisKnowledge } from '../types';
import { getPrognosisWithFallback } from '../retrievers/getPrognosisKnowledge';

export interface ProgrammedPrognosisNarrative {
  readonly diagnosisKey: DiagnosisKey;
  readonly severity: Severity;
  readonly headline: string;
  readonly withTreatmentSummary: string;
  readonly withoutTreatmentSummary: string;
  readonly keySuccessFactors: readonly string[];
  readonly warningSignals: readonly string[];
  readonly referralCriteria: readonly string[];
  readonly raw: PrognosisKnowledge | null;
}

export function mapDiagnosisToPrognosis(
  diagnosisKey: DiagnosisKey,
  severity: Severity
): ProgrammedPrognosisNarrative {
  const result = getPrognosisWithFallback(diagnosisKey, severity);
  const raw = result.data;

  if (raw === null) {
    return {
      diagnosisKey,
      severity,
      headline: `Prognosis data not yet available for ${diagnosisKey} at ${severity} severity.`,
      withTreatmentSummary: '',
      withoutTreatmentSummary: '',
      keySuccessFactors: [],
      warningSignals: [],
      referralCriteria: [],
      raw: null,
    };
  }

  return {
    diagnosisKey,
    severity,
    headline: `${raw.displayName}: ${raw.baselineOutcome}`,
    withTreatmentSummary: raw.withOptimalTreatment,
    withoutTreatmentSummary: raw.withoutTreatment,
    keySuccessFactors: raw.keySuccessFactors,
    warningSignals: raw.warningSignals,
    referralCriteria: raw.referralCriteria,
    raw,
  };
}
