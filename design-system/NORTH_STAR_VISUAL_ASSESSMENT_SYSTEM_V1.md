# Dr. FACT North Star Visual Assessment System V1.0

**Classification:** Production Specification
**Version:** 1.0
**Date:** 2026-06-01
**Status:** Canonical Reference

---

## 1. Executive Summary

### Purpose

The Dr. FACT North Star Visual Assessment System is a canonical visual framework that governs every patient-facing visual experience across the Dr. FACT diagnostic ecosystem. It is not a single screen design — it is the reusable visual language, component architecture, and production specification from which all assessment screens, reports, kiosk experiences, and future HairOS Intelligence products are built.

The system answers one fundamental question: **How do we help a patient accurately identify their hair loss condition in under one second, while feeling medically confident and never judged?**

### Expected Patient Outcomes

- **Sub-second recognition:** Patients identify their grade within 1 second of viewing the card array.
- **Accurate self-selection:** Mis-selection rate drops below 8% (from industry baseline of 25–35%).
- **Emotional safety:** Zero patients report feeling embarrassed or alarmed during assessment.
- **Comprehension:** 95%+ of patients understand the progression model without staff explanation.
- **Confidence:** Patient confidence in their selection exceeds 85% (self-reported).

### Expected Clinic Outcomes

- **Reduced consultation time:** Staff spend 40% less time explaining grading scales.
- **Consistent grading:** Inter-rater agreement between patient self-assessment and clinician assessment exceeds 90%.
- **Premium positioning:** The assessment experience reinforces the clinic's premium brand positioning.
- **Operational scalability:** New assessment questions deploy from the component library in hours, not weeks.

### Expected Diagnostic Benefits

- **Higher data quality:** Accurate self-grading feeds directly into the HairOS Clinical Engine.
- **Longitudinal tracking:** Consistent visual language enables patients to track progression across visits.
- **AI training data:** Standardized visual grading produces cleaner training data for future AI models.
- **Cross-clinic consistency:** Every Dr. FACT clinic presents identical visual standards.

---

## 2. Canonical Visual Language

### Photography Style

**Decision:** Clinical-grade controlled photography with warm, humanistic lighting.

**Specification:**
- Shot on medium-format digital or equivalent (minimum 50MP capture)
- Controlled studio environment with calibrated lighting rigs
- Neutral backgrounds: warm off-white (#F8F6F3) or clinical light grey (#EFECEA)
- Real patient photography (with consent), never stock imagery
- Diverse representation across ethnicity, age (18–75), and hair type
- No visible branding, jewelry, or distracting elements in frame
- Natural skin tones — no beauty retouching, no skin smoothing beyond clinical clarity
- Color-calibrated to Pantone SkinTone Guide

**Why:** Photography establishes trust. Patients need to see real conditions on real people. Medical illustration alone creates distance. Photography bridges the gap between clinical accuracy and human recognition. Controlled conditions ensure diagnostic consistency.

### Medical Illustration Style

**Decision:** Minimalist anatomical line illustration with selective color fills.

**Specification:**
- Clean vector linework: 1.5px stroke, Charcoal (#2C2C2E)
- Anatomical accuracy verified by dermatology consultant
- Selective color fill for affected areas (density gradient system)
- No crosshatching, no heavy shading — modern, clean aesthetic
- Scalp cross-section diagrams use layered depth (epidermis → dermis → follicle)
- Hair follicle illustrations follow standardized proportions across all assets
- Style reference: Apple Health body diagrams, Oura sleep stage illustrations

**Why:** Medical illustrations serve the educational layer. They explain *why* a condition looks the way it does. The minimalist style prevents cognitive overload while maintaining clinical credibility. The clean aesthetic aligns with premium positioning.

### Medical 3D Style

**Decision:** Photorealistic subsurface-scattered 3D for follicle-level education only.

**Specification:**
- Subsurface scattering on skin surfaces for realism
- Follicle models with accurate bulb, shaft, and sebaceous gland anatomy
- Rendered in neutral clinical lighting (5500K equivalent)
- No specular hotspots — matte-satin finish
- Used exclusively in educational overlays, never as primary selection visuals
- Anti-aliased at 2x render resolution, delivered at display resolution
- Style reference: Apple Vision Pro spatial computing interfaces

**Why:** 3D is reserved for deep educational moments — when a patient taps to learn more about what's happening beneath the scalp. Using 3D as the primary selection visual would increase cognitive load and slow recognition time. Its role is to reward curiosity, not to be the first thing seen.

### Annotation Style

**Decision:** Minimal geometric annotations with clinical precision.

**Specification:**
- Annotation lines: 1px, `#A0A0A5` (mid-grey), 45° or 90° angles only
- Leader lines terminate in 4px circles, never arrowheads
- Label backgrounds: frosted glass effect (`backdrop-filter: blur(16px)`, `rgba(255,255,255,0.72)`)
- Label typography: SF Pro Text Medium, 11px, `#1D1D1F`
- Maximum 3 annotations visible simultaneously
- Annotations enter with 200ms fade + 8px upward drift
- No annotation appears until the patient has been viewing the card for ≥1.5 seconds

**Why:** Annotations are the educational layer, not the identification layer. They must never interfere with the sub-second recognition goal. The delayed appearance, minimal count, and frosted-glass treatment ensure they enhance without overwhelming. The geometric precision signals clinical rigor.

### Educational Overlay Style

**Decision:** Progressive disclosure panels with depth-aware layering.

**Specification:**
- Overlays slide up from the bottom third of the card
- Background: `rgba(255,255,255,0.92)` with `backdrop-filter: blur(24px)`
- Content uses a two-column layout on tablet+, single column on mobile
- Left column: annotated visual, Right column: explanatory text
- Text is structured as: Headline → Key Fact → What This Means For You
- Overlays are dismissible via swipe-down, tap-outside, or close button
- Maximum overlay height: 60% of viewport

**Why:** Progressive disclosure respects the patient's attention. The primary task is selection — education is available but never forced. The frosted overlay maintains visual continuity with the card beneath, preventing disorientation. The "What This Means For You" framing centers the patient's experience over clinical detachment.

### Typography Hierarchy

| Level | Font | Weight | Size (Mobile) | Size (Desktop) | Color | Usage |
|-------|------|--------|---------------|-----------------|-------|-------|
| Display | SF Pro Display | Semibold | 28px | 40px | `#1D1D1F` | Screen titles |
| Heading 1 | SF Pro Display | Medium | 22px | 32px | `#1D1D1F` | Section headers |
| Heading 2 | SF Pro Text | Semibold | 17px | 22px | `#1D1D1F` | Card grade labels |
| Body | SF Pro Text | Regular | 15px | 17px | `#3A3A3C` | Descriptions |
| Caption | SF Pro Text | Regular | 13px | 15px | `#8E8E93` | Annotations, metadata |
| Label | SF Pro Text | Medium | 11px | 13px | `#636366` | Tags, indicators |
| Overline | SF Pro Text | Semibold | 10px | 11px | `#A0A0A5` | Category labels |

**Fallback stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

**Why:** SF Pro is the native system font on Apple devices (the primary clinic hardware). It provides optical sizing, variable weight support, and proven medical/health context credibility (Apple Health, Apple Watch vitals). The hierarchy ensures clear information architecture — patients always know what's a title, what's a label, and what's educational content.

### Color Hierarchy

**Primary Palette:**

| Token | Value | Usage |
|-------|-------|-------|
| `--fact-surface` | `#FFFFFF` | Card backgrounds, primary surfaces |
| `--fact-surface-secondary` | `#F8F6F3` | Page backgrounds, recessed areas |
| `--fact-surface-tertiary` | `#EFECEA` | Dividers, subtle backgrounds |
| `--fact-text-primary` | `#1D1D1F` | Headlines, primary text |
| `--fact-text-secondary` | `#3A3A3C` | Body text, descriptions |
| `--fact-text-tertiary` | `#8E8E93` | Captions, metadata |
| `--fact-accent` | `#0A7AFF` | Interactive elements, focus rings |
| `--fact-accent-hover` | `#0062CC` | Hover states |
| `--fact-selected` | `#E8F4FD` | Selected card background |
| `--fact-selected-border` | `#0A7AFF` | Selected card border |

**Why:** The neutral warm palette (note the warm undertone in `#F8F6F3` vs. cold clinical white) creates a premium wellness atmosphere. The single accent color (`#0A7AFF`) is Apple's system blue — universally understood as "interactive" and "selected." This eliminates the need to teach patients a new color language.

### Depth System

| Level | `box-shadow` | Usage |
|-------|-------------|-------|
| Level 0 | None | Flat elements, backgrounds |
| Level 1 | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)` | Cards at rest |
| Level 2 | `0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)` | Cards on hover |
| Level 3 | `0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)` | Selected cards, modals |
| Level 4 | `0 16px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)` | Expanded educational overlays |

**Why:** Subtle depth hierarchy guides attention without creating visual noise. The shadow values are intentionally restrained — this is a clinical tool, not a material design showcase. Depth communicates state (rest → hover → selected → expanded) without relying on color changes alone, which supports color-blind users.

### Shadow System

All shadows use `rgba(0,0,0,x)` with warm undertone compensation on `--fact-surface-secondary` backgrounds. No colored shadows. No inset shadows except for pressed states on interactive elements (`inset 0 1px 2px rgba(0,0,0,0.06)`).

**Why:** Colored shadows read as decorative. Black-alpha shadows read as physical depth. In a clinical context, physical depth (card lifting toward you) is the correct metaphor — it says "this element is interactive" without adding visual complexity.

### Motion Philosophy

**Principle:** Motion serves comprehension, never decoration.

**Core tenets:**
1. **Purposeful:** Every animation communicates a state change or spatial relationship.
2. **Responsive:** Animations respond to user input within 16ms (one frame at 60fps).
3. **Restrained:** No element animates for longer than 500ms. Most complete within 300ms.
4. **Interruptible:** Every animation can be interrupted by user input and redirected.
5. **Reducible:** Every animation has a `prefers-reduced-motion` alternative (opacity crossfade ≤150ms or instant).

**Reference:** Apple Human Interface Guidelines — Motion, Apple Vision Pro spatial interaction model.

**Why:** In medical contexts, gratuitous animation erodes trust. Patients interpret excessive motion as "trying too hard" — the opposite of clinical confidence. Motion should feel like a natural physical response, not a performance.

### Interaction Philosophy

**Principle:** The interface disappears. The patient sees only their condition and their choices.

**Core tenets:**
1. **Direct manipulation:** Patients interact with visual representations of their condition, not with UI controls.
2. **Forgiveness:** Every action is reversible. Selection is never final until explicit confirmation.
3. **Progressive disclosure:** Information appears in response to curiosity, never unprompted.
4. **Clarity over cleverness:** A clear, familiar interaction pattern always beats a novel one.
5. **Accessibility-first:** If an interaction doesn't work with a keyboard, it doesn't ship.

**Why:** Patients in a diagnostic context are already cognitively loaded — they're thinking about their condition, their appearance, their treatment options. The interface must reduce cognitive load, not add to it. This means using patterns patients already know (tap to select, swipe to dismiss, pinch to zoom) and never requiring them to learn something new.

---

## 3. Art Direction

### Visual Mood

**Calm clinical confidence.**

The visual system communicates: "You are in the hands of experts. This is precise, thoughtful, and designed for you."

It does NOT communicate: "This is fun," "This is high-tech," "This is urgent," or "This is a test."

### Visual Tone

**Warm neutrality with clinical precision.**

- Backgrounds are warm (cream, warm grey) — never cold clinical white
- Typography is precise and well-spaced — never cramped or busy
- Imagery is honest and direct — never dramatized or beautified
- Interactive elements are confident and clear — never tentative or over-styled

### Emotional Tone

**Supportive expertise.**

The system speaks with the voice of a trusted specialist who:
- Explains without condescending
- Shows without shocking
- Guides without pressuring
- Reassures without minimizing

### Luxury Cues

- **White space:** Generous padding (minimum 24px between elements on mobile, 32px on desktop)
- **Typography:** Large, well-kerned type with intentional hierarchy
- **Materials:** Frosted glass effects, subtle gradients, refined shadows
- **Photography:** High-production-value imagery with controlled lighting
- **Transitions:** Smooth, physics-based animations (spring damping, not linear easing)
- **Details:** Rounded corners (16px cards, 12px buttons, 8px inputs), consistent radii

### Clinical Cues

- **Precision:** Exact grade numbering with clinical terminology
- **Consistency:** Identical visual treatment across all grades
- **Measurement:** Quantitative indicators (density percentage, affected area)
- **Annotation:** Medical illustration overlays with anatomical accuracy
- **Validation:** "Verified by dermatology specialists" badge

### Educational Cues

- **Progression:** Visual scale showing Grade 1 → Grade 5 as a continuum
- **Comparison:** Side-by-side views for adjacent grades
- **Explanation:** "What this means" panels with plain-language descriptions
- **Context:** "You are here" indicators on the progression scale

### Trust-Building Cues

- **Transparency:** "How we use your assessment" disclosure
- **Authority:** Clinical validation badges, dermatologist endorsement
- **Privacy:** "Your responses are confidential" assurance
- **Reversibility:** "You can change your answer anytime" messaging
- **Progress:** Clear indication of where the patient is in the assessment flow

### First 3 Seconds

When the patient sees the assessment screen, they should feel:

**Second 1:** "This looks professional and trustworthy."
**Second 2:** "I can see the different grades clearly."
**Second 3:** "That one looks like me."

The design must achieve all three within this window. Any design that delays recognition past 3 seconds fails the primary objective.

---

## 4. Asset Architecture

### Overview Screen

**Layout:** Full-viewport container with centered content.

**Structure:**
```
┌──────────────────────────────────────────────┐
│                                              │
│  Question Counter (1 of 18)                  │
│                                              │
│  "Which image best describes                 │
│   your hair loss right now?"                 │
│                                              │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │  1  │ │  2  │ │  3  │ │  4  │ │  5  │  │
│  │     │ │     │ │     │ │     │ │     │  │
│  │     │ │     │ │     │ │     │ │     │  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
│                                              │
│  Progression Scale ●───●───●───●───●        │
│                                              │
│  [Continue]                                  │
│                                              │
│  "You can change this later"                 │
│                                              │
└──────────────────────────────────────────────┘
```

**Mobile Layout:** Cards stack vertically in a scrollable list, 2 cards visible at a time. Horizontal scroll option with snap points.

**Desktop Layout:** 5 cards in a single horizontal row with equal spacing.

**Tablet Layout:** 5 cards in a single row (landscape) or 2-3 visible with horizontal scroll (portrait).

### Grade Card — Anatomy

Each grade card follows an identical structural template:

```
┌────────────────────────────┐
│                            │
│   [Grade Badge]            │
│                            │
│   ┌──────────────────┐     │
│   │                  │     │
│   │  Primary Image   │     │
│   │  (Clinical Photo)│     │
│   │                  │     │
│   └──────────────────┘     │
│                            │
│   Grade Title              │
│   Brief Description        │
│                            │
│   [Density Indicator]      │
│                            │
│   "Learn more" link        │
│                            │
└────────────────────────────┘
```

### Grade 1 Card — Minimal Thinning

- **Badge:** "Grade 1" — `#34C759` (green) background pill
- **Image:** Top-of-head view showing full coverage with subtle density reduction at part line
- **Title:** "Minimal Thinning"
- **Description:** "Slight reduction in hair density, usually only noticeable to you."
- **Density Indicator:** ████████░░ (80-90%)
- **Emotional framing:** Reassuring — "Many patients at this stage see excellent results with early intervention."

