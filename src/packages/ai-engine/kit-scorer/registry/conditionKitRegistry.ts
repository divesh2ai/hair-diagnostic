import type { KitId, TherapyNeed } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION → KIT REGISTRY  (Layer ②)
//
// Single source of truth mapping each detectable clinical condition to its
// canonical kit. This REPLACES the per-diagnosis PROTOCOL_SEQUENCER templates.
//
// Design doctrine:
//   • A condition's kit is added to the protocol ONLY when that condition is
//     actually detected in the patient's answers (see detectConditions.ts).
//   • There is NO fixed phase template. The protocol is the UNION of the kits
//     for every condition present, resolved for interactions, then sequenced
//     by kitPrioritizer (which owns the clinical ordering doctrine).
//   • Veg / gender / grade kit variants are applied later by resolveKit().
//     The registry stores the canonical (non-veg, base-grade) kit id.
//
// Each entry carries the metadata downstream consumers (report, narrative,
// therapy mapping) need so the rationale is patient-specific rather than a
// generic kit blurb.
// ─────────────────────────────────────────────────────────────────────────────

export type ConditionId =
  | 'SCALP_INFLAMMATION'
  | 'AGA_PATTERN_MALE'
  | 'AGA_PATTERN_FEMALE'
  | 'METABOLIC'
  | 'PCOS'
  | 'HYPOTHYROID'
  | 'HYPERTHYROID'
  | 'ACUTE_SHEDDING'
  | 'IRON_DEFICIENCY'
  | 'GUT_DYSFUNCTION'
  | 'IMMUNE_DEPLETION'
  | 'PERI_MENOPAUSE'
  | 'POST_MENOPAUSE'
  | 'HAIR_BREAKAGE'
  | 'EARLY_GREYING'
  | 'OXIDATIVE_STRESS'
  | 'ENDOMETRIOSIS'
  | 'PREGNANCY'
  | 'ALOPECIA_AREATA'
  | 'POSTPARTUM_LACTATION'
  | 'RAPID_WEIGHT_LOSS'
  | 'NIGHT_SHIFT'
  | 'FREQUENT_FLYING'
  | 'TRICHOTILLOMANIA';

export interface ConditionKitEntry {
  /** Canonical kit (base variant). Veg/gender/grade resolved later by resolveKit(). */
  readonly kit: KitId;
  /** Human label for the condition, used in report + justification. */
  readonly label: string;
  /** Patient-specific clinical reason this kit was selected. */
  readonly rationale: string;
  /** Therapy needs this kit satisfies (for therapy-need matching). */
  readonly therapyNeeds: readonly TherapyNeed[];
}

