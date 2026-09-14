'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  pickSectionIntro,
  type SectionIntroContent,
} from '@/components/questionnaire/v2/insightRules';
import {
  ChapterTransitionV3,
  LanguageGateV3,
  QuestionnaireShellV3,
  QuestionRendererV3,
  type QuestionnaireVisualMode,
} from '@/components/questionnaire/v3';
import styles from '@/components/questionnaire/v3/assessment-v3.module.css';
import {
  useAssessmentTranslator,
  useSyncDocumentLocale,
} from '@/lib/assessment-i18n';
import { isQuestionVisible } from '@/runtime/visibilityEngine';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import type { Question } from '@/types/questionnaire';

interface AssessmentSection {
  id: string;
  category: string;
  title: string;
  description?: string;
}

function sectionKey(question: Question): string {
  return question.sectionId ?? question.category;
}

function buildSections(protocol: Question[]): AssessmentSection[] {
  const seen = new Set<string>();
  const sections: AssessmentSection[] = [];
  for (const question of protocol) {
    const id = sectionKey(question);
    if (seen.has(id)) continue;
    seen.add(id);
    sections.push({
      id,
      category: question.category,
      title: question.sectionTitle ?? question.category.replace(/_/g, ' '),
      description: question.sectionDescription,
    });
  }
  return sections;
}

function isAnswerValid(question: Question, answer: unknown): boolean {
  if (Array.isArray(answer)) return question.required ? answer.length > 0 : true;

  const hasValue = answer !== undefined && answer !== null && answer !== '';
  if (!hasValue) return !question.required;

  if (question.type === 'number') {
    const number = typeof answer === 'number' ? answer : Number(answer);
    if (!Number.isFinite(number)) return false;
    if (question.validation?.min != null && number < question.validation.min) return false;
    if (question.validation?.max != null && number > question.validation.max) return false;
  }

  if ((question.type === 'text' || question.type === 'textarea') && typeof answer === 'string') {
    const value = answer.trim();
    if (question.validation?.minLength != null && value.length < question.validation.minLength) {
      return false;
    }
    if (question.validation?.maxLength != null && value.length > question.validation.maxLength) {
      return false;
    }
    if (question.validation?.pattern) {
      try {
        if (!new RegExp(question.validation.pattern).test(value)) return false;
      } catch {
        // Preserve production fallback: malformed protocol regexes do not block patients.
      }
    }
  }

  return true;
}

export interface AssessmentV3JourneyProps {
  visualMode?: QuestionnaireVisualMode;
  clinicSlugOverride?: string;
  compactProgress?: boolean;
  compactShell?: boolean;
  /**
   * Patient details captured outside the questionnaire.
   *
   * Every field is optional, and an omitted one falls through to the answer the
   * patient gives in the protocol. That matters for `name`: the intake gate
   * asks for a first name, question one asks for a full name, and the fuller
   * value must win. The gate therefore seeds the answer and passes only the
   * phone here, while the skin intake — which collects the full set up front —
   * keeps passing everything.
   */
  patientInfoOverride?: {
    name?: string;
    phone?: string;
    email?: string;
    gender?: string;
    /** Explicit opt-in to WhatsApp delivery, from the intake gate's checkbox. */
    whatsappConsent?: boolean;
  };
  /**
   * Why the patient is here today, from the pre-assessment intake gate.
   * Advisory: the server re-resolves identity at submission and refuses an
   * intent that contradicts the relationship it resolves. Null/undefined
   * persists as "not captured" rather than a guess.
   */
  visitType?: string | null;
  /**
   * The signed intake session, when the patient came through the intake gate.
   * Sent to the submit route so the ClinicVisit opened at intake is closed in
   * the same transaction that creates the Assessment — the patient leaves the
   * Doctor Dashboard's In Clinic list exactly as they enter the Review Queue.
   *
   * Opaque and optional. Surfaces that mount the journey without an intake
   * gate omit it and nothing else changes.
   */
  intakeToken?: string | null;
  onSubmitted?: (result: { assessmentId: string; previewToken?: string }) => void | Promise<void>;
}

