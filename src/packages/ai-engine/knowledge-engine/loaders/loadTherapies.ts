import type { TherapyKnowledgeRegistry } from '../types';
import { THERAPIES_KB } from '../kb/therapies/index';

let _cache: TherapyKnowledgeRegistry | null = null;

export function loadTherapies(): TherapyKnowledgeRegistry {
  if (_cache === null) {
    _cache = THERAPIES_KB;
  }
  return _cache;
}

export function _resetTherapiesCache(): void {
  _cache = null;
}
