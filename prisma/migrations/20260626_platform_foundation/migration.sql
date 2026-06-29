-- Sprint 1 Phase 1 — Platform Foundation
--
-- 1. Enums for subscription tiers and supported languages.
-- 2. Clinic branding fields (primaryColor, secondaryColor, pdfBranding, reportBranding).
-- 3. Doctor avatar + signature + preferredLanguage.
-- 4. Subscription table (one row per Clinic, owned by Super Admin).
-- 5. Row Level Security across every tenant-scoped table, driven by the
--    JWT claims injected by custom_access_token_hook
--    (auth.jwt() ->> 'user_role', 'clinic_id').
--
-- RLS model:
--   - SUPER_ADMIN bypasses every tenant filter.
--   - DOCTOR / CLINIC_ADMIN / STAFF can SELECT/INSERT/UPDATE rows whose
--     clinicId matches their JWT clinic_id.
--   - PATIENT and unauthenticated roles get no access through anon/auth keys;
--     server uses service-role for orchestration writes and applies its own
--     tenant filter (still enforced by app-layer tenantGuard).
--   - Defense-in-depth: the proxy already gates routes by role. RLS is the
--     second wall — if a route forgets to scope a query, RLS blocks it.

--------------------------------------------------------------------
-- 1. Enums
--------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportedLanguage" AS ENUM ('EN', 'HI', 'MR', 'GU', 'PA', 'TA', 'TE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

--------------------------------------------------------------------
-- 2. Clinic branding
--------------------------------------------------------------------

ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "primaryColor"   TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "pdfBranding"    JSONB;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "reportBranding" JSONB;

--------------------------------------------------------------------
-- 3. Doctor avatar/signature/language
--------------------------------------------------------------------

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "avatarUrl"         TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "signatureUrl"      TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "preferredLanguage" "SupportedLanguage" NOT NULL DEFAULT 'EN';

--------------------------------------------------------------------
-- 4. Subscription table
--------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id"                     TEXT NOT NULL,
    "clinicId"               TEXT NOT NULL,
    "plan"                   "SubscriptionPlan"   NOT NULL DEFAULT 'TRIAL',
    "status"                 "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthlyAssessmentLimit" INTEGER,
    "doctorSeatLimit"        INTEGER,
    "storageMbLimit"         INTEGER,
    "assessmentsThisPeriod"  INTEGER NOT NULL DEFAULT 0,
    "storageMbUsed"          INTEGER NOT NULL DEFAULT 0,
    "periodStart"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd"              TIMESTAMP(3),
    "notes"                  TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_clinicId_key"
    ON "Subscription"("clinicId");

CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_plan_idx"   ON "Subscription"("plan");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Subscription_clinicId_fkey'
    ) THEN
        ALTER TABLE "Subscription"
            ADD CONSTRAINT "Subscription_clinicId_fkey"
            FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

--------------------------------------------------------------------
-- 5. Row Level Security
--
-- Helper: a SQL function that reads the role + clinic from the request JWT.
-- Marked STABLE so the planner can cache it per statement.
--------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jwt_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'user_role'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_clinic_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_user_role() = 'SUPER_ADMIN';
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_clinic_member(target_clinic_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_user_role() IN ('DOCTOR', 'CLINIC_ADMIN', 'STAFF')
     AND public.jwt_clinic_id() = target_clinic_id
     AND target_clinic_id <> '';
$$;

GRANT EXECUTE ON FUNCTION public.jwt_user_role()                TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_clinic_id()                TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_is_super_admin()           TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_is_clinic_member(text)     TO authenticated, anon, service_role;

-- Enable RLS + add policies. Each table gets one read policy and one write
-- policy. service_role bypasses RLS by default (Supabase behaviour); the
-- app-layer tenantGuard is responsible for scoping service-role writes.

-- Clinic — staff see their own clinic; Super Admin sees all.
ALTER TABLE "Clinic" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinic_select" ON "Clinic";
CREATE POLICY "Clinic_select" ON "Clinic"
    FOR SELECT TO authenticated
    USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("id"));
DROP POLICY IF EXISTS "Clinic_modify" ON "Clinic";
CREATE POLICY "Clinic_modify" ON "Clinic"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("id") AND public.jwt_user_role() IN ('CLINIC_ADMIN', 'ORG_ADMIN'))
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("id") AND public.jwt_user_role() IN ('CLINIC_ADMIN', 'ORG_ADMIN'))
    );

-- Subscription — read by clinic staff, write by Super Admin only.
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subscription_select" ON "Subscription";
CREATE POLICY "Subscription_select" ON "Subscription"
    FOR SELECT TO authenticated
    USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "Subscription_modify" ON "Subscription";
CREATE POLICY "Subscription_modify" ON "Subscription"
    FOR ALL TO authenticated
    USING (public.jwt_is_super_admin())
    WITH CHECK (public.jwt_is_super_admin());

-- Doctor — clinic members read; CLINIC_ADMIN / SUPER_ADMIN write.
ALTER TABLE "Doctor" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctor_select" ON "Doctor";
CREATE POLICY "Doctor_select" ON "Doctor"
    FOR SELECT TO authenticated
    USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "Doctor_modify" ON "Doctor";
CREATE POLICY "Doctor_modify" ON "Doctor"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("clinicId") AND public.jwt_user_role() IN ('CLINIC_ADMIN'))
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("clinicId") AND public.jwt_user_role() IN ('CLINIC_ADMIN'))
    );

-- ClinicMember
ALTER TABLE "ClinicMember" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ClinicMember_select" ON "ClinicMember";
CREATE POLICY "ClinicMember_select" ON "ClinicMember"
    FOR SELECT TO authenticated
    USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));
