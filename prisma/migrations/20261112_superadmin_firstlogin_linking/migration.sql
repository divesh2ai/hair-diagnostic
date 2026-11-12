-- Super Admin first-login identity linking — production parity.
--
-- WHAT THIS IS
-- ------------
-- These changes were ALREADY APPLIED to the staging database by hand while the
-- second platform administrator (CEO) was onboarded onto the existing Supabase
-- Google OAuth. This migration exists ONLY to carry the identical change to any
-- database that is promoted from these migration files (prod parity). Every
-- statement is idempotent, so re-applying it over a database that already has
-- the staging state is a no-op.
--
-- 1. OrganizationMember.supabaseUserId and .phone are made nullable, so a
--    platform admin can be pre-authorised from their e-mail alone (no Supabase
--    identity, no mobile on file) and claim their row on first login.
--
-- 2. custom_access_token_hook is HARDENED: the OrganizationMember (admin) branch
--    is now keyed strictly on `supabaseUserId = uid` AND a confirmed auth
--    e-mail. The previous pre-link fallback — `supabaseUserId IS NULL AND
--    email = auth.users.email` — is REMOVED for the admin tier, so the highest
--    privilege in the system can never be minted from an unverified,
--    caller-influenced e-mail string. Identity is attached by the verified
--    first-login flow (apps/patient-portal/src/lib/auth/linkPendingAdmin.ts)
--    BEFORE this branch can grant anything. The Doctor, ClinicMember and
--    Patient branches are unchanged.
--
-- Mirror kept in sync: supabase/functions/custom_access_token_hook.sql
--
-- Rollback: re-add NOT NULL only after backfilling the columns, and re-apply
-- the previous CREATE OR REPLACE FUNCTION body (with the admin-tier e-mail
-- fallback) from git history of the mirror file.

-- 1. Nullable columns (idempotent: DROP NOT NULL on an already-nullable column
--    succeeds and changes nothing).
ALTER TABLE "OrganizationMember" ALTER COLUMN "supabaseUserId" DROP NOT NULL;
ALTER TABLE "OrganizationMember" ALTER COLUMN "phone" DROP NOT NULL;

-- 2. Hardened hook (CREATE OR REPLACE is idempotent).
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid                    text  := event->>'user_id';
  claims                 jsonb := COALESCE(event->'claims', '{}'::jsonb);
  user_email             text;
  user_phone             text;
  user_email_confirmed   timestamptz;
  v_role                 text;
  v_clinic_id            text;
  v_org_id               text;
  v_doctor_clinic        text;
  v_clinic_admin_clinic  text;
BEGIN
  SELECT u.email, u.phone, u.email_confirmed_at
    INTO user_email, user_phone, user_email_confirmed
  FROM auth.users u WHERE u.id::text = uid;

  -- 1. Organization-level admin — HARDENED.
  -- Keyed strictly on the linked uid AND a confirmed auth e-mail. The former
  -- pre-link e-mail fallback is intentionally gone from this tier: a platform
  -- admin role is only ever granted to a row whose supabaseUserId has already
  -- been set, by the verified first-login linker, for a confirmed account.
  IF user_email_confirmed IS NOT NULL THEN
    SELECT om.role::text, om."organizationId" INTO v_role, v_org_id
    FROM public."OrganizationMember" om
    WHERE om."supabaseUserId" = uid
      AND om."isActive" = true AND om."deletedAt" IS NULL
    ORDER BY CASE om.role WHEN 'SUPER_ADMIN' THEN 0 WHEN 'ORG_ADMIN' THEN 1 ELSE 9 END
    LIMIT 1;
  END IF;

  -- 2. Doctor (+ solo-clinic-admin promotion) — UNCHANGED.
  IF v_role IS NULL THEN
    SELECT d."clinicId", c."organizationId" INTO v_doctor_clinic, v_org_id
    FROM public."Doctor" d
    JOIN public."Clinic" c ON c.id = d."clinicId"
    WHERE (
        d."supabaseUserId" = uid
        OR d."supabasePhoneUserId" = uid
        OR (d."supabaseUserId" IS NULL AND d.email = user_email)
        OR (
          d."supabaseUserId" IS NULL
          AND user_phone IS NOT NULL
          AND d.phone IS NOT NULL
          AND regexp_replace(d.phone, '\D', '', 'g') = regexp_replace(user_phone, '\D', '', 'g')
        )
      )
      AND d."isActive" = true AND d."deletedAt" IS NULL
    LIMIT 1;

    IF v_doctor_clinic IS NOT NULL THEN
      SELECT cm."clinicId" INTO v_clinic_admin_clinic
      FROM public."ClinicMember" cm
      WHERE cm."clinicId" = v_doctor_clinic
        AND cm.role::text = 'CLINIC_ADMIN'
        AND (cm."supabaseUserId" = uid OR (cm."supabaseUserId" IS NULL AND cm.email = user_email))
        AND cm."isActive" = true AND cm."deletedAt" IS NULL
      LIMIT 1;

      IF v_clinic_admin_clinic IS NOT NULL THEN
        v_role := 'CLINIC_ADMIN';
        v_clinic_id := v_doctor_clinic;
      ELSE
        v_role := 'DOCTOR';
        v_clinic_id := v_doctor_clinic;
      END IF;
    END IF;
  END IF;

  -- 3. Clinic-scoped non-doctor staff — UNCHANGED.
  IF v_role IS NULL THEN
    SELECT cm.role::text, cm."clinicId", c."organizationId" INTO v_role, v_clinic_id, v_org_id
    FROM public."ClinicMember" cm
    JOIN public."Clinic" c ON c.id = cm."clinicId"
    WHERE (cm."supabaseUserId" = uid OR (cm."supabaseUserId" IS NULL AND cm.email = user_email))
      AND cm."isActive" = true AND cm."deletedAt" IS NULL
    ORDER BY CASE cm.role WHEN 'CLINIC_ADMIN' THEN 0 WHEN 'STAFF' THEN 1 ELSE 9 END
    LIMIT 1;
  END IF;

  -- 4. Patient — UNCHANGED.
  IF v_role IS NULL THEN
    SELECT 'PATIENT', p."clinicId" INTO v_role, v_clinic_id
    FROM public."Patient" p
    WHERE p."supabaseUserId" = uid
      AND p."isActive" = true AND p."deletedAt" IS NULL
    LIMIT 1;
  END IF;

  IF v_role        IS NOT NULL THEN claims := jsonb_set(claims, '{user_role}',       to_jsonb(v_role)); END IF;
  IF v_clinic_id   IS NOT NULL THEN claims := jsonb_set(claims, '{clinic_id}',       to_jsonb(v_clinic_id)); END IF;
  IF v_org_id      IS NOT NULL THEN claims := jsonb_set(claims, '{organization_id}', to_jsonb(v_org_id)); END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$function$;
