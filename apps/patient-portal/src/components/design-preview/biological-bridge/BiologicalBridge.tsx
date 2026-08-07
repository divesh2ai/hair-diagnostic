'use client';

/* eslint-disable @next/next/no-img-element -- Reference art is streamed from a public path; next/image adds no measurable benefit for a single decorative asset here. */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import styles from './BiologicalBridge.module.css';
import { BRIDGE_STAGES, stageForProgress, type BridgeStageId } from './stages';

export type BridgeMode = 'hero' | 'assessment';

export interface BiologicalBridgeProps {
  progress: number;
  mode?: BridgeMode;
  activeStage?: BridgeStageId;
  reducedMotion?: boolean;
  imageSrc?: string;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_ASSET = '/design-preview/biological-bridge/reference-hero.png';

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  variant: 'gold' | 'green' | 'red';
}

function buildParticles(): Particle[] {
  const out: Particle[] = [];
  const seeds = [
    { left: 8, top: 62, variant: 'red' as const },
    { left: 14, top: 78, variant: 'red' as const },
    { left: 22, top: 40, variant: 'gold' as const },
    { left: 28, top: 68, variant: 'gold' as const },
    { left: 34, top: 22, variant: 'gold' as const },
    { left: 41, top: 55, variant: 'gold' as const },
    { left: 48, top: 34, variant: 'gold' as const },
    { left: 55, top: 70, variant: 'gold' as const },
    { left: 62, top: 26, variant: 'gold' as const },
    { left: 68, top: 60, variant: 'green' as const },
    { left: 75, top: 42, variant: 'green' as const },
    { left: 82, top: 72, variant: 'green' as const },
    { left: 89, top: 34, variant: 'green' as const },
    { left: 94, top: 58, variant: 'green' as const },
  ];
  seeds.forEach((seed, index) => {
    out.push({
      id: index,
      left: seed.left,
      top: seed.top,
      size: 2 + ((index * 7) % 3),
      delay: (index * 0.43) % 4.5,
      duration: 5.5 + ((index * 1.7) % 4),
      drift: index % 2 === 0 ? -14 : 14,
      variant: seed.variant,
    });
  });
  return out;
}

const PARTICLES = buildParticles();

export function BiologicalBridge({
  progress,
  mode = 'assessment',
  activeStage,
  reducedMotion: reducedMotionProp,
  imageSrc = DEFAULT_ASSET,
  className,
  ariaLabel,
}: BiologicalBridgeProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const stage = useMemo(
    () => (activeStage ? BRIDGE_STAGES.find((s) => s.id === activeStage) : undefined) ?? stageForProgress(clamped),
    [activeStage, clamped],
  );

  const prefersReduced = useReducedMotion();
  const reduce = reducedMotionProp ?? Boolean(prefersReduced);

  const [imageOk, setImageOk] = useState(true);
  const [inView, setInView] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animateAmbient = !reduce && inView;

  const frameStyle = {
    '--frame-frontier': `${clamped}%`,
  } as CSSProperties;

  const showFallback = !imageOk;

  return (
    <div
      ref={rootRef}
      className={[
        styles.frame,
        mode === 'hero' ? styles.frameHero : '',
        clamped >= 100 ? styles.frameStatic : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-mode={mode}
      data-stage={stage.id}
      style={frameStyle}
      role="img"
      aria-label={
        ariaLabel ??
        (mode === 'hero'
          ? 'Microscopic biological environment with a bio-architectural bridge assembling across a follicular terrain.'
          : `Assessment progress ${Math.round(clamped)} percent. ${stage.title}.`)
      }
    >
      {showFallback ? (
        <div className={styles.fallback} aria-hidden="true">
          <div className={styles.fallbackInner}>
            <strong>Reference art pending</strong>
            <p>
              Save the approved biological-bridge reference PNG at the path below.
              The component will render it automatically on the next reload.
            </p>
            <code>{imageSrc}</code>
          </div>
        </div>
      ) : (
        <div className={styles.artLayer} aria-hidden="true">
          <img
            className={styles.artImage}
            src={imageSrc}
            alt=""
            width={1664}
            height={936}
            onError={() => setImageOk(false)}
            draggable={false}
          />
        </div>
      )}

      {/* Left-side scrim for hero copy legibility */}
      {mode === 'hero' && <div className={styles.copyScrim} aria-hidden="true" />}

      {/* Progress veil — retracts as progress advances */}
      {mode === 'assessment' && !showFallback && (
        <>
          <div className={styles.veilDesat} aria-hidden="true" />
          <div className={styles.veil} aria-hidden="true" />
        </>
      )}

      {/* Construction frontier */}
      {mode === 'assessment' && clamped > 1 && clamped < 99 && (
        <motion.div
          className={styles.frontier}
          aria-hidden="true"
          animate={
            animateAmbient
              ? { opacity: [0.7, 1, 0.7] }
              : { opacity: 1 }
          }
          transition={
            animateAmbient
              ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
              : undefined
          }
        >
          <span className={styles.frontierCore} />
          <motion.span
            className={styles.frontierScan}
            animate={
              animateAmbient
                ? { top: ['32%', '58%', '32%'] }
                : { top: '46%' }
            }
            transition={
              animateAmbient
                ? { duration: 4.4, repeat: Infinity, ease: 'easeInOut' }
                : undefined
            }
          />
        </motion.div>
      )}

      {/* Ambient particles */}
      {!showFallback && (
        <div className={styles.particles} aria-hidden="true">
          {PARTICLES.map((particle) => {
            const variantClass =
              particle.variant === 'green'
                ? styles.particleGreen
                : particle.variant === 'red'
                  ? styles.particleRed
                  : '';
            const style: CSSProperties = {
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            };
            if (!animateAmbient) {
              return (
                <span
                  key={particle.id}
                  className={`${styles.particle} ${variantClass}`}
                  style={{ ...style, opacity: 0.55 }}
                />
              );
            }
            return (
              <motion.span
                key={particle.id}
                className={`${styles.particle} ${variantClass}`}
                style={style}
                animate={{
                  opacity: [0, 0.7, 0],
                  y: [0, particle.drift, 0],
                  x: [0, particle.drift / 2, 0],
                }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
