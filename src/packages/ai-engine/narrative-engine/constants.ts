import type { DiagnosisKey, Severity, RootCause } from '../../types';
import type { TherapyNeed } from '../therapy-engine/types';
import type { NarrativeTone, FollowupPriority } from './types';

export const PIPELINE_VERSION = '1.0.0';

// ─── Condition Display Labels ─────────────────────────────────────────────────

export const DIAGNOSIS_LABELS: Record<DiagnosisKey, string> = {
  AGA_MALE_123: 'Androgenetic Alopecia (Male, Grade 1–3)',
  AGA_MALE_45: 'Androgenetic Alopecia (Male, Grade 4–5)',
  AGA_FEMALE_123: 'Androgenetic Alopecia (Female, Grade 1–3)',
  AGA_FEMALE_45: 'Androgenetic Alopecia (Female, Grade 4–5)',
  TE_STRESS: 'Telogen Effluvium (Stress-Induced)',
  TE_NUTRITION: 'Telogen Effluvium (Nutritional Deficiency)',
  TE_POSTPREG: 'Post-Partum Telogen Effluvium',
  TE_DELIVERY: 'Post-Delivery Telogen Effluvium',
  TE_ILLNESS: 'Telogen Effluvium (Post-Illness)',
  THYROID_HYPO: 'Hypothyroid-Associated Hair Loss',
  THYROID_HYPER: 'Hyperthyroid-Associated Hair Loss',
  PCOS_ONLY: 'PCOS-Related Androgenic Alopecia',
  PCOS_OBESITY: 'PCOS + Metabolic Syndrome Hair Loss',
  PERI_MENOPAUSE: 'Peri-Menopausal Hair Thinning',
  MENOPAUSE: 'Menopausal Alopecia',
  POST_MENOPAUSE: 'Post-Menopausal Hair Loss',
  IRON_DEFICIENCY: 'Iron Deficiency-Related Hair Loss',
  ALOPECIA_AREATA: 'Alopecia Areata',
  PREGNANCY: 'Pregnancy-Associated Hair Changes',
  WEIGHT_LOSS: 'Rapid Weight Loss Telogen Effluvium',
  GUT_ISSUES: 'Gut Malabsorption-Related Hair Loss',
  SCALP_INFLAM: 'Scalp Inflammation-Driven Hair Loss',
  HAIR_BREAKAGE: 'Structural Hair Breakage',
  OXIDATIVE: 'Oxidative Stress Hair Loss',
  NIGHT_SHIFT: 'Circadian Disruption Hair Loss',
  FREQUENT_FLYING: 'Frequent Flying / Circadian Stress Hair Loss',
  DIABETES: 'Diabetic / Metabolic Hair Loss',
  CHRONIC_MEDICAL: 'Chronic Illness-Related Hair Loss',
  TTM: 'Trichotillomania',
  ENDOMETRIOSIS: 'Endometriosis-Related Hair Changes',
  EARLY_GREY: 'Premature Greying',
  MOUTH_ULCERS: 'Autoimmune / Nutritional Complex',
  MULTI: 'Mixed Pathology Hair Loss',
  REGROW_ONLY: 'Regrowth Optimisation Protocol',
};

export const CONDITION_REVERSIBILITY: Record<DiagnosisKey, 'reversible' | 'partially-reversible' | 'chronic-manageable'> = {
  AGA_MALE_123: 'chronic-manageable',
  AGA_MALE_45: 'chronic-manageable',
  AGA_FEMALE_123: 'chronic-manageable',
  AGA_FEMALE_45: 'chronic-manageable',
  TE_STRESS: 'reversible',
  TE_NUTRITION: 'reversible',
  TE_POSTPREG: 'reversible',
  TE_DELIVERY: 'reversible',
  TE_ILLNESS: 'reversible',
  THYROID_HYPO: 'partially-reversible',
  THYROID_HYPER: 'partially-reversible',
  PCOS_ONLY: 'partially-reversible',
  PCOS_OBESITY: 'partially-reversible',
  PERI_MENOPAUSE: 'partially-reversible',
  MENOPAUSE: 'chronic-manageable',
  POST_MENOPAUSE: 'chronic-manageable',
  IRON_DEFICIENCY: 'reversible',
  ALOPECIA_AREATA: 'partially-reversible',
  PREGNANCY: 'reversible',
  WEIGHT_LOSS: 'reversible',
  GUT_ISSUES: 'partially-reversible',
  SCALP_INFLAM: 'reversible',
  HAIR_BREAKAGE: 'reversible',
  OXIDATIVE: 'partially-reversible',
  NIGHT_SHIFT: 'reversible',
  FREQUENT_FLYING: 'partially-reversible',
  DIABETES: 'partially-reversible',
  CHRONIC_MEDICAL: 'partially-reversible',
  TTM: 'partially-reversible',
  ENDOMETRIOSIS: 'partially-reversible',
  EARLY_GREY: 'chronic-manageable',
  MOUTH_ULCERS: 'partially-reversible',
  MULTI: 'partially-reversible',
  REGROW_ONLY: 'partially-reversible',
};

