-- Hair-only knowledge scope and claim governance. This migration creates no
-- published rows and does not alter any deterministic clinical rule.

ALTER TABLE "KnowledgeDocument" ADD COLUMN "domain" TEXT NOT NULL DEFAULT 'HAIR';
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "KnowledgeDocumentVersion" ADD COLUMN "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "KnowledgeChunk" ADD COLUMN "topic" TEXT NOT NULL DEFAULT 'GENERAL';

UPDATE "KnowledgeChunk"
SET "topic" = "domain", "domain" = 'HAIR'
WHERE "domain" LIKE 'HAIR_%' OR "domain" IN ('TOPICAL','INGREDIENT','LIFESTYLE','SAFETY','SCALP_CONDITION');

ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_domain_check" CHECK ("domain" IN ('HAIR','SKIN','ORTHO','AYURVEDA'));
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_source_status_check" CHECK ("sourceStatus" IN ('ACTIVE','SUPERSEDED','RETIRED'));
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_source_status_check" CHECK ("sourceStatus" IN ('ACTIVE','SUPERSEDED','RETIRED'));
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_domain_check" CHECK ("domain" IN ('HAIR','SKIN','ORTHO','AYURVEDA'));

CREATE TABLE "KnowledgeSourceFile" (
  "id" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "logicalDocumentKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "documentType" TEXT NOT NULL,
  "domain" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL, "supersedesSourceId" TEXT, "extractionMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeSourceFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KnowledgeSourceFile_domain_check" CHECK ("domain" IN ('HAIR','SKIN','ORTHO','AYURVEDA')),
  CONSTRAINT "KnowledgeSourceFile_source_status_check" CHECK ("sourceStatus" IN ('ACTIVE','SUPERSEDED','RETIRED')),
  CONSTRAINT "KnowledgeSourceFile_source_type_check" CHECK ("sourceType" IN ('PRODUCT_MASTER','SAFETY_MASTER','CLINICAL_PROTOCOL','SCIENTIFIC_EVIDENCE','PATIENT_EDUCATION','PRODUCT_BROCHURE','COMMERCIAL_PRICE_SOURCE','INTERNAL_DRAFT'))
);
CREATE UNIQUE INDEX "KnowledgeSourceFile_fingerprint_key" ON "KnowledgeSourceFile"("fingerprint");
CREATE UNIQUE INDEX "KnowledgeSourceFile_logical_version_key" ON "KnowledgeSourceFile"("logicalDocumentKey","version");
CREATE INDEX "KnowledgeSourceFile_domain_status_type_idx" ON "KnowledgeSourceFile"("domain","sourceStatus","sourceType");
ALTER TABLE "KnowledgeSourceFile" ADD CONSTRAINT "KnowledgeSourceFile_supersedes_fkey" FOREIGN KEY ("supersedesSourceId") REFERENCES "KnowledgeSourceFile"("id") ON DELETE SET NULL;

