'use client';

/* eslint-disable @next/next/no-img-element -- Layered static artwork must share identical geometry for the reveal mask. */
import type { CSSProperties } from 'react';

import type { ProgressState } from '@/runtime/progressEngine';

import styles from './assessment-v3.module.css';

const ASSET_ROOT = '/design-preview/assessment-v3';

interface HairProgressV3Props {
  progress: ProgressState;
  sectionTitle: string;
}

export function HairProgressV3({ progress, sectionTitle }: HairProgressV3Props) {
  const label = `Question ${progress.visiblePosition} of ${progress.visibleTotal}`;
  // Percentage kept in the accessible value text only — hidden from the visible label.
  const ariaText = `${label} · ${progress.percentage}%`;
  // Keep the woman's portrait visible at the start, then reveal more of the
  // strand after every completed question.
  const visualProgress = 18 + progress.percentage * 0.82;
  const progressStyle = {
    '--hair-progress': `${visualProgress}%`,
  } as CSSProperties;

  return (
    <section
      className={styles.progress}
      aria-label="Assessment progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percentage}
      aria-valuetext={ariaText}
      role="progressbar"
      style={progressStyle}
    >
      <div className={styles.progressMeta}>
        <span>{sectionTitle}</span>
        <strong aria-live="polite">{label}</strong>
      </div>
      <div className={styles.strand} aria-hidden="true">
        <img
          className={styles.strandLayer}
          src={`${ASSET_ROOT}/strand/hair-progress.webp`}
          alt=""
          width={1550}
          height={359}
        />
        <span className={styles.strandReveal}>
          <img
            className={styles.strandLayer}
            src={`${ASSET_ROOT}/strand/hair-progress.webp`}
            alt=""
            width={1550}
            height={359}
          />
        </span>
      </div>
    </section>
  );
}