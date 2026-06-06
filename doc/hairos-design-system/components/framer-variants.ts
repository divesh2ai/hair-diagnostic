/**
 * HairOS Design System — Framer Motion Variant Library
 * ─────────────────────────────────────────────────────────────────────────────
 * Ready-to-compose variant sets for every component in the HairOS patient
 * journey. Import and spread directly into motion components.
 *
 * Pattern:
 *   const { container, item } = useReducedMotion() ? reducedVariants : fadeUpStagger;
 *
 * All variants honour the three-phase standard:
 *   hidden  → animate  → exit
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Variants, Transition } from 'framer-motion';

// ─── SHARED TRANSITIONS ───────────────────────────────────────────────────────

const t = {
  snap:    { type: 'tween', duration: 0.40, ease: [0.16, 1, 0.3, 1] }    as Transition,
  elegant: { type: 'tween', duration: 0.70, ease: [0.25, 0.46, 0.45, 0.94] } as Transition,
  organic: { type: 'spring', stiffness: 200, damping: 26, mass: 1 }       as Transition,
  snappy:  { type: 'spring', stiffness: 500, damping: 30, mass: 1 }       as Transition,
  languid: { type: 'spring', stiffness: 80,  damping: 18, mass: 1.5 }     as Transition,
  fast:    { type: 'tween', duration: 0.20, ease: [0, 0, 0.2, 1] }       as Transition,
  slow:    { type: 'tween', duration: 0.80, ease: [0.25, 0.46, 0.45, 0.94] } as Transition,
} as const;

// ─── SCREEN / PAGE TRANSITIONS ────────────────────────────────────────────────

/** Forward navigation (right to left — journey progresses) */
export const screenForward: Variants = {
  hidden:  { opacity: 0, x: '100%' },
  visible: { opacity: 1, x: 0, transition: { ...t.organic } },
  exit:    { opacity: 0, x: '-30%', transition: { ...t.fast } },
};

/** Backward navigation (left to right — patient goes back) */
export const screenBack: Variants = {
  hidden:  { opacity: 0, x: '-100%' },
  visible: { opacity: 1, x: 0, transition: { ...t.organic } },
  exit:    { opacity: 0, x: '30%', transition: { ...t.fast } },
};

/** Fade + scale — for modals and overlays */
export const screenFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.20, ease: [0.4, 0, 1, 1] } },
};

/** Analysis ritual entrance — full screen takeover */
export const ritualEntrance: Variants = {
  hidden:  { opacity: 0, scale: 1.04, filter: 'blur(8px)' },
  visible: {
    opacity: 1, scale: 1, filter: 'blur(0px)',
    transition: { duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0, scale: 0.98, filter: 'blur(4px)',
    transition: { duration: 0.5, ease: [0.4, 0, 1, 1] },
  },
};

// ─── UNIVERSAL REVEAL VARIANTS ─────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { ...t.snap } },
  exit:    { opacity: 0, transition: { ...t.fast } },
};

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { ...t.snap } },
  exit:    { opacity: 0, y: 12, transition: { ...t.fast } },
};

export const fadeDown: Variants = {
  hidden:  { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0,   transition: { ...t.snap } },
  exit:    { opacity: 0, y: -10, transition: { ...t.fast } },
};

export const fadeLeft: Variants = {
  hidden:  { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0,  transition: { ...t.snap } },
  exit:    { opacity: 0, x: 16, transition: { ...t.fast } },
};

export const fadeRight: Variants = {
  hidden:  { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0,   transition: { ...t.snap } },
  exit:    { opacity: 0, x: -16, transition: { ...t.fast } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.90 },
  visible: { opacity: 1, scale: 1,   transition: { ...t.organic } },
  exit:    { opacity: 0, scale: 0.96, transition: { ...t.fast } },
};

export const scaleUp: Variants = {
  hidden:  { opacity: 0, scale: 0.85, y: 16 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { ...t.organic } },
  exit:    { opacity: 0, scale: 0.95, y: 8,  transition: { ...t.fast } },
};

// ─── STAGGER CONTAINERS ───────────────────────────────────────────────────────

export const stagger = (
  delay = 0.10,
  staggerChildren = 0.08,
  staggerDirection: 1 | -1 = 1,
): Variants => ({
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: delay, staggerChildren, staggerDirection },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
});

/** Pre-built stagger speeds */
export const staggerFast   = stagger(0.05, 0.04);
export const staggerNormal = stagger(0.10, 0.08);
export const staggerSlow   = stagger(0.20, 0.15);

