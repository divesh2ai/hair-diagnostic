# Super Admin Console — Gap Analysis & Revamp Proposal

**Date:** 2026-08-22
**Branch inspected:** `feat/doctor-review-v2`
**Scope:** `apps/patient-portal/src/app/admin/**` + `apps/patient-portal/src/app/api/admin/**`
**Status:** Analysis only. No code or schema was modified (baseline freeze of 2026-08-20 respected).

---

## 1. What exists today

### Routes (5 pages)

| Route | Purpose | Lines | Verdict |
|---|---|---|---|
| `/admin` | Platform overview — 7 metric cards, conversion funnel, 3 recency lists | 318 | Informational only, nothing actionable |
| `/admin/clinics` (+ `/new`, `/[id]/edit`) | Clinic CRUD, lifecycle, branding, subscription, locations | 296 + 426 + 555 + 72 + 18 | The strongest surface in the console |
| `/admin/knowledge-review` | Knowledge governance queue — 8 tabs | 218 | Deep, but disconnected from the rest |
| `/admin/audit` | Audit log table + CSV export | 162 | Real, but blind to admin actions |
| `/admin/settings` | Platform defaults (name, theme, language, WhatsApp template, AI notes, version) | 197 | Thin; AI section is a read-only placeholder |

### APIs (13 routes)

`dashboard`, `funnel`, `metrics`, `clinics`, `clinics/[id]`, `clinics/[id]/locations`,
`locations/[locationId]`, `audit`, `knowledge-review`, `platform-settings`,
`invitations`, `invitations/[id]`, `invitations/[id]/resend`

Two of these are **built but unreachable from the UI**:

- `/api/admin/metrics` — zero consumers anywhere in the app. Duplicates `dashboard` logic.
- `/api/admin/invitations/*` — a complete invite / resend / revoke system with WhatsApp-first
  notification and audit writes. **No admin page calls it.**

### Auth posture (this part is solid)

Three independent layers, correctly ordered:

1. `proxy.ts` matcher covers `/admin/:path*` and `/api/admin/:path*`, verifying the JWT via
   `getClaims()` (JWKS-verified, not `getSession`).
2. `loadSuperAdminShellData()` redirects any non-`SUPER_ADMIN` away from the layout.
3. Every admin route handler carries its own guard — 15 of the 20 use `assertSuperAdmin()`, the
   funnel uses `requireRole(SUPER_ADMIN)` (16 Super-Admin-only in total), and the four
   invitations handlers deliberately widen to `SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN`
   (see defect B7).

No gaps were found in the authorisation chain itself. The problems are elsewhere.

---

## 2. Gap analysis

### A. Coverage gaps — entities with no super-admin surface

The console can manage **clinics**. It cannot reach anything else on the platform.

| Entity | Schema support | Super Admin surface | Consequence |
|---|---|---|---|
| **Doctor** | Full model, clinic-scoped | 5 names on the dashboard, unlinked | Cannot find a doctor across the network. Doctor CRUD exists only at `/clinic/doctors` (clinic-scoped) |
| **Patient** | Full model + `PatientIdentifier`, identity resolution | A count | Zero support capability. "Patient X says their report is wrong" is unanswerable |
| **Assessment / Report** | Full model, `FAILED` status | A count + funnel bar | `FAILED` assessments drive the health score with no way to click through and see them |
| **KitOrderIntent** | Full model, `KitOrderStatus` | 2 funnel bars | No platform order view; `/clinic/orders` and `/doctor/orders` are both scoped |
| **Subscription** | `plan`, `status`, `monthlyAssessmentLimit`, `doctorSeatLimit`, `storageMbLimit`, `assessmentsThisPeriod`, `storageMbUsed`, `periodStart/End` | Two dropdowns buried in the clinic edit form | No billing view, no quota monitoring, no over-limit alerting. The `subscriptions` nav icon is defined and unused |
| **ClinicInvitation** | Full model + working API | **None** | Onboarding a clinic's first admin requires a raw API call |
| **ClinicMember / OrganizationMember** | Full models | **None** | No user directory, no role management, no deactivation |
| **Organization** | Full model, `Clinic.organizationId` | **None** — not even settable in `ClinicForm` | The multi-tenant top level is unreachable |
| **AdverseEvent** | Full model | **None** | A health product with an adverse-event table and no admin surface is a regulatory exposure |
| **AssistantSafetyEvent / AssistantEscalation** | Full models | **None** | AI safety events accumulate unseen |
| **RecommendationFeedback** | Full model, doctor-authored | **None** | The clinical feedback loop terminates in the database |
| **WhatsappDelivery** | Full model + `DeliveryStatus` | **None** | Failed report deliveries are invisible |
| **OrchestrationLog** | Full model, `durationMs` | Averaged inside the dead `metrics` route | No error explorer, no per-stage timing |
| **ClinicVisit / Appointment** | New models | **None** | The newest operational layer has no platform visibility |

