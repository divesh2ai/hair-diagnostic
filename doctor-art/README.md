# Doctor Dashboard — Traced Decorative Art

Hand-traced SVG artwork reproducing the decorative layer of the reference doctor
dashboard (the *"DrFACT Mumbai Test Clinic"* clinical workspace). These are
**drop-in, self-contained components** — no new dependencies, no data, no routing.
They were traced against the reference at its native **1648 × 928** coordinate
space and validated with a rasterize → overlay → diff loop (cairosvg + Pillow),
not generated procedurally.

> **Why this folder lives here:** the production `/doctor` dashboard (the React/Next
> app with `DoctorSidebarBotanical` etc.) is **not** in this repository —
> `divesh2ai/hair-diagnostic` currently holds only the mobile `Dr. FACT` chat HTML
> and a vanilla `next-saas-stripe-starter` zip. So this is delivered as portable
> components to drop into the real project, exactly as requested.

## Files

| File | What it is |
|------|------------|
| `DoctorSidebarBotanical.tsx` | Tall fern-like branch for the lower sidebar (one curved stem, ~13 alternating tapered leaves, faint blobs behind the mascot, lower-left bush, cream ground ribbon + champagne line). `viewBox 0 0 330 440`. |
| `DoctorDashboardWaves.tsx` | Hero ribbons: translucent-white wash → pale-sage pool → warm-cream ribbon → bright ivory band → twin champagne contour lines. `viewBox 0 0 1260 300`, `preserveAspectRatio="none"`. |
| `DoctorBranchBarArt.tsx` | Branch-selector strip overlay: ivory ribbon + champagne contour, stepped clinic building with windows, two sage leaf clusters. Right ~45%, fades left. `viewBox 0 0 640 64`. |
| `DoctorHeroComposition.tsx` | **Placeholder** for the hero's photographic stethoscope-on-desk still-life (see *Known discrepancy* below). |
| `preview.html` | Standalone, no-build harness rendering all four layers in an approximate dashboard shell. Open it in any browser. |
| `raw-*.svg` | The validated SVG the `.tsx` files were generated from (same geometry, kebab-case attrs). |
| `comparisons/` | Overlay evidence: each traced layer composited onto the reference, plus the full preview render. |

## Integration

Each SVG component accepts standard `SVGProps` (`className`, `style`, …), is
`aria-hidden`, and has `pointerEvents:none`. Place them as absolutely-positioned
background layers *behind* the real content.

```tsx
// Sidebar (position: relative; overflow: hidden)
<DoctorSidebarBotanical
  style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 460 }}
/>

// Hero banner (position: relative; overflow: hidden)
<DoctorDashboardWaves style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
<DoctorHeroComposition src="/images/hero-stethoscope.jpg" /> {/* omit src to get the soft wash */}
{/* …hero text on a higher z-index… */}

// Branch strip (position: relative; overflow: hidden)
<DoctorBranchBarArt
  style={{ position: "absolute", top: 0, right: 0, height: "100%", width: "46%" }}
/>
```

Keep each parent `overflow: hidden` — leaves and the building intentionally bleed
past the edges, as in the reference.

## Reference coordinate map (1648 × 928)

| Layer | Reference region (x, y) |
|-------|-------------------------|
| Sidebar botanical branch | x ≈ 200–320, y ≈ 520–905 |
| Sidebar soft blobs / bush | x ≈ 40–230, y ≈ 560–880 |
| Hero waves (crest) | crest ≈ x 820, bands span x ≈ 450–1500, y ≈ 230–430 |
| Branch-bar art | x ≈ 1050–1630, y ≈ 140–200 |
| Hero photo composition | x ≈ 1200–1630, y ≈ 215–430 |

## Palette

```
sage deep #8fae8f   sage mid #a9c4a3   sage light #c3d8bd   sage pale #d7e6d2
ivory #f6f1e6        cream #efe7d4       cream2 #e9dcc0
champagne #c9a24b    champagne-lt #d8bd82   building #d8c3a2
```

## Pixel-diff iteration log

Each layer was rasterized at reference scale, composited onto the reference, and
corrected until the silhouette registered. Highlights:

- **Sidebar leaves** → first pass leaves sat too horizontal → re-angled toward
  vertical (feathery rising look), made more slender (len:wid ≈ 3.3:1), lengthened,
  and added 2 leaves for tip density → overlay now registers on the reference branch.
- **Hero wave** → first crest began too far left and intruded behind "Dr Divesh" →
  shifted the whole system right (+≈160 viewBox-x), faded the left tails to zero, and
  lifted the crest → crest now peaks at ≈ card-x 820 like the reference.
- **Branch foliage** → initial strip was near-empty → reproduced the stepped building
  silhouette + windows and both sage leaf clusters, softened opacities so it stays
  subtle and fades left.

See `comparisons/overlay-*.png` (top = reference, bottom = reference + traced layer).

## Known discrepancy — hero photographic composition

The right third of the reference hero is a **raster photograph** (gold + dark-green
stethoscope on a pale stone desk, a potted plant top-right, warm blurred backdrop).
Per the brief, this was **not** faked with abstract vector medical icons.

`DoctorHeroComposition.tsx` is therefore a deliberate, isolated placeholder:
- Pass an owned asset via `src` (search the real project for *stethoscope / clinic
  desk / doctor desk / medical workspace / hero / clinical*) and it renders as a
  right-anchored cover image that fades into the hero text.
- With no `src`, it renders a warm gradient wash that blends with the waves so the
  hero still reads — but this area is knowingly not a pixel match to the photo.

Everything else (sidebar botanical, hero ribbons, branch-bar art) is a full trace.

## Regenerating

The art was authored in a Python generator (`gen.py`, kept with the session
scratchpad). Edit control points / leaf tables there, re-run, and re-run the
overlay compare to iterate. The `.tsx` files are a straight camelCase transform of
the resulting `raw-*.svg`.
