# Clinic #1 — staging runbook

Companion to [`staging-environment-plan.md`](./staging-environment-plan.md),
which explains *why* staging exists. This is the ordered list of commands to
get it working.

**Status 2026-08-13.** Two things block every end-to-end test. One needs you
(two secrets, ~3 minutes in the Supabase dashboard). The other is now fixed in
the repo but has never been executed against a database.

---

## Blocker 1 — the two secrets (needs a human)

They cannot be recovered from the management API, from Vercel, or from this
repo. Both come from the dashboard for **hairos-staging** (`vbkoupvduadmcxggtnsb`):

1. **Database password** — Settings → Database → *Reset database password*.
   The project was created via the API, which generates the password and never
   returns it, so it has to be reset rather than looked up.
2. **`service_role` key** — Settings → API keys → `service_role`.

Then:

```bash
cp .env.staging.example .env
```

Fill in the two `<<< FILL IN >>>` placeholders and copy the same file to
`apps/patient-portal/.env.local`. Do not paste either value into a chat window,
a commit, or any `NEXT_PUBLIC_*` variable.

The pooler host in that file — `aws-0-ap-south-1.pooler.supabase.com` — has
been verified against the live project: it recognises the tenant
`postgres.vbkoupvduadmcxggtnsb` and rejects only the password.
`aws-1-ap-south-1` answers `Tenant or user not found` and is the wrong host.

Confirm before doing anything else:

```bash
npx tsx scripts/db-cli-guard.ts prisma --version
```

It must print `→ staging (vbkoupvduadmcxggtnsb)`. If it prints `PRODUCTION`,
stop — the copy did not take effect.

---

## Blocker 2 — the missing baseline migration (fixed, not yet run)

`prisma/migrations` did not describe a database. Its earliest migration,
`20260521_hairos_platform`, opens with

```sql
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_REPORTS';
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "rawResponses" JSONB;
```

against a type and a table that **no migration in the folder ever creates**.
The original schema was pushed with `prisma db push`; migrations only started
being written afterwards. Against production that is invisible — everything
already exists. Against the empty staging project, `migrate deploy` fails on
the first statement.

Measured against `schema.prisma`, the chain never created:

| | missing from the chain |
|---|---|
| tables | `User`, `Session`, `Message`, `Diagnosis`, `Recommendation` |
| enums | `SystemRole`, `AssessmentSource`, `DeliveryStatus` |
| indexes | 55 |

`prisma/migrations/00000000000000_baseline/migration.sql` now fills the gap.
It is the full current schema (`migrate diff --from-empty --to-schema-datamodel`),
made idempotent so it is a no-op anywhere the objects already exist. Verified
statement-for-statement against the generated DDL: 65 tables, 27 enums, 138
indexes, 44 foreign keys, all present, all guarded.

It has **not** been applied to any database yet.

---

## Apply the migrations

```bash
npm run db:status
```

Expect 29 pending migrations (the baseline plus 28) against an empty database.

> **Do not run `npm run db:migrate` here.** It will fail. See below.

### Why `migrate deploy` cannot build this schema from zero

Audited 2026-08-14. The baseline fixed the *missing* objects, but the 28
historical migrations were left in the chain behind it — and the baseline
already creates everything they create. The baseline is fully guarded
(`IF NOT EXISTS` / `DO $$`); ten of the 28 are not:

| migration | unguarded `CREATE` colliding with the baseline |
|---|---|
| `20260629_consultation_aggregate` | 3 tables, 4 enums ← **fails first** |
| `20260706_doctor_validation_loop` | 2 tables, 4 enums |
| `20260718_drfact_rag_stage1` | 26 tables, 1 enum |
| `20260720_hair_scope_claim_governance` | 3 tables |
| `20260721_five_kit_real_slice` | 3 tables |
| `20260812_clinic_locations` | 1 table, 2 enums |
| `20260812_general_assistant_conversation_context` | 1 table |
| `20260812_visit_intent` | 2 enums |
| `20260813_clinic_visit` | 1 table |
| `20260813_durable_rate_limit` | 1 table |

