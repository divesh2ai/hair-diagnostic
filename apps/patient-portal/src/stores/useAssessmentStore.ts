import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AssessmentState, Question, ProgressState } from '@/types/questionnaire';
import { getDefaultProtocol } from '@/runtime/protocolLoader';
import { getVisibleQuestionIds } from '@/runtime/visibilityEngine';
import { getSkippedQuestionIds } from '@/runtime/skipEngine';
import { resolveNextStep, resolvePrevStep, buildBranchingPath } from '@/runtime/stepResolver';
import { computeProgress } from '@/runtime/progressEngine';
import { extractProtocolSignals } from '@/runtime/signalExtractor';

const defaultProtocol = getDefaultProtocol();

const defaultProgress: ProgressState = {
  percentage: 0,
  visiblePosition: 1,
  visibleTotal: defaultProtocol.filter(q => !q.skipIf?.length).length,
  rawIndex: 0,
  answeredCount: 0,
  unansweredVisible: 0,
};

function computeDerivedState(
  protocol: Question[],
  answers: Record<string, any>,
  currentStepIndex: number
) {
  return {
    progress: computeProgress(currentStepIndex, protocol, answers),
    branchingPath: buildBranchingPath(protocol, answers),
    skippedQuestions: getSkippedQuestionIds(protocol, answers),
    visibleQuestions: getVisibleQuestionIds(protocol, answers),
    protocolSignals: extractProtocolSignals(protocol, answers),
  };
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set, get) => ({
      protocol: defaultProtocol,
      currentStepIndex: 0,
      answers: {},
      progress: defaultProgress,
      branchingPath: buildBranchingPath(defaultProtocol, {}),
      skippedQuestions: getSkippedQuestionIds(defaultProtocol, {}),
      visibleQuestions: getVisibleQuestionIds(defaultProtocol, {}),
      protocolSignals: {},
      isSubmitting: false,
      lastExclusivityEvent: null,
      clinicData: null,
      doctorData: null,

      loadProtocol: (questions) => {
        const derived = computeDerivedState(questions, get().answers, 0);
        set({ protocol: questions, currentStepIndex: 0, answers: {}, ...derived });
      },

      setAnswer: (questionId, answer) => {
        const { protocol, currentStepIndex } = get();
        if (!protocol) return;
        const newAnswers = { ...get().answers, [questionId]: answer };
        const derived = computeDerivedState(protocol, newAnswers, currentStepIndex);
        set({ answers: newAnswers, ...derived });
      },

      nextStep: () => {
        const { protocol, currentStepIndex, answers } = get();
        if (!protocol) return;
        const next = resolveNextStep(currentStepIndex, protocol, answers);
        if (next !== currentStepIndex) {
          const derived = computeDerivedState(protocol, answers, next);
          set({ currentStepIndex: next, ...derived });
        }
      },

      prevStep: () => {
        const { protocol, currentStepIndex, answers } = get();
        if (!protocol) return;
        const prev = resolvePrevStep(currentStepIndex, protocol, answers);
        if (prev !== currentStepIndex) {
          const derived = computeDerivedState(protocol, answers, prev);
          set({ currentStepIndex: prev, ...derived });
        }
      },

      goToStep: (index) => {
        const { protocol, answers } = get();
        if (!protocol || index < 0 || index >= protocol.length) return;
        const derived = computeDerivedState(protocol, answers, index);
        set({ currentStepIndex: index, ...derived });
      },

      replayFixture: (fixture) => {
        const { protocol } = get();
        if (!protocol) return;

        // Find the last answered question's raw index
        const answeredIds = Object.keys(fixture);
        let lastIndex = 0;
        protocol.forEach((q, i) => {
          if (answeredIds.includes(q.id)) lastIndex = i;
        });

        const derived = computeDerivedState(protocol, fixture, lastIndex);
        set({ answers: fixture, currentStepIndex: lastIndex, ...derived });
      },

      reset: () => {
        const { protocol } = get();
        const p = protocol ?? defaultProtocol;
        const derived = computeDerivedState(p, {}, 0);
        set({ answers: {}, currentStepIndex: 0, ...derived });
      },

      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      recordExclusivityEvent: (event) => set({ lastExclusivityEvent: event }),
      setClinicData: (data) => set({ clinicData: data }),
      setDoctorData: (data) => set({ doctorData: data }),
    }),
    {
      name: 'drfact-assessment-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        answers: state.answers,
        currentStepIndex: state.currentStepIndex,
        clinicData: state.clinicData,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const protocol = defaultProtocol;
        const derived = computeDerivedState(protocol, state.answers ?? {}, state.currentStepIndex ?? 0);
        Object.assign(state, { protocol, ...derived });
      },
    }
  )
);
