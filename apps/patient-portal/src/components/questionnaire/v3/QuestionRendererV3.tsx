'use client';

import { useMemo, useState } from 'react';

import { VoiceDictateButton } from '@/components/shared/VoiceDictateButton';
import {
  applyGroupExclusivity,
  applyMultiSelectRules,
  computeGroupExclusivityDeselections,
  getExclusiveOptions,
  getVisibleOptions,
} from '@/runtime/optionFilterEngine';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import type { Question } from '@/types/questionnaire';

import { OptionCardV3 } from './OptionCardV3';
import { StorageUploadV3 } from './StorageUploadV3';
import styles from './assessment-v3.module.css';

function formatTextInput(raw: string, format?: 'name' | 'number' | 'text'): string {
  if (format !== 'name') return raw;
  const cleaned = raw.replace(/[^A-Za-z\s.'-]/g, '').replace(/^\s+/, '');
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s.'-])([a-z])/g, (_, separator: string, character: string) =>
      separator + character.toUpperCase(),
    );
}

interface QuestionRendererV3Props {
  question: Question;
  currentAnswer: unknown;
  onAnswer: (answer: unknown) => void;
  allAnswers: Record<string, unknown>;
  questionNumber: number;
  clinicSlug: string;
}

export function QuestionRendererV3({
  question,
  currentAnswer,
  onAnswer,
  allAnswers,
  questionNumber,
  clinicSlug,
}: QuestionRendererV3Props) {
  const visibleOptions = getVisibleOptions(question, allAnswers);
  const exclusiveIds = getExclusiveOptions(question).map((option) => option.id);
  const recordExclusivityEvent = useAssessmentStore((state) => state.recordExclusivityEvent);
  const [deselectedHint, setDeselectedHint] = useState<string | null>(null);

  const { density, gridClass } = useMemo(() => {
    if (question.type === 'scale') {
      return { density: 'tile' as const, gridClass: styles.optionGridScale };
    }
    if (question.type === 'image_select') {
      return { density: 'card' as const, gridClass: styles.optionGridImage };
    }

    const longestLabel = visibleOptions.reduce(
      (maximum, option) => Math.max(maximum, option.label.length),
      0,
    );
    const hasDescriptions = visibleOptions.some((option) => Boolean(option.description));
    const resolvedDensity =
      longestLabel >= 41 ? 'feature' : longestLabel >= 26 || hasDescriptions ? 'card' : 'tile';

    return {
      density: resolvedDensity as 'tile' | 'card' | 'feature',
      gridClass:
        resolvedDensity === 'feature'
          ? styles.optionGridFeature
          : resolvedDensity === 'card'
            ? styles.optionGridCard
            : styles.optionGridTile,
    };
  }, [question.type, visibleOptions]);

  const handleSelect = (optionId: string) => {
    if (question.type !== 'multi_select') {
      onAnswer(optionId);
      return;
    }

    const selected = Array.isArray(currentAnswer) ? (currentAnswer as string[]) : [];
    if (question.mutualExclusivityGroups?.length) {
      const autoDeselected = computeGroupExclusivityDeselections(
        selected,
        optionId,
        question.mutualExclusivityGroups,
      );
      if (autoDeselected.length > 0) {
        recordExclusivityEvent({
          questionId: question.id,
          selected: optionId,
          deselected: autoDeselected,
        });
        if (question.mutualExclusivityToast) {
          setDeselectedHint(question.mutualExclusivityToast);
          window.setTimeout(() => setDeselectedHint(null), 2500);
        }
      }
      onAnswer(
        applyGroupExclusivity(
          selected,
          optionId,
          question.mutualExclusivityGroups,
          exclusiveIds,
        ),
      );
      return;
    }

    onAnswer(applyMultiSelectRules(selected, optionId, exclusiveIds));
  };

  const isSelectType = ['single_select', 'multi_select', 'image_select', 'scale'].includes(
    question.type,
  );
  const numberValue =
    typeof currentAnswer === 'number'
      ? currentAnswer
      : currentAnswer === '' || currentAnswer == null
        ? null
        : Number(currentAnswer);
  const outOfRange =
    question.type === 'number' &&
    numberValue != null &&
    Number.isFinite(numberValue) &&
    ((question.validation?.min != null && numberValue < question.validation.min) ||
      (question.validation?.max != null && numberValue > question.validation.max));

  return (
    <section className={styles.question} aria-labelledby={`v3-question-${question.id}`}>
      <header className={styles.questionCopy}>
        <span className={styles.questionNumber}>QUESTION {String(questionNumber).padStart(2, '0')}</span>
        <h1 id={`v3-question-${question.id}`}>{question.title}</h1>
        {(question.subtitle || question.type === 'multi_select') && (
          <p>{question.subtitle ?? 'Select all that apply.'}</p>
        )}
      </header>

      {deselectedHint && (
        <p className={styles.statusHint} role="status" aria-live="polite">
          {deselectedHint}
        </p>
      )}

      <div className={styles.answerArea}>
        {question.type === 'text' && (
          <div className={styles.textControlWrap}>
            <label className={styles.srOnly} htmlFor={`v3-input-${question.id}`}>
              {question.title}
            </label>
            <input
              id={`v3-input-${question.id}`}
              className={styles.textControl}
              type="text"
              placeholder={question.validation?.placeholder ?? 'Type your answer…'}
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              minLength={question.validation?.minLength}
              maxLength={question.validation?.maxLength}
              onChange={(event) => onAnswer(formatTextInput(event.target.value, question.uiFormat))}
            />
            <span className={styles.voiceControl}>
              <VoiceDictateButton
                value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onChange={(next) => onAnswer(formatTextInput(next, question.uiFormat))}
                iconSize={18}
              />
            </span>
          </div>
        )}

        {question.type === 'number' && (
          <div>
            <label className={styles.srOnly} htmlFor={`v3-input-${question.id}`}>
              {question.title}
            </label>
            <input
              id={`v3-input-${question.id}`}
              className={`${styles.textControl} ${outOfRange ? styles.textControlInvalid : ''}`}
              type="number"
              inputMode="numeric"
              placeholder={question.validation?.placeholder ?? 'e.g. 28'}
              value={typeof currentAnswer === 'number' || typeof currentAnswer === 'string' ? currentAnswer : ''}
              min={question.validation?.min}
              max={question.validation?.max}
              aria-invalid={outOfRange || undefined}
              aria-describedby={outOfRange ? `v3-error-${question.id}` : undefined}
              onChange={(event) => onAnswer(event.target.value === '' ? '' : Number(event.target.value))}
            />
            {outOfRange && (
              <p id={`v3-error-${question.id}`} className={styles.errorText}>
                {question.validation?.errorMessage ??
                  `Please enter a value between ${question.validation?.min ?? 'the minimum'} and ${question.validation?.max ?? 'the maximum'}.`}
              </p>
            )}
          </div>
        )}

        {question.type === 'textarea' && (
          <div className={styles.textControlWrap}>
            <label className={styles.srOnly} htmlFor={`v3-input-${question.id}`}>
              {question.title}
            </label>
            <textarea
              id={`v3-input-${question.id}`}
              className={`${styles.textControl} ${styles.textareaControl}`}
              placeholder={question.validation?.placeholder ?? 'Start typing…'}
              value={typeof currentAnswer === 'string' ? currentAnswer : ''}
              minLength={question.validation?.minLength}
              maxLength={question.validation?.maxLength}
              onChange={(event) => onAnswer(event.target.value)}
            />
            <span className={`${styles.voiceControl} ${styles.voiceControlTextarea}`}>
              <VoiceDictateButton
                value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onChange={onAnswer}
                iconSize={18}
              />
            </span>
          </div>
        )}

        {question.type === 'image_upload' && (
          <StorageUploadV3
            questionId={question.id}
            clinicSlug={clinicSlug}
            value={currentAnswer}
            onChange={onAnswer}
          />
        )}

        {isSelectType && (
          <div
            className={`${styles.optionGrid} ${gridClass}`}
            role={question.type === 'multi_select' ? 'group' : 'radiogroup'}
            aria-label={question.title}
          >
            {visibleOptions.map((option) => (
              <OptionCardV3
                key={option.id}
                option={option}
                isSelected={
                  Array.isArray(currentAnswer)
                    ? currentAnswer.includes(option.id)
                    : currentAnswer === option.id
                }
                multi={question.type === 'multi_select'}
                density={density}
                onSelect={() => handleSelect(option.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
