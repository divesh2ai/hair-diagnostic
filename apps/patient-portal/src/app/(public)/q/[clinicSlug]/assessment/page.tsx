'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import {
  QuestionnaireShellV2,
  CategoryMeta,
} from '@/components/questionnaire/v2/QuestionnaireShellV2';
import { QuestionRendererV2 } from '@/components/questionnaire/v2/QuestionRendererV2';
import { MultiSelectDock } from '@/components/questionnaire/v2/MultiSelectDock';
import { InsightMoment } from '@/components/questionnaire/v2/InsightMoment';
import { SectionIntro } from '@/components/questionnaire/v2/SectionIntro';
import {
  isQuestionVisible,
  deriveHairStory,
  pickInsightMoment,
  pickSectionIntro,
  estimateMinutesRemaining,
} from '@/components/questionnaire/v2/insightRules';

// Display metadata for each section category. The protocol owns the order;
// this map controls how each section is *titled* in the UI.
const CATEGORY_META: Record<string, Omit<CategoryMeta, 'id'>> = {
  about_you:        { label: 'About you',       icon: '👋' },
  hair_health:      { label: 'Hair health',     icon: '💇' },
  scalp_assessment: { label: 'Scalp',           icon: '🔬' },
  internal_health:  { label: 'Internal health', icon: '❤️' },
  nutrition:        { label: 'Nutrition',       icon: '🥗' },
  lifestyle:        { label: 'Lifestyle',       icon: '🧘' },
  hormonal:         { label: 'Hormonal',        icon: '⚖️' },
  medical:          { label: 'Medical history', icon: '🩺' },
};

