-- Phase 1.3a — India-first identity alignment (addendum §4–§6)
--
-- - phone (WhatsApp) added to staff memberships and invitations
-- - NotificationChannel enum + ClinicInvitation.channel default WHATSAPP
-- - CHECK: every invitation must carry at least one contact method
-- - Phone on existing staff rows is added nullable, then backfilled out-
--   of-band by an ORG_ADMIN before being tightened (separate migration).

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'IN_APP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff phone: nullable for now to avoid breaking the seeded Doctor row.
ALTER TABLE "Doctor"             ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "ClinicMember"       ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- ClinicMember phone uniqueness within a clinic (matches schema)
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicMember_clinicId_phone_key"
    ON "ClinicMember"("clinicId", "phone")
    WHERE "phone" IS NOT NULL;

-- Invitation: phone, name, channel + tracking
ALTER TABLE "ClinicInvitation" ADD COLUMN IF NOT EXISTS "phone"            TEXT;
ALTER TABLE "ClinicInvitation" ADD COLUMN IF NOT EXISTS "name"             TEXT;
ALTER TABLE "ClinicInvitation" ADD COLUMN IF NOT EXISTS "invitedByPhone"   TEXT;
ALTER TABLE "ClinicInvitation" ADD COLUMN IF NOT EXISTS "channel"          "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "ClinicInvitation" ADD COLUMN IF NOT EXISTS "sentAt"           TIMESTAMP(3);
ALTER TABLE "ClinicInvitation" ADD COLUMN IF NOT EXISTS "sendError"        TEXT;

-- Email becomes optional; CHECK below enforces "at least one of email/phone".
ALTER TABLE "ClinicInvitation" ALTER COLUMN "email" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ClinicInvitation_phone_idx"
    ON "ClinicInvitation"("phone");

DO $$ BEGIN
  ALTER TABLE "ClinicInvitation"
    ADD CONSTRAINT "ClinicInvitation_contact_required"
    CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, 'manual-resolve-identity-alignment', now(), '20260626_identity_alignment', NULL, NULL, now(), 1)
ON CONFLICT (id) DO NOTHING;
