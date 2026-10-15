-- ============================================================================
-- HAIROS — REPORT-STORAGE PRODUCTION HARDENING  (APPLY-SCRIPT, REVIEW ONLY)
-- ============================================================================
-- Target project : drfact-hairos-production / pykoyxbleowxwechotth (ap-south-1)
-- Prepared       : 2026-10-15  (PR #28 launch preparation)
-- Status         : *** REVIEW ONLY — DO NOT EXECUTE UNTIL EXPLICITLY AUTHORIZED ***
--
-- Scope (report storage ONLY). This script is the report-storage slice of the
-- production DB/storage remediation. It is deliberately NARROW:
--   • It does NOT reconcile the Prisma migration ledger (B2) — kept separate,
--     see docs/launch/MIGRATION_RECONCILIATION.md.
--   • It does NOT apply the full 89-policy / 12-function platform baseline (B3).
--     The two small helper functions below are self-contained mirrors so the
--     report-storage policies stand alone; the canonical definitions still
--     arrive with the platform `migrate deploy`.
--   • It does NOT create storage buckets. Buckets are provisioned by the
--     repo's reviewed, idempotent script (preserves existing conventions):
--         npx tsx scripts/provision-storage.ts --allow-production
--     Section 0 documents the exact bucket spec that script applies, as the
--     reviewed record of intent. Do not hand-create buckets in SQL.
--
-- Verified production state at preparation time (read-only):
--   • Buckets present : clinical-images, clinical-reports, doctor-avatars (all private)
--   • Buckets MISSING : one-pagers, report-assets          <-- provisioning step
--   • public."ReportAsset" : EXISTS, 26 cols, 6 indexes, RLS ENABLED, 0 policies, 0 rows
--   • WhatsappDelivery."reportAssetId" column : present
--   • pg_policies in public : 0   •  storage.objects policies : 0
--   • public functions present : custom_access_token_hook, rls_auto_enable
--
-- JWT claim shape (from supabase/functions/custom_access_token_hook.sql):
--   top-level claims  user_role, clinic_id, organization_id
--
-- Idempotent: safe to re-run. Every CREATE is guarded; every policy is dropped
-- and recreated. No data is read, written, or deleted.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- SECTION 0 — BUCKET PROVISIONING (DOCUMENTED; APPLIED BY provision-storage.ts)
-- ---------------------------------------------------------------------------
-- The two missing buckets, with the EXACT spec scripts/provision-storage.ts
-- declares. Shown here as reviewed intent only — leave the INSERT commented;
-- run the script, do not create buckets from SQL (the script also converges
-- public->private drift and verifies by read-back).
--
--   one-pagers    private  limit  2 MiB  mime application/json
--                 immutable approved one-pager JSON snapshots (render source of truth)
--   report-assets private  limit  5 MiB  mime image/png, application/pdf
--                 rendered patient report artefacts (one-pager PNG today)
--
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values
--   ('one-pagers',    'one-pagers',    false,  2*1024*1024, array['application/json']),
--   ('report-assets', 'report-assets', false,  5*1024*1024, array['image/png','application/pdf'])
-- on conflict (id) do update
--   set public = excluded.public,
--       file_size_limit = excluded.file_size_limit,
--       allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- SECTION 1 — SELF-CONTAINED CLAIM HELPERS (mirrors of platform baseline)
-- ---------------------------------------------------------------------------
-- These let the report-storage policies read the JWT without depending on the
-- not-yet-applied platform functions. Canonical versions arrive with B3's
-- migrate deploy; CREATE OR REPLACE means this script neither blocks nor is
-- blocked by that. SECURITY INVOKER + STABLE: pure claim reads, no table access.

CREATE OR REPLACE FUNCTION public.jwt_clinic_id()
  RETURNS text
  LANGUAGE sql STABLE
  SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id', '')
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_super_admin()
  RETURNS boolean
  LANGUAGE sql STABLE
  SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''
  ) = 'SUPER_ADMIN'
$$;

