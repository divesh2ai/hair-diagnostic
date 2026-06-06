import type {
  KitId,
  KitKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  DiagnosisKey,
  TherapyNeed,
} from '../types';
import { loadKits } from '../loaders/loadKits';

const SOURCE = 'knowledge-engine/kb/kits';

function timestamp(): string {
  return new Date().toISOString();
}

export function getKitKnowledge(
  kitId: KitId
): KnowledgeRetrievalResult<KitKnowledge> {
  const registry = loadKits();
  const entry = registry[kitId] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getKitsByDiagnosis(
  diagnosisKey: DiagnosisKey
): MultiKnowledgeRetrievalResult<KitKnowledge> {
  const registry = loadKits();
  const results = Object.values(registry).filter(
    (entry): entry is KitKnowledge =>
      entry !== undefined && entry.targetDiagnoses.includes(diagnosisKey)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getKitsByTherapyNeed(
  therapyNeed: TherapyNeed
): MultiKnowledgeRetrievalResult<KitKnowledge> {
  const registry = loadKits();
  const results = Object.values(registry).filter(
    (entry): entry is KitKnowledge =>
      entry !== undefined && entry.targetTherapyNeeds.includes(therapyNeed)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getPregnancySafeKits(): MultiKnowledgeRetrievalResult<KitKnowledge> {
  const registry = loadKits();
  const results = Object.values(registry).filter(
    (entry): entry is KitKnowledge => entry !== undefined && entry.pregnancySafe === true
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}
