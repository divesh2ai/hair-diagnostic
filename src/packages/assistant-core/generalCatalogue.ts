import { PrismaClient } from "@prisma/client";
import { FULL_CATALOGUE, findCatalogueKit, findCatalogueProduct, type FullCatalogueKit, type FullCatalogueProduct } from "./fullCatalogue";
import { getKitIngredientFacts, productFormulationSources } from "./productFormulations";
import type { AssistantToolResult, SourceRef } from "./types";

export type CatalogueEntityRef = { type: "KIT" | "PRODUCT"; id: string; name: string };
export interface GeneralCataloguePort {
  getPrice(entity: CatalogueEntityRef): Promise<AssistantToolResult>;
  getKitComposition(name: string): Promise<AssistantToolResult>;
  getProductFacts(name: string): Promise<AssistantToolResult>;
  getKitIngredientFacts(name: string): Promise<AssistantToolResult>;
  getKitsContainingProduct(name: string): Promise<AssistantToolResult>;
  compareKits(left: string, right: string): Promise<AssistantToolResult>;
  compareProducts(left: string, right: string): Promise<AssistantToolResult>;
}

const workbookSource = (field: string, row?: number): SourceRef => ({
  sourceType: "STRUCTURED_FIELD", sourceId: `WORKBOOK:${FULL_CATALOGUE.source.checksumSha256}:${row ?? field}`,
  label: `${FULL_CATALOGUE.source.file} / ${field}`, field, version: FULL_CATALOGUE.schemaVersion, approvalStatus: "PUBLISHED",
});
const uniqueSources = (sources: SourceRef[]) => sources.filter((source, index, all) =>
  all.findIndex((candidate) => candidate.sourceId === source.sourceId && candidate.field === source.field) === index,
);

export class ManifestGeneralCatalogue implements GeneralCataloguePort {
  async getPrice(entity: CatalogueEntityRef): Promise<AssistantToolResult> {
    const row = entity.type === "KIT" ? findCatalogueKit(entity.name) : findCatalogueProduct(entity.name);
    const mrp = row?.mrp ?? null;
    return { tool: "getCurrentPrice", status: mrp == null ? "not_found" : "ok", data: { ...entity, mrp, currency: mrp == null ? null : "INR", status: mrp == null ? "NOT_PRESENT_IN_WORKBOOK" : "PUBLISHED" }, sources: [workbookSource("MRP")] };
  }
  async getKitComposition(name: string): Promise<AssistantToolResult> {
    const kit = findCatalogueKit(name);
    if (!kit) return { tool: "getKitComposition", status: "not_found", sources: [] };
    return { tool: "getKitComposition", status: "ok", data: { kitId: kit.id, name: kit.name, components: kit.components }, sources: kit.components.map((item) => workbookSource(`${item.sourceSheet}.composition`, item.sourceRow)) };
  }
  async getProductFacts(name: string): Promise<AssistantToolResult> {
    const product = findCatalogueProduct(name);
    if (!product) return { tool: "getProductFacts", status: "not_found", sources: [] };
    return { tool: "getProductFacts", status: "ok", data: product, sources: [workbookSource("product name")] };
  }
  async getKitIngredientFacts(name: string): Promise<AssistantToolResult> {
    const kit = findCatalogueKit(name);
    if (!kit) return { tool: "getKitIngredientFacts", status: "not_found", sources: [] };
    const data = getKitIngredientFacts(kit);
    const rows = data.products.flatMap((product) => product.ingredients);
    return { tool: "getKitIngredientFacts", status: rows.length ? "ok" : "insufficient_approved_data", data, sources: productFormulationSources(rows) };
  }
  async getKitsContainingProduct(name: string): Promise<AssistantToolResult> {
    const product = findCatalogueProduct(name);
    if (!product) return { tool: "getKitsContainingProduct", status: "not_found", sources: [] };
    const kits = FULL_CATALOGUE.kits.filter((kit) => kit.components.some((item) => item.productId === product.id)).map((kit) => ({ id: kit.id, name: kit.name }));
    return { tool: "getKitsContainingProduct", status: kits.length ? "ok" : "not_found", data: kits, sources: [workbookSource("kit-product composition")] };
  }
  async compareKits(left: string, right: string): Promise<AssistantToolResult> {
    const a = findCatalogueKit(left); const b = findCatalogueKit(right);
    if (!a || !b) return { tool: "compareKits", status: "not_found", sources: [] };
    const aIds = new Set(a.components.map((item) => item.productId)); const bIds = new Set(b.components.map((item) => item.productId));
    return { tool: "compareKits", status: "ok", data: {
      left: a.name, right: b.name,
      shared: a.components.filter((item) => bIds.has(item.productId)).map((item) => item.productName),
      leftOnly: a.components.filter((item) => !bIds.has(item.productId)).map((item) => item.productName),
      rightOnly: b.components.filter((item) => !aIds.has(item.productId)).map((item) => item.productName),
    }, sources: [...a.components.map((item) => workbookSource(`${item.sourceSheet}.composition`, item.sourceRow)), ...b.components.map((item) => workbookSource(`${item.sourceSheet}.composition`, item.sourceRow))] };
  }

