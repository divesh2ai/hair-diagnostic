/**
 * HairOS Design System — Icon System
 * ─────────────────────────────────────────────────────────────────────────────
 * Philosophy:
 *   Icons in HairOS are precision instruments, not decorations.
 *   Every icon must communicate exactly one concept with zero ambiguity.
 *   The biological intelligence aesthetic requires icons that feel both
 *   scientific and organic — outlined, precise stroke, rounded terminals.
 *
 * Base system: Lucide React (https://lucide.dev)
 *   — Consistent 24×24 grid, 2px stroke, rounded caps and joins
 *   — Extendable with custom HairOS biological icons
 *
 * Custom HairOS icons: SVG paths defined below for domain-specific concepts
 *   (follicle, scalp zone, density map, treatment progression)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── SIZE SCALE ───────────────────────────────────────────────────────────────

export const iconSize = {
  /** 12px: micro, dense data contexts */
  '2xs': 12,
  /** 16px: inline with small body text, table cells */
  xs:    16,
  /** 20px: inline with base body text, compact UI */
  sm:    20,
  /** 24px: default — navigation, buttons, standard UI */
  md:    24,
  /** 32px: feature icons, section markers */
  lg:    32,
  /** 40px: card icons, empty states (small) */
  xl:    40,
  /** 48px: empty states, feature callouts */
  '2xl': 48,
  /** 64px: illustration-weight icons */
  '3xl': 64,
  /** 80px: hero feature icons */
  '4xl': 80,
  /** 96px: full illustration icons */
  '5xl': 96,
} as const;

// ─── STROKE WEIGHTS ───────────────────────────────────────────────────────────

export const iconStroke = {
  /** Fine: decorative, large sizes (40px+) */
  fine:      1,
  /** Light: elegant, display contexts (32px+) */
  light:     1.5,
  /** Regular: default for 24px standard */
  regular:   2,
  /** Medium: small sizes, high-density contexts */
  medium:    2.5,
} as const;

// ─── ICON GRID SPEC ───────────────────────────────────────────────────────────

export const iconGrid = {
  /** Base artboard */
  artboard:    24,
  /** Optical padding from artboard edge */
  padding:     1,
  /** Inner content area */
  contentArea: 22,
  /** Terminal style */
  lineCap:     'round' as const,
  lineJoin:    'round' as const,
  /** Corner radius for geometric shapes within icons */
  cornerRadius: 1.5,
} as const;

// ─── SEMANTIC ICON MAPPING ────────────────────────────────────────────────────
// Maps HairOS domain concepts to Lucide icon names + custom overrides.
// Components import from lucide-react using these keys.

export const iconMap = {

  // ── Navigation ────────────────────────────────────────────────
  home:          'House',
  dashboard:     'LayoutDashboard',
  profile:       'User',
  settings:      'Settings',
  back:          'ChevronLeft',
  forward:       'ChevronRight',
  close:         'X',
  menu:          'Menu',
  moreH:         'MoreHorizontal',
  moreV:         'MoreVertical',

  // ── Clinical / Diagnostic ─────────────────────────────────────
  scan:          'ScanLine',
  camera:        'Camera',
  microscope:    'Microscope',
  dna:           'Dna',
  activity:      'Activity',
  heartRate:     'HeartPulse',
  chart:         'BarChart2',
  trend:         'TrendingUp',
  trendDown:     'TrendingDown',
  timeline:      'GitCommitHorizontal',
  target:        'Crosshair',
  zone:          'Map',
  heatmap:       'Grid3x3',
  report:        'FileBarChart',
  diagnosis:     'Stethoscope',
  treatment:     'Syringe',
  medication:    'Pill',
  calendar:      'CalendarDays',
  appointment:   'CalendarCheck',
  progress:      'RefreshCw',
  result:        'FlaskConical',

  // ── Data & Intelligence ───────────────────────────────────────
  ai:            'Cpu',
  intelligence:  'BrainCircuit',
  analysis:      'AreaChart',
  data:          'Database',
  insight:       'Lightbulb',
  precision:     'Crosshair',
  accuracy:      'CheckCircle2',
  confidence:    'ShieldCheck',
  processing:    'Loader2',
  match:         'GitMerge',
  pattern:       'Network',
  signal:        'Signal',

  // ── Actions ───────────────────────────────────────────────────
  start:         'Play',
  pause:         'Pause',
  stop:          'Square',
  capture:       'CameraIcon',
  save:          'Save',
  download:      'Download',
  share:         'Share2',
  print:         'Printer',
  edit:          'Pencil',
  delete:        'Trash2',
  refresh:       'RefreshCw',
  search:        'Search',
  filter:        'Filter',
  sort:          'ArrowUpDown',
  add:           'Plus',
  remove:        'Minus',
  confirm:       'Check',
  upload:        'Upload',

  // ── Communication ─────────────────────────────────────────────
  message:       'MessageCircle',
  notify:        'Bell',
  alert:         'AlertTriangle',
  info:          'Info',
  help:          'HelpCircle',
  question:      'CircleHelp',
  clinician:     'UserCheck',
  team:          'Users',
  clinic:        'Building2',

  // ── Status ────────────────────────────────────────────────────
  success:       'CheckCircle2',
  warning:       'AlertCircle',
  danger:        'XCircle',
  pending:       'Clock',
  loading:       'Loader2',
  locked:        'Lock',
  unlocked:      'Unlock',
  verified:      'BadgeCheck',
  star:          'Star',

  // ── Biological / HairOS Specific ─────────────────────────────
  // Custom SVG paths defined below
  follicle:      'custom:follicle',
  scalpMap:      'custom:scalpMap',
  densityGrid:   'custom:densityGrid',
  hairStrand:    'custom:hairStrand',
  growthArrow:   'custom:growthArrow',

} as const;

