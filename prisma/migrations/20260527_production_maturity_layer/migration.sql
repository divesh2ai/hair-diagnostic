-- ─── HairOS Production Maturity Layer Migration ───────────────────────────────
-- Priority 1: Canonical AssessmentStatus enum with deterministic stages
-- Priority 3: AssessmentEvent model for full event sourcing
-- Priority 5: Orchestration checkpoint fields + AIArtifact upsert support
--
-- Apply with: npx prisma migrate deploy
-- Or for dev:  npx prisma migrate dev --name production_maturity_layer
-- ──────────────────────────────────────────────────────────────────────────────

-- Step 1: Add new enum values (Postgres supports ADD VALUE idempotently)
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'NORMALIZING';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'RUNNING_CLINICAL_ENGINE';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'GENERATING_RECOMMENDATIONS';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'GENERATING_REPORT';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL_FAILURE';

-- Step 2: Migrate existing rows to new canonical statuses
UPDATE "Assessment" SET status = 'NORMALIZING'   WHERE status = 'PROCESSING';
UPDATE "Assessment" SET status = 'COMPLETED'      WHERE status = 'COMPLETED_WITH_REPORTS';

-- Step 3: Recreate enum WITHOUT the retired values (PROCESSING, COMPLETED_WITH_REPORTS)
-- Postgres requires a full type swap to remove values.
CREATE TYPE "AssessmentStatus_v2" AS ENUM (
  'PENDING',
  'QUEUED',
  'NORMALIZING',
  'RUNNING_CLINICAL_ENGINE',
  'GENERATING_RECOMMENDATIONS',
  'GENERATING_REPORT',
  'COMPLETED',
  'FAILED',
  'PARTIAL_FAILURE'
);

ALTER TABLE "Assessment"
  ALTER COLUMN "status" TYPE "AssessmentStatus_v2"
  USING "status"::text::"AssessmentStatus_v2";

DROP TYPE "AssessmentStatus";
ALTER TYPE "AssessmentStatus_v2" RENAME TO "AssessmentStatus";

-- Step 4: Add orchestration checkpoint + timing fields to Assessment
ALTER TABLE "Assessment"
  ADD COLUMN IF NOT EXISTS "lastCompletedStage" TEXT,
  ADD COLUMN IF NOT EXISTS "queuedAt"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "startedAt"          TIMESTAMPTZ;

-- Step 5: Add unique constraint to AIArtifact for idempotent upserts
-- Drop any duplicate rows first (keep the most recent per assessmentId+type)
DELETE FROM "AIArtifact" a
  USING "AIArtifact" b
  WHERE a."assessmentId" = b."assessmentId"
    AND a."type" = b."type"
    AND a."createdAt" < b."createdAt";

ALTER TABLE "AIArtifact"
  ADD CONSTRAINT "AIArtifact_assessmentId_type_key"
  UNIQUE ("assessmentId", "type");

-- Step 6: Create AssessmentEvent table (event sourcing)
CREATE TABLE IF NOT EXISTS "AssessmentEvent" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "assessmentId" TEXT         NOT NULL,
  "type"         TEXT         NOT NULL,
  "stage"        TEXT,
  "message"      TEXT,
  "metadata"     JSONB,
  "durationMs"   INTEGER,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "AssessmentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssessmentEvent_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AssessmentEvent_assessmentId_idx"
  ON "AssessmentEvent" ("assessmentId");

CREATE INDEX IF NOT EXISTS "AssessmentEvent_type_idx"
  ON "AssessmentEvent" ("type");

CREATE INDEX IF NOT EXISTS "AssessmentEvent_assessmentId_createdAt_idx"
  ON "AssessmentEvent" ("assessmentId", "createdAt");
