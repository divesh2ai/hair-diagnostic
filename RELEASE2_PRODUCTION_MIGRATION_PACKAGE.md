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

| # | Supabase migration name | File | SHA-256 | Txn-wrapped |
|---|---|---|---|---|
| A | `20261023_doctor_notes_and_partial_kit` | `01_20261023_doctor_notes_and_partial_kit.sql` | `427d8f28d5a3b0a3a445495775d84a1fec0c12867e49aaf07e2f5c0750863011` | **no** (see §5.1) |
| B | `20261030_partial_checkout_transactions` | `02_20261030_partial_checkout_transactions.sql` | `5c1b4a4dd4f3394f17ed97744f94efb07764d6bcff2800c3572d8487a1555019` | yes (`BEGIN/COMMIT`) |
| C | `20261031_release2_grant_hardening` | `03_20261031_release2_grant_hardening.sql` | `b931a3d02736f59388200c0729c6a09d88502371af0a483ab0efc51032aaf88c` | yes (`BEGIN/COMMIT`) |

- A's checksum **matches the PR #35 staging-verification banner** (`427d8f28…863011`) → the exact SQL
  verified on staging is what applies to production.
- Verify before execution: `sha256sum release2-production-package/0{1,2,3}_*.sql` must reproduce the
  three values above.

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
- `authenticated` → **SELECT only** on the three financial tables (writes are server-only via
  `service_role`); **SELECT, INSERT, UPDATE** on `ConsultationNote` (clinic-scoped doctor authoring
  under RLS; no DELETE/TRUNCATE/structural).
- `service_role` → full (server runtime).

> The app connects to Postgres over a direct/server role and scopes every query by `clinicId` (per
> migration A's header), so SELECT-only for `authenticated` does not break note-saving or kit tracking.
> **Optional tightening:** if you confirm the app never writes `ConsultationNote` via the browser
> `authenticated` JWT, we can reduce it to SELECT-only too. Default here is the non-breaking grant.

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
- **Pre-condition:** confirm `PURCHASING_ENABLED` is unset/`false` in the production Vercel env **before
  and after** apply. Creating the empty table is not enabling checkout; settlement stays disabled.

---

## 5. Execution plan — authorized Supabase migration process (NOT `prisma migrate deploy`)

**Do not run `prisma migrate deploy`.** Production's `_prisma_migrations` contains a **failed** row
`20260626_phase3_admin` (`finished_at` NULL, `rolled_back_at` NULL → Prisma **P3009**, deploy aborts)
and is stale (ledger stops 2026-06-26 while the live schema is months newer, advanced via the
**Supabase** ledger). We **do not alter that failed row** and we **do not touch the Prisma ledger** as
part of this release. Changes are applied and recorded through the Supabase migration channel
(`supabase_migrations.schema_migrations`), the same channel that applied the last 3 production changes
(`20260918122223`, `20261014053200`, `20261029093800`).

**Apply order & method** (each via Supabase `apply_migration`, which records name + runs as a unit):

1. **C-dependency note:** C references the tables A and B create, so order is strictly **A → B → C**.
2. **A** — `20261023_doctor_notes_and_partial_kit`.
   - §5.1 **A is not `BEGIN/COMMIT`-wrapped in the reviewed file.** To keep A's checksum identical to
     staging, do **not** edit the file; instead apply it through a runner that wraps the whole file in
     one transaction (Supabase `apply_migration` executes the migration as a single unit). If the
     chosen execution path does **not** auto-wrap, apply A inside an explicit `BEGIN; … COMMIT;` at
     execution time (the wrapper is operational, the reviewed body/checksum is unchanged). All-or-nothing
     matters because A enables RLS and then creates policies; a mid-file abort must roll back cleanly.
3. **B** — `20261030_partial_checkout_transactions` (already `BEGIN/COMMIT`, `lock_timeout=3s`,
   `statement_timeout=30s`).
4. **C** — `20261031_release2_grant_hardening` (`BEGIN/COMMIT`, same timeouts).

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
-- EXPECT: no 'anon' rows at all; authenticated = SELECT on the 3 financial tables;
--         authenticated = SELECT,INSERT,UPDATE on ConsultationNote; service_role full.
```
### 8.4 Isolation smoke (read-only, crafted + rolled back)
Attempt a cross-tenant insert as a Clinic-B context inside a transaction and confirm it raises
`purchase_event_association` / RLS denial, then `ROLLBACK`. No row persists.
### 8.5 Migration ledger
`supabase_migrations.schema_migrations` now also lists the 3 Release-2 names; `_prisma_migrations`
**unchanged** (failed row left exactly as-is).

---

## 9. Go / No-Go criteria

**GO only if ALL hold:**
- [ ] §1 checksums reproduce exactly (A=`427d8f28…`, B=`5c1b4a4d…`, C=`b931a3d0…`).
- [ ] §7 backup/PITR evidence attached and restorable.
- [ ] `PURCHASING_ENABLED` confirmed OFF in production Vercel env.
- [ ] Apply ran A→B→C, each recorded in the Supabase ledger; Prisma ledger untouched.
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

## 11. What I need to proceed to execution
1. Explicit authorization to apply **A→B→C** to `pykoyxbleowxwechotth`.
2. §7 backup/PITR evidence recorded.
3. Confirmation `PURCHASING_ENABLED` is OFF in the production env.
4. (Optional) decision on the §2 ConsultationNote `authenticated` tightening.

Until 1–3 are provided, nothing in §5 runs.
