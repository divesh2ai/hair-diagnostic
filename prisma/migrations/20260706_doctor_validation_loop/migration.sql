-- Doctor Clinical Validation Loop — additive migration.
-- Adds:
--   • Phase A execution-lease fields on Assessment + supporting index
--   • KitOrderIntent (approval-time canonical order-intent record)
--   • RecommendationFeedback (structured doctor feedback capture)
-- All changes are additive; no existing columns are altered or dropped.

--------------------------------------------------------------------------------
-- Enums
--------------------------------------------------------------------------------

CREATE TYPE "KitOrderStatus" AS ENUM (
  'READY_FOR_FULFILMENT',
  'CANCELLED'
);

CREATE TYPE "FeedbackVerdict" AS ENUM (
  'CORRECT',
  'PARTLY_CORRECT',
  'INCORRECT',
  'SAFETY_CONCERN'
);

-- Recommendation feedback is strictly clinical. "Needs revision" is a
-- workflow action captured via the approve endpoint, NOT a feedback category,
-- so it does not appear here.
CREATE TYPE "FeedbackIssueType" AS ENUM (
  'WRONG_KIT_INCLUDED',
  'WRONG_KIT_EXCLUDED',
  'WRONG_ORDER',
  'MISSING_KIT',
  'SAFETY_ISSUE',
  'CONDITION_INTERPRETATION',
  'NARRATIVE_ONLY',
  'OTHER'
);

CREATE TYPE "FeedbackSeverity" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH'
);

--------------------------------------------------------------------------------
-- Assessment: Phase A execution lease
--------------------------------------------------------------------------------

ALTER TABLE "Assessment"
  ADD COLUMN "phaseAExecutionId"    TEXT,
  ADD COLUMN "phaseALeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "phaseAAttempt"        INTEGER NOT NULL DEFAULT 0;

-- Cheap scan for reclaim: "status IN (…mid-run…) AND phaseALeaseExpiresAt < now()"
CREATE INDEX "Assessment_status_phaseALeaseExpiresAt_idx"
  ON "Assessment"("status", "phaseALeaseExpiresAt");

--------------------------------------------------------------------------------
-- KitOrderIntent
--------------------------------------------------------------------------------

CREATE TABLE "KitOrderIntent" (
  "id"                    TEXT              NOT NULL,
  "consultationId"        TEXT              NOT NULL,
  "consultationVersionId" TEXT              NOT NULL,
  "assessmentId"          TEXT              NOT NULL,
  "clinicId"              TEXT              NOT NULL,
  "doctorId"              TEXT              NOT NULL,
  "kitIds"                TEXT[]            NOT NULL,
  "quantities"            JSONB,
  "status"                "KitOrderStatus"  NOT NULL DEFAULT 'READY_FOR_FULFILMENT',
  "createdAt"             TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)      NOT NULL,

  CONSTRAINT "KitOrderIntent_pkey" PRIMARY KEY ("id")
);

-- Idempotency: one intent per approved consultation version.
CREATE UNIQUE INDEX "KitOrderIntent_consultationId_consultationVersionId_key"
  ON "KitOrderIntent"("consultationId", "consultationVersionId");

CREATE INDEX "KitOrderIntent_clinicId_createdAt_idx"
  ON "KitOrderIntent"("clinicId", "createdAt");
CREATE INDEX "KitOrderIntent_doctorId_idx"           ON "KitOrderIntent"("doctorId");
CREATE INDEX "KitOrderIntent_assessmentId_idx"       ON "KitOrderIntent"("assessmentId");

ALTER TABLE "KitOrderIntent"
  ADD CONSTRAINT "KitOrderIntent_consultationId_fkey"
    FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KitOrderIntent_consultationVersionId_fkey"
    FOREIGN KEY ("consultationVersionId") REFERENCES "ConsultationVersion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KitOrderIntent_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KitOrderIntent_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KitOrderIntent_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

--------------------------------------------------------------------------------
-- RecommendationFeedback
--------------------------------------------------------------------------------

CREATE TABLE "RecommendationFeedback" (
  "id"                    TEXT                NOT NULL,
  "consultationId"        TEXT                NOT NULL,
  "consultationVersionId" TEXT                NOT NULL,
  "assessmentId"          TEXT                NOT NULL,
  "clinicId"              TEXT                NOT NULL,
  "doctorId"              TEXT                NOT NULL,
  "verdict"               "FeedbackVerdict"   NOT NULL,
  "issueType"             "FeedbackIssueType" NOT NULL,
  "severity"              "FeedbackSeverity"  NOT NULL,
  "expectedKitOrder"      TEXT[]              NOT NULL,
  "affectedKitIds"        TEXT[]              NOT NULL,
  "clinicalRationale"     TEXT,
  "createdAt"             TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationFeedback_consultationId_idx"
  ON "RecommendationFeedback"("consultationId");
CREATE INDEX "RecommendationFeedback_clinicId_createdAt_idx"
  ON "RecommendationFeedback"("clinicId", "createdAt");
CREATE INDEX "RecommendationFeedback_doctorId_idx"
  ON "RecommendationFeedback"("doctorId");

ALTER TABLE "RecommendationFeedback"
  ADD CONSTRAINT "RecommendationFeedback_consultationId_fkey"
    FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RecommendationFeedback_consultationVersionId_fkey"
    FOREIGN KEY ("consultationVersionId") REFERENCES "ConsultationVersion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RecommendationFeedback_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RecommendationFeedback_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RecommendationFeedback_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
