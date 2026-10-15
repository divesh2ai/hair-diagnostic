'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';

import type { SectionIntroContent } from '@/components/questionnaire/v2/insightRules';
import { useAssessmentTranslator } from '@/lib/assessment-i18n';

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
  S1_PATIENT_IDENTITY: {
    slug: 'identity-comp',
    alt: 'Chapter 1 — Patient Identity',
    focalDesktop: '85% 70%',
    focalMobile: 'center bottom',
  },
  S2_HAIR_LOSS_ASSESSMENT: {
    slug: 'hair-history',
    alt: 'Chapter 2 — Hair History',
    focalDesktop: '85% 70%',
    focalMobile: 'center bottom',
  },
  S3_SCALP_CONDITION: {
    slug: 'symptoms-comp',
    alt: 'Chapter 3 — Symptoms',
    focalDesktop: '85% 70%',
    focalMobile: 'center bottom',
  },
  S4_MEDICAL_HISTORY: {
    slug: 'lifestyle-comp',
    alt: 'Chapter 4 — Lifestyle',
    focalDesktop: '85% 70%',
    focalMobile: 'center bottom',
  },
  S5_NUTRITION_AND_DIET: {
    slug: 'nutrition',
    alt: 'Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl.',
  },
  nutrition: {
    slug: 'nutrition',
    alt: 'Amla, pomegranate, almonds, pumpkin seeds and leafy greens arranged in a dark ceramic bowl.',
  },
  S6_GRADE_AND_ADDITIONAL: {
    slug: 'the-final-picture',
    alt: 'Chapter 6 — The Final Picture: an open journal beside a mirror, candle and olive branches.',
    focalDesktop: '85% 70%',
    focalMobile: 'center bottom',
  },
};

interface ChapterTransitionV3Props {
  content: SectionIntroContent;
  sectionIndex: number;
  sectionTotal: number;
  sectionId?: string;
  onContinue: () => void;
  isFinalChapter?: boolean;
}

export function ChapterTransitionV3({
  content,
  sectionIndex,
  sectionId,
  onContinue,
  isFinalChapter = false,
}: ChapterTransitionV3Props) {
  const { t } = useAssessmentTranslator();
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
          aria-label={t('questionnaire.chapterAriaLabel', { title: content.title })}
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
        <h1 id={`v3-chapter-${sectionId ?? content.id}`}>{content.title}</h1>
        <p>{content.body}</p>
        <button className={styles.chapterButton} type="button" onClick={onContinue} autoFocus>
          {isFinalChapter
            ? t('questionnaire.beginFinalChapter')
            : t('questionnaire.beginChapter')}{' '}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <span className={styles.chapterIndex} aria-hidden="true">{indexLabel}</span>
    </section>
  );
}

// Unique chapter artwork slugs (nutrition appears under two keys).
const CHAPTER_SLUGS: readonly string[] = Array.from(
  new Set(Object.values(CHAPTER_ARTWORK).map((a) => a.slug)),
);

/**
 * Warm the chapter artwork cache while the patient is answering questions.
 *
 * Each chapter transition is a full-screen image. Rendered cold, it starts
 * downloading only when the transition mounts, so the patient watches it load —
 * the "chapter image loads slowly" the clinic saw. This mounts hidden <picture>
 * elements that request the EXACT same sources the real transition will (same
 * media + type, so avif/webp and mobile/desktop all match, no wasted bytes and
 * no 404s), so by the time each transition appears its image is already cached.
 *
 * Deferred to idle time so it never competes with the question the patient is
 * actually looking at, and it fetches nothing until after first paint.
 */
export function ChapterArtworkPrefetch() {
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let handle: number;
    let idle = false;
    if (w.requestIdleCallback) {
      idle = true;
      handle = w.requestIdleCallback(() => setWarm(true), { timeout: 2500 });
    } else {
      handle = window.setTimeout(() => setWarm(true), 1200);
    }
    return () => {
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  if (!warm) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        left: -9999,
        top: 0,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {CHAPTER_SLUGS.map((slug) => (
        <picture key={slug}>
          <source
            media="(max-width: 700px)"
            type="image/avif"
            srcSet={`${ASSET_ROOT}/chapters/${slug}-mobile.avif`}
          />
          <source
            media="(max-width: 700px)"
            type="image/webp"
            srcSet={`${ASSET_ROOT}/chapters/${slug}-mobile.webp`}
          />
          <source type="image/avif" srcSet={`${ASSET_ROOT}/chapters/${slug}-desktop.avif`} />
          <img
            src={`${ASSET_ROOT}/chapters/${slug}-desktop.webp`}
            alt=""
            width={1}
            height={1}
            loading="eager"
            decoding="async"
          />
        </picture>
      ))}
    </div>
  );
}
