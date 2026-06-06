## Concept A — Clinical Photography

Real macro photography of scalps, hairlines, and follicle conditions. Trichologist-curated library, diverse skin tones and hair origins, shot on neutral seamless backgrounds per Section 9.3 crop rules.

| Criterion | Score | Note |
| :---- | :---- | :---- |
| Patient comprehension | 5 | Highest recognition accuracy — a patient sees themselves in \<4s (Sec 5.1 target). |
| Clinical trust | 4 | Real tissue reads as honest, but raw photography risks "distress" (Sec 5.1) — Norwood-style photos can shame patients. |
| Luxury perception | 2 | Stock-photo energy. Hard to feel like Vision Pro / Oura when looking at someone else's scalp. |
| Production cost | 3 | Moderate — needs a model shoot covering 4+ skin tones × 3 hair origin groups × multiple severities. |
| Scalability | 4 | Easy to extend per clinic, but every new condition \= new shoot. |
| Total | 18/25 |  |

---

## Concept B — Photography \+ Medical Overlay

Base clinical photography with a precision-illustrated diagnostic overlay layer — vector hairline contours, density isolines, severity heatmap, miniaturisation indicators. Overlay can fade in on selection, mirroring the AI Insight Moments aesthetic.

| Criterion | Score | Note |
| :---- | :---- | :---- |
| Patient comprehension | 5 | Photo grounds recognition; overlay teaches *what* the clinician sees. Doubles as education. |
| Clinical trust | 5 | Mirrors how a trichologist actually annotates — peak diagnostic credibility. |
| Luxury perception | 4 | Overlay is the premium signal (Oura/Vision Pro pattern). Still bounded by photo realism underneath. |
| Production cost | 3 | Photography cost \+ a vector overlay system. Overlay is reusable across the library. |
| Scalability | 5 | Overlay is tokenised and parameter-driven — one shoot library, infinite annotated states. Aligns natively with the Section 7 follicle-state and Treatment Protocol overlays. |
| Total | 22/25 |  |

---

## Concept C — Premium 3D Clinical Visualization

Cinematic, anatomically accurate 3D — follicle cross-sections, scalp density maps, pattern surfaces — rendered in the same family as the Section 7 hero follicle, Hair Cycle, and Scalp Topography assets. Recognition cards use stylised 3D scalp models rather than photos.

| Criterion | Score | Note |
| :---- | :---- | :---- |
| Patient comprehension | 3 | 3D models are *interpretations*. Recognition slows beyond the 4s target; patients have to translate stylisation back to their own scalp. |
| Clinical trust | 4 | Reads as advanced science, but a savvy patient may notice it isn't *their* tissue — risks "tech demo" perception in Phase 1 trust-building. |
| Luxury perception | 5 | Highest perceived ceiling — this is the Apple Vision Pro / Tesla configurator register. |
| Production cost | 1 | Most expensive: GLTF pipeline, 4096² renders, Spline/R3F integration, per-state variants, perf budget pressure. |
| Scalability | 2 | Every new condition \= new 3D build \+ QA \+ perf re-test. Slow to extend per clinic. |
| Total | 15/25 |  |

---

## Recommendation — Winner: Concept B (Photography \+ Medical Overlay)

It is the only concept that satisfies all three non-negotiables the spec actually demands simultaneously:

1. Recognition under 4 seconds (Sec 5.1) — only real photography clears this bar reliably; 3D introduces an interpretive step.  
2. Clinical accuracy without distress (Sec 5.1) — the overlay *re-frames* the photo as a diagnostic artefact rather than a "before" picture, removing the shame vector that pure photography carries.  
3. Premium register (Sec 1.2 — Vision Pro, Oura, Tesla) — the annotation layer is exactly the visual grammar those products use to signal intelligence. Photography alone cannot reach that ceiling; 3D overshoots into "marketing render."

It also composes cleanly with the rest of the system: the overlay language extends directly into the AI Insight Moments (Sec 7), the Report Reveal pattern overlay, and the Treatment Protocol before/after comparisons described in the Visual Asset Strategy — so the investment compounds rather than sitting in a silo.  
3D should be retained, but scoped to where it earns its cost: Welcome Experience hero follicle, AI Processing Theatre, Education Layer, Root Cause Explorer — never as the primary recognition surface in the questionnaire.  
\# DR. FACT — NORTH STAR SCREEN V1.0

You are a Principal Product Designer, Senior Clinical UX Architect, Apple-level Interaction Designer, and Staff Frontend Engineer.

Your task is to create the production-ready design specification for the first real Dr. FACT screen that will be built and tested with users.

This is not a concept exploration.

This is the actual implementation blueprint.

\---

\#\# CONTEXT

Dr. FACT is a premium AI Hair Health Diagnostic platform.

Patients complete an AI-powered clinical assessment.

Question 18 is the most important visual question in the system.

Question:

"Which image best describes your hair loss right now?"

The screen must become the visual foundation for the entire platform.

\---

\#\# DECISION ALREADY MADE

The chosen visual strategy is:

\#\#\# Photography \+ Medical Overlay

