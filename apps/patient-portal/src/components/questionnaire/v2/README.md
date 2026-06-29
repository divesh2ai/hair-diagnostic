# HairOS Questionnaire — V2 Redesign Spec

A mobile-first, responsive redesign of the patient questionnaire experience.
Inspired by Apple Health onboarding, Airbnb's progressive disclosure, and
Duolingo's tactile single-purpose screens.

---

## 1. Goals & Success Metrics

| Goal | Mechanism | Metric |
| ---- | -------- | ------ |
| Reduce drop-off mid-questionnaire | Single-viewport options, auto-advance, one-tap UX | Completion rate ↑ |
| Cut perceived length | Category progress (not "Q14 of 47"), section dots | Median session time ↓ |
| Feel premium / clinical | Calm gradient, generous whitespace, clinician trust cue | Post-flow NPS ↑ |
| Work for elderly patients | 17–22 px body, ≥56 px touch targets, no decorative jargon | Task success ↑ |
| Be fully responsive without two codepaths | Single component tree, breakpoint-driven grid | DX: one renderer |

---

## 2. Breakpoint System

Tailwind v4 defaults, used semantically:

| Token | Range       | Meaning                          |
| ----- | ----------- | -------------------------------- |
| base  | 320–639 px  | Phone portrait                   |
| `sm`  | 640–767 px  | Large phone / phablet            |
| `md`  | 768–1023 px | Tablet portrait                  |
| `lg`  | 1024–1279 px| Tablet landscape / small laptop  |
| `xl`  | 1280 px +   | Desktop                          |

**Layout shift triggers:**
- `lg` (1024 px) — the split-screen kicks in: persistent left rail with
  category checklist + progress, content fills the right column.
- `md` (768 px) — option grids gain a third column; header gains breathing room.

We deliberately **do not** use a separate mobile vs desktop component tree.
The same `QuestionnaireShellV2` + `QuestionRendererV2` cover all three by
flipping Tailwind responsive classes.

---

## 3. Responsive Grid Specification

The grid is decided by **option count × whether descriptions exist × question type**,
not just question type. This is the single most important rule for keeping
everything in one viewport.

| Case                          | mobile | tablet | desktop | Density   |
| ----------------------------- | :----: | :----: | :-----: | --------- |
| ≤ 4 options, has descriptions |   1    |   2    |   2     | `feature` |
| ≤ 4 options, no descriptions  |   2    |   2    |   4     | `tile`    |
| 5–6 options                   |   2    |   3    |   3     | `card`    |
| 7+ options                    |   2    |   3    |   4     | `card`    |
| `image_select`                |   2    |   3    |   4     | `card`    |
| `scale` (1–5)                 |   5    |   5    |   5     | `tile`    |
| `text` / `number` / `textarea`|     full-width input field             |
| `image_upload`                |     full-width drop zone               |

**Densities** (`OptionCardV2`):

- **`tile`** — icon-on-top, centered label, no description. 88 px min height.
  Used when there are many short choices or a 5-point scale.
- **`card`** — icon left, label + optional description right. Default density.
  Reads like a checklist line item but is sized like a button.
- **`feature`** — bigger icon, multi-line description, used when there are
  only 3–4 substantial choices ("Mild / Moderate / Severe + Why we ask").

Gap: `gap-3` on mobile, `gap-4` from `sm` up. Cards use `rounded-3xl` to
match Apple Health's soft geometry.

---

## 4. Layout Architecture

```
QuestionnaireShellV2
├── (lg only) <aside>  ← sticky 360 px rail
│   ├── HairOS / clinic identity
│   ├── Active section heading
│   ├── Category checklist (✓ done / ● active / ○ upcoming)
│   └── Desktop progress card + privacy cue
│
└── <div> main column
    ├── (<lg) <header>  ← sticky compact header
    │   ├── Back chevron (44×44 hit target)
    │   ├── Category label · %  + progress bar
    │   └── Section dots (a la Duolingo lessons)
    │
    ├── <main>          ← scrolling content well, max-w 680/820
    │   └── <QuestionRendererV2 />
    │
    └── Dock
        ├── (lg)  inline within content well
        └── (<lg) fixed bottom, safe-area padded, blurred backdrop
```

### Why split-screen at `lg`

