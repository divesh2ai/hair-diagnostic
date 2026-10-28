# HairOS Super Admin — Launch-Readiness Report

**Date:** 2026-10-28
**Author:** Lead Production Engineer / QA Owner (automated audit + staging-only code work)
**Branch:** `claude/modest-albattani-dw6gl1` (based on `codex/map-rendering-integrity` @ `9f101ae`)
**Discipline applied:** read-only audit first; code + verification only; **no production writes, no
auth/credential changes, no cross-environment data movement, no deletions, no external messaging,
no clinical-protocol changes.** All identifiers below are masked; no patient PII is included.

---

## 1. Verified environment & repository

| Item | Value (verified this session) |
|------|------|
| GitHub repo | `divesh2ai/hair-diagnostic` — Next.js monorepo `hair-diagnosis-saas` (`apps/patient-portal`). App lives on feature branches; **`main` holds only the obsolete single-file HTML demo + a generic starter zip**. |
| Live production URL | `hairos-ashen.vercel.app` → Vercel deployment `dpl_FsF23mz4…` (`target: production`) = branch **`claude/acube-launch-fix`** @ `0227041`. |
| **Screenshot / latest staging code** | **`codex/map-rendering-integrity`** @ `9f101ae` (deployed today as a *preview*). Its KPI logic reproduces **every** screenshot number exactly. The production alias is **stale** and predates this work. |
| Supabase staging | `hairos-staging` · `vbkoupvduadmcxggtnsb` · ap-south-1 · PG17 · ACTIVE_HEALTHY |
| Supabase production | `drfact-hairos-production` · `pykoyxbleowxwechotth` · ap-south-1 · PG17 (read-only comparison only) |
| Vercel project | `hairos` · team `team_mxyN3cO24XfuFVONUc85Twcz` |

**Branch-mismatch note (important):** the code behind the screenshot is *not* what the production
URL currently serves. Work here is based on the screenshot branch, as agreed.

---

## 2. Actual counts (staging = source of truth) — all reconcile with the screenshot

Confirmed-test clinics (excluded by explicit `-test` token): `drfact-mumbai-test`, `drfact-pune-test`.
`drfact-mumbai` is classed **uncertain** (brand token, no test marker) and is therefore **included** in
real KPIs — by design (no guessing from names).

| KPI | Screenshot | DB truth | Status |
|---|---|---|---|
| Clinics (real / total) | 14 / 16 | 14 / 16 | ✅ accurate |
| Doctors (real) | 15 | 15 (21 total − 6 in test clinics) | ✅ accurate |
| Access-ready | 1 / 15 | 1 | ✅ accurate (real gap) |
| Patient assessments | 39 | 39 submissions (36 unique patients) | ✅ accurate; label could read "assessments" |
| Issues / stalled CRITICAL | 5 | 5 | ✅ accurate (real stuck jobs) |

Underlying: Patient 103 · Assessment 117 total / 106 live / 92 distinct · Consultation 91 (84 APPROVED) ·
KitOrderIntent 81 (80 READY_FOR_FULFILMENT) · WhatsappDelivery 11 (5 SENT, 6 BLOCKED_NO_CONSENT).
Production (read-only): 7 clinics / 7 doctors (5 provisioned) / 15 assessments / 0 test clinics.