Do NOT explore alternatives.

Do NOT propose illustrations.

Do NOT propose pure 3D.

Do NOT propose stock photography.

The experience will use:

\* Clinical photography  
\* Diagnostic overlays  
\* Density visualization  
\* AI insight annotations  
\* Premium interaction design

\---

\#\# PRIMARY GOAL

A patient should:

\* Recognize themselves within 1 second  
\* Select confidently within 5 seconds  
\* Learn something clinically useful  
\* Feel the platform is highly intelligent

\---

\# SCREEN LAYOUT

Create a complete specification.

Include:

\#\# Header

Question title

Question description

Clinical guidance copy

Trust reinforcement copy

\---

\#\# Five Grade Cards

Grade 1

Minimal Thinning

Grade 2

Noticeable Thinning

Grade 3

Visible Scalp

Grade 4

Advanced Thinning

Grade 5

Extensive Loss

For each grade provide:

\* clinical characteristics  
\* photography composition  
\* scalp visibility  
\* density level  
\* camera angle  
\* crop specification  
\* lighting  
\* background  
\* annotation overlays  
\* educational labels

\---

\#\# Medical Overlay System

Design the complete overlay language.

Include:

\#\#\# Density contours

\#\#\# Scalp visibility heatmaps

\#\#\# Severity indicators

\#\#\# Confidence chips

\#\#\# Clinical markers

\#\#\# AI insight callouts

The overlay system must feel like:

Apple Health  
\+  
Oura  
\+  
Premium Dermatology Software

Not like:

PowerPoint

Not like:

Hospital diagrams

\---

\#\# Interaction Design

Design:

\#\#\# Hover State

\#\#\# Focus State

\#\#\# Selected State

\#\#\# Deselected State

\#\#\# Mobile Touch State

\#\#\# Keyboard Navigation State

Provide motion specifications.

Durations.

Easing.

Depth behavior.

Opacity behavior.

Scale behavior.

\---

\#\# Mobile Design

375px viewport

Touch-first

Annotation behavior

Responsive grid

Vertical stacking strategy

Performance considerations

\---

\#\# Tablet Design

iPad landscape

iPad portrait

Clinic kiosk usage

\---

\#\# Desktop Design

1440px

Large monitor clinic use

Premium luxury clinic presentation

\---

\#\# Motion Design

Create a complete animation choreography.

Use:

Framer Motion

Specify:

\* initial load  
\* stagger  
\* hover  
\* selection  
\* confirmation  
\* transition to next question

No gimmicks.

No gaming effects.

No flashy AI animations.

\---

\#\# Clinical Intelligence Layer

After selection show:

A short AI insight.

Example:

"Your selected pattern suggests moderate density reduction with visible scalp exposure."

Create similar insights for all five grades.

\---

\#\# Component Architecture

Create React component hierarchy.

Include:

QuestionContainer

GradeCard

PhotoLayer

OverlayLayer

InsightLayer

SelectionState

AccessibilityLayer

MotionLayer

Provide recommended props structure.

\---

\#\# Image Asset Production Specification

For each grade provide:

\* shot list  
\* image dimensions  
\* retina dimensions  
\* mobile crop  
\* tablet crop  
\* desktop crop

\---

\#\# Acceptance Criteria

The screen is successful if:

\* recognition occurs in under 1 second  
\* selection occurs in under 5 seconds  
\* confidence increases  
\* perceived sophistication increases  
\* doctors trust the output

\---

\#\# FINAL DELIVERABLE

Produce an enterprise-grade specification suitable for:

\* Product Designers  
\* Clinical Teams  
\* React Developers  
\* Motion Designers  
\* Figma Designers  
\* Clinic Deployment Teams

This is the canonical implementation blueprint for the first production Dr. FACT visual diagnostic screen.  
Read 3 files

# **DR. FACT — NORTH STAR SCREEN v1.0**

## Question 18 — Pattern Recognition Card

Canonical Implementation Blueprint · Version 1.0 · Production Approved  
*"Which image best describes your hair loss right now?"*  
This document is the single source of truth for the first production Dr. FACT visual diagnostic screen. It binds to HairOS color tokens, elevation tokens, and Framer Motion variants. Any deviation requires a formal version bump.  
---

## 0\. Identity

