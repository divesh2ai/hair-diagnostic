/**
 * HairOS Design System — Token Barrel Export
 * ─────────────────────────────────────────────────────────────────────────────
 * Single import point for all design tokens.
 *
 * Usage:
 *   import { semantic, typeRole, spacing, shadow, spring, iconMap } from '@/design-system/tokens';
 *   import type { SemanticColor } from '@/design-system/tokens';
 * ─────────────────────────────────────────────────────────────────────────────
 */

export * from './color';
export * from './typography';
export * from './spacing';
export * from './elevation';
export * from './motion';
export * from './icons';

// ─── CONSOLIDATED TOKEN MAP ───────────────────────────────────────────────────
// A single object for runtime token access (e.g., in Framer Motion inline styles,
// canvas rendering, or test utilities).

import { primitive, semantic, semanticLight }         from './color';
import { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing, typeRole } from './typography';
import { spacing, space, breakpoint, grid, container, layoutZone } from './spacing';
import { zIndex, elevation, shadow, border }          from './elevation';
import { duration, ease, spring, transition, ambient } from './motion';
import { iconSize, iconStroke, iconMap, iconUsage }   from './icons';

export const tokens = {
  color: {
    primitive,
    dark:  semantic,
    light: semanticLight,
  },
  typography: {
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    letterSpacing,
    role: typeRole,
  },
  spacing: {
    scale: spacing,
    semantic: space,
    breakpoint,
    grid,
    container,
    layoutZone,
  },
  elevation: {
    zIndex,
    levels: elevation,
    shadow,
    border,
  },
  motion: {
    duration,
    ease,
    spring,
    transition,
    ambient,
  },
  icon: {
    size:   iconSize,
    stroke: iconStroke,
    map:    iconMap,
    usage:  iconUsage,
  },
} as const;

export type Tokens = typeof tokens;

export default tokens;
