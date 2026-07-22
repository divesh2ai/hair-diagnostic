'use client';

import type { ProgressState } from '@/runtime/progressEngine';

import styles from './assessment-v3.module.css';

const ASSET_ROOT = '/design-preview/assessment-v3';

interface HairProgressV3Props {
  progress: ProgressState;
  sectionTitle: string;
}

export function HairProgressV3({ progress, sectionTitle }: HairProgressV3Props) {
  const label = `Question ${progress.visiblePosition} of ${progress.visibleTotal} · ${progress.percentage}%`;

  return (
    <section
      className={styles.progress}
      aria-label="Assessment progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percentage}
      aria-valuetext={label}
      role="progressbar"
    >
      <div className={styles.progressMeta}>
        <span>{sectionTitle}</span>
        <strong aria-live="polite">{label}</strong>
      </div>
      {/* Approved progressive-hair artwork: shown whole via object-fit: contain
          so the face, hair tip and dark→light gradient are never cropped. It is
          a single baked illustration (no percentage labels), not a live reveal. */}
      <div className={styles.strand} aria-hidden="true">
        <picture>
          <source type="image/avif" srcSet={`${ASSET_ROOT}/strand/hair-progress.avif`} />
          <source type="image/webp" srcSet={`${ASSET_ROOT}/strand/hair-progress.webp`} />
          <img
            className={styles.strandImage}
            src={`${ASSET_ROOT}/strand/hair-progress.png`}
            alt=""
            width={1550}
            height={359}
          />
        </picture>
      </div>
    </section>
  );
}