| Screen ID | Q18-pattern-recognition |
| :---- | :---- |
| Phase | Phase 2 — Visual Discovery |
| Card Type | 03 — Visual Pattern Card |
| Position | Average path: 12/24 · Minimal path: 10/18 · Maximal path: 16/34 |
| Surface | semantic.background.base (\#0A0E1A) — dark-first |
| Elevation | Cards \= Level 2 Raised; Selected \= Level 3 Overlay; Insight \= Level 3 Overlay |
| Decision time SLA | Recognition \< 1.0s · Selection \< 5.0s |

---

## 1\. Header Specification

### 1.1 Anatomy (top-down)

┌────────────────────────────────────────────────┐  
│  ◐ Phase 2 of 4 · Visual Discovery             │  ← Phase chip  
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░  48%                  │  ← Progress rail  
│                                                │  
│  Which image best describes                    │  ← Title (display)  
│  your hair loss right now?                     │  
│                                                │  
│  Choose the photograph that most closely       │  ← Description  
│  matches what you see in your mirror today.    │  
│                                                │  
│  ⊕  Tap any image to enlarge. You can change   │  ← Guidance pill  
│     your answer before continuing.             │  
│                                                │  
│  ⚕  Reviewed by board-certified trichologists  │  ← Trust line  
└────────────────────────────────────────────────┘

### 1.2 Copy Library (locked)

| Slot | Copy | Notes |
| :---- | :---- | :---- |
| Phase chip | Phase 2 of 4 · Visual Discovery | All caps · text.tertiary |
| Title | Which image best describes your hair loss right now? | Serif display · 36/40px desktop · 28/32px mobile |
| Description | *Choose the photograph that most closely matches what you see in your mirror today.* | Sans · 17/26 · text.secondary |
| Guidance | Tap any image to enlarge. You can change your answer before continuing. | Sans · 14/20 · text.tertiary · prefixed by ⊕ glyph |
| Trust | Reviewed by board-certified trichologists. Norwood–Hamilton calibrated. | Sans · 13/18 · text.accent (sage) · prefixed by clinical caduceus |

### 1.3 Typography Tokens

title:       'font-serif text-\[28px\] md:text-\[36px\] leading-\[1.15\] tracking-\[-0.01em\] text-display'  
description: 'font-sans text-\[16px\] md:text-\[17px\] leading-\[1.55\] text-secondary max-w-\[58ch\]'  
guidance:    'font-sans text-\[13px\] md:text-\[14px\] leading-\[1.45\] text-tertiary'  
trust:       'font-sans text-\[13px\] leading-\[1.4\] text-accent'

### 1.4 Header Motion

Header uses staggerSlow (delay 0.20s, stagger 0.15s) with fadeUp children, in this order: phase chip → progress rail → title → description → guidance → trust. Header completes before cards begin staggering.  
---

## 2\. Five Grade Cards — Clinical Specification

The grading axis is Norwood–Hamilton calibrated, Ludwig-cross-referenced, and trichologist-validated. Each grade is a discrete clinical state, not a marketing severity slider.

### 2.1 Grade Index

| Grade | Label | Sublabel | Clinical Anchor |
| :---- | :---- | :---- | :---- |
| G1 | Minimal Thinning | Early density loss | Hamilton I–II · Ludwig 1a |
| G2 | Noticeable Thinning | Reduced coverage at crown or part line | Hamilton II–III · Ludwig 1b–2a |
| G3 | Visible Scalp | Scalp clearly visible through hair | Hamilton III–IV · Ludwig 2b |
| G4 | Advanced Thinning | Distinct bald regions emerging | Hamilton V–VI · Ludwig 3 |
| G5 | Extensive Loss | Permanent dense loss with residual rim | Hamilton VI–VII |

### 2.2 Full Per-Grade Specification

#### G1 — Minimal Thinning

| Attribute | Specification |
| :---- | :---- |
| Clinical characteristics | Subtle reduction in hair shaft density at temples or part. \>85% follicular coverage. No scalp shine. |
| Photo composition | 3/4 top-down view, subject calm-faced, head neutral, eyes off-camera-down. |
| Scalp visibility | \<10% scalp visible through hair canopy. |
| Density level | 240–280 follicles/cm² (dataViz token density.optimal) |
| Camera angle | 35° downward, fixed focal length 85mm equivalent. |
| Crop | Top of head to mid-forehead. Square 1:1 master. |
| Lighting | Soft top key (5500K) \+ warm fill from left (4200K). No specular highlights on scalp. |
| Background | Solid obsidian.800 (\#0D1220) with subtle vignette. |
| Annotation overlay | Single density isoline (contour); dataViz.density.optimal (biolume \#2EB09E). |
| Educational label | *"Density reduction begins at temples — often unnoticed."* |

#### G2 — Noticeable Thinning

| Attribute | Specification |
| :---- | :---- |
| Clinical characteristics | Defined recession at temples OR widened central part. 70–85% coverage. |
| Photo composition | Same anatomical pose as G1. Same model where ethically possible (longitudinal feel). |
| Scalp visibility | 10–20% scalp visible at part line or temples. |
| Density level | 180–240 f/cm² (density.good) |
| Camera angle | Identical to G1 (consistency across set). |
| Crop | Identical bounds. |
| Lighting | Identical. Slight loss of canopy shadow under bright key. |
| Background | Identical obsidian.800. |
| Annotation overlay | 2-band density contour map \+ softened part-line marker. |
| Educational label | *"Part widens. Temple recession defined."* |

#### G3 — Visible Scalp

| Attribute | Specification |
| :---- | :---- |
| Clinical characteristics | Scalp visibly shows through canopy in normal lighting. Frontal third compromised. |
| Photo composition | Same pose; subject expression neutral, not melancholic. |
| Scalp visibility | 20–40% scalp visible. |
| Density level | 120–180 f/cm² (density.moderate) |
| Camera angle | Identical. |
| Crop | Identical. |
| Lighting | Same setup. Specular reflection from scalp is allowed but matted by polarizer. |
| Background | Identical. |
| Annotation overlay | Full heatmap (cold→warm gradient), Norwood marker chip (III), confidence chip (94% match). |
| Educational label | *"Visible scalp through canopy. Frontal coverage reduced."* |

#### G4 — Advanced Thinning

| Attribute | Specification |
| :---- | :---- |
| Clinical characteristics | Distinct bald patches at crown and/or hairline. Residual mid-zone bridge thinning or gone. |
| Photo composition | Same anatomical pose. |
| Scalp visibility | 40–65% scalp visible. |
| Density level | 60–120 f/cm² (density.low) |
| Camera angle | Identical. |
| Crop | Identical. |
| Lighting | Identical. Polarized to control scalp shine. |
| Background | Identical. |
| Annotation overlay | Heatmap \+ bald-region polygon (sage outline, no fill), follicle marker dots, severity chip Advanced. |
| Educational label | *"Distinct bald regions. Mid-zone bridge compromised."* |

#### G5 — Extensive Loss

| Attribute | Specification |
| :---- | :---- |
| Clinical characteristics | Confluent loss across frontal and crown zones. Residual horseshoe rim only. |
| Photo composition | Same pose. Subject's expression must read *dignified* — never defeated. Casting note is binding. |
| Scalp visibility | \>65% scalp visible. |
| Density level | \<60 f/cm² across affected zone (density.critical used only at zone center) |
| Camera angle | Identical. |
| Crop | Identical. |
| Lighting | Identical. Lowered key intensity by 10% to soften reflectance. |
| Background | Identical. |
| Annotation overlay | Zone polygon, residual rim contour in sage, transplantation viability shading (subtle, optional layer). |
| Educational label | *"Confluent loss. Residual rim donor zone preserved."* |

### 2.3 Inclusivity Matrix (binding)

Each grade ships in 5 variants to satisfy Section 9.3 inclusivity:

| Variant | Skin tone (Fitzpatrick) | Hair origin group |
| :---- | :---- | :---- |
| A | II | European straight/wavy |
| B | III–IV | Mediterranean/Middle Eastern |
| C | IV | East Asian |
| D | V | South Asian |
| E | VI | African (Afro-textured) |

Total photographic library: 5 grades × 5 variants \= 25 master images. Engine selects variant by patient self-identification captured in Phase 1\.  
---

## 3\. Medical Overlay System

The overlay language is the platform's signature visual asset. It is what separates Dr. FACT from "before/after" clinics. It must read as Apple Health × Oura × premium dermatology workstation — never PowerPoint, never hospital corridor poster.

### 3.1 Overlay Layer Stack (bottom → top)

Layer 0 ── Photograph (sRGB, calibrated)  
Layer 1 ── Density contour (SVG, gradient stroke, no fill)  
Layer 2 ── Heatmap (canvas, multiply blend, 35% alpha max)  
Layer 3 ── Region polygons (SVG, 1.5px sage stroke)  
Layer 4 ── Follicle markers (dots)  
Layer 5 ── Confidence \+ clinical chips  
Layer 6 ── AI insight callout (only on selection)  
All layers are individually toggleable via \<OverlayLayer visible={...} /\>. Default state shows L1 \+ L5 only; hover progressively reveals L2, L3; selection reveals L4 \+ L6.

### 3.2 Density Contours

* Form: Topographic isolines, not closed shapes. 1.5px stroke.  
* Stroke: linear-gradient(90deg, biolume.400 0%, gold.400 100%) — applied via SVG \<linearGradient\>.  
* Spacing: Generated from a Perlin-displaced field anchored to density value; 3 bands maximum per card.  
* Animation: Pencil-trace draw-in using strokeDasharray over 480ms with ease: \[0.16, 1, 0.3, 1\]. Staggered between bands by 80ms.

### 3.3 Scalp Visibility Heatmap

* Form: Radial-gradient blob, Gaussian blurred 24px.  
* Palette: Token dataViz.heatmap — cold → warm → hot → peak (transparent → gold rgba).  
* Blend mode: multiply over photo.  
* Max coverage: 35% alpha at peak. Never opaque.  
* Trigger: Hover/focus only. Fades in 220ms.

### 3.4 Severity Indicators

A single chip sits top-left of the photo:  
┌────────────┐  
│ ◐ G3       │   ← grade  
│ Norwood III│   ← clinical anchor  
└────────────┘

* Background: background.glass with backdrop-blur(16px).  
* Border: border.brand (rgba 200,169,110, 0.35).  
* Text: text.brand, 11/14, 0.06em tracking, all caps.

### 3.5 Confidence Chips

Bottom-right of photo on hover/selected:  
◇ 94% match

* Background: background.ai (rgba 26,144,131, 0.06).  
* Border: border.biolume.  
* Diamond glyph filled biolume.400. Text text.data.  
* Confidence value derived from real ML similarity score in production; placeholder 94% in design comps.

### 3.6 Clinical Markers

* Follicle dots: 3px circles, dataViz.density.optimal, scattered along contour intersections. Used in G3–G5 only.  
* Bald region polygon: Sage stroke 1.5px, no fill, slight inner shadow for separation. G4–G5 only.  
* Donor zone shading: Subtle linear hatching at 8px spacing, 8% sage alpha. G5 only.

### 3.7 AI Insight Callout

Appears post-selection — see Section 8\.

### 3.8 Forbidden Patterns

* ❌ No arrows.  
* ❌ No labeled call-out lines pointing to specific hairs.  
* ❌ No red. Crimson is reserved for clinical alerts, never severity grading.  
* ❌ No emoji, no "warning triangle" icons.  
* ❌ No drop shadows on overlays themselves (they live on the photo's reality layer).  
* ❌ No skeuomorphic clinical clipboard chrome.

---

## 4\. Interaction Design

### 4.1 State Matrix

| State | Visual | Motion |
| :---- | :---- | :---- |
| Idle | Card at Level 2, L1+L5 visible, photo at 100% saturation | cardVariants.visible |
| Hover | Card lifts \-4px, Level 2→3 shadow, overlay layers L2+L3 fade in, gold rim border glows | cardVariants.hover \+ overlay opacity 0→1 in 220ms |
| Focus | Same as hover \+ 4px outer gold focus ring (shadow.focusGold) | Instant |
| Pressed | Scale 0.98, 80ms | cardVariants.press |
| Selected | Card holds Level 3, photo saturates to 105%, all overlay layers visible, gold inset rim (2px), checkmark badge top-right, insight callout slides in below | See 4.2 |
| Deselected (sibling of selected) | Photo drops to 65% saturation \+ 8% gold tint reduction, overlay opacity drops to 30%, card retains Level 2 | 280ms ease |
| Mobile touch | No hover; first tap \= preview enlarge (peek), second tap \= select. Long-press (350ms) opens detail sheet. | tap 60ms compression |
| Keyboard | Arrow keys traverse grid, Enter selects, Space previews. Visible focus ring shadow.focusGold | Instant |
| Disabled | Not used. All grades remain selectable. | — |

### 4.2 Selection Choreography (1.4s total)

0ms      Tap registered → press scale 0.98  
80ms     Release → spring scale 1.00 (snappy)  
120ms    Overlay layers L2,L3,L4 fade in (240ms each, 60ms stagger)  
360ms    Confidence chip slides up from photo bottom  
480ms    Sibling cards desaturate (280ms)  
560ms    Gold rim draws around selected card (320ms)  
720ms    Insight callout fades in below grid (insightCardVariants)  
1400ms   "Continue" CTA in footer becomes enabled, glowGoldSM pulse once

### 4.3 Motion Tokens (locked)

| Use | Variant | Duration | Easing |
| :---- | :---- | :---- | :---- |
| Page in | screenForward | 700ms | \[0.16, 1, 0.3, 1\] |
| Card stagger | staggerNormal | 0.10 \+ 0.08·n | snap |
| Card hover | cardVariants.hover | 150ms | \[0, 0, 0.2, 1\] |
| Card press | cardVariants.press | 80ms | tween |
| Overlay reveal | custom fade | 220ms | snap |
| Contour draw-in | strokeDasharray | 480ms | \[0.16, 1, 0.3, 1\] |
| Sibling desaturate | filter fade | 280ms | \[0.25, 0.46, 0.45, 0.94\] |
| Insight reveal | insightCardVariants | 700ms | elegant |
| Page out | screenForward.exit | 200ms | \[0.4, 0, 1, 1\] |

All variants imported from `framer-variants.ts` — do not redefine inline.  
---

## 5\. Responsive Layouts

### 5.1 Mobile — 375px

┌─────────────────────────┐  
│  Header (sticky 64px)   │  
│  Title 28/32            │  
│  Description            │  
│  ─────── Cards ───────  │  
│  ┌─────────────┐        │  
│  │  G1         │ swipe→ │  ← horizontal carousel  
│  └─────────────┘        │     snap, 1 card visible  
│  ●○○○○                  │     dot indicator  
│  Continue ▢ (disabled)  │  ← sticky footer  
└─────────────────────────┘

* Grid: Horizontal snap carousel (CSS scroll-snap-type: x mandatory).  
* Card: Full-width minus 32px padding. Photo aspect 4:5.  
* Touch: 44×44 minimum hit area on dots. Card itself is the primary target (full card area).  
* Annotation behavior: Overlay layers L1+L5 always visible (no hover state). Tap card → bottom sheet with L2-L6 fully revealed and educational label.  
* Vertical stacking strategy: Carousel preferred. Stacked grid (5×1 vertical) as fallback for users who pinch-zoom out — detected via viewport scaling.  
* Performance: Eager-load card 1; lazy-load 2–5 via IntersectionObserver; serve AVIF; max 80KB per image at 1x; preconnect to CDN in \<head\>.

### 5.2 Tablet — iPad (1024×768 landscape / 768×1024 portrait)

* Landscape: 5-column grid, all cards visible. Photo aspect 1:1. Cards 180×220 with 20px gutter.  
* Portrait: 2×3 grid (G1, G2 / G3, G4 / G5, empty acknowledgement slot). Photo aspect 4:5.  
* Clinic kiosk: Forced landscape. Bezel-safe insets respected. Touch targets enlarged 8%. Idle screensaver after 90s of inactivity, returns to question intact.

### 5.3 Desktop — 1440px

* Grid: 5 cards in a single row, centered, max content width 1280px.  
* Card: 224×280, 24px gutter. Photo 1:1.  
* Hover states fully active.  
* Premium clinic monitor (≥ 2560px): Cards scale to 280×340. Header type ramps to 44/48px. Vignette intensity increases for theatre feel. Cursor uses custom gold dot.  
* Keyboard navigation visible by default (focus ring shown without first Tab).

### 5.4 Breakpoint Tokens

const bp \= {  
 sm:  '375px',  
 md:  '768px',  
 lg:  '1024px',  
 xl:  '1440px',  
 '2xl':'1920px',  
 '3xl':'2560px',  
} as const;  
---

## 6\. Motion Design — Choreography Score

### 6.1 Sequence on initial load

| t (ms) | Event | Variant |
| :---- | :---- | :---- |
| 0 | Screen mounts, background fades in | screenFade |
| 100 | Phase chip enters | fadeUp |
| 250 | Progress rail fills to 48% | progressVariants (custom=0.48) |
| 400 | Title enters | insightHeadline (lighter — 600ms variant) |
| 700 | Description enters | fadeUp |
| 900 | Guidance \+ trust enter together | staggerItem |
| 1100 | Card grid container appears | staggerNormal |
| 1180 | Card G1 enters (then each card \+80ms) | cardVariants |
| 1500 | Last card (G5) settled | — |
| 1600 | Cards available for interaction | — |

### 6.2 On selection

See Section 4.2 (1.4s sequence).

### 6.3 On confirmation (Continue tap)

0ms     Insight callout collapses (200ms)  
200ms   Selected card scales to 1.04, others fade to 0 in 280ms  
480ms   Selected card flies up \+ dissolves (screenForward.exit)  
700ms   Next question screen enters (screenForward)

### 6.4 Reduced motion

Auto-detected via prefers-reduced-motion. All variants swap to their reduced\* siblings. No staggers; only opacity transitions. Selection still triggers insight callout — never strip clinical feedback.

### 6.5 Forbidden motion

* ❌ Particle bursts on selection.  
* ❌ "Scanning line" sweeping across the photograph.  
* ❌ Pulsing AI rings on idle cards (reserved for Analysis Ritual only).  
* ❌ Confetti, sparkles, fireworks of any kind.  
* ❌ Bouncy springs \> 1.6 stiffness ratio.

---

## 7\. Clinical Intelligence Layer (Insights)

The insight callout is the platform's IQ on display. It appears 720ms after selection. It is a single Level 3 card with border.biolume, gold left bar (3px), and AI glyph.

### 7.1 Per-Grade Insight Copy (locked)

| Grade | Insight |
| :---- | :---- |
| G1 | *"Your selected pattern suggests early-stage density reduction. Coverage remains high, with subtle thinning concentrated at the temples and crown. This is typically the most responsive stage to therapeutic intervention."* |
| G2 | *"Your selected pattern indicates defined recession with widening of the central part. Follicular miniaturisation is likely active. Density preservation strategies show their strongest outcomes when initiated at this stage."* |
| G3 | *"Your selected pattern suggests moderate density reduction with visible scalp exposure through the canopy. The frontal third shows the greatest change. A combined topical and oral protocol is commonly indicated."* |
| G4 | *"Your selected pattern indicates advanced thinning with distinct bald regions. Native follicle preservation remains valuable; restoration options at this stage typically combine medical therapy with surgical planning."* |
| G5 | *"Your selected pattern reflects extensive loss with a preserved donor rim. The remaining horseshoe pattern provides a strong foundation for restoration planning. Specialist consultation is the appropriate next step."* |

### 7.2 Insight Card Anatomy

┃ ◇ DR. FACT INSIGHT                    94% confidence  
┃  
┃ Your selected pattern suggests moderate  
┃ density reduction with visible scalp exposure  
┃ through the canopy. ...  
┃  
┃ ↳ This informs your next 3 questions.

* Bar: 3px biolume.400, full height left.  
* Overline: 11/14, text.biolume, 0.22em tracking, all caps.  
* Body: 16/24 sans, text.secondary.  
* Footer line: 13/18, text.tertiary, italic.  
* Background: background.elevated with backdrop-blur(16px).

### 7.3 Insight Rules

* Never use absolute medical claims ("you have..."). Always "suggests" / "indicates" / "is consistent with".  
* Never quote treatment names in this screen — that lives in the Report Reveal.  
* Always reference what happens next ("informs your next 3 questions") — closes the trust loop and motivates continuation.

---

## 8\. Component Architecture (React \+ TypeScript)

### 8.1 Tree

\<QuestionContainer questionId="Q18"\>  
 ├─ \<AccessibilityLayer ariaLive="polite"\>  
 ├─ \<QuestionHeader phase={2} progress={0.48} /\>  
 ├─ \<MotionLayer variants={staggerNormal}\>  
 │    └─ \<GradeCardGrid\>  
 │         {grades.map(g \=\>  
 │           \<GradeCard key={g.id} grade={g} state={...}\>  
 │             ├─ \<PhotoLayer src={...} variant={skinHairVariant} /\>  
 │             ├─ \<OverlayLayer  
 │             │     density  
 │             │     heatmap={state \=== 'hover' || selected}  
 │             │     polygons={selected}  
 │             │     markers={selected}  
 │             │     confidence /\>  
 │             ├─ \<SelectionState selected={...} /\>  
 │             └─ \<GradeLabel label={g.label} sublabel={g.sublabel} /\>  
 │           \</GradeCard\>  
 │         )}  
 │    \</GradeCardGrid\>  
 ├─ \<AnimatePresence\>  
 │    {selectedGrade && \<InsightLayer grade={selectedGrade} /\>}  
 ├─ \<QuestionFooter onContinue={...} canContinue={\!\!selectedGrade} /\>  
\</QuestionContainer\>

### 8.2 Props Contracts

type GradeId \= 'G1' | 'G2' | 'G3' | 'G4' | 'G5';  
type SkinHairVariant \= 'A' | 'B' | 'C' | 'D' | 'E';

interface Grade {  
 id: GradeId;  
 label: string;             *// "Minimal Thinning"*  
 sublabel: string;          *// "Early density loss"*  
 clinicalAnchor: string;    *// "Hamilton I–II · Ludwig 1a"*  
 density: number;           *// follicles/cm² midpoint*  
 scalpVisibility: \[number, number\]; *// \[min, max\] % range*  
 educationalLabel: string;  
 insight: string;  
 overlayConfig: OverlayConfig;  
}

interface OverlayConfig {  
 contours: ContourBand\[\];   *// 1–3 bands*  
 heatmapIntensity: number;  *// 0–1*  
 hasRegionPolygon: boolean;  
 hasFollicleMarkers: boolean;  
 hasDonorShading: boolean;  
 confidence: number;        *// 0–1*  
 norwoodAnchor: string;     *// "III"*  
}

interface QuestionContainerProps {  
 questionId: 'Q18';  
 patientVariant: SkinHairVariant;  
 onAnswer: (grade: GradeId) \=\> void;  
 initialAnswer?: GradeId;  
}

interface GradeCardProps {  
 grade: Grade;  
 variant: SkinHairVariant;  
 state: 'idle' | 'hover' | 'focus' | 'selected' | 'deselected';  
 onSelect: (id: GradeId) \=\> void;  
 onPreview: (id: GradeId) \=\> void;  
 ariaLabel: string;  
}

interface PhotoLayerProps {  
 src: string;  
 srcSet: { 1: string; 2: string; 3: string };  
 alt: string;  
 saturation?: number;       *// default 1.0*  
 priority?: boolean;        *// true for first card only*  
}

interface OverlayLayerProps {  
 density: boolean;  
 heatmap: boolean;  
 polygons: boolean;  
 markers: boolean;  
 confidence: boolean;  
 config: OverlayConfig;  
 reducedMotion: boolean;  
}

interface InsightLayerProps {  
 grade: Grade;  
 confidence: number;  
 onDismiss?: () \=\> void;  
}

### 8.3 State Management

* selectedGrade lives in QuestionContainer (local useReducer).  
* Telemetry events fire on: card\_hover, card\_preview, card\_select, card\_deselect, insight\_shown, continue\_pressed.  
* Time-to-recognition (TTR) and time-to-selection (TTS) measured via performance.now() from screen mount.

### 8.4 Accessibility Layer

* Each GradeCard rendered as \<button role="radio" aria-checked={selected}\> inside \<div role="radiogroup" aria-labelledby="q18-title"\>.  
* aria-describedby references the grade's educational label.  
* Screen reader announces: "Grade 3, Visible Scalp, Norwood pattern 3\. Scalp clearly visible through hair. Option 3 of 5."  
* Insight callout has role="status" aria-live="polite".  
* Focus order: title → cards (left-to-right) → continue.  
* Min contrast: all text ≥ 4.5:1 against its surface. Verified against background.surface.

---

## 9\. Image Asset Production Specification

### 9.1 Master Asset Specification

| Property | Value |
| :---- | :---- |
| Color space | sRGB IEC61966-2.1 (embedded ICC) |
| Bit depth | 16-bit master, 8-bit delivery |
| Format | AVIF primary, WebP fallback, JPEG legacy |
| Compression | AVIF q=60, WebP q=78, JPEG q=82 mozjpeg |
| Master dimensions | 2400 × 2400 (1:1) and 2400 × 3000 (4:5) |
| Naming | q18\_g{1-5}\_{A-E}\_{ratio}\_{w}.avif (e.g. q18\_g3\_C\_1x1\_896.avif) |

### 9.2 Per-Grade Shot List

Each grade ships 5 variant photos (A–E from §2.3). Per variant:

| Shot | Purpose |
| :---- | :---- |
| 1 | Hero — 3/4 top-down (master) |
| 2 | Backup — same setup, different micro-expression |
| 3 | Reference — straight-on front (used only for clinical QA, not shipped) |

Total shoot deliverables: 5 grades × 5 variants × 3 shots \= 75 master frames, of which 25 ship to production.

### 9.3 Responsive Crops & Sizes

| Breakpoint | Aspect | Width (1x) | Width (2x) | Width (3x) |
| :---- | :---- | :---- | :---- | :---- |
| Mobile carousel (375) | 4:5 | 343 | 686 | 1029 |
| Tablet portrait (768) | 4:5 | 336 | 672 | 1008 |
| Tablet landscape (1024) | 1:1 | 180 | 360 | 540 |
| Desktop (1440) | 1:1 | 224 | 448 | 672 |
| Premium monitor (2560+) | 1:1 | 280 | 560 | 840 |
| Detail-sheet enlarge | 1:1 | 720 | 1440 | 2160 |

### 9.4 Composition Rules (all photographs)

* Subject eyeline never meets camera (avoids confrontation).  
* Crop preserves 10% padding on all edges per Section 9.3 of the questionnaire spec.  
* No text or watermark on the image — overlays are always SVG/HTML siblings.  
* Background obsidian.800 reproduced via studio paper, not post-production replacement.  
* Photographer brief: *"This is not a clinical before-shot. This is a portrait of a person at a moment in their hair journey. Composure first, condition second."*

### 9.5 Validation Pipeline

Each image must pass:

1. Trichologist sign-off (Section 5.1 questionnaire spec).  
2. Variant accessibility audit (Section 9.3 inclusivity rule).  
3. Perf check: file size budget ≤ 80 KB @ 1x, ≤ 220 KB @ 2x.  
4. Overlay registration test — contour mask aligns to scalp within 6px tolerance.  
5. Cultural review by HairOS design lead (Section 11.7 of Visual Asset Strategy).

---

## 10\. Performance Budgets

| Metric | Budget |
| :---- | :---- |
| First Contentful Paint (mobile 4G) | \< 1.2s |
| Largest Contentful Paint (first card) | \< 1.8s |
| Total card grid weight (5× AVIF 1x) | \< 400 KB |
| Time to Interactive | \< 2.0s |
| Cumulative Layout Shift | \< 0.01 |
| Main thread blocking during selection | \< 50ms |
| Overlay SVG total nodes per card | \< 80 |

Strategy: preload hero variant for patient's group A–E in document head; lazy-load others; AVIF first; render overlays only on visible cards via IntersectionObserver.  
---

## 11\. Telemetry & Analytics

Events:  
q18.mounted              { ts, variant, viewport }  
q18.card.hovered         { gradeId, dwellMs }  
q18.card.previewed       { gradeId }  
q18.card.selected        { gradeId, ttsMs }  
q18.card.deselected      { gradeId, fromGradeId }  
q18.insight.shown        { gradeId, confidence }  
q18.continue.pressed     { gradeId, totalDwellMs }  
q18.changed\_mind         { fromGradeId, toGradeId, count }  
Derived KPIs reported nightly:

* Median TTR, TTS per variant.  
* Change-of-mind rate (target \< 12%).  
* Grade distribution skew (clinical sanity check).  
* Drop-off at Q18 (target \< 1.5%).

---

## 12\. Acceptance Criteria

The screen is approved for production when:

| ✓ | Criterion | Measurement |
| :---- | :---- | :---- |
| ☐ | Recognition occurs in under 1.0s | Eye-track median across N=20 patients |
| ☐ | Selection occurs in under 5.0s | TTS p50 across N=100 patients |
| ☐ | Patient confidence rating ≥ 4.4 / 5 | Post-task survey, single Likert |
| ☐ | Perceived sophistication uplift vs baseline ≥ \+30% | SUS-style 5-item battery |
| ☐ | Doctor trust score ≥ 4.5 / 5 | 8-clinician panel review |
| ☐ | All 25 photographs trichologist-signed | Sign-off ledger |
| ☐ | All 5 variants render \< 80 KB @ 1x | Lighthouse CI gate |
| ☐ | WCAG 2.2 AA passes | axe-core \+ manual audit |
| ☐ | Reduced-motion path verified | Manual QA on macOS \+ iOS |
| ☐ | Keyboard-only flow completes Q18 | Manual QA |
| ☐ | Change-of-mind rate \< 12% in pilot | 2-week clinic pilot data |

---

## 13\. Sign-off

| Role | Owner | Signature gate |
| :---- | :---- | :---- |
| Product Design | — | Section 1–7 |
| Clinical (Trichology) | — | Section 2, 7, 9 |
| Frontend Engineering | — | Section 4, 6, 8, 10 |
| Motion Design | — | Section 4.3, 6 |
| Accessibility | — | Section 8.4, 12 |
| Clinic Deployment | — | Section 5.2, 11 |

No production deployment without all six sign-offs and a tagged release of this document.  
