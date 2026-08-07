import { PrismaClient } from "@prisma/client";
import * as pilot from "./catalogueTools";
import { PILOT_KITS, normalizeLookup, resolvePilotKit } from "./pilotData";
import type { AssistantToolResult, SourceRef } from "./types";

export interface CataloguePort {
  getCurrentKitPrice(name: string): Promise<AssistantToolResult>;
  getKitComposition(name: string): Promise<AssistantToolResult>;
  getKitSchedule(name: string): Promise<AssistantToolResult>;
  compareKits(left: string, right: string): Promise<AssistantToolResult>;
  getKitsContainingProduct(name: string): Promise<AssistantToolResult>;
  getProductIngredients(name: string): Promise<AssistantToolResult>;
}

export class PilotCatalogue implements CataloguePort {
  async getCurrentKitPrice(name: string) { return pilot.getCurrentKitPrice(name); }
  async getKitComposition(name: string) { return pilot.getKitComposition(name); }
  async getKitSchedule(name: string) { return pilot.getKitSchedule(name); }
  async compareKits(left: string, right: string) { return pilot.compareKits(left, right); }
  async getKitsContainingProduct(name: string) { return pilot.getKitsContainingProduct(name); }
  async getProductIngredients(name: string) { return pilot.getProductIngredients(name); }
}

const dbSource = (table: string, id: string, field: string, status?: string, version?: number, effectiveFrom?: Date | null): SourceRef => ({ sourceType: "STRUCTURED_FIELD", sourceId: `${table}:${id}`, label: `${table} record`, field, approvalStatus: status, version, effectiveFrom: effectiveFrom?.toISOString() ?? null });

export class PrismaCatalogue implements CataloguePort {
  constructor(private readonly prisma: PrismaClient, private readonly clinicId: string) {}

  private async kit(input: string) {
    const known = resolvePilotKit(input);
    if (known) return this.prisma.kit.findUnique({ where: { canonicalId: known.id } });
    const alias = normalizeLookup(input);
    const matched = await this.prisma.kitAlias.findFirst({ where: { normalizedAlias: alias, OR: [{ clinicId: this.clinicId }, { clinicId: null }] } });
    return matched ? this.prisma.kit.findUnique({ where: { id: matched.kitId } }) : null;
  }

