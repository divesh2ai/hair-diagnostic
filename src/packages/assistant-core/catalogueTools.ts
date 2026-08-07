import { PILOT_KITS, PILOT_SOURCE, kitsContainingProduct, normalizeLookup, resolvePilotKit } from "./pilotData";
import type { AssistantToolResult, SourceRef } from "./types";

const source = (field: string, row?: number): SourceRef => ({
  sourceType: "STRUCTURED_FIELD",
  sourceId: `${PILOT_SOURCE.file}:${row ?? field}`,
  label: `${PILOT_SOURCE.file} / ${field}${row ? ` row ${row}` : ""}`,
  field,
  version: 1,
  approvalStatus: PILOT_SOURCE.status,
});

export function getCurrentKitPrice(name: string): AssistantToolResult {
  const kit = resolvePilotKit(name);
  if (!kit) return { tool: "getCurrentKitPrice", status: "not_found", sources: [] };
  return { tool: "getCurrentKitPrice", status: "ok", data: { kitId: kit.id, name: kit.name, mrp: kit.mrp, currency: "INR", status: "PROVISIONAL" }, sources: [source("Kits.MRP")] };
}

export function getKitComposition(name: string): AssistantToolResult {
  const kit = resolvePilotKit(name);
  if (!kit) return { tool: "getKitComposition", status: "not_found", sources: [] };
  return { tool: "getKitComposition", status: "ok", data: { kitId: kit.id, name: kit.name, components: kit.components }, sources: kit.components.map((item) => source("Kit Components", item.sourceRow)) };
}

export function getKitSchedule(name: string): AssistantToolResult {
  const result = getKitComposition(name);
  return { ...result, tool: "getKitSchedule" };
}

export function compareKits(left: string, right: string): AssistantToolResult {
  const a = resolvePilotKit(left); const b = resolvePilotKit(right);
  if (!a || !b) return { tool: "compareKits", status: "not_found", sources: [] };
  const aIds = new Set(a.components.map((x) => x.productId));
  const bIds = new Set(b.components.map((x) => x.productId));
  const names = (items: typeof a.components) => items.map((x) => x.productName);
  return {
    tool: "compareKits", status: "ok",
    data: {
      left: a.name, right: b.name,
      shared: names(a.components.filter((x) => bIds.has(x.productId))),
      leftOnly: names(a.components.filter((x) => !bIds.has(x.productId))),
      rightOnly: names(b.components.filter((x) => !aIds.has(x.productId))),
    },
    sources: [...a.components, ...b.components].map((x) => source("Kit Components", x.sourceRow)),
  };
}

export function getKitsContainingProduct(name: string): AssistantToolResult {
  const kits = kitsContainingProduct(name);
  return { tool: "getKitsContainingProduct", status: kits.length ? "ok" : "not_found", data: kits.map((kit) => ({ id: kit.id, name: kit.name })), sources: kits.flatMap((kit) => kit.components.filter((item) => normalizeLookup(item.productName) === normalizeLookup(name)).map((item) => source("Kit Components", item.sourceRow))) };
}

export function getProductIngredients(_name: string): AssistantToolResult {
  return { tool: "getProductIngredients", status: "insufficient_approved_data", sources: [] };
}

export function getProductSafety(_name: string): AssistantToolResult {
  return { tool: "getProductSafety", status: "insufficient_approved_data", sources: [] };
}

export function getKnowledgeCoverage(): AssistantToolResult {
  return { tool: "getKnowledgeCoverage", status: "ok", data: { loadedKits: PILOT_KITS.length, missing: ["approved contraindications", "pregnancy and lactation guidance", "paediatric guidance", "drug interactions", "complete ingredient quantities", "live offers", "live stock", "clinic pricing policy"], knowledgeStatus: PILOT_SOURCE.knowledgeStatus }, sources: [source("Conflicts & Gaps")] };
}
