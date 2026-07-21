'use client';

/* eslint-disable @next/next/no-img-element -- Layered strand artwork needs explicit <img> layers with fixed intrinsic sizes; next/image cannot stack the reveal mask this way. */

import type { CSSProperties } from 'react';

import type { ProgressState } from '@/runtime/progressEngine';

import styles from './assessment-v3.module.css';

const ASSET_ROOT = '/design-preview/assessment-v3';

interface HairProgressV3Props {
  progress: ProgressState;
  sectionTitle: string;
}

export function HairProgressV3({ progress, sectionTitle }: HairProgressV3Props) {
  const label = `Question ${progress.visiblePosition} of ${progress.visibleTotal} · ${progress.percentage}%`;
  const visualProgress = 18 + progress.percentage * 0.82;
  const progressStyle = {
    '--assessment-v3-progress': `${visualProgress}%`,
  } as CSSProperties;

  return (
    <section
      className={styles.progress}
      aria-label="Assessment progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percentage}
      aria-valuetext={label}
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
          src={`${ASSET_ROOT}/strand/hair-progress-base.webp`}
          alt=""
          width={2175}
          height={723}
        />
        <span className={styles.strandReveal}>
          <img
            className={styles.strandLayer}
            src={`${ASSET_ROOT}/strand/hair-progress-active.webp`}
            alt=""
            width={2175}
            height={723}
          />
        </span>
      </div>
    </section>
  );
}
