/**
 * HairOS Design System — Typography Tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Philosophy (from Experience Bible §3.2):
 *   Garamond/Cormorant = human, emotional, meaningful  → display + insight copy
 *   Plus Jakarta Sans  = precise, informational, clinical → UI + body copy
 *   JetBrains Mono     = data, measurement, clinical values → numbers + labels
 *
 * Scale: fluid using clamp() — designed for 375px → 1440px viewport range.
 * All rem values assume 16px root.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── FONT FAMILIES ────────────────────────────────────────────────────────────

export const fontFamily = {
  /** Emotional, premium, insight delivery — serif */
  display: ['Cormorant Garamond', 'Cormorant', 'Georgia', 'serif'] as const,
  /** UI, body, clinical — humanist sans */
  body:    ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'] as const,
  /** Data, measurements, clinical values — mono */
  mono:    ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'] as const,
} as const;

// ─── FONT WEIGHTS ────────────────────────────────────────────────────────────

export const fontWeight = {
  light:     '300',
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
} as const;

// ─── FLUID TYPE SCALE ─────────────────────────────────────────────────────────
// clamp(min, preferred, max)
// preferred = fluid formula targeting smooth scale across 375px-1440px

export const fontSize = {
  /** 11–12px: micro labels, legal footnotes */
  '2xs': 'clamp(0.6875rem, 0.66rem + 0.14vw, 0.75rem)',
  /** 12–14px: captions, overlines, metadata */
  xs:    'clamp(0.75rem, 0.71rem + 0.19vw, 0.875rem)',
  /** 14–16px: small body, secondary text */
  sm:    'clamp(0.875rem, 0.83rem + 0.24vw, 1rem)',
  /** 16–18px: base body text */
  base:  'clamp(1rem, 0.95rem + 0.24vw, 1.125rem)',
  /** 18–20px: large body, lead text */
  lg:    'clamp(1.125rem, 1.07rem + 0.29vw, 1.25rem)',
  /** 20–24px: small headline */
  xl:    'clamp(1.25rem, 1.14rem + 0.53vw, 1.5rem)',
  /** 24–32px: section headline */
  '2xl': 'clamp(1.5rem, 1.29rem + 1.00vw, 2rem)',
  /** 30–40px: display small */
  '3xl': 'clamp(1.875rem, 1.56rem + 1.52vw, 2.5rem)',
  /** 36–52px: display medium */
  '4xl': 'clamp(2.25rem, 1.85rem + 1.90vw, 3.25rem)',
  /** 48–72px: display large */
  '5xl': 'clamp(3rem, 2.33rem + 3.19vw, 4.5rem)',
  /** 64–96px: hero / hero display */
  '6xl': 'clamp(4rem, 3.00rem + 4.76vw, 6rem)',
  /** 80–128px: masthead / ultra-display */
  '7xl': 'clamp(5rem, 3.62rem + 6.57vw, 8rem)',
} as const;

// ─── LINE HEIGHTS ─────────────────────────────────────────────────────────────

export const lineHeight = {
  none:    '1',
  /** Display serif — tight, impactful */
  tight:   '1.15',
  /** Headlines — slightly open */
  snug:    '1.3',
  /** UI elements, buttons, labels */
  compact: '1.4',
  /** Body text — comfortable reading */
  normal:  '1.55',
  /** Long-form / clinical copy */
  relaxed: '1.7',
  /** Maximum legibility */
  loose:   '1.9',
} as const;

// ─── LETTER SPACING ──────────────────────────────────────────────────────────

export const letterSpacing = {
  tighter: '-0.05em',
  tight:   '-0.025em',
  normal:  '0em',
  wide:    '0.025em',
  wider:   '0.06em',
  /** All-caps UI labels */
  widest:  '0.12em',
  /** Display overline / category tags */
  ultra:   '0.22em',
} as const;

// ─── SEMANTIC TYPE ROLES ─────────────────────────────────────────────────────
// Each role = a complete typographic specification.
// These map 1:1 to component usage patterns.

