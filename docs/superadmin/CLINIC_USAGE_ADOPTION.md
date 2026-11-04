# Clinic Usage & Adoption tracking (Super Admin Operations)

This extends the existing Super Admin **Operations control centre** (`/admin`,
backed by `lib/admin/opsDashboard`). It does **not** rebuild the dashboard — it
adds the honest usage/adoption signals the operations team needs to answer, at a
glance:

- which doctors have **working access**,
- which clinics are **receiving patient assessments**,
- which doctors **actually review patients**,
- where reviews or reports are **pending**,
- which clinics have **stopped using HairOS**.

Administrative enablement (`Clinic.status = ACTIVE`) is shown as a column — it is
**not** adoption. A clinic can be ACTIVE and completely unused.

## What changed in this PR

| Area | Change |
| --- | --- |
| Login resolution | Last sign-in is now resolved across **both** supported Supabase identities (`supabaseUserId` e-mail/Google **and** `supabasePhoneUserId` phone-OTP), latest wins. A phone-login doctor is no longer mis-reported as "never signed in". Pure helper: `lib/admin/opsDashboard/identity.ts`. |
| Reviewed cases | New metric: **distinct cases a doctor reviewed** = consultations whose current version is `APPROVED`, `REVISION_REQUESTED` or `REJECTED`. `PENDING_REVIEW` is excluded (not a completed review). Surfaced in the KPI strip, the clinic table and the drilldown. |
| Last doctor activity | New per-clinic signal: the most recent **authenticated doctor** clinical action (an approval, or an audited action with `actorType = 'doctor'`). System jobs, background pipelines and Super Admin activity are excluded. |
| Usage statuses | New primary statuses: **Logged in · work not started**, **No recent activity** (stopped), **Unknown · tracking unavailable**; `Onboarding pending` label clarified. |
| Filters | Added **Onboarding pending**, **Logged in · no clinical activity**, **No recent activity (stopped)**. |
| Period presets | **Today / Last 7 days / Last 30 days / All time** (Asia/Kolkata), alongside the existing custom From/To range. |
| Clinic drilldown | New **Doctors — access, login & activity** section (per-doctor access status, login across both identities, last clinical activity), plus a **Cases reviewed** total. |

## Metric definitions

All timestamps/day-boundaries are **Asia/Kolkata**. Period figures (`today`) are
labelled with the selected window; all-time figures are absolute.

- **Access status** (per doctor): `linked identity` (a Supabase account is
  linked), `onboarding pending` (provisioning in progress, no account yet), or
  `unknown`.
- **Last login**: latest `auth.users.last_sign_in_at` across the doctor's linked
  identities. When `auth.users` cannot be read the dashboard shows **Unknown**,
  never **Never** — the two mean opposite things.
- **Patient assessments received**: `Assessment` rows (windowed by `submittedAt`).
- **Cases reviewed by a doctor**: distinct consultations with a completed
  decision (`APPROVED` / `REVISION_REQUESTED` / `REJECTED`). Repeated actions on
  one case never inflate the count (one consultation per case).
- **Approvals**: `ConsultationVersion.approvalStatus = APPROVED` only — the
  clinical sign-off. Distinct from *reviewed cases* and never equal to
  `AssessmentStatus.COMPLETED` (which only means the AI pipeline finished).
- **Pending doctor reviews**: current version `PENDING_REVIEW`.
- **Missing consultation**: `COMPLETED` assessments with no consultation — a
  pipeline gap, shown apart from the doctor queue (never counted as doctor
  inaction).
- **Dossiers ready**: `ReportAsset PATIENT_REPORT_PDF` rows that are `READY` — a
  measured asset, never inferred from an approval.
- **Reports sent / delivered**: `WhatsappDelivery` `subject = REPORT`; *sent* =
  provider accepted, *delivered* = provider delivery receipt. Capability-gated:
  **Not connected** (not `0`) where the migration is absent. Opening a WhatsApp
  link is **not** delivery.
- **Last doctor activity**: most recent authenticated doctor action (approval or
  `actorType = 'doctor'` audit event).

## Usage classification

Lifecycle and data-integrity rank first; then the most operationally urgent
facet. Access, usage and workflow-attention are kept separate — a clinic can be
*Using HairOS* and still have pending reviews or a report problem (those show in
their own columns/filters).

| Status | Meaning |
| --- | --- |
| Never logged in | No doctor has ever signed in (only asserted when sign-in is readable). |
| Onboarding pending | Provisioned, not yet past onboarding. |
| Logged in · work not started | A doctor can sign in but has no reviewed case yet. |
| No assessments | Not receiving patient assessments. |
| Patients waiting for review | A consultation version is `PENDING_REVIEW`. |
| Missing consultation / Reconciliation discrepancy | Pipeline / data-integrity attention (not doctor inaction). |
| Report / delivery attention | Measured asset gap or a delivery fault (only when delivery is connected). |
| Using HairOS | Genuine clinical work **and** recent doctor activity. |
| No recent activity | Did clinical work before, but has gone quiet — i.e. stopped. |
| Unknown · tracking unavailable | Adoption cannot be established (auth unreadable, no clinical signal). |

Principles enforced in code and tests (`tests/admin/ops-dashboard.test.ts`):

- Patient submissions alone do **not** prove doctor adoption.
- A login alone does **not** prove clinical work.
- A rejection or revision request **is** genuine clinical work.
- A doctor with an **older sign-in but recent clinical activity** still counts
  as using HairOS (recency is measured on the doctor-activity clock, not the
  sign-in clock, and not the patient-submission clock).
- Missing/unreadable evidence shows **Unknown / Not connected**, never a
  fabricated **Never / 0**.

## Yavana (multi-branch)

Preserved as-is: one clinic/dashboard with Mulund + Bandra branch attribution
via `ClinicLocation`; `branchCount`/`primaryBranch` surface the branches and the
drilldown lists them. No new tables introduced.

## Verification & remaining release blockers

- **Implemented & unit-tested** (`tests/admin/ops-dashboard.test.ts`, run with
  `vitest`): classification (incl. the ACTIVE-but-unused, reviews-vs-approvals,
  rejection/revision-as-review, recent-activity-despite-old-login, unknown-vs-zero
  cases), report-readiness separation, Asia/Kolkata window boundaries, period
  presets, and the multi-identity login resolver.
- **Not performed in this environment** (no production database / deploy creds):
  live metric reconciliation against the production DB, authenticated Super Admin
  **browser acceptance**, and production deployment. These remain release
  blockers and must follow the established production release authorization. The
  data layer reads only; no production data is modified by this change.
