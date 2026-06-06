/**
 * HairOS Design System — Color Tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-layer architecture:
 *   Primitive  →  raw palette values (never used directly in components)
 *   Semantic   →  role-based aliases (what components consume)
 *   Component  →  per-component overrides (in components/tokens.ts)
 *
 * Aesthetic: Biological Intelligence — deep oceanic darks, keratin-gold,
 * living-tissue sage, bioluminescent accents on clinical white data surfaces.
 *
 * Dark-first: every semantic token is defined for dark mode as the base.
 * Light-mode overrides are appended where required.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── PRIMITIVE PALETTE ────────────────────────────────────────────────────────

export const primitive = {

  /** Gold — keratin, warmth, premium authority */
  gold: {
    50:  '#FBF7EF',
    100: '#F5EDDA',
    200: '#EAD9B4',
    300: '#DFC48D',
    400: '#D4AF67',
    500: '#C8A96E',  // ← brand anchor
    600: '#B8924A',
    700: '#9A7A38',
    800: '#7C6030',
    900: '#5E4A28',
    950: '#3A2D18',
  },

  /** Sage — living tissue, clinical growth, biological health */
  sage: {
    50:  '#EDF5F0',
    100: '#D4E8DC',
    200: '#A9D1B9',
    300: '#7DB996',
    400: '#5A9A73',
    500: '#3D6B50',  // ← brand anchor
    600: '#325A43',
    700: '#264836',
    800: '#1B3729',
    900: '#10261C',
    950: '#08130E',
  },

  /** Obsidian — depth, seriousness, premium void */
  obsidian: {
    50:  '#E8E9EC',
    100: '#C5C8D0',
    200: '#9DA3B0',
    300: '#757F92',
    400: '#4F5B74',
    500: '#2C3142',  // charcoal
    600: '#1E2538',
    700: '#131929',
    800: '#0D1220',
    900: '#0A0E1A',  // ← brand anchor (darkest)
    950: '#060810',
  },

  /** Neutral — clinical surfaces, text, structure */
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },

  /** Biolume — bioluminescent accent for AI/intelligence moments */
  biolume: {
    50:  '#EEF9F6',
    100: '#D0F0E8',
    200: '#9FDFD0',
    300: '#61CAB7',
    400: '#2EB09E',
    500: '#1A9083',  // ← anchor
    600: '#137268',
    700: '#0E574F',
    800: '#0A3D38',
    900: '#062623',
    950: '#031413',
  },

  /** Crimson — clinical alerts, never decorative */
  crimson: {
    50:  '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },

  /** Amber — clinical caution, early warning */
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  /** Transparent utilities */
  transparent: 'transparent',
  current: 'currentColor',
} as const;

// ─── SEMANTIC TOKENS — DARK MODE (base) ──────────────────────────────────────
//
// Naming convention:
//   {category}-{role}-{variant?}
//
// Usage: only semantic tokens should appear in component styles.

