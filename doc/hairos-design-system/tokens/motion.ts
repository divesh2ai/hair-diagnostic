/**
 * HairOS Design System — Motion Tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Philosophy (Experience Bible §5):
 *   Every animation must have a semantic reason.
 *   Motion communicates intelligence, precision, and emotional pacing.
 *   Never gratuitous. Never decorative. Always purposeful.
 *
 * Three motion registers:
 *   Functional  — confirms interactions, communicates state change
 *   Narrative   — paces emotional journey, builds tension and release
 *   Ambient     — persistent, low-intensity, signals living intelligence
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Transition, Variants, TargetAndTransition } from 'framer-motion';

// ─── DURATION SCALE ───────────────────────────────────────────────────────────

export const duration = {
  /** Micro-feedback: touch confirmation, ripple */
  instant: 0.08,
  /** Button state change, hover */
  fast:    0.15,
  /** Icon transition, tag animation */
  quick:   0.20,
  /** Standard UI state (show/hide, expand) */
  normal:  0.30,
  /** Richer transitions (card expand, panel slide) */
  smooth:  0.40,
  /** Screen transitions, major reveals */
  slow:    0.55,
  /** Emotional transitions, insight reveals */
  gentle:  0.70,
  /** Analysis build sequences */
  patient: 1.00,
  /** Full-screen ceremonial moments */
  ritual:  1.50,
  /** Hero display, opening sequence */
  ceremony: 2.00,
} as const;

// ─── EASING CURVES ────────────────────────────────────────────────────────────
// Cubic-bezier values chosen for biological, organic feel.

export const ease = {
  /** Standard: enters quickly, settles */
  out:        [0.0, 0.0, 0.2, 1.0]   as [number,number,number,number],
  /** Standard: starts quickly, decelerates */
  in:         [0.4, 0.0, 1.0, 1.0]   as [number,number,number,number],
  /** Enters and exits smoothly */
  inOut:      [0.4, 0.0, 0.2, 1.0]   as [number,number,number,number],
  /** Snappy enter — UI elements appearing */
  snap:       [0.16, 1.0, 0.3, 1.0]  as [number,number,number,number],
  /** Elegant, unhurried — premium brand moments */
  elegant:    [0.25, 0.46, 0.45, 0.94] as [number,number,number,number],
  /** Organic ease — biological, non-mechanical */
  organic:    [0.34, 1.56, 0.64, 1.0]  as [number,number,number,number],
  /** Clinical precision — data building */
  precise:    [0.12, 0.0, 0.39, 0.0]   as [number,number,number,number],
  /** Anticipation — brief pull-back before reveal */
  anticipate: [0.36, 0.07, 0.19, 0.97] as [number,number,number,number],
  linear:     [0.0, 0.0, 1.0, 1.0]     as [number,number,number,number],
} as const;

// ─── SPRING CONFIGS ───────────────────────────────────────────────────────────
// Framer Motion spring configurations.

export const spring = {
  /** Quick snappy — button press, toggle */
  snappy: {
    type:    'spring' as const,
    stiffness: 500,
    damping:   30,
    mass:      1,
  },
  /** Standard — card interactions, panels */
  standard: {
    type:    'spring' as const,
    stiffness: 300,
    damping:   30,
    mass:      1,
  },
  /** Gentle — modals, large surface reveals */
  gentle: {
    type:    'spring' as const,
    stiffness: 200,
    damping:   26,
    mass:      1,
  },
  /** Organic — biological, living feel */
  organic: {
    type:    'spring' as const,
    stiffness: 150,
    damping:   20,
    mass:      1.2,
  },
  /** Slow settle — insight reveals, emotional moments */
  languid: {
    type:    'spring' as const,
    stiffness: 80,
    damping:   18,
    mass:      1.5,
  },
  /** Stiff — data counters, precise UI */
  stiff: {
    type:    'spring' as const,
    stiffness: 800,
    damping:   40,
    mass:      0.8,
  },
} as const;

// ─── SEMANTIC TRANSITIONS ─────────────────────────────────────────────────────
// Ready-to-use transition objects for Framer Motion.

