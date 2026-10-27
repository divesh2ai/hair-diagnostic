# Safe coordinate completion workflow

**Current state:** staging has 17 `ClinicLocation` rows, **0 with coordinates**
(0 pinned, 0 geocoded); all carry a city + state. Production has **0**
`ClinicLocation` rows at all. The map plots only real coordinates and never
infers a position from a city/state name, so clinics stay in the off-map
"Location missing" list until a coordinate is supplied.

## Principles (enforced by existing code — do not relax)
1. A coordinate is written **only** when a human pins a branch, or a geocoder
   resolves a **complete structured address** that a human then confirms.
2. Positions are **never** inferred from a city or state name alone.
3. Stored coordinates are **never** automatically overwritten.
4. Nothing in this stabilization change writes any coordinate.

## Recommended operator workflow (no new code required)
1. Open `/admin/network` → the **"Not on the map"** list shows every clinic with
   no coordinate and an **"Add a pin"** link to its clinic edit page.
2. In the clinic location picker (`ClinicLocationsPanel`), the operator either:
   - **drops a pin** on the branch's real premises (→ `geoStatus = PINNED`), or
   - enters the **full structured address** and accepts the geocoder's result
     after visually confirming it (→ `geoStatus = GEOCODED`, drawn dashed to
     mark it as derived).
3. The branch then appears on the map; the off-map list shrinks.

## Optional future helper (proposal — not built, not run)
A server-side, opt-in geocoding script could pre-resolve complete addresses and
stage candidate coordinates for **human review**, writing nothing until an
operator approves each. It must:
- run against **staging only**, behind the existing database-target guard;
- skip any address that is not complete and structured;
- **never** overwrite an existing coordinate;
- present each candidate with the address it was derived from for confirmation.

This is deferred; raise it as a separate task if the pin-by-hand path proves too
slow at scale.
