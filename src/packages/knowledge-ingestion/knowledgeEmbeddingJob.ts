import { Prisma, PrismaClient } from "@prisma/client";

export type EmbeddingBatchPort = { modelName: string; dimensions: number; embedMany(texts: string[]): Promise<number[][]> };
export type KnowledgeEmbeddingSummary = { eligible: number; embedded: number; model: string; dimensions: number };
type PendingChunk = { id: string; content: string };

export async function embedPublishedPatientKnowledge(prisma: PrismaClient, embedding: EmbeddingBatchPort, options: { batchSize?: number; limit?: number } = {}): Promise<KnowledgeEmbeddingSummary> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 50, 100));
  const limit = Math.max(1, Math.min(options.limit ?? 1000, 5000));
  const rows = await prisma.$queryRaw<PendingChunk[]>(Prisma.sql`
    SELECT kc."id", kc."content"
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocumentVersion" kv ON kv."id" = kc."documentVersionId"
    JOIN "KnowledgeDocument" kd ON kd."id" = kv."documentId"
    WHERE kc."clinicId" IS NULL AND kd."clinicId" IS NULL
      AND kc."domain" = 'HAIR' AND kd."domain" = 'HAIR'
      AND kd."sourceStatus" = 'ACTIVE' AND kv."sourceStatus" = 'ACTIVE'
      AND kc."approvalStatus" = 'PUBLISHED_PATIENT' AND kv."status" = 'PUBLISHED_PATIENT' AND kd."status" = 'PUBLISHED_PATIENT'
      AND kc."embedding" IS NULL
      AND (kc."effectiveFrom" IS NULL OR kc."effectiveFrom" <= CURRENT_TIMESTAMP) AND (kc."effectiveUntil" IS NULL OR kc."effectiveUntil" > CURRENT_TIMESTAMP)
      AND (kv."effectiveFrom" IS NULL OR kv."effectiveFrom" <= CURRENT_TIMESTAMP) AND (kv."effectiveUntil" IS NULL OR kv."effectiveUntil" > CURRENT_TIMESTAMP)
      AND EXISTS (SELECT 1 FROM "KnowledgeClaim" c WHERE c."chunkId" = kc."id" AND c."domain" = 'HAIR' AND c."approvalStatus" = 'PUBLISHED_PATIENT' AND c."evidenceStatus" = 'SUPPORTED' AND (c."effectiveFrom" IS NULL OR c."effectiveFrom" <= CURRENT_TIMESTAMP) AND (c."effectiveUntil" IS NULL OR c."effectiveUntil" > CURRENT_TIMESTAMP))
    ORDER BY kc."authorityScore" DESC, kc."createdAt" ASC LIMIT ${limit}
  `);
  let embedded = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const vectors = await embedding.embedMany(batch.map((row) => row.content));
    if (vectors.length !== batch.length || vectors.some((vector) => vector.length !== embedding.dimensions)) throw new Error("Embedding batch shape does not match the configured pgvector index");
    for (const [index, row] of batch.entries()) {
      const vector = JSON.stringify(vectors[index]);
      const updated = await prisma.$executeRaw(Prisma.sql`
        UPDATE "KnowledgeChunk" SET "embedding" = ${vector}::vector,
          "metadata" = jsonb_set(jsonb_set("metadata", '{embeddingModel}', to_jsonb(${embedding.modelName}::text), true), '{embeddingDimensions}', to_jsonb(${embedding.dimensions}::int), true)
        WHERE "id" = ${row.id} AND "domain" = 'HAIR' AND "approvalStatus" = 'PUBLISHED_PATIENT' AND "embedding" IS NULL
      `);
      embedded += Number(updated);
    }
  }
  return { eligible: rows.length, embedded, model: embedding.modelName, dimensions: embedding.dimensions };
}