DROP POLICY IF EXISTS "ClinicMember_modify" ON "ClinicMember";
CREATE POLICY "ClinicMember_modify" ON "ClinicMember"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("clinicId") AND public.jwt_user_role() = 'CLINIC_ADMIN')
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("clinicId") AND public.jwt_user_role() = 'CLINIC_ADMIN')
    );

-- ClinicInvitation
ALTER TABLE "ClinicInvitation" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ClinicInvitation_access" ON "ClinicInvitation";
CREATE POLICY "ClinicInvitation_access" ON "ClinicInvitation"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("clinicId") AND public.jwt_user_role() IN ('CLINIC_ADMIN', 'ORG_ADMIN'))
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR (public.jwt_is_clinic_member("clinicId") AND public.jwt_user_role() IN ('CLINIC_ADMIN', 'ORG_ADMIN'))
    );

-- Patient
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patient_access" ON "Patient";
CREATE POLICY "Patient_access" ON "Patient"
    FOR ALL TO authenticated
    USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
    WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- PatientIdentifier — scope via parent Patient
ALTER TABLE "PatientIdentifier" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PatientIdentifier_access" ON "PatientIdentifier";
CREATE POLICY "PatientIdentifier_access" ON "PatientIdentifier"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Patient" p
            WHERE p."id" = "PatientIdentifier"."patientId"
              AND public.jwt_is_clinic_member(p."clinicId")
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Patient" p
            WHERE p."id" = "PatientIdentifier"."patientId"
              AND public.jwt_is_clinic_member(p."clinicId")
        )
    );

-- Assessment
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Assessment_access" ON "Assessment";
CREATE POLICY "Assessment_access" ON "Assessment"
    FOR ALL TO authenticated
    USING (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"))
    WITH CHECK (public.jwt_is_super_admin() OR public.jwt_is_clinic_member("clinicId"));

-- AssessmentResponse — scope via parent Assessment
ALTER TABLE "AssessmentResponse" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentResponse_access" ON "AssessmentResponse";
CREATE POLICY "AssessmentResponse_access" ON "AssessmentResponse"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "AssessmentResponse"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "AssessmentResponse"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    );

-- AIArtifact
ALTER TABLE "AIArtifact" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AIArtifact_access" ON "AIArtifact";
CREATE POLICY "AIArtifact_access" ON "AIArtifact"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "AIArtifact"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "AIArtifact"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    );

-- AssessmentEvent
ALTER TABLE "AssessmentEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentEvent_access" ON "AssessmentEvent";
CREATE POLICY "AssessmentEvent_access" ON "AssessmentEvent"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "AssessmentEvent"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "AssessmentEvent"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    );

-- OrchestrationLog
ALTER TABLE "OrchestrationLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OrchestrationLog_access" ON "OrchestrationLog";
CREATE POLICY "OrchestrationLog_access" ON "OrchestrationLog"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "OrchestrationLog"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "OrchestrationLog"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    );

-- AnalyticsEvent — clinicId is optional; null = platform-level (SUPER_ADMIN only).
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AnalyticsEvent_access" ON "AnalyticsEvent";
CREATE POLICY "AnalyticsEvent_access" ON "AnalyticsEvent"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR ("clinicId" IS NOT NULL AND public.jwt_is_clinic_member("clinicId"))
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR ("clinicId" IS NOT NULL AND public.jwt_is_clinic_member("clinicId"))
    );

-- WhatsappDelivery
ALTER TABLE "WhatsappDelivery" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "WhatsappDelivery_access" ON "WhatsappDelivery";
CREATE POLICY "WhatsappDelivery_access" ON "WhatsappDelivery"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "WhatsappDelivery"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "Assessment" a
            WHERE a."id" = "WhatsappDelivery"."assessmentId"
              AND public.jwt_is_clinic_member(a."clinicId")
        )
    );

-- AuditLog — read-only at the API layer; INSERT via service_role only.
-- Clinic members may read entries scoped to their clinic's assessments;
-- SUPER_ADMIN sees everything. UPDATE/DELETE blocked for everyone (immutable).
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AuditLog_select" ON "AuditLog";
CREATE POLICY "AuditLog_select" ON "AuditLog"
    FOR SELECT TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR (
            "assessmentId" IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM "Assessment" a
                WHERE a."id" = "AuditLog"."assessmentId"
                  AND public.jwt_is_clinic_member(a."clinicId")
            )
        )
    );

-- Organization / OrganizationMember — only ORG_ADMIN and SUPER_ADMIN.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organization_access" ON "Organization";
CREATE POLICY "Organization_access" ON "Organization"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "OrganizationMember" m
            WHERE m."organizationId" = "Organization"."id"
              AND m."supabaseUserId" = COALESCE(
                  (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'),
                  ''
              )
        )
    )
    WITH CHECK (
        public.jwt_is_super_admin()
        OR EXISTS (
            SELECT 1 FROM "OrganizationMember" m
            WHERE m."organizationId" = "Organization"."id"
              AND m."supabaseUserId" = COALESCE(
                  (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'),
                  ''
              )
              AND m."role" IN ('ORG_ADMIN', 'SUPER_ADMIN')
        )
    );

ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OrganizationMember_access" ON "OrganizationMember";
CREATE POLICY "OrganizationMember_access" ON "OrganizationMember"
    FOR ALL TO authenticated
    USING (
        public.jwt_is_super_admin()
        OR "supabaseUserId" = COALESCE(
            (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'),
            ''
        )
    )
    WITH CHECK (public.jwt_is_super_admin());

INSERT INTO public._prisma_migrations
    (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
    (gen_random_uuid()::text, 'manual-resolve-platform-foundation', now(), '20260626_platform_foundation', NULL, NULL, now(), 1)
ON CONFLICT (id) DO NOTHING;
