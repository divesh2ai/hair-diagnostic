/**
 * HairOS Design System — Spacing, Grid & Layout Tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Base unit: 4px (0.25rem)
 * Philosophy: generous whitespace = premium signal (Experience Bible §3.3)
 * Mobile-first breakpoints — all grid specs start at 375px.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── SPACING SCALE ────────────────────────────────────────────────────────────
// 4px base grid. Values in rem (assumes 16px root).

export const spacing = {
  0:    '0',
  px:   '0.0625rem',  //  1px
  0.5:  '0.125rem',   //  2px
  1:    '0.25rem',    //  4px  ← base unit
  1.5:  '0.375rem',   //  6px
  2:    '0.5rem',     //  8px
  2.5:  '0.625rem',   // 10px
  3:    '0.75rem',    // 12px
  3.5:  '0.875rem',   // 14px
  4:    '1rem',       // 16px
  5:    '1.25rem',    // 20px
  6:    '1.5rem',     // 24px
  7:    '1.75rem',    // 28px
  8:    '2rem',       // 32px
  9:    '2.25rem',    // 36px
  10:   '2.5rem',     // 40px
  11:   '2.75rem',    // 44px — min touch target height
  12:   '3rem',       // 48px
  14:   '3.5rem',     // 56px
  16:   '4rem',       // 64px
  18:   '4.5rem',     // 72px
  20:   '5rem',       // 80px
  24:   '6rem',       // 96px
  28:   '7rem',       // 112px
  32:   '8rem',       // 128px
  36:   '9rem',       // 144px
  40:   '10rem',      // 160px
  44:   '11rem',      // 176px
  48:   '12rem',      // 192px
  52:   '13rem',      // 208px
  56:   '14rem',      // 224px
  60:   '15rem',      // 240px
  64:   '16rem',      // 256px
  72:   '18rem',      // 288px
  80:   '20rem',      // 320px
  96:   '24rem',      // 384px
  112:  '28rem',      // 448px
  128:  '32rem',      // 512px
} as const;

// ─── SEMANTIC SPACING ALIASES ─────────────────────────────────────────────────
// Purpose-driven names for consistent usage patterns.

export const space = {
  /** Component internal padding — tight */
  componentXS:  spacing[2],   //  8px
  /** Component internal padding — default */
  componentSM:  spacing[3],   // 12px
  /** Component internal padding — comfortable */
  componentMD:  spacing[4],   // 16px
  /** Component internal padding — generous */
  componentLG:  spacing[6],   // 24px
  /** Component internal padding — spacious */
  componentXL:  spacing[8],   // 32px

  /** Stack gap — tight (between related elements) */
  stackXS:  spacing[2],   //  8px
  stackSM:  spacing[3],   // 12px
  stackMD:  spacing[4],   // 16px
  stackLG:  spacing[6],   // 24px
  stackXL:  spacing[8],   // 32px
  stack2XL: spacing[12],  // 48px

  /** Section separation — mobile */
  sectionMobile: spacing[12],  // 48px
  /** Section separation — tablet */
  sectionTablet: spacing[20],  // 80px
  /** Section separation — desktop */
  sectionDesktop: spacing[28], // 112px

  /** Inline gap */
  inlineXS: spacing[1],   //  4px
  inlineSM: spacing[2],   //  8px
  inlineMD: spacing[3],   // 12px
  inlineLG: spacing[4],   // 16px

  /** Touch target minimum */
  touchMin: spacing[11],  // 44px
  /** Touch target comfortable */
  touchComfort: spacing[14], // 56px

  /** Insight breathing room — the pause before revelation */
  breatheMD: spacing[8],   // 32px
  breatheLG: spacing[12],  // 48px
  breatheXL: spacing[20],  // 80px
} as const;

// ─── BREAKPOINTS ──────────────────────────────────────────────────────────────

