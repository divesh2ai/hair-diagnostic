// Placeholder retail prices per kit (INR). Sourced from ops price sheet for
// revenue-estimate tiles only — NOT the source of truth for actual invoicing,
// which is owned by the Instamojo/SKU integration when it lands. Update this
// map when the price sheet changes.

export const KIT_PRICE_INR: Record<string, number> = {
  MPHL: 6500,
  FPHL: 6500,
  META_B: 5800,
  META_B_HYPOTHYROID: 6200,
  META_B_HYPOTHYROID_VEG: 6200,
  PCOS: 6400,
  PERI_MENOPAUSE: 6400,
  PERI_MENOPAUSE_VEG: 6400,
  POST_MENOPAUSE: 6400,
  POST_MENOPAUSE_VEG: 6400,
  TE_GOLD: 5900,
  TE_GOLD_VEG: 5900,
  IRON_UP_GOLD: 5200,
  IRON_UP_1: 5200,
  IRON_UP_4_VEG: 5200,
  GI_GOLD: 5500,
  PHENOTYPE_INFLAMMATION: 5500,
  OXIDATIVE_STRESS: 5100,
  RWL_SHIELD: 5400,
  ALOPECIA_AREATA: 6800,
  LACTIHEALTH: 5000,
  LACTIHEALTH_VEG: 5000,
  HEALTHY_9: 4800,
  HBR: 4500,
  EARLY_GREYING_CARE_GOLD: 4900,
  FH_WELL_3: 6900,
  NIGHT_SHIFT: 5200,
  FREQUENT_FLYERS: 5200,
  TTM_SUPPORT: 5300,
  PRO_IMMUNE_GOLD: 5000,
  PRO_FACT_THYROID_CARE: 5800,
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