export const typeRole = {

  // ── Display — Cormorant Garamond (emotional moments) ──────────
  displayHero: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize['7xl'],
    fontWeight:    fontWeight.light,
    lineHeight:    lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    description:   'Masthead, splash screens, opening revelation',
  },
  displayLarge: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize['6xl'],
    fontWeight:    fontWeight.light,
    lineHeight:    lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    description:   'Chapter titles, hero section headings',
  },
  displayMedium: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize['5xl'],
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    description:   'Section reveals, primary insights',
  },
  displaySmall: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize['4xl'],
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.snug,
    letterSpacing: letterSpacing.tight,
    description:   'Card hero text, stat reveals',
  },
  displayQuote: {
    fontFamily:    fontFamily.display,
    fontSize:      fontSize['3xl'],
    fontWeight:    fontWeight.light,
    lineHeight:    lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
    description:   'Pullquotes, empathetic copy, patient testimonials',
  },

  // ── Headlines — Plus Jakarta Sans (structure + information) ───
  headlineLarge: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize['2xl'],
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.snug,
    letterSpacing: letterSpacing.tight,
    description:   'Primary section headers within screens',
  },
  headlineMedium: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.xl,
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.compact,
    letterSpacing: '-0.015em',
    description:   'Card titles, modal headers',
  },
  headlineSmall: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.lg,
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.normal,
    description:   'Sub-section headers, drawer titles',
  },

  // ── Body — Plus Jakarta Sans (reading content) ────────────────
  bodyLarge: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.lg,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
    description:   'Lead paragraphs, primary patient-facing copy',
  },
  bodyMedium: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.base,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
    description:   'Standard body text, descriptions',
  },
  bodySmall: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.sm,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    description:   'Secondary body, supporting information',
  },

  // ── Labels — Plus Jakarta Sans (UI chrome) ────────────────────
  labelLarge: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.sm,
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
    description:   'Navigation labels, primary UI labels',
  },
  labelMedium: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.xs,
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase' as const,
    description:   'Category tags, section markers, chip labels',
  },
  labelSmall: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize['2xs'],
    fontWeight:    fontWeight.medium,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.ultra,
    textTransform: 'uppercase' as const,
    description:   'Micro labels, overlines, status badges',
  },

  // ── Clinical Data — JetBrains Mono ───────────────────────────
  dataHero: {
    fontFamily:    fontFamily.mono,
    fontSize:      fontSize['4xl'],
    fontWeight:    fontWeight.light,
    lineHeight:    lineHeight.none,
    letterSpacing: letterSpacing.tight,
    description:   'Primary metric display (density %, follicle count)',
  },
  dataLarge: {
    fontFamily:    fontFamily.mono,
    fontSize:      fontSize['2xl'],
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.none,
    letterSpacing: letterSpacing.tight,
    description:   'Secondary metric, zone scores',
  },
  dataMedium: {
    fontFamily:    fontFamily.mono,
    fontSize:      fontSize.base,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.normal,
    description:   'Data table values, clinical readings',
  },
  dataSmall: {
    fontFamily:    fontFamily.mono,
    fontSize:      fontSize.xs,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.normal,
    description:   'Axis labels, footnote data, metadata',
  },

  // ── Utilities ─────────────────────────────────────────────────
  caption: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.xs,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    description:   'Image captions, footnotes, helper text',
  },
  overline: {
    fontFamily:    fontFamily.body,
    fontSize:      fontSize.xs,
    fontWeight:    fontWeight.medium,
    lineHeight:    lineHeight.compact,
    letterSpacing: letterSpacing.ultra,
    textTransform: 'uppercase' as const,
    description:   'Section overlines, category pre-titles',
  },
  code: {
    fontFamily:    fontFamily.mono,
    fontSize:      fontSize.sm,
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
    description:   'Inline code, technical strings',
  },
  button: {
    fontFamily:    fontFamily.body,
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.none,
    letterSpacing: letterSpacing.wide,
    description:   'All button text — size varies by button size',
  },

} as const;

export type FontFamily    = typeof fontFamily;
export type FontWeight    = typeof fontWeight;
export type FontSize      = typeof fontSize;
export type LineHeight    = typeof lineHeight;
export type LetterSpacing = typeof letterSpacing;
export type TypeRole      = typeof typeRole;