### Grade 2 Card — Noticeable Thinning

- **Badge:** "Grade 2" — `#FFD60A` (amber) background pill
- **Image:** Top-of-head view showing widened part line, visible scalp through hair
- **Title:** "Noticeable Thinning"
- **Description:** "Hair density visibly reduced. Others may notice thinning in certain lighting."
- **Density Indicator:** ██████░░░░ (60-70%)
- **Emotional framing:** Normalizing — "This is a common stage. Many treatment options are available."

### Grade 3 Card — Significant Loss

- **Badge:** "Grade 3" — `#FF9F0A` (orange) background pill
- **Image:** Top-of-head view showing clearly visible scalp, sparse coverage in affected area
- **Title:** "Significant Loss"
- **Description:** "Scalp clearly visible through remaining hair. Coverage noticeably reduced."
- **Density Indicator:** ████░░░░░░ (40-50%)
- **Emotional framing:** Supportive — "Effective treatment plans exist for this stage."

### Grade 4 Card — Extensive Loss

- **Badge:** "Grade 4" — `#FF6B35` (deep orange) background pill
- **Image:** Top-of-head view showing majority scalp visibility, remaining hair at periphery
- **Title:** "Extensive Loss"
- **Description:** "Significant areas of visible scalp. Hair primarily remains at the sides and back."
- **Density Indicator:** ██░░░░░░░░ (20-30%)
- **Emotional framing:** Empathetic — "Our specialists have experience with comprehensive treatment at every stage."

### Grade 5 Card — Advanced Loss

- **Badge:** "Grade 5" — `#FF453A` (red) background pill
- **Image:** Top-of-head view showing minimal remaining coverage
- **Title:** "Advanced Loss"
- **Description:** "Minimal hair coverage remaining in the affected area."
- **Density Indicator:** █░░░░░░░░░ (10-15%)
- **Emotional framing:** Dignified — "Multiple treatment approaches are available. Your specialist will discuss all options."

### Severity Color Rationale

The Grade 1–5 color progression (green → amber → orange → deep orange → red) uses universally understood severity encoding. These colors appear ONLY on the grade badge pill — never as card backgrounds, borders, or dominant visual elements. This prevents the experience from feeling like a "warning system" while still providing instant severity comprehension.

**Accessibility note:** Each badge also includes the grade number, ensuring the information is not conveyed by color alone (WCAG 1.4.1).

### Selected State

- Card elevates to Depth Level 3
- Blue border appears: `2px solid #0A7AFF`
- Background shifts to `#E8F4FD`
- Checkmark icon (20px, `#0A7AFF`) appears in top-right corner
- Card scales to `1.02` (desktop) / `1.0` (mobile — no scale to prevent layout shift)
- Adjacent cards subtly dim: `opacity: 0.85`
- Transition: 250ms spring (stiffness: 300, damping: 25)

### Hover State (Desktop Only)

- Card elevates to Depth Level 2
- Subtle upward translation: `translateY(-2px)`
- Cursor changes to `pointer`
- Transition: 200ms ease-out
- Description text opacity increases from 0.8 to 1.0

### Focused State (Keyboard Navigation)

- Blue focus ring: `0 0 0 3px #0A7AFF, 0 0 0 6px rgba(10,122,255,0.25)`
- No other visual changes (focus is additive to current state)
- Focus ring appears on `:focus-visible` only, not on click

### Expanded Educational State

- Triggered by "Learn more" tap or long-press on card
- Card expands to full viewport width (mobile) or 2x width (desktop)
- Adjacent cards collapse with staggered exit animation
- Educational content reveals: annotated image, clinical illustration, "What this means" panel
- Dismiss via: swipe-down (mobile), click outside (desktop), Escape key, close button
- Transition: 400ms spring (stiffness: 200, damping: 22)

### Comparison State

- Triggered by patient uncertainty or explicit "Compare" action
- Two adjacent grade cards display side-by-side at expanded size
- Differences are highlighted with annotation overlays
- "Key difference" callout appears between the two cards
- Swipe left/right to compare different pairs
- Available via keyboard: arrow keys navigate between comparison pairs

### Results State

- After selection and confirmation
- Selected card centers on screen, other cards collapse
- Confirmation message: "You selected Grade [X] — [Title]"
- "This helps your specialist prepare the most relevant treatment discussion."
- "Change my answer" link below
- "Continue" button to proceed to next question
- Transition: selected card animates to center with 300ms spring

---

## 5. Visual Composition

### Universal Composition Rules

All grade images follow identical composition rules to ensure visual consistency and enable instant comparison.

