-- ============================================================================
-- HairOS PRODUCTION BOOTSTRAP  (drfact-hairos-production / pykoyxbleowxwechotth)
-- ============================================================================
-- STATUS: TEMPLATE — do NOT run unattended. Prepared for review only.
-- Claude did not execute this. No production writes were performed.
--
-- Purpose: idempotently seed the minimum configuration rows HairOS needs to
-- operate — Organization, DrFACT Mumbai clinic, Super Admin + authorized
-- doctors (membership rows), and the PlatformSettings singleton. The approved
-- Kit/Product/Price catalog is handled separately (see step 6 note).
--
-- PRE-REQUISITES (must happen BEFORE this script):
--   1. Migration drift resolved: the production DB currently has NO RLS
--      policies and is missing 11 of 12 SQL functions (incl jwt_is_super_admin)
--      — see docs/launch/PRODUCTION_READINESS.md. Do not seed onto a DB whose
--      policies/functions are absent.
--   2. Auth users created via Supabase Auth Admin API / dashboard (NOT SQL),
--      their UUIDs captured and pasted into the :vars below. A membership row
--      whose supabaseUserId has no matching auth.users row logs nobody in.
--
-- IDEMPOTENCY: every statement is ON CONFLICT DO UPDATE / guarded, so re-runs
-- converge rather than duplicate. Stable ids (not random) make re-runs safe.
--
-- SAFETY GUARD: aborts unless you opt in for THIS run with
--   psql "<prod-conn>" -v confirm_prod=yes-i-understand -f scripts/prod-bootstrap.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- ---- paste the real values before running -------------------------------
\set org_id              'org_drfact'
\set org_name            'The Fact Nutrition'
\set org_slug            'the-fact-nutrition'
\set clinic_id           'clinic_drfact_mumbai'
\set clinic_name         'DrFACT Mumbai'
\set clinic_slug         'drfact-mumbai'
\set clinic_region       'Mumbai'
-- Super Admin (auth user must already exist; paste its auth.users UUID):
\set superadmin_uid      'PASTE-SUPABASE-AUTH-UUID'
\set superadmin_name     'Divesh'
\set superadmin_email    'divesh2ai@gmail.com'
\set superadmin_phone    '+91XXXXXXXXXX'
-- --------------------------------------------------------------------------

BEGIN;

-- Guard: refuse unless explicitly confirmed for this run.
DO $$
BEGIN
  IF current_setting('my.confirm_prod', true) IS DISTINCT FROM 'yes-i-understand' THEN
    RAISE EXCEPTION 'Refusing to run: pass -v confirm_prod=yes-i-understand to confirm this is intentional.';
  END IF;
END $$;
-- (psql maps -v confirm_prod=... to the :confirm_prod var; bind it to a GUC so
--  the DO block can read it.)
SELECT set_config('my.confirm_prod', :'confirm_prod', true);

-- 1) Organization ----------------------------------------------------------
INSERT INTO "Organization" (id, name, slug, "isActive", "createdAt", "updatedAt")
VALUES (:'org_id', :'org_name', :'org_slug', true, now(), now())
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, slug = EXCLUDED.slug, "isActive" = true, "updatedAt" = now();

-- 2) DrFACT Mumbai clinic ---------------------------------------------------
--    status defaults to ACTIVE; supportedLanguages defaults to '{}'.
INSERT INTO "Clinic" (id, "organizationId", name, slug, region, "isActive", status, "createdAt", "updatedAt")
VALUES (:'clinic_id', :'org_id', :'clinic_name', :'clinic_slug', :'clinic_region', true, 'ACTIVE', now(), now())
ON CONFLICT (id) DO UPDATE
  SET "organizationId" = EXCLUDED."organizationId", name = EXCLUDED.name, slug = EXCLUDED.slug,
      region = EXCLUDED.region, "isActive" = true, status = 'ACTIVE', "updatedAt" = now();

-- 3) Super Admin membership (role from enum SystemRole) ---------------------
--    phone is NOT NULL with no default — supply it. supabaseUserId must match
--    a real auth.users row (verified by the guard below).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = :'superadmin_uid') THEN
    RAISE EXCEPTION 'Super Admin auth user % does not exist — create it in Supabase Auth first.', :'superadmin_uid';
  END IF;
END $$;

INSERT INTO "OrganizationMember"
  (id, "organizationId", "supabaseUserId", role, name, email, phone, "isActive", "createdAt", "updatedAt")
VALUES
  ('om_superadmin', :'org_id', :'superadmin_uid', 'SUPER_ADMIN',
   :'superadmin_name', :'superadmin_email', :'superadmin_phone', true, now(), now())
ON CONFLICT (id) DO UPDATE
  SET "organizationId" = EXCLUDED."organizationId", "supabaseUserId" = EXCLUDED."supabaseUserId",
      role = 'SUPER_ADMIN', name = EXCLUDED.name, email = EXCLUDED.email,
      phone = EXCLUDED.phone, "isActive" = true, "updatedAt" = now();

-- 4) Authorized doctors -----------------------------------------------------
--    Repeat this block per doctor. Each needs: a pre-created auth user UUID,
--    a Doctor row (clinic-scoped), and — if they sign in — a membership row
--    (ClinicMember role DOCTOR, or OrganizationMember). Doctor.email/name/
--    clinicId/updatedAt are the NOT-NULL fields. Example (fill real values):
--
-- INSERT INTO "Doctor" (id, "clinicId", name, email, "isActive", "provisioningStatus", "createdAt", "updatedAt")
-- VALUES ('doctor_<slug>', :'clinic_id', '<Full Name>', '<email>', true, 'ACTIVE', now(), now())
-- ON CONFLICT (id) DO UPDATE
--   SET "clinicId" = EXCLUDED."clinicId", name = EXCLUDED.name, email = EXCLUDED.email,
--       "isActive" = true, "updatedAt" = now();
--
-- INSERT INTO "ClinicMember" (id, "clinicId", "supabaseUserId", role, name, email, phone, "isActive", "createdAt", "updatedAt")
-- VALUES ('cm_<slug>', :'clinic_id', '<auth-uuid>', 'DOCTOR', '<Full Name>', '<email>', '<+91...>', true, now(), now())
-- ON CONFLICT (id) DO UPDATE SET ... ;

-- 5) PlatformSettings singleton --------------------------------------------
--    phase3_admin's seed row is MISSING in production; create it idempotently.
INSERT INTO "PlatformSettings" (id, "singletonKey", "updatedAt")
VALUES ('plat_default', 'singleton', now())
ON CONFLICT ("singletonKey") DO UPDATE SET "updatedAt" = now();

-- 6) Approved Kit / Product / Price catalog --------------------------------
--    INTENTIONALLY NOT TEMPLATED HERE. The catalog is clinical data that must
--    come from the approved source of truth (data/ + the KitVersion/KitProduct/
--    KitSchedule/ProductPrice/KitPrice graph), not be invented. Load it via the
--    repo's reviewed catalog seed against this same connection, or the Super
--    Admin UI, AFTER steps 1-5. See docs/launch/PRODUCTION_READINESS.md §catalog.

-- Review the row counts, THEN decide to COMMIT or ROLLBACK.
-- COMMIT;
ROLLBACK;  -- default: leaves the DB unchanged until a human flips this.