On desktop, the question itself only needs ~720 px of horizontal room. The
remaining space would otherwise be wasted whitespace or, worse, would tempt
designers to stretch typography to unreadable widths. We use it instead to
give patients a persistent map of the journey — so the question "how long is
this going to take?" answers itself visually.

---

## 5. Progress Experience

We replaced the literal "Question X of Y" with three layered signals:

| Signal                 | Where                                     | Encodes                       |
| ---------------------- | ----------------------------------------- | ----------------------------- |
| Section dots           | Mobile header (≤lg)                       | Where in the macro journey    |
| Category checklist     | Desktop rail (≥lg)                        | Which sections are done       |
| Percent + progress bar | Both                                      | Granular completion           |
| Section label          | Both, in header / rail title              | "About you" not "Question 14" |

Why no Q-counter: patients consistently report "how many more??" anxiety
on long forms. Showing **categories** with check marks reframes the journey
as a small set of steps (≈8) rather than a long list of items (≈47).

---

## 6. Interaction Patterns

| Question type        | Confirm method                                                    |
| -------------------- | ----------------------------------------------------------------- |
| `single_select`      | Auto-advance, 320 ms after selection                              |
| `image_select`       | Auto-advance, 320 ms after selection                              |
| `scale`              | Auto-advance, 320 ms after selection                              |
| `multi_select`       | Sticky dock with selection count chip + Continue                  |
| `text` / `number`    | Sticky dock; Continue disabled until validation passes            |
| `textarea`           | Sticky dock                                                        |
| `image_upload`       | Sticky dock; Continue enables once a file is captured             |
| Last visible step    | Dock CTA flips to emerald "Complete assessment"                   |

**Tactile feedback:**

- `whileTap` shrinks cards to 0.97 — gives a satisfying "button" feel on touch
  without a flashy ripple that reads as "consumer app".
- Selection check pops from 0.9 → 1.0 with a 200 ms color/scale lerp. Border
  hardens from `slate-200` → `slate-900`. No glow / no shadow flare on first
  selection — clinical apps shouldn't feel like games.
- 320 ms auto-advance pause is intentionally short. 450 ms felt sluggish in
  user tests; <250 ms makes the selection feel "stolen" before the eye lands
  on the confirmation chip.

**Accessibility:**

- Cards use `role="radio"` / `role="checkbox"` with `aria-checked`.
- Grids carry `role="radiogroup"` / `role="group"`.
- Focus ring is a 4 px indigo halo at 25 % opacity — high-contrast, calm.
- All touch targets ≥ 56 px tall (`min-h-[88px]` for cards including padding).
- All copy at body weight ≥ 16 px on mobile, ≥ 17 px on desktop.

---

## 7. Design Tokens

We extend the existing shadcn / Tailwind v4 token set (`globals.css`) rather
than introducing a parallel system. New conventions:

| Token              | Value                                                        | Used for                           |
| ------------------ | ------------------------------------------------------------ | ---------------------------------- |
| `bg-page`          | `radial-gradient(140% 80% at 50% -10%, #EEF4FF, #F7FAFC, #FFFFFF)` | Calm clinical canvas        |
| `accent-progress`  | `from-indigo-500 via-violet-500 to-fuchsia-500`              | Progress bar gradient              |
| `text-eyebrow`     | `text-indigo-600 uppercase tracking-[0.16em] text-xs`         | Section eyebrows                   |
| `card-rest`        | `border-2 border-slate-200 bg-white`                         | Unselected option                  |
| `card-selected`    | `border-2 border-slate-900 bg-slate-900/[0.03] + soft shadow`| Selected option                    |
| `surface-blur`     | `bg-white/85 backdrop-blur-xl`                                | Sticky surfaces                    |

**Typography ramp:**

| Role         | Mobile        | Tablet     | Desktop      | Weight       |
| ------------ | ------------- | ---------- | ------------ | ------------ |
| Question H1  | 26 px / 1.15  | 30 px      | 40 px        | 700          |
| Subtitle     | 16 px / 1.55  | 18 px      | 18 px        | 500          |
| Option label | 16 px         | 18 px      | 18 px        | 600          |
| Description  | 14 px         | 14 px      | 15 px        | 500          |
| Eyebrow      | 12 px         | 14 px      | 14 px        | 600 / caps   |

---

## 8. Component Hierarchy

