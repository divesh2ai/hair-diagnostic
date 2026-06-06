/**
 * HairOS Design System — Component Token Architecture
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-layer component token system:
 *
 *   Layer 1 — Primitive tokens   (in tokens/color.ts, typography.ts, etc.)
 *   Layer 2 — Semantic tokens    (in tokens/color.ts — semantic object)
 *   Layer 3 — Component tokens   (THIS FILE — per-component overrides)
 *
 * Component tokens reference semantic tokens by CSS variable name.
 * They express WHAT a component is made of, not HOW it looks.
 *
 * Usage:
 *   import { buttonTokens, cardTokens } from '@/design-system/components/tokens';
 *
 * Implementation:
 *   Each token object maps to a component's variant × state matrix.
 *   Tailwind class strings are the runtime representation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── BUTTON TOKENS ────────────────────────────────────────────────────────────

export const buttonTokens = {

  base: [
    // Structure
    'inline-flex items-center justify-center gap-2',
    'font-body font-semibold tracking-wide',
    'select-none cursor-pointer',
    'border transition-all',
    // Focus
    'focus-visible:outline-none',
    'focus-visible:shadow-focus-gold',
    // Disabled
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    // Reduced motion
    'motion-reduce:transition-none',
  ].join(' '),

  variant: {

    /** Primary CTA — gold gradient, depth shadow, glow on hover */
    primary: {
      default: [
        'bg-gold-500 text-obsidian-900',
        'border-gold-400/30',
        'shadow-btn-primary',
        'hover:bg-gold-400 hover:shadow-btn-primary-hover',
        'active:bg-gold-600 active:scale-[0.98]',
        'transition-all duration-fast ease-snap',
      ].join(' '),
      className: 'btn-primary',
    },

    /** Secondary — sage tinted surface */
    secondary: {
      default: [
        'bg-sage-500/15 text-sage-300',
        'border-sage-500/30',
        'hover:bg-sage-500/25 hover:text-sage-200 hover:border-sage-400/40',
        'hover:shadow-glow-sage-sm',
        'active:bg-sage-600/20 active:scale-[0.98]',
        'transition-all duration-fast ease-out',
      ].join(' '),
      className: 'btn-secondary',
    },

    /** Ghost — transparent, border on hover */
    ghost: {
      default: [
        'bg-transparent text-neutral-300',
        'border-transparent',
        'hover:bg-white/5 hover:text-neutral-100 hover:border-white/10',
        'active:bg-white/8 active:scale-[0.98]',
        'transition-all duration-fast ease-out',
      ].join(' '),
      className: 'btn-ghost',
    },

    /** Outline — explicit border, fills on hover */
    outline: {
      default: [
        'bg-transparent text-gold-400',
        'border-gold-500/40',
        'hover:bg-gold-500/10 hover:border-gold-400/60 hover:shadow-glow-gold-xs',
        'active:bg-gold-500/15 active:scale-[0.98]',
        'transition-all duration-fast ease-out',
      ].join(' '),
      className: 'btn-outline',
    },

    /** Destructive — clinical danger, crimson */
    destructive: {
      default: [
        'bg-crimson-600/15 text-crimson-400',
        'border-crimson-500/30',
        'hover:bg-crimson-600/25 hover:border-crimson-400/50 hover:shadow-glow-danger',
        'active:bg-crimson-700/30 active:scale-[0.98]',
        'transition-all duration-fast ease-out',
      ].join(' '),
      className: 'btn-destructive',
    },

    /** AI/Biolume — used for AI-powered action triggers */
    ai: {
      default: [
        'bg-biolume-500/15 text-biolume-300',
        'border-biolume-400/30',
        'hover:bg-biolume-500/25 hover:border-biolume-300/50 hover:shadow-glow-ai-sm',
        'active:bg-biolume-600/20 active:scale-[0.98]',
        'transition-all duration-fast ease-out',
      ].join(' '),
      className: 'btn-ai',
    },
  },

  size: {
    xs: 'h-7 px-3 text-xs rounded-lg',
    sm: 'h-9 px-4 text-sm rounded-xl',
    md: 'h-11 px-5 text-base rounded-xl',    // 44px — touch minimum
    lg: 'h-14 px-7 text-lg rounded-2xl',
    xl: 'h-16 px-8 text-xl rounded-2xl',
    // Icon-only square variants
    'icon-xs': 'h-7 w-7 rounded-lg',
    'icon-sm': 'h-9 w-9 rounded-xl',
    'icon-md': 'h-11 w-11 rounded-xl',
    'icon-lg': 'h-14 w-14 rounded-2xl',
  },

} as const;

