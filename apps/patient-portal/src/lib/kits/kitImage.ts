// THE product-image resolver. One module, one answer, every surface.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Product imagery was resolved in two places that only one caller ever used
// together: `lib/reports/one-page/productAssets` held the filename registry,
// and `lib/reports/one-page/viewModel` held a second, private layer of code
// aliasing (`kitAssetCode` / `topicalAssetCode`) that turned a runtime kit id
// into a registry key. Anything outside the one-pager that wanted a packshot
// got the registry without the aliasing, which resolves a minority of real kit
// ids and silently returns null for the rest. So the doctor review page — the
// screen where a clinician authorises the order — showed kit NAMES and no
// images at all.
//
// This module owns both halves. `productAssets` keeps the filenames (it is the
// asset manifest, and the PDF renderer reads it directly); the mapping from a
// runtime id to one of those assets lives here, once.
//
// ── The category rule ───────────────────────────────────────────────────────
// A kit and a topical are different things and must never borrow each other's
// artwork. A kit is a systemic protocol carton; a topical is a bottle or tube
// the patient applies. Printing a scalp-solution bottle beside an oral kit
// misrepresents the prescription, and that is not a cosmetic defect.
//
// So the two lookups are separate functions with separate registries, every
// resolution is tagged with the category it came from, and the resolver never
// falls back across the boundary. `resolveProductImage` exists for callers
// that genuinely hold a mixed list, and it takes the category as an argument
// rather than guessing at it.
//
// ── No fuzzy matching on unknown input ──────────────────────────────────────
// The alias tables below are explicit and ordered: the most specific pattern
// wins, and an id that matches nothing resolves to null rather than to
// "something that looked close". A missing image renders as a labelled
// placeholder, which is honest; the wrong image is a clinical error.

import {
  KIT_ASSET_REGISTRY,
  TOPICAL_ASSET_REGISTRY,
  type ProductAsset,
} from "@/lib/reports/one-page/productAssets";

export type ProductCategory = "kit" | "topical";

export interface ResolvedProductImage {
  /** Registry key the id resolved to — stable, and useful in tests and logs. */
  code: string;
  /** Public path under /public. Always an existing file; see the asset test. */
  src: string;
  /** Descriptive alt text from the manifest. */
  alt: string;
  /** Which registry answered. Never inferred, never crossed. */
  category: ProductCategory;
}

/** Collapse whitespace and strip the noise real product strings carry. */
function clean(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[‐-―]/g, "-")
    .trim()
    .toUpperCase();
}

/**
 * Punctuation-insensitive registry key form.
 *
 * "PRO FACT META B", "pro-fact-meta-b" and "PRO_FACT_META_B" are the same
 * product written by three different producers; only the spelling differs.
 */
function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/gi, "")
    .toUpperCase();
}

// ── Kit aliases ─────────────────────────────────────────────────────────────
//
// Runtime kit ids are the long product spellings the recommendations artifact
// emits ("HAIR FACT TE GOLD", "F-PCOS -1"), and KitOrderIntent snapshots
// sometimes carry the registry's short canonical key instead ("META_B"). Both
// forms have to land on the same asset.
//
// Order matters: every VEG / PLUS / qualified variant is tested before its
// base, because the base pattern is a substring of the variant.
const KIT_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/IRON UP.*VEG/, "IRON_UP_GOLD_VEG"],
  [/IRON UP/, "IRON_UP_GOLD"],
  [/TE GOLD.*VEG/, "HAIR_FACT_TE_GOLD_VEG"],
  [/TE GOLD/, "HAIR_FACT_TE_GOLD"],
  [/PRO IMMUNE.*PLUS/, "PRO_IMMUNE_GOLD_PLUS"],
  [/PRO IMMUNE.*VEG/, "PRO_IMMUNE_VEG"],
  [/PRO IMMUNE/, "PRO_IMMUNE_GOLD"],
  [/PHENOTYPE.*INFLAM/, "PHENOTYPE_INFLAMMATION"],
  [/META[-\s_]?B.*HYPOTHYROID.*VEG/, "PRO_FACT_META_B_HYPOTHYROID_VEG"],
  [/META[-\s_]?B.*HYPOTHYROID/, "PRO_FACT_META_B_HYPOTHYROID"],
  [/META[-\s_]?B.*PCOS/, "PRO_FACT_META_B_PCOS"],
  [/META[-\s_]?B.*POST/, "PRO_FACT_META_B_POSTMENOPAUSE"],
  [/META[-\s_]?B/, "PRO_FACT_META_B"],
  [/RAPID WEIGHT|RWL/, "RAPID_WEIGHT_LOSS_SHIELD"],
  [/F[-\s_]?PCOS.*VEG/, "F_PCOS_VEG_1"],
  [/F[-\s_]?PCOS/, "F_PCOS_1"],
  [/FPHL.*PLUS/, "FPHL_PLUS"],
  // Registry keys are the short codes (FPHL / MPHL); a space-suffixed
  // "FPHL Pro" was a typo that broke asset lookup.
  [/\bFPHL\b|FEMALE PATTERN/, "FPHL"],
  [/MPHL.*PLUS/, "MPHL_PLUS"],
  [/\bMPHL\b|MALE PATTERN/, "MPHL"],
  [/ALOPECIA AREATA/, "HAIR_FACT_ALOPECIA_AREATA"],
  [/PERI[-\s_]?MENOPAUSE|MENOPAUSE/, "HAIR_FACT_PERI_MENOPAUSE"],
  [/GI GOLD/, "PRO_FACT_GI_GOLD"],
  [/THYROID CARE|THYROID/, "PRO_FACT_THYROID_CARE"],
  [/NIGHT SHIFT/, "HAIR_FACT_NIGHT_SHIFT"],
  [/FREQUENT FLY/, "HAIR_FACT_FREQUENT_FLYERS"],
  [/TTM.*OCD/, "HAIR_FACT_TTM_OCD"],
  [/\bTTM\b|TRICHOTILLOMANIA/, "TTM"],
  [/HBR.*V2|BREAKAGE REPAIR/, "HBR_V2"],
  [/\bHBR\b|BREAKAGE/, "HBR"],
  [/LACTI.*VEG/, "LACTIHEALTH_VEG"],
  [/LACTI/, "LACTIHEALTH"],
  [/EARLY GREYING|EG CARE/, "EARLY_GREYING_CARE"],
  [/POST[-\s_]?HYSTERECTOMY|HYSTERECTOMY/, "PRO_FACT_POST_HYSTERECTOMY"],
  [/HEALTHY[-\s_]?9|PREGNANCY/, "HEALTHY_9"],
  [/FH WELL|F[-\s_]?H[-\s_]?WELL/, "FH_WELL_3"],
  [/OXIDATIVE/, "OXIDATIVE_STRESS"],
];