Replayed from zero, the chain dies on `CREATE TYPE "ConsultationStatus"`
(Postgres 42710, duplicate_object).

Deleting the redundant migrations is **not** the fix: production has all 28
recorded in `_prisma_migrations`, and Prisma refuses to operate when applied
migrations are missing from the directory — that would trade a staging problem
for a production one.

### Provision instead

The baseline alone produces the complete schema — verified against
`schema.prisma` at 65/65 models and 27/27 enums. So execute it, then record the
history without replaying it (Prisma's squashed-baseline adoption path):

```bash
npm run db:provision:staging -- --dry-run
```

```bash
npm run db:provision:staging
```

`scripts/provision-staging.ts` refuses unconditionally — no override of any
kind — unless the resolved project is `vbkoupvduadmcxggtnsb` **and** the
database is empty. The emptiness check is what keeps it safe to leave in the
repo: pointed at a populated database it stops rather than recording a history
nobody verified. Then:

```bash
npm run db:status
```

Expect "Database schema is up to date". Spot-check the objects the clinic flow
depends on — `ClinicVisit`, `ClinicLocation`, `Patient.phoneNormalized`,
`Patient.identityResolutionStatus`, `Assessment.visitType`,
`Assessment.patientRelationship`, `RateLimitCounter`, and the partial unique
index `ClinicLocation_clinicId_primary_key`.

### Production, later

Production already has every object in the baseline but has **no row for it**
in `_prisma_migrations`, so the next production deploy would consider it
pending. It is written to be a safe no-op, but mark it resolved rather than
relying on that:

```bash
PRODUCTION_MIGRATION=yes-apply-to-production npx prisma migrate resolve --applied 00000000000000_baseline
```

---

## Seed the synthetic clinic

```bash
CLINIC_SEED_ALLOW=1 npm run seed:clinic
```

Refuses to run anywhere except `vbkoupvduadmcxggtnsb`. Prints the clinic URL,
the three doctors, and the mobile numbers for the NEW / RETURNING / AMBIGUOUS
cases. Idempotent — re-running converges rather than duplicating, which matters
because RETURNING vs AMBIGUOUS is defined by how many rows carry a number.

---

## Point Vercel Preview at staging

Currently it points at production. Every `DATABASE_URL`, `DIRECT_URL` and
`NEXT_PUBLIC_SUPABASE_URL` in the Preview scope was created 58 days ago —
`hairos-staging` did not exist until 2026-08-12, and none has been updated
since. The values are marked Sensitive so they cannot be read back to confirm,
but they provably predate the project they would have to name.

Until this is changed, **every preview deployment reads and writes live patient
data.**

```bash
vercel env rm DATABASE_URL preview
vercel env rm DIRECT_URL preview
vercel env rm NEXT_PUBLIC_SUPABASE_URL preview
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY preview
vercel env rm SUPABASE_SERVICE_ROLE_KEY preview
vercel env rm REVIEW_TOKEN_SECRET preview
```

then `vercel env add <NAME> preview` for each, using the staging values. Give
`REVIEW_TOKEN_SECRET` a *different* value from production — it signs both
review tokens and the patient intake session, so a shared secret would let a
token minted in staging authenticate against production.

---

## Then the E2E blocks

In order; do not skip ahead when one fails.

| Block | What it proves |
|---|---|
| 2 | NEW / RETURNING / AMBIGUOUS identity, no duplicate `Patient` row |
| 3 | ClinicVisit → In Clinic → Review Queue, FIFO on `submittedAt`, 15s polling |
| 4 | Shared queue, `reviewingDoctorId` stamped at decision, Review → Next |
| 5 | Shared reception device leaks nothing between patients |
| 6 | Two concurrent primary-location promotions: one wins, one 409 |
| 8 | Clinic QR scanned from a real phone reaches the right queue |
| 10 | Full smoke test, clinic-scoped throughout |
