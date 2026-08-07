import { Question, Concern } from '@/types/questionnaire';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import { skinAcneProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/skinAcneProtocol';
import { adaptProtocol } from './protocolAdapter';

export type ProtocolSource = 'default' | 'fixture' | 'remote';

export interface ProtocolLoadResult {
  questions: Question[];
  source: ProtocolSource;
  version: string;
  loadedAt: number;
}

const PROTOCOL_VERSION = masterProtocol.schemaVersion ?? '1.0.0';

/**
 * Per-concern adapted-protocol cache. Adapting is pure and idempotent, so a
 * one-shot memoisation keyed by concern gives zero-cost repeat access without
 * risking cross-request state.
 */
const _cache = new Map<Concern, Question[]>();

function adaptFor(concern: Concern): Question[] {
  const cached = _cache.get(concern);
  if (cached) return cached;

  let questions: Question[];
  switch (concern) {
    case 'skin_acne':
      questions = adaptProtocol(skinAcneProtocol);
      break;
    case 'skin_pigmentation':
    case 'skin_anti_ageing':
      // Not implemented yet — surface an explicit error rather than a silent
      // fallback so accidental wiring doesn't send a hair questionnaire to a
      // skin patient.
      throw new Error(`Protocol for concern "${concern}" is not implemented yet`);
    case 'hair':
    default:
      questions = adaptProtocol(masterProtocol);
      break;
  }
  _cache.set(concern, questions);
  return questions;
}

export function loadProtocol(
  source: ProtocolSource = 'default',
  fixture?: Question[],
  concern: Concern = 'hair'
): ProtocolLoadResult {
  switch (source) {
    case 'fixture':
      if (!fixture || fixture.length === 0) {
        throw new Error('ProtocolLoader: fixture source requires a non-empty question array');
      }
      return { questions: fixture, source, version: PROTOCOL_VERSION, loadedAt: Date.now() };

    case 'default':
    default:
      return {
        questions: adaptFor(concern),
        source: 'default',
        version: PROTOCOL_VERSION,
        loadedAt: Date.now(),
      };
  }
}

/** Backwards-compatible: returns the hair protocol (the pre-skin default). */
export function getDefaultProtocol(): Question[] {
  return adaptFor('hair');
}

/** Returns the runtime-adapted question set for a given concern. */
export function getProtocolForConcern(concern: Concern): Question[] {
  return adaptFor(concern);
}
