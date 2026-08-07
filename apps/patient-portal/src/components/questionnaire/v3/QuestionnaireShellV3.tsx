'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

import type { ProgressState } from '@/runtime/progressEngine';

import { BiologicalBridgeProgressV3 } from './BiologicalBridgeProgressV3';
import { HairProgressV3 } from './HairProgressV3';
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
  const forwardLabel = isSubmitting
    ? 'Analyzing your answers'
    : isLast
      ? 'Complete assessment'
      : 'Continue to next question';
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
          <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>

        <div className={styles.actionEnd}>
          {selectedCount > 0 && (
            <span className={styles.selectionCount}>{selectedCount} selected</span>
          )}
          {canContinue && !isSubmitting && (
            <span className={styles.enterHint} aria-hidden="true">
              Press <kbd>Enter</kbd> to continue
            </span>
          )}
          {onSkip && !canContinue && (
            <button className={styles.skipButton} type="button" onClick={onSkip}>
              Skip
            </button>
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
