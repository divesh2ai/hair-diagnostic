# Assessment V3 — Chapter artwork masters

Drop **two master images per chapter** here, then run:

```bash
node scripts/build-chapter-assets.mjs
```

That generates the exact 8-file optimized set each chapter needs (desktop
1440×900 + @2x 2880×1800, mobile 585×1266 + @2x 1170×2532, each as `avif` + `webp`),
matching the **Nutrition benchmark** exactly. You only provide the masters.

## File naming

```
{slug}-desktop.(png|jpg|webp)    ≥ 2880 × 1800   (16:10 landscape)
{slug}-mobile.(png|jpg|webp)     ≥ 1170 × 2532   (portrait ~0.46:1)
```

| Chapter | slug | Section |
|---|---|---|
| Identity | `identity` | S1_PATIENT_IDENTITY |
| Hair History | `hair-history` | S2_HAIR_LOSS_ASSESSMENT |
| Symptoms | `symptoms` | S3_SCALP_CONDITION |
| Lifestyle | `lifestyle` | S4_MEDICAL_HISTORY |
| Nutrition | `nutrition` | S5 — **benchmark, already done, do not replace** |
| Completion | `completion` | S6_GRADE_AND_ADDITIONAL |

## Shared visual language (match Nutrition on every image)

- **Cinematic editorial realism** — real photography or indistinguishable-from-photo render. No illustration, 3D-cartoon, flat vector, or stocky feel.
- **Controlled dramatic lighting** — a single soft key from the upper-left, deep controlled shadows, gentle falloff. Moody, not bright/flat.
- **Palette** — dark forest-green base (#0b2b24–#1c5143) with warm neutrals (cream, oat, muted gold #b48e43). No competing hues (no blues, pinks, teals).
- **Rich natural textures** — stone, linen, botanicals, hair, ceramic. Tactile.
- **Clear single focal subject** on the **right ~55%** of the desktop frame.
- **Generous negative space on the left** (desktop) / **top** (mobile) — that's where the chapter title, body and "Begin chapter" button sit over a scrim. Keep the subject out of those zones so nothing important is covered or cropped.
- Desktop scrim darkens the **left**; mobile scrim darkens the **top**. Compose accordingly.

## Per-chapter direction

### `identity` — Identity · *elegant self-recognition, personal beginning, trust*
Quiet, premium still life of a personal beginning. Suggested: a smooth dark-green
river stone and a single fresh eucalyptus/rosemary sprig resting on folded warm
linen, upper-left soft light. Intimate and trustworthy. **Avoid literal faces.**
Subject right; calm negative space left.

### `hair-history` — Hair History · *passage of time, changing hair journey, flowing strands*
Sculptural close-up of long, healthy dark hair flowing as rich texture across the
frame, catching a raking side light — strands gather on the right and thin toward
the left into negative space. Editorial hair-campaign quality. No face required.

### `symptoms` — Symptoms · *refined diagnostic beauty, NO graphic scalp close-ups*
Elegant abstraction of "looking closely": a single dewy botanical leaf with fine
visible veins under raking light, or water droplets beading on a dark-green
surface. Clinical-adjacent beauty, never a real scalp/skin close-up. Subject right.

### `lifestyle` — Lifestyle · *stress, sleep, habits, modern routine*
Moody premium wellness still life of a calm evening ritual: warm linen, a cup of
herbal tea gently steaming, a folded throw, dim warm lamp glow. Restful, editorial,
health-and-wellness. Subject right; soft negative space left.

### `completion` — Completion · *confidence, clarity, positive progress, NO cliché celebration*
Quiet optimism: soft dawn light breaking through green leaves, or a single healthy
plant reaching toward warm light against a forest-green ground. Clarity and forward
motion — **no confetti, fireworks, thumbs-up, or crowd/celebration clichés.**

## Focal tuning (optional)

If a subject sits slightly off after cropping, set per-chapter focal points in
`CHAPTER_ARTWORK` (`ChapterTransitionV3.tsx`) via `focalDesktop` / `focalMobile`
(e.g. `focalDesktop: '70% 45%'`). Defaults to centre.
