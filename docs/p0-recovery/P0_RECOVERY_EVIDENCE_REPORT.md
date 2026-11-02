# HAiROS — P0 Production Recovery: Evidence Report (Round 1)

**Date:** 2026-11-02
**Author context:** session on branch `claude/upbeat-knuth-j6n6fq`, based on the **actual production commit**.
**Production database:** `drfact-hairos-production` (`pykoyxbleowxwechotth`, ap-south-1, Postgres 17).
**Scope of this round:** read-only forensics + **one** verified, reviewable code fix (Workstream A root cause).
**No production writes, no migrations, no RLS changes, no WhatsApp sends, no QR issuance were performed.**

---

## 0. Production baseline — identified and verified

The GitHub repo attached to this session (`divesh2ai/hair-diagnostic`) has a `main` branch that contains
**only the legacy single-file HTML demo** (`DrFACT_v5_Demo.html` + a generic `next-saas-stripe-starter`
zip). That is the app the brief tells us **not** to use. The real Next.js monorepo lives on feature/release
branches of the same repo. The authoritative production target was resolved from Vercel:

| Item | Value |
|---|---|
| Vercel project | `hairos` (`prj_UPJJ2IOeo6xWlTuSAPz92ZyqhNRV`, team `team_mxyN3cO24XfuFVONUc85Twcz`) |
| **Live production deployment** | `dpl_AWnkzUDbS9Hycd36T1bYeMDEaUbP` — **READY**, target=production |
| **Production branch / commit** | `claude/acube-launch-fix` @ `3653bd49669bc80dc1d119499e83b91cbccfc31e` |
| Region | `bom1` |
| Supabase (prod) | `pykoyxbleowxwechotth` · staging also exists: `hairos-staging` (`vbkoupvduadmcxggtnsb`) |

**Deployment health warning:** the 6 most recent production deploy attempts (branch
`claude/optimistic-archimedes-ymw9sd`, newest `9bfb340`) are **all in ERROR state**. That branch is based on
the HTML-stub `main` (no root `package.json`), so Vercel's Next.js build fails. Production therefore still
serves the older READY build `3653bd4`. **Any new production deploy must come from a real-app branch**, not
from the stub-based `optimistic-archimedes` lineage.

### Baseline figures — all confirmed against production

| Brief claim | Verified | Source |
|---|---|---|
| 26 assessments COMPLETED | ✅ 26 / 26 total | `Assessment` |
| 10 have no consultation record | ✅ 16 consultations exist → 10 missing | `Consultation` |
| 13 have no report-asset records | ✅ 13 with 0 assets | `ReportAsset` |
| 20 lack a READY report asset | ✅ 6 have ≥1 READY → 20 lack | `ReportAsset` |
| All 26 recorded consultation-stage `Cross-clinic access denied` | ✅ 26 FAILED + 26 SUCCESS rows | `OrchestrationLog` |
| 12 ONE_PAGER_PNG QUEUED, 0 attempts, no lease | ✅ | `ReportAsset` |
| 6 PDF READY, missing SHA-256 + byte-size | ✅ every READY asset has null sha256/byteSize | `ReportAsset` |
| Kit / KitPrice / Product empty | ✅ 0 rows each | `Kit`,`KitPrice`,`Product` |
| 1 Acube WhatsApp SENT but provider `dev_accepted` | ✅ 1 `WhatsappDelivery` row | `WhatsappDelivery` |

The brief's baseline is **fully trustworthy**.

---

## 1. Root cause — consultation-stage `Cross-clinic access denied` (deliverable #1)

### Exact code location

- **Guard that throws:** `src/packages/consultation-orchestrator/orchestrator.ts`
  - `assertCanReadClinic()` (compose path) — threw `OrchestratorError("forbidden", "Cross-clinic access denied")`.
  - Previously gated only on `isSuperAdmin(role)` where `isSuperAdmin` returns true **only** for `role === "SUPER_ADMIN"`.
- **Defective caller (trusted pipeline):** `src/packages/assessment-orchestrator/persistence/ensureConsultation.ts`
  - Calls the orchestrator with `ctx = { actorId: "system:assessment-pipeline", role: "SYSTEM", clinicId: null }`
    and a comment asserting `clinicId: null` = super-admin. **That assumption was false** — the orchestrator
    keys privilege off the *role string*, never off a null clinicId.
