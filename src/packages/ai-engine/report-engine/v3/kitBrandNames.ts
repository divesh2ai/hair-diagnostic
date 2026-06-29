/**
 * Brand-name lookup for every runtime kit ID.
 *
 * The V4 ClinicalReport carries a condition-style displayName from
 * registries/kits/info.ts (e.g. "Telogen Effluvium Stabilisation",
 * "Pro-Immune Restoration"). For the patient-facing V3 report we want
 * the actual product name on the kit card.
 *
 * This map is the single source of truth for those product names.
 * Update an entry here to change how a kit is labelled in the patient
 * report — nothing else needs to change.
 *
 * Coverage: every kit ID that can appear in KitRecommendation.rankedKits
 * (sourced from kit-scorer/protocolSequencer.ts, scoreKits.ts, and
 * resolveKit.ts). Falls back to the kitId string if a kit isn't listed.
 */
export const KIT_BRAND_NAMES: Record<string, string> = {
  // ── Phase-1 shedding arrest ──────────────────────────────────────────
  "HAIR FACT TE GOLD": "Hair Fact TE Gold",
  "HAIR FACT TE GOLD VEG": "Hair Fact TE Gold (Veg)",

  // ── Inflammation / immune ────────────────────────────────────────────
  "PHENOTYPE INFLAMATION": "Phenotype Inflammation",
  "PHENOTYPE INFLAMMATION": "Phenotype Inflammation",
  "PRO IMMUNE GOLD": "Pro Immune 5V",
  "PRO IMMUNE VEG": "Pro Immune 5V (Veg)",
  "HAIR FACT ALOPECIA AREATA": "Hair Fact Alopecia Areata",

  // ── Pattern hair loss (AGA) ──────────────────────────────────────────
  MPHL: "Hair Fact MPHL",
  "MPHL PLUS": "Hair Fact MPHL Plus",
  FPHL: "Hair Fact FPHL",
  "FPHL PLUS": "Hair Fact FPHL Plus",

  // ── Metabolic / endocrine ────────────────────────────────────────────
  "PRO FACT META B": "Pro Fact Meta B",
  "PRO FACT META B VEG": "Pro Fact Meta B (Veg)",
  "PRO FACT META B PCOS": "Pro Fact Meta B PCOS",
  "PRO FACT META B HYPOTHYROID": "Pro Fact Meta B Hypothyroid",
  "PRO FACT META B MENOPAUSE": "Pro Fact Meta B Menopause",
  "PRO FACT META B POSTMENOPAUSE": "Pro Fact Meta B Post-Menopause",
  "PRO FACT THYROID CARE": "Pro Fact Thyroid Care",

  // ── Gut–hair axis ────────────────────────────────────────────────────
  "PRO FACT GI GOLD": "Pro Fact GI Gold",
  "PRO FACT GI GOLD VEG": "Pro Fact GI Gold (Veg)",

  // ── Hormonal transitions ─────────────────────────────────────────────
  "HAIR FACT PERI MENOPAUSE": "Hair Fact Peri Menopause",
  "HAIR FACT PERI MENOPAUSE VEG": "Hair Fact Peri Menopause (Veg)",
  "F-PCOS -1": "F-PCOS",
  "F-PCOS VEG -1": "F-PCOS (Veg)",
  "FH WELL 3": "FH Well 3",

  // ── Substrate / nutrition ────────────────────────────────────────────
  "IRON UP GOLD": "Iron Up Gold",
  LACTIHEALTH: "LactiHealth",
  "RAPID WEIGHT LOSS SHIELD": "Rapid Weight Loss Shield",

  // ── Lifestyle ────────────────────────────────────────────────────────
  "HAIR FACT HAIR BREAKAGE REPAIR(HBR)": "Hair Fact HBR",
  "HAIR FACT NIGHT SHIFT": "Hair Fact Night Shift",
  "HAIR FACT FREQUENT FLYERS": "Hair Fact Frequent Flyers",
  "HAIR FACT TTM (OCD)": "Hair Fact TTM (OCD)",
  "OXIDATIVE STRESS": "Hair Fact Oxidative Stress",

  // ── Greying / maintenance ────────────────────────────────────────────
  "EARLY GREYING CARE GOLD": "Early Greying Care Gold",
  "EARLY GREYING CARE VEG": "Early Greying Care (Veg)",
  "HEALTHY - 9": "Healthy 9",
};

/**
 * Resolve a runtime kit ID to its patient-facing brand name.
 * Falls back to the raw kitId when no entry exists — so a new kit added
 * to the system still renders something useful while we name it.
 */
export function brandNameFor(kitId: string): string {
  return KIT_BRAND_NAMES[kitId] ?? kitId;
}
