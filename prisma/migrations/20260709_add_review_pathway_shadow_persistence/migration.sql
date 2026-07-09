-- Add shadow-persisted review pathway fields on Assessment.
-- Canonical operational pathway is Assessment-centric and additive only.

--------------------------------------------------------------------------------
-- Enums
--------------------------------------------------------------------------------

CREATE TYPE "ReviewPathway" AS ENUM (
  'ROUTINE_REVIEW',
  'FOCUSED_REVIEW',
  'EXAMINATION_REQUIRED',
  'RESOLUTION_REQUIRED'
);

--------------------------------------------------------------------------------
-- Assessment review pathway shadow persistence
--------------------------------------------------------------------------------

ALTER TABLE "Assessment"
  ADD COLUMN "reviewPathway" "ReviewPathway",
  ADD COLUMN "reviewPathwayReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reviewPathwayVersion" TEXT,
  ADD COLUMN "reviewPathwayEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN "reviewPathwaySource" JSONB;

CREATE INDEX "Assessment_clinicId_reviewPathway_idx"
  ON "Assessment"("clinicId", "reviewPathway");
