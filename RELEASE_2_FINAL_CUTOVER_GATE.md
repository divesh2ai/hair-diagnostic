# HAIROS — RELEASE 2 · FINAL PRODUCTION CUTOVER GATE

**Date:** 2026-10-31 · **Target cutover:** Monday 2026-11-02 (if gates pass).
**PR:** divesh2ai/hair-diagnostic#35 @ `0b0c8c5` · **Base (production branch):** `claude/acube-launch-fix` (`3653bd4`).
**First clinic:** Acube Aesthetics. **Features:** Consultation Notes, Partial Kit Purchase tracking, Follow-up/Treatment History.
**Mode:** read-only + staging dry-runs only. **No** production migration, merge, deploy, or purchasing enablement performed.

> **FINAL VERDICT: CONDITIONAL GO.** Every schema / data-safety / isolation / trigger / migration-integrity gate is **PASS** with environment-real evidence. Two items require an operator action I cannot perform from this sandbox before cutover: **(1)** confirm the preview/production *private* `DATABASE_URL` wiring, and **(2)** one authenticated UI + microphone acceptance pass by Dr Test A. Monday is achievable if both pass. **Purchasing stays OFF** at cutover (see §Tracking-vs-Purchasing).

---

## PASS / FAIL per gate

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Preview **private** backend targets staging | **⚠ UNVERIFIED (operator)** | Preview **public client** carries staging ref `vbkoupvduadmcxggtnsb`, no prod URL (Codex preview-asset check). Private server `DATABASE_URL` **not readable here** — Vercel env API returns 403 to this session and no Vercel CLI is installed. Operator must confirm in Vercel → `hairos` → Settings → Environment Variables that **Preview**-scoped `DATABASE_URL` → `vbkoupvduadmcxggtnsb`, not `pykoyxbleowxwechotth`. |
| 2 | Dr Test A authenticated note / **microphone** / partial-kit / follow-up | **◑ PARTIAL** | Write-path **logic** PASS: note & partial-kit writes accepted by DB triggers (§Gate 5); app orchestration green in PR's blocking **Release gate** CI (per readiness doc: 492 tests/44 files incl. 11 Postgres integration tests). **NOT testable from sandbox:** live dictation/microphone, typed fallback, save→refresh persistence, panel/follow-up rendering (app host proxy-blocked, no browser). Operator runs the script below. |
| 3 | Dr QA B cross-clinic isolation | **✅ PASS** | RLS: simulated DOCTOR JWT in one clinic sees **0** of another's notes/lines/events/transactions (Dr Test A's clinic sees nothing of either seeded clinic). Triggers additionally **reject** cross-tenant *writes* (§Gate 5). Isolation enforced on both read (RLS) and write (triggers). |
| 4 | Selected-kit transactions, synthetic (4 recommended, 2 purchased, 2 deferred, later purchase, refund) | **✅ PASS** | Executed as a staging dry-run (`BEGIN…ROLLBACK`) on order `zsyn-koi-A`. Derived state exact: `txns=2` (1 PAID, 1 REFUNDED), `events=4` (3 purchase-confirmed, 1 refund), `lines_purchased=3`, `lines_deferred=1`. Staging unchanged. |
| 5 | New transaction + consultation-note triggers accept legitimate writes | **✅ PASS** | Positive: legit note accepted (n=1); all transaction/event writes in §Gate 4 accepted. Negative (must reject): wrong-clinic event → `purchase_event_association` (23514); wrong-clinic note → `note_association`; wrong-clinic transaction → `transaction_association`. All rolled back. |
| 6 | Reconcile staging migration checksum with applied SQL | **✅ PASS** | Migration #1 staging checksum == frozen file (`427d8f28…863011`). Migration #2 staging objects match the frozen variant exactly (both `r2_*` uniques, both `r2_line_*` composite FKs, superseded `release2_line_associations` trigger absent, 3 assoc triggers present, 2 enum values, 2 new columns). Stale recorded checksum reconciled on staging: `cddba5f2…874d` → `5c1b4a4d…555019` (matches frozen file). |
| 7 | Safe production migration procedure accounting for the failed Prisma row | **✅ PASS (prepared)** | Production `_prisma_migrations` is baselined/stale (last real entry 2026-09-11) with a **dangling failed** `20260626_phase3_admin` row (`finished_at` NULL, not rolled back) → `prisma migrate deploy` would refuse (P3009) and replay ~35 applied migrations. Procedure below applies the two SQL files **directly** and records history **only after object verification** (reconciliation-backed, not blind). |
| 8 | Production existing records & governed prices preserved | **✅ PASS** | Baseline intact: 10 clinics (all active), 10 doctors, 20 patients, 20 assessments. Acube Aesthetics (`ccf1d8f1911e95f18366d848c`) active + Dr Avinash Agarwal provisioned ACTIVE. Migration #1 touches no existing object; migration #2 only **adds** constraints/columns (composite uniques on existing PKs — guaranteed to succeed, no data change). R2 references none of `Kit`/`KitPrice`/`KitProduct`/`ProductPrice*` — governed pricing structurally untouched. |

