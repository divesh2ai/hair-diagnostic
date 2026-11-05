-- Rollout checklist: manual milestone sign-offs (ClinicMilestoneSignoff).
-- Additive and nullable-by-default. Safe to apply online: no existing table
-- is altered and nothing backfills. The operations dashboard treats this
-- table as a capability and degrades to "not provisioned" where it is absent,
-- so application code may ship ahead of this migration being authorised.

-- CreateEnum
CREATE TYPE "ClinicMilestone" AS ENUM ('DOCTOR_LOGIN', 'BRANCH_QR', 'FIRST_ASSESSMENT', 'FIRST_CONSULTATION', 'FIRST_REPORT', 'KIT_REVIEW', 'WHATSAPP_DELIVERY', 'PILOT_ACCEPTANCE');

-- CreateEnum
CREATE TYPE "MilestoneOutcome" AS ENUM ('VERIFIED', 'FAILED', 'BLOCKED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "ClinicMilestoneSignoff" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "locationId" TEXT,
    "milestone" "ClinicMilestone" NOT NULL,
    "outcome" "MilestoneOutcome" NOT NULL,
    "evidence" TEXT,
    "notes" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" "SystemRole",
    "signedOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicMilestoneSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicMilestoneSignoff_clinicId_idx" ON "ClinicMilestoneSignoff"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicMilestoneSignoff_clinicId_milestone_idx" ON "ClinicMilestoneSignoff"("clinicId", "milestone");

-- One CURRENT attestation per (clinic, milestone, branch), enforced as two
-- PARTIAL unique indexes. A plain UNIQUE over a nullable locationId would not
-- constrain clinic-level rows, because Postgres treats NULLs as distinct.
-- Prisma cannot express partial unique indexes, so these live here only.
CREATE UNIQUE INDEX "ClinicMilestoneSignoff_clinic_milestone_key"
  ON "ClinicMilestoneSignoff" ("clinicId", "milestone")
  WHERE "locationId" IS NULL;

CREATE UNIQUE INDEX "ClinicMilestoneSignoff_clinic_milestone_location_key"
  ON "ClinicMilestoneSignoff" ("clinicId", "milestone", "locationId")
  WHERE "locationId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ClinicMilestoneSignoff" ADD CONSTRAINT "ClinicMilestoneSignoff_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMilestoneSignoff" ADD CONSTRAINT "ClinicMilestoneSignoff_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ClinicLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

