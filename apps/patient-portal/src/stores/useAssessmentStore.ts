import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AssessmentState,
  Concern,
  PatientIntakeState,
  ProgressState,
  Question,
} from '@/types/questionnaire';
import { getDefaultProtocol, getProtocolForConcern } from '@/runtime/protocolLoader';
import { getVisibleQuestionIds } from '@/runtime/visibilityEngine';
import { getSkippedQuestionIds } from '@/runtime/skipEngine';
import { resolveNextStep, resolvePrevStep, buildBranchingPath } from '@/runtime/stepResolver';
import { computeProgress } from '@/runtime/progressEngine';
import { extractProtocolSignals } from '@/runtime/signalExtractor';
import {
  DEFAULT_ASSESSMENT_LOCALE,
  isAssessmentLocale,
} from '@/lib/assessment-i18n/types';

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

/**
 * A persisted intake blob is only usable if it still carries the two fields the
 * submission depends on. Anything else — a half-written entry, a shape from an
 * older build — is discarded so the gate simply asks again, which costs the
 * patient two fields and never files their visit under the wrong identity.
 */
function resolvePersistedIntake(value: unknown): PatientIntakeState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PatientIntakeState>;
  if (typeof candidate.name !== 'string' || candidate.name === '') return null;
  if (typeof candidate.phone !== 'string' || candidate.phone === '') return null;
  return {
    name: candidate.name,
    phone: candidate.phone,
    relationship:
      candidate.relationship === 'NEW' || candidate.relationship === 'RETURNING'
        ? candidate.relationship
        : null,
    visitType: typeof candidate.visitType === 'string' ? candidate.visitType : null,
    // Not part of the usability check above: a session that could not be
    // issued, or one persisted by an older build, simply means the visit
    // cannot be closed by id at submission. That costs a stale row on the
    // In Clinic list until the session window passes — it is not a reason to
    // throw away a valid identity and ask the patient again.
    intakeToken:
      typeof candidate.intakeToken === 'string' && candidate.intakeToken !== ''
        ? candidate.intakeToken
        : null,
  };
}

export function resolvePersistedAssessmentSession(state: {
  concern?: Concern;
  answers?: Record<string, any>;
  currentStepIndex?: number;
  locale?: unknown;
  hasChosenLocale?: unknown;
  intake?: unknown;
}) {
  const concern = state.concern ?? 'hair';
  // A persisted locale from an older build (or a tampered localStorage entry)
  // must never render a half-translated screen — fall back to English.
  const locale = isAssessmentLocale(state.locale) ? state.locale : DEFAULT_ASSESSMENT_LOCALE;
  const hasChosenLocale = state.hasChosenLocale === true && isAssessmentLocale(state.locale);
  let protocol: Question[];
  try {
    protocol = getProtocolForConcern(concern);
  } catch {
    protocol = defaultProtocol;
  }
  const persistedIndex = state.currentStepIndex ?? 0;
  const safeIndex =
    persistedIndex >= 0 && persistedIndex < protocol.length ? persistedIndex : 0;
  const answers = state.answers ?? {};
  return {
    concern,
    protocol,
    answers,
    currentStepIndex: safeIndex,
    locale,
    hasChosenLocale,
    intake: resolvePersistedIntake(state.intake),
    ...computeDerivedState(protocol, answers, safeIndex),
  };
}
export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set, get) => ({
      concern: 'hair',
      protocol: defaultProtocol,
      currentStepIndex: 0,
      answers: {},
      progress: defaultProgress,
      branchingPath: buildBranchingPath(defaultProtocol, {}),
      skippedQuestions: getSkippedQuestionIds(defaultProtocol, {}),
      visibleQuestions: getVisibleQuestionIds(defaultProtocol, {}),
      protocolSignals: {},
      isSubmitting: false,
      locale: DEFAULT_ASSESSMENT_LOCALE,
      hasChosenLocale: false,
      lastExclusivityEvent: null,
      intake: null,
      clinicData: null,
      doctorData: null,

      loadProtocol: (questions) => {
        const derived = computeDerivedState(questions, get().answers, 0);
        set({ protocol: questions, currentStepIndex: 0, answers: {}, ...derived });
      },

      setConcern: (concern, questions) => {
        // Switching concern wipes prior answers — the two protocols share no
        // question IDs, so keeping stale answers would break visibility rules
        // and dump orphan keys into the submit payload.
        const derived = computeDerivedState(questions, {}, 0);
        set({
          concern,
          protocol: questions,
          answers: {},
          currentStepIndex: 0,
          ...derived,
        });
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

      // Presentation-only. Answers, uploads, step index and every derived
      // clinical field are deliberately left untouched so switching language
      // mid-assessment keeps the patient exactly where they were.
      //
      // Kept separate from `confirmLocale` so the language gate can preview a
      // highlighted language (and survive a refresh mid-pick) without the pick
      // itself dismissing the screen the patient is still reading.
      setLocale: (locale) => set({ locale }),

      confirmLocale: () => set({ hasChosenLocale: true }),

      reset: () => {
        const { protocol } = get();
        const p = protocol ?? defaultProtocol;
        const derived = computeDerivedState(p, {}, 0);
        // Intake is cleared with the answers, not kept across it. `reset()` is
        // what a fresh arrival at a clinic landing page calls, and a shared
        // reception tablet must not carry the previous patient's name and
        // mobile into the next person's assessment.
        set({ answers: {}, currentStepIndex: 0, intake: null, ...derived });
      },

      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      recordExclusivityEvent: (event) => set({ lastExclusivityEvent: event }),
      setClinicData: (data) => set({ clinicData: data }),
      setDoctorData: (data) => set({ doctorData: data }),
      setIntake: (intake) => set({ intake }),
    }),
    {
      name: 'drfact-assessment-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        concern: state.concern,
        answers: state.answers,
        currentStepIndex: state.currentStepIndex,
        clinicData: state.clinicData,
        // Locale is persisted alongside the answers it was collected with, so
        // a refresh or a resume comes back in the patient's own language.
        locale: state.locale,
        hasChosenLocale: state.hasChosenLocale,
        // Persisted for the same reason as the answers: a refresh or an
        // accidental back-swipe mid-assessment must not re-ask for the mobile
        // number, and losing it would strand a returning patient's visit on a
        // brand-new Patient row at submission. Cleared by `reset()`.
        intake: state.intake,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        Object.assign(state, resolvePersistedAssessmentSession(state));
      },
    }
  )
);
