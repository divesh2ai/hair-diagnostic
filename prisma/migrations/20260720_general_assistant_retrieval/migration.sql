-- Public general-assistant retrieval indexes. No RLS policy changes.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_general_public_filters_idx"
  ON "KnowledgeChunk" ("language", "domain", "knowledgeSystem", "authorityScore" DESC, "effectiveFrom", "effectiveUntil")
  WHERE "clinicId" IS NULL AND "approvalStatus" = 'PUBLISHED_PATIENT';

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_content_simple_fts_idx"
  ON "KnowledgeChunk" USING GIN (to_tsvector('simple', "content"))
  WHERE "clinicId" IS NULL AND "approvalStatus" = 'PUBLISHED_PATIENT';

-- The schema intentionally keeps the vector column model-agnostic. This expression
-- index serves the configured 1536-dimension text-embedding-3-small model.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_1536_hnsw_idx"
  ON "KnowledgeChunk" USING hnsw (("embedding"::vector(1536)) vector_cosine_ops)
  WHERE "embedding" IS NOT NULL AND "clinicId" IS NULL AND "approvalStatus" = 'PUBLISHED_PATIENT';