# HAIROS — Cross-Clinic Data-Leak Investigation (P0)

**Scope:** PR #24 branch (`claude/admiring-wright-v5lmck`, head `ac54ba0`) and staging DB
`hairos-staging` (`vbkoupvduadmcxggtnsb`). Production (`pykoyxbleowxwechotth`) was **not touched**.
**Reported symptom:** an assessment started under the *DrFACT Mumbai Test Clinic* QR flow
(ending at `/q/drfact-mumbai-test/thank-you`) appeared in *Dr Avinash Agarwal's Acube
Aesthetics* doctor dashboard.

Fix branch: `claude/awesome-johnson-y7nwy2` (based on the PR #24 head).

---

## 1. Actual root cause

**There is no reproducible live cross-clinic leak in the PR #24 code on any of the traced
surfaces. Assessment ownership is stored correctly, and every doctor-facing read/write is
clinic-scoped server-side.** The reported observation is explained by two facts, plus a
separate residual gap that is the one thing worth fixing here:

1. **The thank-you URL is navigation-only — it does *not* reflect stored ownership.**
   `/q/[clinicSlug]/thank-you` (`…/thank-you/page.tsx`) makes **no database call**; the
   `clinicSlug` only keeps the patient inside the clinic's URL space. So *"it ended at
   `/q/drfact-mumbai-test/thank-you`"* says nothing about which clinic the assessment was
   filed under. This is exactly PHASE 1.4's hypothesis, confirmed in code.

2. **Submission ownership is correct and consistent.** `POST /api/assessment/submit`
   resolves the clinic from `body.clinicSlug` (`prisma.clinic.findUnique({ where:{ slug }})`)
   and writes `clinicId: clinic.id`, `reviewingDoctorId: null`. In the v3 journey the submit
   slug and the thank-you redirect are the **same variable** (`effectiveClinicSlug` in
   `AssessmentV3Journey.tsx`), so they cannot diverge within a flow. DB evidence (below)
   shows **zero** assessment↔patient clinic mismatches.

3. **Residual gap actually fixed:** `POST /api/assessment/pdf` had **no authentication or
   clinic authorization** — any caller who knew an `assessmentId` could drive report
   generation (write a `REPORT` artifact + audit row) and read back the stored report
   locations, cross-clinic. Its `GET` sibling was already fully gated. This is the one real
   residual cross-clinic exposure vector and is the subject of the fix below.

The only genuine cross-clinic artefact in the data is **historical/QA seed data** (22 rows,
detailed in §3) and does **not** involve Acube or Dr Avinash.

---

## 2. Affected files & queries (traced)

### Submission ownership (correct)
- `apps/patient-portal/src/app/api/assessment/submit/route.ts` — clinic resolved by slug;
  `clinicId = clinic.id`; `reviewingDoctorId = null`.
- `.../q/[clinicSlug]/assessment-v3/AssessmentV3Client.tsx`,
  `components/questionnaire/v3/AssessmentV3Journey.tsx` — `effectiveClinicSlug` drives both
  the submit body and the thank-you redirect.
- `.../q/[clinicSlug]/thank-you/page.tsx` — static, no DB read (navigation-only slug).

### Doctor context & dashboard (all clinic-scoped server-side)
- `lib/auth/doctorContext.ts` — `requireDoctorContext()` resolves the acting Doctor from the
  **verified Supabase JWT** (`doctorAuthIdentityWhere(claims.sub)`), reading `clinicId` from
  the live DB row; `assertDoctorInClinic()` is the per-resource guard.
- `lib/auth/legacy.ts` / `requestScope.ts` — claims read via JWKS; no client role headers.
- `lib/auth/devBypass.ts` — dev login triple-gated; hard-blocked on production runtime / prod DB.
- `api/doctor/reports/route.ts`, `doctor/stats/route.ts`, `doctor/queue/next/route.ts`,
  `doctor/reports/facets/route.ts`, and `lib/doctor/reviewQueue.ts` /
  `lib/doctor/dashboardStats.ts` — every query pins `clinicId = doctor.clinicId`
  (server-derived); the former `?clinicId=` super-admin override was removed.
- `api/doctor/reports/[id]/decision`, `doctor/journey/[assessmentId]`,
  `doctor/patients/[id]`, all `consultation/[assessmentId]/*`, `cart/[assessmentId]/*`,
  `doctor/orders/[intentId]/*`, `doctor/fulfilment/[id]/*`, `doctor/appointments/[id]/*` —
  enforce clinic ownership via `assertDoctorInClinic` or an internal `requireClinicId` folded
  into the UPDATE's WHERE, with **404-concealment** for cross-clinic ids.
- Doctor server pages (`app/doctor/reports/[assessmentId]/page.tsx` via
  `lib/consultation/reviewPayload.ts`, the skin review pages, `patients/[id]`) — all scope by
  the authenticated doctor's clinic (`assertDoctorInClinic` / `clinicId !== ctx.clinicId → notFound()`).

### The gap (fixed)
- `apps/patient-portal/src/app/api/assessment/pdf/route.ts` — `POST` had **no** auth/clinic check.

---

## 3. Did any patient data cross clinic boundaries?

**No live patient-facing cross-clinic exposure was found on the current code.** Database
evidence from staging:

- **Assessment ↔ patient clinic:** every assessment's `clinicId` equals its patient's
  `clinicId` — **0 mismatches**. Submission ownership is sound.
- **Reviewer ↔ clinic:** **22** assessments owned by clinic `drfact-mumbai`
  (`cmt74rliq0002246pswtdxyyj`) carry `reviewingDoctorId` = **Dr Divesh Shah** (clinic
  `drfact-mumbai-test`, `cmsuip5jk0000u6hz3hqduv8y`), `reviewedAt` 2026‑09‑19 → 09‑28.
  All 22 have **`reviewerEmail = null`** and **zero decision/approval/PDF audit-log entries**.
  The authenticated decision route (`reports/[id]/decision`) stamps `reviewerEmail =
  doctor.email` *and* writes audit logs — so these rows were **not** produced by the
  authenticated API. Signature = **QA/seed-script writes predating the clinic-scoping
  hardening**, not live exploitation.
- **None** of the mismatches involve **Acube Aesthetics** or **Dr Avinash Agarwal**. The
  reported DrFACT-Mumbai-Test → Acube record does not exist: today's `drfact-mumbai-test`
  submissions are all correctly owned, and Dr Avinash has only ever reviewed one assessment,
  which is correctly his own clinic's (Acube).

Audit evidence preserved; no identifiable patient fields (names/phones) were extracted beyond
what the join keys required.

---

## 4. Minimal fix

**File:** `apps/patient-portal/src/app/api/assessment/pdf/route.ts` — add
`authorizePdfGeneration()` and call it in `POST` before any generation/write/disclosure.

Authorization mirrors the existing `GET` release gate:
- **Clinic session** must own the assessment's clinic (Super Admin excepted). **No** fallback
  to a default clinic — a session with no clinic, or the wrong clinic, is denied (403).
- **Patient review token** must be signed and bound to **this** `assessmentId` (via `?t=` or
  `{ token }`); otherwise 401.
- Client-supplied clinic ids are never trusted as authorization.

**File:** `.../q/[clinicSlug]/preview/[assessmentId]/page.tsx` — the one legacy caller now
passes its signed review token in the POST body so the patient preview keeps working under
the gate.

**Regression tests:** `tests/api/pdf-release-gate.test.ts` extended with a POST-authz block —
401 anonymous, 403 cross-clinic, 401 token-bound-to-other-assessment, 404 missing, 400 no id,
and allow-paths for owning-clinic session / correct token / Super Admin.

Commit: see fix branch `claude/awesome-johnson-y7nwy2`.

---

## 5. Release gate

1. **Root cause** — No live cross-clinic leak on PR #24 surfaces; thank-you URL is
   navigation-only; one residual unauthenticated route (`POST /api/assessment/pdf`) closed.
2. **Affected files/queries** — §2.
3. **Patient data crossing boundaries** — None live; 22 historical QA/seed reviewer rows
   (non-Acube), no audit trail, pre-hardening. §3.
4. **Minimal fix + commit** — §4; fix branch `claude/awesome-johnson-y7nwy2`.
5. **Automated test results** — see PR / CI (pdf-release-gate authz block).
6. **Two-clinic verification** — DB-level: DrFACT-Mumbai-Test and Acube assessments are each
   owned by and visible only to their own clinic; reviewer and dashboard scoping confirmed in
   code across all traced routes.
7. **SECURITY VERDICT** — see PR summary. The cross-clinic authorization boundary is intact on
   the traced surfaces; the PDF-POST gap is closed by this change. (Note: pre-existing
   clinical-engine and staging-E2E gates from PR #24 are unchanged and out of scope here.)
