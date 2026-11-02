# HAiROS — Phase A Execution Log (Controlled Production Recovery)

**Date:** 2026-11-02 · **Objective:** a healthy assessment→consultation pipeline (not merely green CI).

## 1. Code fix — gates #1 & #2 (done, reviewed, deployed)

- **Gate #1 (no privilege bypass):** the orchestrator clinic guard is **unchanged** from production
  (`isSuperAdmin`-only; byte-identical). The pipeline now reads `Assessment.clinicId` from the DB and
  presents it as the access context (`ensureConsultation.ts`), passing the existing clinic-equality guard
  legitimately, scoped to exactly the owning clinic. `role: "SYSTEM"` is provenance only (no read privilege;
  excluded from `REVISE_ROLES` → can never approve). There is **no SYSTEM backdoor** (pinned by tests:
  `SYSTEM` + wrong/`null` clinic is denied `Cross-clinic access denied`).
- **Gate #2 (no false success):** `runStage` takes an honest-outcome mapper; `consultationStageOutcome`
  maps created/existing → `SUCCESS`, `failed` (swallowed error) → `FAILED`, `skipped` (not_composable) →
  `SKIPPED`. The duplicate FAILED row is removed — one honest `OrchestrationLog` row per stage. A swallowed
  persistence error can no longer be logged as SUCCESS.

## 2. Tests — gate #3

- `tests/consultation-orchestrator/access-and-events.test.ts`: pipeline actor with the assessment's own
  clinic composes (fails later only `not_composable`); **different clinic** and **null clinic** → denied
  `Cross-clinic access denied`; wrong-clinic doctor → denied; pipeline actor can **never revise/approve**.
- `tests/assessment-orchestrator/ensure-consultation.test.ts`: real creation, persistence, existing/idempotent
  retry, failed creation, per-assessment clinic scoping, and `consultationStageOutcome` (SUCCESS only when
  persisted).
- **Results:** 24/24 in the two affected suites; **89/89** across the jest orchestrator suites; `tsc`
  clean on the changed files. Blocking CI **`Release gate (blocking)` = success** on `70a7b46`. (The
  `Legacy baseline (informational)` job is `continue-on-error` and fails pre-existing/environmental on the
  base — not this change; documented on PR #47.)

## 3. Deployment — gate #4 & #5

| Item | Value |
|---|---|
| PR | divesh2ai/hair-diagnostic#47 (merged) |
| Fix commits | `52d1b2d`, `70a7b46` |
| Merge commit (production branch `claude/acube-launch-fix`) | **`eaf407510e686e4eaca29c8421b2e8478ad15d56`** |
| Production build of the fix | **`dpl_As9tC5BKGMBKyS8wKevSuCAkwMEP`** — state **READY** |
| Prior production deployment (rollback target) | `dpl_AWnkzUDbS9Hycd36T1bYeMDEaUbP` (`3653bd4`) |
| Production branch / project / region | `claude/acube-launch-fix` / Vercel `hairos` / `bom1` |

- **Gate #4:** the production branch is the **real Next.js app** (framework nextjs, root `apps/patient-portal`,
  LAMBDAS) — not the legacy HTML. Preview of the fix (`dpl_H6bTijMBA1h1tTZ8Rdjs4ZDB6xu2`) built READY.
- **Rollback path (documented):** promote/rollback to `dpl_AWnkzUDbS9Hycd36T1bYeMDEaUbP`, or revert the merge
  commit on `claude/acube-launch-fix` and redeploy. (The fix is additive to the auth context and reverts the
  guard to production-identical, so rollback is low-risk.)
