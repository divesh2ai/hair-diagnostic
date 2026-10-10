# HairOS Production Migration Reconciliation

Read-only analysis. **No production writes, no DDL, no `migrate resolve`, no
`migrate deploy` performed.** Prepared so remediation can run safely *after* the
backup gate is confirmed.

- Production project: `drfact-hairos-production` / `pykoyxbleowxwechotth`
- Repo Prisma version (lockfile + local `node_modules`, `npx --no-install prisma -v`): **5.22.0** — use `npx --no-install prisma …` for every command; do not use a global/latest CLI.
- Prod state proven read-only: `pg_proc` public functions = **1** (`rls_auto_enable` only), `pg_policies` = **0**, non-internal triggers = **0**, views = **0**, 67 tables RLS-enabled. Prisma `_prisma_migrations` = 18 rows (11 names applied, `20260626_phase3_admin` failed/unfinished, 26 names absent). Supabase `supabase_migrations.schema_migrations` = 1 row (`20260918122223`).

## How production was really built
The baseline migration is a **squashed full-schema snapshot** (its own header: "the
migrations that follow run as no-ops … this file already contains their result").
But baseline contains **schema DDL only** — no functions, no RLS policies, no
triggers (scanned: baseline POL=0 FUN=0 TRG=0). Production's schema objects exist
(materialised by `prisma db push`), while every **migration-only raw-SQL object**
(functions, policies, triggers, seed rows) is **absent**, except `rls_auto_enable`
(prod's only function — **not defined in any repo migration**; origin out-of-band;
it is what auto-enables RLS on new tables, hence 67 RLS-enabled/0-policy tables).
**`prisma db push` ≠ migration complete** — those migrations are PARTIAL.

---

## A. Corrected blocker list (delta vs PRODUCTION_READINESS.md)
- **B5 corrected:** TWO buckets missing — **`one-pagers` and `report-assets`** (not just `report-assets`). `scripts/provision-storage.ts` declares 5 private buckets.
- **New E1 — migration ordering defect:** `20260626_phase3_admin` sorts before `20260626_platform_foundation` but calls `public.jwt_is_super_admin()`, which only `platform_foundation` defines; baseline does not. A clean sequential `migrate deploy` **fails** at `phase3_admin` (this is exactly where prod's ledger stalled).
- **New E2 — fake-checksum ledger self-inserts:** `identity_alignment`, `platform_foundation`, `phase3_admin` each `INSERT INTO public._prisma_migrations … 'manual-resolve-*'` with `gen_random_uuid()` + `ON CONFLICT (id) DO NOTHING`. These write **non-Prisma checksums** and can **duplicate** `migration_name` rows. Must never be executed; use `prisma migrate resolve` instead.
- **New E3 — failed migration present:** `phase3_admin` row has `finished_at=NULL` (real checksum `e0e3439b…`). `migrate deploy` refuses to run while a migration is failed; it must be cleared first with `migrate resolve`.
- **New E4 — `custom_access_token_hook` missing:** defined in `20260909_doctor_phone_otp_claims`, absent in prod. This is the JWT hook that injects `user_role`; without it (and its registration in Supabase Auth) role-based routing to `/admin` does not work even after login.

## B. 38-migration reconciliation matrix

Legend — **Schema** = tables/columns/types/indexes/constraints (Prisma-generated, in baseline). **RawSQL** = functions/policies/triggers/seed that live only in the migration file. Prod columns: ✓ present / ✗ absent / — n/a. Ledger: A=applied, F=failed/unfinished, ∅=no row.
Proposed: **COMPLETE** (objects present, just reconcile ledger) / **PARTIAL** (schema present, raw SQL missing → apply then resolve) / **PENDING** (nothing present).

| # | Migration | Schema objs (prod) | RawSQL in file | Funcs | RLS en / policies | idx/constr/trig/view | seed/data | →`_prisma_migrations` | Prod has rawSQL? | Ledger | Action |
|---|-----------|--------------------|----------------|-------|-------------------|----------------------|-----------|------------------------|------------------|--------|--------|
| 1 | 00000000000000_baseline | ✓ | none | 0 | 0/0 | 139 idx | 0 | comment only | — | A | COMPLETE (keep) |
| 2 | 0001_add_whatsapp_session | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | A | COMPLETE |
| 3 | 20260521_hairos_platform | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | A | COMPLETE |
| 4 | 20260527_production_maturity_layer | ✓ | none | 0 | 0/0 | 3 idx | 3 | no | — | A | COMPLETE (backfill on empty tbls = no-op) |
| 5 | 20260620_add_narrative_video_status | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | A | COMPLETE |
| 6 | 20260622_add_artifact_video_types | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | A | COMPLETE |
| 7 | 20260624_add_clinic_branding | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | A | COMPLETE |
| 8 | 20260624_add_review_decision | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | A | COMPLETE |
| 9 | 20260626_add_clinic_invitation | ✓ | RLS-enable | 0 | 1/0 | 5 idx | 0 | no | RLS on (auto) | A | COMPLETE (policy comes from platform_foundation) |
| 10 | 20260626_add_clinic_member | ✓ | none | 0 | 0/0 | 4 idx | 0 | no | — | A | COMPLETE |
| 11 | 20260626_identity_alignment | ✓ | ledger self-insert | 0 | 0/0 | 2 idx/constr | 1 | **yes (fake checksum)** | — | A | COMPLETE — but do **not** run its ledger insert |
| 12 | **20260626_phase3_admin** | ✓ (enum+cols) | 2 policies, singleton seed, self-insert | 0 (uses jwt_is_super_admin) | 1/2 | 1 idx | 3 | **yes (fake checksum)** | ✗ policies, ✗ seed | **F** | **PARTIAL** — clear failed → apply policies+seed (after E1 fn) → resolve |
| 13 | **20260626_platform_foundation** | ✓ | **4 fns** (jwt_user_role, jwt_clinic_id, **jwt_is_super_admin**, jwt_is_clinic_member) + 21 policies + self-insert | 4 | 17/21 | 3 idx | 1 | **yes (fake checksum)** | ✗ all | ∅ | **PARTIAL** — apply fns+policies **first** → resolve |
| 14 | 20260629_consultation_aggregate | ✓ | none | 0 | 0/0 | 11 idx | 0 | no | — | ∅ | COMPLETE → resolve --applied |
| 15 | 20260630_clinical_ready_phase_split | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 16 | 20260706_doctor_validation_loop | ✓ | none | 0 | 0/0 | 8 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 17 | 20260709_add_review_pathway_shadow_persistence | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 18 | **20260718_drfact_rag_stage1** | ✓ | 1 fn + 53 policies + 1 trigger | 1 | 26/53 | 39 idx, 1 trg | 0 | no | ✗ all | ∅ | **PARTIAL** — apply fn+policies+trigger → resolve |
| 19 | 20260720_general_assistant_retrieval | ✓ | none | 0 | 0/0 | 3 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 20 | **20260720_hair_scope_claim_governance** | ✓ | 4 fns + 7 policies + 4 triggers | 4 | 3/7 | 10 idx, 4 trg | 1 | no | ✗ all | ∅ | **PARTIAL** — apply fns+policies+triggers → resolve |
| 21 | **20260721_five_kit_real_slice** | ✓ | 1 fn + 6 policies + 1 trigger | 1 | 3/6 | 6 idx, 1 trg | 0 | no | ✗ all | ∅ | **PARTIAL** — apply fn+policies+trigger → resolve |
| 22 | 20260810_doctor_badge_theme | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | ∅ | COMPLETE → resolve |
| 23 | 20260810_invitation_resend_fields | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | ∅ | COMPLETE → resolve |
| 24 | 20260812_clinic_locations | ✓ | none | 0 | 0/0 | 6 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 25 | 20260812_general_assistant_conversation_context | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 26 | 20260812_patient_mobile_identity | ✓ | none | 0 | 0/0 | 2 idx | 2 | no | — | ∅ | COMPLETE → resolve (backfill no-op on empty) |
| 27 | 20260812_visit_intent | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 28 | 20260813_clinic_visit | ✓ | none | 0 | 0/0 | 3 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 29 | 20260821_appointments | ✓ | none | 0 | 0/0 | 3 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 30 | 20260829_post_approval_workflow | ✓ | none | 0 | 0/0 | 11 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 31 | 20260831_audit_event_v2_expand | ✓ | none | 0 | 0/0 | 5 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 32 | 20260901_doctor_provisioning | ✓ | none | 0 | 0/0 | 1 idx | 1 | no | — | ∅ | COMPLETE → resolve (backfill no-op) |
| 33 | 20260907_report_asset_pipeline | ✓ | none | 0 | 0/0 | 6 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 34 | 20260908_whatsapp_delivery_idempotency_index | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 35 | 20260908_whatsapp_report_delivery | ✓ | none | 0 | 0/0 | 0 | 0 | no | — | ∅ | COMPLETE → resolve |
| 36 | **20260909_doctor_phone_otp_claims** | ✓ | 2 fns incl **custom_access_token_hook** | 2 | 0/0 | 0 | 0 | no | ✗ all | ∅ | **PARTIAL** — apply fns → resolve |
| 37 | 20260909_support_inbox | ✓ | none | 0 | 0/0 | 5 idx | 0 | no | — | ∅ | COMPLETE → resolve |
| 38 | 20260918_doctor_phone_identity | ✓ | none | 0 | 0/0 | 1 idx | 0 | no | — | ∅ | COMPLETE → resolve |

**Summary:** 6 PARTIAL (#12, #13, #18, #20, #21, #36) carry **all** missing raw SQL (12 functions, 89 policies, 6 triggers, the PlatformSettings singleton). 11 already applied (#1–11). 21 schema-COMPLETE but unrecorded (#14–17,19,22–35,37,38) → `resolve --applied` only. Nothing is genuinely PENDING (schema is present everywhere).

## §4 Dependency analysis (ordering defect)
Prisma applies folders in lexicographic order: `20260626_phase3_admin` < `20260626_platform_foundation` (`phase3…` < `platform…`). `phase3_admin` runs `CREATE POLICY "PlatformSettings_modify" … USING (public.jwt_is_super_admin())`; the function is created only in `platform_foundation`. **Baseline does not define it** (verified: no `jwt_is_super_admin` in baseline; prod has only `rls_auto_enable`). Therefore a clean sequential `prisma migrate deploy` cannot succeed from scratch — it aborts at `phase3_admin` with "function public.jwt_is_super_admin() does not exist". The repo's own workaround was the `manual-resolve-*` self-inserts (E2), which is itself unsafe. **Resolution:** do not rely on sequential deploy for the 6 PARTIAL migrations; apply their raw SQL manually in dependency order (functions before the policies that call them — `platform_foundation` functions first, then `phase3_admin` policies), verify, then `migrate resolve --applied`.

## §5 Direct `_prisma_migrations` writers (do not execute)
- `20260626_identity_alignment:43` — `INSERT … 'manual-resolve-identity-alignment'`
- `20260626_platform_foundation:461` — `INSERT … 'manual-resolve-platform-foundation'`
- `20260626_phase3_admin:82` — `INSERT … 'manual-resolve-phase3-admin'`
- `00000000000000_baseline` — comment only (no write)

Implication: each uses a literal non-Prisma checksum and `gen_random_uuid()` id with `ON CONFLICT (id) DO NOTHING`, so (a) the stored checksum will **not** match the file's real checksum → `migrate status`/`deploy` reports "migration … was modified after applied" and **blocks**, and (b) re-running duplicates `migration_name` rows. These statements must be **skipped** when applying the PARTIAL migrations' SQL; the correct ledger write is `prisma migrate resolve --applied <name>`, which records Prisma's real checksum. (Prod currently does **not** contain these fake rows — `phase3_admin`'s row carries the real checksum — so the landmine is latent; keep it that way.)

## §8 Canonical owner
HairOS application schema — tables, columns, enums, indexes, **and** the raw-SQL functions/policies/triggers — all live in `prisma/migrations` and are tracked by Prisma's `_prisma_migrations`. **Prisma is the single canonical owner.** `supabase_migrations.schema_migrations` holds one unrelated CLI row (`20260918122223`) and must **not** be forced to equal `_prisma_migrations`; leave it untouched. Supabase CLI owns only what it applies (currently that one row). Do not introduce `supabase db push`/`apply_migration` for app schema — that would create a third divergent ledger.

## C. Proposed remediation order (execute only AFTER backup confirmed; nothing here run yet)
0. Confirm restorable logical backup (external, per your plan). Pin CLI: `npx --no-install prisma -v` must read `5.22.0`.
1. **Clear the failed migration (ledger only):** `prisma migrate resolve --rolled-back 20260626_phase3_admin`.
2. **Reconcile the 21 schema-COMPLETE unrecorded migrations** (after proving objects exist, per §D): `prisma migrate resolve --applied <name>` for #14–17, 19, 22–35, 37, 38.
3. **Apply the 6 PARTIAL migrations' missing raw SQL, once, in dependency order**, running **only** the function/policy/trigger/seed statements and **omitting** each file's trailing `INSERT INTO _prisma_migrations` line:
   1. `platform_foundation` — 4 `jwt_*` functions, then its 21 policies + RLS enables + seed.
   2. `phase3_admin` — `PlatformSettings_select`/`_modify` policies + singleton seed.
   3. `drfact_rag_stage1` — 1 function + 53 policies + 1 trigger.
   4. `hair_scope_claim_governance` — 4 functions + 7 policies + 4 triggers.
   5. `five_kit_real_slice` — 1 function + 6 policies + 1 trigger.
   6. `doctor_phone_otp_claims` — `custom_access_token_hook` (+ 2nd fn).
   Verify each block (§D), then `prisma migrate resolve --applied <name>` for each of the 6.
4. **`prisma migrate deploy`** — must now report **nothing to apply** (clean). This is the proof the ledger is reconciled, not a change.
5. **Storage:** `npx tsx scripts/provision-storage.ts --allow-production` → creates `one-pagers` + `report-assets`.
6. **Supabase Auth:** register `custom_access_token_hook` as the access-token hook (dashboard), or role claims stay absent.
7. Full read-only verification (§D). STOP.

> Note on step 3 mechanics: because the repo's own migration SQL embeds the unsafe ledger inserts and assumes a broken order, extracting the exact function/policy/trigger statements into a single reviewed, idempotent apply-script (guarded, one run) is safer than piping raw files. That script is **not** written here — it is the first thing to author once the backup is confirmed, and it must be reviewed before running.

## D. Post-remediation read-only verification queries
```sql
-- 1. No failed/unfinished migration
select count(*) as unfinished from "_prisma_migrations" where finished_at is null;            -- expect 0
-- 2. No duplicate migration_name rows; count matches repo (38)
select count(*) total, count(distinct migration_name) distinct_names from "_prisma_migrations"; -- expect 38 / 38
-- 3. Expected SQL functions exist (>=12 incl the key ones)
select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'; -- expect >=12
select exists(select 1 from pg_proc where proname='jwt_is_super_admin') as jwt_fn,
       exists(select 1 from pg_proc where proname='custom_access_token_hook') as hook_fn;         -- both true
-- 4. jwt_is_super_admin works (should return boolean without error)
select public.jwt_is_super_admin();                                                             -- returns false (no JWT), no error
-- 5. Expected RLS policies exist
select count(*) as policies from pg_policies where schemaname='public';                          -- expect ~89
-- 6. No RLS-enabled application table left with zero applicable policies
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
 order by 1;                                                                                     -- expect 0 rows
-- 7. All four* required storage buckets (plus clinical-images) exist, private
select name, public from storage.buckets order by name;  -- clinical-images, clinical-reports, doctor-avatars, one-pagers, report-assets (all public=false)
-- 8. Triggers present
select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal;                                                -- expect >=6
```

## E. Migration-history defects to fix before `migrate deploy` is safe
1. **E3 failed row** — `phase3_admin` `finished_at=NULL`: `migrate deploy` refuses until cleared via `migrate resolve` (step C.1).
2. **E1 ordering** — `phase3_admin` → `jwt_is_super_admin` defined later: never deploy these two by Prisma order; apply raw SQL manually functions-first (step C.3).
3. **E2 fake-checksum self-inserts** — must be skipped when applying PARTIAL SQL; use `migrate resolve` for ledger writes. Audit that no `manual-resolve-*` checksum lands in `_prisma_migrations`.
4. **Missing ledger rows (26)** — reconcile via `resolve --applied` only after proving each migration's objects exist; never blind-run.
5. **`custom_access_token_hook` (E4)** — DB function missing AND Auth-hook registration unverified; both required for `/admin` role routing.

*Do not execute any of the above until the backup is confirmed and the apply-script is reviewed.*