// ─── CARD TOKENS ──────────────────────────────────────────────────────────────

export const cardTokens = {

  base: [
    'relative overflow-hidden',
    'transition-all duration-normal ease-out',
    'motion-reduce:transition-none',
  ].join(' '),

  variant: {

    /** Standard content card */
    default: {
      container: [
        'bg-obsidian-800 border border-white/8',
        'rounded-card shadow-card',
        'hover:border-gold-500/18 hover:shadow-card-hover',
        'hover:-translate-y-1',
      ].join(' '),
      header:  'p-5 border-b border-white/6',
      body:    'p-5',
      footer:  'p-5 border-t border-white/6',
    },

    /** Premium insight card — gold accent, elevated */
    insight: {
      container: [
        'bg-gradient-card border border-gold-500/12',
        'rounded-card-large shadow-card',
        'rim-light-gold',
        'hover:border-gold-400/25 hover:shadow-card-hover',
        'hover:-translate-y-1.5',
      ].join(' '),
      header:  'p-6 border-b border-gold-500/10',
      body:    'p-6',
      footer:  'p-6 border-t border-gold-500/10',
      accent:  'absolute inset-x-0 top-0 h-px bg-gradient-gold opacity-60',
    },

    /** Clinical data card — clean, precise */
    clinical: {
      container: [
        'bg-obsidian-800 border border-white/6',
        'rounded-lg shadow-md',
        'hover:border-sage-500/25 hover:shadow-glow-sage-sm',
      ].join(' '),
      header:  'p-4 border-b border-white/5',
      body:    'p-4',
      footer:  'p-4 border-t border-white/5',
    },

    /** Ghost / borderless — for grouped layouts */
    ghost: {
      container: 'bg-transparent',
      header:    'pb-3',
      body:      '',
      footer:    'pt-3',
    },

    /** AI-powered — biolume accent */
    ai: {
      container: [
        'bg-biolume-950/50 border border-biolume-400/20',
        'rounded-card shadow-md',
        'hover:border-biolume-300/35 hover:shadow-glow-ai-sm',
      ].join(' '),
      header:  'p-5 border-b border-biolume-400/12',
      body:    'p-5',
      footer:  'p-5 border-t border-biolume-400/12',
      accent:  'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-biolume-400/60 to-transparent',
    },

    /** Metric / stat card */
    metric: {
      container: [
        'bg-obsidian-800 border border-white/8',
        'rounded-xl p-5',
        'hover:border-gold-500/20 hover:shadow-glow-gold-xs',
        'hover:-translate-y-0.5',
      ].join(' '),
      label:  'type-label-medium text-neutral-500 mb-2',
      value:  'type-data-hero text-neutral-50',
      unit:   'type-label-large text-neutral-500 ml-1',
      change: {
        positive: 'type-label-medium text-sage-400',
        negative: 'type-label-medium text-crimson-400',
        neutral:  'type-label-medium text-neutral-500',
      },
    },

  },

} as const;

// ─── INPUT / FORM TOKENS ──────────────────────────────────────────────────────