export const semantic = {

  // ── Backgrounds ──────────────────────────────────────────────
  background: {
    /** Page/app base — deepest dark */
    base:      primitive.obsidian[900],   // #0A0E1A
    /** Primary surface: cards, panels, sheets */
    surface:   primitive.obsidian[800],   // #0D1220
    /** Elevated surface: modals, popovers */
    elevated:  primitive.obsidian[700],   // #131929
    /** High overlay: drawers, command palette */
    overlay:   primitive.obsidian[600],   // #1E2538
    /** Subtle emphasis: hover, selected state */
    subtle:    primitive.obsidian[500],   // #2C3142
    /** Inverse surface: for light-on-dark reversed layouts */
    inverse:   primitive.neutral[50],
    /** Translucent glass — for backdrop-blur panels */
    glass:     'rgba(13, 18, 32, 0.75)',
    /** Gold-tinted surface for premium moments */
    premium:   'rgba(200, 169, 110, 0.06)',
    /** Sage-tinted: trust/clinical positive */
    clinical:  'rgba(61, 107, 80, 0.08)',
    /** Biolume: AI processing moments */
    ai:        'rgba(26, 144, 131, 0.06)',
  },

  // ── Text ─────────────────────────────────────────────────────
  text: {
    primary:   primitive.neutral[50],     // #FAFAFA — high emphasis
    secondary: primitive.neutral[300],    // #D4D4D8 — medium emphasis
    tertiary:  primitive.neutral[500],    // #71717A — low emphasis
    disabled:  primitive.neutral[700],    // #3F3F46 — disabled
    inverse:   primitive.obsidian[900],   // on light surfaces
    brand:     primitive.gold[400],       // #D4AF67 — brand moments
    accent:    primitive.sage[300],       // #7DB996 — accent/positive
    biolume:   primitive.biolume[300],    // #61CAB7 — AI/intelligence
    danger:    primitive.crimson[400],    // #F87171 — errors
    warning:   primitive.amber[400],      // #FBBF24 — caution
    /** Display / serif emotional content */
    display:   primitive.neutral[0],      // pure white for max contrast on serif
    /** Data labels, mono content */
    data:      primitive.biolume[200],    // #9FDFD0 — clinical data
  },

  // ── Brand ────────────────────────────────────────────────────
  brand: {
    primary:         primitive.gold[500],    // #C8A96E
    primaryHover:    primitive.gold[400],    // #D4AF67
    primaryActive:   primitive.gold[600],    // #B8924A
    primarySubtle:   'rgba(200, 169, 110, 0.12)',
    primaryMuted:    'rgba(200, 169, 110, 0.06)',
    secondary:       primitive.sage[500],    // #3D6B50
    secondaryHover:  primitive.sage[400],    // #5A9A73
    secondaryActive: primitive.sage[600],    // #325A43
    secondarySubtle: 'rgba(61, 107, 80, 0.12)',
    ai:              primitive.biolume[400], // #2EB09E — AI moments
    aiSubtle:        'rgba(46, 176, 158, 0.10)',
  },

  // ── Borders ──────────────────────────────────────────────────
  border: {
    subtle:    'rgba(255, 255, 255, 0.06)',  // barely visible structure
    default:   'rgba(255, 255, 255, 0.10)',  // standard card/panel border
    strong:    'rgba(255, 255, 255, 0.18)',  // emphasis border
    focus:     primitive.gold[500],          // focus ring
    brand:     'rgba(200, 169, 110, 0.35)', // gold border
    brandStrong: primitive.gold[500],
    accent:    'rgba(61, 107, 80, 0.35)',   // sage border
    danger:    'rgba(239, 68, 68, 0.40)',
    biolume:   'rgba(46, 176, 158, 0.35)',  // AI border
  },

  // ── Status ───────────────────────────────────────────────────
  status: {
    successBg:   'rgba(61, 107, 80, 0.12)',
    successText: primitive.sage[300],
    successBorder: 'rgba(61, 107, 80, 0.30)',
    warningBg:   'rgba(245, 158, 11, 0.10)',
    warningText: primitive.amber[300],
    warningBorder: 'rgba(245, 158, 11, 0.30)',
    dangerBg:    'rgba(239, 68, 68, 0.10)',
    dangerText:  primitive.crimson[400],
    dangerBorder: 'rgba(239, 68, 68, 0.30)',
    infoBg:      'rgba(26, 144, 131, 0.10)',
    infoText:    primitive.biolume[300],
    infoBorder:  'rgba(26, 144, 131, 0.30)',
    neutralBg:   'rgba(255, 255, 255, 0.05)',
    neutralText: primitive.neutral[400],
    neutralBorder: 'rgba(255, 255, 255, 0.12)',
  },

  // ── Interaction ──────────────────────────────────────────────
  interaction: {
    hover:    'rgba(255, 255, 255, 0.04)',
    pressed:  'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(200, 169, 110, 0.10)',
    focus:    'rgba(200, 169, 110, 0.20)',
    drag:     'rgba(200, 169, 110, 0.15)',
    disabled: 'rgba(255, 255, 255, 0.04)',
  },

  // ── Data Visualization ───────────────────────────────────────
  // Used in follicle maps, density charts, progression graphs
  dataViz: {
    density: {
      critical:  primitive.crimson[500],
      low:       primitive.amber[500],
      moderate:  primitive.gold[500],
      good:      primitive.sage[400],
      optimal:   primitive.biolume[400],
    },
    progression: {
      p1: primitive.sage[600],
      p2: primitive.sage[500],
      p3: primitive.sage[400],
      p4: primitive.sage[300],
      p5: primitive.biolume[400],
    },
    heatmap: {
      cold:   'rgba(10, 14, 26, 0.0)',
      warm:   'rgba(200, 169, 110, 0.3)',
      hot:    'rgba(200, 169, 110, 0.6)',
      peak:   'rgba(200, 169, 110, 0.9)',
    },
    gridLine:  'rgba(255, 255, 255, 0.05)',
    axis:      'rgba(255, 255, 255, 0.10)',
    tickLabel: primitive.neutral[500],
  },

} as const;

// ─── LIGHT MODE OVERRIDES ────────────────────────────────────────────────────
// Only populated where the light version genuinely differs in intent.
// Most components remain dark-first; light mode is a surface adjustment only.

export const semanticLight = {
  background: {
    base:     primitive.neutral[50],
    surface:  primitive.neutral[0],
    elevated: primitive.neutral[100],
    overlay:  primitive.neutral[200],
    subtle:   primitive.neutral[100],
    inverse:  primitive.obsidian[900],
    glass:    'rgba(255, 255, 255, 0.85)',
    premium:  'rgba(200, 169, 110, 0.06)',
    clinical: 'rgba(61, 107, 80, 0.06)',
    ai:       'rgba(26, 144, 131, 0.06)',
  },
  text: {
    primary:   primitive.obsidian[900],
    secondary: primitive.obsidian[500],
    tertiary:  primitive.neutral[500],
    disabled:  primitive.neutral[400],
    inverse:   primitive.neutral[50],
    brand:     primitive.gold[700],
    accent:    primitive.sage[600],
    biolume:   primitive.biolume[600],
    danger:    primitive.crimson[600],
    warning:   primitive.amber[700],
    display:   primitive.obsidian[900],
    data:      primitive.biolume[700],
  },
  border: {
    subtle:     'rgba(10, 14, 26, 0.06)',
    default:    'rgba(10, 14, 26, 0.12)',
    strong:     'rgba(10, 14, 26, 0.20)',
    focus:      primitive.gold[500],
    brand:      'rgba(200, 169, 110, 0.40)',
    brandStrong: primitive.gold[600],
    accent:     'rgba(61, 107, 80, 0.40)',
    danger:     'rgba(239, 68, 68, 0.40)',
    biolume:    'rgba(26, 144, 131, 0.40)',
  },
} as const;

export type PrimitiveColor = typeof primitive;
export type SemanticColor  = typeof semantic;