**Subject:** Crown/vertex area of the head, photographed from above (bird's-eye view).

**Frame:** Square aspect ratio (1:1) for card thumbnails, 4:3 for expanded educational views.

**Orientation:** Subject's face pointed toward bottom of frame (away from viewer), parting direction consistent across all grades.

### Grade 1 — Minimal Thinning

- **Composition:** Centered frame with full scalp coverage visible
- **Subject placement:** Crown centered, showing part line and 2cm surrounding area
- **Cropping:** Tight crop showing a 10cm × 10cm area of the crown
- **Safe zones:** 8% inset from all edges — no hair or skin touches the frame edge
- **Negative space:** Minimal — hair fills the frame, communicating "mostly full"
- **Text placement:** Grade badge at top-left corner, outside the image area
- **Overlay placement:** Density indicator overlays only in expanded state, positioned bottom-right
- **Annotation placement:** Part-line annotation appears on hover/expanded, centered horizontally

### Grade 2 — Noticeable Thinning

- **Composition:** Centered frame, part line widening visible
- **Subject placement:** Crown centered, showing widened part and thinning zone
- **Cropping:** Same 10cm × 10cm area — consistency with Grade 1 enables comparison
- **Safe zones:** 8% inset
- **Negative space:** Slightly more visible scalp creates visual "lightness" vs. Grade 1
- **Text placement:** Identical to Grade 1 — consistency is paramount
- **Overlay placement:** Identical positioning
- **Annotation placement:** Widened part-line annotation, density change annotation

### Grade 3 — Significant Loss

- **Composition:** Centered, scalp clearly visible through thinning hair
- **Subject placement:** Crown centered, showing the full affected area
- **Cropping:** Same 10cm × 10cm — the consistency makes severity differences immediately apparent
- **Safe zones:** 8% inset
- **Negative space:** Visible scalp areas create natural negative space within the image
- **Text placement:** Identical positioning
- **Overlay placement:** Affected area boundary overlay available in expanded state
- **Annotation placement:** Scalp visibility annotation, hair density annotation

### Grade 4 — Extensive Loss

- **Composition:** Centered, majority scalp visible
- **Subject placement:** Crown centered, showing extensive loss pattern
- **Cropping:** Same 10cm × 10cm
- **Safe zones:** 8% inset
- **Negative space:** Scalp becomes the dominant visual element
- **Text placement:** Identical
- **Overlay placement:** Remaining coverage boundary overlay
- **Annotation placement:** Coverage area annotation, pattern boundary annotation

### Grade 5 — Advanced Loss

- **Composition:** Centered, minimal hair remaining
- **Subject placement:** Crown centered
- **Cropping:** Same 10cm × 10cm
- **Safe zones:** 8% inset
- **Negative space:** Scalp is primary, remaining hair is secondary
- **Text placement:** Identical
- **Overlay placement:** Minimal remaining coverage overlay
- **Annotation placement:** Remaining follicle activity annotation (educational only)

---

## 6. Camera Language

### Camera Angle

**Primary:** Bird's-eye (directly overhead), perpendicular to the crown plane.
**Tolerance:** ±5° from perpendicular — any deviation creates perspective distortion that undermines comparison.
**Secondary (educational only):** 45° three-quarter view for scalp cross-section context.

**Why:** The bird's-eye view is how patients examine their own hair loss (looking down in a mirror, using a phone camera overhead). Using the same angle the patient uses for self-examination maximizes recognition speed.

### Lens Style

**Primary:** 85mm equivalent (moderate telephoto) for clinical detail without perspective distortion.
**Macro (educational):** 1:1 macro for follicle-level educational overlays.

**Why:** 85mm is the portrait/clinical standard — it compresses perspective naturally, shows detail without distortion, and produces a natural-looking depth of field. Wide-angle lenses distort scalp curvature. Telephoto beyond 100mm flattens texture unnaturally.

### Field of View

**Primary card:** 10cm × 10cm physical area of the crown, filling the frame.
**Expanded view:** 15cm × 15cm, providing surrounding context.
**Macro educational:** 2cm × 2cm, showing individual follicle detail.

### Depth of Field

**Primary card:** f/8 equivalent — sharp across the entire visible scalp area. No bokeh, no selective focus.
**Macro educational:** f/4 equivalent — sharp plane at follicle level, subtle blur at depth extremes.

**Why:** In the primary selection view, every part of the image must be sharp. Selective focus could obscure the very detail a patient needs to identify their condition. Depth of field is reserved for the educational macro view, where it serves to isolate the follicle being examined.

### Macro Requirements

- Minimum 1:1 reproduction ratio for follicle educational content
- Focus stacking required for macro: minimum 5 exposures composited
- Color calibration chip in every macro capture session
- Follicle diameter reference markers visible in raw capture (cropped in production)

### Scalp Visibility Requirements

| Grade | Minimum Scalp Visibility | Maximum Scalp Visibility |
|-------|--------------------------|--------------------------|
| 1     | 5%                       | 15%                      |
| 2     | 20%                      | 35%                      |
| 3     | 40%                      | 55%                      |
| 4     | 60%                      | 80%                      |
| 5     | 80%                      | 95%                      |

These ranges ensure clear visual differentiation between adjacent grades. Any photograph where scalp visibility falls outside these ranges is rejected.

### Consistency Rules

1. Same camera, lens, and settings across all grades within a set
2. Same lighting rig position across all grades
3. Same white balance (5500K ±100K) across all grades
4. Same subject positioning (crown centered, face direction consistent)
5. Same post-processing pipeline (calibration → crop → tone → export)
6. Grade sets are photographed in a single session whenever possible
7. If multi-session, a calibration target is photographed at the start of each session

---

## 7. Lighting System

### Primary Lighting

**Type:** Large softbox, positioned directly overhead (matching the camera position).
**Size:** Minimum 120cm × 120cm to create wraparound illumination.
**Power:** Adjusted per capture to maintain consistent exposure across skin tones.
**Character:** Extremely soft, near-shadowless on the scalp surface.

**Why:** Overhead soft light mimics the best-case bathroom lighting scenario — bright, even, revealing. It shows hair density accurately without creating harsh shadows that could either hide or exaggerate loss.

### Secondary Lighting

**Type:** Two side-fill panels at 30° from horizontal, positioned at 10 o'clock and 2 o'clock relative to subject.
**Power:** 1/3 the intensity of primary light.
**Purpose:** Fill any remaining shadows from scalp curvature without creating competing highlights.

### Hair Texture Lighting

**Type:** Low-angle rim light from behind the subject, 15° above the scalp plane.
**Power:** 1/4 the intensity of primary light.
**Purpose:** Creates subtle edge definition on individual hair strands, making hair count and density visually apparent.

**Why:** Without rim lighting, thin hair blends into the scalp, making Grade 2 and Grade 3 harder to distinguish. The rim light makes each strand visible while remaining subtle enough to avoid a "dramatic" look.

### Scalp Visibility Lighting

The lighting system must reveal scalp skin without making it look raw or clinical.

- Scalp skin should appear healthy — warm, natural skin tone
- No specular highlights on the scalp (indicates oily appearance — distracting)
- Scalp visibility is achieved through density, not through harsh lighting

### Reflection Control

- Cross-polarization filters on both the lens and light source to eliminate specular reflections on hair
- Matte finishing powder available for subjects with oily scalps (used sparingly, blotted)
- No visible reflections of the lighting rig or environment in the scalp

### Color Temperature

**Standard:** 5500K (daylight balanced) for all captures.
**Post-processing:** Warm shift of +150K to final delivery (5650K perceived) for the warm-clinical aesthetic.
**Clinic kiosk:** No warm shift — true 5500K for clinical accuracy.

**Why:** Daylight-balanced capture ensures clinical accuracy. The subtle warm shift in patient-facing contexts (mobile, tablet) creates the premium wellness feeling without sacrificing diagnostic utility. Kiosk mode maintains strict accuracy for clinician-assisted viewing.

### Contrast Ratios

- **Hair-to-scalp contrast:** Minimum 2:1 luminance ratio for all grades
- **Image-to-card contrast:** Card backgrounds are 10–15% brighter than the lightest image value, creating natural separation
- **Text-to-background contrast:** Minimum 4.5:1 (WCAG AA), target 7:1 (WCAG AAA)

---

## 8. Color Treatment

### Clinical Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--clinical-surface` | `#FFFFFF` | Clinical card backgrounds |
| `--clinical-text` | `#1D1D1F` | Clinical text, grade labels |
| `--clinical-border` | `#E5E5EA` | Card borders, dividers |
| `--clinical-annotation` | `#636366` | Annotation lines, measurement text |
| `--clinical-verified` | `#30B0C7` | "Clinically verified" badges |

### Severity Colors

| Token | Value | Grade | Accessible on White | Accessible on `#1D1D1F` |
|-------|-------|-------|---------------------|--------------------------|
| `--severity-1` | `#34C759` | 1 — Minimal | Yes (3.1:1 large text) | Yes (5.2:1) |
| `--severity-2` | `#FFD60A` | 2 — Noticeable | No (use dark text) | Yes (11.2:1) |
| `--severity-3` | `#FF9F0A` | 3 — Significant | No (use dark text) | Yes (7.1:1) |
| `--severity-4` | `#FF6B35` | 4 — Extensive | No (use dark text) | Yes (5.4:1) |
| `--severity-5` | `#FF453A` | 5 — Advanced | Yes (3.2:1 large text) | Yes (4.7:1) |

**Usage constraint:** Severity colors appear ONLY on badge pills (with dark text on amber/orange badges). They never fill card backgrounds, borders, or large areas. The grade number and label always accompany the color to satisfy WCAG 1.4.1 (not by color alone).

### Educational Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--edu-highlight` | `#E8F4FD` | Highlighted educational areas |
| `--edu-annotation` | `#0A7AFF` | Educational annotation lines |
| `--edu-callout-bg` | `rgba(10,122,255,0.08)` | Callout box backgrounds |
| `--edu-follicle` | `#8E6C4A` | Follicle illustration fill |
| `--edu-scalp` | `#F2D9C2` | Scalp illustration fill |

### Interactive Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--interactive-default` | `#0A7AFF` | Buttons, links, active elements |
| `--interactive-hover` | `#0062CC` | Hover state |
| `--interactive-pressed` | `#004999` | Pressed state |
| `--interactive-disabled` | `#C7C7CC` | Disabled state |
| `--interactive-focus` | `rgba(10,122,255,0.25)` | Focus ring outer glow |

### Selected-State Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--selected-bg` | `#E8F4FD` | Selected card background |
| `--selected-border` | `#0A7AFF` | Selected card border |
| `--selected-check` | `#0A7AFF` | Checkmark icon |
| `--selected-text` | `#1D1D1F` | Text remains unchanged |

### Background Treatment

- **Page background:** `--fact-surface-secondary` (`#F8F6F3`) — warm off-white
- **Content area:** `--fact-surface` (`#FFFFFF`) — pure white for maximum image fidelity
- **Cards rest on white surface:** Subtle border (`1px solid #E5E5EA`) differentiates from background
- **No gradients on backgrounds** — gradients compete with clinical imagery

### Dark Mode Treatment

| Light Token | Dark Value | Notes |
|-------------|------------|-------|
| `--fact-surface` | `#1C1C1E` | True dark, not pure black |
| `--fact-surface-secondary` | `#2C2C2E` | Elevated surfaces |
| `--fact-surface-tertiary` | `#3A3A3C` | Dividers |
| `--fact-text-primary` | `#F5F5F7` | High contrast |
| `--fact-text-secondary` | `#AEAEB2` | Body text |
| `--fact-text-tertiary` | `#636366` | Captions |
| `--fact-accent` | `#0A84FF` | Slightly brighter for dark bg |
| `--fact-selected` | `rgba(10,132,255,0.15)` | Selection tint |

**Why:** Dark mode uses Apple's Human Interface Guidelines color system for dark backgrounds. The warm neutral dark (`#1C1C1E`) prevents the clinical coldness of pure black while maintaining sufficient contrast. Image cards get a subtle `1px solid #3A3A3C` border to separate from the dark background.

### Clinic Kiosk Treatment

- Force light mode regardless of system setting — kiosk screens are in well-lit environments
- Increased contrast: text at `#000000` instead of `#1D1D1F`
- Larger touch targets: minimum 56px (vs. 44px standard)
- No frosted glass effects (performance on kiosk hardware)
- Background: pure white `#FFFFFF` for maximum image accuracy under ambient lighting

---

## 9. Image Realism Framework

### Decision: D — Hybrid System

**Primary selection layer:** Clinical photography (real patients, controlled conditions).
**Educational layer:** Medical 3D + Medical illustration.
**Annotation layer:** Minimal geometric overlays.

### Justification

**Why not Photography alone (Option A)?**
Photography alone cannot explain *why* — it shows what the condition looks like but cannot illustrate follicle miniaturization, density distribution patterns, or scalp cross-sections. Without an educational layer, patients select but don't learn.

**Why not Medical Illustration alone (Option B)?**
Illustration creates psychological distance. Patients comparing a stylized drawing to their real head introduces a translation step that slows recognition and reduces accuracy. Illustration works for education, not identification.

**Why not Medical 3D alone (Option C)?**
3D renders of hair loss, no matter how photorealistic, fall into the uncanny valley. They look "almost right" which triggers distrust. 3D is powerful for sub-surface education but fails as a recognition tool.

**Why Hybrid (Option D)?**
The hybrid approach uses each medium where it performs best:
- **Photography** for instant recognition (the patient's primary task)
- **Medical illustration** for anatomical explanation (the educational task)
- **Medical 3D** for sub-surface visualization (the deep-learning task)

### Realism Hierarchy

```
Layer 1 — Recognition (Photography)
├── Patient sees real clinical photography
├── Matches against their own visual experience
├── Sub-second identification
└── Trust: "This is real"

Layer 2 — Understanding (Medical Illustration)
├── Patient taps "Learn more"
├── Sees annotated clinical illustration alongside photo
├── Understands density patterns, affected areas
└── Trust: "This is accurate"

Layer 3 — Deep Learning (Medical 3D)
├── Patient explores further
├── Sees follicle-level 3D visualization
├── Understands miniaturization, growth cycle
└── Trust: "This is science"
```

### Asset Production Pipeline

1. Clinical photography captured per Camera Language spec (Section 6)
2. Medical illustrations traced from photographs, verified by dermatologist
3. 3D models created from anatomical references, rendered per Medical 3D Style spec (Section 2)
4. All assets catalogued in the Asset Library with grade, type, and version metadata
5. Assets are never mixed within a single visual layer — photography is always separate from illustration

---

## 10. Annotation System

### Severity Indicators

**Visual:** Color-coded badge pill (see Section 8, Severity Colors).
**Format:** "Grade [N]" in `SF Pro Text Medium`, 11px, centered in pill.
**Pill dimensions:** 8px vertical padding, 12px horizontal padding, 8px border-radius.
**Placement:** Top-left corner of card, 12px inset from card edge.
**Always accompanied by:** Grade number (never color-only communication).

### Callout Styles

**Standard Callout:**
```
┌─ ● ─────────────────────────────┐
│  Label text in SF Pro Text Med  │
│  11px, #1D1D1F on frosted bg   │
└─────────────────────────────────┘
```
- Leader line: 1px, `#A0A0A5`, connects to annotated area
- Terminates in 4px filled circle
- Background: `backdrop-filter: blur(16px)`, `rgba(255,255,255,0.72)`
- Border: `1px solid rgba(0,0,0,0.06)`
- Border-radius: 8px
- Maximum width: 200px
- Maximum lines: 2

### Labels

| Type | Font | Size | Weight | Color | Background |
|------|------|------|--------|-------|------------|
| Grade label | SF Pro Text | 13px | Semibold | `#1D1D1F` | None |
| Clinical label | SF Pro Text | 11px | Medium | `#636366` | None |
| Measurement | SF Pro Mono | 11px | Regular | `#8E8E93` | None |
| Educational tag | SF Pro Text | 11px | Medium | `#0A7AFF` | `rgba(10,122,255,0.08)` |

### Measurement Indicators

- Used in expanded educational view only
- Thin measurement lines: 1px, `#A0A0A5`
- Dimension text: SF Pro Mono, 10px, `#8E8E93`
- Example: "~3.2cm" indicating width of affected area
- Lines terminate in 3px horizontal serifs (T-bar endpoints)

### Scalp Density Markers

**Visual representation:** Horizontal bar with fill level.

```
Grade 1: ████████░░  ~85%
Grade 2: ██████░░░░  ~65%
Grade 3: ████░░░░░░  ~45%
Grade 4: ██░░░░░░░░  ~25%
Grade 5: █░░░░░░░░░  ~12%
```

- Bar dimensions: 80px × 6px, 3px border-radius
- Fill color: corresponds to severity color for that grade
- Empty color: `#E5E5EA`
- Percentage label: SF Pro Text, 11px, `#8E8E93`, right-aligned

### Educational Tags

- Small pill-shaped tags that appear in expanded educational view
- Background: `rgba(10,122,255,0.08)`, border: `1px solid rgba(10,122,255,0.15)`
- Text: SF Pro Text Medium, 11px, `#0A7AFF`
- Examples: "Miniaturization," "Telogen shift," "Pattern distribution"
- Tappable — reveals a 1-sentence explanation tooltip
- Maximum 3 tags visible per view

### Clinical Insight Tags

- Appear alongside clinical information in educational view
- Icon: Small stethoscope or clinical icon, 14px
- Text: SF Pro Text Regular, 13px, `#3A3A3C`
- Example: "Typically responds well to combination therapy"
- Only one clinical insight tag per grade

### Progression Indicators

**Linear progression bar:**
```
Grade 1 ──●── Grade 2 ──●── Grade 3 ──●── Grade 4 ──●── Grade 5
          ▲
     "You are here"
```

- Track: 2px line, `#E5E5EA`
- Nodes: 8px circles, filled with severity color for completed grades, `#E5E5EA` for others
- Selected node: 12px circle with 2px white ring + severity color fill
- "You are here" label: SF Pro Text Medium, 11px, `#1D1D1F`, centered below selected node
- Appears at the bottom of the overview screen after selection

---

## 11. Educational Overlay System

### When Overlays Appear

1. **Never automatically.** The primary task is selection, not education.
2. **On explicit request:** "Learn more" link tap on a grade card.
3. **On long-press (mobile):** 500ms press on a grade card opens the educational view.
4. **On hover+delay (desktop):** Hovering over "Learn more" for 300ms shows a preview tooltip. Click opens the full overlay.
5. **On comparison request:** When the patient indicates uncertainty between two grades.

### How Overlays Animate

**Entry:**
1. Background dims to `rgba(0,0,0,0.15)` — 200ms ease-out
2. Overlay slides up from bottom — 350ms spring (stiffness: 250, damping: 24)
3. Content fades in — 200ms ease-out, staggered by 50ms per element (image → title → body → tags)

**Exit:**
1. Content fades out — 150ms ease-in
2. Overlay slides down — 250ms ease-in
3. Background dims out — 200ms ease-in

**Reduced motion alternative:**
1. Background crossfade — 150ms
2. Overlay crossfade — 150ms
3. No sliding, no staggering

### Information Hierarchy

```
Level 1 — What You See (Photo + Grade + Description)
    Always visible on the card. No overlay needed.

Level 2 — What It Means (Density %, Typical Characteristics)
    Available via "Learn more" tap. First content shown in overlay.

Level 3 — Why It Happens (Medical Illustration + Explanation)
    Scrollable within the overlay. Second content section.

Level 4 — What Happens Next (Progression Context, Treatment Preview)
    Bottom of overlay. Third content section.
    "Your specialist will discuss specific treatment options."
```

### Patient Comprehension Strategy

- **Plain language first.** Every clinical term is followed by a plain-language equivalent.
  - Example: "Follicular miniaturization (hair follicles gradually producing thinner, shorter hairs)"
- **Visual before text.** The annotated image appears before explanatory paragraphs.
- **Maximum 50 words per section.** If it takes more words, it needs a simpler explanation.
- **"What this means for you" framing.** Every fact is connected to the patient's experience.
- **No alarm language.** Never: "severe," "damage," "irreversible," "too late." Always: stage-appropriate, factual, solution-oriented.

### Progressive Disclosure Rules

1. **First visit:** Only Level 1 (card face) and Level 2 (basic overlay) are available.
2. **Returning patient:** All levels available. Previously viewed content shows a subtle "reviewed" indicator.
3. **Session time > 30 seconds on a card:** A gentle prompt appears: "Would you like to learn more about this grade?"
4. **Comparison mode:** Level 2 content shown side-by-side for both grades being compared.
5. **Post-selection:** Full educational content for the selected grade is available in the results confirmation screen.

---

## 12. Mobile Experience

### 375px Viewport (iPhone SE / iPhone 12 Mini)

- **Card layout:** Vertical stack, full-width cards (375px - 32px padding = 343px card width)
- **Card height:** 280px (image: 200px, text content: 80px)
- **Visible cards:** 1.5 cards visible at a time, encouraging scroll
- **Alternative layout:** Horizontal scroll with snap points (card width: 280px, gap: 12px)
- **Grade badge:** 10px text, 6px/10px padding
- **Question title:** 24px, max 2 lines
- **Scroll indicator:** Subtle fade at bottom edge indicating more content below

### 390px Viewport (iPhone 14 / iPhone 15)

- **Card layout:** Same vertical stack, card width: 358px
- **Card height:** 300px (image: 216px, text content: 84px)
- **Visible cards:** 1.6 cards visible
- **Horizontal scroll option:** Card width: 300px, gap: 12px, 1.2 cards visible

### 430px Viewport (iPhone 14 Plus / iPhone 15 Plus / Pro Max)

- **Card layout:** Vertical stack, card width: 398px
- **Card height:** 320px (image: 230px, text content: 90px)
- **Visible cards:** 1.8 cards visible
- **Horizontal scroll option:** Card width: 320px, gap: 16px, 1.3 cards visible

### Portrait Orientation (All Mobile)

- **Header:** Fixed — question counter + question text (max height: 120px)
- **Cards:** Scrollable area below header
- **CTA:** Fixed bottom bar with "Continue" button (60px height + safe area)
- **Safe areas:** 16px horizontal padding, respecting `env(safe-area-inset-*)` on all sides

### Thumb Reach Considerations

- **Primary interactive zone:** Bottom 60% of screen (grade cards scroll into this zone)
- **"Learn more" links:** Positioned in the bottom half of each card
- **Continue button:** Fixed at bottom, full-width, always in thumb reach
- **Back button:** Top-left (standard iOS position) — reachable with stretch, but used infrequently
- **No critical interactions in top 15%** of the viewport

### Card Sizing Rules

| Viewport | Card Width | Image Height | Text Height | Total Card |
|----------|-----------|--------------|-------------|------------|
| 375px | 343px | 200px | 80px | 280px |
| 390px | 358px | 216px | 84px | 300px |
| 430px | 398px | 230px | 90px | 320px |

### Tap Targets

- **Minimum tap target:** 44px × 44px (Apple HIG)
- **Grade cards:** Full card is tappable (minimum 280px × 343px — well above minimum)
- **"Learn more" link:** 44px hit area (text may be smaller, hit area is not)
- **Continue button:** 48px height, full width minus 32px padding
- **Close/dismiss buttons:** 44px × 44px, with 8px padding around icon
- **Spacing between targets:** Minimum 8px between adjacent tappable elements

### Safe Areas

- **Top:** `max(16px, env(safe-area-inset-top))` — respects notch/Dynamic Island
- **Bottom:** `max(16px, env(safe-area-inset-bottom))` — respects home indicator
- **Left/Right:** `max(16px, env(safe-area-inset-left/right))`
- **Fixed bottom bar:** Padded below content by `env(safe-area-inset-bottom)`

### Performance Considerations

- **Image loading:** Thumbnails load first (50KB AVIF), full-resolution loads on "Learn more"
- **Scroll performance:** Cards use CSS `will-change: transform` only during active scroll
- **Touch response:** Selection state change commits within 100ms of touch end
- **Layout stability:** No CLS — images have explicit `aspect-ratio: 1` containers
- **Memory:** Maximum 5 grade images + 1 expanded educational set loaded simultaneously

---

## 13. Tablet Experience

### 768px (iPad Mini)

- **Card layout:** 5 cards in a single horizontal row
- **Card width:** ~136px each (768px - 48px padding - 32px gaps = 688px / 5)
- **Card height:** 220px (image: 136px square, text: 84px)
- **Portrait alternative:** 2-column grid (2 cards per row, last row centered)
- **Padding:** 24px horizontal

### 834px (iPad 10th Gen / iPad Air)

- **Card layout:** 5 cards in a single horizontal row
- **Card width:** ~148px each
- **Card height:** 240px (image: 148px square, text: 92px)
- **Portrait:** 2-column grid or horizontal scroll with 2.5 cards visible

### 1024px (iPad Pro 11")

- **Card layout:** 5 cards in a single row with generous spacing
- **Card width:** ~176px each (1024px - 64px padding - 48px gaps = 912px / 5)
- **Card height:** 280px (image: 176px square, text: 104px)
- **Portrait and landscape:** Same layout, sufficient space in both orientations

### Landscape vs. Portrait

**Landscape (all tablets):**
- 5 cards visible in a single row — the ideal layout
- Question text above, Continue button below
- Educational overlay uses 60% viewport width, centered

**Portrait (768px–834px):**
- Horizontal scroll with snap points, 2.5 cards visible
- OR 2-column grid with 3 rows (last row centered)
- Educational overlay uses full width, slides up from bottom

**Portrait (1024px):**
- 5 cards in a single row (sufficient width)
- Same layout as landscape

### Tablet-Specific Considerations

- **Stylus support:** Hover states activate on Apple Pencil hover (iPadOS 16.1+)
- **Split View:** Cards reflow to fit split-view widths (minimum supported: 375px)
- **Stage Manager:** Resizable window support — cards use CSS container queries
- **Keyboard shortcuts:** Tab through cards, Enter to select, Escape to deselect/close overlays

---

## 14. Desktop Experience

### 1280px

- **Card layout:** 5 cards in a centered row
- **Card width:** 200px each (1280px - 128px padding - 48px gaps = 1104px → 200px per card with remaining space as gaps)
- **Card height:** 310px (image: 200px, text: 110px)
- **Content max-width:** 1104px, centered
- **Side margins:** 88px minimum

### 1440px

- **Card layout:** 5 cards in a centered row
- **Card width:** 220px each
- **Card height:** 340px (image: 220px, text: 120px)
- **Content max-width:** 1200px, centered
- **Side margins:** 120px minimum

### 1728px

- **Card layout:** 5 cards in a centered row
- **Card width:** 240px each
- **Card height:** 370px (image: 240px, text: 130px)
- **Content max-width:** 1320px, centered
- **Side margins:** 204px minimum

### Large Clinic Kiosk Screens (1920px+)

- **Card layout:** 5 cards in a centered row
- **Card width:** 280px each
- **Card height:** 420px (image: 280px, text: 140px)
- **Content max-width:** 1520px, centered
- **Touch targets:** Increased to 56px minimum (larger fingers, less precision on kiosks)
- **Typography:** Scaled 1.2x from desktop baseline
- **No hover states:** Kiosks are touch-only
- **No frosted glass effects:** Performance constraint on kiosk hardware
- **High contrast mode:** Enforced (pure white backgrounds, darker text)
- **Idle timeout:** After 60 seconds of inactivity, return to welcome screen

### Desktop-Specific Considerations

- **Hover states active:** Cards respond to mouse hover with elevation change
- **Keyboard navigation:** Full tab-order, arrow-key navigation between cards
- **Focus management:** Focus moves to first card on page load, cycles through cards
- **Cursor:** `pointer` on cards, `default` on non-interactive areas
- **Multi-monitor:** Layout respects viewport, not screen (for clinic setups with extended displays)

---

## 15. Accessibility Framework

### Contrast Ratios

| Element | Minimum | Target | Actual |
|---------|---------|--------|--------|
| Body text on white | 4.5:1 (AA) | 7:1 (AAA) | 12.6:1 (`#3A3A3C` on `#FFFFFF`) |
| Heading text on white | 4.5:1 (AA) | 7:1 (AAA) | 16.4:1 (`#1D1D1F` on `#FFFFFF`) |
| Caption text on white | 4.5:1 (AA) | 4.5:1 (AA) | 4.6:1 (`#8E8E93` on `#FFFFFF`) |
| Interactive elements | 3:1 (AA) | 4.5:1 | 4.6:1 (`#0A7AFF` on `#FFFFFF`) |
| Grade badge text | 4.5:1 (AA) | 7:1 (AAA) | Varies — dark text on all badges |
| Card borders | 3:1 (AA) | 3:1 | 3.0:1 (`#E5E5EA` on `#F8F6F3`) |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next interactive element |
| `Shift+Tab` | Move focus to previous interactive element |
| `Arrow Right/Down` | Move to next grade card |
| `Arrow Left/Up` | Move to previous grade card |
| `Enter/Space` | Select/deselect focused card |
| `Escape` | Close overlay, deselect, or go back |
| `L` | Open "Learn more" for focused card |
| `C` | Open comparison mode for focused card + next card |

**Focus order:** Question text → Grade 1 card → Grade 2 → ... → Grade 5 → Continue button → "Change answer" link.

### Screen Reader Behavior

**Card announcement pattern:**
```
"Grade [N] of 5: [Title]. [Description]. [Density]% hair density. 
Press Enter to select. Press L to learn more."
```

**Selected card announcement:**
```
"Selected: Grade [N] of 5: [Title]. Press Enter to deselect. 
Press Tab to continue."
```

**Progression scale announcement:**
```
"Hair loss progression scale. Grade 1, Minimal Thinning, through 
Grade 5, Advanced Loss. Currently selected: Grade [N]."
```

**ARIA roles and properties:**
- Card container: `role="radiogroup"`, `aria-label="Hair loss grade selection"`
- Individual cards: `role="radio"`, `aria-checked="true/false"`, `aria-label="[full announcement]"`
- Educational overlay: `role="dialog"`, `aria-modal="true"`, `aria-label="Learn more about Grade [N]"`
- Density indicator: `role="meter"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow="[N]"`

### Reduced Motion Mode

When `prefers-reduced-motion: reduce` is active:

- All spring animations replaced with 150ms opacity crossfade
- No translate/scale animations
- Card selection: instant background color change, no elevation transition
- Educational overlay: instant appear/disappear (opacity crossfade only)
- Progression scale: no animated transitions between states
- Scroll behavior: `scroll-behavior: auto` (no smooth scrolling)

### Color Blindness Support

| Condition | Accommodation |
|-----------|---------------|
| Protanopia (red-blind) | Grade badges include number + text label, never color-only |
| Deuteranopia (green-blind) | Green (Grade 1) and red (Grade 5) distinguished by position, number, and label |
| Tritanopia (blue-yellow-blind) | Interactive blue elements have underline/border in addition to color |
| Monochromacy | Full functionality without color — all information conveyed through text, position, and pattern |

**Testing requirement:** All screens must pass the Coblis color blindness simulator for all four conditions.

### Cognitive Accessibility Support

- **Simple language:** All patient-facing text at 6th-grade reading level (Flesch-Kincaid)
- **Consistent layout:** Every grade card uses identical structure
- **Clear affordances:** Buttons look like buttons, links look like links
- **Error prevention:** Selection is always reversible — no confirmation dialogs for grade selection
- **Progress indication:** Clear "1 of 18" counter, linear progress bar
- **Timeout:** No time limits on any assessment screen
- **Distraction-free:** No auto-playing animations, no popups, no notifications during assessment

### Large Text Support

- All text scales up to 200% without loss of content or functionality
- Card layouts reflow from horizontal row to vertical stack when text size exceeds 150%
- Images maintain minimum 120px width even at maximum text scale
- Touch targets scale proportionally with text (minimum 44px remains enforced)
- Tested with iOS Dynamic Type at all size settings including the 5 accessibility sizes

---

## 16. Motion Design System

### Micro-Interactions

| Interaction | Duration | Easing | Description |
|------------|----------|--------|-------------|
| Card hover lift | 200ms | `ease-out` | `translateY(-2px)`, shadow to Level 2 |
| Card press | 100ms | `ease-in` | `scale(0.98)`, shadow to Level 1 |
| Card select | 250ms | `spring(300, 25)` | Border, background, checkmark appear |
| Card deselect | 200ms | `ease-out` | Reverse of select |
| Badge appear | 150ms | `ease-out` | Opacity 0→1, scale 0.9→1 |
| Focus ring | 150ms | `ease-out` | Opacity 0→1, no scale |
| Button hover | 150ms | `ease-out` | Background color shift |
| Button press | 80ms | `ease-in` | `scale(0.97)` |
| Tooltip appear | 200ms | `ease-out` | Opacity 0→1, translateY(4px→0) |

### Card Transitions

**Page entry (cards stagger in):**
- Each card: opacity 0→1, translateY(12px→0)
- Duration: 300ms per card
- Stagger: 60ms between cards (Grade 1 first, Grade 5 last)
- Easing: `spring(400, 28)`
- Total animation time: 300ms + (4 × 60ms) = 540ms

**Card selection (other cards dim):**
- Selected card: border + background + checkmark (250ms spring)
- Non-selected cards: `opacity: 1→0.85` (200ms ease-out)
- Staggered from selected card outward (nearest cards dim first)

**Card deselection:**
- All cards: `opacity: 0.85→1` (200ms ease-out, simultaneous)
- Previously selected card: border + background + checkmark reverse (200ms ease-out)

### Selection Animations

1. Touch/click on card
2. **0ms:** Card scales to 0.98 (press feedback)
3. **100ms:** Card scales back to 1.02 (desktop) / 1.0 (mobile)
4. **100ms:** Blue border begins to draw (custom SVG path animation, 200ms)
5. **150ms:** Background transitions to `--selected-bg`
6. **200ms:** Checkmark icon appears (scale 0→1, spring)
7. **250ms:** Adjacent cards begin dimming

### Educational Reveals

**Overlay entry sequence:**
1. **0ms:** Backdrop dims to `rgba(0,0,0,0.15)` — 200ms
2. **100ms:** Overlay container slides up from below viewport — 350ms spring
3. **250ms:** Primary image fades in — 200ms
4. **300ms:** Title text fades in — 150ms
5. **350ms:** Body content fades in — 150ms
6. **400ms:** Tags fade in — 150ms
7. **450ms:** Annotations draw in (if applicable) — 200ms

### Progressive Disclosure

- Content within educational overlays uses scroll-triggered reveals
- Elements fade in when they enter the viewport (150ms, triggered at 80% visibility)
- No reveal animation on scroll-up (content already visible stays visible)
- Interactive elements (tags, "Learn more about...") animate only on first appearance

### Motion Durations

| Category | Range | Standard |
|----------|-------|----------|
| Micro-interaction | 80–200ms | 150ms |
| State change | 150–300ms | 250ms |
| Layout transition | 250–500ms | 350ms |
| Complex reveal | 400–600ms | 500ms (total sequence) |
| Maximum single animation | Never > 500ms | — |
| Maximum total sequence | Never > 800ms | — |

### Easing Curves

| Name | CSS | Framer Motion | Usage |
|------|-----|---------------|-------|
| `ease-out` | `cubic-bezier(0.25, 0, 0.5, 1)` | `[0.25, 0, 0.5, 1]` | Entering elements |
| `ease-in` | `cubic-bezier(0.5, 0, 1, 1)` | `[0.5, 0, 1, 1]` | Exiting elements |
| `ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | `[0.45, 0, 0.55, 1]` | Background transitions |
| `spring-default` | N/A | `{ stiffness: 300, damping: 25 }` | Card selection, general spring |
| `spring-overlay` | N/A | `{ stiffness: 250, damping: 24 }` | Overlay entry |
| `spring-bounce` | N/A | `{ stiffness: 400, damping: 28 }` | Page entry stagger |

### Motion Hierarchy

1. **User-initiated motion** (button press, card tap) — immediate, 80–150ms
2. **State change motion** (selected, hover, focus) — responsive, 150–250ms
3. **Layout motion** (overlay entry, card reflow) — deliberate, 250–400ms
4. **Ambient motion** (none) — zero ambient animation in the assessment context

**Why zero ambient motion:** Medical assessments demand focused attention. Background animations, pulsing elements, or looping effects compete with the patient's cognitive task. The only motion in the system is responsive — it happens because the patient did something.

### Apple Vision Pro Quality Reference

- Spatial depth: Cards lift physically toward the user on hover/select (shadow + translate)
- Material: Frosted glass overlays reference visionOS window materials
- Springs: All physics-based motion uses spring dynamics, never linear easing
- Responsiveness: Sub-frame response to input (animations begin on the next render frame)
- Polish: No animation pops, clips, or janks — spring parameters tuned to prevent overshoot

---

## 17. GSAP Strategy

### Where GSAP Should Be Used

GSAP is reserved for animations that Framer Motion cannot handle performantly or that require timeline-level orchestration:

1. **SVG path animations:** Border draw-in effect on card selection (SVG `strokeDashoffset` animation)
2. **Complex staggered sequences:** Page entry card stagger with spring physics
3. **Scroll-triggered animations:** Educational overlay content reveals tied to scroll position
4. **3D transforms:** Follicle-level educational 3D rotation/zoom (if not handled by Spline)
5. **Cross-element orchestration:** When multiple elements must animate in precise temporal relationship

### Timeline Architecture

```typescript
// Master timeline for page entry
const pageEntryTimeline = gsap.timeline({
  defaults: { ease: 'power2.out', duration: 0.3 }
});

pageEntryTimeline
  .from('.question-title', { opacity: 0, y: 8 })
  .from('.grade-card', { opacity: 0, y: 12, stagger: 0.06 }, '-=0.15')
  .from('.progression-scale', { opacity: 0 }, '-=0.1')
  .from('.continue-button', { opacity: 0, y: 4 }, '-=0.1');

// Selection timeline (per-card, reusable)
function createSelectionTimeline(card: HTMLElement) {
  return gsap.timeline({ paused: true })
    .to(card, { scale: 0.98, duration: 0.1, ease: 'power2.in' })
    .to(card, { scale: 1.02, duration: 0.15, ease: 'back.out(1.5)' })
    .to(card.querySelector('.border-svg'), {
      strokeDashoffset: 0, duration: 0.2, ease: 'power2.out'
    }, '-=0.1');
}
```

### Performance Constraints

- **`will-change`:** Applied only during active animation, removed on completion
- **GPU layers:** Force GPU compositing for animated elements: `transform: translateZ(0)`
- **Batch reads/writes:** All DOM measurements batched before animation start
- **No layout thrashing:** Animations use `transform` and `opacity` exclusively — never `width`, `height`, `top`, `left`, `margin`, or `padding`
- **Memory:** GSAP timelines are killed and garbage-collected on component unmount
- **Maximum active tweens:** 10 simultaneous (beyond this, use timeline staggering)

### Animation Sequencing

| Phase | Duration | Elements |
|-------|----------|----------|
| Page entry | 0–540ms | Title → Cards (staggered) → Scale → CTA |
| Card selection | 0–250ms | Press → Release → Border → Background → Checkmark |
| Overlay entry | 0–600ms | Backdrop → Container → Image → Text → Tags → Annotations |
| Overlay exit | 0–400ms | Content fade → Container slide → Backdrop clear |
| Results transition | 0–500ms | Non-selected collapse → Selected center → Confirmation appear |

### Fallback Behavior

- **GSAP fails to load:** All animations fall back to CSS transitions (defined as `:root` custom properties)
- **`prefers-reduced-motion: reduce`:** GSAP timelines skip to end state (`timeline.progress(1)`)
- **Low-power mode (iOS):** Detect via `navigator.getBattery()` — reduce to CSS-only animations
- **< 30fps detected:** Disable all GSAP animations, use CSS transitions only

---

## 18. Framer Motion Strategy

### Variants

```typescript
const cardVariants = {
  initial: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  hover: { y: -2, boxShadow: 'var(--shadow-level-2)' },
  selected: {
    borderColor: 'var(--fact-selected-border)',
    backgroundColor: 'var(--fact-selected)',
    boxShadow: 'var(--shadow-level-3)',
    scale: 1.02
  },
  dimmed: { opacity: 0.85 },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } }
};

const overlayVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 250, damping: 24 }
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: { duration: 0.25, ease: [0.5, 0, 1, 1] }
  }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } }
};

const contentStaggerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.15 }
  }
};

const contentItemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15 } }
};
```

### Layout Animations

- **`layoutId`:** Each card has a stable `layoutId` (`grade-card-${gradeNumber}`) for shared layout transitions
- **Layout groups:** Cards belong to a `LayoutGroup` to prevent layout animation conflicts
- **Layout transitions:** When a card expands to educational view, its `layoutId` enables smooth morphing
- **Measurement:** `layout="position"` used on cards to animate position changes without scaling content

### Shared Element Transitions

- **Card → Educational overlay:** The card image shares a `layoutId` with the overlay hero image
- **Card → Results view:** Selected card shares `layoutId` with the results confirmation card
- **Progression scale nodes:** Each node shares `layoutId` across views for seamless transitions

### Exit Animations

- **Card exit (page navigation):** Staggered fade-out + upward drift, reverse order (Grade 5 first)
- **Overlay exit:** Slide down + fade, triggered by `AnimatePresence` with `exitBeforeEnter`
- **Results exit:** Selected card scales down to its position in the next question's layout
- **All exits:** Maximum 300ms, never block the next interaction

### Loading States

```typescript
const skeletonVariants = {
  loading: {
    background: [
      'linear-gradient(90deg, #F8F6F3 0%, #EFECEA 50%, #F8F6F3 100%)',
      'linear-gradient(90deg, #EFECEA 0%, #F8F6F3 50%, #EFECEA 100%)'
    ],
    backgroundSize: '200% 100%',
    backgroundPosition: ['100% 0', '-100% 0'],
    transition: { duration: 1.5, repeat: Infinity, ease: 'linear' }
  },
  loaded: { opacity: 1 }
};
```

- Skeleton screens match card dimensions exactly — no layout shift on content load
- Images cross-fade from skeleton to loaded (150ms)
- Content enters with `contentStaggerVariants` after image loads

### Interaction States

```typescript
const interactionConfig = {
  whileHover: 'hover',       // Desktop only (detect via media query)
  whileTap: { scale: 0.98 }, // Universal
  whileFocus: undefined,     // Focus handled via CSS :focus-visible
  transition: {
    type: 'spring',
    stiffness: 300,
    damping: 25
  }
};
```

---

## 19. React Architecture

### Component Hierarchy

```
<AssessmentPage>
  <AssessmentHeader>
    <ProgressIndicator />      // "1 of 18" + progress bar
    <QuestionTitle />          // Question text
  </AssessmentHeader>

  <GradeCardGroup>             // radiogroup container
    <GradeCard grade={1} />
    <GradeCard grade={2} />
    <GradeCard grade={3} />
    <GradeCard grade={4} />
    <GradeCard grade={5} />
  </GradeCardGroup>

  <ProgressionScale />         // Linear grade progression visualization

  <AssessmentFooter>
    <ContinueButton />
    <ChangeAnswerLink />
  </AssessmentFooter>

  <AnimatePresence>
    <EducationalOverlay />     // Conditionally rendered
  </AnimatePresence>

  <AnimatePresence>
    <ComparisonView />         // Conditionally rendered
  </AnimatePresence>
