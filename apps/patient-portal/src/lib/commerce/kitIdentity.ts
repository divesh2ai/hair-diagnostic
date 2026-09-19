// Kit identity — the deterministic, explicit mapping from a raw clinical
// identifier to a canonical commercial kit.
//
// ══ WHY THIS EXISTS SEPARATELY FROM `getKitInfo` ════════════════════════════
//
// `getKitInfo` (packages/registries/kits/info) normalises its argument before
// looking it up: it uppercases, collapses every non-alphanumeric run to "_",
// and consults a variant/alias index. That is correct for RENDERING clinical
// content — a report should still find the right prose when the id arrives
// punctuated differently.
//
// It is NOT safe for deciding what to sell someone. Today:
//
//   getKitInfo("PRO FACT META B PCOS") -> "PRO FACT META B - PCOS 6 (veg)"
//
// The registry resolves that identifier to the vegetarian PCOS kit. Nobody has
// confirmed the prescription meant the vegetarian variant, and the commercial
// review deliberately left it UNRESOLVED. Selling against that answer would be
// substituting a product on the strength of a normalisation rule.
//
// So identity for COMMERCIAL purposes is decided here, from explicit tables
// only. No normalisation-based fallback, no similarity, no "closest match".
// An identifier is resolved because someone approved it, or it is not resolved.

/**
 * RESOLVED   — deterministically mapped to a canonical catalogue kit.
 * UNRESOLVED — the identifier exists but requires human identity review.
 * MISSING    — maps to a canonical kit that is not a sellable catalogue entry.
 */
export type KitIdentityStatus = "RESOLVED" | "UNRESOLVED" | "MISSING";

export type KitResolutionMethod =
  | "EXACT_CANONICAL"
  | "APPROVED_ALIAS"
  | "NONE";

export interface KitIdentity {
  /**
   * The identifier exactly as the clinical system supplied it. Never
   * overwritten with the canonical form — historical evidence outranks
   * tidiness, and a mis-approved alias is only discoverable if this survives.
   */
  sourceIdentifierSnapshot: string;
  status: KitIdentityStatus;
  /** Null unless status is RESOLVED or MISSING. */
  canonicalKitId: string | null;
  resolutionMethod: KitResolutionMethod;
}

/**
 * The canonical commercial catalogue: the 30 entry keys of the kit information
 * registry, whose header names `All Kits Info.docx` (authored by the
 * dermatology team) as its source.
 *
 * Listed explicitly rather than derived at runtime so that adding a kit to the
 * clinical registry cannot silently make it sellable.
 */
export const CANONICAL_KIT_IDS = Object.freeze([
  "ALOPECIA_AREATA",
  "EARLY_GREYING_CARE_GOLD",
  "FH_WELL_3",
  "FPHL",
  "FREQUENT_FLYERS",
  "GI_GOLD",
  "HBR",
  "HEALTHY_9",
  "IRON_UP_GOLD",
  "LACTIHEALTH",
  "LACTIHEALTH_VEG",
  "META_B",
  "META_B_HYPOTHYROID",
  "META_B_HYPOTHYROID_VEG",
  "MPHL",
  "NIGHT_SHIFT",
  "OXIDATIVE_STRESS",
  "PCOS",
  "PERI_MENOPAUSE",
  "PERI_MENOPAUSE_VEG",
  "PHENOTYPE_INFLAMMATION",
  "POST_HYSTERECTOMY_RESET",
  "POST_MENOPAUSE",
  "POST_MENOPAUSE_VEG",
  "PRO_FACT_THYROID_CARE",
  "PRO_IMMUNE_GOLD",
  "RWL_SHIELD",
  "TE_GOLD",
  "TE_GOLD_VEG",
  "TTM_SUPPORT",
  // Governed budget alternatives (approved 2026-09-08, "KIT ALTERNATE
  // PRICE.xlsx") — see lib/commerce/budgetSubstitution.ts for which canonical
  // kit(s) each one is an approved replacement for. Real, sellable SKUs of
  // their own, distinct from any similarly-named existing entry above (e.g.
  // GI_HEALTH_1 is NOT GI_GOLD, PRO_IMMUNE_1 is NOT PRO_IMMUNE_GOLD) — no
  // fuzzy or normalisation-based identity is used for these ids.
  "PRO_IMMUNE_1",
  "M4_PLUS",
  "F4_PLUS",
  "HYPOTHYROID_2",
  "SHED_CONTROL",
  "IRON_UP_1",
  "GI_HEALTH_1",
  "STRESS_BUST_3",
  // "Pro Immune 5" veg variant — approved 2026-09-19, doctor-confirmed
  // (drfact-mumbai): the raw prescribed identifier "PRO IMMUNE VEG" names
  // this product, not PRO_IMMUNE_GOLD or PRO_IMMUNE_1 (both of which are
  // separate, already-canonical SKUs). See APPROVED_KIT_ALIASES below and
  // APPROVED_KIT_PRICES_MINOR in kitPricing.ts for its price.
  "PRO_IMMUNE_5_VEG",
] as const);

export type CanonicalKitId = (typeof CANONICAL_KIT_IDS)[number];

const CANONICAL = new Set<string>(CANONICAL_KIT_IDS);

/**
 * Canonical kits that exist in the reference catalogue but are NOT offerable.
 *
 * POST_HYSTERECTOMY_RESET has no price anywhere in the repository, and the
 * orderable catalogue `/api/kits` serves is keyed off the price table — so it
 * has never been listed. Recording it here makes that an explicit state
 * (MISSING) rather than an accident of a missing map entry.
 */
