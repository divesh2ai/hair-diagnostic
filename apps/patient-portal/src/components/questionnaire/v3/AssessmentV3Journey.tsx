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
  QuestionnaireShellV3,
  QuestionRendererV3,
  type QuestionnaireVisualMode,
} from '@/components/questionnaire/v3';
import styles from '@/components/questionnaire/v3/assessment-v3.module.css';
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
}

export function AssessmentV3Journey({
  visualMode = 'hair',
  clinicSlugOverride,
  compactProgress = false,
  compactShell = false,
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
  } = useAssessmentStore();
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
    const override = OVERRIDES[currentSectionKey];
    if (override) {
      return { id: currentSectionKey, title: override.title, body: override.body };
    }
    return {
      id: currentSectionKey,
      title: question.sectionTitle ?? base?.title ?? question.category.replace(/_/g, ' '),
      body:
        question.sectionDescription ??
        base?.body ??
        'A few focused questions to complete this part of your assessment.',
    };
  }, [currentSectionKey, isFirstOfSection, previousQuestion?.category, question]);

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

  if (assessmentComplete) {
    return (
      <main className={styles.completionScreen} role="status" aria-live="polite">
        <div className={styles.completionContent}>
          <span className={styles.completionMark} aria-hidden="true">✓</span>
          <h1>Assessment complete</h1>
          <p>Thank you. Your answers are ready for clinical review.</p>
        </div>
      </main>
    );
  }

  if (!question) {
    return (
      <main className={styles.loadingScreen}>
        <div className={styles.loadingContent}>
          <span className={styles.loadingDot} aria-hidden="true" />
          <p>Loading your assessment…</p>
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

  const isAnswered = isAnswerValid(question, currentAnswer);
  const isLast = progress.visiblePosition >= progress.visibleTotal;
  const selectedCount = Array.isArray(currentAnswer) ? currentAnswer.length : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setAssessmentComplete(true);
    try {
      const response = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, clinicSlug: effectiveClinicSlug, concern }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `Submit failed (HTTP ${response.status})`);
      }
      const tokenQuery = data.previewToken
        ? `?t=${encodeURIComponent(data.previewToken)}`
        : '';
      window.setTimeout(() => {
        router.push(
          `/q/${effectiveClinicSlug}/processing/${data.assessmentId}${tokenQuery}`,
        );
      }, 1400);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ASSESSMENT] Submit failed:', message);
      toast.error('Submission failed', { description: message });
      setAssessmentComplete(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <QuestionnaireShellV3
      clinicName={clinicData?.name}
      sectionTitle={question.sectionTitle ?? question.category.replace(/_/g, ' ')}
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
