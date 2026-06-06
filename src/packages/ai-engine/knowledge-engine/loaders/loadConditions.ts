import type { ConditionKnowledgeRegistry } from '../types';
import { CONDITIONS_KB } from '../kb/conditions/index';

let _cache: ConditionKnowledgeRegistry | null = null;

/**
 * Returns the conditions knowledge registry.
 * Result is memoised after first call — safe to call repeatedly.
 */
export function loadConditions(): ConditionKnowledgeRegistry {
  if (_cache === null) {
    _cache = CONDITIONS_KB;
  }
  return _cache;
}

/** Clears the memoise cache — intended for test isolation only. */
export function _resetConditionsCache(): void {
  _cache = null;
}
