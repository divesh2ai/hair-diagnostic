-- Stage 1 governed assistant prerequisites
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge publication is a governed lifecycle. Importers may stage review
-- records, but publication is a separate approval action.
CREATE TYPE "KnowledgePublicationStatus" AS ENUM (
    'DRAFT',
    'MEDICAL_REVIEW',
    'MEDICAL_APPROVED',
    'COMMERCIAL_APPROVED',
    'PUBLISHED_INTERNAL',
    'PUBLISHED_PATIENT',
    'RETIRED'
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "clinicId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clinicId" TEXT,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPriceVersion" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "clinicId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mrp" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIngredient" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4),
    "unit" TEXT,
    "formulationText" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kit" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "family" TEXT,
    "clinicId" TEXT,
    "status" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitAlias" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "clinicId" TEXT,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitVersion" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitProduct" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kitVersionId" TEXT NOT NULL,
    "componentOrder" INTEGER NOT NULL,
    "sourceRow" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitPrice" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "clinicId" TEXT,
    "version" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "mrp" DECIMAL(12,2) NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceSheet" TEXT,
    "sourceRows" TEXT,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitSchedule" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "kitVersionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "componentOrder" INTEGER NOT NULL,
    "scheduleText" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "clinicId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "authorityScore" INTEGER NOT NULL,
    "status" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "status" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "clinicId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "domain" TEXT NOT NULL,
    "knowledgeSystem" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sectionType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "approvalStatus" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "authorityScore" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "embedding" vector,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeApproval" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "chunkId" TEXT,
    "approvalType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeConflict" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "clinicId" TEXT,
    "entity" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "owner" TEXT,
    "requiredAction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "sourceFile" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "configVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "counts" JSONB,
    "errors" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantThread" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "action" TEXT,
    "language" TEXT NOT NULL,
    "graphPath" TEXT[],
    "authorities" TEXT[],
    "supportedClaims" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantToolCall" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "redactedOutput" JSONB,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantCitation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "claimIndex" INTEGER NOT NULL,
    "claimText" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceField" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "sourceVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantSafetyEvent" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "flags" TEXT[],
    "action" TEXT NOT NULL,
    "redactedSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantSafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantFeedback" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "messageId" TEXT,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "helpful" BOOLEAN,
    "category" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantEscalation" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "messageId" TEXT,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "assignedDoctorId" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdverseEvent" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "assessmentId" TEXT,
    "productIds" TEXT[],
    "symptoms" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdverseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_canonicalId_key" ON "Product"("canonicalId");

-- CreateIndex
CREATE INDEX "Product_clinicId_status_idx" ON "Product"("clinicId", "status");

