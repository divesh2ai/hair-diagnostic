-- Five-kit real-data governance additions. This migration creates no rows and publishes nothing.

ALTER TABLE "ProductAlias" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "ProductAlias" ADD COLUMN "matchMethod" TEXT NOT NULL DEFAULT 'UNMATCHED';
ALTER TABLE "ProductAlias" ADD COLUMN "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductAlias" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "ProductAlias" ADD COLUMN "provenance" JSONB;
ALTER TABLE "KitAlias" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "KitAlias" ADD COLUMN "matchMethod" TEXT NOT NULL DEFAULT 'UNMATCHED';
ALTER TABLE "KitAlias" ADD COLUMN "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "KitAlias" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "KitAlias" ADD COLUMN "provenance" JSONB;

ALTER TABLE "ProductPrice" ADD COLUMN "provenance" JSONB;
ALTER TABLE "ProductPrice" ADD COLUMN "conflictStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "ProductIngredient" ADD COLUMN "route" TEXT;
ALTER TABLE "ProductIngredient" ADD COLUMN "provenance" JSONB;
ALTER TABLE "ProductIngredient" ADD COLUMN "conflictStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Kit" ADD COLUMN "medicalVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Kit" ADD COLUMN "commercialVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Kit" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Kit" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "KitProduct" ADD COLUMN "quantity" DECIMAL(12,4);
ALTER TABLE "KitProduct" ADD COLUMN "unit" TEXT;
ALTER TABLE "KitProduct" ADD COLUMN "provenance" JSONB;
ALTER TABLE "KitProduct" ADD COLUMN "conflictStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "KitPrice" ADD COLUMN "gstPercent" DECIMAL(7,4);
ALTER TABLE "KitPrice" ADD COLUMN "doctorPrice" DECIMAL(12,2);
ALTER TABLE "KitPrice" ADD COLUMN "provenance" JSONB;
ALTER TABLE "KitPrice" ADD COLUMN "conflictStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "KitSchedule" ADD COLUMN "prescriptionDays" INTEGER;
ALTER TABLE "KitSchedule" ADD COLUMN "provenance" JSONB;
ALTER TABLE "KitSchedule" ADD COLUMN "conflictStatus" TEXT NOT NULL DEFAULT 'NONE';

ALTER TABLE "KnowledgeConflict" ADD COLUMN "conflictType" TEXT NOT NULL DEFAULT 'UNSPECIFIED';
ALTER TABLE "KnowledgeConflict" ADD COLUMN "fieldOrClaim" TEXT;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "sourceA" JSONB;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "sourceB" JSONB;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "valueA" JSONB;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "valueB" JSONB;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "authorityA" INTEGER;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "authorityB" INTEGER;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "proposedCanonicalValue" JSONB;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "automaticResolutionAllowed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "KnowledgeConflict" ADD COLUMN "publicationBlocked" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "KnowledgeClaim" ADD COLUMN "patientVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KnowledgeClaim" ADD COLUMN "medicalReviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "KnowledgeClaim" ADD COLUMN "commercialReviewStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "KnowledgeClaim" ADD COLUMN "sourceLocation" JSONB;
ALTER TABLE "KnowledgeClaim" ADD COLUMN "supersessionStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "KnowledgeClaim" DROP CONSTRAINT IF EXISTS "KnowledgeClaim_claim_type_check";
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_claim_type_check" CHECK ("claimType" IN
  ('PRODUCT_PURPOSE','INDICATION','CONDITION_EDUCATION','THERAPEUTIC_OBJECTIVE','MECHANISM','INGREDIENT_MECHANISM','EXPECTED_RESPONSE','SAFETY','USAGE','COMMERCIAL_FACT','MARKETING_CLAIM','SCIENTIFIC_CLAIM'));