**The dashboard on the screenshot branch is honest — the numbers are real operational signals, not
display defects.** (The display-defect class was fixed earlier by PRs #40/#32 et al.)

---

## 3. Root cause — "1 of 15 access-ready"

`access-ready` = active, non-deleted doctor with a linked auth identity (`supabaseUserId` **or**
`supabasePhoneUserId`) in a non-test clinic. Per-doctor (masked):

| Doctor | Clinic | Provisioning | Email auth | Phone auth | Access-ready | Blocker / action |
|---|---|---|---|---|---|---|
| D-ACUBE-1 | Acube Aesthetics | `ACTIVE` (`acube-p0-2026-10-13`) | yes | no | **YES** | — |
| D-02…D-14 (13) | 13 launch-cohort clinics | `READY_TO_INVITE` (`launch-cohort-2026-09`) | no | no | no | **auth account never provisioned** → run invite/provision in staging |
| D-15, D-16 | DrFACT Mumbai (×2) | `READY_TO_INVITE` (src null) | no | no | no | **auth account never provisioned** |

**Root cause:** the Sep-2026 launch-cohort import created `Doctor` rows as `READY_TO_INVITE` but the
invite/auth-provisioning step was never executed; only Acube was provisioned (Oct-13 P0). **This is a
real onboarding-pipeline gap, not a metric defect.** No application code defect found in the readiness
computation. OTP note: the phone/OTP path is already shipped (`supabasePhoneUserId`,
`doctor_phone_identity` migrations) — OTP-first provisioning needs **no provider switch**.

**Resolution status:** diagnosed; remediation is a live provisioning action (creates Supabase auth
accounts / sends invites). **Deferred — requires explicit approval; not performed** (scope was code +
verification only). Not inflated/manually marked.

---

## 4. The 5 critical / stalled issues — root cause & resolution

`stalled` = in-flight status with no write for >60 min (`CLINICAL_READY`/`COMPLETED` rest;
`PARTIAL_FAILURE` is a terminal failure, not stalled). The 5 (masked):

| # | Clinic | Status | Stuck since | retry | lastError |
|---|---|---|---|---|---|
| 1–2 | Acube Aesthetics | `PENDING` | 2026-10-13 | 0 | none |
| 3 | DrFACT Mumbai | `QUEUED` | 2026-08-24 | 0 | none |
| 4 | DrFACT Mumbai | `GENERATING_REPORT` | 2026-08-24 | 0 | none |
| 5 | DrFACT Mumbai | `REPORT_GENERATING` | 2026-08-24 | 0 | none |

**Root cause:** orchestration runs inside the request lambda's `after()` window
(`lib/orchestration/dispatch.ts`); there is **no durable queue** in the deployed config (Inngest is
documented but not wired). When a lambda froze/timed out mid-pipeline, the row was left in-flight with
`retryCount=0` and **no error** (its own failure handler never ran), and **nothing ever re-drove it**.
A `resumeOrchestration()` recovery primitive and a Phase-A lease/reclaim exist, but no sweeper invokes
them for abandoned jobs. **This is a pipeline-reliability gap, not a dashboard defect, and not test
noise** (the 5 `PARTIAL_FAILURE` rows are all in the excluded `drfact-mumbai-test` and correctly *not*
counted).

**Resolution status:** **code fix shipped** (this PR) — a stalled-job recovery sweeper that reuses the
existing idempotent `resumeOrchestration()`:
- `lib/admin/stalledRecovery.ts` — pure, tested selector (which jobs are safe to re-drive and why).
- `POST /api/admin/stalled-jobs/recover` — Super-Admin-guarded, **dry-run by default**, bounded,
  audited; skips live-lease and retry-exhausted rows; never closes/deletes/fabricates terminal state.
The **execution** against staging (re-driving the 5 rows) is a live write and was **not performed** —
it is a one-call dry-run → execute for the operator, under approval.

**Verification method:** `selectRecoverableJobs` unit tests include a case that reproduces these exact
5 rows as all-eligible; the endpoint’s dry-run returns the plan without writing.

---

## 5. Clinic data-isolation results (Phase 4)

- **App layer (verified, green):** every tenant-scoped read/write goes through `assertSuperAdmin` /
  `assertClinicAccess` / `clinicScope` (`lib/auth/tenantGuard.ts`). Authz/scope suites pass
  (`tests/api/doctor-authz`, `doctor-route-scope`, `clinic-location-authz`, `admin-route-guard`,
  `doctor/skin-fact-deck-isolation` — 76 assertions green under their runner).
- **Prior P0 investigation (`SECURITY_INVESTIGATION_CROSS_CLINIC.md`, PR #24):** no reproducible live
  cross-clinic leak; the one residual vector (unauthenticated `POST /api/assessment/pdf`) was fixed;
  DB showed **zero** assessment↔patient clinic mismatches.
- **DB layer — P0 RESIDUAL (report-only, confirmed via Supabase advisor, staging):**
  **17 public tables have RLS disabled** and are exposed through PostgREST to the `anon`/`authenticated`
  keys: `ReportAsset` (**159 rows**, patient report assets), `SupportTicket`, `SupportMessage`,
  `KitOrderPayment`, `PaymentTransaction`, `CatalogOrder*`, `CatalogShipment*`, `Appointment`,
  `DoctorAddress`, `Brochure*`, cart/shipment tables. Also: anon-executable `SECURITY DEFINER` `jwt_*`
  helper functions, and Auth leaked-password protection disabled.
  The app uses Prisma (service-role / direct connection), so it does not *rely* on RLS — but if the
  anon key reaches the browser, these tables are directly reachable. **Not changed** (enabling RLS
  without clinic-scoped policies would lock the app out; needs policy design). **Production not yet
  checked — owner action below.**

Negative-access posture is covered by the app authz tests; a DB-level negative test against the anon
key is recommended once RLS policies exist.

---

## 6. Golden-path evidence (Phase 5)

Path: QR → doctor/clinic landing (`/q/[clinicSlug]`) → assessment-v3 → `POST /api/assessment/submit`
(writes `clinicId`, `reviewingDoctorId=null`) → orchestration Phase A (clinical engine) → Phase B
(report/PDF) → Consultation `AWAITING_DOCTOR_REVIEW` → doctor review/approval → KitOrderIntent →
ReportAsset (PDF) → consent-gated WhatsApp delivery → doctor dashboard.

- **Implemented and covered** by existing suites: `tests/patient/whatsapp-consent*`,
  `tests/delivery/*` (sender/provider/webhook/health), `tests/review-pathway/*`,
  `tests/assessment-orchestrator/*`, `tests/kit-sequence/kit-sequence.golden`,
  `tests/api/approved-pdf-versioning`, `tests/reports/one-page-rendered-approval`.
- **Live staging evidence the path completes end-to-end:** 84 `APPROVED` consultations, 80
  `READY_FOR_FULFILMENT` kit intents, 5 WhatsApp `SENT`, and **6 correctly `BLOCKED_NO_CONSENT`** (the
  consent gate works). The 5 stalled jobs are the exception this PR’s sweeper addresses.
- **Not executed live:** no new assessment was submitted and **no WhatsApp message was sent** to any
  real patient/doctor (safety rule). Evidence is code + existing tests + read-only DB state.

---

## 7. Exact files changed (this PR) + migrations

**Added:**
- `apps/patient-portal/src/lib/admin/stalledRecovery.ts` — pure stalled-job recovery selector.
- `apps/patient-portal/src/app/api/admin/stalled-jobs/recover/route.ts` — guarded, dry-run-default
  recovery endpoint.
- `tests/admin/stalled-recovery.test.ts` — 13 unit tests (vitest).
- `LAUNCH_READINESS_HairOS.md` — this report.

**Modified:**
- `apps/patient-portal/src/lib/audit/actions.ts` — additive `Operations` audit group
  (`ASSESSMENT_RECOVERY_SWEEP`, `ASSESSMENT_RECOVERY_REQUEUED`).

**Migrations:** none. No schema change. No DB migration applied to any environment.

---

## 8. Tests passed / failed

- **New selector tests:** 13/13 pass (vitest).
- **KPI honesty (jest):** `job-health`, `test-data` pass (31). `readiness`, `growth-display` pass
  (vitest).
- **Isolation/authz (vitest):** 76 pass.
- **Full suites:** vitest `2617 passed / 22 failed / 117 skipped`; jest `713 passed / 31 failed`.
  The **22/31 failures and the many "suite failed to load" entries are pre-existing and unrelated to
  this change**: (a) the repo runs a **mixed jest+vitest** convention, so each runner fails to *load*
  the other runner's files (not real assertion failures); (b) remaining real failures are in clinical
  scoring snapshots (`ai-engine`, `narrative-engine`, `assistant`), env-gated `commerce` routes
  (`PURCHASING_ENABLED`), `skin-questionnaire`, and `map-runtime` (optional `maplibre-gl`/`zod`
  resolution under vitest). None import the files changed here; the audit suite that imports the
  modified `actions.ts` passes.
- **Typecheck:** app source introduces no new `tsc` errors vs. baseline (the one `next/server`
  resolution error is identical on the untouched sibling route; `next build` is the real gate).
  *Repo hygiene item (not fixed here): standardise the jest/vitest split so a single `npm test` is
  trustworthy.*

---

## 9. Git / PR / staging references

- Branch: `claude/modest-albattani-dw6gl1` (base `codex/map-rendering-integrity` @ `9f101ae`).
- Commit / PR: see PR opened from this branch (draft).
- Staging DB audited: `vbkoupvduadmcxggtnsb`. Live staging preview reproducing the screenshot:
  `codex/map-rendering-integrity`. **No deployment was promoted; no env var changed.**

---

## 10. Outstanding blockers — owner & action

| # | Blocker | Severity | Owner | Action |
|---|---|---|---|---|
| B1 | 14 of 15 real doctors not access-ready (`READY_TO_INVITE`, no auth account) | P0 (launch) | Platform ops + approver | Approve + run invite/provisioning in staging (OTP-first viable); verify a real login per clinic. |
| B2 | 5 stalled assessments not yet re-driven | P0 (launch) | Super Admin + approver | Review `/api/admin/stalled-jobs/recover` dry-run, then `execute: true` in staging; confirm they reach COMPLETED. |
| B3 | Durable queue not wired (root cause of B2 recurring) | P1 | Eng | Wire Inngest (code present) or run the new sweeper on a schedule so abandonment self-heals. |
| B4 | RLS disabled on 17 public tables (incl. `ReportAsset`) | P0 (security) | Eng + DBA | Design clinic-scoped RLS policies, enable with policies; **check production**; audit anon key exposure. |
| B5 | Production alias serves stale pre-fix branch | P1 | Eng/Release | Promote the verified screenshot branch (after review) so prod matches audited behaviour. |
| B6 | Mixed jest/vitest test convention obscures CI signal | P2 | Eng | Standardise runners so one command gives a trustworthy pass/fail. |

---

## 11. Recommendation

### NO-GO for controlled clinic rollout — pending B1, B2, B4.

The platform is closer than the screenshot's alarm suggests: the Command Centre is **honest**, the
golden path **works end-to-end on staging**, clinic isolation is **enforced at the app layer**, and the
stalled-job root cause now has a **shipped, tested recovery mechanism**. But a rollout cannot proceed
while **14 of 15 doctors cannot log in** (B1), **5 patient assessments are stuck** (B2), and
**patient report data is reachable via RLS-disabled tables** (B4).

**Path to CONDITIONAL GO:** approve and execute the staging provisioning (B1) and recovery run (B2),
and close the RLS exposure (B4) — each is ready to action and none requires inflating a dashboard
number. Re-audit after, then promote the verified branch to the production alias (B5).