export const transition: Record<string, Transition> = {
  // Functional
  microFeedback:    { duration: duration.instant, ease: ease.out },
  hover:            { duration: duration.fast,    ease: ease.out },
  stateChange:      { duration: duration.quick,   ease: ease.out },
  expand:           { duration: duration.normal,  ease: ease.snap },
  collapse:         { duration: duration.quick,   ease: ease.in },

  // Navigation
  screenEnter:      { duration: duration.smooth,  ease: ease.snap },
  screenExit:       { duration: duration.normal,  ease: ease.in },
  panelSlide:       { ...spring.standard },
  modalReveal:      { ...spring.gentle },
  sheetRise:        { ...spring.organic },

  // Narrative
  insightReveal:    { duration: duration.gentle,  ease: ease.elegant },
  dataAppear:       { duration: duration.smooth,  ease: ease.snap },
  heroFade:         { duration: duration.ritual,  ease: ease.elegant },
  revelationBuild:  { duration: duration.patient, ease: ease.organic },
  ceremonialOpen:   { duration: duration.ceremony,ease: ease.elegant },

  // Ambient
  pulseGentle:      { duration: 3.0, ease: ease.inOut, repeat: Infinity, repeatType: 'reverse' },
  pulseFast:        { duration: 1.5, ease: ease.inOut, repeat: Infinity, repeatType: 'reverse' },
  scanLine:         { duration: 2.0, ease: ease.linear, repeat: Infinity },
  orbFloat:         { duration: 6.0, ease: ease.inOut, repeat: Infinity, repeatType: 'reverse' },
  dataStream:       { duration: 0.8, ease: ease.out, staggerChildren: 0.06 },
} as const;

// ─── FRAMER MOTION VARIANTS ───────────────────────────────────────────────────

// ── Fundamental Reveals ───────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.smooth, ease: ease.out } },
  exit:   { opacity: 0, transition: { duration: duration.normal,  ease: ease.in } },
};

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0,  transition: { duration: duration.smooth, ease: ease.snap } },
  exit:    { opacity: 0, y: 12, transition: { duration: duration.normal,  ease: ease.in  } },
};

export const fadeDown: Variants = {
  hidden:  { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0,   transition: { duration: duration.smooth, ease: ease.snap } },
  exit:    { opacity: 0, y: -12, transition: { duration: duration.normal,  ease: ease.in  } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1,    transition: { ...spring.gentle } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: duration.quick, ease: ease.in } },
};

// ── Screen Transitions ────────────────────────────────────────
export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: '100%' },
  visible: { opacity: 1, x: 0,     transition: { ...spring.standard } },
  exit:    { opacity: 0, x: '-30%', transition: { duration: duration.normal, ease: ease.in } },
};

export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: '-100%' },
  visible: { opacity: 1, x: 0,      transition: { ...spring.standard } },
  exit:    { opacity: 0, x: '30%',  transition: { duration: duration.normal, ease: ease.in } },
};

export const sheetRise: Variants = {
  hidden:  { y: '100%', opacity: 0 },
  visible: { y: 0,      opacity: 1, transition: { ...spring.organic } },
  exit:    { y: '100%', opacity: 0, transition: { duration: duration.smooth, ease: ease.in } },
};

export const modalReveal: Variants = {
  hidden:  { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { ...spring.gentle } },
  exit:    { opacity: 0, scale: 0.96, y: 10, transition: { duration: duration.normal, ease: ease.in } },
};

// ── Stagger Containers ────────────────────────────────────────
export const staggerContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren:  0.08,
      delayChildren:    0.10,
      duration:         duration.fast,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

export const staggerFast: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

export const staggerSlow: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.20 },
  },
};

// ── Data / Clinical Reveal ────────────────────────────────────
/** Individual data point appearing — used in stagger sequences */
export const dataPoint: Variants = {
  hidden:  { opacity: 0, x: -8, filter: 'blur(4px)' },
  visible: {
    opacity: 1, x: 0, filter: 'blur(0px)',
    transition: { duration: duration.smooth, ease: ease.elegant },
  },
};

/** Counter/number building effect */
export const counterReveal: Variants = {
  hidden:  { opacity: 0, y: 12, filter: 'blur(8px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: duration.patient, ease: ease.organic },
  },
};

/** Follicle map zone revealing */
export const zoneReveal: Variants = {
  hidden:  { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1, scale: 1,
    transition: { duration: duration.smooth, ease: ease.snap },
  },
};

// ── Insight Reveal — The Emotional Climax ─────────────────────
/** Outer container for the full insight sequence */
export const insightContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.30,
      delayChildren:   0.50,
    },
  },
};

/** Primary insight text — the single most important finding */
export const primaryInsight: Variants = {
  hidden:  { opacity: 0, y: 32, filter: 'blur(12px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: duration.ritual, ease: ease.elegant },
  },
};

