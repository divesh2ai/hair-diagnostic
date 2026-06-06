import type {
  TopicalKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  ScalpState,
  TherapyNeed,
} from '../types';
import { loadTopicals } from '../loaders/loadTopicals';

const SOURCE = 'knowledge-engine/kb/topicals';

function timestamp(): string {
  return new Date().toISOString();
}

export function getTopicalKnowledge(
  topicalId: string
): KnowledgeRetrievalResult<TopicalKnowledge> {
  const registry = loadTopicals();
  const entry = registry[topicalId] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getTopicalsByScalpState(
  scalpState: ScalpState
): MultiKnowledgeRetrievalResult<TopicalKnowledge> {
  const registry = loadTopicals();
  const results = Object.values(registry).filter((entry) =>
    entry.targetScalpStates.includes(scalpState)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getTopicalsByTherapyNeed(
  therapyNeed: TherapyNeed
): MultiKnowledgeRetrievalResult<TopicalKnowledge> {
  const registry = loadTopicals();
  const results = Object.values(registry).filter((entry) =>
    entry.targetTherapyNeeds.includes(therapyNeed)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getAntiInflammatoryTopicals(): MultiKnowledgeRetrievalResult<TopicalKnowledge> {
  const registry = loadTopicals();
  const results = Object.values(registry).filter(
    (entry) => entry.inflammationModulation.expectedEffect === 'REDUCES'
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getPregnancySafeTopicals(): MultiKnowledgeRetrievalResult<TopicalKnowledge> {
  const registry = loadTopicals();
  const results = Object.values(registry).filter(
    (entry) => entry.pregnancySafe === true
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

/**
 * Returns the scalp penetration explanation for a topical — used in PDF reports
 * and doctor dashboard explanations.
 */
export function getTopicalPenetrationExplanation(topicalId: string): string | null {
  const registry = loadTopicals();
  const entry = registry[topicalId];
  if (entry === undefined) return null;
  const p = entry.scalpPenetration;
  return (
    `${entry.displayName} penetrates to the ${p.depth.toLowerCase().replace('_', ' ')} level. ` +
    `Mechanism: ${p.mechanism} Onset of follicular contact: ${p.onset}.`
  );
}

/**
 * Returns the follicular targeting explanation for a topical — used in
 * avatar scripts and patient narrative engine.
 */
export function getFollicularTargetingExplanation(topicalId: string): string | null {
  const registry = loadTopicals();
  const entry = registry[topicalId];
  if (entry === undefined) return null;
  const ft = entry.follicularTargeting;
  return ft.targeted
    ? `${entry.displayName} is follicle-targeted (${ft.specificity} specificity, ${ft.phase} phase). ${ft.description}`
    : `${entry.displayName} acts at the scalp surface without direct follicular targeting.`;
}
