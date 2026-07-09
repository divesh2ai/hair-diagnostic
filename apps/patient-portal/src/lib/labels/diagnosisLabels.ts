// Diagnosis code → clinician-readable label.
//
// The engine emits enum keys such as AGA_MALE_45 and TE_STRESS. Those are
// fine for logs and analytics but should never reach a doctor's queue row.
// This map is intentionally the single UI-side authority; changes to engine
// keys must be reflected here (a compile check would be better long-term but
// requires exporting the DiagnosisKey union to the app package).

const DIAGNOSIS_LABEL: Record<string, string> = {
  AGA_MALE_123: "Male pattern hair loss · early stage",
  AGA_MALE_45: "Male pattern hair loss · advanced",
  AGA_FEMALE_123: "Female pattern hair loss · early stage",
  AGA_FEMALE_45: "Female pattern hair loss · advanced",
  TE_STRESS: "Telogen effluvium · stress-related",
  TE_NUTRITION: "Telogen effluvium · nutritional",
  TE_POSTPREG: "Telogen effluvium · post-pregnancy",
  TE_DELIVERY: "Telogen effluvium · post-delivery",
  TE_ILLNESS: "Telogen effluvium · post-illness",
  THYROID_HYPO: "Hypothyroid-associated hair loss",
  THYROID_HYPER: "Hyperthyroid-associated hair loss",
  PCOS_ONLY: "PCOS-associated hair loss",
  PCOS_OBESITY: "PCOS with metabolic factors",
  PERI_MENOPAUSE: "Peri-menopausal hair loss",
  MENOPAUSE: "Menopause-associated hair loss",
  POST_MENOPAUSE: "Post-menopausal hair loss",
  IRON_DEFICIENCY: "Iron-deficiency hair loss",
  ALOPECIA_AREATA: "Patchy hair loss · autoimmune pattern",
  PREGNANCY: "Pregnancy-related hair changes",
  WEIGHT_LOSS: "Weight-loss-related hair fall",
  GUT_ISSUES: "Gut-absorption-related hair fall",
  SCALP_INFLAM: "Inflammatory scalp condition",
  HAIR_BREAKAGE: "Hair breakage · shaft damage",
  OXIDATIVE: "Oxidative-stress hair loss",
  NIGHT_SHIFT: "Circadian-disruption hair fall",
  FREQUENT_FLYING: "Travel-stress hair fall",
  DIABETES: "Diabetes-associated hair loss",
  CHRONIC_MEDICAL: "Chronic-condition-related hair loss",
  TTM: "Trichotillomania",
  ENDOMETRIOSIS: "Endometriosis-related hair loss",
  EARLY_GREY: "Premature greying",
  MOUTH_ULCERS: "Systemic inflammation indicators",
  MULTI: "Multifactorial hair loss",
  REGROW_ONLY: "Regrowth support",
};

// Return a human label. Falls back to a titlecased form of the code so a
// missing entry does not render as a raw enum in production.
export function labelForDiagnosis(code: string | null | undefined): string {
  if (!code) return "Assessment in progress";
  const known = DIAGNOSIS_LABEL[code.toUpperCase()];
  if (known) return known;
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
