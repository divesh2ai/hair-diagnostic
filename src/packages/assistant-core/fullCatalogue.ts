import manifestJson from "./data/full-catalogue.generated.json";

export type FullCatalogueProduct = {
  id: string;
  name: string;
  aliases: string[];
  mrp: number | null;
  formulation: string | null;
  ingredientText: string | null;
};

export type FullCatalogueKit = {
  id: string;
  name: string;
  aliases: string[];
  mrp: number | null;
  schedule: string | null;
  sourceSheet: string;
  components: Array<{
    productId: string;
    productName: string;
    componentOrder: number;
    sourceSheet: string;
    sourceRow: number;
    schedule: string | null;
    formulation: string | null;
  }>;
};

type FullCatalogueManifest = {
  schemaVersion: number;
  source: { file: string; repoPath: string; checksumSha256: string; extractedAt: string };
  extractionPolicy: string;
  facts: Record<string, boolean>;
  products: FullCatalogueProduct[];
  kits: FullCatalogueKit[];
};

type KitCanonicalRegistration = {
  id: string;
  name: string;
  aliases: string[];
};

const KIT_CANONICAL_REGISTRATIONS = new Map<string, KitCanonicalRegistration>([
  ["KIT_PRO_FACT_INFLAMMATION_PHENOTYPE", {
    id: "KIT_INFLAMMATION_PHENOTYPE",
    name: "Inflammation Phenotype",
    aliases: ["Inflammation Phenotype", "PHENOTYPE INFLAMMATION", "PRO FACT INFLAMMATION PHENOTYPE", "Pro Fact Inflammation", "Phenotype Inflammation", "Phenotype Inflammation Kit", "Inflammation Phenotype Kit", "Inflammation Kit", "Anti-inflammatory Phenotype", "Anti Inflammatory Phenotype", "Inflammatory Phenotype", "Inflammation / Oxidative Stress"],
  }],
  ["KIT_HAIR_FACT_TE_GOLD", {
    id: "KIT_TE_GOLD",
    name: "TE GOLD",
    aliases: ["TE GOLD", "Hair Fact TE Gold", "TE Gold Kit"],
  }],
  ["KIT_PRO_FACT_GI_HEALTH_GOLD", {
    id: "KIT_GI_HEALTH_GOLD",
    name: "GI GOLD",
    aliases: ["GI GOLD", "GI Health Gold", "Pro Fact GI Health Gold", "GI Gold Kit"],
  }],
  ["KIT_PRO_IMMUNE_GOLD_PRO", {
    id: "KIT_PRO_IMMUNE_GOLD",
    name: "PRO IMMUNE GOLD",
    aliases: ["PRO IMMUNE GOLD", "Pro Immune", "Proimmune Gold", "Pro Immune Gold Pro", "Pro Immune Gold Kit"],
  }],
  ["KIT_PRO_FACT_META_B", {
    id: "KIT_PRO_FACT_META_B",
    name: "PRO FACT META B",
    aliases: ["PRO FACT META B", "Meta B", "Meta-B", "MetaB", "Profact Meta B", "Pro Fact Meta B"],
  }],
  ["KIT_PRO_FACT_META_B_PCOS_6_VEG", {
    id: "KIT_PRO_FACT_META_B_PCOS",
    name: "PRO FACT META B PCOS",
    aliases: ["PRO FACT META B PCOS", "Meta B PCOS", "Profact Meta B PCOS", "Pro Fact Meta B PCOS", "PRO FACT META B - PCOS 6 (veg)"],
  }],
  ["KIT_PRO_FACT_META_B_HYPOTHYROID_3", {
    id: "KIT_PRO_FACT_META_B_THYROID",
    name: "PRO FACT META B THYROID",
    aliases: ["PRO FACT META B THYROID", "Meta B Thyroid", "Profact Meta B Thyroid", "Pro Fact Meta B Thyroid", "Meta B Hypothyroid", "PRO FACT META B - HYPOTHYROID 3"],
  }],
  ["KIT_PRO_FACT_META_B_POST_M_2", {
    id: "KIT_PRO_FACT_META_B_MENOPAUSE",
    name: "PRO FACT META B MENOPAUSE",
    aliases: ["PRO FACT META B MENOPAUSE", "Meta B Menopause", "Profact Meta B Menopause", "Pro Fact Meta B Menopause", "Meta B Post M 2", "PRO FACT META B - POST M 2"],
  }],
]);

