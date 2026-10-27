# HairOS Super Admin — P0 Stabilization Report

**Scope:** Correct clinic status, India map, and test-data visibility on the
Super Admin command centre (PR #39 lineage).
**Environments inspected (read-only):** Staging `vbkoupvduadmcxggtnsb`, Production `pykoyxbleowxwechotth`.
**Guardrails honored:** No database writes, no deletes, no migrations, no schema
change applied, no production deploy, no changes to PR #36/#37/#38, real clinic
statuses untouched. All database access was read-only `SELECT`.

> Delivered on branch `claude/nifty-gauss-i4e1qk`, based on the PR #39 head
> (`claude/superadmin-command-centre-v2`). See "Branch & PR note" at the end.

---

## 1. Root-cause report — the three reported problems

### Problem 1 — "Clinics that never launched appear ACTIVE"
**Root cause (confirmed in data):** every one of the 16 staging clinics has
`Clinic.status = 'ACTIVE'` and none is soft-deleted. `status = ACTIVE` is only a
database-enablement fact; it is **not** evidence that a clinic has launched,
that a doctor can log in, or that the end-to-end path works. The original
dashboard rendered `ACTIVE` as if it meant "live", so unlaunched and test
clinics read identically to real, operating ones.

**State of the fix:** PR #39 already separates the concepts correctly in
`lib/admin/readiness.ts`:

| Concept | Source of truth | Today in staging |
|---|---|---|
| Database enabled | `Clinic.status = ACTIVE` && not deleted | 16 / 16 |
| Doctor access provisioned | active doctor with `supabaseUserId`/`supabasePhoneUserId` | 3 / 16 clinics |
| Rollout stage | **no reliable source exists** | shown as not-verified |
| Golden-path verification | **no verification record exists in schema** | "Verification pending" for all |
| Operational readiness | derived from the above, never from activity rows | pending for all |

The dashboard never labels a clinic "operationally verified" from an `ACTIVE`
status or from the presence of assessments/reports. Where no rollout-stage
source exists it shows **"Verification pending"** rather than inventing a stage —
exactly the behavior the task asks for. A durable rollout-stage field is
**proposed, not applied** (see `SCHEMA_CHANGE_PROPOSALS.md`).

### Problem 2 — "India network shows 16 clinics, 0 pinned, map blank"
**Root cause (confirmed in data):** of 17 `ClinicLocation` rows, **0 have
coordinates** (`latitude/longitude` null; `geoStatus` PINNED = 0, GEOCODED = 0).
All 17 rows *do* carry a city and state across 6 states. So:

- "16 clinics, 0 pinned, 0 geocoded, no coordinates recorded" is **accurate** —
  the data genuinely has no coordinates. It is not a rendering bug in the data layer.
- The map is correctly designed to **never infer a position from a city/state
  name** (`isMappable()` + `isDrawableCoordinate()`), so with zero coordinates
  there is nothing legitimate to plot.

**What was actually wrong / fragile, and the fix:**
- On the **Dashboard**, `IndiaClinicNetwork` shows an honest *"No clinic has been
  pinned yet"* panel instead of the map when `branchesOnMap === 0` — so the
  Dashboard never showed a blank canvas; it explains the gap and links to where
  pins are added. Verified in code.
- On the **full `/admin/network` page**, the MapLibre canvas renders the OSM
  India basemap regardless of markers; with 0 markers it shows India with no
  pins (not truly "blank"). If OSM tiles are blocked in the authenticated
  browser, the component degrades to a labelled *"Basemap unavailable"* state and
  still lists every clinic. Whether tiles actually paint in the authenticated
  browser is **NOT VERIFIED** (no authenticated browser session available in
  this environment) — see §5.
- Clinics without coordinates already appear in an actionable off-map
  **"Not on the map"** list with a reason and an *"Add a pin"* link.

The basemap definition (`lib/admin/network/basemap.ts`) uses public OSM raster
tiles with no API key, so there is no credential-expiry failure mode.

### Problem 3 — "Historical test/demo data and real rollout records are mixed"
**Root cause:** there was **no classification at all**. Staging carries explicit
QA/demo clinics (one with 62 synthetic patients and 67 assessments) counted
side-by-side with real rollout clinics in every overview metric and in the
network view. **This is the one genuinely missing capability**, and the bulk of
this change set addresses it (§3).

---

## 2. Clinic inventory — staging vs production

### Staging `vbkoupvduadmcxggtnsb` — 16 clinics, all ACTIVE, 17 locations, 0 coordinates
| Clinic | Slug | Doctors | Access-ready docs | Patients | Assessments | Class |
|---|---|--:|--:|--:|--:|---|
| DrFACT Mumbai Test Clinic | `drfact-mumbai-test` | 5 | 3 | 62 | 67 | **TEST** |
| DrFACT Pune Test Clinic | `drfact-pune-test` (id `staging-qa-clinic-b`) | 1 | 1 | 0 | 0 | **TEST** |
| DrFACT Mumbai | `drfact-mumbai` | 2 | 0 | 33 | 33 | **UNCERTAIN** |
| GH Derma Center | `gh-derma-center` | 1 | 0 | 0 | 0 | real |
| Radiance Skin Hair Cosmetic Center | `radiance-skin-hair-cosmetic-center` | 1 | 0 | 0 | 0 | real |
| Reniu Clinic | `reniu-clinic` | 1 | 0 | 0 | 0 | real |
| Therapeia Skin Hair & ENT Centre | `therapeia-skin-hair-ent-centre` | 1 | 0 | 0 | 0 | real |
| Skin Saga Centre for Dermatology | `skin-saga-centre-for-dermatology` | 1 | 0 | 1 | 1 | real |
| Yavana Skin & Hair Clinic | `yavana-skin-hair-clinic` | 1 | 0 | 0 | 0 | real |
| SKYE - Skin & Hair Sciences Clinics | `skye-skin-hair-sciences-clinics` | 1 | 0 | 0 | 0 | real |
| Derma Klinic | `derma-klinic` | 1 | 0 | 0 | 0 | real |
| Aesthetiq Clinic | `aesthetiq-clinic` | 1 | 0 | 0 | 0 | real |
| Dr. Gitte's Dermaworld Clinic | `dr-gitte-dermaworld-clinic` | 1 | 0 | 0 | 0 | real |
| Skin Nirvana Cosmetic Clinic | `skin-nirvana-cosmetic-clinic` | 1 | 0 | 0 | 0 | real |
| Tender Skin International | `tender-skin-international` | 1 | 0 | 0 | 0 | real |
| Acube Aesthetics | `acube-aesthetics` | 1 | 1 | 5 | 5 | real |

Only **3 of 16** clinics have an access-ready (provisioned) doctor, and two of
those three are the test clinics. Most real clinics are registered shells with a
single unprovisioned doctor and no patients — i.e. **not launched**, which is
exactly what the ACTIVE flag was masking.

### Production `pykoyxbleowxwechotth` — 7 clinics, all ACTIVE, 0 locations, 0 coordinates
Acube Aesthetics, Tressze Clinic, Bala Clinic, Radiance Skin Hair Cosmetic
Center, Dr. Aggarwal's Clinic, Dr. Sumit Ahuja — Online Hair Consultation, GH
Derma Center. 7 doctors, 15 patients, 15 assessments. **No test/demo markers
detected — production is clean of test data.** Production also has **0
`ClinicLocation` rows**, so production has no addresses or coordinates yet
either (a separate rollout gap, noted for the launch checklist).

**Tenant isolation:** staging and production are distinct Supabase projects with
distinct refs. The environment badge (§P0-E) is derived server-side from
`DATABASE_URL`, so production data cannot surface under a staging label or vice
versa, and the label cannot be flipped by the client.

---

## 3. Test/demo data classification (P0-C) — the main change

New pure module `lib/admin/testData.ts` (`classifyClinicDataClass`) classifies
each clinic **from explicit markers only**:

- **TEST** — a whole-word token (`test`, `qa`, `demo`, `sandbox`, `sample`,
  `dummy`, `fixture`, `example`, `staging`, `seed`) in the slug/name, **or** a
  seeded-id prefix (`staging-qa-`, `test-`, `demo-`, `seed-`, `qa-`). Tokens are
  matched on word boundaries, so `latest`/`aqua` are never mis-flagged.
- **UNCERTAIN** — a first-party brand token (`drfact`, `hairos`) with no test
  marker. Surfaced for a human to decide; **never** auto-excluded and never
  auto-marked real. This is the guardrail "do not guess from names alone when
  records are ambiguous."
- **REAL** — everything else.

Applied to staging: **2 TEST, 1 UNCERTAIN, 13 REAL**. Applied to production:
**0 TEST, 0 UNCERTAIN, 7 REAL**.

**How it's wired (all read-only — no row is altered):**
- `/api/admin/network` excludes confirmed-TEST clinics **by default** from the
  map, state rollup, off-map list and counts; `?includeTest=1` opts them back
  in. The response also reports `dataClasses` (full-network tally) and
  `excludedTestClinics`.
- Both network views (`IndiaClinicNetwork` on the Overview and the full
  `/admin/network` page) gained a **"Show / hide test/demo"** toggle — the
  explicit staging test-data filter the task requires — plus a line stating how
  many test/demo clinics are excluded and how many are unclassified.
- `/api/admin/dashboard` adds `clinicsReal`, `clinicsTestDemo`, `clinicsUncertain`
  (existing `clinicsTotal`/`clinicsActive` are untouched for other consumers).
  The Overview's "Total clinics" tile now reads e.g. **"14 real · 2 test/demo"**.

**No deletion was performed.** If cleanup is later wanted, a deletion-impact
report and exact record list must be produced for separate approval — see the
launch checklist. Patient/medical records are never in scope for deletion.

---

## 4. Corrected clinic-readiness & directory presentation (P0-A / P0-D)
- Readiness tiers (`lib/admin/readiness.ts`) keep DATABASE ACTIVE, ACCESS READY
  (provisioned ≠ logged-in) and OPERATIONALLY VERIFIED strictly separate, with
  the operational tier fixed at "Verification pending" because no trustworthy
  golden-path record exists. Unit-tested.
- The clinic directory (`/admin/clinics`, Phase 3) already presents clinic +
  location, primary doctor, access readiness, last assessment, action and a
  view link, with QR/onboarding/WhatsApp detail in the expanded view — matching
  the P0-D layout. No regression introduced here.

---

## 5. India map rendering evidence (P0-B)
- **Data layer:** `/api/admin/network` returns 16 clinics, 0 branches on map,
  16 off-map, with per-clinic reasons ("No coordinate — needs a map pin"). This
  is correct given 0 coordinates in the database.
- **Basemap:** built inline from public OSM raster tiles, no API key; opens on
  continental India bounds. On tile failure the component shows a labelled
  "Basemap unavailable" fallback and still lists clinics.
- **Authenticated browser render:** **NOT VERIFIED.** This environment has no
  logged-in Super Admin browser session, so whether OSM tiles actually paint
  in the authenticated preview, and before/after screenshots, must be captured
  on the staging preview by a human (or an authenticated browser run). The code
  paths above are verified by reading and by the passing `admin-network` suite.

---

## 6. Coordinate completion workflow (P0-B)
See `COORDINATE_COMPLETION_WORKFLOW.md`. Summary: coordinates are supplied only
by (a) a human pin in the clinic location picker, or (b) a geocoder resolving a
complete structured address with explicit human confirmation before write.
Positions are **never** inferred from a city name, and stored coordinates are
**never** auto-overwritten. No automated geocoding is run by this change.

---

## 7. Before / after
- **Before:** 16 ACTIVE clinics (incl. 2 QA + 1 demo) counted as one undifferentiated
  "active" set; test patients/assessments inflated every total; network view
  mixed test and real clinics; no environment indicator.
- **After (staging preview):** real vs test/demo split on the Overview; network
  map and counts exclude confirmed test by default with an explicit filter to
  show them; a persistent server-derived STAGING/PRODUCTION badge in the header;
  readiness honestly "Verification pending".
- **Screenshots:** BEFORE/AFTER to be captured on the authenticated staging
  preview (NOT VERIFIED here — see §5).

---

## 8. Automated test & regression results
- **Typecheck:** `tsc --noEmit` on the app — **0 errors.**
- **ESLint:** touched files — **clean (0 findings).**
- **Vitest (full suite):** baseline `14 failed / 2738 passed`; after changes
  `14 failed / 2752 passed` — **+14 new passing tests, 0 new failures.** The 14
  pre-existing failures are clinical-engine/assistant files unrelated to this
  work and are identical with the changes stashed. (The 58 "failed files" count
  is the pre-existing vitest/jest runner split — jest-authored files collected by
  vitest and vice-versa — not assertion failures.)
- **Jest:** `tests/api/admin-network.test.ts` — **17/17 passing** with the
  network-snapshot changes.
- **New tests:** `tests/admin/test-data.test.ts` (9, incl. the real staging
  identities and no-substring-false-positive cases) and 5 added cases in
  `tests/env/database-target.test.ts` for the environment label.

---

## 9. Environment clarity (P0-E)
`resolveEnvironmentLabel()` (in `packages/shared/env/databaseTarget.ts`) derives
STAGING / PRODUCTION / LOCAL / UNKNOWN from the server-side `DATABASE_URL`
project ref (the authoritative data target), reusing the same refs the existing
write-guard uses. It flags a `split` configuration (DB and storage on different
projects). The admin layout resolves it server-side and renders a persistent
header badge — red for PRODUCTION, amber for STAGING. It is not client-settable.

---

## Branch & PR note
Per the session's branch policy, work is delivered on
`claude/nifty-gauss-i4e1qk` (based on the PR #39 head) rather than pushed
directly onto `claude/superadmin-command-centre-v2`. A draft PR is opened
against the same base as PR #39. To land these changes **into PR #39** instead,
fast-forward/merge this branch into `claude/superadmin-command-centre-v2` with
explicit authorization. **No production promotion** — stop here pending review.