-- CreateIndex
CREATE INDEX "ProductAlias_clinicId_normalizedAlias_idx" ON "ProductAlias"("clinicId", "normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAlias_productId_normalizedAlias_key" ON "ProductAlias"("productId", "normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPriceVersion_clinicId_checksum_key" ON "ProductPriceVersion"("clinicId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_productId_versionId_clinicId_key" ON "ProductPrice"("productId", "versionId", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_canonicalId_key" ON "Ingredient"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_normalizedName_key" ON "Ingredient"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIngredient_productId_ingredientId_sourceId_key" ON "ProductIngredient"("productId", "ingredientId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Kit_canonicalId_key" ON "Kit"("canonicalId");

-- CreateIndex
CREATE INDEX "Kit_clinicId_status_idx" ON "Kit"("clinicId", "status");

-- CreateIndex
CREATE INDEX "KitAlias_clinicId_normalizedAlias_idx" ON "KitAlias"("clinicId", "normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "KitAlias_kitId_normalizedAlias_key" ON "KitAlias"("kitId", "normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "KitVersion_kitId_version_key" ON "KitVersion"("kitId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KitVersion_kitId_checksum_key" ON "KitVersion"("kitId", "checksum");

-- CreateIndex
CREATE INDEX "KitProduct_kitId_kitVersionId_idx" ON "KitProduct"("kitId", "kitVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "KitProduct_kitVersionId_componentOrder_key" ON "KitProduct"("kitVersionId", "componentOrder");

-- CreateIndex
CREATE INDEX "KitPrice_clinicId_kitId_status_effectiveFrom_idx" ON "KitPrice"("clinicId", "kitId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "KitPrice_kitId_clinicId_version_key" ON "KitPrice"("kitId", "clinicId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KitSchedule_kitVersionId_componentOrder_key" ON "KitSchedule"("kitVersionId", "componentOrder");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_sourceId_key" ON "KnowledgeDocument"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentVersion_documentId_version_key" ON "KnowledgeDocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentVersion_documentId_checksum_key" ON "KnowledgeDocumentVersion"("documentId", "checksum");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_clinicId_approvalStatus_language_domain_idx" ON "KnowledgeChunk"("clinicId", "approvalStatus", "language", "domain");

-- CreateIndex
CREATE INDEX "KnowledgeConflict_clinicId_status_severity_idx" ON "KnowledgeConflict"("clinicId", "status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionRun_clinicId_checksum_configVersion_key" ON "IngestionRun"("clinicId", "checksum", "configVersion");

-- CreateIndex
CREATE INDEX "AssistantThread_clinicId_createdBy_updatedAt_idx" ON "AssistantThread"("clinicId", "createdBy", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantCitation_messageId_claimIndex_idx" ON "AssistantCitation"("messageId", "claimIndex");

-- CreateIndex
CREATE INDEX "AssistantEscalation_clinicId_status_priority_createdAt_idx" ON "AssistantEscalation"("clinicId", "status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AdverseEvent_clinicId_status_createdAt_idx" ON "AdverseEvent"("clinicId", "status", "createdAt");

-- Stage 1 relational integrity
ALTER TABLE "ProductAlias" ADD CONSTRAINT "ProductAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProductPriceVersion"("id") ON DELETE RESTRICT;
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT;
ALTER TABLE "KitAlias" ADD CONSTRAINT "KitAlias_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE;
ALTER TABLE "KitVersion" ADD CONSTRAINT "KitVersion_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE;
ALTER TABLE "KitProduct" ADD CONSTRAINT "KitProduct_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE;
ALTER TABLE "KitProduct" ADD CONSTRAINT "KitProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "KitProduct" ADD CONSTRAINT "KitProduct_kitVersionId_fkey" FOREIGN KEY ("kitVersionId") REFERENCES "KitVersion"("id") ON DELETE CASCADE;
ALTER TABLE "KitPrice" ADD CONSTRAINT "KitPrice_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE;
ALTER TABLE "KitSchedule" ADD CONSTRAINT "KitSchedule_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE CASCADE;
ALTER TABLE "KitSchedule" ADD CONSTRAINT "KitSchedule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT;
ALTER TABLE "KitSchedule" ADD CONSTRAINT "KitSchedule_kitVersionId_fkey" FOREIGN KEY ("kitVersionId") REFERENCES "KitVersion"("id") ON DELETE CASCADE;
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE CASCADE;
ALTER TABLE "KnowledgeApproval" ADD CONSTRAINT "KnowledgeApproval_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE CASCADE;
ALTER TABLE "KnowledgeApproval" ADD CONSTRAINT "KnowledgeApproval_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL;
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL;
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantToolCall" ADD CONSTRAINT "AssistantToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantCitation" ADD CONSTRAINT "AssistantCitation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantSafetyEvent" ADD CONSTRAINT "AssistantSafetyEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE;
ALTER TABLE "AssistantEscalation" ADD CONSTRAINT "AssistantEscalation_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE SET NULL;
ALTER TABLE "AdverseEvent" ADD CONSTRAINT "AdverseEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE SET NULL;

-- Hybrid retrieval indexes. Structured catalogue fields remain the source of truth.
CREATE INDEX "KnowledgeChunk_content_fts_idx" ON "KnowledgeChunk" USING GIN (to_tsvector('english', "content"));

-- Security integrity constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_effective_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "KitPrice" ADD CONSTRAINT "KitPrice_effective_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_effective_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_effective_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_mrp_positive_check" CHECK ("mrp" > 0);
ALTER TABLE "KitPrice" ADD CONSTRAINT "KitPrice_mrp_positive_check" CHECK ("mrp" > 0);

CREATE UNIQUE INDEX "ProductPriceVersion_scope_checksum_key" ON "ProductPriceVersion" (COALESCE("clinicId", ''), "checksum");
CREATE UNIQUE INDEX "ProductPrice_scope_version_key" ON "ProductPrice" ("productId", "versionId", COALESCE("clinicId", ''));
CREATE UNIQUE INDEX "KitPrice_scope_version_key" ON "KitPrice" ("kitId", COALESCE("clinicId", ''), "version");
CREATE UNIQUE INDEX "IngestionRun_scope_checksum_config_key" ON "IngestionRun" (COALESCE("clinicId", ''), "checksum", "configVersion");

ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_no_overlapping_active_ranges" EXCLUDE USING gist (
  "productId" WITH =,
  (COALESCE("clinicId", '')) WITH =,
  "currency" WITH =,
  (tsrange(COALESCE("effectiveFrom", '-infinity'::timestamp), COALESCE("effectiveUntil", 'infinity'::timestamp), '[)')) WITH &&
) WHERE ("status" IN ('PROVISIONAL', 'PUBLISHED'));
ALTER TABLE "KitPrice" ADD CONSTRAINT "KitPrice_no_overlapping_active_ranges" EXCLUDE USING gist (
  "kitId" WITH =,
  (COALESCE("clinicId", '')) WITH =,
  "currency" WITH =,
  (tsrange(COALESCE("effectiveFrom", '-infinity'::timestamp), COALESCE("effectiveUntil", 'infinity'::timestamp), '[)')) WITH &&
) WHERE ("status" IN ('PROVISIONAL', 'PUBLISHED'));

CREATE UNIQUE INDEX "Patient_id_clinicId_stage1_key" ON "Patient"("id", "clinicId");
CREATE UNIQUE INDEX "Assessment_id_clinicId_stage1_key" ON "Assessment"("id", "clinicId");
CREATE UNIQUE INDEX "AssistantThread_id_clinicId_key" ON "AssistantThread"("id", "clinicId");
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_patient_scope_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "Patient"("id", "clinicId") ON DELETE SET NULL ("patientId");
ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_assessment_scope_fkey" FOREIGN KEY ("assessmentId", "clinicId") REFERENCES "Assessment"("id", "clinicId") ON DELETE SET NULL ("assessmentId");
ALTER TABLE "AssistantSafetyEvent" ADD CONSTRAINT "AssistantSafetyEvent_thread_scope_fkey" FOREIGN KEY ("threadId", "clinicId") REFERENCES "AssistantThread"("id", "clinicId") ON DELETE CASCADE;
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_thread_scope_fkey" FOREIGN KEY ("threadId", "clinicId") REFERENCES "AssistantThread"("id", "clinicId") ON DELETE CASCADE;
ALTER TABLE "AssistantEscalation" ADD CONSTRAINT "AssistantEscalation_thread_scope_fkey" FOREIGN KEY ("threadId", "clinicId") REFERENCES "AssistantThread"("id", "clinicId") ON DELETE SET NULL ("threadId");
ALTER TABLE "AdverseEvent" ADD CONSTRAINT "AdverseEvent_thread_scope_fkey" FOREIGN KEY ("threadId", "clinicId") REFERENCES "AssistantThread"("id", "clinicId") ON DELETE SET NULL ("threadId");
ALTER TABLE "AssistantSafetyEvent" ADD CONSTRAINT "AssistantSafetyEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE SET NULL;
ALTER TABLE "AssistantFeedback" ADD CONSTRAINT "AssistantFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE SET NULL;
ALTER TABLE "AssistantEscalation" ADD CONSTRAINT "AssistantEscalation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE SET NULL;
ALTER TABLE "AssistantSafetyEvent" ADD CONSTRAINT "AssistantSafetyEvent_patient_scope_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "Patient"("id", "clinicId") ON DELETE SET NULL ("patientId");
ALTER TABLE "AssistantSafetyEvent" ADD CONSTRAINT "AssistantSafetyEvent_assessment_scope_fkey" FOREIGN KEY ("assessmentId", "clinicId") REFERENCES "Assessment"("id", "clinicId") ON DELETE SET NULL ("assessmentId");
ALTER TABLE "AssistantEscalation" ADD CONSTRAINT "AssistantEscalation_patient_scope_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "Patient"("id", "clinicId") ON DELETE SET NULL ("patientId");
ALTER TABLE "AssistantEscalation" ADD CONSTRAINT "AssistantEscalation_assessment_scope_fkey" FOREIGN KEY ("assessmentId", "clinicId") REFERENCES "Assessment"("id", "clinicId") ON DELETE SET NULL ("assessmentId");
ALTER TABLE "AdverseEvent" ADD CONSTRAINT "AdverseEvent_patient_scope_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "Patient"("id", "clinicId") ON DELETE SET NULL ("patientId");
ALTER TABLE "AdverseEvent" ADD CONSTRAINT "AdverseEvent_assessment_scope_fkey" FOREIGN KEY ("assessmentId", "clinicId") REFERENCES "Assessment"("id", "clinicId") ON DELETE SET NULL ("assessmentId");

CREATE OR REPLACE FUNCTION public.stage1_validate_thread_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE assessment_patient text;
BEGIN
  IF NEW."assessmentId" IS NOT NULL THEN
    SELECT "patientId" INTO assessment_patient FROM "Assessment" WHERE "id" = NEW."assessmentId" AND "clinicId" = NEW."clinicId";
    IF assessment_patient IS NULL THEN RAISE EXCEPTION 'assessment is outside assistant thread clinic'; END IF;
    IF NEW."patientId" IS NOT NULL AND NEW."patientId" <> assessment_patient THEN RAISE EXCEPTION 'assistant thread patient does not own assessment'; END IF;
    NEW."patientId" := COALESCE(NEW."patientId", assessment_patient);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "AssistantThread_scope_guard" BEFORE INSERT OR UPDATE OF "clinicId", "patientId", "assessmentId" ON "AssistantThread" FOR EACH ROW EXECUTE FUNCTION public.stage1_validate_thread_scope();

-- Tenant isolation. service_role bypasses RLS and is restricted to server-side code.
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductPriceVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ingredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Kit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeDocumentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeConflict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IngestionRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantToolCall" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantCitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantSafetyEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantEscalation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdverseEvent" ENABLE ROW LEVEL SECURITY;

-- Catalogue: authenticated reads, tightly controlled writes, no client deletes.
CREATE POLICY "Product_select" ON "Product" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR "clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"));
CREATE POLICY "Product_insert" ON "Product" FOR INSERT TO authenticated WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "Product_update" ON "Product" FOR UPDATE TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "Product_delete" ON "Product" FOR DELETE TO authenticated USING (public.jwt_is_super_admin());
CREATE POLICY "ProductAlias_select" ON "ProductAlias" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "ProductAlias"."productId"));
CREATE POLICY "ProductAlias_insert" ON "ProductAlias" FOR INSERT TO authenticated WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "ProductAlias_update" ON "ProductAlias" FOR UPDATE TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "ProductPriceVersion_select" ON "ProductPriceVersion" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR "clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"));
CREATE POLICY "ProductPriceVersion_write" ON "ProductPriceVersion" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "ProductPrice_select" ON "ProductPrice" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR "clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"));
CREATE POLICY "ProductPrice_write" ON "ProductPrice" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "Ingredient_select" ON "Ingredient" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ingredient_write" ON "Ingredient" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "ProductIngredient_select" ON "ProductIngredient" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = "ProductIngredient"."productId"));
CREATE POLICY "ProductIngredient_write" ON "ProductIngredient" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "Kit_select" ON "Kit" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR "clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"));
CREATE POLICY "Kit_write" ON "Kit" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KitAlias_select" ON "KitAlias" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitAlias"."kitId"));
CREATE POLICY "KitAlias_write" ON "KitAlias" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KitVersion_select" ON "KitVersion" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitVersion"."kitId"));
CREATE POLICY "KitVersion_write" ON "KitVersion" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitVersion"."kitId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(k."clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitVersion"."kitId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(k."clinicId")));
CREATE POLICY "KitProduct_select" ON "KitProduct" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitProduct"."kitId"));
CREATE POLICY "KitProduct_write" ON "KitProduct" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitProduct"."kitId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(k."clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitProduct"."kitId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(k."clinicId")));
CREATE POLICY "KitPrice_select" ON "KitPrice" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR "clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"));
CREATE POLICY "KitPrice_write" ON "KitPrice" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KitSchedule_select" ON "KitSchedule" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitSchedule"."kitId"));
CREATE POLICY "KitSchedule_write" ON "KitSchedule" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitSchedule"."kitId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(k."clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "Kit" k WHERE k."id" = "KitSchedule"."kitId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(k."clinicId")));

