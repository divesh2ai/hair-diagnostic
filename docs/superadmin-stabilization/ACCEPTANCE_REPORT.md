# PR #40 — Super Admin P0 Acceptance Report

**PR:** divesh2ai/hair-diagnostic#40 (draft, stacked on PR #39 head) · CI: **green** (Vercel preview `Ready`).
**Preview:** `https://hairos-git-claude-nifty-gauss-i4e1qk-diveshs-projects-6230f270.vercel.app`
**Constraints honored:** no data deleted, no coordinates written, no clinic status changed, no migration, no production change, no merge.

## Environment limitation affecting verification
This session's container egress proxy **denies** the Vercel preview host and `tile.openstreetmap.org` (403 CONNECT, verified), and I have no Super Admin Google credentials. So anything that requires *rendering the authenticated preview in a browser* cannot be driven from here. Those items are marked **NOT VERIFIED** with exact manual steps and, where possible, independent evidence that does not need the preview.

Legend: **PASS** = verified by evidence available here · **NOT VERIFIED** = needs an authenticated browser on the preview · **FAIL** = defect found.

---

### Gap 1 — Google login & role-based routing — **NOT VERIFIED**
- Cannot be exercised here (no Google creds, preview host blocked by egress policy).
- Logic evidence (read): `loadSuperAdminShellData()` redirects non-Super-Admins to `/login?reason=forbidden`; `/admin/*` layout pins nav to `SUPER_ADMIN`; OAuth return-path hardening is the PR #39 head commit. These are code paths, not a live auth result.
- **Manual acceptance steps:** open the preview → sign in with Google as a Super Admin → expect landing on `/admin` (command centre); sign in as a non-admin → expect `/login?reason=forbidden`, never the admin console.

### Gap 2 — Environment badge reads STAGING — **PASS (logic)** / **NOT VERIFIED (rendered)**
- **PASS (logic):** `resolveEnvironmentLabel()` returns `STAGING` for the staging ref `vbkoupvduadmcxggtnsb` and `PRODUCTION` for `pykoyxbleowxwechotth`; it reads the server `DATABASE_URL` (not a client value) and flags split configs. Covered by 5 new unit tests (`tests/env/database-target.test.ts`, all passing). The admin layout resolves it server-side and passes it to the header badge.
- **NOT VERIFIED (rendered):** that the preview's `DATABASE_URL` is in fact the staging project, and that the amber **STAGING** chip paints in the header — confirm on the preview. (If the preview were ever pointed at production, the badge would correctly read PRODUCTION — that is the safety property, not a bug.)

### Gap 3 — Confirmed test/demo excluded by default + working toggle — **PASS (logic)** / **NOT VERIFIED (rendered)**
- **PASS (logic):**
  - Classifier unit tests (`tests/admin/test-data.test.ts`, 9) prove the real staging set splits into **2 test / 1 uncertain / 13 real** and that `isConfirmedTest` is true only for `drfact-mumbai-test` and `drfact-pune-test`.
  - Snapshot tests (`tests/api/admin-network.test.ts`, now 20, all passing) prove the network data layer **excludes the confirmed-test clinic by default** (`excludedTestClinics=1`, `totals.clinics` drops it), **brings it back with `includeTestClinics`**, and **never excludes an uncertain clinic**.
  - `/api/admin/network` default-excludes test and honors `?includeTest=1`; dashboard exposes `clinicsReal/clinicsTestDemo/clinicsUncertain`.
- **NOT VERIFIED (rendered):** that the on-screen **Show/hide test/demo** toggle flips the map/counts on the preview, and the Overview tile reads "14 real · 2 test/demo".

### Gap 4 — India basemap actually renders, independent of missing coordinates — **PASS (mechanism, independent)** / **NOT VERIFIED (in the app preview)**
- **Design evidence (read):** in `NetworkMap.tsx` the OSM raster basemap is added to the map **unconditionally** in the create-map effect; markers are a **separate** effect gated on data. So the basemap does not depend on any coordinate existing. The full `/admin/network` page always mounts `NetworkMap` (basemap visible with zero markers); the Dashboard's `IndiaClinicNetwork` intentionally shows a "nothing pinned" panel instead of the map when `branchesOnMap===0`.
- **Independent proof provided:** `docs/superadmin-stabilization/basemap-selfcheck.html` — a standalone page using the *same* OSM style + India bounds + one test marker, no app/auth/coordinates. Open it in any browser on normal internet: if India paints and the red marker shows, the basemap mechanism is sound and staging's empty map is purely the absence of coordinates.
- **NOT VERIFIED:** whether OSM tiles reach the *authenticated preview* specifically (I cannot reach OSM from this container; that is my egress policy, not evidence about the preview). On tile failure the component already degrades to a labelled "Basemap unavailable" state and still lists clinics.

