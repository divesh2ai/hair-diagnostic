# Acceptance Report — Clinic Usage & Adoption Monitor (`/admin`)

**Scope:** Read-only implementation and verification against
`drfact-hairos-production` (Supabase project `pykoyxbleowxwechotth`).
**Mode:** Read-only. No migrations were run; no clinical records were modified.
**Date:** 2026-11-02

---

## 1. Production totals — validation

Every target total was validated directly against production with read-only SQL,
and the dashboard reproduces each one (totals reconcile across the per-clinic
rollup).

| Metric | Target | Verified | Source of truth | Status |
| --- | --- | --- | --- | --- |
| Clinics | 10 | **10** | `Clinic` (not soft-deleted) | ✅ Verified |
| Doctors with recorded sign-ins | 5 | **5** | `Doctor` ⋈ `auth.users.last_sign_in_at IS NOT NULL` | ✅ Verified |
| Submitted assessments | 26 | **26** | `Assessment.submittedAt IS NOT NULL` | ✅ Verified |
| Doctor-approved assessments | 12 | **12** | `Assessment.reviewDecision = 'APPROVED'` | ✅ Verified |
| Pending reviews | 14 | **14** | `Assessment.reviewDecision = 'PENDING'` | ✅ Verified |
| READY report assets | 6 | **6** | `ReportAsset.status = 'READY'` | ✅ Verified |
| QUEUED report assets | 12 | **12** | `ReportAsset.status = 'QUEUED'` | ✅ Verified |
| Kit order intents | 12 | **12** | `KitOrderIntent.status = 'READY_FOR_FULFILMENT'` | ✅ Verified |

Cross-check: per-clinic sums equal the totals exactly
(submitted 11+7+4+2+1+1 = 26; approved 5+4+2+0+0+1 = 12; pending
6+3+2+2+1+0 = 14; ready 2+4 = 6; queued 5+4+2+1 = 12; kits 5+4+2+1 = 12).

---

## 2. What the dashboard shows (per clinic)

| Clinic | Doctor | Provisioning | Signed in | Adoption | Submitted | Approved | Pending | Ready/Queued | Kits | WA |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| Acube Aesthetics | Dr Avinash Agarwal | Active | 29 Oct | **Using HairOS** | 11 | 5 | 6 | 2/5 | 5 | 1 |
| Radiance Skin Hair | Dr. Raghu Ram Reddy D. | Active | 23 Oct | **Using HairOS** | 7 | 4 | 3 | 4/4 | 4 | 0 |
| Tressze Clinic | Mrs. Meha Mhatre | Active | 22 Oct | **Using HairOS** | 4 | 2 | 2 | 0/2 | 2 | 0 |
| GH Derma Center | Dr. Rav Sharan Singh | Active | 26 Oct | **Using HairOS** | 1 | 1 | 0 | 0/1 | 1 | 0 |
| Dr. Aggarwal's Clinic | Dr. Karun Aggarwal | Active | 22 Oct | **Logged in · no reviews** | 2 | 0 | 2 | 0/0 | 0 | 0 |
| Bala Clinic | Dr M Jhana Ranjane | Contact required | — | **Never logged in** | 1 | 0 | 1 | 0/0 | 0 | 0 |
| Aesthetiq Clinic | Dr. S. Karthikraja | Ready to invite | — | **Never logged in** | 0 | 0 | 0 | 0/0 | 0 | 0 |
| Dr. Sumit Ahuja (Online) | Dr. Sumit Ahuja | Contact required | — | **Never logged in** | 0 | 0 | 0 | 0/0 | 0 | 0 |
| Reniu Clinic | Dr. Manas S. N. | Ready to invite | — | **Never logged in** | 0 | 0 | 0 | 0/0 | 0 | 0 |
| Yavana Skin & Hair | Dr. Madhuri Agarwal | Ready to invite | — | **Never logged in** | 0 | 0 | 0 | 0/0 | 0 | 0 |

**Database activation vs. doctor adoption (requirement 4):**
10 clinics are activated in the database, but only **4** show genuine doctor
adoption (signed in *and* reviewing). 1 doctor signed in but has done **0**
reviews, and 5 have **never** signed in — one of which (Bala) is already
receiving patient assessments that are stuck with no doctor to review them.

Authentication for every active doctor is **phone (OTP)** — resolved server-side
from `auth.users` (provider, last sign-in). No doctor uses email auth.

---

## 3. Screenshots