-- Knowledge: internal review access only here; patient publication filter is tightened by the status workflow below.
CREATE POLICY "KnowledgeDocument_internal" ON "KnowledgeDocument" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF') AND ("clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"))));
CREATE POLICY "KnowledgeDocument_write" ON "KnowledgeDocument" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KnowledgeDocumentVersion_internal" ON "KnowledgeDocumentVersion" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "KnowledgeDocument" d WHERE d."id" = "KnowledgeDocumentVersion"."documentId"));
CREATE POLICY "KnowledgeDocumentVersion_write" ON "KnowledgeDocumentVersion" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "KnowledgeDocument" d WHERE d."id" = "KnowledgeDocumentVersion"."documentId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(d."clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR EXISTS (SELECT 1 FROM "KnowledgeDocument" d WHERE d."id" = "KnowledgeDocumentVersion"."documentId" AND public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member(d."clinicId")));
CREATE POLICY "KnowledgeChunk_internal" ON "KnowledgeChunk" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF') AND ("clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"))));
CREATE POLICY "KnowledgeChunk_patient_published" ON "KnowledgeChunk" FOR SELECT TO authenticated USING (public.jwt_user_role() = 'PATIENT' AND "approvalStatus" = 'PUBLISHED_PATIENT' AND ("clinicId" IS NULL OR public.jwt_clinic_id() = "clinicId") AND ("effectiveFrom" IS NULL OR "effectiveFrom" <= CURRENT_TIMESTAMP) AND ("effectiveUntil" IS NULL OR "effectiveUntil" > CURRENT_TIMESTAMP));
CREATE POLICY "KnowledgeChunk_write" ON "KnowledgeChunk" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KnowledgeApproval_internal" ON "KnowledgeApproval" FOR SELECT TO authenticated USING (public.jwt_user_role() IN ('SUPER_ADMIN','DOCTOR','CLINIC_ADMIN') AND EXISTS (SELECT 1 FROM "KnowledgeDocumentVersion" v WHERE v."id" = "KnowledgeApproval"."documentVersionId"));
CREATE POLICY "KnowledgeApproval_write" ON "KnowledgeApproval" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "KnowledgeConflict_internal" ON "KnowledgeConflict" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "KnowledgeConflict_write" ON "KnowledgeConflict" FOR ALL TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() = 'CLINIC_ADMIN' AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "IngestionRun_internal" ON "IngestionRun" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "IngestionRun_write" ON "IngestionRun" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());