**Gates 3–8: PASS. Gate 2: PARTIAL (one operator UI+mic pass outstanding). Gate 1: operator verification outstanding.**

---

## Dr Test A acceptance script (gate 2 — operator, on the staging app)
1. Sign in as **Dr Test A** (*DrFACT Mumbai Test*; use Chrome Incognito if an extension blocks OTP) → dashboard scopes to that clinic only.
2. Open a patient under review → add a consultation note **by microphone dictation**, then **by typing**; save; refresh → both persist, dated + authored; confirm **no new ConsultationVersion** was minted.
3. On an approved 4-kit order → record **2 purchased**, **defer 2** → tracker shows recommended vs purchased/remaining with dates.
4. Patient profile → **Follow-up/Treatment History** shows recommended + obtained across visits.
5. Sign in as **Dr QA B** (*DrFACT Pune Test*) → confirm **none** of Dr Test A's notes/lines/events are visible.
6. *(Only when purchasing is later accepted — not for this cutover)* with `PURCHASING_ENABLED=on` on staging, run a `PartialKitCheckout`, a later purchase, and a refund → `KitPurchaseTransaction` rows appear; re-check isolation.

---

## Exact production migration — scripts & execution order

> Apply against **production `pykoyxbleowxwechotth`** only under your separate cutover authorization. Apply the **reviewed frozen files verbatim** (do not retype). Canonical sources + checksums:
> - `prisma/migrations/20261023_doctor_notes_and_partial_kit/migration.sql` — sha256 `427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011`
> - `prisma/migrations/20261030_partial_checkout_transactions/migration.sql` — sha256 `5c1b4a4dd4f3394f17ed97744f94efb07764d6bcff2800c3572d8487a1555019`

**Step 0 — PITR checkpoint.** Note the Supabase PITR timestamp immediately before starting (recovery anchor).

**Step 1 — pre-flight re-check (read-only). Must return all-absent / all-present:**
```sql
select
 (select count(*) from information_schema.tables where table_schema='public'
   and table_name in ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction'))::int as r2_tables_present,   -- expect 0
 (select count(*) from pg_type where typname='KitPurchaseEventType')::int as r2_enum_present,                                         -- expect 0
 (select count(*) from pg_constraint where conname in ('r2_order_clinic_assessment_key','r2_assessment_clinic_patient_key'))::int as r2_constraints, -- expect 0
 (select count(*) from information_schema.tables where table_schema='public' and table_name='KitOrderIntent')::int as kit_order_intent, -- expect 1
 (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('jwt_is_super_admin','jwt_user_role','jwt_is_clinic_member'))::int as jwt_fns;                                   -- expect 3
```

**Step 2 — apply migration #1** (`20261023_…`). Additive. Wrap the file body in a transaction:
```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
-- <<< paste 20261023_doctor_notes_and_partial_kit/migration.sql verbatim >>>
COMMIT;
```

**Step 3 — apply migration #2** (`20261030_…`) **verbatim** — the file already contains its own `BEGIN … COMMIT` with `lock_timeout`/`statement_timeout` and `ALTER TYPE … ADD VALUE IF NOT EXISTS`. Run the file as-is (do not wrap again).

**Step 4 — verify objects (read-only). Expect every count as noted:**
```sql
select
 (select count(*) from information_schema.tables where table_schema='public'
   and table_name in ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction'))::int as tables,          -- 4
 (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction')
   and c.relrowsecurity)::int as rls_enabled,                                                                                     -- 4
 (select count(*) from pg_trigger where tgname in
   ('release2_event_associations','release2_note_associations','release2_transaction_associations'))::int as triggers,            -- 3
 (select count(*) from pg_constraint where conname in
   ('r2_order_clinic_assessment_key','r2_assessment_clinic_patient_key','r2_line_order_clinic_assessment_fkey','r2_line_assessment_clinic_patient_fkey'))::int as r2_constraints, -- 4
 (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='KitPurchaseEventType' and e.enumlabel in ('EXTERNALLY_OBTAINED','CONTINUED'))::int as new_enum_values,        -- 2
 (select count(*) from information_schema.columns where table_schema='public' and table_name='KitPurchaseEvent'
   and column_name in ('transactionId','substituteKitId'))::int as new_event_cols;                                               -- 2
```
Then re-run the **isolation probe** (expect 0 cross-clinic) and the **negative trigger controls** (expect the three `*_association` rejections) as `BEGIN…ROLLBACK` dry-runs on production, exactly as validated on staging.

**Step 5 — record migration history (reconciliation-backed; NOT `migrate deploy`, NOT blind).** Only after Step 4 passes, insert two rows with the **frozen checksums** so future tooling sees them as applied:
```sql
insert into public._prisma_migrations (id, checksum, finished_at, migration_name, logged_at, applied_steps_count)
values
 (gen_random_uuid()::text, '427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011', now(), '20261023_doctor_notes_and_partial_kit', now(), 1),
 (gen_random_uuid()::text, '5c1b4a4dd4f3394f17ed97744f94efb07764d6bcff2800c3572d8487a1555019', now(), '20261030_partial_checkout_transactions', now(), 1);
```
*Do not run `prisma migrate deploy`.* The dangling `20260626_phase3_admin` row is a **separate, pre-existing** hygiene item; leave it unless the team separately decides to `prisma migrate resolve` it — it is not required for Release 2 because the SQL is applied directly.

