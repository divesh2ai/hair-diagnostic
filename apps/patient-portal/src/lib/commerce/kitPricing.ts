// Kit pricing authority — the difference between "a number exists" and "a
// number may be charged to a patient".
//
// ══ WHY `priceForKit` CANNOT BE USED HERE ═══════════════════════════════════
//
// `lib/pricing/kitPrices.priceForKit` is:
//
//     KIT_PRICE_INR[kitId] ?? DEFAULT_PRICE_INR   // DEFAULT_PRICE_INR = 5500
//
// It never fails. An unknown kit id is silently quoted at Rs 5,500 — a number
// that corresponds to no product and no price sheet. Two existing consumers
// (lib/admin/orders/snapshot.ts, lib/doctor/orderSummary/query.ts) already
// refuse to import it for exactly this reason and read KIT_PRICE_INR directly.
// This module takes the same position and extends it: a missing price is a
// state to be reported, never a number to be invented.
//
// ══ PRESENT IS NOT APPROVED ════════════════════════════════════════════════
//
// KIT_PRICE_INR's own header calls itself placeholder data "NOT the source of
// truth for actual invoicing". The authoritative workbook — "MRP sheet fluence
// khushal's copy.xlsx", sheet "New MRP of kits" — is cited in the repo's
// ingestion reports but is not in the repository. Until those figures are
// reconciled against it, every repository price is evidence, not authority.

import { KIT_PRICE_INR } from "@/lib/pricing/kitPrices";

/**
 * PRICE_MISSING  — no usable price exists.
 * PRICE_PRESENT  — a price exists in the repository but has NOT been
 *                  reconciled against the authoritative MRP source.
 * PRICE_APPROVED — reconciled and explicitly cleared for patient charging.
 *
 * There is no implicit conversion between PRESENT and APPROVED. The only way
 * to reach APPROVED is an entry in APPROVED_KIT_PRICES_MINOR.
 */
export type KitPriceStatus = "PRICE_MISSING" | "PRICE_PRESENT" | "PRICE_APPROVED";

export interface KitPrice {
  status: KitPriceStatus;
  /**
   * Integer minor units (paise). Null when PRICE_MISSING.
   *
   * Populated for PRICE_PRESENT too — internal reviewers need to see the
   * candidate figure — but a PRESENT amount must never reach a patient
   * charge. `canSellToPatient` is what enforces that.
   */
  amountMinor: number | null;
  currency: "INR";
  /** Where the figure came from, so a reviewer can judge it. */
  source: "APPROVED_MRP" | "REPOSITORY_PLACEHOLDER" | "NONE";
}

