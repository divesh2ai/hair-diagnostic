import type {
  IngredientKnowledge,
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  TherapyNeed,
  IngredientCategory,
} from '../types';
import { loadIngredients } from '../loaders/loadIngredients';

const SOURCE = 'knowledge-engine/kb/ingredients';

function timestamp(): string {
  return new Date().toISOString();
}

export function getIngredientKnowledge(
  ingredientId: string
): KnowledgeRetrievalResult<IngredientKnowledge> {
  const registry = loadIngredients();
  const entry = registry[ingredientId] ?? null;
  return {
    found: entry !== null,
    data: entry,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getIngredientsByTherapyNeed(
  therapyNeed: TherapyNeed
): MultiKnowledgeRetrievalResult<IngredientKnowledge> {
  const registry = loadIngredients();
  const results = Object.values(registry).filter((entry) =>
    entry.targetedNeeds.includes(therapyNeed)
  );
  return {
    results,
    count: results.length,
    source: SOURCE,
    retrievedAt: timestamp(),
  };
}

export function getIngredientsByCategory(
  category: IngredientCategory
): MultiKnowledgeRetrievalResult<IngredientKnowledge> {
  const registry = loadIngredients();
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

export function getPregnancySafeIngredients(): MultiKnowledgeRetrievalResult<IngredientKnowledge> {
  const registry = loadIngredients();
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

/** Returns ingredient IDs that have a SYNERGISTIC interaction with the given ingredient. */
export function getSynergisticIngredients(ingredientId: string): readonly string[] {
  const registry = loadIngredients();
  const entry = registry[ingredientId];
  if (entry === undefined) return [];
  return entry.interactions
    .filter((i) => i.type === 'SYNERGISTIC')
    .map((i) => i.ingredient);
}