/** Item to use inside any stagger container */
export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { ...t.snap } },
  exit:    { opacity: 0, y: 8,  transition: { ...t.fast } },
};

export const staggerItemLeft: Variants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0,   transition: { ...t.snap } },
  exit:    { opacity: 0, x: -8,  transition: { ...t.fast } },
};

// ─── CARD VARIANTS ────────────────────────────────────────────────────────────

export const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,   transition: { ...t.snap } },
  exit:    { opacity: 0, y: 10, scale: 0.98, transition: { ...t.fast } },
  hover:   { y: -4, scale: 1.01, transition: { duration: 0.15, ease: [0, 0, 0.2, 1] } },
  press:   { scale: 0.98, transition: { duration: 0.08 } },
};

export const insightCardVariants: Variants = {
  hidden:  { opacity: 0, y: 32, filter: 'blur(8px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { ...t.elegant },
  },
  exit:    { opacity: 0, y: 16, transition: { ...t.fast } },
};

// ─── DATA REVEAL VARIANTS ─────────────────────────────────────────────────────

/** Counter / numeric value appearing */
export const counterVariants: Variants = {
  hidden:  { opacity: 0, y: 12, filter: 'blur(8px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { ...t.slow },
  },
};

/** Single data point in a list */
export const dataPointVariants: Variants = {
  hidden:  { opacity: 0, x: -8, filter: 'blur(4px)' },
  visible: {
    opacity: 1, x: 0, filter: 'blur(0px)',
    transition: { ...t.snap },
  },
};

/** Progress bar fill */
export const progressVariants: Variants = {
  hidden:  { scaleX: 0, originX: 0 },
  visible: (custom: number = 1) => ({
    scaleX: custom,
    transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

/** Metric value building — for hero stat reveals */
export const metricReveal: Variants = {
  hidden:  { opacity: 0, scale: 0.7, filter: 'blur(16px)' },
  visible: {
    opacity: 1, scale: 1, filter: 'blur(0px)',
    transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// ─── ANALYSIS RITUAL VARIANTS ─────────────────────────────────────────────────

/** The central AI orb */
export const orbVariants: Variants = {
  idle: {
    scale:   [1, 1.04, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' },
  },
  processing: {
    scale:   [1, 1.06, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' },
  },
  complete: {
    scale: 1.1, opacity: 1,
    transition: { ...t.organic },
  },
};

/** Concentric rings emanating from orb */
export const ringVariants: Variants = {
  hidden:  { scale: 1,   opacity: 0 },
  animate: {
    scale:   [1, 1.5, 2.0],
    opacity: [0.5, 0.25, 0],
    transition: {
      duration:  2.0,
      ease:      'easeOut',
      repeat:    Infinity,
      times:     [0, 0.5, 1],
    },
  },
};

/** Processing step text */
export const processingStep: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.25 } },
};

/** Follicle marker appearing on scalp map during scan */
export const follicleMarker: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.4, 1], opacity: 1,
    transition: { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] },
  },
};

// ─── INSIGHT REVEAL SEQUENCE ──────────────────────────────────────────────────
// The emotional climax of the patient experience.
// Use insightContainer on the wrapper, then each child uses the specific variant.

export const insightContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.35, delayChildren: 0.50 },
  },
};

/** Overline — "YOUR ASSESSMENT" */
export const insightOverline: Variants = {
  hidden:  { opacity: 0, letterSpacing: '0.5em' },
  visible: {
    opacity: 1, letterSpacing: '0.22em',
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/** The primary finding — held alone, 2–3 seconds of visual solitude */
export const insightHeadline: Variants = {
  hidden:  { opacity: 0, y: 40, filter: 'blur(16px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/** Supporting copy below headline */
export const insightBody: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Data grid — each metric staggered */
export const insightDataGrid: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

/** Individual metric card within the data grid */
export const insightMetric: Variants = {
  hidden:  { opacity: 0, scale: 0.90, y: 12 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { ...t.organic },
  },
};

/** Treatment opportunity — rises from below after metric grid is complete */
export const treatmentReveal: Variants = {
  hidden:  { opacity: 0, y: 56 },
  visible: {
    opacity: 1, y: 0,
    transition: { ...t.languid },
  },
};

/** CTA button — final reveal with glow */
export const ctaReveal: Variants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1, scale: 1,
    transition: { ...t.organic },
  },
};

// ─── SHEET / MODAL VARIANTS ───────────────────────────────────────────────────

export const bottomSheet: Variants = {
  hidden:  { y: '100%', opacity: 0.5 },
  visible: {
    y: 0, opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 35, mass: 1 },
  },
  exit:    {
    y: '100%', opacity: 0,
    transition: { type: 'tween', duration: 0.3, ease: [0.4, 0, 1, 1] },
  },
};

export const modalDialog: Variants = {
  hidden:  { opacity: 0, scale: 0.92, y: 24 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 28 },
  },
  exit:    {
    opacity: 0, scale: 0.96, y: 12,
    transition: { type: 'tween', duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

export const backdrop: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: [0, 0, 0.2, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.20, ease: [0.4, 0, 1, 1] } },
};

export const sidePanel: Variants = {
  hidden:  { x: '100%', opacity: 0 },
  visible: {
    x: 0, opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 32 },
  },
  exit:    {
    x: '100%', opacity: 0,
    transition: { type: 'tween', duration: 0.25, ease: [0.4, 0, 1, 1] },
  },
};

