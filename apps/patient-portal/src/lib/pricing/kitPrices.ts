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

export const KIT_PRICE_INR: Record<string, number> = {
  MPHL: 3637,
  FPHL: 3583,
  META_B: 3018,
  META_B_HYPOTHYROID: 2316,
  META_B_HYPOTHYROID_VEG: 2316,
  PCOS: 2291,
  PERI_MENOPAUSE: 4196,
  PERI_MENOPAUSE_VEG: 4196,
  POST_MENOPAUSE: 2142,
  POST_MENOPAUSE_VEG: 2142,
  TE_GOLD: 2996,
  TE_GOLD_VEG: 2996,
  // IRON_UP_1 and IRON_UP_4_VEG were removed: both are superseded by
  // IRON_UP_GOLD ("PRO FACT IRON UP"). Neither resolved to a documented kit,
  // so the lineup editor listed them by their raw id — a doctor picking from
  // that dropdown saw three Iron Up entries, two of them internal codes for a
  // product that no longer ships.
  IRON_UP_GOLD: 2527,
  GI_GOLD: 3455,
  PHENOTYPE_INFLAMMATION: 3410,
  // No sheet or approved figure — prior placeholder retained on purpose.
  OXIDATIVE_STRESS: 5100,
  RWL_SHIELD: 4402,
  ALOPECIA_AREATA: 3054,
  LACTIHEALTH: 1956,
  LACTIHEALTH_VEG: 1956,
  HEALTHY_9: 1292,
  HBR: 2854,
  EARLY_GREYING_CARE_GOLD: 3459,
  FH_WELL_3: 3394,
  NIGHT_SHIFT: 2518,
  FREQUENT_FLYERS: 3429,
  TTM_SUPPORT: 2858,
  // ₹2,638 approved (docs/kit-price-reconciliation), above the sheet's ₹2,518.
  PRO_IMMUNE_GOLD: 2638,
  PRO_FACT_THYROID_CARE: 1518,
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