/** Whole rupees -> integer paise. Money is never a float in this system. */
export function rupeesToMinor(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Integer paise -> a formatted INR string, e.g. 165500 -> "₹1,655". */
export function formatInrFromMinor(amountMinor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

/**
 * Prices reconciled against the authoritative MRP workbook and cleared for
 * patient charging.
 *
 * Was deliberately empty (PRICE_APPROVED 0/30) until the governed budget
 * substitution feature reconciled the 12 canonical kits that carry an
 * approved alternative, plus their 8 approved alternatives, against
 * "KIT ALTERNATE PRICE.xlsx" (approved 2026-09-08, corrected 2026-09-09 —
 * GI_GOLD's price and the TTM_SUPPORT/STRESS_BUST_3 pair were re-verified
 * directly against the source workbook). See lib/commerce/budgetSubstitution.ts
 * for the pair mapping this pricing serves and
 * docs/kit-price-reconciliation-2026-09-08.md for the full reconciliation
 * record.
 *
 * Every OTHER kit in CANONICAL_KIT_IDS remains unpriced here on purpose —
 * populating this map is the output of a reconciliation gate, not a routine
 * code change, and only the kits actually reconciled above were touched.
 */
export const APPROVED_KIT_PRICES_MINOR: Readonly<Record<string, number>> =
  Object.freeze({
    // ── Refreshed 2026-10-14 from the approved sheet ─────────────────────────
    // "Kitss alternative mrp - divesh sir (future).xlsx" (Condition ID →
    // Canonical Kit + Alternative Kit price table). Every figure below is the
    // sheet's price for that kit, matched to the canonical id by Condition ID
    // (conditionKitRegistry) and the approved aliases in kitIdentity.ts — never
    // by an approximate name. Kept aligned with KIT_PRICE_INR so the doctor
    // estimate equals the approved charge. Keys the sheet does not price
    // (PRO_IMMUNE_5_VEG and the veg variants) keep their prior approved figure;
    // the sheet's "…POSTMENOPAUSE 2" alternative is deliberately not added.
    // Purchasing is disabled at launch (commerce/purchasingGate), so these
    // govern display parity and any FUTURE charge, not a live charge today.
    // ── Canonical kits that carry an approved budget alternative ──────────
    PHENOTYPE_INFLAMMATION: rupeesToMinor(3493),
    MPHL: rupeesToMinor(3655),
    FPHL: rupeesToMinor(3601),
    META_B_HYPOTHYROID: rupeesToMinor(2413),
    // The veg variant was omitted here though its non-veg sibling is approved
    // and every other veg variant below carries its prior approved figure (see
    // the "veg variants keep their prior approved figure" note above). Without
    // it, a vegetarian hypothyroid order could not be totalled ("Pricing
    // requires confirmation"). 2316 = its KIT_PRICE_INR figure, same retained
    // treatment as the other veg variants. Purchasing stays disabled.
    META_B_HYPOTHYROID_VEG: rupeesToMinor(2316), // not priced in sheet — prior approved figure retained
    TE_GOLD: rupeesToMinor(3114),
    IRON_UP_GOLD: rupeesToMinor(2042),
    GI_GOLD: rupeesToMinor(3655),
    PRO_IMMUNE_GOLD: rupeesToMinor(2636),
    RWL_SHIELD: rupeesToMinor(4536),
    NIGHT_SHIFT: rupeesToMinor(2608),
    FREQUENT_FLYERS: rupeesToMinor(3540),
    TTM_SUPPORT: rupeesToMinor(2942),
    // ── Governed budget alternatives ───────────────────────────────────────
    PRO_IMMUNE_1: rupeesToMinor(2145),
    M4_PLUS: rupeesToMinor(1695),
    F4_PLUS: rupeesToMinor(1677),
    HYPOTHYROID_2: rupeesToMinor(1844),
    SHED_CONTROL: rupeesToMinor(1552),
    // IRON_UP_1 removed from the active catalogue 2026-10-14 (final pricing
    // decision). IRON_UP_GOLD stays approved at ₹2,042 with no alternative.
    GI_HEALTH_1: rupeesToMinor(2021),
    STRESS_BUST_3: rupeesToMinor(1558),
    META_B: rupeesToMinor(3156),
    PRO_IMMUNE_5_VEG: rupeesToMinor(2692), // not priced in sheet — prior approved figure retained
    FH_WELL_3: rupeesToMinor(3412),
    PCOS: rupeesToMinor(3009),
    HBR: rupeesToMinor(2893),
    PERI_MENOPAUSE: rupeesToMinor(4238),
    PERI_MENOPAUSE_VEG: rupeesToMinor(3602), // not priced in sheet — prior approved figure retained
    TE_GOLD_VEG: rupeesToMinor(3394), // not priced in sheet — prior approved figure retained
    LACTIHEALTH: rupeesToMinor(2006),
    LACTIHEALTH_VEG: rupeesToMinor(2454), // not priced in sheet — prior approved figure retained
  });

/**
 * The price state of a canonical kit. Takes a CANONICAL kit id — resolve
 * identity first, because pricing an unresolved identifier is meaningless.
 */
export function getKitPrice(canonicalKitId: string): KitPrice {
  const approved = APPROVED_KIT_PRICES_MINOR[canonicalKitId];
  if (approved !== undefined) {
    return {
      status: "PRICE_APPROVED",
      amountMinor: approved,
      currency: "INR",
      source: "APPROVED_MRP",
    };
  }

  // hasOwnProperty, not `?? default` — the whole point is that absence stays
  // absent instead of becoming Rs 5,500.
  if (Object.prototype.hasOwnProperty.call(KIT_PRICE_INR, canonicalKitId)) {
    return {
      status: "PRICE_PRESENT",
      amountMinor: rupeesToMinor(KIT_PRICE_INR[canonicalKitId]!),
      currency: "INR",
      source: "REPOSITORY_PLACEHOLDER",
    };
  }

  return {
    status: "PRICE_MISSING",
    amountMinor: null,
    currency: "INR",
    source: "NONE",
  };
}
