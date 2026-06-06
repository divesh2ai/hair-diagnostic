import { Question } from '@/types/questionnaire';
import { shouldSkip } from './skipEngine';
import { getVisibleQuestions } from './visibilityEngine';

export function resolveNextStep(
  currentIndex: number,
  protocol: Question[],
  answers: Record<string, any>
): number {
  let next = currentIndex + 1;
  while (next < protocol.length && shouldSkip(protocol[next], answers)) {
    next++;
  }
  return next < protocol.length ? next : currentIndex;
}

export function resolvePrevStep(
  currentIndex: number,
  protocol: Question[],
  answers: Record<string, any>
): number {
  let prev = currentIndex - 1;
  while (prev >= 0 && shouldSkip(protocol[prev], answers)) {
    prev--;
  }
  return prev >= 0 ? prev : currentIndex;
}

export function resolveStepById(protocol: Question[], questionId: string): number {
  const idx = protocol.findIndex(q => q.id === questionId);
  return idx >= 0 ? idx : 0;
}

export function isAtStart(currentIndex: number, protocol: Question[], answers: Record<string, any>): boolean {
  return resolvePrevStep(currentIndex, protocol, answers) === currentIndex;
}

export function isAtEnd(currentIndex: number, protocol: Question[], answers: Record<string, any>): boolean {
  return resolveNextStep(currentIndex, protocol, answers) === currentIndex;
}

export function buildBranchingPath(
  protocol: Question[],
  answers: Record<string, any>
): string[] {
  return getVisibleQuestions(protocol, answers).map(q => q.id);
}

export interface ReplayFrame {
  stepIndex: number;
  questionId: string;
  answer: any;
  branchingPathSnapshot: string[];
}

export function buildReplayFrames(
  protocol: Question[],
  fixture: Record<string, any>
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const progressiveAnswers: Record<string, any> = {};

  for (let i = 0; i < protocol.length; i++) {
    const q = protocol[i];
    if (shouldSkip(q, progressiveAnswers)) continue;

    const answer = fixture[q.id];
    if (answer !== undefined) {
      progressiveAnswers[q.id] = answer;
    }

    frames.push({
      stepIndex: i,
      questionId: q.id,
      answer: answer ?? null,
      branchingPathSnapshot: buildBranchingPath(protocol, { ...progressiveAnswers }),
    });
  }

  return frames;
}