// ─── CUSTOM SVG PATHS ─────────────────────────────────────────────────────────
// HairOS biological icons — SVG path data for 24×24 viewBox.
// Stroke-based, 2px default stroke, round caps.

export const customIcons = {

  /** Single hair follicle — cross-section stylised */
  follicle: {
    viewBox: '0 0 24 24',
    paths: [
      // Bulb
      'M12 18 C9 18 7 16 7 13.5 C7 11 9 9 12 9 C15 9 17 11 17 13.5 C17 16 15 18 12 18Z',
      // Shaft
      'M12 9 L12 3',
      // Root bulge
      'M10 18 C10 20 11 21 12 21 C13 21 14 20 14 18',
      // Sebaceous hint
      'M15 12 C16.5 11.5 17.5 12 17.5 13',
    ],
    strokeWidth: 1.5,
  },

  /** Scalp map — top-down head outline with zone grid */
  scalpMap: {
    viewBox: '0 0 24 24',
    paths: [
      // Head outline
      'M12 3 C7.6 3 4 7 4 11.5 C4 15 6 18 9 19.5 L9 21 L15 21 L15 19.5 C18 18 20 15 20 11.5 C20 7 16.4 3 12 3Z',
      // Zone lines
      'M8 10 L16 10',
      'M8 14 L16 14',
      'M10 8 L10 16',
      'M14 8 L14 16',
    ],
    strokeWidth: 1.5,
  },

  /** Density grid — follicle count visualisation */
  densityGrid: {
    viewBox: '0 0 24 24',
    paths: [
      'M4 4 L4 20 L20 20 L20 4 Z',
      'M4 9 L20 9',
      'M4 14 L20 14',
      'M9 4 L9 20',
      'M14 4 L14 20',
      // Density dots
      'M6.5 6.5 L6.5 6.5',
      'M11.5 6.5 L11.5 6.5',
      'M16.5 6.5 L16.5 6.5',
      'M6.5 11.5 L6.5 11.5',
      'M11.5 11.5 L11.5 11.5',
    ],
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
  },

  /** Single hair strand — curved growth line */
  hairStrand: {
    viewBox: '0 0 24 24',
    paths: [
      'M12 21 C12 21 10 16 11 11 C12 6 13 4 12 3',
      'M14 21 C14 21 13 17 13.5 13 C14 9 15 6 14 4',
      'M10 21 C10 21 9 16 9.5 12 C10 8 11 6 10 4',
    ],
    strokeWidth: 1.5,
  },

  /** Growth arrow — upward biological growth */
  growthArrow: {
    viewBox: '0 0 24 24',
    paths: [
      // Organic upward arrow
      'M12 20 C12 20 8 16 9 11 C10 6 12 4 12 4',
      'M12 4 L9 8',
      'M12 4 L15 8',
      // Small growth sprout
      'M12 20 L12 22',
      'M10 21 C10 21 12 20 14 21',
    ],
    strokeWidth: 1.5,
  },

} as const;

// ─── ICON TOKEN ARCHITECTURE ─────────────────────────────────────────────────
// How icons appear in different component contexts.

export const iconUsage = {

  /** Navigation icons — sized for touch targets */
  navigation: {
    size:        iconSize.md,         // 24px
    stroke:      iconStroke.regular,  // 2px
    color:       'text.secondary',
    activeColor: 'brand.primary',
    padding:     '10px',              // creating 44px touch target
  },

  /** Button icons — paired with button text */
  buttonSM: {
    size:   iconSize.xs,    // 16px
    stroke: iconStroke.medium,
  },
  buttonMD: {
    size:   iconSize.sm,    // 20px
    stroke: iconStroke.regular,
  },
  buttonLG: {
    size:   iconSize.md,    // 24px
    stroke: iconStroke.regular,
  },

  /** Inline icons — within text content */
  inline: {
    size:   iconSize.xs,    // 16px
    stroke: iconStroke.regular,
    verticalAlign: '-0.125em',
  },

  /** Feature icons — section markers, card decorators */
  feature: {
    size:       iconSize['2xl'],  // 48px
    stroke:     iconStroke.light,
    background: 'brand.primaryMuted',
    padding:    '12px',
    radius:     '12px',
  },

  /** Hero icons — large display contexts */
  hero: {
    size:   iconSize['4xl'], // 80px
    stroke: iconStroke.fine,
    color:  'brand.primary',
  },

  /** Status icons — within alerts, badges */
  status: {
    size:   iconSize.sm,    // 20px
    stroke: iconStroke.medium,
  },

  /** Clinical data icons — within data cards */
  dataCard: {
    size:   iconSize.xl,    // 40px
    stroke: iconStroke.light,
    color:  'brand.ai',
  },

} as const;

// ─── ANIMATION BEHAVIOUR ─────────────────────────────────────────────────────
// Framer Motion behaviours for icon contexts.

export const iconAnimation = {
  /** Processing / loading spinner */
  spin: {
    animate:    { rotate: 360 },
    transition: { duration: 1.2, repeat: Infinity, ease: 'linear' },
  },
  /** Success confirmation */
  checkBounce: {
    initial:    { scale: 0, opacity: 0 },
    animate:    { scale: [0, 1.3, 1], opacity: 1 },
    transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
  },
  /** Alert pulse */
  alertPulse: {
    animate:    { scale: [1, 1.1, 1] },
    transition: { duration: 1, repeat: 3, ease: 'easeInOut' },
  },
  /** AI intelligence shimmer */
  aiShimmer: {
    animate:    { opacity: [0.6, 1, 0.6] },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
} as const;

export type IconSize   = typeof iconSize;
export type IconStroke = typeof iconStroke;
export type IconMap    = typeof iconMap;