function dedupe(values: string[]): string[] {
  return [...new Map(values.filter(Boolean).map((value) => [value.toLowerCase(), value.trim()])).values()];
}

const VIRTUAL_KIT_REGISTRATIONS: FullCatalogueKit[] = [{
  id: "KIT_PRO_FACT_META_B_IR5",
  name: "PRO FACT META B IR 5",
  aliases: ["PRO FACT META B IR 5", "Meta B IR 5", "Meta-B IR 5", "MetaB IR5", "Profact Meta B IR 5", "Pro Fact Meta B IR 5"],
  mrp: null,
  schedule: null,
  sourceSheet: "Canonical Meta B identity decision",
  components: [],
}];
function canonicalizeKit(kit: FullCatalogueKit): FullCatalogueKit {
  const registration = KIT_CANONICAL_REGISTRATIONS.get(kit.id);
  if (!registration) return kit;
  return {
    ...kit,
    id: registration.id,
    name: registration.name,
    aliases: dedupe([registration.name, ...registration.aliases, ...kit.aliases, kit.name]),
  };
}
export const FULL_CATALOGUE = {
  ...(manifestJson as FullCatalogueManifest),
  kits: (manifestJson as FullCatalogueManifest).kits.map(canonicalizeKit),
} satisfies FullCatalogueManifest;