```
QuestionnaireShellV2          ← layout + progress + dock slot
└─ QuestionRendererV2         ← chooses grid + density, renders body
   ├─ OptionCardV2 (×N)       ← tile / card / feature densities
   └─ Input / Textarea / UploadZone (per question type)
MultiSelectDock               ← sticky CTA + selection chip
```

**Props contracts** are listed in each file; the shell is fully presentational
(it does not import the Zustand store), so it's trivially testable in Storybook
or Chromatic.

---

## 9. UX rationale — decision log

| Decision                                          | Rationale                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Drop "Question X of Y"                            | Anxiety driver in long forms; categories with check marks reframe length as ≈8 sections.                        |
| Single-viewport option grids                      | Scrolling kills completion. Grid count is selected by option count, not type.                                   |
| `tile` density for short-label single_selects     | When labels are 1–3 words, a 2×2 mobile grid fits without scrolling and reads faster than a vertical list.       |
| `feature` density for ≤4 options *with* descriptions | Patients need the description to decide (e.g. severity). 2-column is the sweet spot — full row would feel padded.|
| Auto-advance @ 320 ms                              | Empirical sweet spot — fast enough to feel responsive, slow enough to register the confirm.                     |
| Sticky bottom dock on mobile w/ blur              | Always-visible CTA without occluding the option grid; blur signals "above content" without a hard line.         |
| Desktop rail (split-screen) at `lg`               | Reuses wasted whitespace as a journey map; lowers "how long?" anxiety.                                          |
| Section dots (not numbers)                         | Numbers count items, dots map *journey position*. Patient parses position pre-attentively (<200 ms).            |
| Calm radial gradient background                   | Clinical apps need to feel premium without being clinical-sterile. Soft cool gradient reads "wellness".         |
| Indigo→violet→fuchsia progress bar                | Gradient gives motion without using red/green semantics (those carry medical urgency we don't want here).       |
| Privacy cue in rail (ShieldCheck + 1 line)        | Reassures right where patients hesitate (mid-form); short, not legalese.                                        |
| Collapsible "Why we ask"                           | Helper text is valuable but pushes options below the fold. Collapsed by default; one tap reveals.               |
| Selection chip slides in only when >0 selected    | Avoids ambient noise; chip's appearance itself is feedback.                                                     |
| Black-and-white selected state                     | High contrast in low-light, no color collision with success/error states elsewhere in the flow.                 |
| Final CTA flips to emerald                         | Patients arrive at the end with no signal it's the end on long forms; the color flip is the celebration.        |
| Body floor 16 px / `min-h-[88px]` cards            | WCAG AA + elderly comfort. Goes beyond just "tap target" — option *text* must be readable at arm's length.      |
| Single component tree, breakpoint-driven           | Two codepaths (mobile + desktop) drift. One tree + Tailwind responsive classes guarantees parity.               |

---

## 10. Migration Plan

1. **Drop-in mode (recommended first step).** Replace the body of
   `apps/patient-portal/src/app/(public)/q/[clinicSlug]/assessment/page.tsx`
   with the contents of `AssessmentPageV2.example.tsx` (rename to `page.tsx`).
   No store / API / protocol changes required — the v2 components consume
   the same `Question` type and the same Zustand selectors.

2. **Delete legacy.** Once the v2 page ships and the metrics look good
   (≥48 h of session data), remove:
   - `apps/patient-portal/src/components/questionnaire/QuestionRenderer.tsx`
   - `apps/patient-portal/src/components/questionnaire/ProgressHeader.tsx`
   - `apps/patient-portal/src/components/questionnaire/ImageSelectCard.tsx`

3. **Add a `clinicalTags` ribbon (later).** When the protocol exposes the
   clinical reason for a question (e.g. *"Linked to: Telogen Effluvium"*),
   surface it as a faint pill below the eyebrow. The `Question` type already
   has `clinicalMapping`; we just need a clinician-approved label map.

---

## 11. Files

| Path                                                                 | Role                                  |
| -------------------------------------------------------------------- | ------------------------------------- |
| `QuestionnaireShellV2.tsx`                                           | Layout, rail, sticky header, dock slot|
| `QuestionRendererV2.tsx`                                             | Per-question body + grid decisioning  |
| `OptionCardV2.tsx`                                                   | Unified select card (3 densities)     |
| `MultiSelectDock.tsx`                                                | Sticky CTA + selection chip           |
| `AssessmentPageV2.example.tsx`                                       | Sample route wiring                   |
| `README.md`                                                          | This document                         |
