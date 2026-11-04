# HairOS Phase 1 — Super Admin Operations completion

Scope: complete (not rebuild) the existing Super Admin Operations implementation
integrated from PR #51 into the consolidated release candidate PR #52.

- Base: PR #52 head `a697a503405e2ccceb5eb80a109edf1e1c53b1c6`
  (`codex/phase-1-integrated-rc`, itself based on `claude/acube-launch-fix`).
- Working branch: `claude/zen-wright-dfs5vt`.
- PR target: `codex/phase-1-integrated-rc` (the consolidated release candidate).
- Production DB (read-only verification): `drfact-hairos-production`
  (`pykoyxbleowxwechotth`).

This change is deliberately small. The operations control centre, clinic
drilldown, doctor-access visibility, and the honest clinical/report semantics
already shipped in PR #51/#52. The remaining work was information architecture
alignment to the Phase 1 spec and a read-only production reconciliation.

---

## What changed in this branch

1. **Navigation aligned to the Phase 1 spec.** The Super Admin sidebar now leads
   with the four primary jobs — **Overview**, **Clinics**, **Doctors & Access**,
   **Operations & Reports** — followed by one grouped **Settings & Audit** shelf
   (Clinical Governance, Audit & Security, Support, Platform Settings).
   - `src/lib/navigation/nav.ts` — restructured `NAV_SUPER_ADMIN`.
   - `src/lib/i18n/types.ts` + all 7 locale files — added `nav.overview`,
     `nav.doctorsAccess`, `nav.operationsReports`, `nav.sectionSettingsAudit`
     (translated per locale).
   - `src/app/admin/people/page.tsx` — heading renamed to "Doctors & Access"
     with an onboarding-blocker subtitle; the broader account directory is
     preserved.
   - `tests/admin/super-admin-nav.test.ts` — contract test updated to lock the
     new IA.
2. **India Network confirmed out of Phase 1 navigation.** `/admin/network` and
   its launch-readiness surface are not linked from the Super Admin nav and are
   not referenced in any launch-readiness calculation for Phase 1. The route and
   its code are left untouched (no deletion), simply unlinked. The nav contract
   test now asserts `/admin/network` is never a top-level destination.

No application rebuild. No production writes. No auth/identity changes. No schema
migrations. The clinic-management actions, the clinical engine, Super Admin
Google login, server-side `assertSuperAdmin()` authorization, doctor clinic
isolation, and existing production clinic records are all unchanged.

---

## Production KPI reconciliation (READ-ONLY)

Verified `2026-11-04` against `drfact-hairos-production` with SELECT-only SQL,
mirroring the exact definitions in `src/lib/admin/opsDashboard/metrics.ts`,
`classify.ts`, and `capabilities.ts`. No writes were issued.

### Global KPIs

| KPI | Definition (dashboard) | Production value |
| --- | --- | --- |
| Registered clinics | `Clinic` where `deletedAt IS NULL` | **11** |
| Actively using (operational) | signed-in doctor + assessments + ≥1 approval + activity ≤30d | **4** |
| Doctors onboarded | `Doctor` rows (`deletedAt IS NULL`) | **11** |
| Doctors signed in | `auth.users.last_sign_in_at IS NOT NULL` | **5** |
| Assessments (all-time) | `Assessment` `deletedAt IS NULL` | **28** |
| Completed assessments | `Assessment.status = COMPLETED` | **28** |
| Doctor approvals | `ConsultationVersion.approvalStatus = APPROVED` | **13** |
| Awaiting doctor review | `ConsultationVersion.approvalStatus = PENDING_REVIEW` | **3** |
| Missing consultation | `COMPLETED` assessment with no consultation (pipeline gap) | **12** |
| Reconciliation discrepancies | approved version vs `Assessment.reviewDecision ≠ APPROVED` | **1** |
| Dossiers ready | `ReportAsset` `PATIENT_REPORT_PDF` + `READY` | **6** |
| Kit order intents (active) | `KitOrderIntent.status = READY_FOR_FULFILMENT` | **12** |
| Confirmed orders / revenue | `KitOrderPayment` (status PAID) | **Not connected** (table absent in prod) |
| Reports sent | `WhatsappDelivery` subject REPORT, SENT/DELIVERED | **0** (connected, genuine zero) |
| Reports delivered | `WhatsappDelivery` subject REPORT, DELIVERED | **0** (connected, genuine zero) |

Notes that prove the honest semantics are working on live data:
- **Payments is "Not connected," not "0".** The `KitOrderPayment` table does not
  exist in production, so confirmed orders and revenue correctly degrade to
  "Not connected" rather than a fabricated zero.
- **Report availability ≠ approval.** 13 approved versions but only 6 READY
  dossier assets → a measured asset gap of 7 that the dashboard surfaces as
  report attention (not hidden behind the approval count).
- **Kit intents ≠ paid orders.** 12 kit intents are authorizations; zero are
  shown as paid (payments not connected).
- **Reconciliation discrepancy is real.** Approved versions (13) exceed
  assessments with `reviewDecision = APPROVED` (12) by exactly 1 — the single
  conflict the dashboard flags at Radiance. Reported, never auto-reconciled.
- Staging's clinic set was **not** copied into production; production remains at
  its real 11 clinics.

### Per-clinic (all 11 production clinics)

