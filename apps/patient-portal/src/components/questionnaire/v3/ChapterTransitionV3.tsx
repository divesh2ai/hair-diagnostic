'use client';

import { ArrowRight } from 'lucide-react';

import type { SectionIntroContent } from '@/components/questionnaire/v2/insightRules';

import styles from './assessment-v3.module.css';

const ASSET_ROOT = '/design-preview/assessment-v3';

interface ChapterTransitionV3Props {
  content: SectionIntroContent;
  sectionIndex: number;
  sectionTotal: number;
  sectionId?: string;
  onContinue: () => void;
}

export function ChapterTransitionV3({
  content,
  sectionIndex,
  sectionTotal,
  sectionId,
  onContinue,
}: ChapterTransitionV3Props) {
  const isNutrition = sectionId === 'S5_NUTRITION_AND_DIET' || content.id === 'nutrition';
  const indexLabel = String(sectionIndex).padStart(2, '0');

  return (
    <section
      className={`${styles.chapterTransition} ${isNutrition ? styles.chapterNutrition : styles.chapterPlain}`}
      aria-labelledby={`v3-chapter-${sectionId ?? content.id}`}
    >
      {isNutrition && (
        <picture className={styles.chapterPicture}>
          <source
            media="(max-width: 700px)"
            type="image/avif"
            srcSet={`${ASSET_ROOT}/chapters/nutrition-mobile.avif 1x, ${ASSET_ROOT}/chapters/nutrition-mobile@2x.avif 2x`}
          />
          <source
            media="(max-width: 700px)"
            type="image/webp"
            srcSet={`${ASSET_ROOT}/chapters/nutrition-mobile.webp 1x, ${ASSET_ROOT}/chapters/nutrition-mobile@2x.webp 2x`}
          />
          <source
            type="image/avif"
            srcSet={`${ASSET_ROOT}/chapters/nutrition-desktop.avif 1x, ${ASSET_ROOT}/chapters/nutrition-desktop@2x.avif 2x`}
          />
          <img
            src={`${ASSET_ROOT}/chapters/nutrition-desktop.webp`}
            srcSet={`${ASSET_ROOT}/chapters/nutrition-desktop.webp 1x, ${ASSET_ROOT}/chapters/nutrition-desktop@2x.webp 2x`}
            alt="Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl."
            width={1440}
            height={900}
          />
        </picture>
      )}
      <div className={styles.chapterScrim} aria-hidden="true" />
      <div className={styles.chapterCopy}>
        <span>CHAPTER {indexLabel} OF {String(sectionTotal).padStart(2, '0')}</span>
        <h1 id={`v3-chapter-${sectionId ?? content.id}`}>{content.title}</h1>
        <p>{content.body}</p>
        {content.estimateLabel && <small>{content.estimateLabel}</small>}
        <button className={styles.chapterButton} type="button" onClick={onContinue} autoFocus>
          Begin chapter <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <span className={styles.chapterIndex} aria-hidden="true">{indexLabel}</span>
    </section>
  );
}
