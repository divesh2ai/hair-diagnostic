-- Sprint 2 / Phase 2: Consultation aggregate + outbox event log.

-- Enums
CREATE TYPE "ConsultationStatus" AS ENUM (
  'DRAFT',
  'AWAITING_DOCTOR_REVIEW',
  'REVISED',
  'APPROVED',
  'ARCHIVED'
);

CREATE TYPE "ConsultationEventType" AS ENUM (
  'CONSULTATION_CREATED',
  'CONSULTATION_UPDATED',
  'CONSULTATION_APPROVED',
  'DOCTOR_REVIEW_COMPLETED',
  'REPORT_GENERATED',
  'PDF_GENERATED',
  'VIDEO_GENERATION_REQUESTED',
  'VIDEO_GENERATED',
  'RAG_INDEX_REQUESTED',
  'PATIENT_NOTIFICATION_REQUESTED',
  'PATIENT_NOTIFIED',
  'FOLLOWUP_CREATED'
);

CREATE TYPE "ConsultationEventStatus" AS ENUM (
  'PENDING',
  'PROCESSED',
  'FAILED'
);

CREATE TYPE "ConsultationApprovalStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REVISION_REQUESTED',
  'REJECTED'
);

-- Consultation aggregate root.
CREATE TABLE "Consultation" (
  "id"               TEXT NOT NULL,
  "assessmentId"     TEXT NOT NULL,
  "clinicId"         TEXT NOT NULL,
  "patientId"        TEXT NOT NULL,
  "status"           "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "createdBy"        TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Consultation_assessmentId_key" ON "Consultation"("assessmentId");
CREATE UNIQUE INDEX "Consultation_currentVersionId_key" ON "Consultation"("currentVersionId");
CREATE INDEX "Consultation_clinicId_idx" ON "Consultation"("clinicId");
CREATE INDEX "Consultation_patientId_idx" ON "Consultation"("patientId");
CREATE INDEX "Consultation_clinicId_status_idx" ON "Consultation"("clinicId", "status");

ALTER TABLE "Consultation"
  ADD CONSTRAINT "Consultation_assessmentId_fkey"
  FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consultation"
  ADD CONSTRAINT "Consultation_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consultation"
  ADD CONSTRAINT "Consultation_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutable version snapshots.
CREATE TABLE "ConsultationVersion" (
  "id"                   TEXT NOT NULL,
  "consultationId"       TEXT NOT NULL,
  "contentVersion"       INTEGER NOT NULL,
  "schemaVersion"        TEXT NOT NULL DEFAULT 'v1',
  "content"              JSONB NOT NULL,
  "engineVersions"       JSONB NOT NULL,
  "contentHash"          TEXT NOT NULL,
  "llmModel"             TEXT,
  "promptVersion"        TEXT,
  "knowledgeBaseVersion" TEXT,
  "approvalStatus"       "ConsultationApprovalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "approvedBy"           TEXT,
  "approvedAt"           TIMESTAMP(3),
  "approvalNotes"        TEXT,
  "createdBy"            TEXT NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultationVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsultationVersion_consultationId_contentVersion_key"
  ON "ConsultationVersion"("consultationId", "contentVersion");
CREATE INDEX "ConsultationVersion_consultationId_idx" ON "ConsultationVersion"("consultationId");
CREATE INDEX "ConsultationVersion_contentHash_idx" ON "ConsultationVersion"("contentHash");

ALTER TABLE "ConsultationVersion"
  ADD CONSTRAINT "ConsultationVersion_consultationId_fkey"
  FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Consultation"
  ADD CONSTRAINT "Consultation_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "ConsultationVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Outbox event log.
CREATE TABLE "ConsultationEvent" (
  "id"                    TEXT NOT NULL,
  "consultationId"        TEXT NOT NULL,
  "type"                  "ConsultationEventType" NOT NULL,
  "status"                "ConsultationEventStatus" NOT NULL DEFAULT 'PENDING',
  "payload"               JSONB NOT NULL,
  "consultationVersionId" TEXT,
  "attempts"              INTEGER NOT NULL DEFAULT 0,
  "lastError"             TEXT,
  "processedAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsultationEvent_consultationId_idx" ON "ConsultationEvent"("consultationId");
CREATE INDEX "ConsultationEvent_status_createdAt_idx" ON "ConsultationEvent"("status", "createdAt");
CREATE INDEX "ConsultationEvent_type_status_idx" ON "ConsultationEvent"("type", "status");

ALTER TABLE "ConsultationEvent"
  ADD CONSTRAINT "ConsultationEvent_consultationId_fkey"
  FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
