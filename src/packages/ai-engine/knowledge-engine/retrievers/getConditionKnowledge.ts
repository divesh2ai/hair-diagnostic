import type {
  DiagnosisKey,
  ConditionKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  TherapyNeed,
  RootCause,
} from '../types';
import { loadConditions } from '../loaders/loadConditions';

const SOURCE = 'knowledge-engine/kb/conditions';

function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Retrieves clinical knowledge for a single diagnosis key.
 * Returns a typed result wrapper — always check `found` before using `data`.
 */
export function getConditionKnowledge(
  diagnosisKey: DiagnosisKey
): KnowledgeRetrievalResult<ConditionKnowledge> {
  const registry = loadConditions();
  const entry = registry[diagnosisKey] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Retrieves knowledge for multiple diagnosis keys in a single call.
 * Only returns entries that exist in the knowledge base.
 */
export function getMultipleConditionKnowledge(
  diagnosisKeys: readonly DiagnosisKey[]
): MultiKnowledgeRetrievalResult<ConditionKnowledge> {
  const registry = loadConditions();
  const results: ConditionKnowledge[] = [];
  for (const key of diagnosisKeys) {
    const entry = registry[key];
    if (entry !== undefined) {
      results.push(entry);
    }
  }
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns all condition knowledge entries that contain the given TherapyNeed
 * in their recommendedTherapies list.
 */
export function getConditionsByTherapyNeed(
  therapyNeed: TherapyNeed
): MultiKnowledgeRetrievalResult<ConditionKnowledge> {
  const registry = loadConditions();
  const results = Object.values(registry).filter(
    (entry): entry is ConditionKnowledge =>
      entry !== undefined && entry.recommendedTherapies.includes(therapyNeed)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns all condition knowledge entries that share the given root cause.
 */
export function getConditionsByRootCause(
  rootCause: RootCause
): MultiKnowledgeRetrievalResult<ConditionKnowledge> {
  const registry = loadConditions();
  const results = Object.values(registry).filter(
    (entry): entry is ConditionKnowledge =>
      entry !== undefined && entry.rootCauses.includes(rootCause)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns all condition knowledge entries that list the given condition
 * as a related condition.
 */
export function getRelatedConditions(
  diagnosisKey: DiagnosisKey
): MultiKnowledgeRetrievalResult<ConditionKnowledge> {
  const registry = loadConditions();
  const results = Object.values(registry).filter(
    (entry): entry is ConditionKnowledge =>
      entry !== undefined && entry.relatedConditions.includes(diagnosisKey)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}
