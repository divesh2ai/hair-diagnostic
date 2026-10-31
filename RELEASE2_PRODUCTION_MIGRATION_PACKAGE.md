# Release 2 — Production Migration & Deployment Package (FINAL, FOR AUTHORIZATION)

**Scope decision (approved by author):** OPTION 2 — Migration **A + B** (+ production hardening **C**).
Rationale: the frozen app at `0b0c8c5` reads `KitPurchaseEvent.transactionId` / `substituteKitId`,
which only B creates; A alone is not schema-compatible with the application.

**Target production DB:** `drfact-hairos-production` / `pykoyxbleowxwechotth` (Supabase, ap-south-1, PG 17.6)
**Prepared:** 2026-10-31 — **read-only investigation only. NO production writes executed.**
**Status:** ⏸ HELD — scope approved; **execution NOT authorized.** Returns package and stops.

> This is approval of SCOPE only. No production database write, merge, deployment, or purchasing
> enablement happens until the author explicitly approves THIS final package, and the §7 backup
> evidence exists.

---

## 1. Exact package contents & checksums

Self-contained SQL lives in `release2-production-package/`. Apply in this order. A and B are
**byte-identical** to the reviewed PR #35 artifacts at head `0b0c8c5`.

**Recorded as ONE migration:** `20261031_release2_atomic` → **exactly one** row in
`supabase_migrations.schema_migrations`, never three. See §5 for the supported recorder.