- **Pipeline stage wrapper (misleading SUCCESS):** `src/packages/assessment-orchestrator/index.ts` (`runStage` + the `consultation` stage).

### Mechanism (why FAILED **and** SUCCESS, and why "sometimes no consultation")

1. At the end of Phase A the pipeline calls `ensureConsultationGuarded()` → `orchestrator.getOrCreateDetailed()`
   as the `SYSTEM` actor with `clinicId: null`.
2. For a brand-new assessment there is no stored consultation, so it reaches `composeAndStore()` →
   `assertCanReadClinic(a.clinicId, ctx)`. `isSuperAdmin("SYSTEM")` is **false**, then
   `ctx.clinicId (null) !== a.clinicId (real)` → **throws `Cross-clinic access denied`** for **every**
   assessment (no clinic-specific condition — it is universal).
3. `ensureConsultationGuarded` **catches and never rethrows** (by design — a consultation failure must not
   discard a good clinical run). It writes an explicit `OrchestrationLog(stage=consultation, status=FAILED)`.
4. The surrounding `runStage("consultation", …)` sees the callback **return normally** (no throw) and writes
   its own `OrchestrationLog(stage=consultation, status=SUCCESS)`.
   → **Every assessment therefore has one FAILED + one misleading SUCCESS row, and the pipeline persisted
   no consultation.**
5. The **16** consultations that exist were all created **lazily**, later, when a doctor opened the case via
   the consultation API with a correctly clinic-scoped `ctx` (that path passes the guard legitimately). The
   **10** assessments no doctor opened have **no consultation at all** — exactly the "success without a
   persisted consultation" the brief describes.

This is a **false-positive denial of the trusted server execution context**, not a real cross-clinic breach:
every real clinic read/write remained correctly scoped. (A separate, earlier dashboard/PDF cross-clinic
investigation lives in `SECURITY_INVESTIGATION_CROSS_CLINIC.md`; it is a *different* symptom on a *different*
branch and is not this failure.)

### Why existing tests did not catch it

`tests/assessment-orchestrator/ensure-consultation.test.ts` **mocks** `getOrCreateDetailed`, so the real
orchestrator guard never ran against the `SYSTEM` actor. The test even encoded the wrong assumption
(`clinicId: null` = super-admin). The pipeline→real-orchestrator integration was never exercised.

### Fix applied (this round) — minimal, isolation-preserving

- `orchestrator.ts`: introduced `isTrustedPlatformSystem(role)` (`role === "SYSTEM"`) and `isPlatformActor()`
  (super-admin **or** trusted system). The two read guards now allow a platform actor. `SYSTEM` is a
  **server-side constant** emitted only by the pipeline — it is **never** derived from client input or a JWT
  (verified: no source path outside the pipeline sets `role: "SYSTEM"`; all client roles come from
  `requireDoctorContext`). `SYSTEM` is **deliberately excluded from `REVISE_ROLES`** → it may *create* the
  canonical record but can **never revise or approve** it (honours "do not auto-approve during repair").
- `ensureConsultation.ts`: corrected the stale comment.
- **Tests:** added a real-orchestrator regression block in
  `tests/consultation-orchestrator/access-and-events.test.ts` proving (a) the `SYSTEM` actor **passes** the
  clinic guard on the compose path (fails later only as `not_composable`, never `forbidden`), (b) a
  wrong-clinic `DOCTOR` **still** gets `Cross-clinic access denied`, (c) `SYSTEM` revise is still `forbidden`.
  **Result: 19/19 in the two affected suites; 84/84 across the jest orchestrator suites. No regressions.**

**Cross-clinic isolation is preserved**: only a server-minted platform actor is admitted; every clinic member
remains scoped to their own clinic.

> ⛔ **Not done (held for authorization):** re-running the (now-fixed) pipeline consultation step for the 10
> missing cases is a **production write** to immutable clinical records. It is idempotent and preserves
> history, but it must be run explicitly and reviewably — see §6.

---

