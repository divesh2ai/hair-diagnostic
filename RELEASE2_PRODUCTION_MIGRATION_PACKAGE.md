# Release 2 — Production Migration & Deployment Package (FOR AUTHORIZATION)

**Target production DB:** `drfact-hairos-production` / `pykoyxbleowxwechotth` (Supabase, ap-south-1)
**Source candidate:** PR #35 `feat(doctor): Phase 1 — consultation notes & partial kit purchase tracking` (head `0b0c8c51`)
**Prepared:** 2026-10-31 — read-only investigation only. **No production writes have been executed.**
**Status:** ⏸ HELD — awaiting your explicit final authorization of this exact package.

---

## 0. Bottom line / go–no-go

**Can the migrations be applied safely? Yes — but NOT with `prisma migrate deploy`.** Production's
Prisma ledger is broken (a failed `20260626_phase3_admin` row) and stale (stops at 2026-06-26 while
the live schema is months newer, advanced through the **Supabase** migration ledger). A standard
Prisma deploy will abort with **P3009** and, even if forced, would try to re-create tables that
already exist.

**Recommended path:** apply the two feature migrations as **direct, transaction-wrapped Supabase
migrations** (the same channel that applied the last 3 production changes), leaving the Prisma ledger
untouched. All FK targets and the three `jwt_*` RLS helper functions already exist in production, and
none of the new enums/tables exist yet — so a clean, additive apply is possible.

**I recommend applying ONLY migration A (notes + partial-kit tracking) for this release** and
**deferring migration B (checkout transactions)** — see §4. That keeps the release to exactly the
four features you listed (Doctor Notes, mic input, Partial Kit Tracking, Follow-up History) and keeps
all payment/checkout infrastructure out of production while `PURCHASING_ENABLED` is OFF.

---

## 1. What was verified in production (read-only)

| Check | Result |
|---|---|
| `jwt_is_super_admin`, `jwt_user_role`, `jwt_is_clinic_member` | ✅ all present (RLS policies will not fail) |
| Feature enums (`ConsultationNoteInputMode`, …, `KitPurchaseEventType`) | ✅ none exist → clean slate, no partial prior apply |
| New tables (`ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent`, `KitPurchaseTransaction`) | ✅ none exist yet |
| FK targets (`Clinic`, `Patient`, `Assessment`, `Doctor`, `KitOrderIntent`) | ✅ all present |
| `KitOrderPayment` table | ❌ absent — **OK**, migrations do not FK to it (only a nullable TEXT column) |
| `_prisma_migrations` | ⚠️ 18 rows, last = `20260626_*`, contains a **failed** row (`20260626_phase3_admin`, finished=NULL, rolled_back=NULL) |
| Supabase ledger (`supabase_migrations.schema_migrations`) | `20260918122223`, `20261014053200`, `20261029093800` (this is the live channel) |
| Production data at risk | 10 clinics, 10 doctors, 22 patients, 22 assessments, 132 AI artifacts, 17 report assets, 92 audit logs — **all RLS-enabled** |

**Staging note:** `hairos-staging` has **16 tables with RLS DISABLED** (catalog/commerce/payment/
support/appointment subsystem) flagged *critical* by Supabase advisors. Those tables **do not exist in
production** and are **not** part of this package — but it means **staging is not a clean mirror of
production**; do not port staging's schema wholesale.

---

## 2. Exactly what would change (both migrations are additive — no DROP/ALTER-TYPE-of-column/data rewrite)

**Migration A — `20261023_doctor_notes_and_partial_kit`** (the staging-verified one)
- CREATE 4 enums; CREATE 3 tables: `ConsultationNote`, `KitPurchaseLine`, `KitPurchaseEvent`
- 13 FKs to existing tables; 2 idempotency unique indexes; 5 CHECK constraints
- ENABLE RLS + 6 clinic-scoped policies; GRANTs to `authenticated`/`service_role`
- Touches **no** existing table or row. Raw audio never stored (notes store doctor-edited transcript only).

**Migration B — `20261030_partial_checkout_transactions`** (added after staging verification)
- `ALTER TYPE KitPurchaseEventType ADD VALUE 'EXTERNALLY_OBTAINED','CONTINUED'`
- CREATE table `KitPurchaseTransaction` (+ RLS select-only for authenticated; money transitions server-only)
- `ALTER TABLE KitPurchaseEvent ADD COLUMN transactionId, substituteKitId` (on the **new** table from A)
- `ALTER TABLE KitOrderIntent ADD CONSTRAINT … UNIQUE(id,clinicId,assessmentId)` and
  `ALTER TABLE Assessment ADD CONSTRAINT … UNIQUE(id,clinicId,patientId)` — additive, **guaranteed
  satisfiable** (both include the PK `id`), but they take a brief `ACCESS EXCLUSIVE` lock to build.
- CREATE trigger function `check_release2_associations` + 3 BEFORE triggers enforcing tenant association.

---

## 3. Protections requested — status

- **Existing patient records:** PROTECTED. Every statement is `CREATE`/additive `ADD`; no existing
  row is read-modified, no column retyped, no table dropped. FKs use `ON DELETE RESTRICT` (no cascade
  deletes into patient/clinic/assessment data).