export function normalizeEntityName(value: string): string {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = rows[0]; rows[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = rows[j];
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return rows[right.length];
}

type Entity = { type: "KIT"; value: FullCatalogueKit } | { type: "PRODUCT"; value: FullCatalogueProduct };
export type EntityResolutionMethod = "CANONICAL_NAME" | "EXACT_ALIAS" | "NORMALIZED_TOKEN" | "FUZZY_ALIAS" | "SEMANTIC_ENTITY";
export type CatalogueEntityMatch = Entity & { confidence: number; method: EntityResolutionMethod; matchedAlias: string };

const tokenSet = (value: string) => new Set(normalizeEntityName(value).split(" ").filter(Boolean));
const overlap = (left: Set<string>, right: Set<string>) => [...left].filter((token) => right.has(token)).length;
const phraseWindows = (words: string[], maxSize = 6) => {
  const phrases: string[] = [];
  for (let size = 1; size <= Math.min(maxSize, words.length); size += 1) for (let start = 0; start + size <= words.length; start += 1) phrases.push(words.slice(start, start + size).join(" "));
  return phrases;
};

function semanticConfidence(normalized: string, entity: Entity): CatalogueEntityMatch | undefined {
  if (entity.type !== "KIT") return undefined;
  const tokens = tokenSet(normalized);
  const has = (token: string) => tokens.has(token);
  const kit = entity.value;
  const pick = (confidence: number, matchedAlias: string): CatalogueEntityMatch => ({ ...entity, confidence, method: "SEMANTIC_ENTITY", matchedAlias });
  if (kit.id === "KIT_INFLAMMATION_PHENOTYPE" && (has("inflammation") || has("inflammatory")) && (has("phenotype") || has("kit"))) return pick(0.92, "inflammation semantic family");
  if (kit.id === "KIT_TE_GOLD" && has("te") && (has("gold") || has("kit"))) return pick(0.91, "te gold semantic family");
  if (kit.id === "KIT_GI_HEALTH_GOLD" && has("gi") && (has("gold") || has("health") || has("kit"))) return pick(0.91, "gi gold semantic family");
  if (kit.id === "KIT_PRO_IMMUNE_GOLD" && (has("proimmune") || (has("immune") && (has("gold") || has("pro") || has("kit"))))) return pick(0.91, "pro immune semantic family");
  if (kit.id === "KIT_PRO_FACT_META_B_IR5" && ((has("meta") && has("ir") && has("5")) || has("metabir5"))) return pick(0.95, "meta b ir 5 semantic family");
  if (kit.id === "KIT_PRO_FACT_META_B_PCOS" && has("meta") && has("pcos")) return pick(0.94, "meta b pcos semantic family");
  if (kit.id === "KIT_PRO_FACT_META_B_THYROID" && has("meta") && (has("thyroid") || has("hypothyroid"))) return pick(0.94, "meta b thyroid semantic family");
  if (kit.id === "KIT_PRO_FACT_META_B_MENOPAUSE" && has("meta") && (has("menopause") || has("post"))) return pick(0.94, "meta b menopause semantic family");
  if (kit.id === "KIT_PRO_FACT_META_B" && ((has("meta") && has("b")) || has("metab")) && !has("pcos") && !has("thyroid") && !has("hypothyroid") && !has("menopause") && !has("ir")) return pick(0.94, "meta b base semantic family");
  return undefined;
}

export function findCatalogueEntityMatches(query: string, limit = 4): CatalogueEntityMatch[] {
  const normalized = normalizeEntityName(query);
  const normalizedTokens = tokenSet(normalized);
  const words = normalized.split(" ").filter(Boolean);
  const windows = words.length <= 8 ? phraseWindows(words) : [];
  const candidates: CatalogueEntityMatch[] = [];
  const add = (entity: Entity, canonicalName: string, aliases: string[]) => {
    const allAliases = dedupe([canonicalName, ...aliases]);
    for (const alias of allAliases) {
      const key = normalizeEntityName(alias);
      if (!key) continue;
      const keyTokens = tokenSet(key);
      if (normalized === key && normalizeEntityName(canonicalName) === key) candidates.push({ ...entity, confidence: 1, method: "CANONICAL_NAME", matchedAlias: alias });
      else if (normalized === key || ` ${normalized} `.includes(` ${key} `)) candidates.push({ ...entity, confidence: 0.97, method: "EXACT_ALIAS", matchedAlias: alias });
      else {
        const shared = overlap(normalizedTokens, keyTokens);
        const tokenConfidence = shared / Math.max(keyTokens.size, 1);
        if (keyTokens.size >= 2 && tokenConfidence >= 0.75) candidates.push({ ...entity, confidence: Math.min(0.92, 0.72 + tokenConfidence * 0.2), method: "NORMALIZED_TOKEN", matchedAlias: alias });
        if (windows.length && key.length >= 5) {
          const bestDistance = windows.reduce((best, phrase) => Math.min(best, levenshtein(phrase, key)), Number.POSITIVE_INFINITY);
          const fuzzyConfidence = 1 - bestDistance / Math.max(key.length, 1);
          if (fuzzyConfidence >= 0.78) candidates.push({ ...entity, confidence: Math.min(0.89, fuzzyConfidence), method: "FUZZY_ALIAS", matchedAlias: alias });
        }
      }
    }
    const semantic = semanticConfidence(normalized, entity);
    if (semantic) candidates.push(semantic);
  };
  for (const kit of FULL_CATALOGUE.kits) add({ type: "KIT", value: kit }, kit.name, [kit.id, ...kit.aliases]);
  for (const kit of VIRTUAL_KIT_REGISTRATIONS) add({ type: "KIT", value: kit }, kit.name, [kit.id, ...kit.aliases]);
  for (const product of FULL_CATALOGUE.products) add({ type: "PRODUCT", value: product }, product.name, [product.id, ...product.aliases]);
  return candidates
    .sort((a, b) => b.confidence - a.confidence || normalizeEntityName(b.matchedAlias).length - normalizeEntityName(a.matchedAlias).length)
    .filter((item, index, all) => all.findIndex((x) => x.type === item.type && x.value.id === item.value.id) === index)
    .slice(0, limit);
}

export function findCatalogueEntities(query: string, limit = 4): Entity[] {
  return findCatalogueEntityMatches(query, limit).map(({ confidence: _confidence, method: _method, matchedAlias: _matchedAlias, ...entity }) => entity);
}

export function findCatalogueKit(input: string): FullCatalogueKit | undefined {
  return findCatalogueEntityMatches(input, 8).find((entity): entity is Extract<CatalogueEntityMatch, { type: "KIT" }> => entity.type === "KIT")?.value;
}

export function findCatalogueProduct(input: string): FullCatalogueProduct | undefined {
  return findCatalogueEntityMatches(input, 8).find((entity): entity is Extract<CatalogueEntityMatch, { type: "PRODUCT" }> => entity.type === "PRODUCT")?.value;
}