export const inputTokens = {

  base: [
    'w-full font-body text-base',
    'bg-obsidian-800 text-neutral-100',
    'border border-white/10 rounded-xl',
    'placeholder:text-neutral-600',
    'transition-all duration-fast ease-out',
    'focus:outline-none focus:border-gold-500/60 focus:shadow-focus-gold',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),

  size: {
    sm: 'h-9 px-3 text-sm rounded-lg',
    md: 'h-11 px-4 text-base rounded-xl',
    lg: 'h-14 px-5 text-lg rounded-2xl',
  },

  state: {
    default: 'border-white/10 bg-obsidian-800',
    hover:   'border-white/18 bg-obsidian-700',
    focus:   'border-gold-500/60 bg-obsidian-800 shadow-focus-gold',
    error:   'border-crimson-500/50 bg-crimson-950/20 shadow-glow-danger',
    success: 'border-sage-500/50 bg-sage-950/20',
    disabled:'opacity-40 cursor-not-allowed',
  },

  label: 'type-label-medium text-neutral-400 mb-2 block',
  helper: 'text-xs text-neutral-500 mt-1.5',
  errorMsg: 'text-xs text-crimson-400 mt-1.5',
  successMsg: 'text-xs text-sage-400 mt-1.5',

  /** Floating label variant (clinical precision look) */
  floating: {
    wrapper: 'relative',
    input:   'peer pt-5 pb-2 px-4 h-16 rounded-2xl border border-white/10 bg-obsidian-800 w-full focus:outline-none focus:border-gold-500/60 focus:shadow-focus-gold placeholder-transparent text-neutral-100',
    label:   'absolute left-4 top-2 text-xs font-medium tracking-wide uppercase text-neutral-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-2 peer-focus:text-xs peer-focus:tracking-wide peer-focus:uppercase peer-focus:text-gold-400',
  },

} as const;

// ─── BADGE / TAG TOKENS ───────────────────────────────────────────────────────

export const badgeTokens = {

  base: 'inline-flex items-center gap-1.5 type-label-small rounded-full border',

  variant: {
    default:    'bg-white/6 text-neutral-300 border-white/10',
    gold:       'bg-gold-500/12 text-gold-400 border-gold-500/25',
    sage:       'bg-sage-500/12 text-sage-300 border-sage-500/25',
    biolume:    'bg-biolume-500/12 text-biolume-300 border-biolume-400/25',
    success:    'bg-sage-500/15 text-sage-300 border-sage-500/30',
    warning:    'bg-amber-500/12 text-amber-300 border-amber-500/25',
    danger:     'bg-crimson-500/12 text-crimson-400 border-crimson-500/25',
    info:       'bg-biolume-500/12 text-biolume-300 border-biolume-400/25',
    outline:    'bg-transparent text-neutral-400 border-white/20',
  },

  size: {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-xs',
  },

  /** Dot indicator for status badges */
  dot: {
    online:     'h-1.5 w-1.5 rounded-full bg-sage-400 animate-pulse-slow',
    processing: 'h-1.5 w-1.5 rounded-full bg-biolume-400 animate-pulse',
    warning:    'h-1.5 w-1.5 rounded-full bg-amber-400',
    error:      'h-1.5 w-1.5 rounded-full bg-crimson-400 animate-pulse',
    inactive:   'h-1.5 w-1.5 rounded-full bg-neutral-600',
  },

} as const;

// ─── PROGRESS / DATA TOKENS ───────────────────────────────────────────────────

export const progressTokens = {

  /** Linear progress bar */
  bar: {
    track:   'h-2 w-full rounded-full bg-white/8 overflow-hidden',
    fill: {
      base:     'h-full rounded-full origin-left transition-transform duration-patient ease-organic',
      gold:     'bg-gradient-gold',
      sage:     'bg-gradient-sage',
      biolume:  'bg-gradient-to-r from-biolume-600 to-biolume-400',
      danger:   'bg-gradient-to-r from-crimson-700 to-crimson-500',
    },
    label:  'flex items-center justify-between mb-2',
    value:  'type-data-small text-neutral-300',
    legend: 'type-label-small text-neutral-500',
  },

  /** Circular progress — for zone density scores */
  circular: {
    sizes: {
      sm: { size: 48,  strokeWidth: 4, label: 'text-sm' },
      md: { size: 80,  strokeWidth: 5, label: 'text-2xl' },
      lg: { size: 120, strokeWidth: 6, label: 'text-3xl' },
      xl: { size: 160, strokeWidth: 8, label: 'text-4xl' },
    },
    colors: {
      critical: { stroke: '#EF4444', glow: 'rgba(239,68,68,0.35)' },
      low:      { stroke: '#F59E0B', glow: 'rgba(245,158,11,0.35)' },
      moderate: { stroke: '#C8A96E', glow: 'rgba(200,169,110,0.35)' },
      good:     { stroke: '#5A9A73', glow: 'rgba(90,154,115,0.35)' },
      optimal:  { stroke: '#2EB09E', glow: 'rgba(46,176,158,0.40)' },
    },
    track:      'stroke-white/8',
    background: 'fill-transparent',
    valueClass: 'type-data-hero text-neutral-50',
    unitClass:  'type-label-small text-neutral-500',
    labelClass: 'type-caption text-neutral-400',
  },

  /** Density heatmap bar */
  heatmap: {
    track:  'h-3 w-full rounded-full overflow-hidden',
    fill:   'bg-gradient-to-r from-crimson-700 via-gold-500 to-biolume-400',
    cursor: 'w-px h-5 bg-white rounded-full shadow-glow-gold-xs -mt-1 absolute top-0',
  },

} as const;