// ── Topical aliases ─────────────────────────────────────────────────────────
//
// Same discipline, separate table. Two orderings here are load-bearing and
// must not be "tidied":
//
//   • The oral combination tablets are tested BEFORE the generic minoxidil
//     branch. "Oral Minoxidil + Spironolactone" is a systemic tablet in an
//     Oroxidil carton, not a scalp solution; matching it on the bare
//     MINOXIDIL token printed an F-Extend bottle for an oral prescription.
//     The `!TOPICAL` guard is equally load-bearing: "Minoxidil +
//     Spironolactone Topical" is a genuine compounded topical.
//
//   • Emugrow's suffix chain runs longest-first (MCRD → MC R → MCR → MC),
//     because each shorter code is a prefix of the longer ones.
const TOPICAL_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  // F-Biwash and F-Biwash Plus are ONE product — the anti-dandruff shampoo.
  // See resolveTopicalImage's note on the asset that does not exist.
  [/BIWASH|ANTI[-\s_]?DANDRUFF|SHAMPOO/, "F_BIWASH_PLUS"],
  [/EMUGROW.*MC ?R ?D|EMUGROW.*MCRD|MCRD/, "F_EMUGROW_MCRD"],
  [/EMUGROW.*MC ?R\b/, "F_EMUGROW_MC_R"],
  [/EMUGROW.*MCR/, "F_EMUGROW_MCR"],
  [/EMUGROW.*MC/, "F_EMUGROW_MC"],
  // PRO before the base: "F-Trichosure Pro" contains "TRICHOSURE", so a bare
  // TRICHOSURE rule placed first would claim the PRO carton and print the
  // 5% box for a 0.25%-finasteride prescription. Same longest-first
  // discipline as the Emugrow chain below.
  [/TRICHOSURE.*PRO/, "F_TRICHOSURE_PRO"],
  [/TRICHOSURE/, "F_TRICHOSURE"],
  [/TRICHOSILK.*FNH/, "F_TRICHOSILK_FNH"],
  [/TRICHOSILK/, "F_TRICHOSILK"],
  [/TRICHOGAIN/, "F_TRICHOGAIN"],
];

/** The oral-tablet branch, kept apart because it needs more than a regex pair. */
function resolveOralCombination(text: string): string | null {
  if (!/ORAL|OROXIDIL/.test(text) || /TOPICAL/.test(text)) return null;
  // The Oroxidil cartons encode the anti-androgen as a letter prefix
  // (F-S- = Spironolactone, F-B- = Bicalutamide) and never spell it out, so
  // match on the ingredient OR the brand code.
  const bicalutamide =
    /BICALUTAMIDE/.test(text) || /\bF\s*-?\s*B\s*-?\s*OROXIDIL/.test(text);
  if (bicalutamide) return "ORAL_MINOXIDIL_BICALUTAMIDE";
  const spironolactone =
    /SPIRONOLACTONE/.test(text) || /\bF\s*-?\s*S\s*-?\s*OROXIDIL/.test(text);
  if (spironolactone) {
    // Two strengths ship as distinct cartons; only an explicit "50" selects
    // the 1.25-50 box. The unqualified registry name is the 1.25-25.
    return /(?<![\d.])50\b/.test(text)
      ? "ORAL_MINOXIDIL_SPIRONOLACTONE_50"
      : "ORAL_MINOXIDIL_SPIRONOLACTONE";
  }
  return null;
}

