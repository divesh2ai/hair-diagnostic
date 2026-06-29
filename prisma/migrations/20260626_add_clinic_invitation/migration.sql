-- Phase 1.3 — Invitation System
--
-- One row per outstanding invite to join an Organization (ORG_ADMIN) or
-- a Clinic (CLINIC_ADMIN | STAFF | DOCTOR). tokenHash stores sha256 of
-- the raw token returned at creation; the raw token never lives in the
-- database. CHECK constraints enforce: exactly one of clinic/org scope,
-- and roles match the scope they grant.

DO $$ BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClinicInvitation" (
    "id"                       TEXT NOT NULL,
    "clinicId"                 TEXT,
    "organizationId"           TEXT,
    "email"                    TEXT NOT NULL,
    "role"                     "SystemRole" NOT NULL,
    "tokenHash"                TEXT NOT NULL,
    "invitedBySupabaseUserId"  TEXT,
    "invitedByEmail"           TEXT,
    "status"                   "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt"                TIMESTAMP(3) NOT NULL,
    "acceptedAt"               TIMESTAMP(3),
    "acceptedBySupabaseUserId" TEXT,
    "revokedAt"                TIMESTAMP(3),
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClinicInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicInvitation_tokenHash_key"
    ON "ClinicInvitation"("tokenHash");

CREATE INDEX IF NOT EXISTS "ClinicInvitation_clinicId_idx"       ON "ClinicInvitation"("clinicId");
CREATE INDEX IF NOT EXISTS "ClinicInvitation_organizationId_idx" ON "ClinicInvitation"("organizationId");
CREATE INDEX IF NOT EXISTS "ClinicInvitation_email_idx"          ON "ClinicInvitation"("email");
CREATE INDEX IF NOT EXISTS "ClinicInvitation_status_idx"         ON "ClinicInvitation"("status");

-- Exactly one scope
DO $$ BEGIN
  ALTER TABLE "ClinicInvitation"
    ADD CONSTRAINT "ClinicInvitation_scope_xor"
    CHECK (("clinicId" IS NOT NULL)::int + ("organizationId" IS NOT NULL)::int = 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Role must match scope
DO $$ BEGIN
  ALTER TABLE "ClinicInvitation"
    ADD CONSTRAINT "ClinicInvitation_role_matches_scope"
    CHECK (
      ("organizationId" IS NOT NULL AND "role" IN ('ORG_ADMIN', 'SUPER_ADMIN'))
      OR
      ("clinicId" IS NOT NULL AND "role" IN ('CLINIC_ADMIN', 'STAFF', 'DOCTOR'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClinicInvitation"
    ADD CONSTRAINT "ClinicInvitation_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClinicInvitation"
    ADD CONSTRAINT "ClinicInvitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Phase 1.4 will add policies. Default-deny is fine until then because
-- all access goes through the server using the service_role key.
ALTER TABLE "ClinicInvitation" ENABLE ROW LEVEL SECURITY;

-- Also harden ClinicMember.role at the DB layer.
DO $$ BEGIN
  ALTER TABLE "ClinicMember"
    ADD CONSTRAINT "ClinicMember_role_allowed"
    CHECK ("role" IN ('CLINIC_ADMIN', 'STAFF', 'DOCTOR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
