-- Add Phase A / Phase B status values used by the split orchestrator.
-- CLINICAL_READY  → Phase A done; doctor can begin consultation.
-- REPORT_GENERATING → Phase B in flight; PDF being produced.
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'CLINICAL_READY';
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'REPORT_GENERATING';

-- Phase A execution lease. See src/packages/assessment-orchestrator/claim.ts.
-- Prevents duplicate concurrent Phase A runs on the same assessment and
-- allows a crashed worker to be reclaimed after its lease expires. All
-- three columns are additive; existing rows default to NULL / 0.
ALTER TABLE "Assessment"
  ADD COLUMN "phaseAExecutionId"    TEXT,
  ADD COLUMN "phaseALeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "phaseAAttempt"        INTEGER NOT NULL DEFAULT 0;

-- Cheap scan for reclaim:
--   status IN (…mid-run states…) AND phaseALeaseExpiresAt < now()
CREATE INDEX "Assessment_status_phaseALeaseExpiresAt_idx"
  ON "Assessment"("status", "phaseALeaseExpiresAt");
