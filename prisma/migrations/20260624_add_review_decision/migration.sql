-- Add ReviewDecision enum + reviewer columns on Assessment.
-- Powers the /review/[token] doctor approval flow: a shareable link mints
-- a signed token; when the doctor submits Approve / Request edits / Reject
-- we persist the decision + reviewer free-text identity here. Once /doctor
-- auth ships, reviewerName/Email will be filled from the session instead.

DO $$ BEGIN
  CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'EDITS_REQUESTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Assessment"
  ADD COLUMN IF NOT EXISTS "reviewDecision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "reviewerName"   TEXT,
  ADD COLUMN IF NOT EXISTS "reviewerEmail"  TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNotes"    TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt"     TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Assessment_reviewDecision_idx" ON "Assessment" ("reviewDecision");
