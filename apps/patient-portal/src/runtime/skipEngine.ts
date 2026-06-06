import { Question } from '@/types/questionnaire';
import { isQuestionVisible } from './visibilityEngine';

export function shouldSkip(question: Question, answers: Record<string, any>): boolean {
  return !isQuestionVisible(question, answers);
}

export function getSkippedQuestions(
  protocol: Question[],
  answers: Record<string, any>
): Question[] {
  return protocol.filter(q => shouldSkip(q, answers));
}

export function getSkippedQuestionIds(
  protocol: Question[],
  answers: Record<string, any>
): string[] {
  return getSkippedQuestions(protocol, answers).map(q => q.id);
}

export interface SkipDecision {
  questionId: string;
  skipped: boolean;
  triggeredBy: string | null;
}

export function explainSkipDecisions(
  protocol: Question[],
  answers: Record<string, any>
): SkipDecision[] {
  return protocol.map(q => {
    if (!q.skipIf || q.skipIf.length === 0) {
      return { questionId: q.id, skipped: false, triggeredBy: null };
    }
    const trigger = q.skipIf.find(cond => {
      const answer = answers[cond.field];
      if (answer === undefined || answer === null) return false;
      switch (cond.operator) {
        case 'equals': return answer === cond.value;
        case 'not_equals': return answer !== cond.value;
        case 'contains': return Array.isArray(answer) ? answer.includes(cond.value) : answer === cond.value;
        case 'greater_than': return Number(answer) > Number(cond.value);
        case 'less_than': return Number(answer) < Number(cond.value);
        default: return false;
      }
    });
    return {
      questionId: q.id,
      skipped: !!trigger,
      triggeredBy: trigger ? `${trigger.field} ${trigger.operator} ${trigger.value}` : null,
    };
  });
}
