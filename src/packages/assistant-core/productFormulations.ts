import formulationJson from "./data/product-formulations.generated.json";
import { FULL_CATALOGUE, normalizeEntityName, type FullCatalogueKit } from "./fullCatalogue";
import type { SourceRef } from "./types";

export type ProductFormulationRow = {
  productId: string;
  productName: string;
  ingredientName: string;
  quantity: string | null;
  route: string | null;
  formulationName: string;
  sourceSheet: string;
  sourceRow: number;
  approvalStatus: string;
};

export type KitIngredientFacts = {
  kitId: string;
  name: string;
  products: Array<{
    productId: string;
    productName: string;
    ingredients: ProductFormulationRow[];
    discrepancy: string | null;
  }>;
  ingredientCount: number;
  discrepancyResult: string;
};

type ProductFormulationManifest = {
  schemaVersion: number;
  source: { file: string; repoPath: string; checksumSha256: string; extractedAt: string; sheet: string };
  formulations: ProductFormulationRow[];
};

export const PRODUCT_FORMULATION_CATALOGUE = formulationJson as ProductFormulationManifest;

const rowsByProductId = new Map<string, ProductFormulationRow[]>();
const rowsByProductName = new Map<string, ProductFormulationRow[]>();
for (const row of PRODUCT_FORMULATION_CATALOGUE.formulations) {
  rowsByProductId.set(row.productId, [...(rowsByProductId.get(row.productId) ?? []), row]);
  rowsByProductName.set(normalizeEntityName(row.productName), [...(rowsByProductName.get(normalizeEntityName(row.productName)) ?? []), row]);
}

export function productFormulationSources(rows: ProductFormulationRow[]): SourceRef[] {
  return rows.map((row) => ({
    sourceType: "STRUCTURED_FIELD",
    sourceId: `WORKBOOK:${PRODUCT_FORMULATION_CATALOGUE.source.checksumSha256}:${row.sourceRow}`,
    label: `${PRODUCT_FORMULATION_CATALOGUE.source.file} / ${row.sourceSheet}`,
    field: "formulation/Qty/ROA",
    version: PRODUCT_FORMULATION_CATALOGUE.schemaVersion,
    approvalStatus: row.approvalStatus,
  }));
}

export function getProductFormulations(productId: string, productName: string): ProductFormulationRow[] {
  return rowsByProductId.get(productId) ?? rowsByProductName.get(normalizeEntityName(productName)) ?? [];
}

export function getKitIngredientFacts(kit: FullCatalogueKit): KitIngredientFacts {
  const products = kit.components.map((component) => {
    const ingredients = getProductFormulations(component.productId, component.productName);
    return {
      productId: component.productId,
      productName: component.productName,
      ingredients,
      discrepancy: ingredients.length ? null : "NO_ACTIVE_PRODUCT_FORMULATION_ROW",
    };
  });
  const ingredientCount = products.reduce((sum, product) => sum + product.ingredients.length, 0);
  const missing = products.filter((product) => product.discrepancy).map((product) => product.productName);
  return {
    kitId: kit.id,
    name: kit.name,
    products,
    ingredientCount,
    discrepancyResult: missing.length ? `MISSING_PRODUCT_FORMULATION_ROWS:${missing.join(", ")}` : "NO_ACTIVE_INGREDIENT_CONFLICT_DETECTED",
  };
}

export function allCatalogueIngredientProductIds(): Set<string> {
  return new Set(FULL_CATALOGUE.products.filter((product) => getProductFormulations(product.id, product.name).length).map((product) => product.id));
}