**Step 6 — deploy app.** Merge PR #35 into `claude/acube-launch-fix` (separate authorization), deploy the **known-green SHA** (`0b0c8c5` or its merge commit) to production, and **confirm the Vercel production build is READY** (the project's latest deployment currently shows `ERROR` — deploy a clean green build). Keep `PURCHASING_ENABLED=OFF`.

**Step 7 — post-deploy smoke.** Dr Avinash Agarwal signs in → dashboard scoped to Acube → add one consultation note + record one partial-kit action → persists; confirm no cross-clinic visibility.

---

## Rollback procedure

**Tier 1 — app-only (preferred, instant, no data loss).** Redeploy the previous production SHA. Every Release 2 surface then degrades to HTTP 503 `*_not_provisioned`; the new tables remain but are unused. Use this for any app-level issue.

**Tier 2 — full DB rollback (only if the schema itself must be removed).** **Export `ConsultationNote` / `KitPurchase*` first if any real row exists** (operational/commercial record). Then, in one transaction, reverse order:
```sql
BEGIN;
DROP TRIGGER IF EXISTS release2_transaction_associations ON "KitPurchaseTransaction";
DROP TRIGGER IF EXISTS release2_note_associations ON "ConsultationNote";
DROP TRIGGER IF EXISTS release2_event_associations ON "KitPurchaseEvent";
DROP FUNCTION IF EXISTS public.check_release2_associations();
ALTER TABLE "KitPurchaseLine" DROP CONSTRAINT IF EXISTS "r2_line_assessment_clinic_patient_fkey";
ALTER TABLE "KitPurchaseLine" DROP CONSTRAINT IF EXISTS "r2_line_order_clinic_assessment_fkey";
ALTER TABLE "Assessment"     DROP CONSTRAINT IF EXISTS "r2_assessment_clinic_patient_key";
ALTER TABLE "KitOrderIntent" DROP CONSTRAINT IF EXISTS "r2_order_clinic_assessment_key";
DROP INDEX IF EXISTS "KitPurchaseEvent_transactionId_idx";
ALTER TABLE "KitPurchaseEvent" DROP COLUMN IF EXISTS "transactionId";
ALTER TABLE "KitPurchaseEvent" DROP COLUMN IF EXISTS "substituteKitId";
DROP TABLE IF EXISTS "KitPurchaseTransaction";
DROP TABLE IF EXISTS "KitPurchaseEvent";
DROP TABLE IF EXISTS "KitPurchaseLine";
DROP TABLE IF EXISTS "ConsultationNote";
DROP TYPE IF EXISTS "KitPurchaseEventType";      -- also removes the 2 added enum values
DROP TYPE IF EXISTS "KitPurchaseLineStatus";
DROP TYPE IF EXISTS "ConsultationNoteStatus";
DROP TYPE IF EXISTS "ConsultationNoteInputMode";
DELETE FROM public._prisma_migrations WHERE migration_name IN
 ('20261023_doctor_notes_and_partial_kit','20261030_partial_checkout_transactions');
COMMIT;
```
(An added enum value cannot be dropped individually; dropping the type after its dependent tables handles it.) PITR from Step 0 is the last resort.

---

## Deployed tracking vs. enabled purchasing — explicit distinction

| | **Deployed tracking** (this cutover) | **Enabled purchasing** (separate, later) |
|---|---|---|
| Flag | `PURCHASING_ENABLED = OFF` | `PURCHASING_ENABLED = ON` |
| Live for doctors | Consultation Notes; Partial-Kit **tracking** (record purchased / deferred / declined / dispensed / treatment-started / external-obtained — quantity & clinical-state events); Follow-up/Treatment History | Everything in tracking **plus** money: `PAYMENT_RECORDED` events and the `KitPurchaseTransaction` clinic-counter **checkout** path |
| Dormant | `KitPurchaseTransaction` / checkout money path (tables exist, code gated) | — |
| Acceptance needed | Gate 2 UI+mic pass (Dr Test A) | Its own acceptance: §gate-2 step 6 on staging with purchasing ON, plus operational/fulfilment reconciliation (order-level summaries are not yet migrated to transaction-level accounting) |
| Risk | Low — additive schema, isolation proven, no money movement | Higher — exercises commerce/payment code never run at runtime (0 transaction rows anywhere) |

**This cutover delivers tracking only.** Enabling purchasing is a distinct decision and release, gated separately, and will not be done without your explicit authorization.

---

## Outstanding before Monday 2026-11-02
1. **Operator:** confirm Preview/production **private `DATABASE_URL` → staging** for preview (Gate 1).
2. **Operator:** complete the **Dr Test A UI + microphone acceptance** script above, and the Dr QA B isolation check in the app (Gate 2).
3. **At cutover:** apply the two migrations per the procedure, deploy the **green** SHA (not the current ERROR deployment), keep **purchasing OFF**.

No production migration, merge, deploy, or purchasing enablement will occur without your separate authorization.