CREATE TABLE "KnowledgeIngestionStage" (
  "id" TEXT NOT NULL, "sourceFileId" TEXT NOT NULL, "stage" TEXT NOT NULL, "inputHash" TEXT NOT NULL,
  "outputHash" TEXT, "status" TEXT NOT NULL, "details" JSONB, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeIngestionStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KnowledgeIngestionStage_source_stage_input_key" ON "KnowledgeIngestionStage"("sourceFileId","stage","inputHash");
CREATE INDEX "KnowledgeIngestionStage_source_status_idx" ON "KnowledgeIngestionStage"("sourceFileId","status");
ALTER TABLE "KnowledgeIngestionStage" ADD CONSTRAINT "KnowledgeIngestionStage_source_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "KnowledgeSourceFile"("id") ON DELETE CASCADE;

CREATE TABLE "KnowledgeClaim" (
  "id" TEXT NOT NULL, "claimId" TEXT NOT NULL, "chunkId" TEXT NOT NULL, "documentVersionId" TEXT NOT NULL,
  "domain" TEXT NOT NULL, "subject" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT,
  "claimType" TEXT NOT NULL, "statement" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
  "authorityScore" INTEGER NOT NULL, "evidenceStatus" TEXT NOT NULL,
  "approvalStatus" "KnowledgePublicationStatus" NOT NULL DEFAULT 'DRAFT', "audience" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3), "effectiveUntil" TIMESTAMP(3), "contradictionGroup" TEXT,
  "supersededByClaimId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KnowledgeClaim_domain_check" CHECK ("domain" IN ('HAIR','SKIN','ORTHO','AYURVEDA')),
  CONSTRAINT "KnowledgeClaim_effective_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  CONSTRAINT "KnowledgeClaim_authority_check" CHECK ("authorityScore" BETWEEN 0 AND 100),
  CONSTRAINT "KnowledgeClaim_source_type_check" CHECK ("sourceType" IN ('PRODUCT_MASTER','SAFETY_MASTER','CLINICAL_PROTOCOL','SCIENTIFIC_EVIDENCE','PATIENT_EDUCATION','PRODUCT_BROCHURE','COMMERCIAL_PRICE_SOURCE','INTERNAL_DRAFT')),
  CONSTRAINT "KnowledgeClaim_claim_type_check" CHECK ("claimType" IN ('MEDICAL_MECHANISM','EXPECTED_OUTCOME','USAGE','SAFETY_WORDING','PRODUCT_COMPOSITION','COMMERCIAL_PRICE','GENERAL_EDUCATION')),
  CONSTRAINT "KnowledgeClaim_evidence_check" CHECK ("evidenceStatus" IN ('UNASSESSED','SUPPORTED','LIMITED','CONFLICTING','REJECTED')),
  CONSTRAINT "KnowledgeClaim_audience_check" CHECK ("audience" IN ('INTERNAL','DOCTOR','PATIENT','DOCTOR_AND_PATIENT'))
);
CREATE UNIQUE INDEX "KnowledgeClaim_claimId_key" ON "KnowledgeClaim"("claimId");
CREATE INDEX "KnowledgeClaim_domain_publication_idx" ON "KnowledgeClaim"("domain","approvalStatus","audience","effectiveFrom");
CREATE INDEX "KnowledgeClaim_subject_type_idx" ON "KnowledgeClaim"("subjectType","subjectId","claimType");
CREATE INDEX "KnowledgeClaim_contradiction_idx" ON "KnowledgeClaim"("contradictionGroup");
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_chunk_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE;
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_version_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE CASCADE;
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_superseded_fkey" FOREIGN KEY ("supersededByClaimId") REFERENCES "KnowledgeClaim"("claimId") ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.enforce_hair_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" IN ('PUBLISHED_INTERNAL','PUBLISHED_PATIENT') AND (NEW."domain" <> 'HAIR' OR NEW."sourceStatus" <> 'ACTIVE') THEN
    RAISE EXCEPTION 'Only active HAIR documents may be published in the current phase';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "KnowledgeDocument_hair_publication_guard" BEFORE INSERT OR UPDATE ON "KnowledgeDocument" FOR EACH ROW EXECUTE FUNCTION public.enforce_hair_publication();

CREATE OR REPLACE FUNCTION public.enforce_hair_claim_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."approvalStatus" IN ('PUBLISHED_INTERNAL','PUBLISHED_PATIENT') AND NEW."domain" <> 'HAIR' THEN
    RAISE EXCEPTION 'Only HAIR claims may be published in the current phase';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "KnowledgeClaim_hair_publication_guard" BEFORE INSERT OR UPDATE ON "KnowledgeClaim" FOR EACH ROW EXECUTE FUNCTION public.enforce_hair_claim_publication();

CREATE OR REPLACE FUNCTION public.enforce_hair_version_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_domain TEXT; parent_status TEXT;
BEGIN
  IF NEW."status" IN ('PUBLISHED_INTERNAL','PUBLISHED_PATIENT') THEN
    SELECT "domain", "sourceStatus" INTO parent_domain, parent_status FROM "KnowledgeDocument" WHERE "id"=NEW."documentId";
    IF parent_domain <> 'HAIR' OR parent_status <> 'ACTIVE' OR NEW."sourceStatus" <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Only active HAIR document versions may be published in the current phase';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "KnowledgeDocumentVersion_hair_publication_guard" BEFORE INSERT OR UPDATE ON "KnowledgeDocumentVersion" FOR EACH ROW EXECUTE FUNCTION public.enforce_hair_version_publication();

