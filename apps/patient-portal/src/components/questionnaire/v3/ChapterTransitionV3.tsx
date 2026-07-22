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
  /**
   * The artwork already has the chapter title + copy + CTA composited in
   * (a full designed screen). Render it whole via object-fit: contain with a
   * tap-to-advance hotspot, and suppress the live text overlay so nothing
   * duplicates or crops. Background-only art (like Nutrition) leaves this false
   * and gets the live, translatable text over the scrim.
   */
  bakedText?: boolean;
  /**
   * Letterbox/background colour for a bakedText screen whose aspect differs from
   * the viewport (contain leaves margins). Set to the art's edge colour so the
   * margins blend instead of showing a seam. Defaults to the forest ground.
   */
  bgColor?: string;
  /** object-position for background art (bakedText: false) desktop / mobile. */
  focalDesktop?: string;
  focalMobile?: string;
}

/**
 * Cohesive chapter-artwork system, keyed by protocol sectionId (content.id
 * fallback). Sections absent here fall back to the premium plain panel, so the
 * route never shows a broken image.
 *
 * Two treatments:
 *  - Nutrition = background-only photo + LIVE text over the scrim (the approved
 *    benchmark). Assets: {slug}-{desktop,mobile}{,@2x}.{avif,webp}.
 *  - Identity / Hair History / Symptoms / Lifestyle = full designed screens with
 *    text baked into the art (bakedText). Assets: {slug}-{desktop,mobile}.{avif,webp}.
 */
const CHAPTER_ARTWORK: Record<string, ChapterArtwork> = {
  S1_PATIENT_IDENTITY: { slug: 'identity-comp', alt: 'Chapter 1 — Patient Identity', bakedText: true },
  S2_HAIR_LOSS_ASSESSMENT: { slug: 'hair-history-comp', alt: 'Chapter 2 — Hair History', bakedText: true },
  S3_SCALP_CONDITION: { slug: 'symptoms-comp', alt: 'Chapter 3 — Symptoms', bakedText: true },
  S4_MEDICAL_HISTORY: { slug: 'lifestyle-comp', alt: 'Chapter 4 — Lifestyle', bakedText: true },
  S5_NUTRITION_AND_DIET: {
    slug: 'nutrition',
    alt: 'Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl.',
  },
  nutrition: {
    slug: 'nutrition',
    alt: 'Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl.',
  },
  S6_GRADE_AND_ADDITIONAL: {
    slug: 'completion-comp',
    alt: 'Chapter 6 — Completion',
    bakedText: true,
    // Art is a wide band; blend its contain margins to the dark olive edge.
    bgColor: '#0a1610',
  },
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

  // Full designed screen: the art carries all copy + CTA. Show it whole
  // (object-fit: contain, never cropped) with a full-area advance hotspot.
  if (artwork?.bakedText) {
    return (
      <section
        className={`${styles.chapterTransition} ${styles.chapterComp}`}
        style={artwork.bgColor ? { background: artwork.bgColor } : undefined}
        aria-labelledby={`v3-chapter-${sectionId ?? content.id}`}
      >
        <picture className={styles.chapterCompPicture}>
          <source
            media="(max-width: 700px)"
            type="image/avif"
            srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-mobile.avif`}
          />
          <source
            media="(max-width: 700px)"
            type="image/webp"
            srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-mobile.webp`}
          />
          <source type="image/avif" srcSet={`${ASSET_ROOT}/chapters/${artwork.slug}-desktop.avif`} />
          <img
            src={`${ASSET_ROOT}/chapters/${artwork.slug}-desktop.webp`}
            alt={artwork.alt}
            width={1586}
            height={992}
          />
        </picture>
        <h1 id={`v3-chapter-${sectionId ?? content.id}`} className={styles.srOnly}>
          {content.title}
        </h1>
        <button
          className={styles.chapterCompHit}
          type="button"
          onClick={onContinue}
          aria-label={`Begin chapter: ${content.title}`}
          autoFocus
        />
      </section>
    );
  }

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
