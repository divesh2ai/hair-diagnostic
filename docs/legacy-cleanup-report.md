# Legacy Cleanup Report — Phase 1.3b

**Generated:** 2026-06-26
**DB:** Supabase project `gwkgopbscdftpitppgwe` (Dr Fact Project)
**Scope:** five duplicate/orphan tables flagged in the [Database Health Report](#). Per addendum §3 — no drops without approval.

## Candidate tables

| Table | Exact row count | Triggers | RLS policies | DB functions referencing | Referenced by FKs (from) | App code references |
|---|---:|---|---|---|---|---|
| `public.clinics` | **0** | none | none | none | `profiles.clinic_id_fkey`, `assessments.clinic_id_fkey` | none |
| `public.clinic_doctors` | **0** | none | none | **none** (was used by old JWT hook — rewritten in this session) | none | none |
| `public.profiles` | **0** | none | none | none | `assessments.patient_id_fkey`, `assessments.doctor_id_fkey` | none |
| `public.assessments` | **0** | none | none | none | none | none |
| `public.assessment_artifacts` | **0** | `set_assessment_artifacts_updated_at` | none | none | none | none |

### What I checked

| Check | Tool | Result |
|---|---|---|
| Exact row count | `SELECT COUNT(*) FROM public.<table>` | All five = 0 |
| FK constraints with table as parent | `pg_constraint` join | Only intra-cluster FKs (the five tables reference each other; no canonical table references them) |
| Triggers | `pg_trigger` (non-internal) | One: `set_assessment_artifacts_updated_at` on `assessment_artifacts` — bound to dead table, dies with it |
| RLS policies | `pg_policies` | None |
| DB functions / views | `pg_proc` + `pg_views` with ILIKE match on each table name | Zero matches after the JWT hook rewrite |
| App code (Prisma client) | Grep `prisma\.(clinics|profiles|assessments|clinicDoctors|assessmentArtifacts)` | Zero matches |
| App code (Supabase client) | Grep `.from("clinics" | "profiles" | "assessments" | "assessment_artifacts" | "clinic_doctors")` | Zero matches |
| App code (raw SQL) | Grep `clinic_doctors`, `assessment_artifacts` across the repo | Zero matches |
| Prisma schema | Grep model definitions | None — all five tables are absent from `schema.prisma` |

## Findings

- **All five tables hold zero rows.**
- **Zero application code references** in the entire repo (Prisma client, Supabase JS client, raw SQL).
- **Zero DB-side dependencies** (no functions, views, policies, or external triggers reference them).
- **Self-contained FK cluster** — they reference each other but nothing outside the group references them.
- **Naming + type inconsistency** — snake_case, uuid PKs, timestamptz — versus the canonical Prisma surface (PascalCase, cuid text PKs, timestamp(3)).
- **Risk from leaving them:** they have RLS enabled but zero policies, so they're closed today. However `profiles` had RLS *disabled* until recently and links to `auth.users` — a future client-side `supabase.from('profiles').select()` would silently return nothing on a fresh app, but a single misconfigured policy would expose the schema.

## Recommendation

**Drop all five in a single migration.** Safe order (children before parents to satisfy the intra-cluster FKs):

```sql
-- Phase 1.3b — drop legacy Supabase-template duplicates (approval required).
DROP TABLE IF EXISTS public.assessment_artifacts;
DROP TABLE IF EXISTS public.assessments;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.clinic_doctors;
DROP TABLE IF EXISTS public.clinics;

-- Orphaned trigger function (only used by assessment_artifacts).
-- Keep set_current_timestamp_updated_at — that one is in use elsewhere.
```

## Pre-flight checklist before running

- [ ] Re-run the row-count query immediately before the drop — confirm still zero.
- [ ] Confirm no in-flight PR adds a reference to any of these names.
- [ ] Take a logical backup of the schema (Supabase Dashboard → Database → Backups) — drops are unrecoverable on the live tier.
- [ ] Run the drop in a single transaction so a partial failure rolls back cleanly.
- [ ] After the drop, re-run `get_advisors` — the five `rls_disabled_in_public` / `rls_enabled_no_policy` items should disappear.

## Not in this report (kept intact)

The six **legacy chat-engine tables** managed by Prisma (`User`, `Session`, `Message`, `Diagnosis`, `Recommendation`, `WhatsappSession`) are out of scope for Phase 1 cleanup. They are governed by the schema banner: "Keep intact — do not touch without explicit migration plan" (`schema.prisma:478`). Phase 8 (Notifications) owns the retirement decision when the replacement WhatsApp engine is wired.

## Approval requested

OK to apply the drop migration above?