</AssessmentPage>
```

### Props Architecture

```typescript
// Core types
interface GradeOption {
  grade: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  densityPercent: number;
  emotionalFraming: string;
  imageSrc: ResponsiveImageSet;
  educationalContent: EducationalContent;
}

interface ResponsiveImageSet {
  thumbnail: { avif: string; webp: string; jpg: string };
  full: { avif: string; webp: string; jpg: string };
  alt: string;
  width: number;
  height: number;
}

interface EducationalContent {
  headline: string;
  keyFact: string;
  whatThisMeans: string;
  illustration: ResponsiveImageSet;
  model3d?: string; // Spline scene URL
  tags: ClinicalTag[];
  clinicalInsight: string;
}

interface ClinicalTag {
  label: string;
  explanation: string;
}

// Component props
interface AssessmentPageProps {
  question: QuestionConfig;
  grades: GradeOption[];
  currentGrade: number | null;
  onSelect: (grade: number) => void;
  onContinue: () => void;
  questionNumber: number;
  totalQuestions: number;
}

interface GradeCardProps {
  grade: GradeOption;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
  onLearnMore: () => void;
}

interface EducationalOverlayProps {
  grade: GradeOption;
  onDismiss: () => void;
}
```

### State Management

```typescript
// Assessment state — local to the page, no global store needed
interface AssessmentState {
  selectedGrade: number | null;
  expandedGrade: number | null;      // Which card's educational overlay is open
  comparisonGrades: [number, number] | null;
  isConfirmed: boolean;
}

