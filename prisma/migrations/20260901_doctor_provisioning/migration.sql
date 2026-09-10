-- Doctor provisioning provenance.
--
-- Two changes, both additive in effect:
--
--   1. Doctor.email becomes nullable. It is the OTP login identity, so a row
--      cannot carry a placeholder without that placeholder reading as a real
--      credential. A clinician whose personal address nobody has confirmed is
--      now representable as exactly that.
--
--   2. Doctor.provisioningStatus records how far the row is from being a
--      usable login, plus where the row came from.
--
-- The two CHECK constraints exist so the column cannot claim a readiness the
-- rest of the row contradicts: nothing may be ACTIVE without a linked auth
-- account, and nothing may be READY_TO_INVITE / INVITED / ACTIVE with no
-- contact at all. "READY" has to be true, not asserted.

CREATE TYPE "DoctorProvisioningStatus" AS ENUM (
  'CONTACT_REQUIRED',
  'READY_TO_INVITE',
  'INVITED',
  'ACTIVE'
);

ALTER TABLE "Doctor" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "Doctor"
  ADD COLUMN "provisioningStatus" "DoctorProvisioningStatus" NOT NULL DEFAULT 'CONTACT_REQUIRED',
  ADD COLUMN "provisioningSource" TEXT,
  ADD COLUMN "provisionedAt" TIMESTAMP(3);

-- Backfill: every row that already exists predates this column. Its state is
-- knowable from the columns that were already there, so it is derived rather
-- than defaulted to CONTACT_REQUIRED, which would be wrong for the accounts
-- that can already sign in.
UPDATE "Doctor"
SET "provisioningStatus" = CASE
      WHEN "supabaseUserId" IS NOT NULL THEN 'ACTIVE'::"DoctorProvisioningStatus"
      WHEN "email" IS NOT NULL OR "phone" IS NOT NULL THEN 'READY_TO_INVITE'::"DoctorProvisioningStatus"
      ELSE 'CONTACT_REQUIRED'::"DoctorProvisioningStatus"
    END;

ALTER TABLE "Doctor"
  ADD CONSTRAINT "Doctor_active_requires_auth_identity"
  CHECK ("provisioningStatus" <> 'ACTIVE' OR "supabaseUserId" IS NOT NULL);

ALTER TABLE "Doctor"
  ADD CONSTRAINT "Doctor_invitable_requires_contact"
  CHECK (
    "provisioningStatus" = 'CONTACT_REQUIRED'
    OR "email" IS NOT NULL
    OR "phone" IS NOT NULL
  );

CREATE INDEX "Doctor_provisioningStatus_idx" ON "Doctor" ("provisioningStatus");
