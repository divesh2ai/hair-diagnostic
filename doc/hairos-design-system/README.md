# HairOS Design System

**Version 1.0 · Next.js + Tailwind CSS + Framer Motion**

> Derived from the HairOS Experience Bible. Every token exists for a reason. Every decision is traceable to a principle.

---

## Architecture

```
hairos-design-system/
├── tokens/
│   ├── color.ts          Primitive palette + semantic color tokens
│   ├── typography.ts     Font families, scale, weights, type roles
│   ├── spacing.ts        4px grid, breakpoints, grid spec, layout zones
│   ├── elevation.ts      Z-index, elevation levels, shadows, borders
│   ├── motion.ts         Durations, easings, springs, Framer variants
│   ├── icons.ts          Icon size scale, stroke weights, semantic map
│   └── index.ts          Barrel export + consolidated token map
├── components/
│   ├── tokens.ts         Component-level token architecture (all components)
│   └── framer-variants.ts  Framer Motion variant library
├── css/
│   └── globals.css       CSS custom properties + Tailwind layers
├── next-integration/
│   ├── fonts.ts          next/font configuration
│   └── layout-template.tsx  app/layout.tsx starter
└── tailwind.config.ts    Full Tailwind configuration
```

---

## Quick Start

### 1. Copy files into your Next.js project

```
src/design-system/ ← paste the entire hairos-design-system/ folder here
```

### 2. Update tailwind.config.ts

```ts
// tailwind.config.ts (project root)
import type { Config } from 'tailwindcss';
import hairosConfig from './src/design-system/tailwind.config';

const config: Config = {
  ...hairosConfig,
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
};

export default config;
```

### 3. Import global CSS in layout

```ts
// app/layout.tsx
import '@/design-system/css/globals.css';
import { fontVariables } from '@/design-system/next-integration/fonts';
```

### 4. Apply font variables and dark class to html

```tsx
<html lang="en" className={`dark ${fontVariables}`}>
```

---

## Token Reference

### Color System

Three layers — never skip levels:

```
Primitive  →  gold[500], sage[300], obsidian[900]   (tokens/color.ts)
Semantic   →  semantic.background.base               (tokens/color.ts)
Component  →  cardTokens.variant.insight.container   (components/tokens.ts)
```

**In Tailwind:**
```html
<!-- Primitive -->
<div class="bg-gold-500 text-obsidian-900">

<!-- Semantic via CSS var -->
<div class="bg-[var(--bg-surface)] text-[var(--tx-primary)]">

<!-- Semantic via Tailwind alias -->
<div class="bg-bg-surface text-tx-primary">
```

**In TypeScript:**
```ts
import { semantic, primitive } from '@/design-system/tokens/color';

const brandColor = semantic.brand.primary;   // '#C8A96E'
const goldScale  = primitive.gold[500];      // '#C8A96E'
```

---

### Typography System

Two font families, semantic roles:

| Role | Family | Use |
|------|--------|-----|
| `display-*` | Cormorant Garamond | Emotional moments, headlines, insights |
| `headline-*` | Plus Jakarta Sans | Section headers, card titles |
| `body-*` | Plus Jakarta Sans | All reading content |
| `label-*` | Plus Jakarta Sans | UI chrome, navigation, tags |
| `data-*` | JetBrains Mono | Numbers, measurements, clinical values |
| `overline` | Plus Jakarta Sans | Section pre-titles, category markers |
| `caption` | Plus Jakarta Sans | Supporting text, footnotes |

**Tailwind utility classes:**
```html
<h1 class="type-display-hero text-[var(--tx-display)]">
<p class="type-body-large text-[var(--tx-secondary)]">
<span class="type-data-hero num-clinical text-[var(--tx-data)]">
<span class="type-label-medium text-[var(--tx-brand)]">
```

**All type scale classes:**
- `.type-display-hero` · `.type-display-large` · `.type-display-medium` · `.type-display-small` · `.type-display-quote`
- `.type-headline-large` · `.type-headline-medium` · `.type-headline-small`
- `.type-body-large` · `.type-body-medium` · `.type-body-small`
- `.type-label-large` · `.type-label-medium` · `.type-label-small`
- `.type-data-hero` · `.type-data-large` · `.type-data-medium`
- `.type-overline` · `.type-caption`

---

### Color Palette

#### Primitive (raw values — use only in tokens layer)

