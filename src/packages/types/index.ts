// ─────────────────────────────────────────────────────────────────────────────
// HairOS Shared Types
// Single source of truth for all domain types used across engine layers.
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientAnswers {
  name?: string;
  sex: string;
  gender?: string;           // alias accepted by contraindication engine
  age: string | number;
  goal: string | string[];
  duration?: string;
  count?: string;
  grade?: string;
  hairtype?: string[];
  scalp?: string[];
  cause?: string[];
  immunity?: string[];
  thyroid?: string | string[];
  hormonal?: string[];
  hormonal_issues?: string[]; // alias accepted by contraindication engine
  gut?: string[];
  deficiency?: string[];
  diet?: string[];
  lifestyle?: string[];
  treatment?: string[];
  medical?: string;
  medical_detail?: string;
  // Structured flags used by contraindication engine
  is_pregnant?: boolean;
  planning_pregnancy?: boolean;
  hasHypertension?: boolean;
}

export type DiagnosisKey =
  | 'AGA_MALE_123' | 'AGA_MALE_45'
  | 'AGA_FEMALE_123' | 'AGA_FEMALE_45'
  | 'TE_STRESS' | 'TE_NUTRITION' | 'TE_POSTPREG' | 'TE_DELIVERY' | 'TE_ILLNESS'
  | 'THYROID_HYPO' | 'THYROID_HYPER'
  | 'PCOS_ONLY' | 'PCOS_OBESITY'
  | 'PERI_MENOPAUSE' | 'MENOPAUSE' | 'POST_MENOPAUSE'
  | 'IRON_DEFICIENCY' | 'ALOPECIA_AREATA' | 'PREGNANCY'
  | 'WEIGHT_LOSS' | 'GUT_ISSUES' | 'SCALP_INFLAM' | 'HAIR_BREAKAGE'
  | 'OXIDATIVE' | 'NIGHT_SHIFT' | 'FREQUENT_FLYING' | 'DIABETES'
  | 'CHRONIC_MEDICAL' | 'TTM' | 'ENDOMETRIOSIS' | 'EARLY_GREY'
  | 'MOUTH_ULCERS' | 'MULTI' | 'REGROW_ONLY';

export type ScalpState =
  | 'OILY_SCALP' | 'DRY_SCALP' | 'DANDRUFF' | 'INFLAMED_SCALP'
  | 'PSORIATIC_SCALP' | 'SENSITIVE_SCALP' | 'NORMAL_SCALP';

export type RootCause =
  | 'STRESS' | 'DHT' | 'GENETICS' | 'IRON_DEFICIENCY' | 'HYPOTHYROID'
  | 'HYPERTHYROID' | 'PCOS' | 'METABOLIC' | 'POOR_NUTRITION'
  | 'POST_PARTUM' | 'GUT_MALABSORPTION' | 'OXIDATIVE_STRESS'
  | 'MEDICATION' | 'ILLNESS' | 'RAPID_WEIGHT_LOSS' | 'AUTOIMMUNE'
  | 'CIRCADIAN_DISRUPTION' | 'TRICHOTILLOMANIA' | 'HORMONAL_SHIFT';

export type TherapyNeed =
  | 'DHT_SUPPRESSION'
  | 'INFLAMMATION_CONTROL'
  | 'FOLLICLE_STIMULATION'
  | 'METABOLIC_SUPPORT'
  | 'IMMUNE_MODULATION'
  | 'IRON_REPLETION'
  | 'HORMONAL_REBALANCING'
  | 'ANTIOXIDANT_SUPPORT'
  | 'GUT_RESTORATION'
  | 'THYROID_SUPPORT'
  | 'CIRCADIAN_RESET'
  | 'SHAFT_REPAIR'
  | 'SHEDDING_ARREST'
  | 'LACTATION_SUPPORT'
  | 'MELANOCYTE_PROTECTION'
  | 'ANDROGENIC_CORRECTION'
  | 'NEUROLOGICAL_OCD_SUPPORT'
  | 'WEIGHT_LOSS_RECOVERY'
  | 'PREGNANCY_SUPPORT';

export type Severity = 'MILD' | 'MODERATE' | 'SEVERE';

export type KitId = string;