// Managed via useReducer for predictable state transitions
type AssessmentAction =
  | { type: 'SELECT_GRADE'; grade: number }
  | { type: 'DESELECT_GRADE' }
  | { type: 'OPEN_EDUCATIONAL'; grade: number }
  | { type: 'CLOSE_EDUCATIONAL' }
  | { type: 'OPEN_COMPARISON'; grades: [number, number] }
  | { type: 'CLOSE_COMPARISON' }
  | { type: 'CONFIRM_SELECTION' }
  | { type: 'CHANGE_ANSWER' };
```

### Accessibility Architecture

```typescript
// GradeCardGroup implements ARIA radiogroup pattern
function GradeCardGroup({ grades, selectedGrade, onSelect }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Hair loss grade selection"
      aria-required="true"
    >
      {grades.map((grade) => (
        <GradeCard
          key={grade.grade}
          role="radio"
          aria-checked={selectedGrade === grade.grade}
          aria-label={`Grade ${grade.grade} of 5: ${grade.title}. ${grade.description}. ${grade.densityPercent}% hair density.`}
          tabIndex={selectedGrade === grade.grade ? 0 : -1}
          onKeyDown={handleArrowNavigation}
        />
      ))}
    </div>
  );
}

// Focus management via roving tabindex
// Arrow keys move focus between cards
// Enter/Space toggles selection
// Escape closes overlays
```

### Design Token Integration

```typescript
// tokens/index.ts — consumed via Tailwind config and CSS custom properties
export const tokens = {
  color: {
    surface: { DEFAULT: '#FFFFFF', secondary: '#F8F6F3', tertiary: '#EFECEA' },
    text: { primary: '#1D1D1F', secondary: '#3A3A3C', tertiary: '#8E8E93' },
    accent: { DEFAULT: '#0A7AFF', hover: '#0062CC', pressed: '#004999' },
    selected: { bg: '#E8F4FD', border: '#0A7AFF' },
    severity: {
      1: '#34C759', 2: '#FFD60A', 3: '#FF9F0A', 4: '#FF6B35', 5: '#FF453A'
    }
  },
  shadow: {
    level1: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    level2: '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)',
    level3: '0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)',
    level4: '0 16px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)'
  },
  radius: { card: '16px', button: '12px', input: '8px', badge: '8px' },
  spacing: { card: { mobile: '12px', tablet: '16px', desktop: '20px' } },
  motion: {
    spring: { default: { stiffness: 300, damping: 25 } },
    duration: { micro: 150, state: 250, layout: 350, reveal: 500 },
    easing: {
      out: [0.25, 0, 0.5, 1],
      in: [0.5, 0, 1, 1],
      inOut: [0.45, 0, 0.55, 1]
    }
  }
} as const;
```

### Image Delivery Strategy

```typescript
// Responsive image component with AVIF/WebP/JPEG fallback
function ClinicalImage({ src, alt, sizes, priority }: ClinicalImageProps) {
  return (
    <picture>
      <source srcSet={src.avif} type="image/avif" />
      <source srcSet={src.webp} type="image/webp" />
      <img
        src={src.jpg}
        alt={alt}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        width={src.width}
        height={src.height}
        style={{ aspectRatio: `${src.width}/${src.height}` }}
      />
    </picture>
  );
}