## 2. Reconciliation ledger — all 26 assessments (read-only)

Full table in [`RECONCILIATION_LEDGER.md`](./RECONCILIATION_LEDGER.md) (PII-redacted: assessment id suffix +
salted patient hash, no names/phones). Columns: clinic, consultation present, approval status, cross-clinic
FAILED/SUCCESS counts, asset counts, QUEUED PNGs, READY PDFs, READY-assets-missing-metadata, kit intent,
WhatsApp.

### Priority seven no-asset cases (all confirmed: no consultation, no assets, no reviewer)

| Day | Clinic | Assessment (suffix) | State |
|---|---|---|---|
| 10-30 | Dr Aggarwal's Clinic | `…cvge0v` | COMPLETED · no consultation · no review · no assets |
| 10-30 | Dr Aggarwal's Clinic | `…kgcs8c` | COMPLETED · no consultation · no review · no assets |
| 10-31 | Acube Aesthetics | `…9fsx24` | COMPLETED · no consultation · no review · no assets |
| 10-31 | Acube Aesthetics | `…45od6m` | COMPLETED · no consultation · no review · no assets |
| 10-31 | Acube Aesthetics | `…uh9cs1` | COMPLETED · no consultation · no review · no assets |
| 10-31 | Radiance | `…e210z8` | COMPLETED · no consultation · no review · no assets |
| 10-31 | Radiance | `…2qsdeo` | COMPLETED · no consultation · no review · no assets |

All seven are downstream of the §1 bug (no eager consultation) **and** were never opened by a doctor (no lazy
creation, hence no report generation). Recovering them requires: (a) the §1 fix deployed, (b) idempotent
pipeline re-run to compose the consultation, (c) doctor review/approval (human), (d) the report worker
(§3) to produce assets. **They are NOT report-ready and must not be represented as such.**

---

## 3. Report worker / asset queue — root-cause hypothesis (Workstream B, read-only)

- **Worker exists:** `apps/patient-portal/src/app/api/internal/report-assets/render/route.ts` (the only place
  Chromium launches). Claim/lease/retry live in `apps/patient-portal/src/lib/reports/assets/{jobService,repository,renderService}.ts`.
- **Schedule declared:** `apps/patient-portal/vercel.json` → cron `GET /api/internal/report-assets/render`,
  `0 2 * * *` (**once daily**, 02:00 UTC), region `bom1`, `maxDuration=60`, `runtime=nodejs`.
- **Auth required:** the route returns 401 unless the caller presents `REPORT_RENDER_WORKER_SECRET`
  (`x-render-worker-secret`) **or** `CRON_SECRET` (`Authorization: Bearer …`, which Vercel cron auto-sends
  only if `CRON_SECRET` is configured on the project).

**Why 12 PNG jobs show zero attempts and no lease — leading hypotheses (to confirm):**
1. **Cron never authorised / never fired.** If `CRON_SECRET` is not set in the production env, every daily
   sweep gets 401 and nothing is ever claimed → exactly zero attempts, no lease. (I could not list project
   env vars — Vercel returned **403 forbidden** for env-var read with this session's role — so this needs
   confirmation by someone with project access, or via Vercel function logs.)
2. **Plan limitation.** The project is on a personal account (`diveshs-projects`); Vercel **Hobby** restricts
   crons to once/day and does not guarantee timely firing — consistent with the daily schedule and with the
   brief's "Vercel plan limitation" hint.
3. **Cron not registered on the live build.** The live deployment response exposes no `crons` array; if the
   Vercel project root isn't `apps/patient-portal`, that `vercel.json` cron is never registered at all.

**Also for Workstream B:** all 6 READY PDFs have **null `sha256` and null `byteSize`** in the DB. Those must
be backfilled **from the real stored bytes only** (download each `storageBucket`/`storagePath` object, hash +
size, write back) — not fabricated. Bucket/MIME rule to verify before any PNG render: brief states
`one-pagers` bucket permits JSON while `report-assets` permits PNG/PDF; the renderer must target
`report-assets` for PNG/PDF or the store write will be rejected.

> ⛔ **Not done (held):** confirming env/cron (needs project access or logs), backfilling hashes (production
> writes + storage reads), and any worker re-run/claim changes.