// ─── Severity Descriptors ─────────────────────────────────────────────────────

export const SEVERITY_CLINICAL_LABELS: Record<Severity, string> = {
  MILD: 'Mild (Grade I–II)',
  MODERATE: 'Moderate (Grade III)',
  SEVERE: 'Severe (Grade IV–V+)',
};

export const SEVERITY_PATIENT_LABELS: Record<Severity, string> = {
  MILD: 'early-stage',
  MODERATE: 'moderate',
  SEVERE: 'advanced',
};

export const SEVERITY_TONES: Record<Severity, NarrativeTone> = {
  MILD: 'reassuring',
  MODERATE: 'motivational',
  SEVERE: 'empathetic',
};

// ─── Recovery Windows ─────────────────────────────────────────────────────────

export const RECOVERY_WINDOWS: Record<DiagnosisKey, string> = {
  AGA_MALE_123: '6–12 months for visible improvement; ongoing maintenance required',
  AGA_MALE_45: '9–18 months for stabilisation; regrowth variable',
  AGA_FEMALE_123: '6–12 months; hormonal optimisation speeds response',
  AGA_FEMALE_45: '12–24 months; requires sustained multi-modal therapy',
  TE_STRESS: '3–6 months once trigger resolved',
  TE_NUTRITION: '3–6 months with nutritional correction',
  TE_POSTPREG: '6–12 months post-partum (self-limiting)',
  TE_DELIVERY: '6–12 months post-delivery (self-limiting)',
  TE_ILLNESS: '3–6 months post-recovery',
  THYROID_HYPO: '6–12 months with thyroid normalisation',
  THYROID_HYPER: '6–12 months once thyroid managed',
  PCOS_ONLY: '9–15 months; hormonal rebalancing required',
  PCOS_OBESITY: '12–18 months; metabolic + hormonal dual approach',
  PERI_MENOPAUSE: '6–12 months with targeted support',
  MENOPAUSE: '12–18 months; ongoing maintenance likely',
  POST_MENOPAUSE: '12–24 months; long-term management expected',
  IRON_DEFICIENCY: '3–6 months with iron repletion',
  ALOPECIA_AREATA: 'Variable 6–24 months; immune response unpredictable',
  PREGNANCY: 'Supportive care only; reassessment post-partum',
  WEIGHT_LOSS: '3–6 months once nutritional stabilisation achieved',
  GUT_ISSUES: '6–12 months with gut restoration',
  SCALP_INFLAM: '2–4 months with anti-inflammatory protocol',
  HAIR_BREAKAGE: '2–4 months with structural support',
  OXIDATIVE: '4–8 months with antioxidant support',
  NIGHT_SHIFT: '3–6 months with circadian reset',
  FREQUENT_FLYING: '3–6 months with supportive protocol',
  DIABETES: '9–18 months; metabolic control essential',
  CHRONIC_MEDICAL: 'Variable; depends on underlying condition management',
  TTM: 'Psychotherapy + 6–12 months concurrent hair support',
  ENDOMETRIOSIS: '9–15 months; hormonal balance key',
  EARLY_GREY: 'Long-term maintenance; reversal limited',
  MOUTH_ULCERS: '4–8 months with immune/nutritional support',
  MULTI: '12–18 months; phased multi-modal approach required',
  REGROW_ONLY: '6–12 months with regrowth-focused protocol',
};

// ─── Therapy Need Labels ──────────────────────────────────────────────────────

export const THERAPY_NEED_LABELS: Record<TherapyNeed, string> = {
  DHT_SUPPRESSION: 'DHT Suppression',
  INFLAMMATION_CONTROL: 'Inflammation Control',
  FOLLICLE_STIMULATION: 'Follicle Stimulation',
  METABOLIC_SUPPORT: 'Metabolic Support',
  IMMUNE_MODULATION: 'Immune Modulation',
  IRON_REPLETION: 'Iron Repletion',
  HORMONAL_REBALANCING: 'Hormonal Rebalancing',
  ANTIOXIDANT_SUPPORT: 'Antioxidant Support',
  GUT_RESTORATION: 'Gut Restoration',
  THYROID_SUPPORT: 'Thyroid Support',
  CIRCADIAN_RESET: 'Circadian Reset',
  SHAFT_REPAIR: 'Shaft Repair',
  SHEDDING_ARREST: 'Shedding Arrest',
  LACTATION_SUPPORT: 'Lactation Support',
  MELANOCYTE_PROTECTION: 'Melanocyte Protection',
  ANDROGENIC_CORRECTION: 'Androgenic Correction',
  NEUROLOGICAL_OCD_SUPPORT: 'Neurological / OCD Support',
  WEIGHT_LOSS_RECOVERY: 'Weight Loss Recovery',
  PREGNANCY_SUPPORT: 'Pregnancy Support',
};

