import { create } from 'zustand';
import { getProtocolForConcern } from '@/runtime/protocolLoader';
import { resolveNextStep, resolvePrevStep } from '@/runtime/stepResolver';
import type { Question } from '@/types/questionnaire';

const acneProtocol = getProtocolForConcern('skin_acne');

export type SkinUploadReference = {
  kind: 'supabase_storage';
  bucket: 'clinical-images';
  path: string;
  sessionId: string;
  questionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type SkinAnswer = string | number | string[] | SkinUploadReference | null;
export type SkinAnswers = Record<string, SkinAnswer>;

interface SkinAssessmentState {
  product: 'skin_fact';
  concern: 'skin_acne';
  protocol: Question[];
  answers: SkinAnswers;
  currentStepIndex: number;
  uploadSessionId: string;
  isSubmitting: boolean;
  initialize: (draft: { answers: SkinAnswers; currentStepIndex: number; uploadSessionId: string }) => void;
  setAnswer: (questionId: string, value: SkinAnswer) => void;
  next: () => void;
  back: () => void;
  setSubmitting: (value: boolean) => void;
  reset: () => void;
}

function newSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `skin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useSkinAssessmentStore = create<SkinAssessmentState>((set, get) => ({
  product: 'skin_fact',
  concern: 'skin_acne',
  protocol: acneProtocol,
  answers: {},
  currentStepIndex: 4,
  uploadSessionId: newSessionId(),
  isSubmitting: false,
  initialize: ({ answers, currentStepIndex, uploadSessionId }) => set({
    answers,
    currentStepIndex,
    uploadSessionId,
    isSubmitting: false,
  }),
  setAnswer: (questionId, value) => set((state) => ({ answers: { ...state.answers, [questionId]: value } })),
  next: () => {
    const state = get();
    set({ currentStepIndex: resolveNextStep(state.currentStepIndex, state.protocol, state.answers) });
  },
  back: () => {
    const state = get();
    set({ currentStepIndex: resolvePrevStep(state.currentStepIndex, state.protocol, state.answers) });
  },
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  reset: () => set({ answers: {}, currentStepIndex: 4, uploadSessionId: newSessionId(), isSubmitting: false }),
}));