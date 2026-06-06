/**
 * mapConditionToKnowledge
 *
 * Maps a ClinicalProfile (from clinical-engine) to a rich knowledge bundle
 * comprising condition knowledge, therapy knowledge, prognosis, and lifestyle.
 * Used by the narrative engine and report generation layer.
 */

import type { DiagnosisKey, Severity } from '../types';
import type { ConditionKnowledge } from '../types';
import type { TherapyKnowledge } from '../types';
import type { PrognosisKnowledge } from '../types';
import type { LifestyleGuidanceKnowledge } from '../types';

import { getConditionKnowledge } from '../retrievers/getConditionKnowledge';
import { getTherapyKnowledgeForNeeds } from '../retrievers/getTherapyKnowledge';
import { getPrognosisWithFallback } from '../retrievers/getPrognosisKnowledge';
import { getLifestyleForDiagnosis } from '../retrievers/getLifestyleKnowledge';

export interface ConditionKnowledgeBundle {
  readonly condition: ConditionKnowledge | null;
  readonly therapies: readonly TherapyKnowledge[];
  readonly prognosis: PrognosisKnowledge | null;
  readonly lifestyle: readonly LifestyleGuidanceKnowledge[];
  readonly diagnosisKey: DiagnosisKey;
  readonly severity: Severity;
  readonly isComplete: boolean;
}

/**
 * Builds a complete knowledge bundle for a diagnosis at a given severity.
 * `isComplete` is true when all four knowledge domains returned a result.
 */
export function mapConditionToKnowledge(
  diagnosisKey: DiagnosisKey,
  severity: Severity
): ConditionKnowledgeBundle {
  const conditionResult = getConditionKnowledge(diagnosisKey);
  const condition = conditionResult.data;

  const therapyNeeds = condition?.recommendedTherapies ?? [];
  const therapyResult = getTherapyKnowledgeForNeeds(therapyNeeds);

  const prognosisResult = getPrognosisWithFallback(diagnosisKey, severity);

  const lifestyleResult = getLifestyleForDiagnosis(diagnosisKey);

  return {
    condition,
    therapies: therapyResult.results,
    prognosis: prognosisResult.data,
    lifestyle: lifestyleResult.results,
    diagnosisKey,
    severity,
    isComplete:
      condition !== null &&
      therapyResult.count > 0 &&
      prognosisResult.found &&
      lifestyleResult.count > 0,
  };
}