export const NON_SELLABLE_CANONICAL_KITS = Object.freeze(
  new Set<string>(["POST_HYSTERECTOMY_RESET"]),
);

/**
 * Aliases a human has approved, keyed by the raw identifier exactly as stored.
 *
 * `PHENOTYPE INFLAMATION` is the legacy spelling (a single missing "M") of
 * `PHENOTYPE_INFLAMMATION`, confirmed 2026-09-03.
 *
 * Eight entries were added 2026-09-08, and a ninth ("HAIR FACT TTM (OCD)")
 * on 2026-09-09 once the governance sheet's price for its alternative was
 * re-verified as present (not empty, as the 2026-09-08 pass had read it) —
 * all as a prerequisite for the governed budget-substitution feature
 * (lib/commerce/budgetSubstitution.ts):
 * that feature needs to recognise the CANONICAL side of each approved pair,
 * and `src/packages/ai-engine/kit-scorer` — the engine every current and
 * historical consultation's `kitPhases[].kitId` actually comes from (see
 * e.g. `resolveKit.ts`, `buildKitSequence.ts`, `protocolSequencer.ts`) —
 * emits the long clinical spelling for every compound kit name, not the
 * short canonical key. `MPHL` / `FPHL` need no alias because the engine
 * already emits those bare.
 *
 * Each spelling below is the LITERAL `KitId` string constant read directly
 * from the kit-scorer source (not inferred, not normalised), and each
 * already carries an identical, unambiguous entry in
 * `src/packages/registries/kits/info.ts`'s `KIT_ID_TO_ENTRY` — the same
 * table the clinical report has used to render these exact spellings under
 * these exact canonical kits all along. None of the eight carries the
 * PRO-FACT-META-B-PCOS-shaped risk (a spelling whose normalised form could
 * silently resolve to the wrong SKU variant): every one of them names
 * exactly one product, with its veg/plus variant kept as a visibly distinct
 * KitId string.
 *
 * Adding to this map is a commercial decision, not a routine code change: an
 * entry here lets the system sell a product against an identifier that does
 * not name it verbatim. Anything not listed stays UNRESOLVED.
 */
export const APPROVED_KIT_ALIASES: Readonly<Record<string, CanonicalKitId>> =
  Object.freeze({
    "PHENOTYPE INFLAMATION": "PHENOTYPE_INFLAMMATION",
    "HAIR FACT TE GOLD": "TE_GOLD",
    "IRON UP GOLD": "IRON_UP_GOLD",
    "PRO FACT GI GOLD": "GI_GOLD",
    "PRO IMMUNE GOLD": "PRO_IMMUNE_GOLD",
    "RAPID WEIGHT LOSS SHIELD": "RWL_SHIELD",
    "HAIR FACT NIGHT SHIFT": "NIGHT_SHIFT",
    "HAIR FACT FREQUENT FLYERS": "FREQUENT_FLYERS",
    "PRO FACT META B HYPOTHYROID": "META_B_HYPOTHYROID",
    "HAIR FACT TTM (OCD)": "TTM_SUPPORT",
    // Approved 2026-09-19, doctor-confirmed (drfact-mumbai) — see the
    // CANONICAL_KIT_IDS comment above for PRO_IMMUNE_5_VEG.
    "PRO FACT META B": "META_B",
    "PRO IMMUNE VEG": "PRO_IMMUNE_5_VEG",
  });

/**
 * Identifiers explicitly withheld from resolution pending commercial review.
 *
 * This is defence in depth, not redundancy. `PRO FACT META B PCOS` would be
 * resolved by the clinical registry's normaliser (see the file header), so
 * listing it here guarantees that a future refactor which reaches for
 * `getKitInfo` cannot quietly re-enable the substitution.
 */
export const IDENTIFIERS_REQUIRING_REVIEW = Object.freeze(
  new Set<string>(["PRO FACT META B PCOS"]),
);

/**
 * Resolve a raw clinical identifier to a canonical commercial kit.
 *
 * Exact lookups only, in a fixed order. There is deliberately no fallback that
 * inspects the shape of an unknown identifier.
 */
export function resolveKitIdentity(rawIdentifier: string): KitIdentity {
  const source = rawIdentifier;
  const trimmed = rawIdentifier.trim();

  const unresolved = (): KitIdentity => ({
    sourceIdentifierSnapshot: source,
    status: "UNRESOLVED",
    canonicalKitId: null,
    resolutionMethod: "NONE",
  });

  // Held for review outranks every other rule, including an exact match.
  if (IDENTIFIERS_REQUIRING_REVIEW.has(trimmed)) return unresolved();

  let canonicalKitId: string | null = null;
  let resolutionMethod: KitResolutionMethod = "NONE";

  if (CANONICAL.has(trimmed)) {
    canonicalKitId = trimmed;
    resolutionMethod = "EXACT_CANONICAL";
  } else if (Object.prototype.hasOwnProperty.call(APPROVED_KIT_ALIASES, trimmed)) {
    canonicalKitId = APPROVED_KIT_ALIASES[trimmed];
    resolutionMethod = "APPROVED_ALIAS";
  } else {
    return unresolved();
  }

  // Resolved to a real kit that is nonetheless not offerable.
  if (NON_SELLABLE_CANONICAL_KITS.has(canonicalKitId)) {
    return {
      sourceIdentifierSnapshot: source,
      status: "MISSING",
      canonicalKitId,
      resolutionMethod,
    };
  }

  return {
    sourceIdentifierSnapshot: source,
    status: "RESOLVED",
    canonicalKitId,
    resolutionMethod,
  };
}