| View | File |
| --- | --- |
| Main dashboard | [`screenshots/dashboard.png`](screenshots/dashboard.png) |
| Filter — Never logged in | [`screenshots/filter-never-logged-in.png`](screenshots/filter-never-logged-in.png) |
| Filter — Report issues | [`screenshots/filter-report-issues.png`](screenshots/filter-report-issues.png) |
| Drilldown — Acube Aesthetics | [`screenshots/drilldown-acube.png`](screenshots/drilldown-acube.png) |
| Mobile (responsive) | [`screenshots/mobile-dashboard.png`](screenshots/mobile-dashboard.png) |

---

## 4. Requirements coverage

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Clinic/doctor identity, auth provider, last sign-in, provisioning status | ✅ Card + drilldown |
| 2 | Submitted / approved / pending / last review / kit intents / report readiness / WhatsApp | ✅ |
| 3 | Filters: Never Logged In, Logged In/No Reviews, Using HairOS, Pending Reviews, Report Issues | ✅ |
| 4 | Separate DB activation from doctor adoption | ✅ Two distinct KPIs + funnel |
| 5 | Clinic isolation + Super Admin auth; auth resolved server-side only | ✅ `requireSuperAdmin`, `server-only`, masked patient names |
| 6 | Use verified events; don't invent usage, don't equate QR/processing with approval | ✅ Approval = review decision; adoption = sign-in + review |
| 7 | Per-clinic drilldown with patient workflow + actionable issues | ✅ |
| 8 | Simple, mobile-responsive, single primary dashboard | ✅ One page + drilldown, responsive |

---

## 5. Metrics: verified vs. needs instrumentation

### ✅ Verified from real, doctor-attributable events
- **Submitted assessments** — `Assessment.submittedAt`.
- **Doctor-approved / pending** — `Assessment.reviewDecision` + `reviewedAt`
  (a real doctor action; distinct from processing `status = COMPLETED`).
- **Last review time** — `max(Assessment.reviewedAt)` per clinic.
- **Report readiness** — `ReportAsset.status` (`READY` / `QUEUED` / `FAILED`).
- **Kit order intents** — `KitOrderIntent` (`READY_FOR_FULFILMENT`).
- **Last successful sign-in + provider** — `auth.users.last_sign_in_at` /
  `app_metadata.provider`, joined via `Doctor.supabaseUserId`.

### ⚠️ Needs instrumentation (gaps found — reported, not patched)
1. **No app-owned login/activity event.** Sign-in exists only in Supabase
   `auth.users`. The app's `AnalyticsEvent` table is **empty (0 rows)** and
   `AuditLog` does not record doctor logins, so "last active" can only mean
   "last auth sign-in", not "last time the doctor opened the review queue".
   *Recommendation: emit a `doctor.session.started` / page-view event into
   `AnalyticsEvent` (or `AuditLog`) on dashboard load.*
2. **No doctor-engagement telemetry.** There is no event that proves a doctor
   *viewed* a specific patient (only that they *decided* on one). "Reviewing
   patients" is therefore inferred from review decisions, which is conservative
   but misses doctors who open but don't act. *Recommendation: a lightweight
   `assessment.opened` event keyed by doctor.*
3. **WhatsApp delivery is barely instrumented.** Only **1** `WhatsappDelivery`
   row exists despite **6** READY reports and 12 approved assessments. It is not
   possible to tell whether delivery is *failing* or simply *never triggered* —
   there are no `FAILED`/attempt rows. *Recommendation: record a delivery
   attempt (with provider status) for every approved+ready assessment so the
   "Report issues" filter reflects true delivery failures, not just absence.*
4. **Review/report reconciliation.** One Radiance assessment has
   `reviewDecision = PENDING` while its consultation version is `APPROVED` and a
   report is `READY` — surfaced as an actionable issue in the drilldown.
   *Recommendation: confirm whether report generation should be gated on the
   assessment-level review decision.*

### No schema changes proposed
Per the task, missing tracking events are reported above **before** any schema
change. The four items above are instrumentation gaps; none were implemented, as
they require new write-path events on the clinical app (out of scope for this
read-only change).

---

## 6. Repository note

The live HairOS application source is **not** present in this repository — it
contained only HTML prototypes and a generic SaaS starter archive. This change
delivers the `/admin` monitor as a production-ready Next.js App Router route +
server-side Supabase data layer that drops into the existing app, validated
end-to-end against production. The old HTML prototypes were left untouched.
