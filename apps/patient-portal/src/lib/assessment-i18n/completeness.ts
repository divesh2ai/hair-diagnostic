/**
 * Translation completeness checks.
 *
 * Two independent surfaces:
 *   - chrome  : dictionary key parity (en vs a target locale)
 *   - content : protocol coverage (every live question + option has a label)
 *
 * Content coverage is the one that matters clinically: an option with no Hindi
 * label falls back to English mid-screen, which reads as a bug to the patient.
 * `tests/localisation/assessment-hi.test.ts` runs both against the real
 * protocol so a question-bank edit fails CI instead of shipping mixed-language
 * screens.
 */

import type { Question } from '@/types/questionnaire';

import type { AssessmentContentPack, AssessmentDictionary } from './types';

export interface CompletenessReport {
  complete: boolean;
  missing: string[];
  /** Keys present in the pack but absent from the protocol — stale entries. */
  orphaned: string[];
  counts: {
    expected: number;
    translated: number;
  };
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * Compare chrome dictionaries key-for-key. `AssessmentDictionary` already makes
 * this a compile-time guarantee; this runtime check catches a dictionary widened
 * via `as` or loaded from outside the type system.
 */
export function validateLocaleCompleteness(
  master: AssessmentDictionary,
  candidate: AssessmentDictionary,
): CompletenessReport {
  const masterKeys = flattenKeys(master);
  const candidateKeys = new Set(flattenKeys(candidate));

  const missing = masterKeys.filter((key) => !candidateKeys.has(key));
  const orphaned = [...candidateKeys].filter((key) => !masterKeys.includes(key));

  return {
    complete: missing.length === 0,
    missing,
    orphaned,
    counts: {
      expected: masterKeys.length,
      translated: masterKeys.length - missing.length,
    },
  };
}

/**
 * Verify a content pack covers every question, option and section in a live
 * protocol.
 *
 * `protocol` must be the adapted `Question[]` the renderer actually consumes,
 * so the check runs against exactly the IDs the patient will see.
 */
export function validateContentCompleteness(
  protocol: Question[],
  pack: AssessmentContentPack,
): CompletenessReport {
  const missing: string[] = [];
  const expectedQuestionIds = new Set<string>();
  const expectedSectionIds = new Set<string>();
  let expected = 0;

  for (const question of protocol) {
    expectedQuestionIds.add(question.id);
    expected += 1;

    const content = pack.questions[question.id];
    if (!content) {
      missing.push(`question:${question.id}.title`);
      for (const option of question.options ?? []) {
        expected += 1;
        missing.push(`option:${question.id}.${option.id}`);
      }
    } else {
      if (!content.title) missing.push(`question:${question.id}.title`);
      for (const option of question.options ?? []) {
        expected += 1;
        if (!content.options?.[option.id]) {
          missing.push(`option:${question.id}.${option.id}`);
        }
      }
    }

    const sectionId = question.sectionId;
    if (sectionId && !expectedSectionIds.has(sectionId)) {
      expectedSectionIds.add(sectionId);
      expected += 1;
      if (!pack.sections[sectionId]) missing.push(`section:${sectionId}`);
    }
  }

  // Stale keys: renaming an option in the protocol leaves its Hindi entry
  // behind, which then silently stops being used.
  const orphaned: string[] = [];
  const optionIdsByQuestion = new Map(
    protocol.map((question) => [
      question.id,
      new Set((question.options ?? []).map((option) => option.id)),
    ]),
  );

  for (const [questionId, content] of Object.entries(pack.questions)) {
    if (!expectedQuestionIds.has(questionId)) {
      orphaned.push(`question:${questionId}`);
      continue;
    }
    const liveOptionIds = optionIdsByQuestion.get(questionId) ?? new Set<string>();
    for (const optionId of Object.keys(content.options ?? {})) {
      if (!liveOptionIds.has(optionId)) orphaned.push(`option:${questionId}.${optionId}`);
    }
  }

  for (const sectionId of Object.keys(pack.sections)) {
    if (!expectedSectionIds.has(sectionId)) orphaned.push(`section:${sectionId}`);
  }

  return {
    complete: missing.length === 0,
    missing,
    orphaned,
    counts: { expected, translated: expected - missing.length },
  };
}