CREATE OR REPLACE FUNCTION public.enforce_hair_chunk_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."approvalStatus" IN ('PUBLISHED_INTERNAL','PUBLISHED_PATIENT') AND NEW."domain" <> 'HAIR' THEN
    RAISE EXCEPTION 'Only HAIR chunks may be published in the current phase';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "KnowledgeChunk_hair_publication_guard" BEFORE INSERT OR UPDATE ON "KnowledgeChunk" FOR EACH ROW EXECUTE FUNCTION public.enforce_hair_chunk_publication();
CREATE INDEX "KnowledgeChunk_hair_public_filters_idx" ON "KnowledgeChunk"("topic","language","knowledgeSystem","authorityScore" DESC,"effectiveFrom","effectiveUntil") WHERE "clinicId" IS NULL AND "domain"='HAIR' AND "approvalStatus"='PUBLISHED_PATIENT';

ALTER TABLE "KnowledgeSourceFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeIngestionStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeClaim" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KnowledgeSourceFile_internal_select" ON "KnowledgeSourceFile" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF'));
CREATE POLICY "KnowledgeSourceFile_admin_write" ON "KnowledgeSourceFile" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "KnowledgeIngestionStage_internal_select" ON "KnowledgeIngestionStage" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF'));
CREATE POLICY "KnowledgeIngestionStage_admin_write" ON "KnowledgeIngestionStage" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "KnowledgeClaim_internal_select" ON "KnowledgeClaim" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF'));
ALTER POLICY "KnowledgeChunk_patient_published" ON "KnowledgeChunk" USING (public.jwt_user_role()='PATIENT' AND "domain"='HAIR' AND "approvalStatus"='PUBLISHED_PATIENT' AND ("clinicId" IS NULL OR public.jwt_clinic_id()="clinicId") AND ("effectiveFrom" IS NULL OR "effectiveFrom"<=CURRENT_TIMESTAMP) AND ("effectiveUntil" IS NULL OR "effectiveUntil">CURRENT_TIMESTAMP) AND EXISTS (SELECT 1 FROM "KnowledgeDocumentVersion" v JOIN "KnowledgeDocument" d ON d."id"=v."documentId" WHERE v."id"="KnowledgeChunk"."documentVersionId" AND v."status"='PUBLISHED_PATIENT' AND v."sourceStatus"='ACTIVE' AND d."status"='PUBLISHED_PATIENT' AND d."domain"='HAIR' AND d."sourceStatus"='ACTIVE'));
CREATE POLICY "KnowledgeClaim_patient_published" ON "KnowledgeClaim" FOR SELECT TO authenticated USING (public.jwt_user_role()='PATIENT' AND "domain"='HAIR' AND "approvalStatus"='PUBLISHED_PATIENT' AND "audience" IN ('PATIENT','DOCTOR_AND_PATIENT') AND ("effectiveFrom" IS NULL OR "effectiveFrom"<=CURRENT_TIMESTAMP) AND ("effectiveUntil" IS NULL OR "effectiveUntil">CURRENT_TIMESTAMP) AND EXISTS (SELECT 1 FROM "KnowledgeChunk" kc JOIN "KnowledgeDocumentVersion" v ON v."id"=kc."documentVersionId" JOIN "KnowledgeDocument" d ON d."id"=v."documentId" WHERE kc."id"="KnowledgeClaim"."chunkId" AND kc."domain"='HAIR' AND kc."approvalStatus"='PUBLISHED_PATIENT' AND v."status"='PUBLISHED_PATIENT' AND v."sourceStatus"='ACTIVE' AND d."status"='PUBLISHED_PATIENT' AND d."domain"='HAIR' AND d."sourceStatus"='ACTIVE'));
CREATE POLICY "KnowledgeClaim_admin_write" ON "KnowledgeClaim" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
GRANT SELECT ON "KnowledgeSourceFile", "KnowledgeIngestionStage", "KnowledgeClaim" TO authenticated;
GRANT ALL ON "KnowledgeSourceFile", "KnowledgeIngestionStage", "KnowledgeClaim" TO service_role;
