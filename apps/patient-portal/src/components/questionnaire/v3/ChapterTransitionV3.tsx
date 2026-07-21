'use client';

import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';

import type { SectionIntroContent } from '@/components/questionnaire/v2/insightRules';

import styles from './assessment-v3.module.css';

const ASSET_ROOT = '/design-preview/assessment-v3';

interface ChapterArtwork {
  /** Asset basename under /chapters, e.g. "nutrition" → nutrition-desktop.webp. */
  slug: string;
  alt: string;
  /** object-position keeping the subject uncropped on desktop / mobile crops. */
  focalDesktop?: string;
  focalMobile?: string;
}

/**
 * Cohesive chapter-artwork system. Every entry renders the same cinematic,
 * full-bleed treatment as Nutrition — the approved visual benchmark: a layered
 * <picture> (art-directed mobile + desktop, avif→webp, 1x/2x) behind the shared
 * scrim and text negative space.
 *
 * Keyed by the protocol sectionId (with a content.id fallback). A section that
 * is NOT listed here gracefully falls back to the premium plain panel, so the
 * route never shows a broken image. To light up a chapter, add its optimized
 * assets under public/design-preview/assessment-v3/chapters/ (see
 * scripts/build-chapter-assets.mjs) and add its entry below.
 *
 * Asset contract per slug (matches Nutrition exactly):
 *   {slug}-desktop.{avif,webp}      1440×900
 *   {slug}-desktop@2x.{avif,webp}   2880×1800
 *   {slug}-mobile.{avif,webp}       585×1266
 *   {slug}-mobile@2x.{avif,webp}    1170×2532
 */
const CHAPTER_ARTWORK: Record<string, ChapterArtwork> = {
  S5_NUTRITION_AND_DIET: {
    slug: 'nutrition',
    alt: 'Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl.',
  },
  // Nutrition also keyed by its content.id fallback for robustness.
  nutrition: {
    slug: 'nutrition',
    alt: 'Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl.',
  },
  // Identity / Hair History / Symptoms / Lifestyle / Completion entries are
  // added here once their approved assets land — until then they render the
  // premium plain panel below.
};

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
  const artwork =
    (sectionId ? CHAPTER_ARTWORK[sectionId] : undefined) ?? CHAPTER_ARTWORK[content.id];
  const indexLabel = String(sectionIndex).padStart(2, '0');

  const focalStyle =
    artwork && (artwork.focalDesktop || artwork.focalMobile)
      ? ({
          '--chapter-focal': artwork.focalDesktop ?? 'center',
          '--chapter-focal-mobile': artwork.focalMobile ?? artwork.focalDesktop ?? 'center center',
        } as CSSProperties)
      : undefined;

  return (
    <section
      className={`${styles.chapterTransition} ${artwork ? '' : styles.chapterPlain}`}
      aria-labelledby={`v3-chapter-${sectionId ?? content.id}`}
    >
      {artwork && (
        <picture className={styles.chapterPicture} style={focalStyle}>
          <source
            media="(max-width: 700px)"
            type="image/avif"
            srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-mobile.avif 1x, ${ASSET_ROOT}/chapters/${artwork.slug}-mobile@2x.avif 2x`}
          />
          <source
            media="(max-width: 700px)"
            type="image/webp"
            srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-mobile.webp 1x, ${ASSET_ROOT}/chapters/${artwork.slug}-mobile@2x.webp 2x`}
          />
          <source
            type="image/avif"
            srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-desktop.avif 1x, ${ASSET_ROOT}/chapters/${artwork.slug}-desktop@2x.avif 2x`}
          />
          <img
            src={`${ASSET_ROOT}/chapters/${artwork.slug}-desktop.webp`}
            srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-desktop.webp 1x, ${ASSET_ROOT}/chapters/${artwork.slug}-desktop@2x.webp 2x`}
            alt={artwork.alt}
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
