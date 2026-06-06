import type { LifestyleKnowledgeRegistry } from '../types';
import { LIFESTYLE_KB } from '../kb/lifestyle/index';

let _cache: LifestyleKnowledgeRegistry | null = null;

export function loadLifestyle(): LifestyleKnowledgeRegistry {
  if (_cache === null) {
    _cache = LIFESTYLE_KB;
  }
  return _cache;
}

export function _resetLifestyleCache(): void {
  _cache = null;
}
