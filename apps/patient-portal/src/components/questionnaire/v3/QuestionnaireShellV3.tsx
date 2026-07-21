'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';

import type { ProgressState } from '@/runtime/progressEngine';

import { HairProgressV3 } from './HairProgressV3';
import styles from './assessment-v3.module.css';

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
}

export function QuestionnaireShellV3({
  clinicName,
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
}: QuestionnaireShellV3Props) {
  return (
    <div className={styles.assessmentShell}>
      <header className={styles.assessmentHeader}>
        <div className={styles.brand} aria-label="Dr. FACT Hair Health Diagnostic">
          <span className={styles.brandMark} aria-hidden="true">DF</span>
          <span className={styles.brandCopy}>
            <strong>Dr. FACT</strong>
            <small>{clinicName ?? 'Hair Health Diagnostic'}</small>
          </span>
        </div>
        <span className={styles.privacyNote}>
          <LockKeyhole size={13} aria-hidden="true" /> Private &amp; secure
        </span>
      </header>

      <HairProgressV3 progress={progress} sectionTitle={sectionTitle} />

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
          {onSkip && !canContinue && (
            <button className={styles.skipButton} type="button" onClick={onSkip}>
              Skip
            </button>
          )}
          <button
            className={styles.continueButton}
            type="button"
            onClick={onContinue}
            disabled={!canContinue || isSubmitting}
          >
            {isSubmitting ? (
              'Analyzing…'
            ) : isLast ? (
              <>Complete assessment <CheckCircle2 size={18} aria-hidden="true" /></>
            ) : (
              <>Continue <ArrowRight size={18} aria-hidden="true" /></>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