export const CONDITION_KIT_REGISTRY: Record<ConditionId, ConditionKitEntry> = {
  SCALP_INFLAMMATION: {
    kit: 'PHENOTYPE INFLAMATION',
    label: 'Scalp / perifollicular inflammation',
    rationale:
      'Inflammatory terrain detected — clears NF-kB/TNF-alpha load around the follicle so downstream pattern and metabolic kits can take effect.',
    therapyNeeds: ['INFLAMMATION_CONTROL'],
  },
  AGA_PATTERN_MALE: {
    kit: 'MPHL',
    label: 'Male pattern hair loss',
    rationale:
      'Androgenetic miniaturisation detected — corrects DHT-driven follicle shrinkage in male pattern loss.',
    therapyNeeds: ['DHT_SUPPRESSION'],
  },
  AGA_PATTERN_FEMALE: {
    kit: 'FPHL',
    label: 'Female pattern hair loss',
    rationale:
      'Androgenetic miniaturisation detected — counters perifollicular inflammation and hormonal growth loss in female pattern loss.',
    therapyNeeds: ['DHT_SUPPRESSION', 'FOLLICLE_STIMULATION'],
  },
  METABOLIC: {
    kit: 'PRO FACT META B',
    label: 'Metabolic dysfunction',
    rationale:
      'Metabolic signal detected (obesity / insulin resistance / sedentary / crash diet) — restores insulin-AMPK axis and cellular metabolism.',
    therapyNeeds: ['METABOLIC_SUPPORT'],
  },
  PCOS: {
    kit: 'PRO FACT META B PCOS',
    label: 'PCOS / PCOD',
    rationale:
      'PCOS detected — corrects androgen excess and insulin-AMPK pathway in one disease-specific kit.',
    therapyNeeds: ['METABOLIC_SUPPORT', 'ANDROGENIC_CORRECTION'],
  },
  HYPOTHYROID: {
    kit: 'PRO FACT META B HYPOTHYROID',
    label: 'Hypothyroidism',
    rationale:
      'Hypothyroidism declared — unlocks cellular metabolism via T3 support before downstream correction.',
    therapyNeeds: ['THYROID_SUPPORT', 'METABOLIC_SUPPORT'],
  },
  HYPERTHYROID: {
    kit: 'PRO FACT THYROID CARE',
    label: 'Hyperthyroidism',
    rationale:
      'Hyperthyroidism declared — corrects metabolic overactivity and oxidative stress.',
    therapyNeeds: ['THYROID_SUPPORT'],
  },
  ACUTE_SHEDDING: {
    kit: 'HAIR FACT TE GOLD',
    label: 'Acute telogen shedding',
    rationale:
      'Active shedding within the acute window (≤ 3 months) — arrests telogen effluvium and stabilises the follicle.',
    therapyNeeds: ['SHEDDING_ARREST'],
  },
  IRON_DEFICIENCY: {
    kit: 'IRON UP GOLD',
    label: 'Iron deficiency / anaemia',
    rationale:
      'Iron deficiency confirmed — restores ferritin, the foundational substrate gating every downstream kit.',
    therapyNeeds: ['IRON_REPLETION'],
  },
  GUT_DYSFUNCTION: {
    kit: 'PRO FACT GI GOLD',
    label: 'Gut dysfunction (GERD / IBS / Acid / Crohn)',
    rationale:
      'Confirmed gut-axis condition — restores epithelial integrity and absorption that gates nutrient uptake.',
    therapyNeeds: ['GUT_RESTORATION'],
  },
  IMMUNE_DEPLETION: {
    kit: 'PRO IMMUNE GOLD',
    label: 'Immune depletion / regrowth support',
    rationale:
      'Immune-depletion signal detected (illness / surgery / nutritional / regrowth goal) — rebuilds immunity and stimulates follicle re-entry into anagen.',
    therapyNeeds: ['IMMUNE_MODULATION', 'FOLLICLE_STIMULATION'],
  },
  PERI_MENOPAUSE: {
    kit: 'HAIR FACT PERI MENOPAUSE',
    label: 'Peri-menopause',
    rationale:
      'Peri-menopause declared — stabilises the hormonal fluctuation driving relative androgen over-expression.',
    therapyNeeds: ['HORMONAL_REBALANCING'],
  },
  POST_MENOPAUSE: {
    kit: 'PRO FACT META B POSTMENOPAUSE',
    label: 'Post-menopause',
    rationale:
      'Post-menopause declared — corrects the post-menopausal metabolic and hormonal shift.',
    therapyNeeds: ['HORMONAL_REBALANCING', 'METABOLIC_SUPPORT'],
  },
  HAIR_BREAKAGE: {
    kit: 'HAIR FACT HAIR BREAKAGE REPAIR(HBR)',
    label: 'Hair shaft breakage',
    rationale:
      'Isolated shaft damage (chemical / heat / hard water) with no systemic driver — repairs the cuticle and strengthens the shaft.',
    therapyNeeds: ['SHAFT_REPAIR'],
  },
  EARLY_GREYING: {
    kit: 'EARLY GREYING CARE GOLD',
    label: 'Early / premature greying',
    rationale:
      'Premature greying goal — counters oxidative melanocyte damage and restores pigment cell function.',
    therapyNeeds: ['MELANOCYTE_PROTECTION'],
  },
  OXIDATIVE_STRESS: {
    kit: 'OXIDATIVE STRESS',
    label: 'Oxidative stress (smoking / alcohol / vaping)',
    rationale:
      'Multiple oxidative-load signals — neutralises free radicals and restores antioxidant enzyme systems.',
    therapyNeeds: ['ANTIOXIDANT_SUPPORT'],
  },
  ENDOMETRIOSIS: {
    kit: 'FH WELL 3',
    label: 'Endometriosis',
    rationale:
      'Endometriosis declared — targets the hormonal-inflammatory-fibrotic balance specific to the condition.',
    therapyNeeds: ['HORMONAL_REBALANCING', 'INFLAMMATION_CONTROL', 'IMMUNE_MODULATION'],
  },
  PREGNANCY: {
    kit: 'HEALTHY - 9',
    label: 'Pregnancy',
    rationale:
      'Pregnancy declared — single pregnancy-safe kit; all other kits are suppressed for safety.',
    therapyNeeds: ['PREGNANCY_SUPPORT'],
  },
  ALOPECIA_AREATA: {
    kit: 'HAIR FACT ALOPECIA AREATA',
    label: 'Alopecia areata (autoimmune)',
    rationale:
      'Autoimmune patchy loss — counters the autoimmune response and rebuilds immune balance at the follicle.',
    therapyNeeds: ['IMMUNE_MODULATION', 'FOLLICLE_STIMULATION'],
  },
  POSTPARTUM_LACTATION: {
    kit: 'LACTIHEALTH',
    label: 'Post-partum / breastfeeding',
    rationale:
      'Post-partum and still breastfeeding — covers the highest-priority lactation-driven nutritional demand.',
    therapyNeeds: ['LACTATION_SUPPORT'],
  },
  RAPID_WEIGHT_LOSS: {
    kit: 'RAPID WEIGHT LOSS SHIELD',
    label: 'Rapid weight loss / GLP-1',
    rationale:
      'Rapid weight loss or GLP-1 exposure — arrests shedding at the nutrient-deficit trigger before downstream correction.',
    therapyNeeds: ['WEIGHT_LOSS_RECOVERY', 'SHEDDING_ARREST'],
  },
  NIGHT_SHIFT: {
    kit: 'HAIR FACT NIGHT SHIFT',
    label: 'Night shift / circadian disruption',
    rationale:
      'Circadian disruption from night-shift work — resets the circadian-driven stress and oxidative load.',
    therapyNeeds: ['CIRCADIAN_RESET'],
  },
  FREQUENT_FLYING: {
    kit: 'HAIR FACT FREQUENT FLYERS',
    label: 'Frequent flying / travel stress',
    rationale:
      'Frequent flying — corrects circadian and travel-stress oxidative load.',
    therapyNeeds: ['CIRCADIAN_RESET'],
  },
  TRICHOTILLOMANIA: {
    kit: 'HAIR FACT TTM (OCD)',
    label: 'Trichotillomania (hair pulling / OCD)',
    rationale:
      'Hair-pulling / OCD pattern — addresses the neurological urge driving repeated pulling.',
    therapyNeeds: ['NEUROLOGICAL_OCD_SUPPORT'],
  },
};
