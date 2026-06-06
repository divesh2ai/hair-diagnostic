/**
 * HairOS Design System — Next.js Font Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses next/font for zero-layout-shift font loading.
 * Fonts are loaded as CSS variables and consumed by Tailwind's fontFamily config.
 *
 * Usage in app/layout.tsx:
 *   import { fontVariables } from '@/design-system/next-integration/fonts';
 *   <html className={fontVariables}>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Cormorant_Garamond, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';

/** Display / emotional — Cormorant Garamond */
export const cormorant = Cormorant_Garamond({
  subsets:  ['latin'],
  variable: '--font-display',
  display:  'swap',
  weight:   ['300', '400', '500', '600', '700'],
  style:    ['normal', 'italic'],
  preload:  true,
});

/** Body / UI — Plus Jakarta Sans */
export const jakarta = Plus_Jakarta_Sans({
  subsets:  ['latin'],
  variable: '--font-body',
  display:  'swap',
  weight:   ['400', '500', '600', '700', '800'],
  style:    ['normal'],
  preload:  true,
  adjustFontFallback: true,
});

/** Monospace / data — JetBrains Mono */
export const jetbrains = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
  weight:   ['300', '400', '500', '600'],
  style:    ['normal'],
  preload:  false,         // not critical path
  adjustFontFallback: true,
});

/**
 * Combined class string — apply to <html> element.
 * Exposes: --font-display, --font-body, --font-mono as CSS variables.
 */
export const fontVariables = [
  cormorant.variable,
  jakarta.variable,
  jetbrains.variable,
].join(' ');