export const THERAPY_NEED_PATIENT_LABELS: Record<TherapyNeed, string> = {
  DHT_SUPPRESSION: 'blocking the hormone driving hair loss',
  INFLAMMATION_CONTROL: 'calming scalp inflammation',
  FOLLICLE_STIMULATION: 'reactivating dormant hair follicles',
  METABOLIC_SUPPORT: 'supporting your body\'s metabolic balance',
  IMMUNE_MODULATION: 'regulating immune activity near follicles',
  IRON_REPLETION: 'restoring iron levels your follicles need',
  HORMONAL_REBALANCING: 'rebalancing hormones affecting your hair',
  ANTIOXIDANT_SUPPORT: 'protecting follicles from oxidative damage',
  GUT_RESTORATION: 'improving nutrient absorption from your gut',
  THYROID_SUPPORT: 'supporting thyroid-dependent hair growth cycles',
  CIRCADIAN_RESET: 'resetting your body clock to protect hair cycles',
  SHAFT_REPAIR: 'strengthening and repairing hair fibre structure',
  SHEDDING_ARREST: 'stopping excess hair fall quickly',
  LACTATION_SUPPORT: 'nutritional support during lactation',
  MELANOCYTE_PROTECTION: 'protecting pigment-producing cells in follicles',
  ANDROGENIC_CORRECTION: 'correcting androgen sensitivity at the follicle',
  NEUROLOGICAL_OCD_SUPPORT: 'supporting neurological health alongside hair care',
  WEIGHT_LOSS_RECOVERY: 'supporting recovery from rapid weight loss',
  PREGNANCY_SUPPORT: 'safe nutritional support during pregnancy',
};

// ─── Root Cause Labels ────────────────────────────────────────────────────────

export const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  STRESS: 'Chronic psychological or physical stress',
  DHT: 'Dihydrotestosterone (DHT) sensitivity',
  GENETICS: 'Genetic predisposition',
  IRON_DEFICIENCY: 'Iron deficiency',
  HYPOTHYROID: 'Hypothyroidism',
  HYPERTHYROID: 'Hyperthyroidism',
  PCOS: 'Polycystic Ovary Syndrome (PCOS)',
  METABOLIC: 'Metabolic dysfunction',
  POOR_NUTRITION: 'Poor nutrition / micronutrient deficiency',
  POST_PARTUM: 'Post-partum hormonal shift',
  GUT_MALABSORPTION: 'Gut malabsorption',
  OXIDATIVE_STRESS: 'Oxidative stress',
  MEDICATION: 'Medication side effects',
  ILLNESS: 'Post-illness physiological stress',
  RAPID_WEIGHT_LOSS: 'Rapid weight loss',
  AUTOIMMUNE: 'Autoimmune activity',
  CIRCADIAN_DISRUPTION: 'Circadian rhythm disruption',
  TRICHOTILLOMANIA: 'Trichotillomania (compulsive pulling)',
  HORMONAL_SHIFT: 'Hormonal transition (menopause / peri-menopause)',
};

// ─── Followup Priority Thresholds ────────────────────────────────────────────

export const FOLLOWUP_PRIORITY_BY_SEVERITY: Record<Severity, FollowupPriority> = {
  MILD: 'routine',
  MODERATE: 'elevated',
  SEVERE: 'urgent',
};

export const HIGH_ATTENTION_DIAGNOSES = new Set<DiagnosisKey>([
  'AGA_MALE_45',
  'AGA_FEMALE_45',
  'ALOPECIA_AREATA',
  'CHRONIC_MEDICAL',
  'MULTI',
  'TTM',
]);

// ─── Disclaimers ──────────────────────────────────────────────────────────────

export const MEDICAL_DISCLAIMERS = [
  'This report is generated by an AI-assisted clinical decision support system and is intended for use by qualified healthcare professionals in conjunction with clinical examination.',
  'All recommendations are evidence-informed but not a substitute for individual clinical judgement.',
  'Recovery timelines are estimates based on population-level data. Individual results will vary based on adherence, genetics, and comorbidities.',
  'This system does not guarantee hair regrowth or cure of any underlying condition.',
  'Patients with severe presentation, rapid progression, or uncertain aetiology should be referred for specialist evaluation.',
  'Contraindication checks are algorithmic. Clinical judgement must confirm all contraindications before prescription.',
] as const;

export const PATIENT_DISCLAIMERS = [
  'Results vary from person to person. The timelines mentioned are typical estimates and your personal response may differ.',
  'Consistency with your recommended protocol is essential for best results.',
  'If you experience any unexpected side effects, please contact your clinic immediately.',
  'This information does not replace the advice of your treating clinician.',
] as const;