// Next.js Image component for automatic optimization
// srcSet generated at: 200w, 400w, 600w, 800w
// Format negotiation handled by Vercel Image Optimization
```

**Image sizes per breakpoint:**

| Breakpoint | Card Image Width | Sizes Attribute |
|-----------|-----------------|-----------------|
| 375px | 343px | `(max-width: 430px) calc(100vw - 32px)` |
| 768px | 136px | `(max-width: 1023px) 136px` |
| 1024px | 176px | `(max-width: 1279px) 176px` |
| 1280px | 200px | `(max-width: 1439px) 200px` |
| 1440px+ | 220px | `220px` |

### Responsive Architecture

```typescript
// Container queries for card-level responsiveness
// Cards adapt to their container, not the viewport
// This supports: split-view on iPad, resizable windows, kiosk embeds

// tailwind.config.ts
module.exports = {
  theme: {
    containers: {
      'card-sm': '200px',
      'card-md': '280px',
      'card-lg': '400px',
    }
  }
};

// Usage in component:
// <div className="@container">
//   <div className="@[200px]:text-sm @[280px]:text-base @[400px]:text-lg">
```

---

## 20. Production Reality Constraints

### Performance Budgets

| Metric | Target | Enforcement |
|--------|--------|-------------|
| First Contentful Paint | < 1.2s | Lighthouse CI gate |
| Largest Contentful Paint | < 2.0s | Lighthouse CI gate |
| First Input Delay | < 50ms | RUM monitoring |
| Cumulative Layout Shift | < 0.05 | Lighthouse CI gate |
| Time to Interactive | < 3.0s | Lighthouse CI gate |
| Total Blocking Time | < 200ms | Lighthouse CI gate |
| 60fps during animations | Required | Manual QA + Performance Monitor |

### Image Budgets

| Asset Type | Mobile Max | Desktop Max | Format Priority |
|-----------|------------|-------------|-----------------|
| Card hero image | 150KB | 300KB | AVIF → WebP → JPEG |
| Card thumbnail | 50KB | 75KB | AVIF → WebP → JPEG |
| Educational full | 200KB | 400KB | AVIF → WebP → JPEG |
| Medical illustration | 30KB | 60KB | SVG (preferred) → AVIF |
| 3D model (Spline) | N/A | N/A | Loaded on demand only |

**Image optimization pipeline:**
1. Source: Uncompressed TIFF from photography
2. Process: Crop, color-calibrate, tone-map
3. Export: AVIF (quality 65), WebP (quality 75), JPEG (quality 80)
4. Validate: Each variant must be within budget
5. Deliver: Via Vercel Image Optimization CDN with `Accept` header negotiation

### Technical Stack Compatibility

| Technology | Role | Version |
|-----------|------|---------|
| React | UI framework | 18.x+ |
| Next.js | Application framework | 14.x+ (App Router) |
| TypeScript | Type safety | 5.x+ |
| Tailwind CSS | Utility styling | 3.4+ |
| Framer Motion | Primary animation | 11.x+ |
| GSAP | Complex animation | 3.12+ (with ScrollTrigger) |
| Spline | 3D educational models | @splinetool/react-spline |
| Vercel | Hosting + CDN + Image Optimization | — |

### Scalability Architecture

**18 questionnaire questions:**
- Each question follows the `AssessmentPage` template
- Question configs stored in a JSON/TypeScript registry
- Grade options are data-driven — no per-question component code
- The visual system (card layout, selection behavior, educational overlays) is identical

**100+ answer options:**
- Some questions have more/fewer options than the 5 grades shown here
- Card grid adapts: 2-column for ≤4 options, 3-column for 5–9, 4-column for 10+
- Horizontal scroll with snap points for any count on mobile

**Future conditions:**
- The `GradeOption` interface accepts any condition type
- Photography style guide + AI prompt framework (Section 21) enables rapid asset creation
- Component library handles new conditions without new components

**Future clinics:**
- Theme tokens support white-labeling (color overrides per clinic)
- Kiosk mode is a CSS class toggle, not a separate build
- Multi-language: All text externalized to i18n strings

**Future languages:**
- All patient-facing text in translation keys, never hardcoded
- RTL support: card layout uses `flex-direction` with logical properties
- Text expansion: German/Arabic text can be 40% longer — card text areas use `min-height`, not fixed height
- Typography: system font stack includes CJK and Arabic fallbacks

### Maintainability

**Designer workflow:**
1. Photograph new condition per Camera Language spec (Section 6)
2. Process per Image Delivery Strategy (Section 19)
3. Add entry to question config JSON
4. Assets auto-deploy via Vercel

**Developer workflow:**
1. New question type? Extend `QuestionConfig` interface
2. New interaction pattern? Add variant to existing motion system
3. New breakpoint? Add to container query config
4. New clinic theme? Override token values in theme config

### Clinic Hardware Support

| Device | Resolution | Considerations |
|--------|-----------|----------------|
| iPhone 12+ | 390px+ | Primary mobile target |
| iPad (9th+) | 810px+ | Clinic check-in tablets |
| iPad Pro | 1024px+ | Doctor consultation |
| iMac / external display | 1440px+ | Reception desk |
| Clinic kiosk (Windows) | 1920px+ | Touch-only, no hover, high contrast |

### Accessibility Compliance

| Standard | Level | Status |
|----------|-------|--------|
| WCAG 2.1 | AA | Required — all criteria met |
| WCAG 2.1 | AAA | Target — achieved on 85%+ of criteria |
| Section 508 | Full | Required |
| EN 301 549 | Full | Required (EU clinics) |
| `prefers-reduced-motion` | Full | All animations have reduced alternatives |
| `prefers-color-scheme` | Full | Dark mode fully designed |
| `prefers-contrast` | Partial | High contrast kiosk mode available |

---

## 21. AI Image Generation Framework

### Master Prompt

```
Clinical hair loss assessment photography for Dr. FACT diagnostic system.
Top-down bird's-eye view of the crown/vertex of a human head.
Controlled studio lighting: large overhead softbox, 5500K color temperature.
Background: neutral warm off-white (#F8F6F3).
Camera: 85mm equivalent lens, f/8, sharp across entire frame.
Framing: 10cm × 10cm area of the crown, centered in a square frame.
8% safe zone inset from all edges.
Subject facing away from camera (top of head toward camera, face toward bottom of frame).
Natural skin tone, no beauty retouching, no artificial enhancement.
Clinical accuracy is paramount — this image will be used for medical self-assessment.
No text, no watermarks, no logos, no UI elements in the image.
Photorealistic, high-resolution, medical-grade quality.
```

### Negative Prompt

```
cartoon, illustration, drawing, painting, sketch, anime, 3D render,
CGI, artificial, plastic skin, wax, mannequin, doll,
beauty filter, glamour lighting, dramatic shadows, high contrast,
harsh lighting, colored lighting, neon, bokeh, blur,
text, watermark, logo, frame, border, vignette,
jewelry, clothing visible, background objects, environmental context,
blood, wounds, scarring (unless specifically documenting alopecia areata),
stock photo watermark, shutterstock, getty, istockphoto,
dystopian, sci-fi, fantasy, surreal, abstract
```

### Photography Prompt (per grade)

**Grade 1 — Minimal Thinning:**
```
{Master Prompt}
Hair loss grade: Ludwig/Hamilton Grade 1 equivalent.
Full hair coverage with subtle density reduction visible along the part line.
Hair density approximately 85-90% of full coverage.
Scalp barely visible through the hair, only at the widest point of the part.
Hair appears healthy but slightly thinner than full density.
Natural hair texture clearly visible.
[Specify: ethnicity, hair color, hair type as needed for diversity]
```

**Grade 2 — Noticeable Thinning:**
```
{Master Prompt}
Hair loss grade: Ludwig/Hamilton Grade 2 equivalent.
Noticeable thinning with widened part line.
Hair density approximately 60-70% of full coverage.
Scalp visible through the hair in the crown area.
Individual hair strands distinguishable in thinning areas.
Clear visual difference from full coverage.
[Specify: ethnicity, hair color, hair type]
```

**Grade 3 — Significant Loss:**
```
{Master Prompt}
Hair loss grade: Ludwig/Hamilton Grade 3 equivalent.
Significant hair loss with clearly visible scalp.
Hair density approximately 40-50% of full coverage.
Scalp is the secondary visual element (hair still dominant but sparse).
Remaining hair is distributed but thin across the affected area.
Pattern of loss clearly visible.
[Specify: ethnicity, hair color, hair type]
```

**Grade 4 — Extensive Loss:**
```
{Master Prompt}
Hair loss grade: Ludwig/Hamilton Grade 4 equivalent.
Extensive hair loss with majority scalp visible.
Hair density approximately 20-30% of full coverage.
Scalp is the dominant visual element.
Remaining hair primarily at the periphery of the crown area.
Clear pattern of extensive thinning.
[Specify: ethnicity, hair color, hair type]
```

**Grade 5 — Advanced Loss:**
```
{Master Prompt}
Hair loss grade: Ludwig/Hamilton Grade 5 equivalent.
Advanced hair loss with minimal remaining coverage.
Hair density approximately 10-15% of full coverage.
Scalp is the primary visual element.
Sparse, fine remaining hairs across the crown.
[Specify: ethnicity, hair color, hair type]
```

### Medical 3D Prompt

```
Medical-grade 3D rendering of human scalp cross-section.
Anatomically accurate layers: epidermis, dermis, subcutaneous tissue.
Hair follicles shown at [specify density for grade] density.
Follicle structures include: hair shaft, inner root sheath, outer root sheath,
dermal papilla, sebaceous gland, arrector pili muscle.
Subsurface scattering on skin for realistic translucency.
Neutral clinical lighting, 5500K color temperature.
Matte-satin surface finish, no specular highlights.
Clean white background.
Medical illustration quality — anatomically precise, aesthetically clean.
No text labels (these are added in post-production).
Render at 2x display resolution for Retina/HiDPI screens.
```

### Clinical Illustration Prompt

```
Minimalist medical illustration of hair loss pattern.
Top-down view of the crown area matching the photography framing.
Clean vector linework: 1.5px stroke weight, dark charcoal (#2C2C2E).
Selective color fill for affected areas using density gradient.
Full density areas: warm hair tone (#5C3D2E).
Thinning areas: reduced opacity of hair tone.
Scalp areas: warm skin tone (#F2D9C2).
No crosshatching, no heavy shading.
Modern, minimal aesthetic — Apple Health diagram quality.
Anatomical accuracy reviewed by dermatologist.
[Specify grade-specific density pattern]
```

### Scalp Macro Prompt

```
Extreme close-up macro photography of human scalp.
1:1 reproduction ratio or closer.
Focus-stacked composite for maximum depth of field.
Shows individual hair follicle openings and emerging hair shafts.
Skin texture visible at pore level.
Clinical lighting: ring light + overhead diffusion.
Color-calibrated: include calibration chip in capture (crop in post).
No beauty retouching — clinical accuracy required.
Hair density: [specify for grade]
Follicle spacing: [specify for grade]
Hair shaft diameter: [specify — thinner for miniaturized follicles]
```

### Hair Density Prompt

```
Clinical documentation of hair density at [specify grade].
Standardized trichoscopy-style view.
Fixed magnification: 20x or 40x equivalent.
Shows follicular units per square centimeter.
Individual hair shafts countable.
Vellus vs. terminal hair ratio visible.
Neutral background behind hair shafts.
Consistent lighting across all density documentation images.
Clinical measurement reference (1cm scale bar included in capture).
```

### Consistency Rules

1. **Same AI model and version** for all images in a grade set
2. **Same seed value** when generating variations (ethnicity/hair type diversity)
3. **Same master prompt** appended to all grade-specific prompts
4. **Same negative prompt** for all generations
5. **Post-processing pipeline** identical for all images:
   - Color calibration to reference target
   - Crop to exact 1:1 aspect ratio
   - Tone mapping to match warm-clinical aesthetic
   - Export at exact pixel dimensions per breakpoint
6. **Dermatologist review** of every generated image before production use
7. **Patient review panel** validates recognizability of every image set

### Asset Naming System

```
drfact-{question}-{grade}-{type}-{variant}-{size}.{format}

Examples:
drfact-q18-g1-photo-caucasian-400w.avif
drfact-q18-g3-photo-southasian-800w.webp
drfact-q18-g2-illustration-default-svg.svg
drfact-q18-g4-3d-crosssection-800w.avif
drfact-q18-g5-macro-follicle-400w.webp

Components:
- question: q01–q18 (questionnaire number)
- grade: g1–g5 (or option number for non-graded questions)
- type: photo, illustration, 3d, macro, density
- variant: caucasian, southasian, eastasian, african, default
- size: 200w, 400w, 600w, 800w, svg (vector)
- format: avif, webp, jpg, svg, glb (3D)
```

---

## 22. Future Expansion Framework

### How the Visual Language Extends

The North Star system is designed as a **template + data** architecture. The visual framework (card layout, selection behavior, educational overlays, motion system, accessibility patterns) remains constant. Only the content changes.

### Q03 — Major Concerns

**Question:** "What are your major concerns about your hair?"

**Options:** Thinning, Shedding, Receding hairline, Bald patches, Texture changes, Greying, Other

**Adaptation:**
- Same card layout (7 options → horizontal scroll on mobile, 2-row grid on desktop)
- Photography style: Close-up shots showing each concern type
- Same selection behavior, educational overlays, and accessibility patterns
- Severity colors NOT used (these are concerns, not severity grades)
- All cards use neutral `--clinical-border` color

### Q06 — Hair Fall Pattern

**Question:** "Which pattern best matches your hair fall?"

**Options:** Diffuse thinning, Frontal recession, Crown thinning, Temple recession, Patchy loss

**Adaptation:**
- Photography style: Same bird's-eye view with annotation overlay showing the pattern
- Medical illustration: Overhead head diagram with highlighted pattern zones
- Pattern-specific camera angles: frontal recession requires 45° front view (exception to bird's-eye rule)
- Same card interaction model

### Q07 — Scalp Condition

**Question:** "How would you describe your scalp condition?"

**Options:** Healthy, Dry/Flaky, Oily, Irritated/Red, Itchy, Flaking/Dandruff

**Adaptation:**
- Photography style: Macro close-up (scalp-level detail, not crown overview)
- Uses the Scalp Macro Prompt from the AI framework
- Educational overlays show cross-section 3D of healthy vs. affected scalp
- Severity gradient may apply (healthy → severely affected)

### Q18 — Hair Loss Grade (This Document's North Star)

Fully specified in this document. Serves as the canonical reference for all other question visual designs.

### AI Processing Theatre

**Visual language extension:**
- The clinical color palette applies to all AI processing screens
- Progress indicators use the same spring-based animation system
- "Processing" states use the skeleton loading pattern from Section 18
- Results presentation uses the same card architecture with expanded educational content
- Motion philosophy: purposeful, restrained, responsive (no "AI thinking" animations with spinning brains or matrix-style effects)
- Frosted glass overlays from the assessment system carry into the processing theatre

### Patient Reports

**Visual language extension:**
- Report typography follows the same SF Pro hierarchy
- Grade badges use the same severity color system
- Illustrations use the same medical illustration style
- Charts and graphs use the clinical color palette
- Print stylesheet: removes shadows, ensures high-contrast text, images at 300dpi
- PDF export: maintains the warm-clinical color temperature

### HairOS Intelligence (Internal Platform)

**Visual language extension:**
- Internal dashboards use the same token system but with a denser layout
- Clinical data tables use the same typography hierarchy
- Severity indicators are consistent with patient-facing grades
- 3D visualizations use the same Spline-based rendering pipeline
- Motion is more restrained (clinicians prefer immediate state changes over animations)

### Clinic Dashboard

**Visual language extension:**
- Patient assessment data displayed using the same grade cards (read-only view)
- Clinic staff see the same visual that the patient saw during self-assessment
- Comparison views allow clinician to validate patient self-grading
- Dashboard uses the desktop color palette with kiosk-mode contrast adjustments
- Print functionality for patient records

### Future Diagnostic Products

**The visual system is designed to accommodate:**
- Scalp analysis (trichoscopy integration)
- Hair quality assessment (texture, porosity, elasticity)
- Treatment progress tracking (before/after comparison using identical camera language)
- AI-powered condition detection (overlays on patient-uploaded photos)
- Telehealth consultations (shared visual reference between patient and specialist)

**Extension principle:** Any new visual experience within Dr. FACT should be expressible as a combination of existing components (cards, overlays, annotations, illustrations) with new content. If a new experience requires a new component type, it should be designed to the same standards and added to the component library — not built as a one-off.

---

## Appendix A: Decision Log

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Primary visual medium | Photography / Illustration / 3D / Hybrid | Hybrid | Each medium excels in its role: photography for recognition, illustration for understanding, 3D for deep learning |
| Typography | Custom font / System font / Google font | System (SF Pro) | Native rendering, proven medical context, no load-time cost |
| Color system | Custom / Material / Apple HIG | Apple HIG–derived | Patients on Apple devices (primary clinic hardware) see native colors; universal recognition of blue = interactive |
| Card layout | Grid / List / Carousel | Adaptive (row → scroll → stack) | Different layouts serve different viewports; single layout would compromise one |
| Animation library | CSS only / Framer only / GSAP only / Hybrid | Framer Motion + GSAP | Framer for React-integrated motion; GSAP for SVG paths and complex timelines |
| Severity color position | Card background / Border / Badge only | Badge only | Full-card color creates alarm at higher grades; badge is informative without being overwhelming |
| Educational disclosure | Always visible / On request / Progressive | Progressive on request | Respects patient's primary task (selection) while rewarding curiosity |
| Dark mode | System-following / Always light / Optional | System-following with kiosk override | Respects user preference; kiosk environments need controlled lighting for image accuracy |

## Appendix B: Quality Assurance Checklist

- [ ] All 5 grade cards pass WCAG AA contrast checks
- [ ] All text is readable at 200% zoom
- [ ] Keyboard navigation cycles through all cards with visible focus indicator
- [ ] Screen reader announces grade, title, description, and density for each card
- [ ] Selection is reversible (select → deselect → re-select)
- [ ] Educational overlay opens and closes without focus trap issues
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Cards display correctly at 375px, 390px, 430px, 768px, 1024px, 1280px, 1440px
- [ ] Images load within performance budgets (150KB mobile, 300KB desktop)
- [ ] No layout shift during image loading (CLS < 0.05)
- [ ] First Contentful Paint < 1.2s on 4G connection
- [ ] Touch targets ≥ 44px on all devices
- [ ] Color-blind simulation shows no information loss
- [ ] RTL layout mirrors correctly
- [ ] Kiosk mode activates correctly on 1920px+ touch screens
- [ ] Print stylesheet renders readable black-and-white output

---

**End of Specification**

*This document is the canonical reference for all visual assessment experiences within the Dr. FACT ecosystem. All future assessment screens, reports, and clinical interfaces should derive from this specification. Deviations require documented justification and design review.*