  async getCurrentKitPrice(input: string): Promise<AssistantToolResult> {
    const kit = await this.kit(input);
    if (!kit) return { tool: "getCurrentKitPrice", status: "not_found", sources: [] };
    const price = await this.prisma.kitPrice.findFirst({ where: { kitId: kit.id, OR: [{ clinicId: this.clinicId }, { clinicId: null }], status: { in: ["PUBLISHED", "PROVISIONAL"] }, AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] }] }, orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }] });
    if (!price) return { tool: "getCurrentKitPrice", status: "not_found", sources: [] };
    return { tool: "getCurrentKitPrice", status: "ok", data: { kitId: kit.canonicalId, name: kit.canonicalName, mrp: Number(price.mrp), currency: price.currency, status: price.status }, sources: [dbSource("KitPrice", price.id, "mrp", price.status, price.version, price.effectiveFrom)] };
  }

  async getKitComposition(input: string): Promise<AssistantToolResult> {
    const kit = await this.kit(input);
    if (!kit) return { tool: "getKitComposition", status: "not_found", sources: [] };
    const version = await this.prisma.kitVersion.findFirst({ where: { kitId: kit.id, version: kit.currentVersion }, orderBy: { createdAt: "desc" } });
    if (!version) return { tool: "getKitComposition", status: "not_found", sources: [] };
    const rows = await this.prisma.kitProduct.findMany({ where: { kitId: kit.id, kitVersionId: version.id }, orderBy: { componentOrder: "asc" } });
    const products = await this.prisma.product.findMany({ where: { id: { in: rows.map((row) => row.productId) } } });
    const schedules = await this.prisma.kitSchedule.findMany({ where: { kitVersionId: version.id } });
    const productById = new Map(products.map((product) => [product.id, product]));
    const scheduleByOrder = new Map(schedules.map((schedule) => [schedule.componentOrder, schedule.scheduleText]));
    const components = rows.map((row) => ({ productId: productById.get(row.productId)?.canonicalId ?? row.productId, productName: productById.get(row.productId)?.canonicalName ?? row.productId, schedule: scheduleByOrder.get(row.componentOrder) ?? "", sourceRow: row.sourceRow, componentOrder: row.componentOrder }));
    return { tool: "getKitComposition", status: "ok", data: { kitId: kit.canonicalId, name: kit.canonicalName, components }, sources: rows.map((row) => dbSource("KitProduct", row.id, "productId/componentOrder", row.status, version.version)) };
  }

  async getKitSchedule(input: string): Promise<AssistantToolResult> {
    const result = await this.getKitComposition(input); return { ...result, tool: "getKitSchedule" };
  }

  async compareKits(left: string, right: string): Promise<AssistantToolResult> {
    const [a, b] = await Promise.all([this.getKitComposition(left), this.getKitComposition(right)]);
    if (a.status !== "ok" || b.status !== "ok") return { tool: "compareKits", status: "not_found", sources: [] };
    const ad = a.data as { name: string; components: Array<{ productId: string; productName: string }> }; const bd = b.data as typeof ad;
    const aIds = new Set(ad.components.map((item) => item.productId)); const bIds = new Set(bd.components.map((item) => item.productId));
    return { tool: "compareKits", status: "ok", data: { left: ad.name, right: bd.name, shared: ad.components.filter((item) => bIds.has(item.productId)).map((item) => item.productName), leftOnly: ad.components.filter((item) => !bIds.has(item.productId)).map((item) => item.productName), rightOnly: bd.components.filter((item) => !aIds.has(item.productId)).map((item) => item.productName) }, sources: [...a.sources, ...b.sources] };
  }

  async getKitsContainingProduct(input: string): Promise<AssistantToolResult> {
    const normalized = normalizeLookup(input);
    const product = await this.prisma.product.findUnique({ where: { canonicalId: input.replaceAll("-", "_").toUpperCase() } });
    const matched = product ?? await this.prisma.productAlias.findFirst({ where: { normalizedAlias: normalized } }).then((alias) => alias ? this.prisma.product.findUnique({ where: { id: alias.productId } }) : null);
    if (!matched) return { tool: "getKitsContainingProduct", status: "not_found", sources: [] };
    const rows = await this.prisma.kitProduct.findMany({ where: { productId: matched.id } });
    const kits = await this.prisma.kit.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.kitId))] } } });
    return { tool: "getKitsContainingProduct", status: kits.length ? "ok" : "not_found", data: kits.map((kit) => ({ id: kit.canonicalId, name: kit.canonicalName })), sources: rows.map((row) => dbSource("KitProduct", row.id, "productId", row.status)) };
  }

  async getProductIngredients(input: string): Promise<AssistantToolResult> {
    const normalized = normalizeLookup(input);
    const known = PILOT_KITS.flatMap((kit) => kit.components).find((item) => (` ${normalized} `).includes(` ${normalizeLookup(item.productName)} `));
    const product = known
      ? await this.prisma.product.findUnique({ where: { canonicalId: known.productId } })
      : await this.prisma.productAlias.findFirst({ where: { normalizedAlias: normalized } }).then((alias) => alias ? this.prisma.product.findUnique({ where: { id: alias.productId } }) : null);
    if (!product) return { tool: "getProductIngredients", status: "insufficient_approved_data", sources: [] };
    const rows = await this.prisma.productIngredient.findMany({ where: { productId: product.id, status: "PUBLISHED" } });
    if (!rows.length) return { tool: "getProductIngredients", status: "insufficient_approved_data", sources: [] };
    const ingredients = await this.prisma.ingredient.findMany({ where: { id: { in: rows.map((row) => row.ingredientId) } } });
    return { tool: "getProductIngredients", status: "ok", data: rows.map((row) => ({ name: ingredients.find((item) => item.id === row.ingredientId)?.canonicalName, quantity: row.quantity ? Number(row.quantity) : null, unit: row.unit })), sources: rows.map((row) => dbSource("ProductIngredient", row.id, "quantity/unit", row.status)) };
  }
}
