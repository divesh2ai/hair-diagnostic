-- Custom access-token hook — canonical mirror.
--
-- Registered in Supabase: Auth → Hooks → custom_access_token.
-- Captured from production: 2026-08-10 (project gwkgopbscdftpitppgwe).
-- Phone fallback for Doctor added: 2026-09-09 (see
-- prisma/migrations/20260909_doctor_phone_otp_claims/migration.sql).
-- See supabase/README.md for the sync workflow.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ ROLE PRECEDENCE (first match wins)                                      │
-- │                                                                         │
-- │   1. OrganizationMember  → SUPER_ADMIN / ORG_ADMIN                      │
-- │        Ordered by CASE: SUPER_ADMIN (0) < ORG_ADMIN (1) < others (9).   │
-- │        A user matching at this tier does NOT fall through to Doctor.    │
-- │                                                                         │
-- │   2. Doctor              → DOCTOR (+ solo-clinic-admin promotion)       │
-- │        If the same identity also has a ClinicMember(role=CLINIC_ADMIN)  │
-- │        in the doctor's clinic, emitted role = CLINIC_ADMIN instead.     │
-- │                                                                         │
-- │   3. ClinicMember        → CLINIC_ADMIN / STAFF                         │
-- │        Ordered by CASE: CLINIC_ADMIN (0) < STAFF (1) < others (9).      │
-- │                                                                         │
-- │   4. Patient             → PATIENT                                      │
-- │                                                                         │
-- │ Identity match:                                                        │
-- │   OrganizationMember / ClinicMember / Patient:                         │
-- │     (supabaseUserId = uid) OR                                          │
-- │     (supabaseUserId IS NULL AND email = auth.users.email).             │
-- │   Doctor (widened 2026-09-09 for mobile-only launch doctors):          │
-- │     (supabaseUserId = uid) OR                                          │
-- │     (supabaseUserId IS NULL AND email = auth.users.email) OR           │
-- │     (supabaseUserId IS NULL AND phone digits match auth.users.phone    │
-- │      digits — both sides compared with non-digits stripped, since      │
-- │      Doctor.phone is stored as "+91XXXXXXXXXX" and Supabase stores     │
-- │      auth.users.phone as "91XXXXXXXXXX", no leading '+').              │
-- │ The pre-link fallback lets pre-provisioned rows work before their      │
-- │ supabaseUserId is backfilled — this is the mechanism the invitation    │
-- │ ACCEPT flow (email) and the phone-OTP first-login flow (phone) both    │
-- │ rely on to link identity, and it is what makes the FIRST token minted  │
-- │ right after OTP verification already carry role=DOCTOR, before any     │
-- │ application code has had a chance to write supabaseUserId back.        │
-- │                                                                         │
-- │ Emitted claims (top-level):                                             │
-- │   user_role, clinic_id, organization_id                                 │
-- │                                                                         │
-- │ KNOWN DIVERGENCE from docs/security/authorization-specification.md §1.5 │
-- │   Spec calls for a `memberships[]` JSON array and mfa_level/session_id  │
-- │   claims. Current hook emits only single flat claims. Multi-membership  │
-- │   support is P2 (multi-clinic doctor refactor).                         │
-- │                                                                         │
-- │ CONSEQUENCE: A Supabase user cannot hold BOTH SUPER_ADMIN AND DOCTOR    │
-- │ simultaneously in the JWT — precedence step 1 wins. The /doctor        │
-- │ surface therefore uses a SEPARATE server-side Doctor-row check         │
-- │ (loadDoctorShellData) so admins with a linked Doctor row can still     │
-- │ enter the workspace in "view-mode" without needing a second claim.     │
-- └─────────────────────────────────────────────────────────────────────────┘

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
