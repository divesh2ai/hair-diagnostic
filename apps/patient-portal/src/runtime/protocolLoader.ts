import { Question, Concern } from '@/types/questionnaire';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
import { skinAcneProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/skinAcneProtocol';
import { verticalForConcern, type Vertical } from '@/lib/verticals';
import { adaptProtocol } from './protocolAdapter';

export type ProtocolSource = 'default' | 'fixture' | 'remote';

/**
 * Skin FACT concerns that have their OWN runtime questionnaire protocol today.
 * Pigmentation and anti-ageing are collected through bespoke Skin FACT
 * components, not an engine protocol, so they are deliberately absent.
 */
const SKIN_CONCERNS_WITH_PROTOCOL = new Set<string>(['skin_acne']);

/**
 * Raised when a concern has no runtime questionnaire protocol — today, any
 * Skin FACT concern other than `skin_acne`. Typed (not a bare `Error`) so a
 * caller near the HairOS pipeline can tell "unsupported vertical" apart from a
 * genuine engine crash and route the case to its own surface instead of 500-ing.
 */
export class UnsupportedProtocolError extends Error {
  readonly concern: string;
  readonly vertical: Vertical;
  constructor(concern: string) {
    const vertical = verticalForConcern(concern);
    super(`No runtime protocol for concern "${concern}" (vertical: ${vertical})`);
    this.name = 'UnsupportedProtocolError';
    this.concern = concern;
    this.vertical = vertical;
  }
}

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

  // Vertical boundary. A Skin FACT concern must NEVER fall through to the
  // HairOS hair protocol — only a skin concern with its own protocol loads;
  // every other skin concern (pigmentation, anti-ageing, or a skin_* track
  // added tomorrow) is explicitly unsupported, never silently sent the hair
  // questionnaire by omission. Classifying by vertical rather than enumerating
  // each skin concern is what closes that omission gap.
  if (verticalForConcern(concern) === 'SKIN_FACT') {
    if (!SKIN_CONCERNS_WITH_PROTOCOL.has(concern)) {
      throw new UnsupportedProtocolError(concern);
    }
    const skinQuestions = adaptProtocol(skinAcneProtocol);
    _cache.set(concern, skinQuestions);
    return skinQuestions;
  }

  // HairOS vertical (hair, and any legacy/non-skin value) → hair protocol.
  const questions = adaptProtocol(masterProtocol);
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