| Token | Value | Description |
|-------|-------|-------------|
| `gold-500` | `#C8A96E` | Brand anchor — keratin, warmth, premium |
| `sage-500` | `#3D6B50` | Brand anchor — living tissue, clinical growth |
| `obsidian-900` | `#0A0E1A` | Brand anchor — depth, void, premium dark |
| `biolume-400` | `#2EB09E` | AI/intelligence — bioluminescent accent |
| `crimson-400` | `#F87171` | Clinical danger — alerts only |
| `amber-400` | `#FBBF24` | Clinical caution — warnings only |

#### Semantic CSS Variables

**Backgrounds:**
```css
--bg-base      /* #0A0E1A — page canvas */
--bg-surface   /* #0D1220 — cards, panels */
--bg-elevated  /* #131929 — modals, popovers */
--bg-overlay   /* #1E2538 — drawers */
--bg-subtle    /* #2C3142 — hover states */
--bg-glass     /* rgba(13,18,32,0.75) — blur panels */
--bg-premium   /* rgba(200,169,110,0.06) — gold tint */
--bg-clinical  /* rgba(61,107,80,0.08) — sage tint */
--bg-ai        /* rgba(46,176,158,0.06) — biolume tint */
```

**Text:**
```css
--tx-primary   /* #FAFAFA — high emphasis */
--tx-secondary /* #D4D4D8 — body text */
--tx-tertiary  /* #71717A — captions, metadata */
--tx-brand     /* #D4AF67 — gold brand moments */
--tx-accent    /* #7DB996 — sage accent */
--tx-biolume   /* #61CAB7 — AI / data */
--tx-data      /* #9FDFD0 — clinical numbers */
--tx-display   /* #FFFFFF — serif display text */
```

**Borders:**
```css
--br-subtle    /* rgba(255,255,255,0.06) */
--br-default   /* rgba(255,255,255,0.10) */
--br-strong    /* rgba(255,255,255,0.18) */
--br-brand     /* rgba(200,169,110,0.35) */
--br-accent    /* rgba(61,107,80,0.35) */
--br-ai        /* rgba(46,176,158,0.35) */
--br-focus     /* #C8A96E — focus rings */
```

---

### Grid System

| Breakpoint | Columns | Gutter | Margin |
|-----------|---------|--------|--------|
| xs (375px+) | 4 | 16px | 20px |
| sm (640px+) | 4 | 20px | 24px |
| md (768px+) | 8 | 24px | 32px |
| lg (1024px+) | 12 | 32px | 48px |
| xl (1280px+) | 12 | 32px | 64px |
| 2xl (1440px+) | 12 | 32px | auto (max 1440px) |

**Tailwind grid helpers:**
```html
<div class="grid-hairos-4">   <!-- 4-col -->
<div class="grid-hairos-8">   <!-- 8-col -->
<div class="grid-hairos-12">  <!-- 12-col -->
<div class="grid-insight">    <!-- 1/3 + 2/3 asymmetric -->
<div class="grid-app-shell">  <!-- nav + content layout -->
```

---

### Spacing System

4px base grid. All values in rem.

```
1  = 4px    4  = 16px   8  = 32px   16 = 64px
2  = 8px    5  = 20px   10 = 40px   20 = 80px
3  = 12px   6  = 24px   12 = 48px   24 = 96px
```

**Semantic spacing:**
```ts
space.touchMin     // 44px — minimum touch target
space.touchComfort // 56px — comfortable touch target
space.breatheMD    // 32px — insight breathing room
space.breatheLG    // 48px
space.sectionMobile  // 48px
space.sectionDesktop // 112px
```

---

### Elevation System

| Level | Label | Z-Index | Use |
|-------|-------|---------|-----|
| 0 | Base | 0 | Page background |
| 1 | Surface | 10 | Cards, panels |
| 2 | Raised | 10 | Hovering cards, floating panels |
| 3 | Overlay | 30 | Drawers, side panels |
| 4 | Modal | 40 | Dialogs |
| 5 | Supreme | 80 | Analysis ritual, critical alerts |

```html
<div class="elevation-1">  <!-- card -->
<div class="elevation-3">  <!-- drawer -->
<div class="elevation-4">  <!-- modal -->
```

---

### Shadow System

**Depth shadows** (structural):
```
shadow-xs · shadow-sm · shadow-md · shadow-lg · shadow-xl · shadow-2xl
```