// ─── NAVIGATION VARIANTS ──────────────────────────────────────────────────────

export const navItemVariants: Variants = {
  idle: {
    color: 'rgba(161,161,170,1)',
    transition: { duration: 0.15 },
  },
  active: {
    color: 'rgba(212,175,103,1)',
    transition: { duration: 0.15 },
  },
  hover: {
    color: 'rgba(212,212,216,1)',
    transition: { duration: 0.10 },
  },
};

export const sideNavVariants: Variants = {
  collapsed: { width: '4.5rem', transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  expanded:  { width: '15rem',  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export const navLabelVariants: Variants = {
  collapsed: { opacity: 0, x: -8, width: 0,    transition: { duration: 0.2 } },
  expanded:  { opacity: 1, x: 0,  width: 'auto', transition: { duration: 0.3, delay: 0.1 } },
};

// ─── AMBIENT / CONTINUOUS ANIMATIONS ─────────────────────────────────────────
// Use as `animate` prop directly (not variants) since they loop.

export const ambient = {
  breathe: {
    animate: { scale: [1, 1.04, 1], opacity: [0.6, 0.85, 0.6] },
    transition: { duration: 6, ease: 'easeInOut', repeat: Infinity },
  },
  float: {
    animate: { y: [0, -8, 0] },
    transition: { duration: 4, ease: 'easeInOut', repeat: Infinity },
  },
  glowPulse: {
    animate: { boxShadow: [
      '0 0 16px rgba(200,169,110,0.25)',
      '0 0 32px rgba(200,169,110,0.50)',
      '0 0 16px rgba(200,169,110,0.25)',
    ]},
    transition: { duration: 2.5, ease: 'easeInOut', repeat: Infinity },
  },
  aiGlowPulse: {
    animate: { boxShadow: [
      '0 0 16px rgba(46,176,158,0.20)',
      '0 0 40px rgba(46,176,158,0.45)',
      '0 0 16px rgba(46,176,158,0.20)',
    ]},
    transition: { duration: 2.0, ease: 'easeInOut', repeat: Infinity },
  },
  shimmer: {
    animate: { backgroundPosition: ['200% center', '-200% center'] },
    transition: { duration: 3.5, ease: 'linear', repeat: Infinity },
  },
  spin: {
    animate: { rotate: 360 },
    transition: { duration: 1.5, ease: 'linear', repeat: Infinity },
  },
  spinSlow: {
    animate: { rotate: 360 },
    transition: { duration: 20, ease: 'linear', repeat: Infinity },
  },
} as const;

// ─── GESTURE VARIANTS ─────────────────────────────────────────────────────────

export const tapVariants = {
  tap: { scale: 0.97, transition: { duration: 0.08 } },
};

export const hoverVariants = {
  hover: { scale: 1.02, y: -2, transition: { duration: 0.15 } },
};

export const hoverGlowVariants = {
  initial: { boxShadow: '0 0 0px rgba(200,169,110,0)' },
  hover:   { boxShadow: '0 0 24px rgba(200,169,110,0.35)', transition: { duration: 0.25 } },
};

// ─── REDUCED MOTION FALLBACKS ─────────────────────────────────────────────────

export const reducedFadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
  exit:    { opacity: 0, transition: { duration: 0.1 } },
};

export const reducedStagger: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0 },
  },
};

export const reducedItem: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

/** Hook-compatible: returns correct variants based on system preference */
export function getVariants<T extends Variants>(
  full: T,
  reduced: Variants,
  prefersReducedMotion: boolean,
): Variants {
  return prefersReducedMotion ? reduced : full;
}