- **Clinic isolation:** PRESERVED and strengthened. New tables are RLS-on with clinic-scoped policies
  (`jwt_is_clinic_member`), and migration B adds DB-level triggers that reject cross-tenant writes even
  via direct PostgREST. (Verified on staging: a Clinic-B JWT saw 0 of Clinic-A's rows.)
- **Kit prices:** UNTOUCHED. Pricing lives outside these tables (`KitPrice`/`ProductPrice`); the
  migrations add no price column and server-side pricing authority (`buildDoctorOrderPricing`) is unchanged.
- **`PURCHASING_ENABLED` OFF / no live payments:** The code does not enable purchasing; the kill-switch
  (PR #28) stays OFF. Migration A has no payment surface at all. Migration B creates checkout *table*
  structure but no payment executes. **To stay strictly clinical this release, defer migration B (§4).**

---

## 4. Recommended scope decision

**Option 1 (recommended): apply Migration A only.**
Delivers Doctor Notes, microphone/typed input, Partial Kit Tracking, and Follow-up/Previous-Consultation
history — the four features you named. Zero checkout/payment structure enters production. Lowest risk,
and it is the migration that was actually verified end-to-end on staging.

**Option 2: apply A + B.** Adds `KitPurchaseTransaction` + enum values + the uniqueness constraints and
triggers. B was **not** covered by the PR's staging-verification banner and introduces brief exclusive
locks on `KitOrderIntent`/`Assessment`. Only choose this if Release 2 genuinely needs the checkout
ledger now.

👉 **Tell me Option 1 or Option 2** and I'll finalize the exact apply script accordingly.

---

## 5. Apply plan (to run ONLY after your authorization)

> Not executed. Shown for your review. Applied via Supabase `apply_migration` (NOT `prisma migrate deploy`).

1. **Backup / restore point first.** Confirm a Supabase PITR restore point or take a fresh logical
   backup of production immediately before apply. Record the timestamp here: `__________`.
2. **Apply inside an explicit transaction** (wrap Migration A in `BEGIN; … COMMIT;` — the PR's A file is
   not transaction-wrapped, so a mid-file failure could leave RLS-on tables with partial policies.
   Migration B is already `BEGIN/COMMIT`).
3. **Do not touch the Prisma ledger** as part of this apply. (Optional, separate follow-up: clean the
   failed `20260626_phase3_admin` row and re-baseline Prisma — out of scope for this release, needs its
   own change + review.)
4. Record each applied migration name in the Supabase ledger (automatic via `apply_migration`).

---

## 6. Rollback (ready)

Additive-only ⇒ rollback is a clean reverse-order drop. **Export purchase/note rows first if any real
data was recorded.**

Migration B (if applied):
```sql
BEGIN;
DROP TRIGGER IF EXISTS release2_event_associations ON "KitPurchaseEvent";
DROP TRIGGER IF EXISTS release2_note_associations ON "ConsultationNote";
DROP TRIGGER IF EXISTS release2_transaction_associations ON "KitPurchaseTransaction";
DROP FUNCTION IF EXISTS public.check_release2_associations();
ALTER TABLE "KitPurchaseLine" DROP CONSTRAINT IF EXISTS "r2_line_assessment_clinic_patient_fkey";
ALTER TABLE "KitPurchaseLine" DROP CONSTRAINT IF EXISTS "r2_line_order_clinic_assessment_fkey";
ALTER TABLE "Assessment"      DROP CONSTRAINT IF EXISTS "r2_assessment_clinic_patient_key";
ALTER TABLE "KitOrderIntent"  DROP CONSTRAINT IF EXISTS "r2_order_clinic_assessment_key";
ALTER TABLE "KitPurchaseEvent" DROP COLUMN IF EXISTS "substituteKitId";
ALTER TABLE "KitPurchaseEvent" DROP COLUMN IF EXISTS "transactionId";
DROP TABLE IF EXISTS "KitPurchaseTransaction";
-- NOTE: enum values 'EXTERNALLY_OBTAINED','CONTINUED' cannot be removed from a PG enum;
-- they are harmless if unused. Leave them.
COMMIT;
```
Migration A:
```sql
BEGIN;
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

## 7. Post-apply verification (read-only / safe)

After apply I can verify, without creating any clinical data:
- the 4 enums, 3–4 tables, all indexes/CHECKs/FKs/policies exist and RLS is ON;
- the association triggers reject a crafted cross-tenant write (rolled back);
- existing counts (22 patients / 22 assessments / etc.) are **unchanged**.

---

## 8. Items in your task that are themselves production writes — HELD pending authorization

These were in your list but each writes to production or acts as a clinician, so they are gated behind
the same authorization and I have **not** done them:

- **Create "Acube Aesthetics" as the production acceptance clinic** → production write.
- **Provision / log in as an authorized doctor** → production auth + acting in a clinical system.
- **Verify actual note saving / kit tracking / history retrieval** → writes clinical data to production.
- **Roll out to remaining clinics / verify doctor access** → production writes across tenants.
- **Deploy / promote the Release 2 build** → production deployment.

For these, I recommend the acceptance test be driven by a **real authorized person at Acube** (or by
you), against the deployed build, rather than me writing synthetic clinical rows into the production
patient database. I can prepare the exact step-by-step acceptance checklist and watch the results.

---

## 9. What I need from you to proceed

1. **Scope:** Option 1 (Migration A only — recommended) or Option 2 (A + B)?
2. **Backup confirmed?** PITR/backup restore point taken immediately before apply.
3. **Explicit authorization** to run the apply script in §5 against `pykoyxbleowxwechotth`.
4. Who performs the live doctor-login acceptance test (§8)?

Nothing in §5–§8 runs until you confirm 1–3.
