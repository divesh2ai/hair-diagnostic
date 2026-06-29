'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Question } from '@/types/questionnaire';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud } from 'lucide-react';
import { VoiceDictateButton } from '@/components/shared/VoiceDictateButton';
import {
  getVisibleOptions,
  applyMultiSelectRules,
  applyGroupExclusivity,
  computeGroupExclusivityDeselections,
  getExclusiveOptions,
} from '@/runtime/optionFilterEngine';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { OptionCardV2 } from './OptionCardV2';

// Format a free-text answer according to its uiFormat hint. For "name" we
// strip digits (and any other char outside the allowed name alphabet) and
// proper-case each word so the patient's name is captured cleanly regardless
// of how they type it.
function formatTextInput(raw: string, format?: 'name' | 'number' | 'text'): string {
  if (format !== 'name') return raw;
  const cleaned = raw.replace(/[^A-Za-z\s.'-]/g, '').replace(/^\s+/, '');
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s.'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

interface QuestionRendererV2Props {
  question: Question;
  currentAnswer: any;
  onAnswer: (answer: any) => void;
  allAnswers: Record<string, any>;
}

/**
 * V2 renderer.
 *
 * Grid strategy (the heart of the redesign):
 *  - We pick column count from option count + whether descriptions exist,
 *    rather than question type alone. This is what keeps everything in one
 *    viewport on mobile.
 *
 *    | option count | desc?  | mobile | tablet | desktop |
 *    | ------------ | ------ | ------ | ------ | ------- |
 *    | ≤ 4          | yes    |   1    |   2    |   2     |   ← "feature" density
 *    | ≤ 4          | no     |   2    |   2    |   4     |   ← "tile"
 *    | 5–6          | any    |   2    |   3    |   3     |
 *    | 7+           | any    |   2    |   3    |   4     |
 *    | image_select | —      |   2    |   3    |   4     |
 *    | scale (1–5)  | —      |   5    |   5    |   5     |
 */
export function QuestionRendererV2({
  question,
  currentAnswer,
  onAnswer,
  allAnswers,
}: QuestionRendererV2Props) {
  const visibleOptions = getVisibleOptions(question, allAnswers);
  const exclusiveIds = getExclusiveOptions(question).map(o => o.id);
  const recordExclusivityEvent = useAssessmentStore(s => s.recordExclusivityEvent);

  const [deselectedHint, setDeselectedHint] = useState<string | null>(null);

  const hasDescriptions = visibleOptions.some(o => !!o.description);
  const optionCount = visibleOptions.length;
  const tier = question.presentationTier ?? 'standard';

  // ── Label-length signal (drives adaptive card density) ────────────────────
  // The maximum label length across visible options determines the floor for
  // density. We pick max (not avg) because a grid must be sized for its
  // longest item — anything else leads to overflow or ragged rows.
  //   0–25 chars  → tile  (4-col on desktop)
  //   26–40 chars → card  (3-col on desktop)
  //   41+ chars   → feature (2-col on desktop, subtitle space)
  const labelLengthDensity: 'tile' | 'card' | 'feature' = useMemo(() => {
    const maxLen = visibleOptions.reduce(
      (n, o) => Math.max(n, (o.label ?? '').length),
      0,
    );
    if (maxLen >= 41) return 'feature';
    if (maxLen >= 26) return 'card';
    return 'tile';
  }, [visibleOptions]);

  // Tier → presentation primitives. Editorial display sizes — Fraunces shines
  // at large sizes; we lean into it. A tier change is a single class swap.
  const tierStyles = useMemo(() => {
    switch (tier) {
      case 'high_impact':
        return {
          heading: 'font-display font-medium text-[32px] sm:text-[44px] lg:text-[60px]',
          headGap: 'gap-4',
          bodyTop: 'mt-10 sm:mt-12',
          gridGap: 'gap-4 sm:gap-5',
          densityOverride: 'feature' as const,
        };
      case 'compact':
        return {
          heading: 'font-display font-medium text-[22px] sm:text-[28px] lg:text-[34px]',
          headGap: 'gap-2',
          bodyTop: 'mt-6',
          gridGap: 'gap-2.5 sm:gap-3',
          densityOverride: 'tile' as const,
        };
      default:
        return {
          heading: 'font-display font-medium text-[26px] sm:text-[36px] lg:text-[46px]',
          headGap: 'gap-3',
          bodyTop: 'mt-8 sm:mt-10',
          gridGap: 'gap-3 sm:gap-4',
          densityOverride: null,
        };
    }
  }, [tier]);

  // Decide grid + density
  // Adaptive rules (in order of precedence):
  //   1. `scale` → fixed 5-col tile row.
  //   2. `image_select` → 2/3/4 photo grid, card density.
  //   3. Otherwise: density is the *max* of label-length-density and
  //      description-presence — so a single overflowing option drags the
  //      whole grid to `feature` rather than truncating.
  //   4. Grid columns derive from density (prioritise readability, not
  //      density — short labels get 4 cols, mixed 3, feature 2).
  const { gridClass, density } = useMemo(() => {
    if (question.type === 'scale') {
      return { gridClass: 'grid-cols-5', density: 'tile' as const };
    }
    if (question.type === 'image_select') {
      return {
        gridClass: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        density: 'card' as const,
      };
    }

    const rank = { tile: 0, card: 1, feature: 2 } as const;
    const fromDescriptions: 'tile' | 'card' | 'feature' =
      hasDescriptions ? 'card' : 'tile';
    const chosen: 'tile' | 'card' | 'feature' =
      rank[labelLengthDensity] >= rank[fromDescriptions]
        ? labelLengthDensity
        : fromDescriptions;

    if (chosen === 'feature') {
      return {
        gridClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3',
        density: 'feature' as const,
      };
    }
    if (chosen === 'card') {
      return {
        gridClass: optionCount <= 6
          ? 'grid-cols-2 md:grid-cols-3'
          : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-3',
        density: 'card' as const,
      };
    }
    // tile
    return {
      gridClass: optionCount <= 4
        ? 'grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      density: 'tile' as const,
    };
  }, [question.type, optionCount, hasDescriptions, labelLengthDensity]);

  const isSelectType =
    question.type === 'single_select' ||
    question.type === 'multi_select' ||
    question.type === 'image_select' ||
    question.type === 'scale';

  const handleSelect = (optionId: string) => {
    if (question.type === 'multi_select') {
      const arr: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
      if (question.mutualExclusivityGroups?.length) {
        const autoDeselected = computeGroupExclusivityDeselections(
          arr, optionId, question.mutualExclusivityGroups,
        );
        if (autoDeselected.length > 0) {
          recordExclusivityEvent({
            questionId: question.id, selected: optionId, deselected: autoDeselected,
          });
          if (question.mutualExclusivityToast) {
            setDeselectedHint(question.mutualExclusivityToast);
            setTimeout(() => setDeselectedHint(null), 2500);
          }
        }
        onAnswer(applyGroupExclusivity(arr, optionId, question.mutualExclusivityGroups, exclusiveIds));
      } else {
        onAnswer(applyMultiSelectRules(arr, optionId, exclusiveIds));
      }
    } else {
      onAnswer(optionId);
    }
  };

  return (
    <motion.section
      key={question.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-col"
      aria-labelledby={`q-${question.id}-title`}
    >
      {/* ── HEAD ─────────────────────────────────────────────────────────── */}
      <header className={cn('flex flex-col', tierStyles.headGap)}>
        {question.sectionTitle && (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden />
            {question.sectionTitle}
          </div>
        )}
        <motion.h1
          id={`q-${question.id}-title`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            'tracking-tight text-slate-900 leading-[1.04]',
            tierStyles.heading,
          )}
        >
          {question.title}
        </motion.h1>
        {question.subtitle ? (
          <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-[60ch]">
            {question.subtitle}
          </p>
        ) : question.type === 'multi_select' ? (
          <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-[60ch]">
            Select all that apply.
          </p>
        ) : null}

      </header>

      {/* ── EXCLUSIVITY HINT ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {deselectedHint && (
          <motion.div
            key="ex-hint"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            role="status"
            aria-live="polite"
            className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-violet-50 border border-violet-200 px-3 py-1.5 text-sm font-medium text-violet-700"
          >
            <span aria-hidden>↺</span>
            {deselectedHint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className={tierStyles.bodyTop}>
        {question.type === 'text' && (
          <div className="relative">
            <Input
              type="text"
              placeholder={question.validation?.placeholder ?? 'Type your answer…'}
              value={currentAnswer ?? ''}
              onChange={(e) => onAnswer(formatTextInput(e.target.value, question.uiFormat))}
              className="h-16 sm:h-[68px] text-xl px-6 pr-16 rounded-2xl border-2 border-slate-200 bg-white focus-visible:border-slate-900 focus-visible:ring-0"
            />
            <div className="absolute top-1/2 -translate-y-1/2 right-3">
              <VoiceDictateButton
                value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onChange={(next) => onAnswer(formatTextInput(next, question.uiFormat))}
                iconSize={18}
              />
            </div>
          </div>
        )}

        {question.type === 'number' && (() => {
          const min = question.validation?.min;
          const max = question.validation?.max;
          const numericAnswer =
            typeof currentAnswer === 'number'
              ? currentAnswer
              : currentAnswer === '' || currentAnswer == null
                ? null
                : Number(currentAnswer);
          const outOfRange =
            numericAnswer != null &&
            Number.isFinite(numericAnswer) &&
            ((min != null && numericAnswer < min) || (max != null && numericAnswer > max));
          const rangeMessage =
            min != null && max != null
              ? `Please enter a value between ${min} and ${max}.`
              : min != null
                ? `Please enter a value of ${min} or more.`
                : max != null
                  ? `Please enter a value of ${max} or less.`
                  : null;
          return (
            <div>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 28"
                value={currentAnswer ?? ''}
                onChange={(e) => onAnswer(e.target.value === '' ? '' : Number(e.target.value))}
                min={min}
                max={max}
                aria-invalid={outOfRange || undefined}
                className={cn(
                  'h-16 sm:h-[68px] text-2xl tabular-nums px-6 rounded-2xl border-2 bg-white focus-visible:ring-0',
                  outOfRange
                    ? 'border-rose-400 focus-visible:border-rose-500'
                    : 'border-slate-200 focus-visible:border-slate-900',
                )}
              />
              {outOfRange && rangeMessage && (
                <p className="mt-2 text-sm font-medium text-rose-600">{rangeMessage}</p>
              )}
            </div>
          );
        })()}

        {question.type === 'textarea' && (
          <div className="relative">
            <Textarea
              placeholder="Start typing…"
              value={currentAnswer ?? ''}
              onChange={(e) => onAnswer(e.target.value)}
              className="min-h-[180px] text-lg p-6 pr-16 rounded-2xl border-2 border-slate-200 bg-white resize-none focus-visible:border-slate-900 focus-visible:ring-0"
            />
            <div className="absolute top-4 right-4">
              <VoiceDictateButton
                value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onChange={(next) => onAnswer(next)}
                iconSize={18}
              />
            </div>
          </div>
        )}

        {question.type === 'image_upload' && (
          <label
            className={cn(
              'flex flex-col items-center justify-center gap-3',
              'rounded-3xl border-2 border-dashed border-slate-300 bg-white/70',
              'py-12 px-8 cursor-pointer hover:border-slate-900 transition-colors',
            )}
          >
            <span className="w-16 h-16 rounded-full bg-slate-900 text-white grid place-items-center">
              <UploadCloud className="w-7 h-7" />
            </span>
            <span className="text-lg font-semibold text-slate-900">Tap to add photo</span>
            <span className="text-sm text-slate-500">Use your camera or pick from gallery</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.length && onAnswer('uploaded_file_url_mock')}
            />
          </label>
        )}

        {isSelectType && (
          <div
            role={question.type === 'multi_select' ? 'group' : 'radiogroup'}
            aria-label={question.title}
            className={cn('grid', tierStyles.gridGap, gridClass)}
          >
            {visibleOptions.map((option) => {
              const isSelected = Array.isArray(currentAnswer)
                ? currentAnswer.includes(option.id)
                : currentAnswer === option.id;
              return (
                <OptionCardV2
                  key={option.id}
                  option={option}
                  isSelected={isSelected}
                  multi={question.type === 'multi_select'}
                  density={tierStyles.densityOverride ?? density}
                  onSelect={() => handleSelect(option.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}
