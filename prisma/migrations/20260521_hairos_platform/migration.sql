-- HairOS platform extension migration
-- Run: npx prisma migrate dev

-- AlterEnum
ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_REPORTS';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "rawResponses" JSONB;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "orchestrationStage" TEXT;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "orchestrationMeta" JSONB;
ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "executionId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrchestrationLog" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "confidence" DOUBLE PRECISION,
    "uncertainty" JSONB,
    "metadata" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrchestrationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT,
    "clinicId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsappDelivery" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "messageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsappDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrchestrationLog" ADD CONSTRAINT "OrchestrationLog_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
