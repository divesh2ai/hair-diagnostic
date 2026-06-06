'use client';

import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { QuestionRenderer } from '@/components/questionnaire/QuestionRenderer';
import { ProgressHeader } from '@/components/questionnaire/ProgressHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';

export default function AssessmentPage() {
  const router = useRouter();
  const params = useParams();
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

  const question = protocol?.[currentStepIndex];
  const currentAnswer = question ? answers[question.id] : undefined;

  let isAnswered = false;
  if (!question?.required) {
    isAnswered = true;
  } else if (Array.isArray(currentAnswer)) {
    isAnswered = currentAnswer.length > 0;
  } else {
    isAnswered = currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '';
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Use the clinicSlug from the URL — the submit API resolves the real clinic by slug.
      // Never use clinicData?.id which may be a stale or placeholder value.
      const clinicSlug = String(params.clinicSlug ?? '');
      const res = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, clinicSlug }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Submit failed (HTTP ${res.status})`);
      }

      toast.success('Assessment submitted', { description: 'Starting AI analysis…' });
      router.push(`/q/${params.clinicSlug}/processing/${data.assessmentId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ASSESSMENT] Submit failed:', message);
      toast.error('Submission failed', {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!question) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-slate-500 font-medium">Loading Clinical Assessment...</p>
        </div>
      </div>
    );
  }

  const isLastVisible = progress.visiblePosition >= progress.visibleTotal;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col pb-32">
      <ProgressHeader
        currentStep={progress.visiblePosition - 1}
        totalSteps={progress.visibleTotal}
        category={question.sectionTitle ?? question.category}
        sectionDescription={question.sectionDescription}
      />

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 sm:p-6 mt-4">
        <QuestionRenderer
          question={question}
          currentAnswer={currentAnswer}
          allAnswers={answers}
          onAnswer={(ans) => {
            setAnswer(question.id, ans);

            if (
              question.type === 'single_select' ||
              question.type === 'image_select' ||
              question.type === 'scale'
            ) {
              setTimeout(() => {
                if (!isLastVisible) nextStep();
              }, 450);
            }
          }}
        />
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-4 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="max-w-2xl mx-auto flex justify-between items-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={prevStep}
            disabled={progress.visiblePosition <= 1 || isSubmitting}
            className="w-16 sm:w-32 h-14 rounded-2xl shrink-0 border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-6 h-6 sm:mr-2" />
            <span className="hidden sm:inline font-semibold">Back</span>
          </Button>

          {!isLastVisible ? (
            <Button
              size="lg"
              className="flex-1 h-14 rounded-2xl text-lg font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={nextStep}
              disabled={!isAnswered}
            >
              Continue
              <ArrowRight className="w-6 h-6 ml-2" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1 h-14 rounded-2xl text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
              onClick={handleSubmit}
              disabled={!isAnswered || isSubmitting}
            >
              {isSubmitting ? 'Analyzing...' : 'Complete Assessment'}
              {!isSubmitting && <CheckCircle className="w-6 h-6 ml-2" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
