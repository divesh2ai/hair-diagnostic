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

### Gap 3 — Confirmed test/demo excluded by default (KPIs + network) + working toggle — **PASS (logic)** / **NOT VERIFIED (rendered)**
- **PASS (logic):**
  - Classifier unit tests (`tests/admin/test-data.test.ts`, 9) prove the real staging set splits into **2 test / 1 uncertain / 13 real** and that `isConfirmedTest` is true only for `drfact-mumbai-test` and `drfact-pune-test`.
  - Network snapshot tests (`tests/api/admin-network.test.ts`, 20) prove the data layer **excludes the confirmed-test clinic by default**, **brings it back with `includeTestClinics`**, and **never excludes an uncertain clinic**.
  - **Default KPIs now exclude test (new this round):** `/api/admin/dashboard` scopes every real-business count — clinics, doctors, patients, assessments (today/month/total), doctors-access-ready, clinics-access-ready and the health window — with `clinicId NOT IN [testIds]` (or `id NOT IN` for clinics), computed from the shared classifier. `tests/api/admin-dashboard-testdata.test.ts` (3) proves the scoping is applied and reports `clinicsTestDemo` + the true `clinicsAllIncludingTest`. The pre-existing dashboard suite (`admin-p0-correctness`, 17) still passes because the scope spreads to nothing when no test clinic exists. This directly removes the inflation (the one test clinic's 62 patients / 67 assessments / provisioned QA doctors no longer count toward real-business KPIs).
  - `/api/admin/network` default-excludes test and honors `?includeTest=1`.
- **NOT VERIFIED (rendered):** that on the preview the Overview tiles show the real-business figures (e.g. "Clinics (real)" = 14, "Patient assessments" excludes the 67 test ones) with the "N test/demo excluded" note, and that the network **Show/hide test/demo** toggle flips the map/counts.

### Gap 4 — India basemap actually renders, independent of missing coordinates — **NOT VERIFIED** (must be confirmed in Chrome)
Corrected: this is **not** PASS. Code inspection cannot prove pixels painted, and the reported *blank canvas* on `/admin/network` may be a real paint failure, not the intended zero-marker empty state. The two are genuinely different and must be told apart in the browser.

- **What the two states look like:**
  - *Intended empty state* — basemap of India paints, **no markers** (because 0 coordinates). Correct.
  - *Paint failure* — grey/blank tile area, or the **"Loading map…" overlay stuck forever**.
- **Leading hypothesis (from code, to confirm):** in `NetworkMap.tsx`, `status` starts `"loading"` and only becomes `"ready"` on MapLibre's `load` event; the `"failed"` fallback only shows on an `error` event. If `load` **never fires** (e.g. the MapLibre **6.6.0** web worker fails to initialise under the Next/Vercel bundle, a known class of issue), the panel shows **"Loading map…" over a blank box indefinitely** with no error — which reads exactly as "canvas appears blank." Blocked OSM tiles, by contrast, usually still fire `load` (grey tiles) or `error` (→ "Basemap unavailable" fallback).
- **Exact checks to run on the preview `/admin/network` (Chrome DevTools):**
  1. **Console** — any `maplibre` / worker errors (e.g. failed worker URL, CSP)? 
  2. **Network** (filter `tile.openstreetmap.org`) — are tile requests firing at all, and what status (200 / blocked / 4xx)?
  3. **Elements** — does the map container have non-zero width/height? Is the `.maplibregl-canvas` present and sized, or is the `"Loading map…"` overlay still mounted?
  4. Confirm whether markers *could* render (they won't here — 0 coordinates — which is correct).
- **Independent isolation provided:** `basemap-selfcheck.html` now pins **the same MapLibre 6.6.0**, the same style/bounds/options as the app, no markers by default (mirrors staging), surfaces tile/worker errors and a 15s stuck-`load` detector, and a button to prove marker rendering. If it paints standalone but the app does not, the fault is app/bundle-specific (worker packaging), not OSM or the map config.
- **Candidate fix (ready, NOT applied — pending browser confirmation):** add a load-timeout in `NetworkMap` that flips `status` to `"failed"` when `load` hasn't fired (so a stuck worker degrades to the honest "Basemap unavailable" + clinic list instead of a silent blank), and/or pin the MapLibre worker asset for the Next build. Held because the task says verify the real failure in-browser before further map changes.

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
| 3 Test/demo exclusion from KPIs + network + toggle | PASS (logic) · NOT VERIFIED (rendered) |
| 4 India basemap renders | **NOT VERIFIED** — must confirm in Chrome; blank canvas may be a real paint failure |
| 5 No-coordinate list + process | PASS |
| 6 Real ≠ operationally Live | PASS |

**No FAILs found, but gap 4 is explicitly unproven and possibly a defect.** Remaining NOT VERIFIED items require a logged-in Super Admin session on the preview — stopped before any production change as instructed.

---

## Supabase redirect allowlist — exact PR #40 callback URL
Google sign-in sets `redirectTo = ${origin}/auth/callback?next=<path>` (`src/app/login/page.tsx`) and the server callback is `src/app/auth/callback/route.ts`. For the PR #40 preview the **exact callback URL to allowlist in Supabase → Authentication → URL Configuration → Redirect URLs** (staging project `vbkoupvduadmcxggtnsb`) is:

```
https://hairos-git-claude-nifty-gauss-i4e1qk-diveshs-projects-6230f270.vercel.app/auth/callback
```

Because the `?next=` query varies, add the wildcard form so every return path matches:

```
https://hairos-git-claude-nifty-gauss-i4e1qk-diveshs-projects-6230f270.vercel.app/**
```

(The Google Cloud OAuth client's *Authorized redirect URI* — `https://vbkoupvduadmcxggtnsb.supabase.co/auth/v1/callback` — is provider/project-wide and normally already set; the per-preview item that typically blocks login is the Supabase **Redirect URLs** allowlist above. This branch's Vercel alias is stable, so this URL won't change for PR #40.)

---

## Remaining blockers to a production-ready dashboard
1. **Map paint (gap 4) — unproven, potential defect.** Confirm in Chrome whether the basemap paints or is stuck; if stuck, apply the ready candidate fix (load-timeout fallback + MapLibre 6.6.0 worker packaging). **Blocker.**
2. **Authenticated acceptance (gaps 1–3 rendered).** Needs the Supabase redirect URL above allowlisted, then a Super Admin Google login on the preview to confirm routing, the STAGING badge, the real-business KPIs and the test/demo toggle. **Blocker to sign-off, not to code.**
3. **No verified coordinates → empty map is expected, not fixed.** 0 of 17 staging locations (and 0 production locations) have coordinates. Until operators pin real coordinates (approval-based process, gap 5), the map legitimately shows no pins. **Launch-content blocker, not a code bug.**
4. **No durable rollout-stage / verification source (P0-A).** Clinics still read only DATABASE ACTIVE + "Verification pending"; LIVE is not representable. Needs Proposal A/B (`SCHEMA_CHANGE_PROPOSALS.md`) — **approval required**, not applied.
5. **Production has 0 ClinicLocation rows and 7 clinics with no coordinates** — production rollout data is incomplete (separate from this staging PR).
6. **Durable `isTestData` flag (Proposal C)** would remove reliance on name/slug/id heuristics for the one *uncertain* clinic (`drfact-mumbai`). Classifier handles it conservatively today; a flag is stronger. **Approval required.**

None of these were changed in production; no data was written, no status altered, no migration run, no PR merged.
