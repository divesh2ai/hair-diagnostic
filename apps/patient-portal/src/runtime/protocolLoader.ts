import { Question } from '@/types/questionnaire';
import { masterProtocol } from '@hairos/packages/ai-engine/questionnaire-engine/protocol/masterProtocol';
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
 * The canonical runtime protocol, adapted from the DrFACT master schema.
 * Computed once at module load — zero cost on repeated access.
 */
let _defaultProtocol: Question[] | null = null;

function getAdaptedProtocol(): Question[] {
  if (!_defaultProtocol) {
    _defaultProtocol = adaptProtocol(masterProtocol);
  }
  return _defaultProtocol;
}

export function loadProtocol(
  source: ProtocolSource = 'default',
  fixture?: Question[]
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
        questions: getAdaptedProtocol(),
        source: 'default',
        version: PROTOCOL_VERSION,
        loadedAt: Date.now(),
      };
  }
}

export function getDefaultProtocol(): Question[] {
  return getAdaptedProtocol();
}
