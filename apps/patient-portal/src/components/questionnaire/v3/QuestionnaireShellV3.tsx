'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useAssessmentTranslator } from '@/lib/assessment-i18n';
import type { ProgressState } from '@/runtime/progressEngine';

import { BiologicalBridgeProgressV3 } from './BiologicalBridgeProgressV3';
import { HairProgressV3 } from './HairProgressV3';
import { LocaleSwitcherV3 } from './LocaleSwitcherV3';
import styles from './assessment-v3.module.css';

export type QuestionnaireVisualMode = 'hair' | 'bridge';

interface QuestionnaireShellV3Props {
  clinicName?: string;
  sectionTitle: string;
  progress: ProgressState;
  canGoBack: boolean;
  canContinue: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  selectedCount?: number;
  onBack: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  children: ReactNode;
  visualMode?: QuestionnaireVisualMode;
  compactProgress?: boolean;
  compactShell?: boolean;
}

export function QuestionnaireShellV3({
  clinicName: _clinicName,
  sectionTitle,
  progress,
  canGoBack,
  canContinue,
  isLast,
  isSubmitting,
  selectedCount = 0,
  onBack,
  onContinue,
  onSkip,
  children,
  visualMode = 'hair',
  compactProgress = false,
  compactShell = false,
}: QuestionnaireShellV3Props) {
  const { t } = useAssessmentTranslator();
  const forwardLabel = isSubmitting
    ? t('questionnaire.forwardSubmitting')
    : isLast
      ? t('questionnaire.forwardComplete')
      : t('questionnaire.forwardContinue');
  return (
    <div
      className={`${styles.assessmentShell} ${compactShell ? styles.assessmentShellCompact : ''}`}
    >
      {visualMode === 'bridge' ? (
        <BiologicalBridgeProgressV3
          progress={progress.percentage}
          sectionTitle={sectionTitle}
          visiblePosition={progress.visiblePosition}
          visibleTotal={progress.visibleTotal}
          compact={compactProgress}
          localeControl={<LocaleSwitcherV3 compact={compactProgress} />}
        />
      ) : (
        <HairProgressV3 progress={progress} sectionTitle={sectionTitle} />
      )}

      <main className={styles.questionStage}>{children}</main>

      <footer className={styles.questionActions}>
        <button
          className={styles.backButton}
          type="button"
          onClick={onBack}
          disabled={!canGoBack || isSubmitting}
        >
          <ArrowLeft size={18} aria-hidden="true" /> {t('common.back')}
        </button>

        <div className={styles.actionEnd}>
          {selectedCount > 0 && (
            <span className={styles.selectionCount}>
              {t('questionnaire.selectedCount', { count: selectedCount })}
            </span>
          )}
          {canContinue && !isSubmitting && (
            <span className={styles.enterHint} aria-hidden="true">
              {t('questionnaire.enterHintPrefix')} <kbd>Enter</kbd>{' '}
              {t('questionnaire.enterHintSuffix')}
            </span>
          )}
          {onSkip && !canContinue && (
            <button className={styles.skipButton} type="button" onClick={onSkip}>
              {t('common.skip')}
            </button>
          )}
          {/* A required, unanswered question previously showed nothing here —
              the forward control was simply disabled, leaving the patient to
              infer why. Say it instead, in their language. */}
          {!onSkip && !canContinue && !isSubmitting && (
            <span className={styles.requiredHint} role="status">
              {t('validation.required')}
            </span>
          )}
        </div>
      </footer>

      <button
        className={styles.floatingForward}
        type="button"
        onClick={onContinue}
        disabled={!canContinue || isSubmitting}
        aria-label={forwardLabel}
        title={forwardLabel}
      >
        {isSubmitting ? (
          <span className={styles.floatingForwardSpinner} aria-hidden="true" />
        ) : isLast ? (
          <CheckCircle2 size={30} aria-hidden="true" strokeWidth={2.2} />
        ) : (
          <ArrowRight size={30} aria-hidden="true" strokeWidth={2.4} />
        )}
      </button>
    </div>
  );
}
