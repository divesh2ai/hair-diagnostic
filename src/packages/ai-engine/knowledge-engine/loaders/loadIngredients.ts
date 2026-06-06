import type { IngredientKnowledgeRegistry } from '../types';
import { INGREDIENTS_KB } from '../kb/ingredients/index';

let _cache: IngredientKnowledgeRegistry | null = null;

export function loadIngredients(): IngredientKnowledgeRegistry {
  if (_cache === null) {
    _cache = INGREDIENTS_KB;
  }
  return _cache;
}

export function _resetIngredientsCache(): void {
  _cache = null;
}