- **⚠️ Promotion status:** the fix build is READY but the **production alias has not cut over** — the newest
  `target=production` deployment is still `dpl_AWnkzUDbS9` (`3653bd4`). The release needs the fix build
  promoted to production (Vercel: promote `dpl_As9tC5BKGMBKyS8w`, or confirm the project's auto-promotion).
  **This is pending and must be completed for the live pipeline/dashboards to carry the fix.** (It does **not**
  block the recovery script in §4, which runs the fixed repo code directly.)

## 4. Consultation recovery — gates #6–8 (prepared; execution blocked on a credential boundary)

The only clinically-correct, report-safe recovery is to run the composition engine via the **same**
orchestrator entry point (`ensureConsultationForAssessment`): compose v1 from the **stored** questionnaire,
persist Consultation + ConsultationVersion, **no approval**, **no Phase B / no report regeneration**,
idempotent.

- It **cannot** be done via SQL (that would fabricate clinical content — forbidden) and **must not** use
  `POST /api/assessment/orchestrate`, which re-runs full Phase A **and Phase B** (narratives + PDF) — i.e.
  report regeneration, which this phase forbids.
- Delivered mechanism: **`scripts/recover-consultations.ts`** — idempotent, dry-run by default, `--commit`
  to write; recovers the 7 priority IDs then the 3 remaining; after each write it **verifies** the
  consultation is persisted, `clinicId == assessment.clinicId`, and `approvalStatus == PENDING_REVIEW`
  (asserts no approval was created). Full production IDs are embedded (verified 2026-11-02).
- **Execution constraint:** the script needs the production `DATABASE_URL` (Prisma direct connection). This
  sandbox has Supabase SQL access only (no Postgres credentials), and Vercel env-var read is 403 for this
  role — so **I cannot run it from here**. It must be run from a context holding the production DB
  credentials (e.g. a maintainer shell, or a CI job), or recovery can instead be driven by a Super Admin
  opening each case in the now-fixed dashboard (lazy `getOrCreate` composes identically).
- **Recovered so far: 0 of 10.** All 10 remain (7 priority + 3 remaining). After execution, re-run the
  reconciliation ledger for the before/after with actual consultation IDs and approval statuses.

### Priority IDs (recover first, verify, then the remaining 3)
Dr Aggarwal: `cmvuynpmq000612ap4pcvge0v`, `cmvv1h436000459wd8ukgcs8c` · Acube: `cmvw47lno0006gm8pik9fsx24`,
`cmvw5wrox0006dzpgbl45od6m`, `cmvwfbws80006ie1k20uh9cs1` · Radiance: `cmvwioqtl0006kk6oe0e210z8`,
`cmvwmt8j400041444672qsdeo`. Remaining: `cmvaw9jwx0006my5051wc11gf` (tressze), `cmvhvpz6g00066ervmr9bdrfs`
(bala), `cmvkinw460006dfotj4xeqiqz` (acube).

## 5. Report worker (Workstream B) — read-only investigation + proposed repair (no queue drain/regeneration)

**Evidence.** 12 `ONE_PAGER_PNG` are `QUEUED`, `attemptCount=0`, `leaseId=null`, `createdAt==updatedAt`,
`nextAttemptAt == createdAt` → due since creation (earliest 10-15, ~18 days) and **never once claimed**.
`storageBucket`/`mimeType` null (set at claim). The worker has never executed against them.

**Configuration.** Worker: `apps/patient-portal/src/app/api/internal/report-assets/render` (GET sweep / POST
doorbell). Cron: `apps/patient-portal/vercel.json` → `0 2 * * *` (**once daily**), root `apps/patient-portal`
(correct — so the cron is in the right place). Auth: the route returns 401 unless the caller presents
`REPORT_RENDER_WORKER_SECRET` (`x-render-worker-secret`) or `CRON_SECRET` (`Authorization: Bearer …`, which
Vercel cron sends **only if `CRON_SECRET` is configured on the project**).

**Plan evidence.** The runtime-logs API reports **Hobby plan, 1-hour log retention** — so (a) historical cron
invocations are not visible, and (b) **Hobby crons run at most once/day and are best-effort**. Env-var read
and event-list are **403** for this session's Vercel role, so `CRON_SECRET` presence could not be confirmed.

**Most likely cause (to confirm with project-owner access):** the daily cron either never fires (Hobby
unreliability / not registered) or fires without `CRON_SECRET` set → 401 before any claim → `attemptCount`
stays 0. Either leaves exactly this signature.

**Proposed repair (NOT executed — do not drain/regenerate yet):**
1. Confirm `CRON_SECRET` (and `REPORT_RENDER_WORKER_SECRET`) are set in the Vercel **production** env; confirm
   the Cron Jobs tab lists `/api/internal/report-assets/render` as registered and firing.
2. If on Hobby, once/day is too slow for a clinic SLA and is unreliable → move to Pro (sub-daily crons, higher
   `maxDuration`) **or** drive the worker from an external scheduler/GitHub Action calling the endpoint with
   the worker secret.
3. Before enabling: validate bucket/MIME — PNG/PDF must target `report-assets` (the `one-pagers` bucket only
   permits JSON); the renderer settles the `storageBucket` on claim, so confirm it writes to `report-assets`.
4. Reconcile existing rows first (lease fields are already null/clean); then let the (fixed) sweep drain the
   12 — one invocation claims ≤ `MAX_LIMIT` with a lease, retry/backoff, and error persistence already coded.
5. Backfill the **6 READY PDFs'** missing `sha256`/`byteSize` **from the real stored bytes only** (download
   each `storagePath`, hash+size, write back) — never fabricated.

## 6. Phase B recommendation (evidence-backed)

Proceed to Phase B **after**: (a) the fix build is **promoted to production**; (b) the 10 consultations are
recovered and verified (clinic-scoped, PENDING_REVIEW, visible to the owning clinic's dashboard); (c)
`CRON_SECRET`/worker-secret and cron registration are confirmed. Phase B = enable the report worker on a
reliable schedule (Pro cron or external scheduler), drain the 12 PNG jobs with the existing lease/retry
controls, and backfill the 6 PDF hashes from real bytes — then re-reconcile all 26. Kits/pricing, WhatsApp,
Google-doctor login + Yavana QR, and RLS/Storage changes remain in their own later, separately-authorized
phases.

## 7. Phase A verdict

Fix **implemented, tested, merged, and built on production** (promotion pending). Recovery **prepared and
verifiable** but not yet executed (credential boundary). **No consultations have been fabricated, no reports
regenerated, no approvals created, no RLS/Storage/WhatsApp/QR actions taken.**
