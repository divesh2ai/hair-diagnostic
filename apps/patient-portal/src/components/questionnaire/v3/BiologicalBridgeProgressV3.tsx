'use client';

import { useEffect, useState, type CSSProperties } from 'react';

import { BRIDGE_TRIGGERS, triggerForProgress } from './bridgeStages';
import { MobileProgressiveBridge } from './MobileProgressiveBridge';

import styles from './BiologicalBridgeProgressV3.module.css';

const REFERENCE_ART = '/design-preview/biological-bridge/reference-hero-revised.png';

/**
 * Bridge + orb = the metaphor. The whole scene must be visible at every
 * viewport, on every question. The revised hero (2996×525, a wide banner
 * strip) is rendered at its native aspect and the band is exactly as tall as
 * that shape needs. No horizontal pan anywhere; progress is carried by the
 * reveal mask that repairs the bridge left→right and by the active-trigger
 * glow that travels across the orb row.
 */

export interface BiologicalBridgeProgressV3Props {
  progress: number;
  sectionTitle: string;
  visiblePosition: number;
  visibleTotal: number;
  reducedMotion?: boolean;
  compact?: boolean;
}

export function BiologicalBridgeProgressV3({
  progress,
  sectionTitle,
  visiblePosition,
  visibleTotal,
  reducedMotion,
  compact,
}: BiologicalBridgeProgressV3Props) {
  const clamped = Math.max(0, Math.min(100, progress));
  const active = triggerForProgress(clamped);

  const [imageOk, setImageOk] = useState(true);
  useEffect(() => {
    // Probe the asset once so the CSS background-image fallback kicks in
    // reliably if it 404s (matches the previous <img onError> behavior).
    const probe = new Image();
    probe.onerror = () => setImageOk(false);
    probe.src = REFERENCE_ART;
  }, []);

  // No pan → trigger's on-screen X = its position within the image, because
  // the image fills the container edge-to-edge (background-size: 100% auto).
  const triggerScreenPct = active.imagePct;

  const style = {
    '--frontier': `${clamped}%`,
  } as CSSProperties;

  const label = `Question ${visiblePosition} of ${visibleTotal}`;
  const ariaText = `${label} · ${active.label}`;

  return (
    <section
      className={`${styles.band} ${reducedMotion ? styles.reduced : ''} ${compact ? styles.compact : ''}`}
      style={style}
      role="progressbar"
      aria-label="Assessment progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-valuetext={ariaText}
      data-progress={Math.round(clamped)}
      data-trigger={active.id}
    >
      <div className={styles.meta}>
        <span className={styles.metaLabel}>{sectionTitle}</span>
        <strong className={styles.metaCount} aria-live="polite">
          {label}
        </strong>
      </div>

      <div className={styles.mobileArt} aria-hidden="true">
        <MobileProgressiveBridge
          activeIndex={active.index - 1}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className={styles.art}>
        {imageOk ? (
          <>
            {/* Base layer = the "damaged / not yet repaired" bridge: full
                image, dimmed. The revised hero is pre-trimmed vertically so
                background-position is a neutral 50% 50% (no crop bias). */}
            <div
              className={styles.layerBase}
              style={{ backgroundPosition: '50% 50%' }}
              aria-hidden="true"
            />

            {/* Reveal layer = the "repaired" bridge: same image, full colour,
                masked so only [0 → clamped%] of container width paints. As
                progress grows, the bright bridge extends from left to right
                on top of the dim base. */}
            <div
              className={styles.layerReveal}
              style={{
                backgroundPosition: '50% 18%',
                WebkitMaskImage: `linear-gradient(to right, #000 0, #000 calc(${clamped}% - 3%), transparent calc(${clamped}% + 3%), transparent 100%)`,
                maskImage: `linear-gradient(to right, #000 0, #000 calc(${clamped}% - 3%), transparent calc(${clamped}% + 3%), transparent 100%)`,
              }}
              aria-hidden="true"
            />

            {/* Soft top/bottom vignette, grounds the strip into the dark band. */}
            <div className={styles.artMask} aria-hidden="true" />

            {/* Active-trigger glow — a subtle radial bloom pinned to the
                current orb's actual on-screen position (which drifts as we
                pan). No hard scale on the image; the glow is the "focus" cue.
                `left` is set inline because Chromium won't animate a var()
                inside a <length-percentage> for the `left` property. */}
            <div
              className={styles.activeGlow}
              style={{ left: `${triggerScreenPct}%` }}
              aria-hidden="true"
            />
          </>
        ) : (
          <div className={styles.fallback} aria-hidden="true">
            <div className={styles.fallbackInner}>
              <strong>Reference art pending</strong>
              <code>{REFERENCE_ART}</code>
            </div>
          </div>
        )}

        {imageOk && (
          <div className={styles.stageOverlay} aria-hidden="true">
            <h2 className={styles.stageTitle}>{active.label}</h2>
          </div>
        )}
      </div>

      <span className={styles.srOnly}>
        {`${label} · ${active.index} of ${BRIDGE_TRIGGERS.length} · ${active.label}`}
      </span>
    </section>
  );
}