**Glow shadows** (dark UI luminance):
```
shadow-glow-gold-xs/sm/md/lg/xl   — brand CTA elements
shadow-glow-sage-sm/md/lg          — clinical positive states
shadow-glow-ai-sm/md/lg            — AI processing elements
shadow-glow-danger                 — alerts
```

**Compound shadows** (depth + glow):
```
shadow-card          — standard card at rest
shadow-card-hover    — card on hover
shadow-btn-primary   — primary CTA button
shadow-btn-primary-hover
shadow-ritual-orb    — analysis screen orb
shadow-focus-gold    — focus ring
shadow-focus-sage    — secondary focus ring
```

---

### Border System

**Widths:** `border-0 · border · border-2 · border-4 · border-8`

**Semantic colors:**
```html
<div class="border border-[var(--br-subtle)]">
<div class="border border-[var(--br-default)]">
<div class="border border-[var(--br-brand)]">
<div class="border border-[var(--br-ai)]">
```

**Via Tailwind alias:**
```html
<div class="border border-br-subtle">
<div class="border border-br-brand">
```

---

### Radius System

| Token | Value | Use |
|-------|-------|-----|
| `rounded-xs` | 2px | Micro (dot indicators) |
| `rounded-sm` | 4px | Inline elements |
| `rounded` / `rounded-md` | 8px | Small inputs, tags |
| `rounded-lg` | 12px | Standard inputs, compact cards |
| `rounded-xl` | 16px | Cards, standard buttons |
| `rounded-2xl` | 20px | Feature cards |
| `rounded-3xl` | 24px | Modals, sheets |
| `rounded-4xl` | 32px | Large feature panels |
| `rounded-full` | 9999px | Badges, pills, orbs |
| `rounded-organic` | 28px 16px 28px 16px | Hero cards (biological aesthetic) |

**Semantic via CSS var:**
```css
var(--radius-badge)    /* 9999px */
var(--radius-input)    /* 12px */
var(--radius-card)     /* 16px */
var(--radius-card-lg)  /* 20px */
var(--radius-modal)    /* 24px */
var(--radius-sheet)    /* 24px 24px 0 0 */
```

---

### Icon System

Base: **Lucide React** · 24×24 grid · 2px stroke · round caps/joins

**Size scale:**
```ts
iconSize['2xs'] = 12   // micro, dense contexts
iconSize.xs     = 16   // inline with small text
iconSize.sm     = 20   // inline with body text
iconSize.md     = 24   // default (navigation, buttons)
iconSize.lg     = 32   // feature icons
iconSize.xl     = 40   // card decorators
iconSize['2xl'] = 48   // empty states
iconSize['3xl'] = 64   // illustrations
iconSize['4xl'] = 80   // hero icons
```

**Stroke weights:**
```ts
iconStroke.fine    = 1    // decorative, large sizes 40px+
iconStroke.light   = 1.5  // elegant, display contexts
iconStroke.regular = 2    // default 24px
iconStroke.medium  = 2.5  // small sizes, high-density
```

**Usage in components:**
```tsx
import { Camera, Microscope, Activity } from 'lucide-react';

<Camera size={24} strokeWidth={2} className="text-[var(--tx-brand)]" />
<Microscope size={32} strokeWidth={1.5} className="text-[var(--tx-accent)]" />
```

---

## Motion System

### Duration Scale
```
instant: 80ms   fast: 150ms   quick: 200ms   normal: 300ms
smooth: 400ms   slow: 550ms   gentle: 700ms  patient: 1000ms
ritual: 1500ms  ceremony: 2000ms
```

### Easing Curves
```
ease-snap:    cubic-bezier(0.16, 1, 0.3, 1)      — UI elements appearing
ease-elegant: cubic-bezier(0.25, 0.46, 0.45, 0.94) — premium brand moments
ease-organic: cubic-bezier(0.34, 1.56, 0.64, 1)   — biological, spring-like
ease-precise: cubic-bezier(0.12, 0, 0.39, 0)       — data building
```

### Framer Motion Usage

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import {
  fadeUp, staggerNormal, staggerItem,
  insightContainer, insightHeadline, insightMetric,
  bottomSheet, backdrop,
} from '@/design-system/components/framer-variants';

// Standard reveal
<motion.div variants={fadeUp} initial="hidden" animate="visible" exit="exit">

// Staggered list
<motion.ul variants={staggerNormal} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.li key={item.id} variants={staggerItem}>{item.label}</motion.li>
  ))}
</motion.ul>