export default function AssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const {
    protocol, currentStepIndex, answers, progress,
    setAnswer, nextStep, prevStep,
    isSubmitting, setSubmitting, clinicData,
  } = useAssessmentStore();

  const question = protocol?.[currentStepIndex];
  const currentAnswer = question ? answers[question.id] : undefined;

  // ─── Section-transition state ──────────────────────────────────────────────
  // We track which section intros the patient has dismissed in this session.
  // A new entry is added when the user taps "Continue" on the intro screen.
  // Going back across a section boundary does NOT re-show the intro (it stays
  // dismissed), so the back-button feels predictable.
  const [acknowledgedSections, setAcknowledgedSections] = useState<Set<string>>(new Set());

  const previousCategory = protocol?.[currentStepIndex - 1]?.category;
  const isFirstOfSection = !!question && previousCategory !== question.category;

  const sectionIntroContent = useMemo(
    () => pickSectionIntro(question?.category, previousCategory),
    [question?.category, previousCategory],
  );
  const showingSectionIntro =
    !!sectionIntroContent &&
    isFirstOfSection &&
    !acknowledgedSections.has(question!.category);

  const acknowledgeSection = useCallback(() => {
    if (!question) return;
    setAcknowledgedSections(prev => {
      const next = new Set(prev);
      next.add(question.category);
      return next;
    });
  }, [question]);

  // ─── showIf — auto-skip hidden questions ───────────────────────────────────
  useEffect(() => {
    if (!question) return;
    if (showingSectionIntro) return;            // don't navigate while intro is up
    if (isQuestionVisible(question, answers)) return;
    const id = setTimeout(() => nextStep(), 0);
    return () => clearTimeout(id);
  }, [question?.id, answers, nextStep, showingSectionIntro]);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const hairStory = useMemo(() => deriveHairStory(answers), [answers]);

  const moment = useMemo(
    () => pickInsightMoment(progress.visiblePosition),
    [progress.visiblePosition],
  );

  const minutesRemaining = useMemo(
    () => estimateMinutesRemaining(progress.answeredCount, progress.visibleTotal),
    [progress.answeredCount, progress.visibleTotal],
  );

  // Build de-duped section list from the protocol for sectionIndex / next.
  const sections: CategoryMeta[] = useMemo(() => {
    if (!protocol) return [];
    const seen = new Set<string>();
    const list: CategoryMeta[] = [];
    for (const q of protocol) {
      if (seen.has(q.category)) continue;
      seen.add(q.category);
      const meta = CATEGORY_META[q.category] ?? { label: q.category.replace(/_/g, ' '), icon: '•' };
      list.push({ id: q.category, ...meta });
    }
    return list;
  }, [protocol]);

  const currentSectionIdx = useMemo(
    () => Math.max(0, sections.findIndex(s => s.id === question?.category)),
    [sections, question?.category],
  );
  const nextSectionLabel = sections[currentSectionIdx + 1]?.label;

  // Position of the current question within its section. Updates on every
  // step even when section and overall % barely change.
  const questionInSection = useMemo(() => {
    if (!protocol || !question) return { current: 0, total: 0 };
    const sectionQs = protocol.filter(q => q.category === question.category);
    const idx = sectionQs.findIndex(q => q.id === question.id);
    return { current: idx + 1, total: sectionQs.length };
  }, [protocol, question?.id, question?.category]);

  if (!question) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading your assessment…</p>
        </div>
      </div>
    );
  }

  // ─── Validation + nav helpers ──────────────────────────────────────────────
  const isAnswered = (() => {
    if (!question.required) return true;
    if (Array.isArray(currentAnswer)) return currentAnswer.length > 0;
    return currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '';
  })();

  const isLast = progress.visiblePosition >= progress.visibleTotal;
  const selectedCount = Array.isArray(currentAnswer) ? currentAnswer.length : 0;

  const handleAnswer = (ans: any) => {
    setAnswer(question.id, ans);
    if (
      question.type === 'single_select' ||
      question.type === 'image_select' ||
      question.type === 'scale'
    ) {
      setTimeout(() => { if (!isLast) nextStep(); }, 320);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const clinicSlug = String(params.clinicSlug ?? '');
      const res = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, clinicSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? `Submit failed (HTTP ${res.status})`);
      toast.success('Assessment submitted', { description: 'Starting AI analysis…' });
      router.push(`/q/${params.clinicSlug}/processing/${data.assessmentId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ASSESSMENT] Submit failed:', message);
      toast.error('Submission failed', { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const showDock =
    question.type === 'multi_select' ||
    question.type === 'text' ||
    question.type === 'textarea' ||
    question.type === 'number' ||
    question.type === 'image_upload' ||
    isLast;

  const headerSectionTitle =
    CATEGORY_META[question.category]?.label
    ?? question.sectionTitle
    ?? question.category;

  return (
    <QuestionnaireShellV2
      clinicName={clinicData?.name}
      sectionTitle={headerSectionTitle}
      sectionIndex={currentSectionIdx + 1}
      sectionTotal={sections.length}
      nextSectionLabel={nextSectionLabel}
      completionPercent={progress.percentage}
      estimatedMinutesRemaining={minutesRemaining}
      questionInSection={questionInSection}
      canGoBack={progress.visiblePosition > 1}
      onBack={prevStep}
      // While a section intro is showing, the intro owns the CTA, so the
      // shell's dock is suppressed. Otherwise the standard dock rule applies.
      dock={
        !showingSectionIntro && showDock ? (
          <MultiSelectDock
            selectedCount={selectedCount}
            isAnswered={isAnswered}
            isLast={isLast}
            isSubmitting={isSubmitting}
            onContinue={isLast ? handleSubmit : nextStep}
            onSkip={!question.required ? nextStep : undefined}
          />
        ) : null
      }
    >
      {showingSectionIntro ? (
        <SectionIntro
          key={`intro-${sectionIntroContent!.id}`}
          content={sectionIntroContent!}
          signals={hairStory}
          sectionIndex={currentSectionIdx + 1}
          sectionTotal={sections.length}
          onContinue={acknowledgeSection}
        />
      ) : (
        <>
          {moment && (
            <InsightMoment key={`moment-${moment.id}`} content={moment} />
          )}
          <QuestionRendererV2
            key={`q-${question.id}`}
            question={question}
            currentAnswer={currentAnswer}
            allAnswers={answers}
            onAnswer={handleAnswer}
          />
        </>
      )}
    </QuestionnaireShellV2>
  );
}