  async compareProducts(left: string, right: string): Promise<AssistantToolResult> {
    const a = findCatalogueProduct(left); const b = findCatalogueProduct(right);
    if (!a || !b) return { tool: "compareProducts", status: "not_found", sources: [] };
    const aKits = FULL_CATALOGUE.kits.filter((kit) => kit.components.some((item) => item.productId === a.id)).map((kit) => kit.name);
    const bKits = FULL_CATALOGUE.kits.filter((kit) => kit.components.some((item) => item.productId === b.id)).map((kit) => kit.name);
    return { tool: "compareProducts", status: "ok", data: { left: a.name, right: b.name, leftKits: aKits, rightKits: bKits, leftIngredients: null, rightIngredients: null, exactFormulationAvailable: false }, sources: [workbookSource("product name"), workbookSource("kit-product composition")] };
  }}

const dbSource = (table: string, id: string, field: string, status?: string, version?: number, effectiveFrom?: Date | null): SourceRef => ({ sourceType: "STRUCTURED_FIELD", sourceId: `${table}:${id}`, label: `${table} record`, field, approvalStatus: status, version, effectiveFrom: effectiveFrom?.toISOString() ?? null });
const STRICT_FIVE_KIT = /\b(?:te\s*gold|gi\s*(?:health\s*)?gold|pro\s*immune\s*gold|inflammation\s*phenotype|phenotype\s*inflammation|meta\s*b)\b/i;
const unavailable = (tool: string): AssistantToolResult => ({
  tool,
  status: "insufficient_approved_data",
  sources: [],
});
const structuredFallbackAllowed = (result: AssistantToolResult) => result.status === "ok" && Array.isArray((result.data as { components?: unknown[] } | undefined)?.components) && ((result.data as { components?: unknown[] }).components?.length ?? 0) > 0;

