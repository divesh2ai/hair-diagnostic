// Retail prices per kit (INR) for the doctor-facing revenue-estimate tiles and
// the /api/kits add-list. This is still NOT the source of truth for actual
// patient invoicing — that authority is `lib/commerce/kitPricing`'s
// `APPROVED_KIT_PRICES_MINOR`, reached only through `getKitPrice`. This map
// exists so the add-list and estimate tiles can show a number for every
// offerable kit, including ones the governed table has not yet reconciled.
//
// Refreshed 2026-09-21 from the clinic's governed price sheet
// ("KIT ALTERNATE PRICE.xlsx", the same workbook behind the
// docs/kit-price-reconciliation-2026-09-08.md reconciliation). The previous
// figures here were pre-reconciliation placeholders roughly double the real
// selling price (e.g. MPHL ₹6,500 → ₹3,637), which is what the doctor add-list
// was showing as "outdated".
//
// Alignment rule used for this refresh, so a doctor never sees an add-list
// price that differs from what the patient is actually charged:
//   • Where a kit has an APPROVED_KIT_PRICES_MINOR entry, this map mirrors that
//     approved rupee value — including the two the clinic confirmed above the
//     bare sheet figure: PRO_IMMUNE_GOLD ₹2,638 (sheet ₹2,518) and
//     PRO_IMMUNE_1's canonical family. These are the approved patient charges;
//     display follows the charge, it does not revert it.
//   • Where a kit has no approved entry, this map carries the sheet MRP.
//   • Veg variants mirror their base kit (as before); the sheet prices one row
//     per product, not per veg/non-veg.
//   • OXIDATIVE_STRESS is left at its prior placeholder: it is offerable but
//     appears in neither the sheet nor the approved table, so there is no
//     authoritative figure to refresh it to and none is invented here.

// Refreshed 2026-10-14 from the clinic's approved sheet
// "Kitss alternative mrp - divesh sir (future).xlsx" (a Condition ID → Canonical
// Kit price table). Each figure is that sheet's canonical-kit price for the
// condition which selects this kit, matched to the canonical id by Condition ID
// (conditionKitRegistry) + the approved aliases in kitIdentity.ts — never by an
// approximate name. The same figures are mirrored into APPROVED_KIT_PRICES_MINOR
// so the doctor estimate equals any approved patient charge. Keys the sheet does
// not price one-per-row — veg variants and OXIDATIVE_STRESS — keep their prior
// figures (the sheet lists no veg/VEG V1/V2 rows). POST_MENOPAUSE's sheet
// "…POSTMENOPAUSE 2" alternative is deliberately NOT added as a new key.
export const KIT_PRICE_INR: Record<string, number> = {
  MPHL: 3655,
  FPHL: 3601,
  META_B: 3156,
  META_B_HYPOTHYROID: 2413,
  META_B_HYPOTHYROID_VEG: 2316, // not priced in sheet — prior figure retained
  PCOS: 3009,
  PERI_MENOPAUSE: 4238,
  PERI_MENOPAUSE_VEG: 3602, // not priced in sheet — prior figure retained
  POST_MENOPAUSE: 3347,
  POST_MENOPAUSE_VEG: 2142, // not priced in sheet — prior figure retained
  TE_GOLD: 3114,
  TE_GOLD_VEG: 3394, // not priced in sheet — prior figure retained
  IRON_UP_GOLD: 2042,
  GI_GOLD: 3655,
  PHENOTYPE_INFLAMMATION: 3493,
  OXIDATIVE_STRESS: 5100, // not in sheet or approved table — prior placeholder retained
  RWL_SHIELD: 4536,
  ALOPECIA_AREATA: 3295,
  LACTIHEALTH: 2006,
  LACTIHEALTH_VEG: 2454, // not priced in sheet — prior figure retained
  HEALTHY_9: 1351,
  HBR: 2893,
  EARLY_GREYING_CARE_GOLD: 3647,
  FH_WELL_3: 3412,
  NIGHT_SHIFT: 2608,
  FREQUENT_FLYERS: 3540,
  TTM_SUPPORT: 2942,
  PRO_IMMUNE_GOLD: 2636,
  PRO_FACT_THYROID_CARE: 1605,
};

const DEFAULT_PRICE_INR = 5500;

export function priceForKit(kitId: string): number {
  return KIT_PRICE_INR[kitId] ?? DEFAULT_PRICE_INR;
}

export function totalRevenueInr(kitIds: string[]): number {
  return kitIds.reduce((sum, k) => sum + priceForKit(k), 0);
}

export function formatInr(v: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}