// ─── MODAL / SHEET TOKENS ─────────────────────────────────────────────────────

export const modalTokens = {

  /** Backdrop */
  backdrop: 'fixed inset-0 z-modal bg-obsidian-950/80 backdrop-blur-sm',

  /** Modal dialog */
  dialog: {
    container: 'fixed inset-0 z-modal flex items-center justify-center p-4',
    panel: [
      'relative w-full max-w-modal',
      'bg-obsidian-800 border border-white/10',
      'rounded-modal elevation-4',
      'overflow-hidden',
    ].join(' '),
    header:  'px-6 py-5 border-b border-white/6 flex items-center justify-between',
    body:    'px-6 py-5',
    footer:  'px-6 py-5 border-t border-white/6 flex items-center justify-end gap-3',
    close:   'p-2 rounded-xl text-neutral-500 hover:text-neutral-200 hover:bg-white/6 transition-colors duration-fast',
    title:   'type-headline-medium text-neutral-50',
  },

  /** Bottom sheet (mobile primary) */
  sheet: {
    backdrop:  'fixed inset-0 z-drawer bg-obsidian-950/70 backdrop-blur-sm',
    container: 'fixed inset-x-0 bottom-0 z-drawer pb-safe',
    panel: [
      'bg-obsidian-800 border-t border-white/10',
      'rounded-sheet elevation-3',
      'max-h-[90dvh] overflow-y-auto scrollbar-thin',
    ].join(' '),
    handle:    'w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2',
    header:    'px-5 pt-3 pb-4 border-b border-white/6',
    body:      'px-5 py-4',
    footer:    'px-5 py-4 border-t border-white/6',
  },

  /** Full-screen — for analysis ritual */
  fullscreen: {
    container: 'fixed inset-0 z-ritual',
    panel:     'w-full h-full bg-obsidian-900 overflow-y-auto bg-mesh-bio noise-overlay',
    header:    'px-6 py-5 flex items-center',
    body:      'flex-1 px-6',
  },

} as const;

// ─── NAVIGATION TOKENS ────────────────────────────────────────────────────────

export const navTokens = {

  /** Mobile bottom tab bar */
  tabBar: {
    container: [
      'fixed inset-x-0 bottom-0 z-sticky',
      'h-tab-bar pb-safe',
      'glass border-t border-white/6',
      'grid',
    ].join(' '),
    item: {
      base:   'flex flex-col items-center justify-center gap-1 transition-colors duration-fast',
      idle:   'text-neutral-500',
      active: 'text-gold-400',
    },
    icon:       'w-6 h-6',
    label:      'type-label-small',
    indicator:  'absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold-400',
  },

  /** Desktop side navigation */
  sideNav: {
    container: [
      'flex flex-col h-dvh sticky top-0',
      'bg-obsidian-900 border-r border-white/6',
      'transition-all duration-smooth ease-snap',
      'z-sticky',
    ].join(' '),
    item: {
      base:   'flex items-center gap-3 px-3 py-2.5 rounded-xl mx-2 transition-all duration-fast',
      idle:   'text-neutral-400 hover:text-neutral-200 hover:bg-white/5',
      active: 'text-gold-400 bg-gold-500/10 border border-gold-500/15',
    },
    section:  'px-4 py-2 type-label-small text-neutral-600 mt-4 first:mt-0',
    divider:  'my-2 mx-4 border-t border-white/6',
  },

  /** Top navigation bar */
  topNav: {
    container: [
      'sticky top-0 z-sticky h-nav',
      'glass border-b border-white/6',
      'flex items-center px-4 gap-4',
    ].join(' '),
    logo:    'type-headline-small font-display text-gold-400 tracking-wide',
    actions: 'ml-auto flex items-center gap-2',
  },

} as const;

