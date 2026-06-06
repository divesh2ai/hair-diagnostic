import { Question } from '@/types/questionnaire';
import { shouldSkip } from './skipEngine';

export interface ExtractedSignals {
  [signalKey: string]: any;
}

export function extractProtocolSignals(
  protocol: Question[],
  answers: Record<string, any>
): ExtractedSignals {
  const signals: ExtractedSignals = {};

  for (const question of protocol) {
    if (shouldSkip(question, answers)) continue;

    const answer = answers[question.id];
    if (answer === undefined || answer === null) continue;

    if (!question.clinicalMapping) continue;

    if (question.clinicalMapping.signal) {
      signals[question.clinicalMapping.signal] = answer;
    }

    if (question.clinicalMapping.protocolHints) {
      for (const hint of question.clinicalMapping.protocolHints) {
        signals[hint] = true;
      }
    }

    if (question.options && Array.isArray(answer)) {
      for (const selectedId of answer) {
        const opt = question.options.find(o => o.id === selectedId);
        if (opt?.clinicalTags) {
          for (const tag of opt.clinicalTags) {
            signals[tag] = true;
          }
        }
      }
    } else if (question.options && typeof answer === 'string') {
      const opt = question.options.find(o => o.id === answer);
      if (opt?.clinicalTags) {
        for (const tag of opt.clinicalTags) {
          signals[tag] = true;
        }
      }
    }
  }

  return signals;
}
