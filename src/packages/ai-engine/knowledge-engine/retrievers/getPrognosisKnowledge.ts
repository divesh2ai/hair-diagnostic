import type {
  DiagnosisKey,
  Severity,
  PrognosisKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
} from '../types';
import { loadPrognosis } from '../loaders/loadPrognosis';

const SOURCE = 'knowledge-engine/kb/prognosis';

function timestamp(): string {
  return new Date().toISOString();
}

export function getPrognosisKnowledge(
  diagnosisKey: DiagnosisKey,
  severity: Severity
): KnowledgeRetrievalResult<PrognosisKnowledge> {
  const registry = loadPrognosis();
  const bySeverity = registry[diagnosisKey];
  const entry = bySeverity?.[severity] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns all prognosis entries for a diagnosis key across all severities.
 */
export function getPrognosisForDiagnosis(
  diagnosisKey: DiagnosisKey
): MultiKnowledgeRetrievalResult<PrognosisKnowledge> {
  const registry = loadPrognosis();
  const bySeverity = registry[diagnosisKey];
  if (bySeverity === undefined) {
    return { results: [], count: 0, source: SOURCE, retrievedAt: timestamp() };
  }
  const results = Object.values(bySeverity).filter(
    (e): e is PrognosisKnowledge => e !== undefined
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Retrieves the closest available prognosis entry when an exact severity
 * match is not in the KB. Falls back in order: MODERATE → MILD → SEVERE.
 */
export function getPrognosisWithFallback(
  diagnosisKey: DiagnosisKey,
  severity: Severity
): KnowledgeRetrievalResult<PrognosisKnowledge> {
  const exact = getPrognosisKnowledge(diagnosisKey, severity);
  if (exact.found) return exact;

  const fallbackOrder: Severity[] = ['MODERATE', 'MILD', 'SEVERE'];
  for (const fallback of fallbackOrder) {
    if (fallback === severity) continue;
    const attempt = getPrognosisKnowledge(diagnosisKey, fallback);
    if (attempt.found) return attempt;
  }

  return { found: false, data: null, source: SOURCE, retrievedAt: timestamp() };
}