// ─── TOOLTIP TOKENS ───────────────────────────────────────────────────────────

export const tooltipTokens = {
  container: [
    'z-popover absolute pointer-events-none',
    'type-body-small text-neutral-200',
    'bg-obsidian-700 border border-white/12',
    'rounded-lg px-3 py-2 shadow-xl',
    'max-w-xs',
  ].join(' '),
  arrow: 'absolute w-2 h-2 bg-obsidian-700 border-white/12 rotate-45',
} as const;

// ─── DATA VISUALIZATION TOKENS ────────────────────────────────────────────────

export const dataVizTokens = {

  /** Follicle density map */
  follicleMap: {
    container:    'relative aspect-scalp w-full rounded-follicle-map overflow-hidden bg-obsidian-900',
    grid:         'absolute inset-0 opacity-20',
    gridColor:    'rgba(255,255,255,0.05)',
    scanOverlay:  'absolute inset-0 scan-overlay',
    densityColors: {
      critical: '#EF4444',
      low:      '#F59E0B',
      moderate: '#C8A96E',
      good:     '#5A9A73',
      optimal:  '#2EB09E',
    },
    zoneLabel:   'type-data-small text-neutral-300',
    legendItem:  'flex items-center gap-2 type-caption text-neutral-500',
    legendDot:   'w-2 h-2 rounded-full',
  },

  /** Zone score card */
  zoneCard: {
    container: 'p-4 rounded-xl bg-obsidian-800/80 border border-white/8',
    zone:      'type-label-medium text-neutral-500 mb-1',
    score:     'type-data-large text-neutral-50 num-clinical',
    status:    'type-label-small',
    bar:       'mt-2 h-1.5 rounded-full overflow-hidden bg-white/8',
    barFill:   'h-full rounded-full origin-left',
  },

  /** Timeline / progression chart */
  timeline: {
    container:  'relative',
    track:      'absolute left-2 top-0 bottom-0 w-px bg-white/8',
    point:      'relative flex items-start gap-4 pb-8 last:pb-0',
    dot:        'relative z-10 w-4 h-4 rounded-full border-2 mt-1 shrink-0',
    dotActive:  'bg-gold-500 border-gold-400 shadow-glow-gold-xs',
    dotComplete:'bg-sage-500 border-sage-400',
    dotFuture:  'bg-obsidian-700 border-white/20',
    content:    'flex-1 min-w-0',
    date:       'type-caption text-neutral-500 mb-0.5',
    title:      'type-body-small font-semibold text-neutral-200 mb-1',
    body:       'type-caption text-neutral-500',
  },

} as const;

// ─── PATIENT JOURNEY SCREEN TOKENS ───────────────────────────────────────────