/** Supporting data that follows the primary insight */
export const supportingData: Variants = {
  hidden:  { opacity: 0, x: -16 },
  visible: {
    opacity: 1, x: 0,
    transition: { duration: duration.gentle, ease: ease.snap },
  },
};

/** Treatment opportunity — rises from below */
export const treatmentReveal: Variants = {
  hidden:  { opacity: 0, y: 48 },
  visible: {
    opacity: 1, y: 0,
    transition: { ...spring.languid },
  },
};

// ── Analysis Ritual Variants ──────────────────────────────────
/** Scanning line across scalp image */
export const scanLine: TargetAndTransition = {
  y: ['0%', '100%'],
  transition: {
    duration: 2.0,
    ease:     ease.linear,
    repeat:   Infinity,
  },
};

/** Follicle marker appearing during scan */
export const follicleMarker: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: {
    scale: [0, 1.3, 1],
    opacity: 1,
    transition: { duration: duration.quick, ease: ease.organic },
  },
};

/** Processing orb — ambient intelligence */
export const processingOrb: TargetAndTransition = {
  scale:   [1, 1.05, 1],
  opacity: [0.7, 1, 0.7],
  transition: {
    duration:   3.0,
    ease:       ease.inOut,
    repeat:     Infinity,
    repeatType: 'reverse',
  },
};

/** Concentric ring pulse — AI working */
export const ringPulse: TargetAndTransition = {
  scale:   [1, 1.4, 1.8],
  opacity: [0.6, 0.3, 0],
  transition: {
    duration:   2.0,
    ease:       ease.out,
    repeat:     Infinity,
    times:      [0, 0.5, 1],
  },
};

// ── Hover States ──────────────────────────────────────────────
export const cardHover: TargetAndTransition = {
  y:     -4,
  scale: 1.01,
  transition: { duration: duration.fast, ease: ease.out },
};

export const buttonHover: TargetAndTransition = {
  scale:     1.02,
  transition: { duration: duration.fast, ease: ease.out },
};

export const buttonPress: TargetAndTransition = {
  scale:     0.97,
  transition: { duration: duration.instant, ease: ease.out },
};

export const iconHover: TargetAndTransition = {
  rotate: 5,
  scale:  1.1,
  transition: { duration: duration.quick, ease: ease.organic },
};

// ── Progress & Building ───────────────────────────────────────
export const progressFill: Variants = {
  hidden:  { scaleX: 0, originX: 0 },
  visible: (custom: number) => ({
    scaleX: custom,
    transition: { duration: duration.patient, ease: ease.organic },
  }),
};

/** Typewriter — for clinical data reveal text */
export const typewriterContainer: Variants = {
  hidden:  { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.025 },
  },
};

export const typewriterChar: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.12, ease: ease.out },
  },
};

// ─── REDUCED MOTION OVERRIDES ─────────────────────────────────────────────────
// Accessibility: honour prefers-reduced-motion.
// Replace all motion with simple opacity fades.

export const reducedMotion = {
  fadeIn: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: duration.normal } },
    exit:    { opacity: 0, transition: { duration: duration.quick  } },
  },
  stagger: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: duration.normal, staggerChildren: 0.03 } },
  },
  noMotion: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.01 } },
  },
} as const;

// ─── AMBIENT LOOP CONFIGS ─────────────────────────────────────────────────────
// For background elements that continuously animate (biological intelligence feel).

export const ambient = {
  /** Gentle breathing — hero background elements */
  breathe: {
    animate: { scale: [1, 1.04, 1], opacity: [0.6, 0.8, 0.6] },
    transition: { duration: 6, ease: ease.inOut, repeat: Infinity },
  },
  /** Slow rotation — circular data elements */
  rotate: {
    animate: { rotate: 360 },
    transition: { duration: 20, ease: ease.linear, repeat: Infinity },
  },
  /** Float — elevated data points */
  float: {
    animate: { y: [0, -8, 0] },
    transition: { duration: 4, ease: ease.inOut, repeat: Infinity },
  },
  /** Shimmer — gold accent elements */
  shimmer: {
    animate: { backgroundPosition: ['200% center', '-200% center'] },
    transition: { duration: 4, ease: ease.linear, repeat: Infinity },
  },
} as const;

export type Duration   = typeof duration;
export type Ease       = typeof ease;
export type Spring     = typeof spring;
export type Transition_ = typeof transition;
