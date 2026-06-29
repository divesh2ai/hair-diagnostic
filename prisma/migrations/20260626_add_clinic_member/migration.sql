-- Phase 1.1 — ClinicMember
-- Non-doctor clinic staff (CLINIC_ADMIN, STAFF) bound to a Clinic and a
-- Supabase auth user. The JWT custom_access_token_hook reads this table to
-- inject `clinic_id` for non-doctor roles.

CREATE TABLE IF NOT EXISTS "ClinicMember" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "role"           "SystemRole" NOT NULL,
    "name"           TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "deletedAt"      TIMESTAMP(3),
    CONSTRAINT "ClinicMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicMember_clinicId_supabaseUserId_key"
    ON "ClinicMember"("clinicId", "supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicMember_clinicId_email_key"
    ON "ClinicMember"("clinicId", "email");

CREATE INDEX IF NOT EXISTS "ClinicMember_clinicId_idx"
    ON "ClinicMember"("clinicId");

CREATE INDEX IF NOT EXISTS "ClinicMember_supabaseUserId_idx"
    ON "ClinicMember"("supabaseUserId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ClinicMember_clinicId_fkey'
    ) THEN
        ALTER TABLE "ClinicMember"
            ADD CONSTRAINT "ClinicMember_clinicId_fkey"
            FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;