export const journeyTokens = {

  /** Welcome / opening screen */
  welcome: {
    screen:    'min-h-dvh flex flex-col justify-between bg-obsidian-900 bg-mesh-bio noise-overlay',
    header:    'px-6 pt-safe pt-8',
    hero:      'flex-1 flex flex-col items-center justify-center px-6 py-12 text-center',
    heroTitle: 'type-display-medium text-neutral-0 text-balance mb-4',
    heroSub:   'type-body-large text-neutral-400 max-w-prose mx-auto text-pretty',
    footer:    'px-6 pb-safe pb-8',
    cta:       'w-full btn-primary btn-xl',
  },

  /** Question / dialogue screen */
  question: {
    screen:    'min-h-dvh flex flex-col bg-obsidian-900',
    progress:  'px-6 pt-safe pt-6',
    body:      'flex-1 px-6 pt-12',
    question:  'type-display-small text-neutral-50 text-balance mb-8',
    options:   'grid gap-3',
    option: {
      base:     'w-full text-left p-5 rounded-2xl border transition-all duration-fast',
      default:  'bg-obsidian-800/50 border-white/10 text-neutral-300 hover:bg-obsidian-700/60 hover:border-gold-500/25 hover:text-neutral-100',
      selected: 'bg-gold-500/12 border-gold-400/40 text-gold-300',
    },
    footer:    'px-6 pb-safe pb-8 pt-6',
  },

  /** Analysis / processing screen */
  analysis: {
    screen:     'fixed inset-0 z-ritual bg-obsidian-900 flex flex-col items-center justify-center bg-mesh-bio',
    orb:        'relative w-40 h-40 rounded-full bg-biolume-500/10 border border-biolume-400/20 shadow-ritual-orb animate-breathe',
    orbInner:   'absolute inset-4 rounded-full bg-biolume-500/15 border border-biolume-300/15',
    orbCore:    'absolute inset-8 rounded-full bg-biolume-400/20',
    ring1:      'absolute inset-0 rounded-full border border-biolume-400/20 animate-ring-expand',
    ring2:      'absolute inset-0 rounded-full border border-biolume-400/15 animate-ring-expand [animation-delay:0.7s]',
    status:     'mt-10 type-label-large text-biolume-400 tracking-widest',
    step:       'mt-4 type-body-small text-neutral-500 max-w-xs text-center',
    scanLine:   'absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-biolume-400/80 to-transparent animate-scan pointer-events-none',
  },

  /** Insight reveal screen */
  insight: {
    screen:      'min-h-dvh flex flex-col bg-obsidian-900 bg-mesh-bio',
    header:      'px-6 pt-safe pt-8 flex items-center justify-between',
    overline:    'type-overline text-gold-500 mb-4',
    headline:    'type-display-medium text-neutral-0 text-balance mb-2',
    sub:         'type-body-large text-neutral-400 mb-12',
    dataGrid:    'grid grid-cols-2 gap-4 mb-8',
    treatmentCard:'card-insight mb-6',
    footer:      'px-6 pb-safe pb-8',
    ctaNote:     'type-caption text-neutral-500 text-center mt-3',
  },

} as const;

// ─── SKELETON / LOADING TOKENS ────────────────────────────────────────────────

export const skeletonTokens = {
  base: 'rounded-lg bg-white/6 shimmer',
  // Sizes match common content shapes
  line:    'h-4 rounded-md bg-white/6 shimmer',
  title:   'h-8 rounded-lg bg-white/6 shimmer',
  avatar:  'rounded-full bg-white/6 shimmer',
  card:    'rounded-card bg-white/6 shimmer',
  button:  'h-11 rounded-xl bg-white/6 shimmer',
  metric:  'h-16 rounded-xl bg-white/6 shimmer',
} as const;

// ─── NOTIFICATION / TOAST TOKENS ──────────────────────────────────────────────

export const toastTokens = {
  container: [
    'fixed bottom-4 right-4 z-toast flex flex-col gap-2',
    'pointer-events-none',
    'sm:right-6 sm:bottom-6',
  ].join(' '),

  toast: {
    base: [
      'pointer-events-auto flex items-start gap-3 p-4',
      'rounded-2xl border shadow-xl',
      'min-w-[280px] max-w-[380px]',
      'backdrop-blur-md',
    ].join(' '),
    default: 'bg-obsidian-800/95 border-white/12 text-neutral-200',
    success: 'bg-sage-950/95 border-sage-500/30 text-sage-300',
    warning: 'bg-amber-950/95 border-amber-500/30 text-amber-300',
    danger:  'bg-crimson-950/95 border-crimson-500/30 text-crimson-400',
    info:    'bg-biolume-950/95 border-biolume-400/30 text-biolume-300',
  },

  title:   'type-body-small font-semibold text-neutral-100',
  message: 'type-caption text-neutral-400',
  icon:    'shrink-0 mt-0.5',
  close:   'ml-auto shrink-0 p-1 rounded-lg hover:bg-white/8 text-neutral-500 hover:text-neutral-300 transition-colors',
} as const;

// ─── CONSOLIDATED COMPONENT TOKEN MAP ─────────────────────────────────────────

export const componentTokens = {
  button:    buttonTokens,
  card:      cardTokens,
  input:     inputTokens,
  badge:     badgeTokens,
  progress:  progressTokens,
  modal:     modalTokens,
  nav:       navTokens,
  tooltip:   tooltipTokens,
  dataViz:   dataVizTokens,
  journey:   journeyTokens,
  skeleton:  skeletonTokens,
  toast:     toastTokens,
} as const;

export type ComponentTokens = typeof componentTokens;
