import type { TopicalKnowledgeRegistry } from '../types';
import { TOPICALS_KB } from '../kb/topicals/index';

let _cache: TopicalKnowledgeRegistry | null = null;

export function loadTopicals(): TopicalKnowledgeRegistry {
  if (_cache === null) {
    _cache = TOPICALS_KB;
  }
  return _cache;
}

export function _resetTopicalsCache(): void {
  _cache = null;
}
