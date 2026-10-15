# HairOS — Clinic-wise Patient Report Storage: Production Remediation

**Active release: PR #28. Purchasing remains disabled. Read-only verification —
no production SQL executed, no buckets provisioned.** This extends
`docs/launch/PRODUCTION_READINESS.md` (B5) with the full report-storage picture
and the exact, reviewed changes. Migration-ledger reconciliation (B2/B3) stays
in `docs/launch/MIGRATION_RECONCILIATION.md`.

- Production Supabase: `drfact-hairos-production` / `pykoyxbleowxwechotth` (ap-south-1)
- Apply-script (review only): `docs/launch/apply/20261015_report_storage_hardening.sql`
- Acceptance test (runs on the PR #28 app branch): `tests/report-assets/clinic-isolation-identical-names.test.ts`

---

## Verdict summary

| Area | Verdict | One-line reason |
|------|---------|-----------------|
| Current report-storage implementation | **PASS (design) / GAP (prod)** | Two durable, versioned, ID-addressed systems exist and are correct; prod is missing the two buckets the one-pager system needs. |
| Clinic & patient isolation | **PASS (app layer) / GAP (DB defense-in-depth)** | Every doctor read/write is clinic-scoped server-side and keys are ID-addressed; prod has **0 RLS policies** so there is no DB-level backstop. |
| PDF persistence | **GAP** | The dossier PDF persists to `clinical-reports`+`AIArtifact`, but is **not versioned** (overwrites on revision) and **not in the ReportAsset ledger**. |
| PNG persistence | **PASS (design) / GAP (prod)** | The one-pager PNG pipeline is sound and serverless-ready, but **cannot reach READY in prod today** because `report-assets` (and `one-pagers`) do not exist. |

---

## What actually exists (traced in code)

There are **two complementary storage systems**, both keyed on immutable IDs
(`clinicId`, `patientId`, `assessmentId`, `consultationId`, `consultationVersionId`,
`contentVersion`) and never on patient name:

**1. One-pager system (modern, versioned, durable) — the launch target.**
- `one-pagers` bucket (private, JSON): immutable approved snapshot at
  `{assessmentId}/v{contentVersion}.json`, written at approval by
  `saveOnePagerSnapshot` with `upsert:false`. Source of truth for renders.
- `report-assets` bucket (private, PNG): rendered one-pager at
  `clinic/{clinicId}/consultation/{consultationVersionId}/one-pager/{patientSlug}-{assetId}.png`
  — **clinic-first key**, name only as a human-readable prefix on an id.
- `ReportAsset` row **is the durable queue**: carries all five IDs + `contentVersion`,
  a `render_key` UNIQUE on `(consultationVersionId, type, templateVersion, rendererVersion)`,
  a PENDING→RENDERING→READY/FAILED state machine, worker leases, bounded retry/backoff,
  `sha256` integrity, and a daily backfill sweep (`cron 0 2 * * *` →
  `/api/internal/report-assets/render`). Rendering uses `@sparticuz/chromium` +
  `playwright-core` (works on Vercel serverless; **not** the old
  playwright-install path). Immutable by construction: a revision approves as a
  new version → new row → new object, never a rewrite.

**2. Dossier PDF system (pre-existing) — the detailed patient report.**
- `clinical-reports` bucket (private, PDF): `reports/{assessmentId}/{slug}-report.pdf`,
  produced by `@hairos/packages/pdf-engine` via `@react-pdf/renderer` (no browser).
- Recorded as an `AIArtifact` row `type=REPORT` whose `content.patientPdfUrl` holds
  the bucket-relative object path; read back through short-lived signed URLs
  (`signReportUrl`, ≤300s). The GET/POST routes are fully clinic-gated.

---

## 1. Current report storage implementation — **PASS / GAP**

**PASS (design).** The one-pager system is a textbook durable pipeline: the row
is the queue, idempotent by a DB unique key, immutable per version, with leases,
classified failures, bounded retry, integrity hashes, and a reconciling sweep.
Writes never block the clinical approval; failures are reported truthfully
(`not_provisioned`, `bucket_missing`, `report_not_ready`, `upload_failed`).

**GAP (prod).** The two buckets the system writes to — `one-pagers` and
`report-assets` — **do not exist in production**. Until they do, `saveOnePagerSnapshot`
returns `bucket_missing` and `putReportAsset` returns `bucket_missing`, so the
ReportAsset row never reaches `READY`. The table itself is already present
(26 cols, 6 indexes, RLS enabled, 0 rows).

## 2. Clinic & patient isolation — **PASS (app) / GAP (DB)**

**PASS (app layer).** Confirmed in code and consistent with
`SECURITY_INVESTIGATION_CROSS_CLINIC.md`:
- `GET/POST /api/assessment/pdf` reject cross-clinic callers (403) and resolve
  the caller before any lookup (no existence oracle).
- `/api/doctor/patients` is hard-scoped to `doctor.clinicId` — no `?clinicId=`
  override — and returns `name` for display over an immutable `Patient.id` (cuid).
- `ReportAsset`/`Patient`/`Assessment` all carry an immutable `clinicId`;
  `ReportAsset.clinicId` is denormalised precisely so authorisation needs no join.
- Patient **names** are display-only; **IDs** are the storage/DB identity
  everywhere (proved by the acceptance test).

**GAP (DB defense-in-depth).** Production has **0 RLS policies** anywhere
(`public`, `storage.objects`, and `ReportAsset` itself). `ReportAsset` has RLS
*enabled* but *no policy* — default-deny for PostgREST, with the app working only
because it connects as the Prisma owner (bypasses RLS). There is no second line
of defense if an anon/authenticated path is ever introduced. Section 2–3 of the
apply-script add explicit clinic-scoped `ReportAsset` policies and
service-role-only `storage.objects` policies for the clinical buckets.

## 3. PDF and PNG persistence — **do not conflate them**

- **PNG (one-pager / `report-assets`): PASS design, GAP prod.** Generated,
  validated (PNG signature + IHDR + size bounds), uploaded, recorded on the
  ReportAsset row (`storageBucket`/`storagePath`/`sha256`), and retrievable via
  signed URL. **Blocked in prod only by the missing bucket.**
- **PDF (dossier / `clinical-reports`): GAP.** It *does* persist (bucket exists,
  react-pdf needs no browser) and is retrievable via signed URL, **but**:
  1. The object key is `reports/{assessmentId}/…` with **`upsert:true`**, and the
     `AIArtifact REPORT` row is upserted on `(assessmentId, type)`. A **revised**
     report therefore **overwrites** the prior PDF and prior `patientPdfUrl` —
     **historical approved PDF versions are not preserved** (contra requirement 7
     for the PDF path).
  2. It is **not** part of the ReportAsset durable ledger — no queue, lease,
     retry, or integrity hash; it is generated synchronously and the route 500s
     on failure.
  3. `ReportAssetType` defines `ONE_PAGER_PDF` / `PATIENT_REPORT_PDF` /
     `DOCTOR_SUMMARY_PDF`, but **none are ever created or rendered** — the
     pipeline only ever enqueues `ONE_PAGER_PNG`.

  **Conclusion: PDF persistence must not be claimed as durable/versioned on the
  basis of PNG success. The PNG is durable-by-design; the PDF is best-effort and
  mutable.** See the recommendation below.

---

## Missing production objects

| Kind | Object | State |
|------|--------|-------|
| Bucket | `one-pagers` (private) | **MISSING** |
| Bucket | `report-assets` (private) | **MISSING** |
| Bucket | `clinical-reports`, `clinical-images`, `doctor-avatars` | present, private ✅ |
| Table | `public."ReportAsset"` | present ✅ (RLS on, 0 policies, 0 rows) |
| Column | `WhatsappDelivery."reportAssetId"` | present ✅ |
| Policy | RLS policies for `ReportAsset` / `storage.objects` | **MISSING** (0 everywhere) |
| Function | `jwt_is_super_admin`, `jwt_clinic_id` (+ ~10 platform fns) | **MISSING** (only `custom_access_token_hook`, `rls_auto_enable` exist) |

No schema change is required for report storage — the table, column, and all six
indexes are already present.

---

## Exact proposed remediation (ordered; nothing executed here)

1. **Provision the two buckets** with the repo's reviewed, idempotent script —
   preserving existing conventions, not a new system:
   `npx tsx scripts/provision-storage.ts --allow-production` → creates
   `one-pagers` (2 MiB, `application/json`) and `report-assets`
   (5 MiB, `image/png`+`application/pdf`), both private; also converges any
   public→private drift and verifies by read-back.
2. **Apply the report-storage hardening SQL** (review only):
   `docs/launch/apply/20261015_report_storage_hardening.sql` — self-contained
   `jwt_clinic_id()` / `jwt_is_super_admin()` helpers, clinic-scoped `ReportAsset`
   RLS, and service-role-only `storage.objects` policies for the clinical buckets.
   Idempotent; the app (Prisma owner + service role) is unaffected.
3. **Set the worker env** so renders actually run: `REPORT_RENDER_WORKER_SECRET`,
   `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (for the dispatch doorbell + daily sweep).
   (Already on the §Preflight list.)
4. **Recommended before onboarding the four further clinics (not a launch blocker
   for Acube):** bring the dossier PDF under the same immutable discipline as the
   PNG — render `PATIENT_REPORT_PDF` through the ReportAsset pipeline
   (version-scoped key, `upsert:false`, queue + retry + hash), so revised reports
   keep their historical PDF versions instead of overwriting. Tracked separately;
   it is a code change, not a prod-DB change.
5. **Optional hardening (separate proposal):** re-key `one-pagers` and
   `clinical-reports` to be clinic-first (as `report-assets` already is) so object
   keys carry tenant isolation physically, not only at the app layer. Deferred to
   preserve existing versioned conventions for launch.

**Verification after apply:** the read-only queries at the foot of the SQL file,
plus running the acceptance test on the app branch
(`tests/report-assets/clinic-isolation-identical-names.test.ts`) and a staging
end-to-end: approve in two clinics with identically-named patients, confirm two
distinct READY ReportAsset rows, two distinct snapshots, two distinct signed
URLs, and no cross-clinic fetch.

---

## Accurate failure reporting (requirement 11)

The code already distinguishes, and the dashboards/logs should keep surfacing:
`not_provisioned` (migration not applied) · `bucket_missing` (provisioning step
owed) · `report_not_ready` (narrative pending) · `upload_failed` (incident) ·
and the ReportAsset `FAILED` state with a classified `errorCode`. **"Report
Saved" must be gated on a `READY` ReportAsset row (PNG) and/or a verified
`clinical-reports` object + `AIArtifact REPORT` (PDF) — never on a render
returning 200 alone.**

---

## ONE authorization request

> **Requesting authorization to execute the two production changes in steps 1–2
> against `pykoyxbleowxwechotth`, in a controlled window, exactly as reviewed:**
> **(a)** run `scripts/provision-storage.ts --allow-production` to create the
> private `one-pagers` and `report-assets` buckets, and **(b)** apply
> `docs/launch/apply/20261015_report_storage_hardening.sql` (report-storage RLS
> policies + claim helpers).
>
> Nothing else is requested: no migration-ledger reconciliation, no other
> buckets, no schema changes, no data writes, purchasing untouched.
