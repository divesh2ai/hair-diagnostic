/**
 * DESIGN TOKENS - Phase 1 Visual System Extraction
 *
 * Extracted from legacy/google-ai-studio for cohesive visual language.
 * Preserves premium clinic aesthetic, warm color palette, and patient psychology.
 */

// ============================================================================
// COLOR PALETTE - Luxury Clinic Aesthetic
// ============================================================================

export const colors = {
  // Primary - Trust, Health, Nature
  primary: {
    50: '#f0f6f2',
    100: '#dce8dc',
    200: '#b3d1b7',
    300: '#7cb087',
    400: '#4a8f5e',
    500: '#2a5c3a', // PRIMARY (legacy)
    600: '#1f4428',
    700: '#153020',
    800: '#0c1a0e', // TEXT (legacy)
    900: '#030805',
  },

  // Background - Warm Off-White
  background: {
    50: '#fefdfb',
    100: '#fffdf5',
    200: '#faf7f2', // BACKGROUND (legacy)
    300: '#f5f0eb',
    400: '#e8dfd5',
    500: '#d4c4b0',
  },

  // Borders & Subtle Dividers - Tan
  border: {
    50: '#fdfbf9',
    100: '#f9f5f0',
    200: '#eef4ee',
    300: '#e8dfd5',
    400: '#ddd8cc', // BORDER (legacy)
    500: '#ccc3b3',
    600: '#a39783',
  },

  // Text - Deep Near-Black
  text: {
    primary: '#0c1a0e', // (legacy)
    secondary: '#666666',
    muted: '#999999',
    light: '#aaaaaa', // ACCENT (legacy)
    disabled: '#cccccc',
  },

  // Semantic Colors
  success: '#eef4ee', // Light green success state (legacy)
  error: '#ff4444',
  warning: '#ffaa00',
  info: '#2563eb',

  // Neutral Grays
  gray: {
    50: '#f9f9f9',
    100: '#f3f3f3',
    200: '#e8e8e8',
    300: '#d1d1d1',
    400: '#b4b4b4',
    500: '#888888',
    600: '#666666',
    700: '#444444',
    800: '#222222',
    900: '#0f0f0f',
  },
};

// ============================================================================
// TYPOGRAPHY - Serif Brand, Sans UI
// ============================================================================

export const typography = {
  // Font Families
  fonts: {
    serif: "'Georgia', 'Times New Roman', serif",
    sans: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif",
  },

  // Heading Scales
  heading: {
    h1: {
      fontSize: '3rem',    // 48px
      lineHeight: '1.2',
      fontWeight: '600',
      letterSpacing: '-0.01em',
      fontFamily: 'serif',
    },
    h2: {
      fontSize: '2rem',    // 32px
      lineHeight: '1.3',
      fontWeight: '600',
      letterSpacing: '-0.01em',
      fontFamily: 'serif',
    },
    h3: {
      fontSize: '1.5rem',  // 24px
      lineHeight: '1.4',
      fontWeight: '600',
      fontFamily: 'serif',
    },
    h4: {
      fontSize: '1.25rem', // 20px
      lineHeight: '1.4',
      fontWeight: '600',
      fontFamily: 'serif',
    },
    h5: {
      fontSize: '1rem',    // 16px
      lineHeight: '1.5',
      fontWeight: '600',
      fontFamily: 'serif',
    },
  },

  // Body Text
  body: {
    large: {
      fontSize: '1.125rem',  // 18px
      lineHeight: '1.6',
      fontWeight: '400',
      fontFamily: 'sans',
    },
    base: {
      fontSize: '1rem',      // 16px
      lineHeight: '1.6',
      fontWeight: '400',
      fontFamily: 'sans',
    },
    small: {
      fontSize: '0.875rem',  // 14px
      lineHeight: '1.5',
      fontWeight: '400',
      fontFamily: 'sans',
    },
    xs: {
      fontSize: '0.75rem',   // 12px
      lineHeight: '1.4',
      fontWeight: '500',
      fontFamily: 'sans',
    },
  },

  // Button Text
  button: {
    fontSize: '0.875rem',  // 14px
    lineHeight: '1.4',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: 'sans',
  },

  // Labels
  label: {
    fontSize: '0.75rem',   // 12px
    lineHeight: '1.4',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    fontFamily: 'sans',
  },
};

