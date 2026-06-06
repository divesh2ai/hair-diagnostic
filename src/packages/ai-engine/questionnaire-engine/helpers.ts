import type {
  Question,
  PatientAnswers,
  SkipLogic
} from './types';

// ─────────────────────────────────────────────────────────────
// UNIQUE STRINGS
// ─────────────────────────────────────────────────────────────

export function uniqueStrings(
  arr: string[]
): string[] {

  return [...new Set(arr)];
}

// ─────────────────────────────────────────────────────────────
// GET ANSWER VALUE
// ─────────────────────────────────────────────────────────────

export function getAnswerValue(
  answers: PatientAnswers,
  key: string
): any {

  return answers[key];
}

// ─────────────────────────────────────────────────────────────
// EVALUATE CONDITION
// ─────────────────────────────────────────────────────────────

function evaluateCondition(
  actual: any,
  operator: string,
  expected: any
): boolean {

  switch (operator) {

    case 'equals':
      return actual === expected;

    case 'not_equals':
      return actual !== expected;

    case 'includes':
      return Array.isArray(actual)
        ? actual.includes(expected)
        : false;

    case 'not_includes':
      return Array.isArray(actual)
        ? !actual.includes(expected)
        : true;

    case 'exists':
      return actual !== undefined &&
             actual !== null;

    case 'gt':
      return Number(actual) > Number(expected);

    case 'gte':
      return Number(actual) >= Number(expected);

    case 'lt':
      return Number(actual) < Number(expected);

    case 'lte':
      return Number(actual) <= Number(expected);

    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY SKIP LOGIC
// ─────────────────────────────────────────────────────────────

export function applySkipLogic(
  question: Question,
  answers: PatientAnswers
): boolean {

  if (!question.skipLogic?.length) {
    return true;
  }

  return question.skipLogic.every(
    (rule: SkipLogic) => {

      const actual =
        getAnswerValue(
          answers,
          rule.dependsOn
        );

      return evaluateCondition(
        actual,
        rule.operator,
        rule.value
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────
// SHOULD SHOW QUESTION
// ─────────────────────────────────────────────────────────────

export function shouldShowQuestion(
  question: Question,
  answers: PatientAnswers
): boolean {

  return applySkipLogic(
    question,
    answers
  );
}

// ─────────────────────────────────────────────────────────────
// APPLY VISIBILITY RULES
// ─────────────────────────────────────────────────────────────

export function applyVisibilityRules(
  questions: Question[],
  answers: PatientAnswers
): Question[] {

  return questions.filter((q) =>
    shouldShowQuestion(q, answers)
  );
}