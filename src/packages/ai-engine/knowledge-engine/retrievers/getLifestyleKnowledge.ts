import type {
  LifestyleGuidanceKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  DiagnosisKey,
  RootCause,
  LifestyleCategory,
} from '../types';
import { loadLifestyle } from '../loaders/loadLifestyle';

const SOURCE = 'knowledge-engine/kb/lifestyle';

function timestamp(): string {
  return new Date().toISOString();
}

export function getLifestyleKnowledge(
  guidanceId: string
): KnowledgeRetrievalResult<LifestyleGuidanceKnowledge> {
  const registry = loadLifestyle();
  const entry = registry[guidanceId] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getLifestyleForDiagnosis(
  diagnosisKey: DiagnosisKey
): MultiKnowledgeRetrievalResult<LifestyleGuidanceKnowledge> {
  const registry = loadLifestyle();
  const results = Object.values(registry).filter((entry) =>
    entry.relevantConditions.includes(diagnosisKey)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getLifestyleForRootCause(
  rootCause: RootCause
): MultiKnowledgeRetrievalResult<LifestyleGuidanceKnowledge> {
  const registry = loadLifestyle();
  const results = Object.values(registry).filter((entry) =>
    entry.relevantRootCauses.includes(rootCause)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getLifestyleByCategory(
  category: LifestyleCategory
): MultiKnowledgeRetrievalResult<LifestyleGuidanceKnowledge> {
  const registry = loadLifestyle();
  const results = Object.values(registry).filter(
    (entry) => entry.category === category
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns all HIGH-priority recommendations across all relevant lifestyle entries
 * for a given diagnosis. Useful for patient-facing summary reports.
 */
export function getHighPriorityLifestyleRecommendations(
  diagnosisKey: DiagnosisKey
): ReadonlyArray<{ category: LifestyleCategory; action: string; rationale: string }> {
  const result = getLifestyleForDiagnosis(diagnosisKey);
  return result.results.flatMap((entry) =>
    entry.recommendations
      .filter((rec) => rec.priority === 'HIGH')
      .map((rec) => ({
        category: entry.category,
        action: rec.action,
        rationale: rec.rationale,
      }))
  );
}