---

## 4. Workstreams C–F — status (read-only triage only; nothing executed)

- **C (clinical/commercial):** both Dr Aggarwal cases (`…cvge0v`, `…kgcs8c`) are COMPLETED with **no
  consultation, no reviewer, no approval, no kit, no assets** — i.e. stuck pre-review by the §1 bug. `Kit`,
  `KitPrice`, `Product` tables are **empty**, so **no kit can currently be priced**; ordering must be blocked
  and the previously-identified ₹5,500 fallback must be removed at the code level (not yet audited this
  round). **No consultation may be auto-approved during repair.**
- **D (Acube WhatsApp):** 1 `WhatsappDelivery` row, status SENT but provider `dev_accepted`, no
  `reportAssetId`, no `deliveredAt`. A **real** provider send requires a consented test recipient, a
  clinically **approved** report asset, and verified webhook correlation — **all outward-facing; held for
  explicit authorization.**
- **E (Google auth / Yavana 2 branches):** `ClinicLocation` has exactly **2 rows** (Yavana Mulund + Bandra, as
  the brief states); `ClinicMember` and `ClinicInvitation` are **empty**. Doctor Google login, allowlisting,
  per-route membership checks, branch QR routing and `clinicLocationId` attribution are **not yet audited**;
  QR issuance is explicitly gated on tested attribution.
- **F (DB/Storage isolation):** RLS is **enabled on all public tables**. Policy posture, Storage object
  policies, signed-URL usage, and a **tested backup/restore before any policy change** are **not yet done**.
  Changing production access policy is destructive-risk and **held**.

---

## 5. What was changed vs. what was only inspected

**Changed (code only, on `claude/upbeat-knuth-j6n6fq`, reviewable, no deploy):**
- `src/packages/consultation-orchestrator/orchestrator.ts` — trusted-platform-actor recognition.
- `src/packages/assessment-orchestrator/persistence/ensureConsultation.ts` — comment correction.
- `tests/consultation-orchestrator/access-and-events.test.ts` — real-orchestrator regression tests.
- `tests/assessment-orchestrator/ensure-consultation.test.ts` — corrected assertion rationale.

**Inspected only (no mutation):** production Supabase (SELECT-only), Vercel project/deployments/env
(read; env list 403), repository branches.

---

## 6. Held-for-authorization checklist (destructive / outward-facing / unverified)

None of these were performed. Each needs explicit go-ahead and must stay separately reviewable:

1. **Deploy** the §1 fix to production (from a real-app branch, not the ERRORing stub lineage).
2. **Idempotent recovery re-run** of the consultation compose for the 10 missing cases (production write to
   clinical records; preserve original timestamps/history; no auto-approval).
3. **Report worker enablement**: set/confirm `CRON_SECRET` + `REPORT_RENDER_WORKER_SECRET`, confirm cron
   registration & plan, then let the (reconciled) queue drain. Backfill the 6 PDFs' `sha256`/`byteSize` from
   real bytes.
4. **Acube real WhatsApp golden path** (consented recipient + approved report + verified webhook).
5. **Kit catalogue load** + remove ₹5,500 fallback + block ordering when pricing absent.
6. **Google doctor login + clinic isolation** proof, then Yavana branch QR routing — **before** any QR print.
7. **DB/Storage RLS changes** — only after a **tested backup/restore** and migration rollback plan.

---

## 7. GO / NO-GO

**NO-GO for wider clinic rollout.** The assessment→consultation→approval→kits→report→WhatsApp pipeline is not
yet end-to-end proven in production: the consultation-stage root cause is fixed in code and tested but not
deployed; 10 cases have no consultation; 12 PNGs are unclaimed; 6 PDFs lack integrity metadata; kit pricing
is impossible (empty catalogue); no real WhatsApp delivery is evidenced; doctor Google login and clinic
isolation are unproven.

**GO (narrow):** the Workstream-A root-cause fix is correct, minimal, isolation-preserving, and test-verified
— ready for review and a production deploy from a real-app branch, as the first reviewable step of the
recovery sequence.

**Suspend further QR promotion / onboarding** until Workstreams B–F are proven, per the brief.
