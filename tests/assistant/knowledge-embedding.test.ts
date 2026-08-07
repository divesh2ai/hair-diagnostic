import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { embedPublishedPatientKnowledge, type EmbeddingBatchPort } from "../../src/packages/knowledge-ingestion/knowledgeEmbeddingJob";

function fakePrisma() {
  const pending = [
    { id: "published-1", content: "Hair shedding educational content" },
    { id: "published-2", content: "Scalp care educational content" },
  ];
  let writes = 0;
  const prisma = {
    $queryRaw: async () => [...pending],
    $executeRaw: async () => { pending.shift(); writes += 1; return 1; },
  } as unknown as PrismaClient;
  return { prisma, writes: () => writes };
}

const embedding: EmbeddingBatchPort = {
  modelName: "test-embedding-model", dimensions: 3,
  async embedMany(texts) { return texts.map((_, index) => [index + 0.1, index + 0.2, index + 0.3]); },
};

describe("published knowledge embedding job", () => {
  it("embeds each eligible published chunk once and is idempotent", async () => {
    const fake = fakePrisma();
    const first = await embedPublishedPatientKnowledge(fake.prisma, embedding, { batchSize: 1 });
    const second = await embedPublishedPatientKnowledge(fake.prisma, embedding, { batchSize: 1 });
    expect(first).toEqual({ eligible: 2, embedded: 2, model: "test-embedding-model", dimensions: 3 });
    expect(second).toEqual({ eligible: 0, embedded: 0, model: "test-embedding-model", dimensions: 3 });
    expect(fake.writes()).toBe(2);
  });

  it("rejects vectors with the wrong dimension before writing", async () => {
    const fake = fakePrisma();
    const invalid = { ...embedding, async embedMany(texts: string[]) { return texts.map(() => [1, 2]); } };
    await expect(embedPublishedPatientKnowledge(fake.prisma, invalid)).rejects.toThrow("Embedding batch shape");
    expect(fake.writes()).toBe(0);
  });
});