export const breakpoint = {
  /** 375px: small mobile (minimum supported) */
  xs:   '375px',
  /** 640px: large mobile / small tablet */
  sm:   '640px',
  /** 768px: tablet portrait */
  md:   '768px',
  /** 1024px: tablet landscape / small desktop */
  lg:   '1024px',
  /** 1280px: desktop */
  xl:   '1280px',
  /** 1440px: wide desktop (design reference width) */
  '2xl': '1440px',
  /** 1920px: ultra-wide */
  '3xl': '1920px',
} as const;

// ─── GRID SYSTEM ──────────────────────────────────────────────────────────────

export const grid = {
  /** Mobile — 375px to 639px */
  mobile: {
    columns: 4,
    gutter:  '1rem',    // 16px
    margin:  '1.25rem', // 20px
    minWidth: breakpoint.xs,
    maxWidth: '639px',
  },
  /** Large mobile — 640px to 767px */
  mobileLG: {
    columns: 4,
    gutter:  '1.25rem', // 20px
    margin:  '1.5rem',  // 24px
    minWidth: breakpoint.sm,
    maxWidth: '767px',
  },
  /** Tablet — 768px to 1023px */
  tablet: {
    columns: 8,
    gutter:  '1.5rem',  // 24px
    margin:  '2rem',    // 32px
    minWidth: breakpoint.md,
    maxWidth: '1023px',
  },
  /** Desktop — 1024px to 1279px */
  desktop: {
    columns: 12,
    gutter:  '2rem',    // 32px
    margin:  '3rem',    // 48px
    minWidth: breakpoint.lg,
    maxWidth: '1279px',
  },
  /** Wide — 1280px to 1439px */
  wide: {
    columns: 12,
    gutter:  '2rem',    // 32px
    margin:  '4rem',    // 64px
    minWidth: breakpoint.xl,
    maxWidth: '1439px',
  },
  /** Ultra — 1440px+ */
  ultra: {
    columns: 12,
    gutter:  '2rem',
    margin:  'auto',
    minWidth: breakpoint['2xl'],
    maxWidth: '1440px', // content locked at design reference width
  },
} as const;

// ─── CONTAINER WIDTHS ─────────────────────────────────────────────────────────

export const container = {
  xs:      '320px',
  sm:      '640px',
  md:      '768px',
  lg:      '1024px',
  xl:      '1280px',
  '2xl':   '1440px', // max content width
  full:    '100%',
  /** Narrow reading container — body copy, insights, clinical text */
  prose:   '68ch',
  /** Data container — charts, maps, visualisations */
  data:    '900px',
  /** Modal container sizes */
  modalSM: '400px',
  modalMD: '560px',
  modalLG: '720px',
  modalXL: '900px',
  modalFS: '100vw',  // full-screen modal (analysis ritual)
} as const;

// ─── LAYOUT ZONES ─────────────────────────────────────────────────────────────
// Named layout zones for the HairOS clinical application shell.

export const layoutZone = {
  /** Top navigation bar height */
  navHeight: {
    mobile:  '3.5rem',   // 56px
    desktop: '4rem',     // 64px
  },
  /** Bottom tab bar (mobile only) */
  tabBarHeight: '5rem',  // 80px
  /** Side navigation width (desktop) */
  sideNavWidth: {
    collapsed: '4.5rem', // 72px — icon only
    expanded:  '15rem',  // 240px — icon + label
  },
  /** Floating action zone — bottom of screen */
  floatingZoneHeight: '6rem', // 96px
  /** Clinical data panel — right side (desktop consultation view) */
  dataPanelWidth: '22rem',   // 352px
  /** Report panel width */
  reportPanelWidth: '28rem', // 448px
  /** Safe area for bottom inset (iOS) — pair with env(safe-area-inset-bottom) */
  safeAreaBottom: 'env(safe-area-inset-bottom, 0px)',
  safeAreaTop:    'env(safe-area-inset-top, 0px)',
} as const;

export type Spacing    = typeof spacing;
export type Space      = typeof space;
export type Breakpoint = typeof breakpoint;
export type Grid       = typeof grid;
export type Container  = typeof container;
