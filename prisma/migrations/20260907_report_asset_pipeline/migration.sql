-- Report asset pipeline: durable, idempotent, retryable rendering of approved
-- clinical artefacts, plus the delivery provenance that makes a historical
-- send reconstructable.
--
-- ── What this adds ─────────────────────────────────────────────────────────
--   "ReportAsset"                    one row per (approved version, artefact),
--                                    which is BOTH the durable record of the
--                                    rendered file AND the queue entry that
--                                    produces it.
--   "ReportAssetType" / "…Status"    the two enums it needs.
--   "WhatsappDelivery" + 7 columns   which exact version, which exact bytes.
--
-- ── Additive and backward compatible ───────────────────────────────────────
-- Every statement is CREATE or ADD COLUMN. Nothing is dropped, renamed or
-- retyped; every new column is nullable or carries a default, so existing rows
-- stay valid with no backfill. No historical migration is touched. There are
-- no foreign keys: a ReportAsset is evidence about a clinical release and must
-- outlive the operational rows it describes — the same reasoning that keeps
-- AuditLog.clinicId a plain scalar.
--
-- ── Before it is applied ───────────────────────────────────────────────────
-- The application boots and behaves correctly. lib/reports/assets/repository
-- catches undefined_table/undefined_column (42P01 / 42703) and reports the
-- surface as unprovisioned, so:
--   • approval still approves and still writes its snapshot,
--   • Share still sends the report LINK, with onePagerAttached:false,
--   • the doctor is told the one-pager is unavailable — truthfully.
-- Nothing 500s and no clinical path is blocked.
--
-- ── Rollback ───────────────────────────────────────────────────────────────
--   ALTER TABLE "WhatsappDelivery" DROP COLUMN "patientId", DROP COLUMN "channel",
--     DROP COLUMN "consultationVersionId", DROP COLUMN "reportAssetId",
--     DROP COLUMN "onePagerAttached", DROP COLUMN "assetSha256",
--     DROP COLUMN "assetTemplateVersion";
--   DROP TABLE "ReportAsset";
--   DROP TYPE "ReportAssetStatus";
--   DROP TYPE "ReportAssetType";
--
-- Dropping "ReportAsset" discards the record of which artefact a patient was
-- given. The stored objects survive in the private bucket, but the mapping
-- from delivery to bytes does not — export before rolling back anywhere that
-- has delivered a real report.

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ReportAssetType" AS ENUM (
    'ONE_PAGER_PNG',
    'ONE_PAGER_PDF',
    'PATIENT_REPORT_PDF',
    'DOCTOR_SUMMARY_PDF'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportAssetStatus" AS ENUM (
    'PENDING',
    'QUEUED',
    'RENDERING',
    'READY',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ReportAsset ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ReportAsset" (
  "id"                    TEXT NOT NULL,

  "clinicId"              TEXT NOT NULL,
  "patientId"             TEXT,
  "assessmentId"          TEXT NOT NULL,

  "consultationId"        TEXT NOT NULL,
  "consultationVersionId" TEXT NOT NULL,
  "contentVersion"        INTEGER NOT NULL,

  "type"                  "ReportAssetType" NOT NULL,
  "status"                "ReportAssetStatus" NOT NULL DEFAULT 'PENDING',

  "templateVersion"       TEXT NOT NULL,
  "rendererVersion"       TEXT NOT NULL,

  "storageBucket"         TEXT,
  "storagePath"           TEXT,
  "mimeType"              TEXT,
  "byteSize"              INTEGER,
  "sha256"                TEXT,

  "attemptCount"          INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"         TIMESTAMP(3),
  "nextAttemptAt"         TIMESTAMP(3),
  "generatedAt"           TIMESTAMP(3),

  "leaseId"               TEXT,
  "leaseExpiresAt"        TIMESTAMP(3),

  "errorCode"             TEXT,
  "lastError"             TEXT,

  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportAsset_pkey" PRIMARY KEY ("id")
);

-- The render key. This is the whole idempotency guarantee: two requests that
-- mean the same artefact cannot become two rows, and a concurrent second
-- claimer loses at the database rather than at an application-side race check.
CREATE UNIQUE INDEX IF NOT EXISTS "ReportAsset_render_key"
  ON "ReportAsset" ("consultationVersionId", "type", "templateVersion", "rendererVersion");

-- The queue scan: claimable work, oldest first.
CREATE INDEX IF NOT EXISTS "ReportAsset_status_nextAttemptAt_idx"
  ON "ReportAsset" ("status", "nextAttemptAt");

-- Operational reads: per-clinic health, per-assessment lookup, oldest pending.
CREATE INDEX IF NOT EXISTS "ReportAsset_clinicId_status_idx"
  ON "ReportAsset" ("clinicId", "status");
CREATE INDEX IF NOT EXISTS "ReportAsset_assessmentId_type_idx"
  ON "ReportAsset" ("assessmentId", "type");
CREATE INDEX IF NOT EXISTS "ReportAsset_status_createdAt_idx"
  ON "ReportAsset" ("status", "createdAt");

-- ── Delivery provenance ────────────────────────────────────────────────────

ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "patientId"             TEXT;
ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "channel"               TEXT;
ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "consultationVersionId" TEXT;
ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "reportAssetId"         TEXT;
ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "onePagerAttached"      BOOLEAN;
ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "assetSha256"           TEXT;
ALTER TABLE "WhatsappDelivery" ADD COLUMN IF NOT EXISTS "assetTemplateVersion"  TEXT;

CREATE INDEX IF NOT EXISTS "WhatsappDelivery_consultationVersionId_idx"
  ON "WhatsappDelivery" ("consultationVersionId");
