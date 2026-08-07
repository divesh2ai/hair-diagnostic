'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import styles from './MobileProgressiveBridge.module.css';

/**
 * Mobile-only progressive bridge.
 *
 * Renders the tall vertical artwork inside a fixed-height viewport and
 * translates it vertically so the currently active stage sits at ~46% of
 * the viewport height. Only one active orb is centred at a time; a small
 * sliver of the previous and next stages remains visible.
 */

const IMG_SRC = '/design-preview/biological-bridge/mobile-progress.png';
const IMG_NATURAL_W = 941;
const IMG_NATURAL_H = 1672;

/**
 * Y centres of each chapter's focal point in the source asset, expressed as
 * % of natural image height. Chapter 1 (Patient Identity) has no orb baked
 * into the artwork — it anchors to the top edge (Y_PCT ≈ 0), which the
 * clamp holds at offset 0 so the "start" of the journey is framed with the
 * first orb hovering just below centre.
 *
 * Values measured against the current 941×1672 vertical asset, where the
 * seven orbs are distributed from ~10% to ~81% of the image height.
 *
 * Index → chapter:
 *   0 Patient Identity      · 1 Biological Factors    · 2 Lifestyle Habits
 *   3 Stress & Mental       · 4 Hormonal Balance      · 5 Nutritional Status
 *   6 Scalp Health          · 7 Environmental Factors
 */
const ORB_Y_PCT: readonly number[] = [0, 10.2, 22.1, 34.0, 45.9, 57.1, 69.1, 81.1];

const ACTIVE_ORB_VIEWPORT_PCT = 0.46;

export interface MobileProgressiveBridgeProps {
  /** 0-based active stage index (0..6). Values outside range are clamped. */
  activeIndex: number;
  reducedMotion?: boolean;
  className?: string;
}

export function MobileProgressiveBridge({
  activeIndex,
  reducedMotion,
  className,
}: MobileProgressiveBridgeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [renderedHeight, setRenderedHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      // Rendered image height = width scaled to the asset's natural aspect,
      // matching `width: 100%; height: auto` on the <img>. No stretch.
      setRenderedHeight((width * IMG_NATURAL_H) / IMG_NATURAL_W);
      setViewportHeight(height);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Preload asset so the first paint isn't flash-of-blank.
  useEffect(() => {
    const probe = new window.Image();
    probe.src = IMG_SRC;
  }, []);

  const safeIndex = Math.max(0, Math.min(ORB_Y_PCT.length - 1, activeIndex));
  const orbYPx = renderedHeight * (ORB_Y_PCT[safeIndex] / 100);
  const target = orbYPx - viewportHeight * ACTIVE_ORB_VIEWPORT_PCT;
  const maxOffset = Math.max(0, renderedHeight - viewportHeight);
  const offset = Math.max(0, Math.min(maxOffset, target));

  const classes = [
    styles.viewport,
    reducedMotion ? styles.reduced : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={viewportRef}
      className={classes}
      data-active-stage={safeIndex + 1}
      aria-hidden="true"
    >
      <div
        className={styles.artwork}
        style={{ transform: `translate3d(0, ${-offset}px, 0)` }}
      >
        <img
          className={styles.image}
          src={IMG_SRC}
          alt=""
          width={IMG_NATURAL_W}
          height={IMG_NATURAL_H}
          decoding="async"
          draggable={false}
        />
      </div>
      <div className={styles.pastShade} />
      <div className={styles.futureShade} />
      <div className={styles.activeGlow} />
    </div>
  );
}