CREATE TABLE "ClaimEvidence" (
  "id" TEXT NOT NULL, "claimId" TEXT NOT NULL, "sourceFileId" TEXT,
  "evidenceType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'UNASSESSED',
  "sourceLocation" JSONB NOT NULL, "excerptHash" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClaimEvidence_claim_status_idx" ON "ClaimEvidence"("claimId","status");
CREATE INDEX "ClaimEvidence_source_idx" ON "ClaimEvidence"("sourceFileId");
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claim_fkey" FOREIGN KEY ("claimId") REFERENCES "KnowledgeClaim"("claimId") ON DELETE CASCADE;
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_source_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "KnowledgeSourceFile"("id") ON DELETE SET NULL;

CREATE TABLE "StructuredFactRecord" (
  "id" TEXT NOT NULL, "sourceFileId" TEXT NOT NULL, "clinicId" TEXT, "domain" TEXT NOT NULL DEFAULT 'HAIR',
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "field" TEXT NOT NULL,
  "rawValue" JSONB, "normalizedValue" JSONB, "provenance" JSONB NOT NULL,
  "formula" TEXT, "formulaResult" JSONB, "formulaError" TEXT,
  "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT', "conflictStatus" TEXT NOT NULL DEFAULT 'NONE',
  "requiresReview" BOOLEAN NOT NULL DEFAULT true, "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3), "effectiveUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StructuredFactRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StructuredFactRecord_domain_check" CHECK ("domain"='HAIR'),
  CONSTRAINT "StructuredFactRecord_window_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil">"effectiveFrom")
);
CREATE INDEX "StructuredFactRecord_entity_idx" ON "StructuredFactRecord"("entityType","entityId","field","approvalStatus");
CREATE INDEX "StructuredFactRecord_publication_idx" ON "StructuredFactRecord"("clinicId","publicationStatus");
ALTER TABLE "StructuredFactRecord" ADD CONSTRAINT "StructuredFactRecord_source_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "KnowledgeSourceFile"("id") ON DELETE CASCADE;

CREATE TABLE "KnowledgeReviewAction" (
  "id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "previousValue" JSONB, "newValue" JSONB,
  "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeReviewAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KnowledgeReviewAction_entity_idx" ON "KnowledgeReviewAction"("entityType","entityId","createdAt");
CREATE INDEX "KnowledgeReviewAction_actor_idx" ON "KnowledgeReviewAction"("actorId","createdAt");

CREATE OR REPLACE FUNCTION public.enforce_structured_fact_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."publicationStatus"='PUBLISHED' AND (
    NEW."approvalStatus"<>'APPROVED' OR NEW."conflictStatus"<>'NONE' OR
    NEW."formulaError" IS NOT NULL OR NEW."requiresReview" OR
    (NEW."effectiveFrom" IS NOT NULL AND NEW."effectiveFrom">CURRENT_TIMESTAMP) OR
    (NEW."effectiveUntil" IS NOT NULL AND NEW."effectiveUntil"<=CURRENT_TIMESTAMP)
  ) THEN RAISE EXCEPTION 'Structured fact is not eligible for publication'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "StructuredFactRecord_publication_guard" BEFORE INSERT OR UPDATE ON "StructuredFactRecord" FOR EACH ROW EXECUTE FUNCTION public.enforce_structured_fact_publication();

ALTER TABLE "ClaimEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StructuredFactRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeReviewAction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ClaimEvidence_internal_select" ON "ClaimEvidence" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF'));
CREATE POLICY "ClaimEvidence_admin_write" ON "ClaimEvidence" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "StructuredFactRecord_internal_select" ON "StructuredFactRecord" FOR SELECT TO authenticated USING (public.jwt_is_super_admin() OR (public.jwt_user_role() IN ('DOCTOR','CLINIC_ADMIN','STAFF') AND ("clinicId" IS NULL OR public.jwt_is_clinic_member("clinicId"))));
CREATE POLICY "StructuredFactRecord_admin_write" ON "StructuredFactRecord" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
CREATE POLICY "KnowledgeReviewAction_admin_select" ON "KnowledgeReviewAction" FOR SELECT TO authenticated USING (public.jwt_is_super_admin());
CREATE POLICY "KnowledgeReviewAction_admin_write" ON "KnowledgeReviewAction" FOR ALL TO authenticated USING (public.jwt_is_super_admin()) WITH CHECK (public.jwt_is_super_admin());
GRANT SELECT ON "ClaimEvidence", "StructuredFactRecord", "KnowledgeReviewAction" TO authenticated;
GRANT ALL ON "ClaimEvidence", "StructuredFactRecord", "KnowledgeReviewAction" TO service_role;
