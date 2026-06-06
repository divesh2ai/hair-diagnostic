/**
 * mapKitToIngredients
 *
 * Resolves a kit's keyIngredients list into full IngredientKnowledge entries.
 */

import type { KitId, IngredientKnowledge } from '../types';
import { getKitKnowledge } from '../retrievers/getKitKnowledge';
import { getIngredientKnowledge } from '../retrievers/getIngredientKnowledge';

export interface KitIngredientMap {
  readonly kitId: KitId;
  readonly resolved: readonly IngredientKnowledge[];
  readonly unresolvedIds: readonly string[];
}

export function mapKitToIngredients(kitId: KitId): KitIngredientMap {
  const kitResult = getKitKnowledge(kitId);

  if (!kitResult.found || kitResult.data === null) {
    return { kitId, resolved: [], unresolvedIds: [] };
  }

  const resolved: IngredientKnowledge[] = [];
  const unresolvedIds: string[] = [];

  for (const ingredientId of kitResult.data.keyIngredients) {
    const result = getIngredientKnowledge(ingredientId);
    if (result.found && result.data !== null) {
      resolved.push(result.data);
    } else {
      unresolvedIds.push(ingredientId);
    }
  }

  return { kitId, resolved, unresolvedIds };
}