-- ---------------------------------------------------------------------------
-- SECTION 2 — RLS POLICIES ON public."ReportAsset"  (defense-in-depth)
-- ---------------------------------------------------------------------------
-- Why this matters: the table already has RLS ENABLED with ZERO policies, so
-- every PostgREST role (anon / authenticated) is default-denied today. The app
-- itself is unaffected either way — it reads/writes ReportAsset through the
-- Prisma owner connection (DATABASE_URL), which bypasses RLS, and the render
-- worker uses the service role, which also bypasses RLS. These policies add an
-- explicit, auditable clinic-scoped allowance for any future authenticated
-- direct path, and make the default-deny intentional rather than incidental.
-- The denormalised ReportAsset."clinicId" is exactly what makes this a cheap,
-- join-free check.

ALTER TABLE public."ReportAsset" ENABLE ROW LEVEL SECURITY;
-- Belt-and-braces: deny even the table owner the ability to skip RLS silently
-- in a PostgREST context. (Owner/postgres via Prisma still bypasses; this only
-- affects BYPASSRLS evaluation for non-superuser owners.)
ALTER TABLE public."ReportAsset" FORCE ROW LEVEL SECURITY;

-- service_role: full access (the render worker / snapshot writer path).
DROP POLICY IF EXISTS "ReportAsset_service_role_all" ON public."ReportAsset";
CREATE POLICY "ReportAsset_service_role_all" ON public."ReportAsset"
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- authenticated: read ONLY rows for the caller's own clinic (or super admin).
-- No INSERT/UPDATE/DELETE policy for authenticated: writes stay on the trusted
-- server paths. A Trezze JWT can never SELECT an Acube row — the clinic_id claim
-- must equal the row's clinicId.
DROP POLICY IF EXISTS "ReportAsset_clinic_read" ON public."ReportAsset";
CREATE POLICY "ReportAsset_clinic_read" ON public."ReportAsset"
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_super_admin()
    OR "clinicId" = public.jwt_clinic_id()
  );

-- ---------------------------------------------------------------------------
-- SECTION 3 — RLS POLICIES ON storage.objects FOR THE CLINICAL BUCKETS
-- ---------------------------------------------------------------------------
-- The clinical buckets are PRIVATE and are only ever read/written by the app
-- using the service role, then handed to browsers as short-lived (<=600s)
-- signed URLs. storage.objects has RLS enabled platform-side. Today there are
-- ZERO object policies, so anon/authenticated already cannot list or fetch.
-- These policies make that explicit and permanent: service_role may operate on
-- the three clinical buckets; no other PostgREST role may touch them directly.
-- Signed-URL delivery is unaffected (it does not go through these roles).
--
-- NOTE: object-key paths differ by bucket and are NOT uniformly clinic-prefixed
--   report-assets : clinic/{clinicId}/consultation/{cvId}/one-pager/{slug}-{assetId}.png  (clinic-first)
--   one-pagers    : {assessmentId}/v{n}.json                                              (assessment-keyed)
--   clinical-reports: reports/{assessmentId}/{slug}-report.pdf                            (assessment-keyed)
-- Clinic isolation for one-pagers/clinical-reports is enforced at the APP layer
-- (the owning-clinic check on every route), not by the object key, so these
-- policies intentionally gate by ROLE, not by a path prefix. Changing the
-- one-pagers / clinical-reports key layout to be clinic-first is a separate,
-- larger proposal (see remediation doc, "Optional hardening") and is NOT done
-- here to preserve existing versioned storage conventions.

DROP POLICY IF EXISTS "clinical_buckets_service_role_all" ON storage.objects;
CREATE POLICY "clinical_buckets_service_role_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id IN ('one-pagers', 'report-assets', 'clinical-reports', 'clinical-images', 'doctor-avatars'))
  WITH CHECK (bucket_id IN ('one-pagers', 'report-assets', 'clinical-reports', 'clinical-images', 'doctor-avatars'));

-- No anon / authenticated policy for these buckets === explicit default-deny.

COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION (run read-only after apply; expect the stated result)
-- ============================================================================
-- select name, public from storage.buckets order by name;
--   -> clinical-images, clinical-reports, doctor-avatars, one-pagers, report-assets (public=false)
-- select polname, cmd, roles::regrole[] from pg_policy
--   where polrelid = 'public."ReportAsset"'::regclass order by polname;
--   -> ReportAsset_clinic_read (SELECT, authenticated), ReportAsset_service_role_all (ALL, service_role)
-- select count(*) from pg_policies where schemaname='storage' and tablename='objects';
--   -> >= 1 (clinical_buckets_service_role_all present)
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and proname in ('jwt_clinic_id','jwt_is_super_admin');
--   -> both present
-- ============================================================================
