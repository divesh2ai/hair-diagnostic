-- Sprint 1 Phase 3 — Super Admin + Clinic Admin module schema additions.
--
-- 1. ClinicStatus enum + Clinic.status
-- 2. Clinic branding/contact extensions (accentColor, footerText, website,
--    whatsappNumber, supportedLanguages[], settings, whatsappSettings)
-- 3. Doctor clinical credentials (qualification, registrationNumber, biography)
-- 4. PlatformSettings singleton + RLS

--------------------------------------------------------------------
-- 1. ClinicStatus enum + column
--------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill: any clinic with isActive = false → SUSPENDED. Archived must be
-- set explicitly by an admin.
UPDATE "Clinic" SET "status" = 'SUSPENDED' WHERE "isActive" = false AND "status" = 'ACTIVE';

--------------------------------------------------------------------
-- 2. Clinic branding/contact extensions
--------------------------------------------------------------------

ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "accentColor"        TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "footerText"         TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "website"            TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "whatsappNumber"     TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "settings"           JSONB;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "whatsappSettings"   JSONB;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "supportedLanguages" "SupportedLanguage"[] NOT NULL DEFAULT ARRAY[]::"SupportedLanguage"[];

--------------------------------------------------------------------
-- 3. Doctor clinical credentials
--------------------------------------------------------------------

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "qualification"      TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "biography"          TEXT;

--------------------------------------------------------------------
-- 4. PlatformSettings singleton
--------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id"                       TEXT NOT NULL,
    "singletonKey"             TEXT NOT NULL DEFAULT 'singleton',
    "platformName"             TEXT NOT NULL DEFAULT 'HairOS',
    "defaultTheme"             TEXT NOT NULL DEFAULT 'system',
    "defaultLanguage"          "SupportedLanguage" NOT NULL DEFAULT 'EN',
    "defaultWhatsappTemplate"  TEXT,
    "aiModelDefault"           TEXT,
    "aiNotes"                  TEXT,
    "versionInfo"              TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSettings_singletonKey_key"
    ON "PlatformSettings"("singletonKey");

-- Seed the singleton row if missing.
INSERT INTO "PlatformSettings" ("id", "singletonKey", "updatedAt")
SELECT 'plat_default', 'singleton', now()
WHERE NOT EXISTS (SELECT 1 FROM "PlatformSettings" WHERE "singletonKey" = 'singleton');

-- RLS — SUPER_ADMIN write, everyone authenticated read.
ALTER TABLE "PlatformSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PlatformSettings_select" ON "PlatformSettings";
CREATE POLICY "PlatformSettings_select" ON "PlatformSettings"
    FOR SELECT TO authenticated
    USING (true);
DROP POLICY IF EXISTS "PlatformSettings_modify" ON "PlatformSettings";
CREATE POLICY "PlatformSettings_modify" ON "PlatformSettings"
    FOR ALL TO authenticated
    USING (public.jwt_is_super_admin())
    WITH CHECK (public.jwt_is_super_admin());

INSERT INTO public._prisma_migrations
    (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
    (gen_random_uuid()::text, 'manual-resolve-phase3-admin', now(), '20260626_phase3_admin', NULL, NULL, now(), 1)
ON CONFLICT (id) DO NOTHING;