// Full insight reveal sequence
<motion.div variants={insightContainer} initial="hidden" animate="visible">
  <motion.span variants={insightOverline} />
  <motion.h1   variants={insightHeadline} />
  <motion.p    variants={insightBody} />
  <motion.div  variants={insightDataGrid}>
    {metrics.map(m => <motion.div key={m.key} variants={insightMetric} />)}
  </motion.div>
  <motion.div variants={treatmentReveal} />
  <motion.div variants={ctaReveal} />
</motion.div>

// Bottom sheet
<AnimatePresence>
  {open && (
    <>
      <motion.div variants={backdrop}     initial="hidden" animate="visible" exit="exit" />
      <motion.div variants={bottomSheet}  initial="hidden" animate="visible" exit="exit" />
    </>
  )}
</AnimatePresence>
```

### Reduced Motion

```tsx
import { useReducedMotion } from 'framer-motion';
import { fadeUp, reducedFadeIn } from '@/design-system/components/framer-variants';

function AnimatedCard() {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      variants={prefersReduced ? reducedFadeIn : fadeUp}
      initial="hidden"
      animate="visible"
    />
  );
}
```

---

## Component Token Usage

### Button

```tsx
import { buttonTokens } from '@/design-system/components/tokens';

<button className={`${buttonTokens.base} ${buttonTokens.variant.primary.default} ${buttonTokens.size.lg}`}>
  Begin My Assessment
</button>
```

### Card

```tsx
import { cardTokens } from '@/design-system/components/tokens';

<div className={`${cardTokens.base} ${cardTokens.variant.insight.container}`}>
  <div className={cardTokens.variant.insight.accent} />
  <div className={cardTokens.variant.insight.header}>...</div>
  <div className={cardTokens.variant.insight.body}>...</div>
</div>
```

### Journey Screens

```tsx
import { journeyTokens } from '@/design-system/components/tokens';

// Welcome screen
<div className={journeyTokens.welcome.screen}>
  <div className={journeyTokens.welcome.hero}>
    <h1 className={journeyTokens.welcome.heroTitle}>Every strand tells a story.</h1>
    <p className={journeyTokens.welcome.heroSub}>Let's read yours together.</p>
  </div>
  <div className={journeyTokens.welcome.footer}>
    <button className={journeyTokens.welcome.cta}>Begin Your Assessment</button>
  </div>
</div>
```

---

## Glass Morphism Utilities

```html
<div class="glass">        <!-- standard glassmorphism panel -->
<div class="glass-sm">     <!-- lighter blur -->
<div class="glass-lg">     <!-- heavier blur -->
<div class="glass-gold">   <!-- gold-tinted glass -->
<div class="glass-sage">   <!-- sage-tinted glass -->
<div class="glass-ai">     <!-- biolume-tinted glass (AI panels) -->
```

---

## Gradient Text

```html
<h1 class="type-display-large gradient-text-gold">HairOS</h1>
<span class="type-data-hero gradient-text-biolume">94%</span>
```

---

## Accessibility Checklist

- [ ] All text on dark backgrounds: minimum 4.5:1 contrast ratio
- [ ] All interactive elements: minimum 44×44px touch target (`h-11 min-w-touch`)
- [ ] Focus rings: `focus-visible-gold` or `focus-visible-sage` on all interactive elements
- [ ] Reduced motion: all animations wrapped in `useReducedMotion()` check
- [ ] Color not sole indicator: status always has icon + color + text
- [ ] Screen reader: all icons have `aria-label` or are `aria-hidden`
- [ ] Semantic HTML: use `<button>`, `<a>`, `<nav>`, `<main>` correctly

---

## Principles Compliance

Every design decision traces to the Experience Bible:

| Principle | System Expression |
|-----------|------------------|
| Precision | Mono font for all data; exact px values in token comments |
| Warmth | Gold glow over pure white; Cormorant Garamond for emotional copy |
| Authority | Restrained animation durations; no bouncing or cartoonish easing |
| Clinical Trust | Sage green for success/positive; no green overuse |
| Grief Space | `breatheMD/LG/XL` spacing tokens; `insightHeadline` 1.2s reveal |
| Conversion | `treatmentReveal` delayed behind data; single CTA token |
| Accessibility | Touch targets enforced in `inputTokens.size` and `buttonTokens.size` |
| Biological Intelligence | Biolume palette; organic easing; mesh gradient backgrounds |

---

*HairOS Design System v1.0 — Internal Reference*
