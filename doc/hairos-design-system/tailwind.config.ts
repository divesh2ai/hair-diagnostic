/**
 * HairOS Design System — Tailwind CSS Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy:
 *   • All primitive values live here as Tailwind utilities.
 *   • Semantic tokens are exposed via CSS custom properties (globals.css)
 *     and referenced via Tailwind's arbitrary value syntax or a companion
 *     plugin where needed.
 *   • Dark mode: class strategy ("dark") — HairOS defaults to dark,
 *     the <html> element carries class="dark" always unless patient opts
 *     into light-mode (future capability).
 *   • Every token key matches the design token name — no translation layer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],

  // Dark-first: "dark" class on <html> enables dark utilities.
  // HairOS ships dark by default; light overrides are additive.
  darkMode: 'class',

  theme: {
    // ── Override (not extend) core scales with HairOS values ────
    screens: {
      xs:    '375px',
      sm:    '640px',
      md:    '768px',
      lg:    '1024px',
      xl:    '1280px',
      '2xl': '1440px',
      '3xl': '1920px',
    },

    // ── Container ───────────────────────────────────────────────
    container: {
      center:  true,
      padding: {
        DEFAULT: '1.25rem',  // 20px mobile
        sm:      '1.5rem',   // 24px
        md:      '2rem',     // 32px
        lg:      '3rem',     // 48px
        xl:      '4rem',     // 64px
        '2xl':   'auto',     // auto margins, max-width handles it
      },
    },

    // ── Font Families ───────────────────────────────────────────
    fontFamily: {
      display: ['Cormorant Garamond', 'Cormorant', 'Georgia', 'serif'],
      body:    ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      mono:    ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      sans:    ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      serif:   ['Cormorant Garamond', 'Georgia', 'serif'],
    },

    // ── Font Weights ────────────────────────────────────────────
    fontWeight: {
      light:     '300',
      regular:   '400',
      normal:    '400',
      medium:    '500',
      semibold:  '600',
      bold:      '700',
      extrabold: '800',
    },

    // ── Font Sizes — fluid clamp() scale ───────────────────────
    fontSize: {
      '2xs': ['clamp(0.6875rem, 0.66rem + 0.14vw, 0.75rem)',   { lineHeight: '1.4'  }],
      xs:    ['clamp(0.75rem,   0.71rem + 0.19vw, 0.875rem)',  { lineHeight: '1.4'  }],
      sm:    ['clamp(0.875rem,  0.83rem + 0.24vw, 1rem)',      { lineHeight: '1.5'  }],
      base:  ['clamp(1rem,      0.95rem + 0.24vw, 1.125rem)',  { lineHeight: '1.55' }],
      lg:    ['clamp(1.125rem,  1.07rem + 0.29vw, 1.25rem)',   { lineHeight: '1.55' }],
      xl:    ['clamp(1.25rem,   1.14rem + 0.53vw, 1.5rem)',    { lineHeight: '1.3'  }],
      '2xl': ['clamp(1.5rem,    1.29rem + 1.00vw, 2rem)',      { lineHeight: '1.3'  }],
      '3xl': ['clamp(1.875rem,  1.56rem + 1.52vw, 2.5rem)',    { lineHeight: '1.15' }],
      '4xl': ['clamp(2.25rem,   1.85rem + 1.90vw, 3.25rem)',   { lineHeight: '1.1'  }],
      '5xl': ['clamp(3rem,      2.33rem + 3.19vw, 4.5rem)',    { lineHeight: '1.05' }],
      '6xl': ['clamp(4rem,      3.00rem + 4.76vw, 6rem)',      { lineHeight: '1'    }],
      '7xl': ['clamp(5rem,      3.62rem + 6.57vw, 8rem)',      { lineHeight: '1'    }],
    },

    // ── Line Heights ────────────────────────────────────────────
    lineHeight: {
      none:    '1',
      tight:   '1.15',
      snug:    '1.3',
      compact: '1.4',
      normal:  '1.55',
      relaxed: '1.7',
      loose:   '1.9',
    },

    // ── Letter Spacing ──────────────────────────────────────────
    letterSpacing: {
      tighter: '-0.05em',
      tight:   '-0.025em',
      normal:  '0em',
      wide:    '0.025em',
      wider:   '0.06em',
      widest:  '0.12em',
      ultra:   '0.22em',
    },

    // ── Spacing — 4px base grid ─────────────────────────────────
    spacing: {
      px:   '1px',
      0:    '0',
      0.5:  '0.125rem',
      1:    '0.25rem',
      1.5:  '0.375rem',
      2:    '0.5rem',
      2.5:  '0.625rem',
      3:    '0.75rem',
      3.5:  '0.875rem',
      4:    '1rem',
      5:    '1.25rem',
      6:    '1.5rem',
      7:    '1.75rem',
      8:    '2rem',
      9:    '2.25rem',
      10:   '2.5rem',
      11:   '2.75rem',
      12:   '3rem',
      14:   '3.5rem',
      16:   '4rem',
      18:   '4.5rem',
      20:   '5rem',
      24:   '6rem',
      28:   '7rem',
      32:   '8rem',
      36:   '9rem',
      40:   '10rem',
      44:   '11rem',
      48:   '12rem',
      52:   '13rem',
      56:   '14rem',
      60:   '15rem',
      64:   '16rem',
      72:   '18rem',
      80:   '20rem',
      96:   '24rem',
      112:  '28rem',
      128:  '32rem',
    },

    // ── Border Radius ───────────────────────────────────────────
    borderRadius: {
      none:     '0px',
      xs:       '2px',
      sm:       '4px',
      DEFAULT:  '8px',
      md:       '8px',
      lg:       '12px',
      xl:       '16px',
      '2xl':    '20px',
      '3xl':    '24px',
      '4xl':    '32px',
      full:     '9999px',
      organic:  '28px 16px 28px 16px',
    },

    // ── Z-Index ─────────────────────────────────────────────────
    zIndex: {
      auto:    'auto',
      behind:  '-1',
      0:       '0',
      10:      '10',
      20:      '20',
      30:      '30',
      40:      '40',
      50:      '50',
      60:      '60',
      70:      '70',
      80:      '80',
      sticky:  '20',
      drawer:  '30',
      modal:   '40',
      popover: '50',
      toast:   '60',
      top:     '70',
      ritual:  '80',
    },

    // ── Colors — HairOS palette ─────────────────────────────────
    colors: {
      transparent: 'transparent',
      current:     'currentColor',
      white:       '#FFFFFF',
      black:       '#000000',

      // Primitive palettes
      gold: {
        50:  '#FBF7EF',
        100: '#F5EDDA',
        200: '#EAD9B4',
        300: '#DFC48D',
        400: '#D4AF67',
        500: '#C8A96E',
        600: '#B8924A',
        700: '#9A7A38',
        800: '#7C6030',
        900: '#5E4A28',
        950: '#3A2D18',
      },
      sage: {
        50:  '#EDF5F0',
        100: '#D4E8DC',
        200: '#A9D1B9',
        300: '#7DB996',
        400: '#5A9A73',
        500: '#3D6B50',
        600: '#325A43',
        700: '#264836',
        800: '#1B3729',
        900: '#10261C',
        950: '#08130E',
      },
      obsidian: {
        50:  '#E8E9EC',
        100: '#C5C8D0',
        200: '#9DA3B0',
        300: '#757F92',
        400: '#4F5B74',
        500: '#2C3142',
        600: '#1E2538',
        700: '#131929',
        800: '#0D1220',
        900: '#0A0E1A',
        950: '#060810',
      },
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
      biolume: {
        50:  '#EEF9F6',
        100: '#D0F0E8',
        200: '#9FDFD0',
        300: '#61CAB7',
        400: '#2EB09E',
        500: '#1A9083',
        600: '#137268',
        700: '#0E574F',
        800: '#0A3D38',
        900: '#062623',
        950: '#031413',
      },
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

      // Semantic aliases (CSS var–backed for runtime theming)
      // These reference CSS custom properties set in globals.css
      bg: {
        base:     'rgb(var(--bg-base) / <alpha-value>)',
        surface:  'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        overlay:  'rgb(var(--bg-overlay) / <alpha-value>)',
        subtle:   'rgb(var(--bg-subtle) / <alpha-value>)',
        inverse:  'rgb(var(--bg-inverse) / <alpha-value>)',
        premium:  'rgb(var(--bg-premium) / <alpha-value>)',
        clinical: 'rgb(var(--bg-clinical) / <alpha-value>)',
        ai:       'rgb(var(--bg-ai) / <alpha-value>)',
      },
      tx: {
        primary:   'rgb(var(--tx-primary) / <alpha-value>)',
        secondary: 'rgb(var(--tx-secondary) / <alpha-value>)',
        tertiary:  'rgb(var(--tx-tertiary) / <alpha-value>)',
        disabled:  'rgb(var(--tx-disabled) / <alpha-value>)',
        inverse:   'rgb(var(--tx-inverse) / <alpha-value>)',
        brand:     'rgb(var(--tx-brand) / <alpha-value>)',
        accent:    'rgb(var(--tx-accent) / <alpha-value>)',
        biolume:   'rgb(var(--tx-biolume) / <alpha-value>)',
        danger:    'rgb(var(--tx-danger) / <alpha-value>)',
        warning:   'rgb(var(--tx-warning) / <alpha-value>)',
        display:   'rgb(var(--tx-display) / <alpha-value>)',
        data:      'rgb(var(--tx-data) / <alpha-value>)',
      },
      br: {
        subtle:      'rgb(var(--br-subtle) / <alpha-value>)',
        default:     'rgb(var(--br-default) / <alpha-value>)',
        strong:      'rgb(var(--br-strong) / <alpha-value>)',
        brand:       'rgb(var(--br-brand) / <alpha-value>)',
        accent:      'rgb(var(--br-accent) / <alpha-value>)',
        ai:          'rgb(var(--br-ai) / <alpha-value>)',
        danger:      'rgb(var(--br-danger) / <alpha-value>)',
      },
    },

    // ── Box Shadows ─────────────────────────────────────────────
    boxShadow: {
      none:  'none',
      xs:    '0 1px 2px rgba(0,0,0,0.5)',
      sm:    '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
      md:    '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4)',
      lg:    '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5)',
      xl:    '0 20px 25px -5px rgba(0,0,0,0.7), 0 10px 10px -5px rgba(0,0,0,0.5)',
      '2xl': '0 25px 50px -12px rgba(0,0,0,0.9)',
      inner: 'inset 0 2px 4px rgba(0,0,0,0.5)',
      // Glow system
      'glow-gold-xs': '0 0 8px rgba(200,169,110,0.25)',
      'glow-gold-sm': '0 0 16px rgba(200,169,110,0.30), 0 0 4px rgba(200,169,110,0.20)',
      'glow-gold-md': '0 0 24px rgba(200,169,110,0.35), 0 0 8px rgba(200,169,110,0.25)',
      'glow-gold-lg': '0 0 40px rgba(200,169,110,0.40), 0 0 16px rgba(200,169,110,0.30)',
      'glow-gold-xl': '0 0 64px rgba(200,169,110,0.45), 0 0 24px rgba(200,169,110,0.35)',
      'glow-sage-sm': '0 0 16px rgba(61,107,80,0.35), 0 0 4px rgba(61,107,80,0.25)',
      'glow-sage-md': '0 0 24px rgba(61,107,80,0.40), 0 0 8px rgba(61,107,80,0.30)',
      'glow-sage-lg': '0 0 40px rgba(61,107,80,0.45), 0 0 16px rgba(61,107,80,0.35)',
      'glow-ai-sm':   '0 0 16px rgba(46,176,158,0.30), 0 0 4px rgba(46,176,158,0.20)',
      'glow-ai-md':   '0 0 32px rgba(46,176,158,0.35), 0 0 8px rgba(46,176,158,0.25)',
      'glow-ai-lg':   '0 0 60px rgba(46,176,158,0.40), 0 0 20px rgba(46,176,158,0.30)',
      'glow-danger':  '0 0 16px rgba(239,68,68,0.35), 0 0 4px rgba(239,68,68,0.25)',
      // Compound: depth + glow
      card:           '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,169,110,0.08)',
      'card-hover':   '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5), 0 0 16px rgba(200,169,110,0.15), 0 0 0 1px rgba(200,169,110,0.18)',
      'btn-primary':  '0 4px 14px rgba(200,169,110,0.35), 0 2px 6px rgba(0,0,0,0.4)',
      'btn-primary-hover': '0 6px 20px rgba(200,169,110,0.45), 0 4px 10px rgba(0,0,0,0.5)',
      'ritual-orb':   '0 0 80px rgba(46,176,158,0.40), 0 0 160px rgba(46,176,158,0.20), 0 0 40px rgba(200,169,110,0.15)',
      'focus-gold':   '0 0 0 2px rgba(10,14,26,1), 0 0 0 4px rgba(200,169,110,0.70)',
      'focus-sage':   '0 0 0 2px rgba(10,14,26,1), 0 0 0 4px rgba(61,107,80,0.70)',
    },

    // ── Drop Shadows ────────────────────────────────────────────
    dropShadow: {
      sm:   '0 1px 1px rgba(0,0,0,0.5)',
      md:   ['0 4px 3px rgba(0,0,0,0.3)', '0 2px 2px rgba(0,0,0,0.2)'],
      lg:   ['0 10px 8px rgba(0,0,0,0.3)', '0 4px 3px rgba(0,0,0,0.2)'],
      gold: '0 0 8px rgba(200,169,110,0.6)',
      sage: '0 0 8px rgba(61,107,80,0.6)',
      ai:   '0 0 8px rgba(46,176,158,0.6)',
    },

    // ── Opacity ─────────────────────────────────────────────────
    opacity: {
      0:    '0',
      5:    '0.05',
      10:   '0.1',
      15:   '0.15',
      20:   '0.2',
      25:   '0.25',
      30:   '0.3',
      35:   '0.35',
      40:   '0.4',
      45:   '0.45',
      50:   '0.5',
      55:   '0.55',
      60:   '0.6',
      65:   '0.65',
      70:   '0.7',
      75:   '0.75',
      80:   '0.8',
      85:   '0.85',
      90:   '0.9',
      95:   '0.95',
      100:  '1',
    },

    // ── Backdrop Blur ───────────────────────────────────────────
    backdropBlur: {
      none: '0',
      xs:   '2px',
      sm:   '4px',
      md:   '8px',
      lg:   '16px',
      xl:   '24px',
      '2xl':'32px',
      '3xl':'48px',
    },

    // ── Blur ────────────────────────────────────────────────────
    blur: {
      none: '0',
      xs:   '2px',
      sm:   '4px',
      md:   '8px',
      lg:   '16px',
      xl:   '24px',
      '2xl':'40px',
      '3xl':'64px',
    },

    // ── Transitions ─────────────────────────────────────────────
    transitionDuration: {
      instant: '80ms',
      fast:    '150ms',
      quick:   '200ms',
      normal:  '300ms',
      smooth:  '400ms',
      slow:    '550ms',
      gentle:  '700ms',
      patient: '1000ms',
      ritual:  '1500ms',
    },

    transitionTimingFunction: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      linear:  'linear',
      in:      'cubic-bezier(0.4, 0, 1, 1)',
      out:     'cubic-bezier(0, 0, 0.2, 1)',
      'in-out':'cubic-bezier(0.4, 0, 0.2, 1)',
      snap:    'cubic-bezier(0.16, 1, 0.3, 1)',
      elegant: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      organic: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      precise: 'cubic-bezier(0.12, 0, 0.39, 0)',
    },

    transitionProperty: {
      DEFAULT: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter',
      none:    'none',
      all:     'all',
      colors:  'color, background-color, border-color, text-decoration-color, fill, stroke',
      opacity: 'opacity',
      shadow:  'box-shadow',
      transform: 'transform',
      glow:    'box-shadow, opacity',
    },

    // ── Max Widths ──────────────────────────────────────────────
    maxWidth: {
      none:   'none',
      xs:     '20rem',     // 320px
      sm:     '24rem',     // 384px
      md:     '28rem',     // 448px
      lg:     '32rem',     // 512px
      xl:     '36rem',     // 576px
      '2xl':  '42rem',     // 672px
      '3xl':  '48rem',     // 768px
      '4xl':  '56rem',     // 896px
      '5xl':  '64rem',     // 1024px
      '6xl':  '72rem',     // 1152px
      '7xl':  '80rem',     // 1280px
      prose:  '68ch',
      full:   '100%',
      screen: '100vw',
      content:'90rem',     // 1440px — HairOS design reference
      // Contextual containers
      modal:  '35rem',     // 560px — standard modal
      panel:  '22rem',     // 352px — data panel
      report: '28rem',     // 448px — report panel
      card:   '24rem',     // 384px — standard card
    },

    // ── Min Heights ─────────────────────────────────────────────
    minHeight: {
      0:      '0px',
      full:   '100%',
      screen: '100vh',
      svh:    '100svh',
      dvh:    '100dvh',
      touch:  '2.75rem',  // 44px — minimum touch target
      btn:    '3rem',     // 48px — standard button height
    },

    // ── Min Widths ──────────────────────────────────────────────
    minWidth: {
      0:      '0px',
      full:   '100%',
      touch:  '2.75rem',  // 44px
      btn:    '5rem',
    },

    // ── Aspect Ratios ───────────────────────────────────────────
    aspectRatio: {
      auto:        'auto',
      square:      '1 / 1',
      video:       '16 / 9',
      portrait:    '3 / 4',
      wide:        '21 / 9',
      scalp:       '4 / 3',     // follicle map aspect
      card:        '5 / 3',     // standard insight card
      hero:        '16 / 7',    // hero section
    },

    extend: {
      // ── Animations ───────────────────────────────────────────
      keyframes: {
        // Fade
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
        fadeDown: {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to:   { opacity: '1', transform: 'translateY(0)'     },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)'    },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to:   { opacity: '1', transform: 'translateX(0)'    },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
        // Ambient
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '0.7' },
          '50%':      { opacity: '1' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%':      { transform: 'scale(1.04)', opacity: '0.8' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        orbPulse: {
          '0%':   { transform: 'scale(1)', opacity: '0.6' },
          '50%':  { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0.6' },
        },
        ringExpand: {
          '0%':   { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        scan: {
          '0%':   { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        // Data build
        counterUp: {
          from: { opacity: '0', transform: 'translateY(12px)', filter: 'blur(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)',    filter: 'blur(0)' },
        },
        dataReveal: {
          from: { opacity: '0', transform: 'translateX(-8px)', filter: 'blur(4px)' },
          to:   { opacity: '1', transform: 'translateX(0)',    filter: 'blur(0)' },
        },
        progressFill: {
          from: { transform: 'scaleX(0)' },
          to:   { transform: 'scaleX(1)' },
        },
        // CTA / attention
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 16px rgba(200,169,110,0.3)' },
          '50%':      { boxShadow: '0 0 32px rgba(200,169,110,0.6)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%':      { transform: 'rotate(2deg)' },
        },
      },

      animation: {
        'fade-in':       'fadeIn 0.3s cubic-bezier(0,0,0.2,1) both',
        'fade-up':       'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'fade-down':     'fadeDown 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in':      'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-right':   'slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-up':      'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        breathe:         'breathe 6s ease-in-out infinite',
        float:           'float 4s ease-in-out infinite',
        'orb-pulse':     'orbPulse 3s ease-in-out infinite',
        'ring-expand':   'ringExpand 2s ease-out infinite',
        scan:            'scan 2s linear infinite',
        shimmer:         'shimmer 4s linear infinite',
        'gradient-shift':'gradientShift 8s ease infinite',
        'pulse-slow':    'pulseSlow 3s ease-in-out infinite',
        'counter-up':    'counterUp 0.8s cubic-bezier(0.25,0.46,0.45,0.94) both',
        'data-reveal':   'dataReveal 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'progress-fill': 'progressFill 1s cubic-bezier(0.34,1.56,0.64,1) both',
        'glow-pulse':    'glowPulse 2s ease-in-out infinite',
        wiggle:          'wiggle 0.4s ease-in-out both',
      },

      // ── Background Gradients ─────────────────────────────────
      backgroundImage: {
        // Brand gradients
        'gradient-gold':     'linear-gradient(135deg, #C8A96E 0%, #D4AF67 50%, #9A7A38 100%)',
        'gradient-gold-h':   'linear-gradient(90deg, #9A7A38 0%, #C8A96E 50%, #D4AF67 100%)',
        'gradient-sage':     'linear-gradient(135deg, #3D6B50 0%, #5A9A73 100%)',
        'gradient-obsidian': 'linear-gradient(180deg, #0D1220 0%, #0A0E1A 100%)',
        'gradient-depth':    'linear-gradient(180deg, #131929 0%, #0A0E1A 60%, #060810 100%)',
        // Surface gradients
        'gradient-surface':  'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        'gradient-card':     'linear-gradient(135deg, rgba(200,169,110,0.06) 0%, rgba(13,18,32,0.8) 100%)',
        'gradient-premium':  'linear-gradient(135deg, rgba(200,169,110,0.08) 0%, rgba(10,14,26,0) 60%)',
        // Radial gradients
        'radial-gold':       'radial-gradient(ellipse at center, rgba(200,169,110,0.20) 0%, transparent 70%)',
        'radial-sage':       'radial-gradient(ellipse at center, rgba(61,107,80,0.25) 0%, transparent 70%)',
        'radial-ai':         'radial-gradient(ellipse at center, rgba(46,176,158,0.25) 0%, transparent 70%)',
        'radial-depth':      'radial-gradient(ellipse at top, #131929 0%, #0A0E1A 100%)',
        // Shimmer (animated)
        'shimmer-gold':      'linear-gradient(90deg, transparent 0%, rgba(200,169,110,0.15) 50%, transparent 100%)',
        'shimmer-white':     'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        // Noise texture overlay
        'noise':             "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        // Mesh gradient (biological)
        'mesh-bio':          'radial-gradient(at 40% 20%, rgba(61,107,80,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(200,169,110,0.10) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(46,176,158,0.08) 0px, transparent 50%), radial-gradient(at 80% 50%, rgba(10,14,26,0) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(200,169,110,0.06) 0px, transparent 50%)',
      },

      // ── Background Size ──────────────────────────────────────
      backgroundSize: {
        auto:   'auto',
        cover:  'cover',
        contain:'contain',
        '200%': '200% auto',
        '300%': '300% auto',
      },

      // ── Custom utilities ─────────────────────────────────────
      width: {
        'nav-collapsed': '4.5rem',
        'nav-expanded':  '15rem',
        'data-panel':    '22rem',
        'report-panel':  '28rem',
      },

      height: {
        'nav':      '4rem',
        'nav-sm':   '3.5rem',
        'tab-bar':  '5rem',
        'floating': '6rem',
        dvh:        '100dvh',
        svh:        '100svh',
      },
    },
  },

  // ── Custom Plugins ─────────────────────────────────────────────
  plugins: [

    // 1. Typography role utilities
    // Adds classes: .type-display-hero, .type-body-large, .type-data-hero, etc.
    plugin(function ({ addUtilities, theme }) {
      const roles: Record<string, object> = {
        '.type-display-hero': {
          fontFamily:    theme('fontFamily.display', []).join(', '),
          fontSize:      theme('fontSize.7xl.0', '5rem'),
          fontWeight:    theme('fontWeight.light', '300'),
          lineHeight:    theme('lineHeight.tight', '1.15'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-display-large': {
          fontFamily:    theme('fontFamily.display', []).join(', '),
          fontSize:      theme('fontSize.6xl.0', '4rem'),
          fontWeight:    theme('fontWeight.light', '300'),
          lineHeight:    theme('lineHeight.tight', '1.15'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-display-medium': {
          fontFamily:    theme('fontFamily.display', []).join(', '),
          fontSize:      theme('fontSize.5xl.0', '3rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.tight', '1.15'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-display-small': {
          fontFamily:    theme('fontFamily.display', []).join(', '),
          fontSize:      theme('fontSize.4xl.0', '2.25rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.snug', '1.3'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-display-quote': {
          fontFamily:    theme('fontFamily.display', []).join(', '),
          fontSize:      theme('fontSize.3xl.0', '1.875rem'),
          fontWeight:    theme('fontWeight.light', '300'),
          lineHeight:    theme('lineHeight.relaxed', '1.7'),
          letterSpacing: '0em',
          fontStyle:     'italic',
        },
        '.type-headline-large': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.2xl.0', '1.5rem'),
          fontWeight:    theme('fontWeight.semibold', '600'),
          lineHeight:    theme('lineHeight.snug', '1.3'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-headline-medium': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.xl.0', '1.25rem'),
          fontWeight:    theme('fontWeight.semibold', '600'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
          letterSpacing: '-0.015em',
        },
        '.type-headline-small': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.lg.0', '1.125rem'),
          fontWeight:    theme('fontWeight.semibold', '600'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
          letterSpacing: '0em',
        },
        '.type-body-large': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.lg.0', '1.125rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.relaxed', '1.7'),
        },
        '.type-body-medium': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.base.0', '1rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.relaxed', '1.7'),
        },
        '.type-body-small': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.sm.0', '0.875rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.normal', '1.55'),
        },
        '.type-label-large': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.sm.0', '0.875rem'),
          fontWeight:    theme('fontWeight.semibold', '600'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
          letterSpacing: theme('letterSpacing.wider', '0.06em'),
          textTransform: 'uppercase',
        },
        '.type-label-medium': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.xs.0', '0.75rem'),
          fontWeight:    theme('fontWeight.semibold', '600'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
          letterSpacing: theme('letterSpacing.widest', '0.12em'),
          textTransform: 'uppercase',
        },
        '.type-label-small': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.2xs.0', '0.6875rem'),
          fontWeight:    theme('fontWeight.medium', '500'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
          letterSpacing: theme('letterSpacing.ultra', '0.22em'),
          textTransform: 'uppercase',
        },
        '.type-data-hero': {
          fontFamily:    theme('fontFamily.mono', []).join(', '),
          fontSize:      theme('fontSize.4xl.0', '2.25rem'),
          fontWeight:    theme('fontWeight.light', '300'),
          lineHeight:    theme('lineHeight.none', '1'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-data-large': {
          fontFamily:    theme('fontFamily.mono', []).join(', '),
          fontSize:      theme('fontSize.2xl.0', '1.5rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.none', '1'),
          letterSpacing: theme('letterSpacing.tight', '-0.025em'),
        },
        '.type-data-medium': {
          fontFamily:    theme('fontFamily.mono', []).join(', '),
          fontSize:      theme('fontSize.base.0', '1rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
        },
        '.type-overline': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.xs.0', '0.75rem'),
          fontWeight:    theme('fontWeight.medium', '500'),
          lineHeight:    theme('lineHeight.compact', '1.4'),
          letterSpacing: theme('letterSpacing.ultra', '0.22em'),
          textTransform: 'uppercase',
        },
        '.type-caption': {
          fontFamily:    theme('fontFamily.body', []).join(', '),
          fontSize:      theme('fontSize.xs.0', '0.75rem'),
          fontWeight:    theme('fontWeight.regular', '400'),
          lineHeight:    theme('lineHeight.normal', '1.55'),
        },
      };
      addUtilities(roles);
    }),

    // 2. Elevation utilities
    // Adds: .elevation-0 through .elevation-5
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.elevation-0': {
          boxShadow: 'none',
        },
        '.elevation-1': {
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
          border:    '1px solid rgba(255,255,255,0.07)',
        },
        '.elevation-2': {
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
          border:    '1px solid rgba(255,255,255,0.09)',
        },
        '.elevation-3': {
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
          border:    '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(16px)',
        },
        '.elevation-4': {
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.7), 0 10px 10px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
          border:    '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(24px)',
        },
        '.elevation-5': {
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
          border:    '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(32px)',
        },
      });
    }),

    // 3. Glass morphism utilities
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.glass': {
          backgroundColor:  'rgba(13, 18, 32, 0.75)',
          backdropFilter:   'blur(16px)',
          border:           '1px solid rgba(255,255,255,0.08)',
        },
        '.glass-sm': {
          backgroundColor: 'rgba(13, 18, 32, 0.60)',
          backdropFilter:  'blur(8px)',
          border:          '1px solid rgba(255,255,255,0.06)',
        },
        '.glass-lg': {
          backgroundColor: 'rgba(13, 18, 32, 0.85)',
          backdropFilter:  'blur(24px)',
          border:          '1px solid rgba(255,255,255,0.10)',
        },
        '.glass-gold': {
          backgroundColor: 'rgba(200, 169, 110, 0.08)',
          backdropFilter:  'blur(16px)',
          border:          '1px solid rgba(200,169,110,0.20)',
        },
        '.glass-sage': {
          backgroundColor: 'rgba(61, 107, 80, 0.08)',
          backdropFilter:  'blur(16px)',
          border:          '1px solid rgba(61,107,80,0.20)',
        },
        '.glass-ai': {
          backgroundColor: 'rgba(46, 176, 158, 0.06)',
          backdropFilter:  'blur(16px)',
          border:          '1px solid rgba(46,176,158,0.20)',
        },
      });
    }),

    // 4. Focus ring utilities
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.focus-gold': {
          outline: 'none',
          boxShadow: '0 0 0 2px #0A0E1A, 0 0 0 4px rgba(200,169,110,0.70)',
        },
        '.focus-sage': {
          outline: 'none',
          boxShadow: '0 0 0 2px #0A0E1A, 0 0 0 4px rgba(61,107,80,0.70)',
        },
        '.focus-visible-gold': {
          '&:focus-visible': {
            outline: 'none',
            boxShadow: '0 0 0 2px #0A0E1A, 0 0 0 4px rgba(200,169,110,0.70)',
          },
        },
        '.focus-visible-sage': {
          '&:focus-visible': {
            outline: 'none',
            boxShadow: '0 0 0 2px #0A0E1A, 0 0 0 4px rgba(61,107,80,0.70)',
          },
        },
      });
    }),

    // 5. Scrollbar utilities
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(200,169,110,0.3) transparent',
          '&::-webkit-scrollbar':       { width: '4px', height: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background:   'rgba(200,169,110,0.3)',
            borderRadius: '9999px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(200,169,110,0.5)',
          },
        },
      });
    }),

    // 6. Grid layout helpers
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.grid-hairos-4':  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',  gap: '1rem' },
        '.grid-hairos-8':  { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',  gap: '1.5rem' },
        '.grid-hairos-12': { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' },
        // Insight card grid — asymmetric 1/3 + 2/3
        '.grid-insight': {
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '1.5rem',
        },
        // Data panel grid — fixed sidebar + fluid content
        '.grid-app-shell': {
          display: 'grid',
          gridTemplateColumns: 'var(--nav-width, 4.5rem) 1fr',
          gridTemplateRows: 'auto 1fr',
          minHeight: '100dvh',
        },
      });
    }),

  ],
};

export default config;
