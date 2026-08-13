-- Patient mobile identity (D1).
--
-- Adds the canonical E.164 column that lets a clinic recognise a returning
-- patient. Every assessment submission previously created a brand-new Patient
-- row, so this migration also backfills existing numbers into canonical form —
-- without which returning-patient history stays invisible for all pre-existing
-- records.
--
-- No unique constraint. Duplicates already exist in production for exactly the
-- reason above; adding UNIQUE(clinicId, phoneNormalized) here would fail the
-- migration. Resolution is application-level (most recent match wins) and
-- merging historical duplicates is a separate, reviewed job.

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT;

-- Backfill Indian mobiles. Mirrors lib/patient/phone.ts:
--   strip non-digits -> take the last 10 -> require a 6-9 leading digit.
-- Anything else (landlines, service codes, truncated entries) is left NULL so
-- it can never produce a false identity match.
UPDATE "Patient"
SET "phoneNormalized" = '+91' || RIGHT(regexp_replace("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND "phoneNormalized" IS NULL
  AND length(regexp_replace("phone", '\D', '', 'g')) BETWEEN 10 AND 13
  AND RIGHT(regexp_replace("phone", '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$';

-- Numbers already stored in E.164 for another country pass through unchanged.
UPDATE "Patient"
SET "phoneNormalized" = '+' || regexp_replace("phone", '\D', '', 'g')
WHERE "phone" IS NOT NULL
  AND "phoneNormalized" IS NULL
  AND "phone" LIKE '+%'
  AND regexp_replace("phone", '\D', '', 'g') NOT LIKE '91%'
  AND length(regexp_replace("phone", '\D', '', 'g')) BETWEEN 8 AND 15;

-- Identity lookups are always tenant-scoped: clinic first, then the number.
CREATE INDEX IF NOT EXISTS "Patient_clinicId_phoneNormalized_idx"
  ON "Patient" ("clinicId", "phoneNormalized");

-- ── Unresolved identity, made queryable ─────────────────────────────────────
-- When two or more records already carry a number, intake refuses to pick one
-- and quarantines the visit onto a fresh row (see lib/patient/identity). That
-- decision was previously recorded only in AuditLog, which means the only way
-- to answer "which identities in this clinic still need a human?" was to scrape
-- a log. This column makes it a query.
--
-- It is a flag, not a workflow. There is no merge engine behind it, no state
-- machine and no queue table — those are a later, reviewed piece of work.

DO $$
BEGIN
  CREATE TYPE "IdentityResolutionStatus" AS ENUM ('RESOLVED', 'AMBIGUOUS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- RESOLVED for every existing row. That is the truthful default: those rows
-- were created one-per-submission before identity matching existed, so none of
-- them was ever *flagged* as ambiguous. Live duplicates certainly exist, but
-- marking them all AMBIGUOUS here would hand reception a worklist of hundreds
-- of rows that no one has actually examined — a backlog dressed as a finding.
-- Historical de-duplication stays a separate, reviewed job.
ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "identityResolutionStatus" "IdentityResolutionStatus"
    NOT NULL DEFAULT 'RESOLVED';

ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "identityFlaggedAt" TIMESTAMP(3);

-- The worklist query: WHERE "clinicId" = ? AND "identityResolutionStatus" =
-- 'AMBIGUOUS'.
--
-- A partial index (WHERE status = 'AMBIGUOUS') would be cheaper still, since
-- ambiguity is rare and the RESOLVED majority is never selected on. It is
-- deliberately not used: Prisma has no syntax for a partial index, so the
-- schema and this migration would describe different objects, and every future
-- `migrate diff` would report drift on a table that handles patient identity.
-- The write cost of the plain composite is negligible at clinic scale; a
-- schema nobody trusts is not.
CREATE INDEX IF NOT EXISTS "Patient_clinicId_identityResolutionStatus_idx"
  ON "Patient" ("clinicId", "identityResolutionStatus");