export class PrismaGeneralCatalogue implements GeneralCataloguePort {
  constructor(private readonly prisma: PrismaClient, private readonly fallback: GeneralCataloguePort = new ManifestGeneralCatalogue()) {}
  private async kit(name: string) {
    const known = findCatalogueKit(name); if (!known || !process.env.DATABASE_URL) return null;
    return this.prisma.kit.findFirst({ where: { canonicalId: known.id, clinicId: null, status: "PUBLISHED" } });
  }
  private async product(name: string) {
    const known = findCatalogueProduct(name); if (!known || !process.env.DATABASE_URL) return null;
    return this.prisma.product.findFirst({ where: { canonicalId: known.id, clinicId: null, status: "PUBLISHED" } });
  }
  async getPrice(entity: CatalogueEntityRef): Promise<AssistantToolResult> {
    try {
      const now = new Date();
      if (entity.type === "KIT") {
        const kit = await this.kit(entity.name); if (!kit) return STRICT_FIVE_KIT.test(entity.name) ? unavailable("getCurrentPrice") : this.fallback.getPrice(entity);
        const price = await this.prisma.kitPrice.findFirst({ where: { kitId: kit.id, clinicId: null, status: "PUBLISHED", conflictStatus: "NONE", AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }] }, orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }] });
        if (!price) return STRICT_FIVE_KIT.test(entity.name) ? unavailable("getCurrentPrice") : this.fallback.getPrice(entity);
        return { tool: "getCurrentPrice", status: "ok", data: { ...entity, mrp: Number(price.mrp), currency: price.currency, status: price.status }, sources: [dbSource("KitPrice", price.id, "mrp", price.status, price.version, price.effectiveFrom)] };
      }
      const product = await this.product(entity.name); if (!product) return this.fallback.getPrice(entity);
      const price = await this.prisma.productPrice.findFirst({ where: { productId: product.id, clinicId: null, status: "PUBLISHED", conflictStatus: "NONE", AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }] }, orderBy: { effectiveFrom: "desc" } });
      if (!price) return this.fallback.getPrice(entity);
      const version = await this.prisma.productPriceVersion.findUnique({ where: { id: price.versionId } });
      return { tool: "getCurrentPrice", status: "ok", data: { ...entity, mrp: Number(price.mrp), currency: price.currency, status: price.status }, sources: [dbSource("ProductPrice", price.id, "mrp", price.status, version?.version, price.effectiveFrom)] };
    } catch { return this.fallback.getPrice(entity); }
  }
  async getKitComposition(name: string): Promise<AssistantToolResult> {
    try {
      const kit = await this.kit(name); if (!kit) { const fallback = await this.fallback.getKitComposition(name); return structuredFallbackAllowed(fallback) ? fallback : STRICT_FIVE_KIT.test(name) ? unavailable("getKitComposition") : fallback; }
      const version = await this.prisma.kitVersion.findFirst({ where: { kitId: kit.id, version: kit.currentVersion, status: "PUBLISHED" } });
      if (!version) { const fallback = await this.fallback.getKitComposition(name); return structuredFallbackAllowed(fallback) ? fallback : STRICT_FIVE_KIT.test(name) ? unavailable("getKitComposition") : fallback; }
      const rows = await this.prisma.kitProduct.findMany({ where: { kitId: kit.id, kitVersionId: version.id, status: "PUBLISHED", conflictStatus: "NONE" }, orderBy: { componentOrder: "asc" } });
      const products = await this.prisma.product.findMany({ where: { id: { in: rows.map((row) => row.productId) }, status: "PUBLISHED" } }); const byId = new Map(products.map((row) => [row.id, row]));
      if (STRICT_FIVE_KIT.test(name) && (rows.length === 0 || products.length !== new Set(rows.map((row) => row.productId)).size)) { const fallback = await this.fallback.getKitComposition(name); return structuredFallbackAllowed(fallback) ? fallback : unavailable("getKitComposition"); }
      return { tool: "getKitComposition", status: "ok", data: { kitId: kit.canonicalId, name: kit.canonicalName, components: rows.map((row) => ({ productId: byId.get(row.productId)?.canonicalId ?? row.productId, productName: byId.get(row.productId)?.canonicalName ?? row.productId, componentOrder: row.componentOrder, sourceRow: row.sourceRow, schedule: null, formulation: null })) }, sources: rows.map((row) => dbSource("KitProduct", row.id, "productId/componentOrder", row.status, version.version)) };
    } catch { const fallback = await this.fallback.getKitComposition(name); return structuredFallbackAllowed(fallback) ? fallback : STRICT_FIVE_KIT.test(name) ? unavailable("getKitComposition") : fallback; }
  }
  async getProductFacts(name: string): Promise<AssistantToolResult> {
    try {
      const product = await this.product(name); if (!product) return this.fallback.getProductFacts(name);
      const rows = await this.prisma.productIngredient.findMany({ where: { productId: product.id, status: "PUBLISHED", conflictStatus: "NONE" } });
      const ingredients = await this.prisma.ingredient.findMany({ where: { id: { in: rows.map((row) => row.ingredientId) } } });
      const names = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.canonicalName]));
      return { tool: "getProductFacts", status: "ok", data: { id: product.canonicalId, name: product.canonicalName, ingredients: rows.map((row) => ({ name: names.get(row.ingredientId) ?? null, quantity: row.quantity ? Number(row.quantity) : null, unit: row.unit, formulationText: row.formulationText })) }, sources: rows.length ? rows.map((row) => dbSource("ProductIngredient", row.id, "quantity/unit/formulationText", row.status)) : [dbSource("Product", product.id, "canonicalName", product.status)] };
    } catch { return this.fallback.getProductFacts(name); }
  }
  async getKitIngredientFacts(name: string): Promise<AssistantToolResult> {
    return this.fallback.getKitIngredientFacts(name);
  }
  async getKitsContainingProduct(name: string): Promise<AssistantToolResult> {
    try {
      const product = await this.product(name); if (!product) return this.fallback.getKitsContainingProduct(name);
      const rows = await this.prisma.kitProduct.findMany({ where: { productId: product.id, status: "PUBLISHED" } });
      const kits = await this.prisma.kit.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.kitId))] }, clinicId: null, status: "PUBLISHED" } });
      return { tool: "getKitsContainingProduct", status: kits.length ? "ok" : "not_found", data: kits.map((kit) => ({ id: kit.canonicalId, name: kit.canonicalName })), sources: rows.map((row) => dbSource("KitProduct", row.id, "productId", row.status)) };
    } catch { return this.fallback.getKitsContainingProduct(name); }
  }
  async compareKits(left: string, right: string): Promise<AssistantToolResult> {
    const [a, b] = await Promise.all([this.getKitComposition(left), this.getKitComposition(right)]);
    if (a.status !== "ok" || b.status !== "ok") return this.fallback.compareKits(left, right);
    const ad = a.data as { name: string; components: Array<{ productId: string; productName: string }> }; const bd = b.data as typeof ad;
    const ai = new Set(ad.components.map((item) => item.productId)); const bi = new Set(bd.components.map((item) => item.productId));
    return { tool: "compareKits", status: "ok", data: { left: ad.name, right: bd.name, shared: ad.components.filter((item) => bi.has(item.productId)).map((item) => item.productName), leftOnly: ad.components.filter((item) => !bi.has(item.productId)).map((item) => item.productName), rightOnly: bd.components.filter((item) => !ai.has(item.productId)).map((item) => item.productName) }, sources: uniqueSources([...a.sources, ...b.sources]) };
  }  async compareProducts(left: string, right: string): Promise<AssistantToolResult> {
    const [aFacts, bFacts, aKits, bKits] = await Promise.all([this.getProductFacts(left), this.getProductFacts(right), this.getKitsContainingProduct(left), this.getKitsContainingProduct(right)]);
    if (aFacts.status === "not_found" || bFacts.status === "not_found") return this.fallback.compareProducts(left, right);
    const a = aFacts.data as { name?: string; ingredients?: unknown[] }; const b = bFacts.data as typeof a;
    return { tool: "compareProducts", status: "ok", data: { left: a.name ?? left, right: b.name ?? right, leftKits: aKits.data ?? [], rightKits: bKits.data ?? [], leftIngredients: a.ingredients ?? [], rightIngredients: b.ingredients ?? [], exactFormulationAvailable: Boolean(a.ingredients?.length || b.ingredients?.length) }, sources: uniqueSources([...aFacts.sources, ...bFacts.sources, ...aKits.sources, ...bKits.sources]) };
  }
}
