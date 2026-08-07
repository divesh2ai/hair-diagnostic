import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { importStage1Pilot } from "../../src/packages/knowledge-ingestion/stage1Importer";
import { PILOT_CHUNKS } from "../../src/packages/assistant-core/pilotKnowledge";
import { PILOT_KITS, normalizeLookup } from "../../src/packages/assistant-core/pilotData";

type Row = Record<string, any> & { id: string };

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => row[key] === expected);
}

function fakePrisma() {
  let serial = 0;
  const stores: Record<string, Map<string, Row>> = {};
  const delegate = (name: string, keyOf: (row: Row) => string) => {
    const store = stores[name] = new Map<string, Row>();
    return {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...store.values()].find((row) => matches(row, where)) ?? null,
      findUnique: async ({ where }: { where: Record<string, unknown> }) => [...store.values()].find((row) => matches(row, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: typeof data.id === "string" ? data.id : `${name}-${++serial}`, ...data } as Row;
        const key = keyOf(row);
        if (store.has(key)) throw new Error(`duplicate ${name}:${key}`);
        store.set(key, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const entry = [...store.entries()].find(([, row]) => row.id === where.id);
        if (!entry) throw new Error(`missing ${name}:${where.id}`);
        const [oldKey, prior] = entry;
        const row = { ...prior, ...data } as Row;
        store.delete(oldKey); store.set(keyOf(row), row); return row;
      },
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const candidate = { id: typeof create.id === "string" ? create.id : `${name}-${serial + 1}`, ...create } as Row;
        const key = keyOf(candidate); const prior = store.get(key);
        if (prior) { const row = { ...prior, ...update } as Row; store.set(key, row); return row; }
        serial += 1; store.set(key, candidate); return candidate;
      },
    };
  };
  const prisma = {
    ingestionRun: delegate("ingestionRun", (r) => `${r.clinicId ?? "GLOBAL"}|${r.checksum}|${r.configVersion}`),
    knowledgeDocument: delegate("knowledgeDocument", (r) => r.sourceId),
    knowledgeDocumentVersion: delegate("knowledgeDocumentVersion", (r) => `${r.documentId}|${r.checksum}`),
    kit: delegate("kit", (r) => r.canonicalId),
    kitAlias: delegate("kitAlias", (r) => `${r.kitId}|${r.normalizedAlias}`),
    kitVersion: delegate("kitVersion", (r) => `${r.kitId}|${r.version}`),
    kitPrice: delegate("kitPrice", (r) => `${r.kitId}|${r.clinicId ?? "GLOBAL"}|${r.version}`),
    product: delegate("product", (r) => r.canonicalId),
    productAlias: delegate("productAlias", (r) => `${r.productId}|${r.normalizedAlias}`),
    kitProduct: delegate("kitProduct", (r) => `${r.kitVersionId}|${r.componentOrder}`),
    kitSchedule: delegate("kitSchedule", (r) => `${r.kitVersionId}|${r.componentOrder}`),
    knowledgeChunk: delegate("knowledgeChunk", (r) => r.id),
  };
  return { prisma: prisma as unknown as PrismaClient, stores };
}

describe("Stage 1 import idempotency", () => {
  it("a second complete import creates no duplicate governed records", async () => {
    const { prisma, stores } = fakePrisma();
    const first = await importStage1Pilot(prisma, { createdBy: "test-importer" });
    const countsAfterFirst = Object.fromEntries(Object.entries(stores).map(([name, rows]) => [name, rows.size]));
    const second = await importStage1Pilot(prisma, { createdBy: "test-importer" });
    const countsAfterSecond = Object.fromEntries(Object.entries(stores).map(([name, rows]) => [name, rows.size]));

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(second.ingestionRunId).toBe(first.ingestionRunId);
    expect(countsAfterSecond).toEqual(countsAfterFirst);
    expect(countsAfterFirst).toMatchObject({
      ingestionRun: 1,
      knowledgeDocument: 1,
      knowledgeDocumentVersion: 1,
      kit: 5,
      kitAlias: new Set(PILOT_KITS.flatMap((kit) => [kit.name, ...kit.aliases].map((alias) => `${kit.id}|${normalizeLookup(alias)}`))).size,
      kitVersion: 5,
      kitPrice: 5,
      product: 23,
      productAlias: 23,
      kitProduct: 42,
      kitSchedule: 42,
      knowledgeChunk: PILOT_CHUNKS.length,
    });
  });
});