**Dangling reference:** `admin/clinics/page.tsx:144` comments *"The national map is only as
complete as this column"* and ships a `locationSetup` column to feed it — but there is **no map
page on this branch**, no `/admin/network` route, and no `maplibre` dependency. The column is
tooling for a consumer that does not exist here.

### B. Correctness defects

1. **The platform health score is arithmetically wrong.**
   `api/admin/dashboard/route.ts` computes `failureRate = allTimeFailures / assessmentsThisMonth`.
   The numerator is all-time, the denominator is one month. On a quiet month the ratio exceeds
   100, the score floors at 0, and the dashboard reads **"Degraded"** on a perfectly healthy
   platform. It also gets *worse* as the platform gets *older*, regardless of actual reliability.

2. **"Reports today" does not count reports.** It counts `Assessment` rows with
   `status: COMPLETED` and `completedAt` today. That is completed assessments. The label is wrong.

3. **Two numbers on the same screen disagree.** The dashboard filters `deletedAt: null`
   everywhere; the funnel route calls `prisma.assessment.count()` with no filter at all.
   Soft-deleted assessments inflate the funnel's first bar relative to the cards above it.

4. **The funnel has no time period.** Metric cards are today / this-month; the funnel is
   all-time. The strip's "% vs prev" figures cannot be read as a conversion rate for any window.

5. **~~`NEEDS_REVISION` is counted as conversion.~~ — CORRECTED 2026-08-22, see below.**
   The `reviewed` stage counted `reviewDecision IN (APPROVED, NEEDS_REVISION)`.

   > **Correction (found during P0 implementation).** This finding understated the defect.
   > `NEEDS_REVISION` **is not a member of the `ReviewDecision` enum at all** — the enum is
   > `PENDING | APPROVED | EDITS_REQUESTED | REJECTED`. Prisma rejects an unknown enum value at
   > runtime, `/api/admin/funnel` has no `try/catch`, and the dashboard swallows the failure with
   > `.catch(() => setFunnel(null))`. The endpoint was therefore **returning 500 and the funnel
   > card was silently never rendering** — it was not showing an inflated number, it was showing
   > nothing. Two further stages were meaningless: the counts ignored `deletedAt`, and
   > "Submitted" filtered `submittedAt: { not: null }` on a column declared
   > `DateTime @default(now())`, which is never null — so that stage always equalled the stage
   > above it. The real "sent back" state is `EDITS_REQUESTED`.
   >
   > **Sibling defect, out of scope and still live:**
   > `apps/patient-portal/src/app/api/clinic/productivity/route.ts:35` carries the identical
   > invalid-enum query and will fail the same way. Not touched — it is a clinic route, outside
   > the Super Admin P0 scope.

6. **The funnel route ignores the pgbouncer constraint the other two routes document.**
   `dashboard` and `metrics` both use `$transaction`, each with an explicit comment that
   `connection_limit=1` makes `Promise.all` starve the pool. `funnel` uses `Promise.all` over
   5 counts plus 2 more sequential queries. It is the route most likely to time out.