export function AssessmentV3Journey({
  visualMode = 'hair',
  clinicSlugOverride,
  compactProgress = false,
  compactShell = false,
  patientInfoOverride,
  visitType,
  intakeToken,
  onSubmitted,
}: AssessmentV3JourneyProps) {
  const params = useParams();
  const router = useRouter();
  const {
    protocol,
    concern,
    currentStepIndex,
    answers,
    progress,
    setAnswer,
    nextStep,
    prevStep,
    isSubmitting,
    setSubmitting,
    clinicData,
    locale,
    hasChosenLocale,
  } = useAssessmentStore();
  const { t, tSection } = useAssessmentTranslator();
  useSyncDocumentLocale(locale);
  const [acknowledgedSections, setAcknowledgedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [assessmentComplete, setAssessmentComplete] = useState(false);

  const question = protocol?.[currentStepIndex];
  const currentAnswer = question ? answers[question.id] : undefined;
  const currentSectionKey = question ? sectionKey(question) : '';
  const previousQuestion = protocol?.[currentStepIndex - 1];
  const previousSectionKey = previousQuestion ? sectionKey(previousQuestion) : undefined;
  const isFirstOfSection = Boolean(question && previousSectionKey !== currentSectionKey);

  const sections = useMemo(() => buildSections(protocol ?? []), [protocol]);
  const currentSectionIndex = Math.max(
    0,
    sections.findIndex((section) => section.id === currentSectionKey),
  );

  const isFinalChapter = currentSectionKey === 'S6_GRADE_AND_ADDITIONAL';

  const sectionIntroContent = useMemo<SectionIntroContent | null>(() => {
    if (!question || !isFirstOfSection) return null;
    const base = pickSectionIntro(question.category, previousQuestion?.category);
    // Uniform per-chapter title + body overrides so every chapter card renders
    // through the same h1 (Fraunces) — no per-section title casing drift.
    const OVERRIDES: Record<string, { title: string; body: string }> = {
      S1_PATIENT_IDENTITY: {
        title: 'About You',
        body: 'A few quick details so we can personalise the rest of the assessment.',
      },
      S2_HAIR_LOSS_ASSESSMENT: {
        title: 'Hair History',
        body: 'These questions help us recognise the pattern, pace and texture of what you are experiencing.',
      },
      S3_SCALP_CONDITION: {
        title: 'Symptoms',
        body: 'The scalp environment is often the silent factor behind shedding. A few short questions ahead.',
      },
      S4_MEDICAL_HISTORY: {
        title: 'Lifestyle',
        body: 'Sleep, stress and routines shape the growth cycle more than most people realise.',
      },
      S5_NUTRITION_AND_DIET: {
        title: 'Nutrition, Diet & Treatments',
        body: 'Subtle nutritional gaps can mimic genetic loss. We are looking for the difference.',
      },
      S6_GRADE_AND_ADDITIONAL: {
        title: 'The Final Picture',
        body: 'A few final questions to complete your hair profile.',
      },
    };
    // The English overrides above stay the master copy; tSection swaps in the
    // patient's language when a content pack has an entry for this section and
    // otherwise returns the English fallback untouched.
    const override = OVERRIDES[currentSectionKey];
    if (override) {
      const localised = tSection(currentSectionKey, override);
      return { id: currentSectionKey, title: localised.title, body: localised.body };
    }
    const fallback = {
      title: question.sectionTitle ?? base?.title ?? question.category.replace(/_/g, ' '),
      body:
        question.sectionDescription ??
        base?.body ??
        'A few focused questions to complete this part of your assessment.',
    };
    const localised = tSection(currentSectionKey, fallback);
    return { id: currentSectionKey, title: localised.title, body: localised.body };
  }, [currentSectionKey, isFirstOfSection, previousQuestion?.category, question, tSection]);

  const showingSectionIntro = Boolean(
    sectionIntroContent &&
      isFirstOfSection &&
      !acknowledgedSections.has(currentSectionKey),
  );

  const acknowledgeSection = useCallback(() => {
    if (!currentSectionKey) return;
    setAcknowledgedSections((previous) => new Set(previous).add(currentSectionKey));
  }, [currentSectionKey]);

  useEffect(() => {
    if (!question || showingSectionIntro || isQuestionVisible(question, answers)) return;
    const timeout = window.setTimeout(nextStep, 0);
    return () => window.clearTimeout(timeout);
  }, [answers, nextStep, question, showingSectionIntro]);

  const effectiveClinicSlug = clinicSlugOverride ?? String(params.clinicSlug ?? '');

  const isAnswered = question ? isAnswerValid(question, currentAnswer) : false;
  const isLast = progress.visiblePosition >= progress.visibleTotal;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setAssessmentComplete(true);
    try {
      const response = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `locale` travels as session metadata only. `answers` still carries
        // canonical English answer codes at every locale, so the clinical
        // payload is byte-identical between an English and a Hindi run.
        body: JSON.stringify({
          answers,
          clinicSlug: effectiveClinicSlug,
          concern,
          locale,
          ...(visitType ? { visitType } : {}),
          ...(intakeToken ? { intakeToken } : {}),
          ...(patientInfoOverride ? { patientInfo: patientInfoOverride } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `Submit failed (HTTP ${response.status})`);
      }
      if (onSubmitted) {
        await onSubmitted({ assessmentId: data.assessmentId });
        return;
      }
      // The patient journey ends here.
      //
      // This used to wait 1400ms and then push to
      // /q/[slug]/processing/[assessmentId], which polled the assessment
      // status every two seconds and, on completion, forwarded to a preview of
      // the engine's findings and recommendation — output no doctor had yet
      // looked at. The clinical work now happens entirely behind the
      // submission: `after(() => safeDispatchOrchestration(...))` in the
      // submit route keeps it running server-side whether or not this browser
      // is still open.
      //
      // `replace`, not `push`: the assessment is filed and cannot be
      // resubmitted, so Back must not return the patient to their answers.
      // No assessmentId in the target — there is nothing patient-specific for
      // the Thank You page to read, and an id in the URL is an id in history.
      router.replace(`/q/${effectiveClinicSlug}/thank-you`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ASSESSMENT] Submit failed:', message);
      toast.error(t('submission.failedTitle'), { description: message });
      setAssessmentComplete(false);
    } finally {
      setSubmitting(false);
    }
  }, [
    answers,
    concern,
    effectiveClinicSlug,
    intakeToken,
    locale,
    onSubmitted,
    patientInfoOverride,
    router,
    setSubmitting,
    t,
    visitType,
  ]);

  // Enter-to-continue: select an option first, then press Enter to advance.
  // Runs in the capture phase so preventDefault() cancels the browser's native
  // Enter→click translation on any focused button (option cards, forward FAB,
  // Skip/Back). Without capture+preventDefault, a focused option button would
  // toggle itself off before our advance fires. Textarea and contenteditable
  // still opt out so multiline input works.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;

      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === 'TEXTAREA') return;
        if (el.isContentEditable) return;
        // Enter on a focused language button must switch the language, not
        // advance the question. Every other focused control keeps the existing
        // capture+preventDefault behaviour.
        if (el.closest('[data-locale-switcher]')) return;
      }

      if (isSubmitting || assessmentComplete) return;
      // The language gate owns Enter while it is up.
      if (!hasChosenLocale) return;

      if (showingSectionIntro) {
        event.preventDefault();
        acknowledgeSection();
        return;
      }

      if (!question || !isAnswered) return;

      event.preventDefault();
      if (isLast) {
        void handleSubmit();
      } else {
        nextStep();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    acknowledgeSection,
    assessmentComplete,
    handleSubmit,
    hasChosenLocale,
    isAnswered,
    isLast,
    isSubmitting,
    nextStep,
    question,
    showingSectionIntro,
  ]);

  if (assessmentComplete) {
    return (
      <main className={styles.completionScreen} role="status" aria-live="polite" lang={locale}>
        <div className={styles.completionContent}>
          <span className={styles.completionMark} aria-hidden="true">✓</span>
          {/* This screen is shown the moment submission starts, so while the
              request is still in flight it must say so rather than claim the
              assessment is already filed. */}
          <h1>
            {isSubmitting ? t('submission.submitting') : t('submission.completeTitle')}
          </h1>
          <p>{isSubmitting ? t('submission.doNotClose') : t('submission.completeBody')}</p>
        </div>
      </main>
    );
  }

  // Language first: chapter zero. Rendered before the loading branch so a
  // patient on a slow connection reads the picker in both scripts rather than
  // an English spinner.
  if (!hasChosenLocale) {
    return <LanguageGateV3 />;
  }

  if (!question) {
    return (
      <main className={styles.loadingScreen} lang={locale}>
        <div className={styles.loadingContent}>
          <span className={styles.loadingDot} aria-hidden="true" />
          <p>{t('questionnaire.loading')}</p>
        </div>
      </main>
    );
  }

  if (showingSectionIntro && sectionIntroContent) {
    return (
      <ChapterTransitionV3
        content={sectionIntroContent}
        sectionIndex={currentSectionIndex + 1}
        sectionTotal={sections.length}
        sectionId={question.sectionId}
        onContinue={acknowledgeSection}
        isFinalChapter={isFinalChapter}
      />
    );
  }

  const selectedCount = Array.isArray(currentAnswer) ? currentAnswer.length : 0;

  return (
    <QuestionnaireShellV3
      clinicName={clinicData?.name}
      // Section title in the progress band uses the same localised chapter name
      // the patient just read on the chapter card, so the two never disagree.
      sectionTitle={
        tSection(currentSectionKey, {
          title: question.sectionTitle ?? question.category.replace(/_/g, ' '),
          body: '',
        }).title
      }
      progress={progress}
      canGoBack={progress.visiblePosition > 1}
      canContinue={isAnswered}
      isLast={isLast}
      isSubmitting={isSubmitting}
      selectedCount={selectedCount}
      onBack={prevStep}
      onContinue={isLast ? handleSubmit : nextStep}
      onSkip={!question.required ? (isLast ? handleSubmit : nextStep) : undefined}
      visualMode={visualMode}
      compactProgress={compactProgress}
      compactShell={compactShell}
    >
      <QuestionRendererV3
        key={question.id}
        question={question}
        currentAnswer={currentAnswer}
        allAnswers={answers}
        questionNumber={progress.visiblePosition}
        clinicSlug={effectiveClinicSlug}
        onAnswer={(answer) => setAnswer(question.id, answer)}
      />
    </QuestionnaireShellV3>
  );
}
