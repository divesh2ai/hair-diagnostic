/**
 * HairOS Design System — Elevation, Shadow & Border Tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Dark-UI shadow philosophy:
 *   Traditional shadows (black drop-shadow) are invisible on dark surfaces.
 *   HairOS uses TWO shadow systems in combination:
 *     1. Depth shadow   — inky black layered shadows for structural depth
 *     2. Glow / halo    — coloured ambient light suggesting surface luminance
 *     3. Inner rim      — subtle top-edge highlight (1px white, low opacity)
 *
 * Elevation levels map to z-index, shadow intensity, and border treatment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Z-INDEX SCALE ────────────────────────────────────────────────────────────

export const zIndex = {
  behind:  '-1',
  base:    '0',
  raised:  '10',
  /** Sticky headers, progress bars */
  sticky:  '20',
  /** Overlays, drawers, side panels */
  drawer:  '30',
  /** Modals, dialogs */
  modal:   '40',
  /** Popovers, dropdowns, tooltips */
  popover: '50',
  /** Toast notifications */
  toast:   '60',
  /** Loading overlay, critical alerts */
  top:     '70',
  /** Full-screen analysis ritual — maximum z */
  ritual:  '80',
} as const;

// ─── ELEVATION LEVELS ────────────────────────────────────────────────────────
// Level 0 = base (no elevation). Level 5 = maximum elevation.

export const elevation = {
  0: {
    level:     0,
    label:     'Base',
    usage:     'Page background, body canvas',
    zIndex:    zIndex.base,
    shadow:    'none',
    border:    'none',
    backdrop:  'none',
  },
  1: {
    level:     1,
    label:     'Surface',
    usage:     'Cards, panels, sidebar sections',
    zIndex:    zIndex.raised,
    shadow:    '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
    border:    '1px solid rgba(255,255,255,0.07)',
    backdrop:  'none',
  },
  2: {
    level:     2,
    label:     'Raised',
    usage:     'Hovering cards, floating data panels, insight cards',
    zIndex:    zIndex.raised,
    shadow:    [
      '0 4px 6px -1px rgba(0,0,0,0.5)',
      '0 2px 4px -1px rgba(0,0,0,0.4)',
      '0 0 0 1px rgba(255,255,255,0.06)',
    ].join(', '),
    border:    '1px solid rgba(255,255,255,0.09)',
    backdrop:  'none',
  },
  3: {
    level:     3,
    label:     'Overlay',
    usage:     'Drawers, bottom sheets, side panels',
    zIndex:    zIndex.drawer,
    shadow:    [
      '0 10px 15px -3px rgba(0,0,0,0.6)',
      '0 4px 6px -2px rgba(0,0,0,0.5)',
      '0 0 0 1px rgba(255,255,255,0.07)',
    ].join(', '),
    border:    '1px solid rgba(255,255,255,0.10)',
    backdrop:  'blur(16px)',
  },
  4: {
    level:     4,
    label:     'Modal',
    usage:     'Modal dialogs, command palette',
    zIndex:    zIndex.modal,
    shadow:    [
      '0 20px 25px -5px rgba(0,0,0,0.7)',
      '0 10px 10px -5px rgba(0,0,0,0.5)',
      '0 0 0 1px rgba(255,255,255,0.08)',
    ].join(', '),
    border:    '1px solid rgba(255,255,255,0.12)',
    backdrop:  'blur(24px)',
  },
  5: {
    level:     5,
    label:     'Supreme',
    usage:     'Full-screen overlays, analysis ritual, critical alerts',
    zIndex:    zIndex.ritual,
    shadow:    [
      '0 25px 50px -12px rgba(0,0,0,0.9)',
      '0 0 0 1px rgba(255,255,255,0.06)',
    ].join(', '),
    border:    '1px solid rgba(255,255,255,0.10)',
    backdrop:  'blur(32px)',
  },
} as const;

// ─── SHADOW PRIMITIVES ────────────────────────────────────────────────────────