7. **`ORG_ADMIN` is a dead role, and it holds permissions it can never exercise.**
   `rootForRole()` sends `ORG_ADMIN` to `/admin` and `navForRole()` hands them the super-admin
   tree — but `loadSuperAdminShellData()` redirects anything that is not `SUPER_ADMIN` to `/`.
   An `ORG_ADMIN` login therefore lands nowhere. Compounding this: 16 of the 20 admin route
   guards are Super-Admin-only, but the four **invitations** handlers accept
   `SUPER_ADMIN | ORG_ADMIN | CLINIC_ADMIN`. So the one admin API deliberately opened to other
   roles is also the one with no UI at all — `ORG_ADMIN` and `CLINIC_ADMIN` have been granted
   invitation rights that no screen in the product lets them use. Either wire the role and the
   invitations UI together, or drop `ORG_ADMIN` from the routing map.

8. **No admin action is audited.** Clinic create, update, suspend, **archive (a soft-delete of an
   entire tenant)**, platform-settings PATCH, and location edits write **zero** `AuditLog` rows.
   `writeAuditLog` is used correctly across the consultation, invitation, lead and identity
   paths — the admin routes are the exception. The audit page is real, and blind to the single
   most privileged actor on the platform.

9. **Audit CSV export silently truncates.** A hard cap of 5000 rows with no warning and no
   pagination — a partial export that looks complete. Field escaping strips commas
   (`.replace(/,/g, " ")`) instead of quoting, so a clinic name containing a quote or a newline
   still breaks the row.

10. **The audit clinic filter only reaches assessment-linked rows.** `clinicId` filters through
    `assessment: { clinicId }`. Any audit row not tied to an assessment shows Clinic `—` and
    cannot be filtered at all.

11. **The audit UI drops filters the API supports.** The `from` / `to` date range is implemented
    server-side and has no control in the page.

12. **Zero test coverage.** `tests/` contains 25+ suites. None target `/admin` or `/api/admin`.

### C. UX and information-architecture gaps

- **A wall of counters.** Seven metric cards in a `lg:grid-cols-4` grid — 7 does not divide by 4,
  so the last row is permanently ragged. No time-range control, no trend, no sparkline.
- **Nothing is actionable.** The dashboard answers "how many" and never "what needs me". The one
  worklist signal that exists — `locationSetup` — is buried as a table column two clicks away.
- **Recency lists are dead ends.** "New doctors" and "Recent assessments" render names with no
  links. Only "New clinics" is clickable.
- **No platform search.** No way to resolve a clinic, doctor, patient, or assessment by id or name.
- **No "view as clinic".** The standard super-admin support tool is absent — notable because
  `loadDoctorShellData` already models `viewMode: "admin_view"`, so the concept exists in the
  codebase.
- **Funnel colours bypass the theme.** Hardcoded `bg-stone-100 text-slate-800` and similar rather
  than design tokens; the strip breaks in dark mode while the rest of the shell adapts.
- **Component drift.** `admin/audit/page.tsx` defines a local `Input` component instead of using
  the shared `@/components/ui/input` the rest of the console uses.
- **All-client data loading.** Every page is `"use client"` with fetch-on-mount. Two independent
  fetches on the dashboard, no RSC streaming, no skeletons. A funnel failure silently hides the
  card; a dashboard failure blanks the whole page.
- **No first-run state.** A zero-clinic platform renders empty cards and a funnel of zeroes.
- **English-only.** Nav labels are translated through `DictionaryPath`; every admin page body is
  hardcoded English, on a platform that ships 7 locales.

---

## 3. Revamp proposal

### 3.1 Target information architecture

Seven sections replacing today's five flat links:

```
Overview            Control tower — period KPIs, "needs attention", funnel with drill-through
Network             Clinics list · clinic 360° detail · (map when the slice lands)
People              Unified directory (org members, clinic members, doctors, patients)
                    + Invitations tab (wires the API that already exists)
Clinical Ops        Assessments explorer (failed-first) · orders · review SLA
                    · recommendation feedback · adverse events
Knowledge           Existing knowledge-review, renamed "Knowledge governance"
Platform            Settings · subscriptions & quotas · delivery health · orchestration health
Audit & Security    Audit log · admin action trail · view-as sessions
```

### 3.2 Overview page redesign