| Clinic | Status | Doctors | Signed in | Assess | Missing consult | Approved | Awaiting | Recon | Dossiers ready | Kit intents | Actively using |
| --- | --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | :-: |
| Acube Aesthetics | ACTIVE | 1 | 1 | 11 | 4 | 5 | 2 | 0 | 2 | 5 | ✅ |
| Aesthetiq Clinic | ACTIVE | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Bala Clinic | ACTIVE | 1 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | — |
| Derma Circles – Delhi | ACTIVE | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Dr. Aggarwal's Clinic | ACTIVE | 1 | 1 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | — |
| Dr. Sumit Ahuja — Online Hair Consultation | ACTIVE | 1 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | — |
| GH Derma Center | ACTIVE | 1 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | ✅ |
| Radiance Skin Hair Cosmetic Center | ACTIVE | 1 | 1 | 7 | 2 | 5 | 0 | 1 | 4 | 4 | ✅ |
| Reniu Clinic | ACTIVE | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Tressze Clinic | ACTIVE | 1 | 1 | 4 | 1 | 2 | 1 | 0 | 0 | 2 | ✅ |
| Yavana Skin & Hair Clinic | ACTIVE | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |

Operational reading for the Super Admin:
- **Adoption is 4 of 11.** Acube, GH Derma, Radiance and Tressze are actively
  using HairOS end-to-end.
- **6 clinics need onboarding.** Aesthetiq, Derma Circles, Dr. Aggarwal's,
  Dr. Sumit Ahuja, Reniu, Yavana have doctors registered but no verified doctor
  sign-in and/or no assessments. (Aggarwal's and Sumit Ahuja have assessments
  but no doctor approvals.)
- **Doctor onboarding gap: 6 of 11 doctors have never signed in.** Database rows
  exist; verified Google/last-sign-in does not. This is exactly the onboarding
  blocker the "Doctors & Access" screen exposes — identity linking is a separate
  Doctor-task and is not performed here.
- **Report attention:** Acube (5 approved / 2 dossiers), GH Derma (1 / 0),
  Tressze (2 / 0) have approved consultations without a READY dossier asset.
- **Data integrity:** Radiance has 1 reconciliation discrepancy to investigate.

---

## Acceptance status

| # | Deliverable | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Corrected Super Admin UI (Phase 1 nav) | **Implemented, Tested** | `nav.ts`, i18n, `super-admin-nav.test.ts` (14/14 pass) |
| 2 | Clinic Operations overview | **Implemented** (PR #51/#52) | `/admin` + `/api/admin/operations-overview` |
| 3 | Clinic drilldown | **Implemented** (PR #51/#52) | `ClinicOpsDrawer` + `/api/admin/clinics/[id]/operations` |
| 4 | Doctor onboarding visibility | **Implemented** (PR #51/#52) | `/admin/people` ("Doctors & Access") |
| 5 | Report & clinical attention monitoring | **Implemented** (PR #51/#52) | honest semantics verified on live data (above) |
| 6 | Read-only production KPI reconciliation | **Implemented, Tested** | SELECT-only SQL, section above |
| 7 | PR URL + commit SHA | See PR body | — |
| 8 | CI / build results | **Tested** | see below |
| 9 | Staging acceptance evidence | **Blocked** | needs an authenticated Super Admin session on the Vercel Preview |
| 10 | Remaining production release blockers | Documented | see below |

### CI / build / test results (Tested)

- Blocking release-gate vitest suites, run exactly as `.github/workflows/ci.yml`:
  **all green — 686 tests across 52 files** (579 + 107 in the two batches).
- Super Admin nav contract (jest): **14/14 pass**.
- Localisation suites (dictionary/locale availability): **green** — the 4 added
  nav keys are present and typed in all 7 locales.
- Changed files introduce **no new TypeScript errors**. (The repo's full `tsc`
  is red on the baseline — ~912 pre-existing errors, non-blocking per CI's
  `baseline-audit` job — and none of those errors are in the files this branch
  touches.)
- `next build` (production) was not run here; it is the same `tsc` that is
  known-red on the baseline and is not the blocking gate.
- **Note on CI triggering:** `ci.yml`'s `on:` filter covers `main`, `master`,
  `release/**` and PRs into `claude/acube-launch-fix`. A PR into
  `codex/phase-1-integrated-rc` is **not** auto-covered, so the blocking gate
  may not run automatically on this PR — hence the local run above is the
  evidence of record.

### Security (Tested by existing suites)

- `/api/admin/operations-overview` and every `/api/admin/*` route gate with
  `assertSuperAdmin()`, which throws `ForbiddenError` (→ 403) for any non-Super
  Admin. `tests/admin-route-guard.test.ts` (21) and
  `tests/api/doctor-route-scope.test.ts` (82) cover unauthorized access and
  doctor clinic isolation — all pass.

---

## Remaining production release blockers

1. **Authenticated staging acceptance not yet performed.** Code inspection and
   unit suites pass, but the authenticated Super Admin Google-login flow on the
   Vercel Preview has not been exercised. Per the task, do not claim
   authenticated flows passed on inspection alone. **Verify which database the
   Preview's server-side connections use before any write-based test.**
2. **Doctor onboarding incomplete.** 6 of 11 doctors have never signed in; the
   dashboard shows this, but identity linking is a separate Doctor task.
3. **Payments/revenue not provisioned in production.** `KitOrderPayment` migration
   is absent; confirmed orders/revenue read "Not connected" by design.
4. **Report delivery near-empty.** `WhatsappDelivery` is connected but has no
   recorded REPORT sends/deliveries; dossier assets lag approvals (gap of 7).
5. **One reconciliation discrepancy** at Radiance to investigate (approved
   version vs `reviewDecision`).

Do not promote to production until expressly approved.
