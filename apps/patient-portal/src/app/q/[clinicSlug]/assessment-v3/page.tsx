'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  pickInsightMoment,
  pickSectionIntro,
  type SectionIntroContent,
} from '@/components/questionnaire/v2/insightRules';
import {
  ChapterTransitionV3,
  InsightMomentV3,
  QuestionnaireShellV3,
  QuestionRendererV3,
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
        // Preserve the production fallback: malformed protocol regexes do not block patients.
      }
    }
  }

  return true;
}

export default function AssessmentV3Page() {
  const params = useParams();
  const router = useRouter();
  const {
    protocol,
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

  const sectionIntroContent = useMemo<SectionIntroContent | null>(() => {
    if (!question || !isFirstOfSection) return null;
    const base = pickSectionIntro(question.category, previousQuestion?.category);
    return {
      id: currentSectionKey,
      title: question.sectionTitle ?? base?.title ?? question.category.replace(/_/g, ' '),
      body:
        question.sectionDescription ??
        base?.body ??
        'A few focused questions to complete this part of your assessment.',
      estimateLabel: base?.estimateLabel,
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

  const moment = useMemo(
    () => pickInsightMoment(progress.visiblePosition),
    [progress.visiblePosition],
  );

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
      />
    );
  }

  const isAnswered = isAnswerValid(question, currentAnswer);
  const isLast = progress.visiblePosition >= progress.visibleTotal;
  const selectedCount = Array.isArray(currentAnswer) ? currentAnswer.length : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const clinicSlug = String(params.clinicSlug ?? '');
      const response = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, clinicSlug }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? `Submit failed (HTTP ${response.status})`);
      }
      toast.success('Assessment submitted', { description: 'Starting AI analysis…' });
      const tokenQuery = data.previewToken
        ? `?t=${encodeURIComponent(data.previewToken)}`
        : '';
      router.push(
        `/q/${params.clinicSlug}/processing/${data.assessmentId}${tokenQuery}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ASSESSMENT] Submit failed:', message);
      toast.error('Submission failed', { description: message });
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
      onSkip={!question.required ? nextStep : undefined}
    >
      {moment && <InsightMomentV3 key={moment.id} content={moment} />}
      <QuestionRendererV3
        key={question.id}
        question={question}
        currentAnswer={currentAnswer}
        allAnswers={answers}
        questionNumber={progress.visiblePosition}
        onAnswer={(answer) => setAnswer(question.id, answer)}
      />
    </QuestionnaireShellV3>
  );
}