// ============================================================================
// SPACING - 4px Base Unit System
// ============================================================================

export const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem',   // 48px
  '4xl': '4rem',   // 64px
};

// ============================================================================
// BORDER RADIUS - Friendly, Rounded
// ============================================================================

export const borderRadius = {
  none: '0',
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px (buttons)
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px (containers - legacy "2xl")
  '3xl': '1.5rem',  // 24px (card containers - legacy "3xl")
  full: '9999px',
};

// ============================================================================
// SHADOWS - Depth Cues
// ============================================================================

export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  base: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',

  // Premium elevated shadow
  elevated: '0 20px 40px rgba(0, 0, 0, 0.12)',

  // Clinical cards
  clinical: '0 4px 12px rgba(42, 92, 58, 0.08)',

  // Hover elevation
  hover: '0 12px 24px rgba(0, 0, 0, 0.15)',
};

// ============================================================================
// GRADIENTS - Cinematic & Calming
// ============================================================================

export const gradients = {
  // Form background gradient (legacy)
  formBackground: 'linear-gradient(to bottom right, #ffffff, #fffdf5)',

  // Primary accent gradient
  primaryAccent: 'linear-gradient(135deg, #2a5c3a 0%, #1f4428 100%)',

  // Subtle health gradient
  health: 'linear-gradient(135deg, #eef4ee 0%, #dce8dc 100%)',

  // Overlay dark (for background images)
  overlayDark: 'linear-gradient(to top, #0c1a0e, #0c1a0e/20%)',

  // Success gradient
  successGradient: 'linear-gradient(135deg, #eef4ee 0%, #d5e5d0 100%)',

  // Neutral fade
  fadeBottom: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.1))',
};

// ============================================================================
// ANIMATION PRESETS - Premium Motion
// ============================================================================

export const animations = {
  // Question transitions (from legacy)
  questionEnter: {
    duration: 300,
    easing: 'easeOut',
  },

  // Image/visual transitions
  imageEnter: {
    duration: 400,
    easing: 'easeOut',
  },

  // Progress bar animation
  progressBar: {
    duration: 400,
    easing: 'easeInOut',
  },

  // Button hover/tap
  buttonTap: {
    scale: 0.98,
    duration: 100,
  },

  // Card entrance
  cardEnter: {
    duration: 500,
    easing: 'easeOut',
  },

  // Loading state
  loadingPulse: {
    duration: 1500,
    easing: 'easeInOut',
    repeat: 'infinite',
  },
};

// ============================================================================
// MOTION EASING FUNCTIONS
// ============================================================================

export const easing = {
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
};

// ============================================================================
// BREAKPOINTS - Mobile-First Responsive
// ============================================================================

export const breakpoints = {
  xs: '0px',      // Mobile
  sm: '640px',    // Small tablet
  md: '768px',    // Tablet & desktop
  lg: '1024px',   // Large desktop
  xl: '1280px',   // Extra large
  '2xl': '1536px', // Ultra wide
};

// ============================================================================
// Z-INDEX HIERARCHY
// ============================================================================

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
  progressBar: 1090,
};

// ============================================================================
// OPACITY SCALE
// ============================================================================

export const opacity = {
  0: '0',
  5: '0.05',
  10: '0.1',
  20: '0.2',
  30: '0.3',
  40: '0.4',
  50: '0.5',
  60: '0.6',
  70: '0.7',
  80: '0.8',
  90: '0.9',
  100: '1',
};

// ============================================================================
// UTILITY: Get color by path (for nested objects)
// ============================================================================

export function getColor(path: string, defaultColor = colors.primary[500]): string {
  const parts = path.split('.');
  let current: any = colors;

  for (const part of parts) {
    current = current?.[part];
    if (!current) return defaultColor;
  }

  return current;
}
