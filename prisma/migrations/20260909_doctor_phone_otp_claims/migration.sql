-- Widen custom_access_token_hook's Doctor identity match to also fall back
-- on phone (not just email), so a mobile-only launch doctor's FIRST token
-- minted right after phone-OTP verification already carries role=DOCTOR —
-- before the application has had a chance to write Doctor.supabaseUserId.
--
-- Mirror kept in sync: supabase/functions/custom_access_token_hook.sql
--
-- Rollback: re-apply the previous CREATE OR REPLACE FUNCTION body (email-only
-- fallback) from git history of that mirror file.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid           text  := event->>'user_id';
  claims        jsonb := COALESCE(event->'claims', '{}'::jsonb);
  user_email    text;
  user_phone    text;
  v_role        text;
  v_clinic_id   text;
  v_org_id      text;
  v_doctor_clinic text;
  v_clinic_admin_clinic text;
BEGIN
  SELECT u.email, u.phone INTO user_email, user_phone FROM auth.users u WHERE u.id::text = uid;

  -- 1. Organization-level admin
  SELECT om.role::text, om."organizationId" INTO v_role, v_org_id
  FROM public."OrganizationMember" om
  WHERE (om."supabaseUserId" = uid OR (om."supabaseUserId" IS NULL AND om.email = user_email))
    AND om."isActive" = true AND om."deletedAt" IS NULL
  ORDER BY CASE om.role WHEN 'SUPER_ADMIN' THEN 0 WHEN 'ORG_ADMIN' THEN 1 ELSE 9 END
  LIMIT 1;

  -- 2. Doctor (+ solo-clinic-admin promotion)
  IF v_role IS NULL THEN
    SELECT d."clinicId", c."organizationId" INTO v_doctor_clinic, v_org_id
    FROM public."Doctor" d
    JOIN public."Clinic" c ON c.id = d."clinicId"
    WHERE (
        d."supabaseUserId" = uid
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

  -- 3. Clinic-scoped non-doctor staff
  IF v_role IS NULL THEN
    SELECT cm.role::text, cm."clinicId", c."organizationId" INTO v_role, v_clinic_id, v_org_id
    FROM public."ClinicMember" cm
    JOIN public."Clinic" c ON c.id = cm."clinicId"
    WHERE (cm."supabaseUserId" = uid OR (cm."supabaseUserId" IS NULL AND cm.email = user_email))
      AND cm."isActive" = true AND cm."deletedAt" IS NULL
    ORDER BY CASE cm.role WHEN 'CLINIC_ADMIN' THEN 0 WHEN 'STAFF' THEN 1 ELSE 9 END
    LIMIT 1;
  END IF;

  -- 4. Patient
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