-- Conversation ownership. Server/service role is the only writer of immutable traces.
CREATE POLICY "AssistantThread_select" ON "AssistantThread" FOR SELECT TO authenticated USING ((public.jwt_clinic_id() = "clinicId" AND "createdBy" = auth.uid()::text) OR public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "AssistantThread_insert" ON "AssistantThread" FOR INSERT TO authenticated WITH CHECK (public.jwt_clinic_id() = "clinicId" AND "createdBy" = auth.uid()::text AND "role"::text = public.jwt_user_role());
CREATE POLICY "AssistantThread_update" ON "AssistantThread" FOR UPDATE TO authenticated USING (public.jwt_clinic_id() = "clinicId" AND "createdBy" = auth.uid()::text) WITH CHECK (public.jwt_clinic_id() = "clinicId" AND "createdBy" = auth.uid()::text);
CREATE POLICY "AssistantMessage_select" ON "AssistantMessage" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "AssistantThread" t WHERE t."id" = "AssistantMessage"."threadId" AND ((t."createdBy" = auth.uid()::text AND public.jwt_clinic_id() = t."clinicId") OR public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member(t."clinicId")))));
CREATE POLICY "AssistantToolCall_select" ON "AssistantToolCall" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "AssistantMessage" m JOIN "AssistantThread" t ON t."id" = m."threadId" WHERE m."id" = "AssistantToolCall"."messageId" AND ((t."createdBy" = auth.uid()::text AND public.jwt_clinic_id() = t."clinicId") OR public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member(t."clinicId")))));
CREATE POLICY "AssistantCitation_select" ON "AssistantCitation" FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM "AssistantMessage" m JOIN "AssistantThread" t ON t."id" = m."threadId" WHERE m."id" = "AssistantCitation"."messageId" AND ((t."createdBy" = auth.uid()::text AND public.jwt_clinic_id() = t."clinicId") OR public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member(t."clinicId")))));
CREATE POLICY "AssistantSafetyEvent_internal" ON "AssistantSafetyEvent" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "AssistantFeedback_select" ON "AssistantFeedback" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_clinic_id() = "clinicId" AND "userId" = auth.uid()::text));
CREATE POLICY "AssistantFeedback_insert" ON "AssistantFeedback" FOR INSERT TO authenticated WITH CHECK (public.jwt_clinic_id() = "clinicId" AND "userId" = auth.uid()::text AND EXISTS (SELECT 1 FROM "AssistantThread" t WHERE t."id" = "AssistantFeedback"."threadId" AND t."createdBy" = auth.uid()::text AND t."clinicId" = "AssistantFeedback"."clinicId"));
CREATE POLICY "AssistantEscalation_internal" ON "AssistantEscalation" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "AssistantEscalation_update" ON "AssistantEscalation" FOR UPDATE TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "AdverseEvent_internal" ON "AdverseEvent" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));
CREATE POLICY "AdverseEvent_update" ON "AdverseEvent" FOR UPDATE TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId"))) WITH CHECK (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN') AND public.jwt_is_clinic_member("clinicId")));

