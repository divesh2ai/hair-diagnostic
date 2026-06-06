import { SessionState } from '../types';
import prisma from '../prismaClient';

export const DIAG_QUESTIONS = [
  { key: 'hairFallCount', text: 'Kitne baal girte hain rozana? (approx number)' },
  { key: 'durationMonths', text: 'Kab se ho raha hai? (months)' },
  { key: 'thyroid', text: 'Kya aapko thyroid ki koi condition hai? (yes/no)' },
  { key: 'scalpCondition', text: 'Scalp kaisa hai? (itchy/dry/oily/normal)' },
  { key: 'diet', text: 'Diet kaisa hai? (balanced/deficient/vegetarian/non-veg)' }
];

export async function startOrContinueDiagnosis(sessionId: string, state: SessionState) {
  // Determine next question based on state.step
  const answers = state.answers || {};
  const nextIndex = Object.keys(answers).length;
  if (nextIndex >= DIAG_QUESTIONS.length) {
    // diagnosis complete
    return { done: true, next: null };
  }
  const q = DIAG_QUESTIONS[nextIndex];
  // persist session state
  await prisma.session.update({
    where: { id: sessionId },
    data: { state: { ...state } }
  });
  return { done: false, question: q };
}