| Role | File | SHA-256 |
|---|---|---|
| **APPLY & RECORD** — feed to the recorder (recorder owns the txn) | `00b_release2_atomic.record-form.sql` | `273900c92a964e94b1c67f5f4a366a3bf8832699b5836fbcf3b4a59c6bc146d9` |
| Frozen reference — self-contained `BEGIN/COMMIT`, for `psql -1` review only (not recorded) | `00_release2_atomic.sql` | `56f6d242e9b452ccc7ddff4ce2ca0ec3745fe0a855e27e2791b9ac15bfbef36d` |
| Component A (verbatim PR #35) | `01_…_doctor_notes_and_partial_kit.sql` | `427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011` |
| Component B (verbatim PR #35) | `02_…_partial_checkout_transactions.sql` | `5c1b4a4dd4f3394f17ed97744f94efb07764d6bcff2800c3572d8487a1555019` |
| Component C (hardening) | `03_…_release2_grant_hardening.sql` | `5151ca639e5663cfd3a2f62394257c07335a367bcd7ad87bb7af84953866e02f` |

- A and B are **byte-identical** to the reviewed PR #35 artifacts; A's checksum **matches the PR #35
  staging-verification banner** (`427d8f28…863011`).
- **Checksum caveat (honest):** your instruction to "keep the exact frozen bundle checksum" and your
  instruction to "use a supported migration-recording method that preserves the single transaction"
  **cannot both hold**, because the supported recorders wrap each file in their own transaction and an
  **embedded `BEGIN/COMMIT` is a documented cause of partial migrations** (Supabase KB: *"Partial
  migrations and schema inconsistencies from embedded transactions"*). The recorded artifact is
  therefore `00b_…record-form.sql` (`273900c9…`), which has the **same statement set and order** as the
  frozen `00_…` bundle with only the outer transaction control delegated to the recorder. The frozen
  `56f6d242…` bundle is retained for provenance / `psql -1` review.
- Verify before execution: `sha256sum release2-production-package/0{0,1,2,3}_*.sql` must reproduce the
  values above (`00b` is the one that gets applied+recorded).

---

## 2. Why migration C exists (the hardening you asked for)

**Finding (production, verified):** the `public` schema's DEFAULT PRIVILEGES auto-grant **ALL** table
privileges to `anon` **and** `authenticated` on every newly created table
(`pg_default_acl`: `anon=arwdDxtm/postgres`). So A and B's `CREATE TABLE` statements would, on their
own, leave the new Release-2 tables **writable by `anon` and `authenticated` at the GRANT level**. RLS
still gates rows, but the privilege itself must be removed — defense-in-depth, and your explicit
requirement that "anonymous and authenticated clients cannot write financial facts directly."

**Staging reference (verified grant matrix):**

| Table | staging `anon` | staging `authenticated` | staging `service_role` |
|---|---|---|---|
| `KitPurchaseLine` | (none) | **SELECT** | full |
| `KitPurchaseEvent` | (none) | **SELECT** | INSERT, SELECT |
| `KitPurchaseTransaction` | (none) | **SELECT** | full |
| `ConsultationNote` | **ALL (leak)** ⚠️ | ALL | full |

Migration C reproduces the hardened financial-table posture **and closes the `ConsultationNote` anon
leak staging still carries.** Resulting production posture:

- `anon` / `PUBLIC` → **no privileges** on any Release-2 table.
- `authenticated` → **SELECT only** on **all four** Release-2 tables, **including `ConsultationNote`**.
  A browser JWT can read (clinic-scoped under RLS) but can never write directly.
- `service_role` → full (server runtime).

> **Correction #1 (done, precondition verified):** `ConsultationNote` is now SELECT-only for
> `authenticated`. This does **not** break note saving/amend/auditing because the app writes
> `ConsultationNote` via **Prisma raw SQL over `DATABASE_URL`** (a direct privileged Postgres role),
> and the server runtime uses `service_role` — neither is the browser `authenticated` role. Verified in
> `apps/patient-portal/src/lib/notes/noteStore.ts` (`prisma.$queryRaw`/`$transaction` INSERT/UPDATE)
> and `lib/prisma.ts` (datasource = `DATABASE_URL`).

---

## 3. Preservation of the production baseline

Verified now (read-only): **10 clinics, 10 doctors, 22 patients, 22 assessments** (matches your stated
baseline). All migrations are additive — no existing row read-modified, no column retyped, no table
dropped. §7.1 asserts these exact counts are unchanged post-apply as a go/no-go gate.

- **Acube Aesthetics is NOT recreated.** Confirmed already ACTIVE with an active doctor; the package
  contains no clinic/doctor/patient INSERTs of any kind.
- **Kit prices untouched** (pricing lives in `KitPrice`/`ProductPrice`, outside these tables).

---

## 4. `PURCHASING_ENABLED` stays OFF — and the migration cannot flip it

`PlatformSettings` has **no purchasing column** (verified). `PURCHASING_ENABLED` is the **server-side
env kill-switch** (PR #28), not a DB value — so no migration here reads or changes it. Additionally:

- The `KitPurchaseTransaction` table may exist, but `authenticated` has **SELECT only**; a browser JWT
  **cannot self-assert `PAID`** (money transitions are `service_role`-only by design).
- **Verification attempt (correction #3):** I tried to read the flag via the Vercel API and got **403
  Forbidden** — this session's Vercel access cannot list project env vars, and the error says not to
  retry. So this is a **user-confirmed PASS/FAIL gate** (no secret values are to be printed): in
  Vercel → project `hairos` → Settings → Environment Variables, **Production** target, confirm
  `PURCHASING_ENABLED` is **absent or `false`** (the PR #28 kill-switch enables purchasing only when the
  value is exactly `true`). Confirm **before and after** apply. Creating the empty table is not enabling
  checkout; `authenticated` has SELECT-only on it and money transitions are `service_role`-only.

---

## 5. Execution plan — authorized Supabase migration process (NOT `prisma migrate deploy`)

**Do not run `prisma migrate deploy`.** Production's `_prisma_migrations` contains a **failed** row
`20260626_phase3_admin` (`finished_at` NULL, `rolled_back_at` NULL → Prisma **P3009**, deploy aborts)
and is stale (ledger stops 2026-06-26 while the live schema is months newer, advanced via the
**Supabase** ledger). We **do not alter that failed row** and we **do not touch the Prisma ledger** as
part of this release. Changes are applied and recorded through the Supabase migration channel
(`supabase_migrations.schema_migrations`), the same channel that applied the last 3 production changes
(`20260918122223`, `20261014053200`, `20261029093800`).

**Apply as ONE transaction via `00_release2_atomic.sql`** (correction #2 — no inter-step exposure):

- **The risk being closed:** if A, B, C were applied as three *separately committed* migrations, then
  after A commits its new tables carry production's default `anon`/`authenticated` ALL grants until C
  commits. RLS already blocks `anon` entirely in that window (A/B create policies only `TO
  authenticated`, so `anon` has no policy and is denied), but an `authenticated` clinic-member JWT could
  in that window write financial facts directly, bypassing server logic — until C revokes it.
- **The fix:** apply A→B→C inside a **single transaction** (`00_release2_atomic.sql`). The new tables are
  invisible to every other session until the one `COMMIT`, by which point C's REVOKEs are already in
  effect. There is **no committed intermediate state** with write exposure. Order is strictly A→B→C
  (C references A/B objects; B references A's enum/tables).
- **Supported recorder (correction — single record, no fabrication):** apply
  `00b_release2_atomic.record-form.sql` as **one** migration named `20261031_release2_atomic` via a
  method that *records* it:
    - Supabase CLI: `supabase migration new 20261031_release2_atomic` (paste the record-form body),
      then `supabase db push --db-url "$PROD_DB_URL"`; **or**
    - the management API / MCP `apply_migration` with name `20261031_release2_atomic` and the
      record-form body.
  Both write **exactly one** row to `supabase_migrations.schema_migrations`. **Do not** run the bundle
  through the bare SQL Editor and then hand-insert ledger rows, and **do not** record three separate
  entries — the bundle is one applied migration, so it is one record. No Prisma or Supabase history is
  fabricated or edited.
- **Runner owns the transaction:** the record-form file has **no** embedded `BEGIN/COMMIT`; the recorder
  wraps the whole file in one transaction (its `SET LOCAL` timeouts run inside that wrapper). Embedding
  `BEGIN/COMMIT` would risk a partial migration (Supabase KB), so it is deliberately absent here.
- **Fail-safe recovery:** any failed statement aborts the whole bundle → `ROLLBACK` → zero tables
  created, zero partial grants, nothing to clean up. Re-run after addressing the cause. `lock_timeout=3s`
  makes the two `ADD CONSTRAINT … UNIQUE` statements on `KitOrderIntent`/`Assessment` fail fast rather
  than queue behind traffic; on a lock timeout the whole bundle rolls back — re-run in a quiet window.

**Lock impact to expect (B):** `ALTER TABLE "KitOrderIntent" ADD CONSTRAINT … UNIQUE(id,clinicId,assessmentId)`
and the same on `Assessment` take a brief `ACCESS EXCLUSIVE` lock to build a new unique index. Both are
**guaranteed satisfiable** (each includes the PK `id`). With `lock_timeout=3s` the statement fails fast
rather than queueing behind traffic; on a lock timeout, re-run during a quiet window. Row counts are
small (22 assessments, 11 order intents) so index build is sub-second. The two added columns on
`KitPurchaseEvent` are on a table created in the same release (0 rows) — no rewrite.

**Enum caveat (B):** `ALTER TYPE … ADD VALUE` runs inside B's transaction and the new values are not
used in that transaction — valid on PG 12+. (PG 17.6 here.)

---

## 6. Data-preserving recovery strategy (destructive DROP is NOT the default)

Once a doctor saves a note or a purchase line, those rows are **clinical/commercial records**. The
recovery model is therefore layered; **drop is last-resort only and never while real rows exist.**

**Layer 1 — Application rollback (default, zero data loss).**
The app degrades gracefully: its stores return `503 *_not_provisioned` when the tables are absent, and
the feature is behind quiet "not enabled yet" UI. To back the feature out **without touching the
schema**, roll the **application deployment** back to the pre-Release-2 build (Vercel → promote previous
production deployment) and/or keep the feature flag off. The tables and all data stay intact; nothing is
lost; re-deploy to restore. **This is the primary rollback.**

**Layer 2 — Grant/trigger reversal (schema kept, data kept).**
If only C (grants) or B's triggers misbehave, reverse just those objects (drop triggers/function,
restore prior grants) — tables and rows untouched. SQL in §6.1.

**Layer 3 — Schema removal (LAST RESORT, only if tables are empty of real data).**
Only if A/B must be fully reverted **and** `SELECT count(*)` on `ConsultationNote`, `KitPurchaseLine`,
`KitPurchaseEvent`, `KitPurchaseTransaction` are **all zero**. If any row exists, **export first**
(`\copy … TO CSV` or `pg_dump --data-only -t` for the four tables) and get author sign-off before any
drop. Reverse-order drop SQL in §6.2. Enum values added by B cannot be removed from a PG enum and are
harmless if unused — leave them.

**Layer 0 — Restore point (precondition, see §7).** A verified PITR/backup taken immediately before
apply is the ultimate floor under all of the above.

### 6.1 Grant/trigger reversal (data-preserving)
```sql
BEGIN;
-- undo C: restore the broad default-era grants only if you must revert hardening (normally you won't)
-- (prefer leaving C in place; it is the safe posture)
-- undo B triggers/constraints:
DROP TRIGGER IF EXISTS release2_event_associations ON "KitPurchaseEvent";
DROP TRIGGER IF EXISTS release2_note_associations ON "ConsultationNote";
DROP TRIGGER IF EXISTS release2_transaction_associations ON "KitPurchaseTransaction";
DROP FUNCTION IF EXISTS public.check_release2_associations();
ALTER TABLE "KitPurchaseLine" DROP CONSTRAINT IF EXISTS "r2_line_assessment_clinic_patient_fkey";
ALTER TABLE "KitPurchaseLine" DROP CONSTRAINT IF EXISTS "r2_line_order_clinic_assessment_fkey";
ALTER TABLE "Assessment"      DROP CONSTRAINT IF EXISTS "r2_assessment_clinic_patient_key";
ALTER TABLE "KitOrderIntent"  DROP CONSTRAINT IF EXISTS "r2_order_clinic_assessment_key";
COMMIT;
-- Tables, columns and ALL ROWS remain intact.
```

### 6.2 Reverse-order schema drop (LAST RESORT — only when all four tables have 0 real rows)
```sql
-- PRECONDITION: export any rows first; author sign-off required.
BEGIN;
ALTER TABLE "KitPurchaseEvent" DROP COLUMN IF EXISTS "substituteKitId";
ALTER TABLE "KitPurchaseEvent" DROP COLUMN IF EXISTS "transactionId";
DROP TABLE IF EXISTS "KitPurchaseTransaction";
DROP TABLE IF EXISTS "KitPurchaseEvent";
DROP TABLE IF EXISTS "KitPurchaseLine";
DROP TABLE IF EXISTS "ConsultationNote";
DROP TYPE IF EXISTS "KitPurchaseEventType";
DROP TYPE IF EXISTS "KitPurchaseLineStatus";
DROP TYPE IF EXISTS "ConsultationNoteStatus";
DROP TYPE IF EXISTS "ConsultationNoteInputMode";
COMMIT;
```

---

## 7. Backup / PITR — REQUIRED EVIDENCE BEFORE EXECUTION (your point 7)

**What I can confirm (read-only):** project `pykoyxbleowxwechotth` is `ACTIVE_HEALTHY`, PG 17.6,
`wal_level = logical` (WAL is generated — a prerequisite for backups/PITR).

**What I CANNOT confirm from available tooling, and therefore gate on:** that a **retained, recoverable
PITR window / recent successful backup actually exists.** That status lives in the Supabase dashboard.

**Required evidence before I will request/perform execution — attach one of:**
1. Supabase dashboard **Database → Backups** showing a recent successful daily backup **and** the PITR
   retention window covering "now"; **or**
2. A fresh pre-apply logical backup you run from a trusted client and confirm restorable:
   ```bash
   pg_dump "postgresql://<service-role-conn>/postgres" \
     --no-owner --format=custom \
     -f drfact-prod_pre-release2_$(date +%Y%m%dT%H%M%SZ).dump
   # verify: pg_restore --list <file> succeeds and is non-empty
   ```
   For a minimal, fast floor, also capture the 5 referenced parent tables:
   `-t '"Clinic"' -t '"Doctor"' -t '"Patient"' -t '"Assessment"' -t '"KitOrderIntent"'`.

Record here before apply → **Backup/PITR evidence:** `__________`  (timestamp / screenshot / dump path)

---

## 8. Post-apply verification (read-only; no clinical data created)

### 8.1 Baseline unchanged (go/no-go)
```sql
SELECT
 (SELECT count(*) FROM "Clinic")=10 AS clinics_ok,
 (SELECT count(*) FROM "Doctor")=10 AS doctors_ok,
 (SELECT count(*) FROM "Patient")=22 AS patients_ok,
 (SELECT count(*) FROM "Assessment")=22 AS assessments_ok;   -- all must be true
```
### 8.2 Objects present & RLS on
- 4 new enums exist; 4 tables exist with `rowsecurity = true`; 7 policies present; B's 3 triggers +
  `check_release2_associations` present; A/B indexes, CHECKs, FKs present.
### 8.3 Grant matrix matches §2 target
```sql
SELECT table_name, grantee, string_agg(privilege_type,',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('ConsultationNote','KitPurchaseLine','KitPurchaseEvent','KitPurchaseTransaction')
  AND grantee IN ('anon','authenticated','service_role')
GROUP BY 1,2 ORDER BY 1,2;
-- EXPECT: no 'anon' rows at all; authenticated = SELECT on ALL FOUR tables
--         (incl. ConsultationNote); service_role full.
```
### 8.4 Isolation smoke (read-only, crafted + rolled back)
Attempt a cross-tenant insert as a Clinic-B context inside a transaction and confirm it raises
`purchase_event_association` / RLS denial, then `ROLLBACK`. No row persists.
### 8.5 Migration ledger
`supabase_migrations.schema_migrations` gains **exactly one** new row: `20261031_release2_atomic`
(the single bundle record — not three). `_prisma_migrations` is **unchanged** — the failed
`20260626_phase3_admin` row is left exactly as-is; nothing is hand-inserted or edited in either ledger.

---

## 9. Go / No-Go criteria

**GO only if ALL hold:**
- [ ] §1 checksums reproduce exactly (applied=`00b` `273900c9…`; frozen ref `56f6d242…`; A=`427d8f28…`, B=`5c1b4a4d…`, C=`5151ca63…`).
- [ ] §7 backup/PITR evidence attached and restorable.
- [ ] `PURCHASING_ENABLED` confirmed OFF in production Vercel env.
- [ ] Applied via a supported recorder as **one** migration `20261031_release2_atomic` → exactly one
  new Supabase ledger row; Prisma ledger untouched; no hand-inserted rows.
- [ ] §8.1 baseline counts all `true`; §8.3 grant matrix matches target (no `anon`).
- [ ] §8.2/8.4 objects + isolation smoke pass.

**NO-GO / halt → Layer-1 app rollback (and Layer-0 restore if needed) if:** any checksum mismatch, a
lock timeout that can't clear in a quiet window, a baseline count changed, `anon` retains any privilege,
or the isolation smoke persists a row.

---

## 10. Boundaries (unchanged, enforced)

- **No production writes / merge / deploy / purchasing enablement** until explicit final authorization.
- **Production acceptance** is performed by an **authorized Acube doctor or designated clinic operator**
  — not by impersonating a doctor or fabricating patient records. I will prepare the acceptance
  checklist and verify results read-only.
- **This documentation package stays separate** from the Next.js production branch. It is **not** to be
  merged into the obsolete `main` as a deployment mechanism (PR #46 is draft docs only).

---

## 11. Remaining PASS/FAIL prerequisites before execution

| # | Prerequisite | Who | Status |
|---|---|---|---|
| 1 | ConsultationNote hardened to `authenticated` SELECT-only; server writes preserved (Prisma/`DATABASE_URL` + `service_role`) | me | ✅ **PASS** (done + verified in code) |
| 2 | A/B/C cannot leave tables with inter-step direct-write exposure (single-txn atomic bundle; fail-safe rollback) | me | ✅ **PASS** (bundle `56f6d242…`) |
| 3 | Checksums reproduce (BUNDLE/A/B/C) | me | ✅ **PASS** |
| 4 | Prisma failed row `20260626_phase3_admin` left unchanged; no `prisma migrate deploy` | me | ✅ **PASS** (untouched) |
| 5 | `PURCHASING_ENABLED` absent/`false` on Vercel **Production** | **you** | ⛔ **PENDING** — I got 403 listing env vars; confirm in dashboard (no secret values needed) |
| 6 | Recoverable backup/PITR evidence (Supabase Database → Backups), not WAL config | **you** | ⛔ **PENDING** — no backup-read tool in this session; dashboard evidence required |
| 7 | Explicit authorization to apply the bundle to `pykoyxbleowxwechotth` | **you** | ⛔ **PENDING** |

Nothing in §5 runs until 5, 6, 7 are satisfied.
