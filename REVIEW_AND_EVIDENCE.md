# PR #42 — Independent Review, B2/B4 Evidence, Pilot & Blockers

**Date:** 2026-10-28 · Branch `claude/modest-albattani-dw6gl1` · PR stays **Draft**.
Scope this round: **no execution, no migrations applied, no provisioning, no promotion, no merge.**

---

## 1. Independent code review of the recovery endpoint — obtained & addressed

An independent review (separate reviewer pass over `HEAD~1..HEAD`) assessed authorization,
idempotency, and audit logging. Findings and resolutions:

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | Execute path `await`ed `resumeOrchestration()` (backoff + full A+B pipeline) **serially inline** for up to 25 jobs → lambda timeout mid-loop, recreating the abandonment it cures. | High | **Fixed.** Re-drives now run in an `after()` callback (mirrors the sibling `/api/assessment/orchestrate` route); the response returns immediately with the **dispatched** plan. Batch hard-capped at 25. |
| 2 | `live_lease` guard only covers Phase A; Phase-B statuses (`GENERATING_REPORT`/`REPORT_GENERATING`) have no lease, so a still-rendering row could be re-driven. | Medium | **Documented + bounded.** Double Phase-B is prevented by the orchestrator's status compare-and-set + unique `AIArtifact(assessmentId,type)` constraint; the >60-min staleness (≫ a healthy run) is the guard. Noted in `stalledRecovery.ts`. |
| 3 | No idempotency/locking against a retried/concurrent execute call. | Medium | **Mitigated** by #1 (fast response removes the timeout that caused retries) + the retry-ceiling + per-job status re-check. Full distributed locking belongs with the durable queue (B3). |
| 4 | Reported `requeued: true` + audited even when `resumeOrchestration` silently no-ops (retry ceiling / ineligible). | Medium | **Fixed.** Response now says `dispatched` (honest about async). Per-job audit records real `statusBefore`→`statusAfter` and a `reDriven` boolean, so a declined resume is logged as no-change, never as a false requeue. |
| 5 | 100-row scan cap could silently hide excess stalled jobs. | Low | **Fixed.** Scan cap raised to 200 and `scanTruncated` is surfaced in the response. |
| 6 | `retryCount` treated as sweeper-only but is a shared resume budget. | Low | **Fixed.** Corrected the doc to state it is the TOTAL re-drive budget across all resume paths (intentional). |

The selector itself was found clean and well-tested. All fixes are in this PR; tests re-run green.

---

## 2. B2 — stalled-job recovery **dry-run evidence** (no execution)

The real selector was run over the **live staging stalled rows** (read-only snapshot; masked ids).
No endpoint was executed and **no assessment record was changed.**

Input (5 candidates, all `retryCount=0`, no lease, stale 15–65 days):
`cmt74rmm` REPORT_GENERATING · `cmt74rms` GENERATING_REPORT · `cmt74rne` QUEUED (all DrFACT Mumbai, since 2026-08-24) · `csynthac`×2 PENDING (Acube, since 2026-10-13).

Dry-run plan the endpoint would return:
```json
{ "eligible": [ 5 rows — all above ], "skipped": [], "staleAfterMinutes": 60, "maxRetries": 3, "limit": 25 }
```
→ **All 5 are eligible, 0 skipped.** Execution (`{ "execute": true }`) remains **deferred pending approval**.

---

## 3. B4 — staging RLS remediation **prepared for review** (not applied)

- Proposal SQL: `prisma/proposals/20261028_rls_remediation_17_tables.PROPOSED.sql` — deliberately
  **outside** `prisma/migrations/` so it cannot auto-apply. Enables RLS + clinic-scoped policies on
  all **17** advisor-flagged tables, reusing the existing `jwt_is_super_admin()` /
  `jwt_is_clinic_member()` helpers (+ 2 new SECURITY DEFINER helpers for doctor/order-scoped tables).
- **Safe for the app:** server-side access is Prisma via service-role/direct connection, which
  **bypasses RLS** — enabling it only closes the anon/PostgREST door, exactly like the ~40 tables
  already protected.
- Tiering: Tier 1 (direct `clinicId`, incl. **ReportAsset** 159 rows, SupportTicket/Message,
  KitOrderPayment, ClinicKitFulfilment, Appointment, Brochure/Hotspot) = high-confidence; Tier 2
  (commerce, doctor-scoped, currently empty + purchasing gated) flagged for tenancy confirmation.
- Regression guard: `tests/admin/rls-remediation-proposal.test.ts` (20 tests) statically verifies the
  proposal covers exactly the 17 tables with RLS + a clinic-scoped/super-admin policy each — fails if
  a sensitive table is ever dropped. DB-level negative tests (anon key → 0 rows; clinic-A JWT → 0
  clinic-B rows) are scripted in the SQL's post-apply section, to run against staging **after** apply.
- **Not applied. Production not inspected** — check separately before any prod change.

---

## 4. B1 — bulk provisioning **deferred**; pilot clinics identified

No provisioning performed. Evidence-based pilot status:

- **Acube Aesthetics — confirmed active pilot.** Its sole doctor is the only `ACTIVE`/access-ready
  account (source `acube-p0-2026-10-13`), it holds real assessments, and the prior cross-clinic
  security investigation centred on it. This is the one clinic operationally live today.
- **13 launch-cohort clinics** (`launch-cohort-2026-09`) + **DrFACT Mumbai** (2 doctors) — doctor
  records exist but **unprovisioned**; these are candidates, **not** confirmed-approved pilots.

**Action needed from you:** the authoritative list of approved pilot clinics. I will not provision
beyond confirming Acube's existing state until you name the set (B1 stays deferred).

---

## 5. Remaining blockers (owners / evidence)

| # | Blocker | Owner | Status / evidence |
|---|---|---|---|
| B1 | 14/15 doctors unprovisioned | Ops + approver | Deferred. Awaiting approved pilot list. Matrix in `LAUNCH_READINESS_HairOS.md §3`. |
| B2 | 5 stalled jobs not re-driven | Super Admin + approver | Recovery endpoint hardened + dry-run proven (§2). Execution awaits approval. |
| B3 | No durable queue (root cause of B2) | Eng | Inngest scaffolded, unwired. Sweeper is the interim lever; schedule it or wire Inngest. |
| B4 | 17 RLS-disabled tables (incl. ReportAsset) | Eng + DBA | Remediation + tests prepared (§3). Not applied. **Production not checked.** |
| B5 | Prod alias serves stale pre-fix branch | Release | Promote verified branch after review. Not done (no promotion). |
| B6 | Mixed jest/vitest obscures CI | Eng | Noted; not changed. |

**Recommendation unchanged: NO-GO** until B1, B2, B4 are actioned under approval. PR #42 remains Draft;
nothing merged, promoted, provisioned, executed, or migrated this round.

---

### Separately tracked (urgent Phase-1, not part of PR #42)
Doctor-notes workflow · doctor-specific landing page · active/inactive clinic dashboard — tracked as
distinct tasks for separate scoping/prioritisation, per your instruction.