Replace the 7-card grid with three bands.

**Band 1 — Period KPIs.** Four cards behind a global range selector (Today / 7d / 30d / QTD):
Assessments · Approval rate · Kit orders · Active clinics. Each carries a trend versus the
previous equivalent period, and each is clickable through to its filtered list.

**Band 2 — Needs attention.** The single highest-value addition. A worklist, not counters:

| Signal | Source (all already in schema) |
|---|---|
| Failed assessments | `Assessment.status = FAILED` |
| Reviews breaching SLA | `submittedAt` age vs `reviewDecision IS NULL` |
| Clinics with no location pin | `locationSetupState()` — already computed |
| Pending invitations near expiry | `ClinicInvitation.status = PENDING` |
| Subscriptions over quota or past period end | `assessmentsThisPeriod` vs `monthlyAssessmentLimit` |
| Failed WhatsApp deliveries | `WhatsappDelivery.status` |
| Unreviewed adverse events | `AdverseEvent` |
| Open knowledge conflicts | `KnowledgeConflict` |

**Band 3 — Funnel + activity.** A period-scoped funnel with `NEEDS_REVISION` broken out as a leak
rather than a step, each stage clicking through to its filtered list; beside it, a live activity
feed from `AuditLog` — which becomes genuinely useful once admin actions are written to it.

### 3.3 Phasing

**P0 — Correctness (1–2 days).** Nothing new; make what already ships tell the truth.

- Fix the health score (align numerator and denominator to the same window, or replace it with a
  7-day rolling failure rate).
- Rename "Reports today" to what it counts.
- Add `deletedAt: null` to the funnel counts; move the funnel into `$transaction`.
- Split `NEEDS_REVISION` out of the `reviewed` stage.
- Delete `/api/admin/metrics` or wire it — do not leave both.
- Resolve `ORG_ADMIN`: either admit it in `loadSuperAdminShellData` and the `assert*` helpers, or
  drop it from `rootForRole` / `navForRole`.
- **Write audit rows on every admin mutation** (clinic create / update / lifecycle, platform
  settings, locations) using the existing `writeAuditLog`.
- Quote CSV fields properly; surface truncation when the 5000-row cap is hit.

**P1 — Make it actionable (~1 week).**

- Overview redesign: period selector, 4 trended KPIs, the "Needs attention" band.
- Drill-through links on every number and every recency row.
- Invitations UI, on the API that is already built and already audited.
- Doctors and Patients directories — read-only, searchable, platform-wide.

**P2 — Depth (~1–2 weeks).**

- Clinic 360° detail page: health, doctors, subscription and usage, locations, recent activity,
  lifecycle actions — replacing today's edit-form-only detail.
- Subscriptions and quota monitoring surface.
- Clinical ops explorer (assessments failed-first, orders, review SLA, recommendation feedback,
  adverse events).
- Delivery health and orchestration health panels.
- "View as clinic", audited as a first-class event.

**P3 — Completeness.**

- Network map (the `locationSetup` column is already waiting for it).
- i18n for the admin page bodies.
- Admin test suite — the auth boundary, each API contract, and the metric arithmetic in particular.
- Theme tokens for the funnel; drop the local `Input` in the audit page.

### 3.4 Sequencing note

P0 is worth doing before any visual work. Four of the numbers currently on the Super Admin
dashboard are either wrong or mislabelled, and the archive action deletes a tenant without a
trace. Redesigning around figures that cannot be trusted would bake the defects into the new
layout.

---

## 4. Summary

The console is **one-seventh built**. Clinic management is genuinely good, and the authorisation
chain behind it is correct on all three layers. Everything else on the platform — doctors,
patients, assessments, orders, subscriptions, invitations, organisations, safety events,
delivery, orchestration — has schema support and no surface.

The dashboard's specific failing is that it reports rather than directs: seven counters, no
period control, no worklist, and no link out of any number. The highest-leverage single change is
the "Needs attention" band, because every signal it needs already exists in the database.

The most urgent change is a different one: **admin actions are not audited**, and clinic archive
is a silent tenant soft-delete.
