import path from 'path';
import fs from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirrors every field in products.json exactly
// ─────────────────────────────────────────────────────────────────────────────

export type ScalpCondition =
  | 'normal'
  | 'oily'
  | 'dry'
  | 'dandruff'
  | 'itching'
  | 'sensitive'
  | 'inflammation'
  | 'psoriasis'
  | 'fungal';

export type Gender = 'male' | 'female';

export type ProductCategory = 'oil' | 'serum' | 'shampoo' | null;

export interface TopicalProduct {
  id: string;
  name: string;
  tags: string[];
  scalpMatch: ScalpCondition[];
  gender: Gender[];
  contraindications: string[];
  hormonalSafe: boolean;
  harsh: boolean;
  category: ProductCategory;
  usage: string;
  note: string;
  ingredients?: string;
  mechanism?: string;
}

export interface ProductDatabase {
  schemaVersion: string;
  sourceFile: string;
  description: string;
  products: TopicalProduct[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader — resolves relative to this file so it works from any call site
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTS_PATH = path.resolve(__dirname, '../kits/products.json');

let _cache: ProductDatabase | null = null;

/**
 * Loads the product database from disk.
 * Result is cached after the first call (module lifetime).
 * Pass `bustCache: true` in tests that mutate the JSON between calls.
 */
export function loadProducts(opts?: { bustCache?: boolean }): ProductDatabase {
  if (_cache && !opts?.bustCache) return _cache;

  if (!fs.existsSync(PRODUCTS_PATH)) {
    throw new Error(`Products file missing at: ${PRODUCTS_PATH}`);
  }

  const raw = fs.readFileSync(PRODUCTS_PATH, 'utf-8');

  try {
    _cache = JSON.parse(raw) as ProductDatabase;
  } catch (error) {
    throw new Error(
      `Failed to parse products.json: ${(error as Error).message}`
    );
  }

  return _cache;
}
/**
 * Returns the flat products array — the most common access pattern.
 */
export function getProducts(opts?: { bustCache?: boolean }): TopicalProduct[] {
  return loadProducts(opts).products;
}

/**
 * Looks up a single product by exact name match.
 * Returns undefined if not found — callers must handle the missing case.
 */
export function getProductByName(name: string): TopicalProduct | undefined {
  return getProducts().find(p => p.name === name);
}

/**
 * Returns all products whose tags overlap with the supplied tag list.
 * Used by recommendTopicals() to pre-filter candidates before scoring.
 */
export function getProductsByTags(tags: string[]): TopicalProduct[] {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  return getProducts().filter(p =>
    p.tags.some(t => tagSet.has(t.toLowerCase()))
  );
}

/**
 * Returns all products compatible with the given scalp conditions.
 * An empty scalpMatch array on the product means it is scalp-agnostic (always included).
 */
export function getProductsByScalp(scalp: ScalpCondition[]): TopicalProduct[] {
  const scalpSet = new Set(scalp);
  return getProducts().filter(
    p => p.scalpMatch.length === 0 || p.scalpMatch.some(s => scalpSet.has(s))
  );
}
