import type { PrognosisKnowledgeRegistry } from '../types';
import { PROGNOSIS_KB } from '../kb/prognosis/index';

let _cache: PrognosisKnowledgeRegistry | null = null;

export function loadPrognosis(): PrognosisKnowledgeRegistry {
  if (_cache === null) {
    _cache = PROGNOSIS_KB;
  }
  return _cache;
}

export function _resetPrognosisCache(): void {
  _cache = null;
}
