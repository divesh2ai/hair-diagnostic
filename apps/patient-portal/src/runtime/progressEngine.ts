import { Question } from '@/types/questionnaire';
import { shouldSkip } from './skipEngine';

export interface ProgressState {
  percentage: number;
  visiblePosition: number;
  visibleTotal: number;
  rawIndex: number;
  answeredCount: number;
  unansweredVisible: number;
}

export function computeProgress(
  currentIndex: number,
  protocol: Question[],
  answers: Record<string, any>
): ProgressState {
  let visibleTotal = 0;
  let visiblePosition = 0;
  let answeredCount = 0;

  for (let i = 0; i < protocol.length; i++) {
    const q = protocol[i];
    if (shouldSkip(q, answers)) continue;

    visibleTotal++;

    if (i <= currentIndex) {
      visiblePosition++;
    }

    const ans = answers[q.id];
    const hasAnswer = Array.isArray(ans) ? ans.length > 0 : ans !== undefined && ans !== null && ans !== '';
    if (hasAnswer) answeredCount++;
  }

  const percentage = visibleTotal > 0 ? Math.round((visiblePosition / visibleTotal) * 100) : 0;
  const unansweredVisible = visibleTotal - answeredCount;

  return {
    percentage,
    visiblePosition,
    visibleTotal,
    rawIndex: currentIndex,
    answeredCount,
    unansweredVisible,
  };
}

export function isProtocolComplete(
  protocol: Question[],
  answers: Record<string, any>
): boolean {
  return protocol.every(q => {
    if (shouldSkip(q, answers)) return true;
    if (!q.required) return true;
    const ans = answers[q.id];
    return Array.isArray(ans) ? ans.length > 0 : ans !== undefined && ans !== null && ans !== '';
  });
}