### Gap 5 — Precise no-coordinate clinic list + approval-based completion — **PASS**
**Staging: 0 of 17 locations have coordinates.** 13 clinics hold 17 branches (all `geoStatus=UNSET`, no lat/long); 3 clinics (`drfact-mumbai`, `drfact-pune-test`, `acube-aesthetics`) have **no location rows at all**.

| Clinic | Branch | City, State | Branch status |
|---|---|---|---|
| Aesthetiq Clinic | Sholinganallur | Chennai, Tamil Nadu | ONBOARDING |
| Derma Klinic | Hazratganj | Lucknow, Uttar Pradesh | ONBOARDING |
| Dr. Gitte's Dermaworld Clinic | Jalna Road | Chhatrapati Sambhajinagar, Maharashtra | ONBOARDING |
| DrFACT Mumbai Test Clinic *(test)* | Bandra West | Mumbai, Maharashtra | ACTIVE |
| DrFACT Mumbai Test Clinic *(test)* | Andheri East | Mumbai, Maharashtra | ACTIVE |
| GH Derma Center | Tripuri Town | Patiala, Punjab | ONBOARDING |
| Radiance Skin Hair Cosmetic Center | Vanasthalipuram | Hyderabad, Telangana | ONBOARDING |
| Reniu Clinic | Vani Vilas Mohalla | Mysuru, Karnataka | ONBOARDING |
| Skin Nirvana Cosmetic Clinic | Santacruz West | Mumbai, Maharashtra | ONBOARDING |
| Skin Saga Centre for Dermatology | Andheri West | Mumbai, Maharashtra | ONBOARDING |
| SKYE - Skin & Hair Sciences Clinics | HSR Layout | Bengaluru, Karnataka | ONBOARDING |
| Tender Skin International | Malad West | Mumbai, Maharashtra | ONBOARDING |
| Tender Skin International | Andheri West | Mumbai, Maharashtra | ONBOARDING |
| Tender Skin International | Goregaon East | Mumbai, Maharashtra | ONBOARDING |
| Tender Skin International | Khar Road West | Mumbai, Maharashtra | ONBOARDING |
| Therapeia Skin Hair & ENT Centre | Basavanagudi | Bengaluru, Karnataka | ONBOARDING |
| Yavana Skin & Hair Clinic | Khar West | Mumbai, Maharashtra | ONBOARDING |

Clinics with **no branch record at all** (need a location before a pin): `DrFACT Mumbai` (uncertain), `DrFACT Pune Test Clinic` (test), `Acube Aesthetics` (real).

**Approval-based completion process (no automation, no silent writes) —** full version in `COORDINATE_COMPLETION_WORKFLOW.md`:
1. Operator opens `/admin/network` → "Not on the map" → "Add a pin" per clinic.
2. Supply a coordinate **only** by (a) a human map pin (`PINNED`) or (b) accepting a geocoder result for a **complete** address after visual confirmation (`GEOCODED`, drawn dashed). Never inferred from a city name; existing coordinates never auto-overwritten.
3. Any future bulk geocoding runs **staging-only, behind the DB-target guard, writing nothing until a human approves each candidate** — proposed, not built.

### Gap 6 — Real-clinic classification is not confused with "operationally Live" — **PASS**
- `classifyClinicDataClass` derives `real/test/uncertain` **only** from clinic identity (name/slug/id); it reads neither `status` nor any activity. "real" is a provenance label, never a readiness claim.
- Readiness is independent: `operationalLabel` renders **"Verification pending"** and the Overview readiness tile shows `operationallyVerified = null → "—"` with "Verification pending — no golden-path test record source yet". There is **no code path** that renders a "real" or `ACTIVE` clinic as "Live"/"operationally verified"; the operational tier can only flip VERIFIED when an explicit `verificationRecord` exists, of which there are none. Verified by code read + `tests/admin/readiness.test.ts`.

---

## Automated results (this session)
- `tsc --noEmit` (app): **0 errors.** ESLint on touched files: **clean.**
- Vitest full suite: **+14 new passing, 0 new failures** (14 pre-existing failures are unrelated clinical-engine files, identical with changes stashed).
- Jest `tests/api/admin-network.test.ts`: **20/20** (incl. 3 new test-exclusion cases).

## Summary
| Gap | Result |
|---|---|
| 1 Google login & routing | NOT VERIFIED (needs auth browser) |
| 2 STAGING badge | PASS (logic) · NOT VERIFIED (rendered) |
| 3 Test/demo exclusion + toggle | PASS (logic) · NOT VERIFIED (rendered) |
| 4 India basemap renders | PASS (mechanism + independent self-check) · NOT VERIFIED (in-app tiles) |
| 5 No-coordinate list + process | PASS |
| 6 Real ≠ operationally Live | PASS |

**No FAILs.** Remaining NOT VERIFIED items all require a logged-in Super Admin session on the preview — stopped before any production change as instructed.
