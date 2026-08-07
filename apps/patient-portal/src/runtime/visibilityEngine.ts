import { Question, QuestionOption, LogicCondition } from '@/types/questionnaire';

/**
 * Evaluate a single LogicCondition against the current answers.
 *
 * Operator semantics:
 *   equals        — strict equality
 *   not_equals    — strict inequality
 *   contains      — array: exact membership (or any-of-array membership if value is string[])
 *                   string: substring match
 *   not_contains  — inverse of contains
 *   greater_than  — numeric comparison
 *   less_than     — numeric comparison
 */
export function evaluateCondition(
  condition: LogicCondition,
  answers: Record<string, any>
): boolean {
  const answer = answers[condition.field];
  if (answer === undefined || answer === null) return false;

  switch (condition.operator) {
    case 'equals':
      return answer === condition.value;

    case 'not_equals':
      return answer !== condition.value;

    case 'contains':
      return _contains(answer, condition.value);

    case 'not_contains':
      return !_contains(answer, condition.value);

    case 'greater_than':
      return Number(answer) > Number(condition.value);

    case 'less_than':
      return Number(answer) < Number(condition.value);

    default:
      return false;
  }
}

/** Core "contains" logic shared by contains and not_contains operators. */
function _contains(answer: any, condValue: any): boolean {
  const lookupValues: any[] = Array.isArray(condValue) ? condValue : [condValue];

  if (Array.isArray(answer)) {
    // Array answer: check if the answer array includes any of the lookup values (exact match)
    return lookupValues.some(v => answer.includes(v));
  }

  if (typeof answer === 'string') {
    // String answer: substring match for any of the lookup values
    return lookupValues.some(v => typeof v === 'string' && answer.includes(v));
  }

  return false;
}

export function evaluateAllConditions(
  conditions: LogicCondition[],
  answers: Record<string, any>,
  mode: 'any' | 'all' = 'any'
): boolean {
  if (!conditions || conditions.length === 0) return false;
  return mode === 'any'
    ? conditions.some(c => evaluateCondition(c, answers))
    : conditions.every(c => evaluateCondition(c, answers));
}

export function isQuestionVisible(question: Question, answers: Record<string, any>): boolean {
  if (question.showIf) {
    const answer = answers[question.showIf.questionId];
    if (answer === undefined || answer === null) return false;
    const expected = Array.isArray(question.showIf.value)
      ? question.showIf.value
      : [question.showIf.value];
    const matches = Array.isArray(answer)
      ? expected.some((value) => answer.includes(value))
      : expected.includes(answer);
    if (!matches) return false;
  }
  if (!question.skipIf || question.skipIf.length === 0) return true;
  return !evaluateAllConditions(question.skipIf, answers, 'any');
}

export function getVisibleQuestions(
  protocol: Question[],
  answers: Record<string, any>
): Question[] {
  return protocol.filter(q => isQuestionVisible(q, answers));
}

export function getVisibleQuestionIds(
  protocol: Question[],
  answers: Record<string, any>
): string[] {
  return getVisibleQuestions(protocol, answers).map(q => q.id);
}

export function getVisibleOptions(
  question: Question,
  answers: Record<string, any>
): QuestionOption[] {
  if (!question.options) return [];
  if (!question.filterOptions || question.filterOptions.length === 0) return question.options;

  return question.options.filter(option => {
    // An option may be gated by more than one source — e.g. a question-level
    // dynamicFilterRule AND an option-level visibleOnlyIf. Treat every
    // matching entry as an independent reason to hide, so any one firing is
    // sufficient.
    const matchingRules = question.filterOptions!.filter(f => f.optionId === option.id);
    if (matchingRules.length === 0) return true;
    const shouldHide = matchingRules.some(rule =>
      evaluateAllConditions(rule.hideIf, answers, 'any')
    );
    return !shouldHide;
  });
}