/** The minoxidil-strength branch, likewise. */
function resolveMinoxidilStrength(text: string): string | null {
  if (!/MINOXIDIL|EXTEND/.test(text)) return null;
  // 1. Explicit adjacency wins (MINOXIDIL 5 / EXTEND 2).
  if (/(?:MINOXIDIL|EXTEND)\s*5/.test(text)) return "F_EXTEND_5";
  if (/(?:MINOXIDIL|EXTEND)\s*2/.test(text)) return "F_EXTEND_2";
  // 2. Whole-percentage token, excluding decimal fragments like "2.5%".
  if (/(?<![\d.])5\s*%/.test(text)) return "F_EXTEND_5";
  if (/(?<![\d.])2\s*%/.test(text)) return "F_EXTEND_2";
  // 3. Unspecified strength — the predominant recommendation.
  return "F_EXTEND_5";
}

function fromRegistry(
  registry: Record<string, ProductAsset>,
  code: string,
  category: ProductCategory,
): ResolvedProductImage | null {
  const asset = registry[code];
  if (!asset) return null;
  return { code, src: asset.src, alt: asset.alt, category };
}

/**
 * The packshot for a kit. Never returns a topical image.
 *
 * Accepts any of the spellings a kit id arrives in: the long product name
 * ("HAIR FACT TE GOLD"), the short canonical key ("META_B"), or the registry
 * key itself. Returns null when nothing matches — callers render a labelled
 * frame rather than a wrong carton.
 */
export function resolveKitImage(kitId: string | null | undefined): ResolvedProductImage | null {
  if (!kitId) return null;
  const text = clean(kitId);

  // Exact registry key first. An id that already IS a key must not be routed
  // through the alias table, where a broad pattern could re-point it.
  const direct = fromRegistry(KIT_ASSET_REGISTRY, normalizeCode(text), "kit");
  if (direct) return direct;

  for (const [pattern, code] of KIT_ALIASES) {
    if (pattern.test(text)) {
      const hit = fromRegistry(KIT_ASSET_REGISTRY, code, "kit");
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * The product image for a topical. Never returns a kit packshot.
 *
 * ── The F-Biwash asset ──────────────────────────────────────────────────────
 * The manifest carried an `F_BIWASH` entry pointing at `f_biwash.png`, which
 * does not exist on disk — the only broken reference in the whole registry.
 * The fix is NOT to rename a file: F-Biwash and F-Biwash+ are one product,
 * the anti-dandruff shampoo, and the report layer already canonicalises both
 * names to "F-Biwash Pro (Anti-Dandruff Shampoo)". So both codes resolve to
 * the packshot that exists, `f_biwashplus.png`, and the manifest entry now
 * points there too.
 */
export function resolveTopicalImage(
  productName: string | null | undefined,
): ResolvedProductImage | null {
  if (!productName) return null;
  const text = clean(productName);

  const direct = fromRegistry(TOPICAL_ASSET_REGISTRY, normalizeCode(text), "topical");
  if (direct) return direct;

  for (const [pattern, code] of TOPICAL_ALIASES) {
    if (pattern.test(text)) {
      const hit = fromRegistry(TOPICAL_ASSET_REGISTRY, code, "topical");
      if (hit) return hit;
    }
  }

  // Branches that need more than a pattern pair. Oral combinations MUST be
  // tested before minoxidil strength — see TOPICAL_ALIASES.
  const oral = resolveOralCombination(text);
  if (oral) {
    const hit = fromRegistry(TOPICAL_ASSET_REGISTRY, oral, "topical");
    if (hit) return hit;
  }
  const minoxidil = resolveMinoxidilStrength(text);
  if (minoxidil) {
    const hit = fromRegistry(TOPICAL_ASSET_REGISTRY, minoxidil, "topical");
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolve by explicit category.
 *
 * For callers holding a mixed list. The category is an argument, never a
 * guess: the whole point of this module is that a kit and a topical are
 * decided by what the record says they are, not by how their names read.
 */
export function resolveProductImage(
  id: string | null | undefined,
  category: ProductCategory,
): ResolvedProductImage | null {
  return category === "kit" ? resolveKitImage(id) : resolveTopicalImage(id);
}

/** Every registry key, for the asset-integrity test. */
export const KIT_ASSET_CODES = Object.keys(KIT_ASSET_REGISTRY);
export const TOPICAL_ASSET_CODES = Object.keys(TOPICAL_ASSET_REGISTRY);
/** Every alias target, so the test can prove no alias points at a dead key. */
export const KIT_ALIAS_TARGETS = KIT_ALIASES.map(([, code]) => code);
export const TOPICAL_ALIAS_TARGETS = TOPICAL_ALIASES.map(([, code]) => code);
export { KIT_ASSET_REGISTRY, TOPICAL_ASSET_REGISTRY };
