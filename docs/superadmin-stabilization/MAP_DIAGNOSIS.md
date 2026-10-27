# India network map — final diagnosis (real-browser evidence)

## Method
The Vercel preview and `tile.openstreetmap.org` are both blocked by this
container's egress, so the app itself can't be driven here. Instead the **exact
MapLibre 6.6.0 build the app bundles** (`node_modules/maplibre-gl/dist`) was
served locally and driven in **real headless Chromium (Playwright)** — a real
browser, real WebGL, real module worker — with no egress required for the
tile-free test. Two runs:

### Run A — tile-free style (isolates library / worker / canvas)
```json
{ "loadFired": true, "errors": [], "canvas": { "present": true, "w": 1280, "h": 720 }, "markerPresent": true }
```
### Run B — real OSM raster style (tiles blocked by egress here, simulating a browser that can't reach the tile host)
```json
{ "loadFired": false, "tilesOk": 0, "tileErr": 28, "canvas": { "present": true, "w": 1280, "h": 720 },
  "errors": ["AJAXError: Failed to fetch (0): https://tile.openstreetmap.org/5/23/13.png", "…"] }
```

## Results
| Check | Result | Evidence |
|---|---|---|
| **India basemap engine (MapLibre 6.6.0 + module worker + canvas)** | **PASS** | Run A: `load` fired, canvas 1280×720, zero errors, in real headless Chromium using the bundled build. The library/worker/canvas are **not** broken. |
| **Diagnostic marker (one hardcoded, standalone only, never written to DB)** | **PASS** | Run A: `#diag-marker` present in the DOM after `load`. Marker rendering works. |
| **Basemap renders with ZERO clinic coordinates** | **PASS (engine)** | Run A has no sources/markers and still paints — tiles/markers are independent of the basemap. The app change below makes this visible on the Dashboard too. |
| **Basemap actually paints in the authenticated preview** | **NOT VERIFIED** | Can't reach the preview/OSM from here; needs the Chrome checks. |

## Root cause of the "blank map"
Two independent causes, now both addressed or explained:

1. **(App defect — fixed) The Dashboard suppressed the basemap entirely when there are no coordinates.** `IndiaClinicNetwork` rendered a "No clinic has been pinned yet" card *instead of* the map whenever `branchesOnMap === 0` — which is always true today (0 coordinates). So on `/admin` the India basemap was **never rendered at all**, reading as a blank/absent map. **Fix:** the basemap now always renders; the pinning guidance is a non-blocking overlay on top of it. This satisfies "preserve the zero-coordinate state, but ensure the underlying India map can still render."

2. **(Environment — explains a grey canvas) For a raster-only style, MapLibre's `load` does not fire until tiles load.** Run B proves that: with tiles unreachable, `load` never fires and 28 tile errors are raised. In the app this means an unreachable OSM tile host leaves a grey canvas; the app's `error` handler (plus the 15s timeout added earlier) flips `/admin/network` to the honest **"Basemap unavailable"** fallback rather than a silent blank. Whether OSM tiles actually reach the *authenticated preview browser* is **NOT VERIFIED** (can't test from here) — if they don't, the fix is a reachable tile host (an `NEXT_PUBLIC_MAP_STYLE_URL` override already exists for that), **not** a code change, and provider choice needs the browser evidence first.

## Minimal fix shipped
- `IndiaClinicNetwork`: render the India basemap even at zero coordinates, with the "nothing pinned" message as a pointer-events-safe overlay (no map replacement, no invented coordinates).
- (earlier) `NetworkMap`: 15s bounded load-timeout + `resize()`/ResizeObserver + console diagnostics, so a stuck worker or zero-size canvas degrades honestly instead of a silent blank.
- No MapLibre downgrade, no provider change, no new filters/features.

## What to confirm in Chrome on the preview `/admin/network`
Console for `[NetworkMap]` warnings; Network filtered to `tile.openstreetmap.org` (are tiles 200 or blocked?); Elements for `.maplibregl-canvas` sizing. If tiles are blocked there, set `NEXT_PUBLIC_MAP_STYLE_URL` to a reachable tile/style source — no code change needed.

---

## Seven-clinic production coordinate-readiness inventory (read-only)
Production `pykoyxbleowxwechotth`. **None of the 7 clinics has any location record at all** — so there is no address to geocode and nothing to pin yet. Coordinate readiness: **0 / 7**.

| Clinic | Locations | Coordinates | City/State on file | Readiness |
|---|--:|--:|---|---|
| Acube Aesthetics | 0 | 0 | — | Needs address |
| Tressze Clinic | 0 | 0 | — | Needs address |
| Bala Clinic | 0 | 0 | — | Needs address |
| Radiance Skin Hair Cosmetic Center | 0 | 0 | — | Needs address |
| Dr. Aggarwal's Clinic | 0 | 0 | — | Needs address |
| Dr. Sumit Ahuja — Online Hair Consultation | 0 | 0 | — | Needs address |
| GH Derma Center | 0 | 0 | — | Needs address |

(Staging, by contrast, has 17 branch addresses with city+state but 0 coordinates — those are geocode/pin candidates; production has neither.)

## Safe coordinate-enrichment workflow (explicit approval before any write)
No database writes are performed by this task. Proposed, approval-gated process:
1. **Collect structured addresses first** (production has none). A clinic with no address cannot be geocoded or pinned.
2. For each clinic with a **complete** address, present a **candidate** coordinate (human pin in the clinic location picker, or a geocoder result shown for confirmation) — **one at a time, for human approval**, writing nothing until approved.
3. **Never** infer a position from a city/state name; **never** overwrite an existing coordinate; run any batch helper **staging-only, behind the DB-target guard**, writing only approved candidates.
4. Real clinic statuses and patient data are untouched throughout.
