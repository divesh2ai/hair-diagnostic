import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { FULL_CATALOGUE, normalizeEntityName } from "../../src/packages/assistant-core/fullCatalogue";
import { importFullCatalogue } from "../../src/packages/knowledge-ingestion/fullCatalogueImporter";

type Row = Record<string, any> & { id: string };
function matches(row: Row, where: Record<string, unknown>): boolean { return Object.entries(where).every(([key, expected]) => row[key] === expected); }

function fakePrisma() {
  let serial = 0;
  const stores: Record<string, Map<string, Row>> = {};
  const delegate = (name: string, keyOf: (row: Row) => string) => {
    const store = stores[name] = new Map<string, Row>();
    return {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...store.values()].find((row) => matches(row, where)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: typeof data.id === "string" ? data.id : `${name}-${++serial}`, ...data } as Row;
        const key = keyOf(row); if (store.has(key)) throw new Error(`duplicate ${name}:${key}`); store.set(key, row); return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const entry = [...store.entries()].find(([, row]) => row.id === where.id); if (!entry) throw new Error(`missing ${name}:${where.id}`);
        const [oldKey, prior] = entry; const row = { ...prior, ...data } as Row; store.delete(oldKey); store.set(keyOf(row), row); return row;
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
    ingestionRun: delegate("ingestionRun", (row) => `${row.clinicId ?? "GLOBAL"}|${row.checksum}|${row.configVersion}`),
    product: delegate("product", (row) => row.canonicalId),
    productAlias: delegate("productAlias", (row) => `${row.productId}|${row.normalizedAlias}`),
    kit: delegate("kit", (row) => row.canonicalId),
    kitAlias: delegate("kitAlias", (row) => `${row.kitId}|${row.normalizedAlias}`),
    kitVersion: delegate("kitVersion", (row) => `${row.kitId}|${row.version}`),
    kitProduct: delegate("kitProduct", (row) => `${row.kitVersionId}|${row.componentOrder}`),
  };
  return { prisma: prisma as unknown as PrismaClient, stores };
}

describe("full catalogue import idempotency", () => {
  it("creates no duplicates when the command is run twice", async () => {
    const { prisma, stores } = fakePrisma();
    const first = await importFullCatalogue(prisma, "test-importer");
    const afterFirst = Object.fromEntries(Object.entries(stores).map(([name, rows]) => [name, rows.size]));
    const second = await importFullCatalogue(prisma, "test-importer");
    const afterSecond = Object.fromEntries(Object.entries(stores).map(([name, rows]) => [name, rows.size]));

    const productAliasCount = FULL_CATALOGUE.products.reduce((sum, product) => sum + new Set([product.name, product.id, ...product.aliases].map(normalizeEntityName)).size, 0);
    const kitAliasCount = FULL_CATALOGUE.kits.reduce((sum, kit) => sum + new Set([kit.name, kit.id, ...kit.aliases].map(normalizeEntityName)).size, 0);

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(second.ingestionRunId).toBe(first.ingestionRunId);
    expect(afterSecond).toEqual(afterFirst);
    expect(afterFirst).toMatchObject({
      ingestionRun: 1,
      product: 41,
      productAlias: productAliasCount,
      kit: 35,
      kitAlias: kitAliasCount,
      kitVersion: 35,
      kitProduct: 274,
    });
    expect(first).toMatchObject({ prices: 0, schedules: 0, ingredients: 0 });
  });
  it("fails closed instead of globalising a tenant-owned canonical product", async () => {
    const { prisma, stores } = fakePrisma();
    const source = FULL_CATALOGUE.products[0];
    stores.product.set(source.id, { id: "tenant-product", canonicalId: source.id, canonicalName: source.name, clinicId: "clinic-a", status: "PUBLISHED" });
    await expect(importFullCatalogue(prisma, "test-importer")).rejects.toThrow("Refusing to replace tenant-owned product");
    expect(stores.product.get(source.id)?.clinicId).toBe("clinic-a");
  });
});