GRANT SELECT ON "Product", "ProductAlias", "ProductPriceVersion", "ProductPrice", "Ingredient", "ProductIngredient", "Kit", "KitAlias", "KitVersion", "KitProduct", "KitPrice", "KitSchedule" TO authenticated;
GRANT SELECT ON "KnowledgeDocument", "KnowledgeDocumentVersion", "KnowledgeChunk", "KnowledgeApproval", "KnowledgeConflict", "IngestionRun" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON "AssistantThread" TO authenticated;
GRANT SELECT ON "AssistantMessage", "AssistantToolCall", "AssistantCitation", "AssistantSafetyEvent", "AssistantEscalation", "AdverseEvent" TO authenticated;
GRANT SELECT, INSERT ON "AssistantFeedback" TO authenticated;
GRANT ALL ON "Product", "ProductAlias", "ProductPriceVersion", "ProductPrice", "Ingredient", "ProductIngredient", "Kit", "KitAlias", "KitVersion", "KitProduct", "KitPrice", "KitSchedule", "KnowledgeDocument", "KnowledgeDocumentVersion", "KnowledgeChunk", "KnowledgeApproval", "KnowledgeConflict", "IngestionRun", "AssistantThread", "AssistantMessage", "AssistantToolCall", "AssistantCitation", "AssistantSafetyEvent", "AssistantFeedback", "AssistantEscalation", "AdverseEvent" TO service_role;