export const shadow = {
  /** No shadow */
  none: 'none',

  // ── Depth shadows (structural) ────────────────────────────────
  xs:   '0 1px 2px rgba(0,0,0,0.5)',
  sm:   '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
  md:   '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4)',
  lg:   '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5)',
  xl:   '0 20px 25px -5px rgba(0,0,0,0.7), 0 10px 10px -5px rgba(0,0,0,0.5)',
  '2xl':'0 25px 50px -12px rgba(0,0,0,0.9)',
  inner: 'inset 0 2px 4px rgba(0,0,0,0.5)',
  innerLG: 'inset 0 4px 12px rgba(0,0,0,0.6)',

  // ── Gold glow (premium moments, CTA, brand elements) ─────────
  glowGoldXS:  '0 0 8px rgba(200,169,110,0.25)',
  glowGoldSM:  '0 0 16px rgba(200,169,110,0.30), 0 0 4px rgba(200,169,110,0.20)',
  glowGoldMD:  '0 0 24px rgba(200,169,110,0.35), 0 0 8px rgba(200,169,110,0.25)',
  glowGoldLG:  '0 0 40px rgba(200,169,110,0.40), 0 0 16px rgba(200,169,110,0.30)',
  glowGoldXL:  '0 0 64px rgba(200,169,110,0.45), 0 0 24px rgba(200,169,110,0.35)',

  // ── Sage glow (clinical trust, positive outcomes, progress) ───
  glowSageXS:  '0 0 8px rgba(61,107,80,0.30)',
  glowSageSM:  '0 0 16px rgba(61,107,80,0.35), 0 0 4px rgba(61,107,80,0.25)',
  glowSageMD:  '0 0 24px rgba(61,107,80,0.40), 0 0 8px rgba(61,107,80,0.30)',
  glowSageLG:  '0 0 40px rgba(61,107,80,0.45), 0 0 16px rgba(61,107,80,0.35)',

  // ── Biolume glow (AI processing, intelligence, data) ─────────
  glowAIXS:   '0 0 8px rgba(46,176,158,0.25)',
  glowAISM:   '0 0 16px rgba(46,176,158,0.30), 0 0 4px rgba(46,176,158,0.20)',
  glowAIMD:   '0 0 32px rgba(46,176,158,0.35), 0 0 8px rgba(46,176,158,0.25)',
  glowAILG:   '0 0 60px rgba(46,176,158,0.40), 0 0 20px rgba(46,176,158,0.30)',
  /** Pulsing ring for AI processing — use with animation */
  glowAIPulse: '0 0 0 0 rgba(46,176,158,0.4)',

  // ── Danger glow (clinical alerts) ────────────────────────────
  glowDanger:  '0 0 16px rgba(239,68,68,0.35), 0 0 4px rgba(239,68,68,0.25)',

  // ── Compound shadows (depth + glow) ──────────────────────────
  /** Standard elevated card — depth + subtle gold rim */
  cardDefault: [
    '0 4px 6px -1px rgba(0,0,0,0.5)',
    '0 2px 4px -1px rgba(0,0,0,0.4)',
    '0 0 0 1px rgba(200,169,110,0.08)',
  ].join(', '),

  /** Hovered card */
  cardHover: [
    '0 10px 15px -3px rgba(0,0,0,0.6)',
    '0 4px 6px -2px rgba(0,0,0,0.5)',
    '0 0 16px rgba(200,169,110,0.15)',
    '0 0 0 1px rgba(200,169,110,0.18)',
  ].join(', '),

  /** Premium/CTA button */
  buttonPrimary: [
    '0 4px 14px rgba(200,169,110,0.35)',
    '0 2px 6px rgba(0,0,0,0.4)',
  ].join(', '),

  buttonPrimaryHover: [
    '0 6px 20px rgba(200,169,110,0.45)',
    '0 4px 10px rgba(0,0,0,0.5)',
  ].join(', '),

  /** Analysis ritual screen */
  ritualOrb: [
    '0 0 80px rgba(46,176,158,0.40)',
    '0 0 160px rgba(46,176,158,0.20)',
    '0 0 40px rgba(200,169,110,0.15)',
  ].join(', '),

  /** Focus ring */
  focusGold: '0 0 0 2px rgba(10,14,26,1), 0 0 0 4px rgba(200,169,110,0.70)',
  focusSage: '0 0 0 2px rgba(10,14,26,1), 0 0 0 4px rgba(61,107,80,0.70)',
} as const;

// ─── BORDER TOKENS ────────────────────────────────────────────────────────────

export const border = {
  // ── Widths ────────────────────────────────────────────────────
  width: {
    0:    '0px',
    1:    '1px',
    2:    '2px',
    4:    '4px',
    8:    '8px',
  },

  // ── Radius ───────────────────────────────────────────────────
  radius: {
    none:     '0px',
    xs:       '2px',
    sm:       '4px',
    md:       '8px',
    lg:       '12px',
    xl:       '16px',
    '2xl':    '20px',
    '3xl':    '24px',
    '4xl':    '32px',
    full:     '9999px',
    /** Biological / organic — squircle-like feel on hero cards */
    organic:  '28px 16px 28px 16px',
    /** Asymmetric — used in analysis cards for uniqueness */
    asymLeft: '4px 16px 16px 4px',
    asymRight:'16px 4px 4px 16px',
  },

  // ── Semantic radius aliases ───────────────────────────────────
  radiusSemantic: {
    /** Micro elements: badges, chips, tags */
    badge:      '9999px',
    /** Small interactive: buttons sm, inputs */
    inputSM:    '8px',
    /** Standard: buttons, inputs, form fields */
    input:      '12px',
    /** Cards: standard content card */
    card:       '16px',
    /** Feature cards: large hero content */
    cardLarge:  '20px',
    /** Modals, sheets */
    modal:      '24px',
    /** Bottom sheet top corners */
    sheetTop:   '24px 24px 0 0',
    /** Floating orb / analysis ring */
    orb:        '9999px',
    /** Data visualization panel */
    dataPanel:  '12px',
    /** Follicle map display */
    follicleMap:'16px',
  },

  // ── Semantic border colors — referencing color tokens ────────
  color: {
    subtle:       'rgba(255,255,255,0.06)',
    default:      'rgba(255,255,255,0.10)',
    strong:       'rgba(255,255,255,0.18)',
    focus:        '#C8A96E',
    brand:        'rgba(200,169,110,0.35)',
    brandStrong:  '#C8A96E',
    accent:       'rgba(61,107,80,0.35)',
    ai:           'rgba(46,176,158,0.35)',
    danger:       'rgba(239,68,68,0.40)',
    warning:      'rgba(245,158,11,0.35)',
  },
} as const;

export type ZIndex    = typeof zIndex;
export type Elevation = typeof elevation;
export type Shadow    = typeof shadow;
export type Border    = typeof border;
