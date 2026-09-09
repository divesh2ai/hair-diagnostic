// Governed budget substitution — the single source of truth for which kit
// may replace which, and at what price.
//
// ══ WHY THIS EXISTS SEPARATELY ═══════════════════════════════════════════
//
// A "budget alternative" is a commercial decision (this exact product may
// stand in for that exact product, for this exact reason), not a clinical
// one and not a UI convenience. It carries the same fail-closed discipline as
// `kitIdentity.ts`: an explicit table, exact-match only, no fuzzy inference
// from name similarity, no client-submitted pair.
//
// Both the doctor UI (to decide whether to show "Budget alternative" at all,
// and what to show) and the server route that persists a substitution import
// this module. There is exactly one place the 12 approved pairs are listed.
//
// Source: "KIT ALTERNATE PRICE.xlsx" (clinic governance sheet), reconciled
// 2026-09-08 — see docs/kit-price-reconciliation-2026-09-08.md for the full
// row-by-row reconciliation. The 12th pair, HAIR FACT TTM (OCD) →
// PRO FACT STRESS BUST 3, was corrected in on 2026-09-09: the 2026-09-08 pass
// had read the alternative's price cell as empty, but a direct re-read of the
// same workbook found ₹1,457 present. No price was invented — the workbook
// was re-verified, not guessed.

import { CANONICAL_KIT_IDS, resolveKitIdentity, type CanonicalKitId } from "./kitIdentity";
import { getKitPrice } from "./kitPricing";

export type SubstitutionType = "BUDGET";
export type SubstitutionReason = "BUDGET_AFFORDABILITY";

export interface ApprovedSubstitution {
  /** The canonical kit this alternative may replace. */
  canonicalKitId: CanonicalKitId;
  /** The one approved lower-cost alternative for that canonical kit. */
  alternativeKitId: CanonicalKitId;
  /** The governance sheet's condition id, kept for traceability. */
  conditionId: string;
}

/**
 * The complete, exact-match approved pair table. Nothing outside this list
 * may be substituted for anything, regardless of how similar two kit names
 * look. Multiple canonical kits may point at the SAME alternative identity
 * (e.g. four kits all resolve to SHED_CONTROL) — that is one product sold
 * against four different clinical triggers, not four products.
 */
export const APPROVED_SUBSTITUTIONS: readonly ApprovedSubstitution[] = Object.freeze([
  { canonicalKitId: "PHENOTYPE_INFLAMMATION", alternativeKitId: "PRO_IMMUNE_1", conditionId: "SCALP_INFLAMMATION" },
  { canonicalKitId: "MPHL", alternativeKitId: "M4_PLUS", conditionId: "AGA_PATTERN_MALE" },
  { canonicalKitId: "FPHL", alternativeKitId: "F4_PLUS", conditionId: "AGA_PATTERN_FEMALE" },
  { canonicalKitId: "META_B_HYPOTHYROID", alternativeKitId: "HYPOTHYROID_2", conditionId: "HYPOTHYROID" },
  { canonicalKitId: "TE_GOLD", alternativeKitId: "SHED_CONTROL", conditionId: "ACUTE_SHEDDING" },
  { canonicalKitId: "IRON_UP_GOLD", alternativeKitId: "IRON_UP_1", conditionId: "IRON_DEFICIENCY" },
  { canonicalKitId: "GI_GOLD", alternativeKitId: "GI_HEALTH_1", conditionId: "GUT_DYSFUNCTION" },
  { canonicalKitId: "PRO_IMMUNE_GOLD", alternativeKitId: "PRO_IMMUNE_1", conditionId: "IMMUNE_DEPLETION" },
  { canonicalKitId: "RWL_SHIELD", alternativeKitId: "SHED_CONTROL", conditionId: "RAPID_WEIGHT_LOSS" },
  { canonicalKitId: "NIGHT_SHIFT", alternativeKitId: "SHED_CONTROL", conditionId: "NIGHT_SHIFT" },
  { canonicalKitId: "FREQUENT_FLYERS", alternativeKitId: "SHED_CONTROL", conditionId: "FREQUENT_FLYING" },
  { canonicalKitId: "TTM_SUPPORT", alternativeKitId: "STRESS_BUST_3", conditionId: "TRICHOTILLOMANIA" },
] as const);

const BY_CANONICAL: ReadonlyMap<string, ApprovedSubstitution> = new Map(
  APPROVED_SUBSTITUTIONS.map((s) => [s.canonicalKitId, s]),
);

/**
 * Canonical kits explicitly confirmed to have NO approved budget alternative.
 * Not consulted by any validator (absence from APPROVED_SUBSTITUTIONS is
 * already sufficient to reject a substitution) — this exists so a test can
 * assert these specific, clinically sensitive kits stay untouched by name,
 * rather than only by omission.
 */
export const PROTECTED_NO_ALTERNATIVE_KIT_IDS: readonly CanonicalKitId[] = Object.freeze([
  "META_B",
  "PCOS",
  "PRO_FACT_THYROID_CARE",
  "PERI_MENOPAUSE",
  "POST_MENOPAUSE",
  "HBR",
  "EARLY_GREYING_CARE_GOLD",
  "FH_WELL_3",
  "HEALTHY_9",
  "ALOPECIA_AREATA",
  "LACTIHEALTH",
]);

