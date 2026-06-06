import type {
  TherapyNeed,
  TherapyKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  DiagnosisKey,
  TherapyCategory,
} from '../types';
import { loadTherapies } from '../loaders/loadTherapies';

const SOURCE = 'knowledge-engine/kb/therapies';

function timestamp(): string {
  return new Date().toISOString();
}

export function getTherapyKnowledge(
  therapyNeed: TherapyNeed
): KnowledgeRetrievalResult<TherapyKnowledge> {
  const registry = loadTherapies();
  const entry = registry[therapyNeed] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getTherapiesForCondition(
  diagnosisKey: DiagnosisKey
): MultiKnowledgeRetrievalResult<TherapyKnowledge> {
  const registry = loadTherapies();
  const results = Object.values(registry).filter(
    (entry): entry is TherapyKnowledge =>
      entry !== undefined && entry.targetConditions.includes(diagnosisKey)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getTherapiesByCategory(
  category: TherapyCategory
): MultiKnowledgeRetrievalResult<TherapyKnowledge> {
  const registry = loadTherapies();
  const results = Object.values(registry).filter(
    (entry): entry is TherapyKnowledge =>
      entry !== undefined && entry.category === category
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns all therapy knowledge entries for a list of TherapyNeeds.
 * Used when mapping an entire TherapyNeeds profile to knowledge objects.
 */
export function getTherapyKnowledgeForNeeds(
  needs: readonly TherapyNeed[]
): MultiKnowledgeRetrievalResult<TherapyKnowledge> {
  const registry = loadTherapies();
  const results: TherapyKnowledge[] = [];
  for (const need of needs) {
    const entry = registry[need];
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
