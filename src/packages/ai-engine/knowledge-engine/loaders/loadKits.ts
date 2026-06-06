import type { KitKnowledgeRegistry } from '../types';
import { KITS_KB } from '../kb/kits/index';

let _cache: KitKnowledgeRegistry | null = null;

export function loadKits(): KitKnowledgeRegistry {
  if (_cache === null) {
    _cache = KITS_KB;
  }
  return _cache;
}

export function _resetKitsCache(): void {
  _cache = null;
}
