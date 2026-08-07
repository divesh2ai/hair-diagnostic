import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { FULL_CATALOGUE, normalizeEntityName } from "../assistant-core/fullCatalogue";

export type FullCatalogueImportSummary = {
  ingestionRunId: string;
  skipped: boolean;
  kits: number;
  products: number;
  components: number;
  prices: number;
  schedules: number;
  ingredients: number;
};

export const FULL_CATALOGUE_CONFIG_VERSION = "DRFACT_FULL_CATALOGUE_V1";
const manifestChecksum = createHash("sha256").update(JSON.stringify({ source: FULL_CATALOGUE.source.checksumSha256, products: FULL_CATALOGUE.products, kits: FULL_CATALOGUE.kits })).digest("hex");

const expectedSummary = (ingestionRunId: string, skipped: boolean): FullCatalogueImportSummary => ({
  ingestionRunId,
  skipped,
  kits: FULL_CATALOGUE.kits.length,
  products: FULL_CATALOGUE.products.length,
  components: FULL_CATALOGUE.kits.reduce((sum, kit) => sum + kit.components.length, 0),
  prices: 0,
  schedules: 0,
  ingredients: 0,
});

export async function importFullCatalogue(prisma: PrismaClient, createdBy?: string): Promise<FullCatalogueImportSummary> {
  const existing = await prisma.ingestionRun.findFirst({ where: { clinicId: null, checksum: manifestChecksum, configVersion: FULL_CATALOGUE_CONFIG_VERSION, status: "COMPLETED" } });
  if (existing) return expectedSummary(existing.id, true);

  const prior = await prisma.ingestionRun.findFirst({ where: { clinicId: null, checksum: manifestChecksum, configVersion: FULL_CATALOGUE_CONFIG_VERSION } });
  let run = prior;
  if (run) {
    run = await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: new Date(), completedAt: null, errors: Prisma.DbNull } });
  } else {
    try {
      run = await prisma.ingestionRun.create({ data: { clinicId: null, sourceFile: FULL_CATALOGUE.source.file, checksum: manifestChecksum, configVersion: FULL_CATALOGUE_CONFIG_VERSION, status: "RUNNING", startedAt: new Date(), createdBy } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      run = await prisma.ingestionRun.findFirst({ where: { clinicId: null, checksum: manifestChecksum, configVersion: FULL_CATALOGUE_CONFIG_VERSION } });
      if (!run) throw error;
      if (run.status === "COMPLETED") return expectedSummary(run.id, true);
    }
  }

  try {
    const products = new Map<string, { id: string }>();
    for (const source of FULL_CATALOGUE.products) {
      const existingProduct = await prisma.product.findFirst({ where: { canonicalId: source.id } });
      if (existingProduct?.clinicId) throw new Error(`Refusing to replace tenant-owned product ${source.id} with a global catalogue record`);
      const product = await prisma.product.upsert({
        where: { canonicalId: source.id },
        create: { canonicalId: source.id, canonicalName: source.name, clinicId: null, status: "PUBLISHED" },
        update: { canonicalName: source.name, status: "PUBLISHED" },
      });
      products.set(source.id, product);
      for (const alias of [...new Set([source.name, source.id, ...source.aliases])]) {
        const normalizedAlias = normalizeEntityName(alias);
        await prisma.productAlias.upsert({
          where: { productId_normalizedAlias: { productId: product.id, normalizedAlias } },
          create: { productId: product.id, clinicId: null, alias, normalizedAlias },
          update: { alias },
        });
      }
    }

    for (const source of FULL_CATALOGUE.kits) {
      const existingKit = await prisma.kit.findFirst({ where: { canonicalId: source.id } });
      if (existingKit?.clinicId) throw new Error(`Refusing to replace tenant-owned kit ${source.id} with a global catalogue record`);
      const kit = await prisma.kit.upsert({
        where: { canonicalId: source.id },
        create: { canonicalId: source.id, canonicalName: source.name, clinicId: null, status: "PUBLISHED", currentVersion: 1 },
        update: { canonicalName: source.name, status: "PUBLISHED", currentVersion: 1 },
      });
      for (const alias of [...new Set([source.name, source.id, ...source.aliases])]) {
        const normalizedAlias = normalizeEntityName(alias);
        await prisma.kitAlias.upsert({
          where: { kitId_normalizedAlias: { kitId: kit.id, normalizedAlias } },
          create: { kitId: kit.id, clinicId: null, alias, normalizedAlias },
          update: { alias },
        });
      }
      const componentChecksum = createHash("sha256").update(JSON.stringify(source.components)).digest("hex");
      const version = await prisma.kitVersion.upsert({
        where: { kitId_version: { kitId: kit.id, version: 1 } },
        create: { kitId: kit.id, version: 1, checksum: componentChecksum, sourceId: `${FULL_CATALOGUE.source.file}:${source.sourceSheet}`, status: "PUBLISHED" },
        update: { checksum: componentChecksum, sourceId: `${FULL_CATALOGUE.source.file}:${source.sourceSheet}`, status: "PUBLISHED" },
      });
      for (const component of source.components) {
        const product = products.get(component.productId);
        if (!product) throw new Error(`Catalogue product ${component.productId} is missing for ${source.id}`);
        await prisma.kitProduct.upsert({
          where: { kitVersionId_componentOrder: { kitVersionId: version.id, componentOrder: component.componentOrder } },
          create: { kitId: kit.id, productId: product.id, kitVersionId: version.id, componentOrder: component.componentOrder, sourceRow: component.sourceRow, status: "PUBLISHED" },
          update: { kitId: kit.id, productId: product.id, sourceRow: component.sourceRow, status: "PUBLISHED" },
        });
      }
    }

    const summary = expectedSummary(run.id, false);
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date(), counts: summary as unknown as Prisma.InputJsonValue, errors: Prisma.DbNull } });
    return summary;
  } catch (error) {
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), errors: { message: error instanceof Error ? error.message : String(error) } } });
    throw error;
  }
}