/** The one approved alternative for a canonical kit, or null if none exists. */
export function getApprovedAlternative(canonicalKitId: string): ApprovedSubstitution | null {
  return BY_CANONICAL.get(canonicalKitId) ?? null;
}

/**
 * Whether this exact (canonical, alternative) pair is the approved
 * substitution. Exact match only — the caller must not have derived either
 * id from a display name, normalisation, or guess.
 */
export function isApprovedSubstitutionPair(
  canonicalKitId: string,
  alternativeKitId: string,
): boolean {
  const approved = BY_CANONICAL.get(canonicalKitId);
  return approved !== undefined && approved.alternativeKitId === alternativeKitId;
}

// ══ RAW-KITID VARIANTS ═══════════════════════════════════════════════════
//
// A `TreatmentPhase.kitId` in a REAL, persisted consultation is not
// reliably the canonical registry key. Verified directly against a live
// staging consultation: one lineup carried `"HAIR FACT TE GOLD"` and
// `"PRO IMMUNE GOLD"` — the clinical spelling, not `"TE_GOLD"` /
// `"PRO_IMMUNE_GOLD"` — while another phase in the very same lineup carried
// the bare canonical key (`"FPHL"`). Both shapes occur in production data.
//
// `kitIdentity.ts`'s `resolveKitIdentity` already exists to answer exactly
// this question for commercial purposes (exact-match only, no fuzzy
// normalisation) — it is the SAME resolver `/api/cart` and `/api/kits` use to
// decide what a raw kitId actually names. These wrappers are what the doctor
// UI and the substitution route call, so "is there an approved alternative
// for the kit actually sitting in this phase" is answered correctly whether
// that phase's kitId happens to be canonical or not — never guessed, never
// resolved by a second, looser matching rule.
function resolveToCanonical(kitId: string): string | null {
  const identity = resolveKitIdentity(kitId);
  return identity.status === "RESOLVED" ? identity.canonicalKitId : null;
}

/** Like `getApprovedAlternative`, but accepts a raw phase kitId in either canonical or clinical-spelling form. */
export function getApprovedAlternativeForKitId(kitId: string): ApprovedSubstitution | null {
  const canonical = resolveToCanonical(kitId);
  return canonical ? getApprovedAlternative(canonical) : null;
}

/** Like `isApprovedSubstitutionPair`, but resolves the original side from a raw phase kitId first. */
export function isApprovedSubstitutionPairForKitId(
  originalKitId: string,
  alternativeKitId: string,
): boolean {
  const canonical = resolveToCanonical(originalKitId);
  return canonical !== null && isApprovedSubstitutionPair(canonical, alternativeKitId);
}

export interface SubstitutionPriceComparison {
  canonicalKitId: string;
  alternativeKitId: string;
  /** Null when either side's price is not APPROVED — the caller must not display or apply the pair in that state. */
  canonicalPriceMinor: number | null;
  alternativePriceMinor: number | null;
  savingMinor: number | null;
  /** True only when both prices are PRICE_APPROVED. A pair failing this must not be offered to a doctor. */
  bothPricesApproved: boolean;
}

/**
 * Resolve the priced comparison for an approved pair, reading prices from the
 * SAME governed source `/cart` and `/api/kits` use — never a value the caller
 * supplies. Returns null if the pair itself is not approved.
 */
export function resolveSubstitutionPriceComparison(
  canonicalKitId: string,
  alternativeKitId: string,
): SubstitutionPriceComparison | null {
  if (!isApprovedSubstitutionPair(canonicalKitId, alternativeKitId)) return null;

  const canonicalPrice = getKitPrice(canonicalKitId);
  const alternativePrice = getKitPrice(alternativeKitId);
  const bothPricesApproved =
    canonicalPrice.status === "PRICE_APPROVED" && alternativePrice.status === "PRICE_APPROVED";

  return {
    canonicalKitId,
    alternativeKitId,
    canonicalPriceMinor: canonicalPrice.status === "PRICE_APPROVED" ? canonicalPrice.amountMinor : null,
    alternativePriceMinor: alternativePrice.status === "PRICE_APPROVED" ? alternativePrice.amountMinor : null,
    savingMinor:
      bothPricesApproved && canonicalPrice.amountMinor !== null && alternativePrice.amountMinor !== null
        ? canonicalPrice.amountMinor - alternativePrice.amountMinor
        : null,
    bothPricesApproved,
  };
}

/** Like `resolveSubstitutionPriceComparison`, but resolves the original side from a raw phase kitId first. */
export function resolveSubstitutionPriceComparisonForKitId(
  originalKitId: string,
  alternativeKitId: string,
): SubstitutionPriceComparison | null {
  const canonical = resolveToCanonical(originalKitId);
  return canonical ? resolveSubstitutionPriceComparison(canonical, alternativeKitId) : null;
}

/** Sanity check: every id named in the mapping table is a real canonical kit. */
export function assertSubstitutionTableIsWellFormed(): void {
  const known = new Set<string>(CANONICAL_KIT_IDS);
  for (const s of APPROVED_SUBSTITUTIONS) {
    if (!known.has(s.canonicalKitId)) {
      throw new Error(`budgetSubstitution: canonical kit "${s.canonicalKitId}" is not in CANONICAL_KIT_IDS`);
    }
    if (!known.has(s.alternativeKitId)) {
      throw new Error(`budgetSubstitution: alternative kit "${s.alternativeKitId}" is not in CANONICAL_KIT_IDS`);
    }
  }
}
