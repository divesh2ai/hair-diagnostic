/**
 * Therapy Knowledge Base — Registry Index
 *
 * TODO: Add entries for remaining TherapyNeed values:
 *   METABOLIC_SUPPORT, IMMUNE_MODULATION, IRON_REPLETION,
 *   HORMONAL_REBALANCING, ANTIOXIDANT_SUPPORT, GUT_RESTORATION,
 *   THYROID_SUPPORT, CIRCADIAN_RESET, SHAFT_REPAIR,
 *   LACTATION_SUPPORT, MELANOCYTE_PROTECTION,
 *   ANDROGENIC_CORRECTION, NEUROLOGICAL_OCD_SUPPORT,
 *   WEIGHT_LOSS_RECOVERY, PREGNANCY_SUPPORT
 */

import type { TherapyKnowledge, TherapyKnowledgeRegistry } from '../../types';

const DHT_SUPPRESSION_KNOWLEDGE: TherapyKnowledge = {
  therapyNeed: 'DHT_SUPPRESSION',
  displayName: 'DHT Suppression',
  description:
    'Therapeutic reduction of dihydrotestosterone (DHT) at the scalp follicle level to ' +
    'prevent androgenic miniaturisation in genetically susceptible follicles.',
  clinicalRationale:
    'DHT is the primary driver of androgenetic alopecia in both sexes. It binds to androgen ' +
    'receptors in dermal papilla cells, suppressing Wnt/β-catenin and IGF-1 signalling, ' +
    'shortening the anagen phase, and causing progressive follicular miniaturisation. ' +
    'Reducing DHT via 5α-reductase inhibition or androgen receptor blockade is the ' +
    'primary disease-modifying strategy for AGA.',
  mechanisms: [
    {
      label: 'Type II 5α-Reductase Inhibition',
      pathway: 'Testosterone → 5α-R2 → DHT (inhibited by finasteride)',
      targetTissue: 'Scalp dermal papilla cells',
      description:
        'Finasteride competitively inhibits Type II 5α-reductase, the dominant isoform ' +
        'in scalp follicles, reducing local and serum DHT by 60–70%.',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Dual 5α-Reductase Inhibition',
      pathway: 'Testosterone → 5α-R1+R2 → DHT (inhibited by dutasteride)',
      targetTissue: 'Scalp follicles and sebaceous glands',
      description:
        'Dutasteride inhibits both Type I and II isoforms, achieving 90–95% DHT reduction. ' +
        'Type I inhibition provides additional suppression in sebaceous glands.',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Androgen Receptor Blockade',
      pathway: 'DHT → AR (blocked by spironolactone / bicalutamide)',
      targetTissue: 'Dermal papilla androgen receptors',
      description:
        'Spironolactone and bicalutamide compete with DHT for androgen receptor binding, ' +
        'used primarily in women where 5α-reductase inhibitors are contraindicated.',
      evidenceLevel: 'MODERATE',
    },
  ],
  category: 'PRESCRIPTION_ORAL',
  targetConditions: ['AGA_MALE_123', 'AGA_MALE_45', 'AGA_FEMALE_123', 'AGA_FEMALE_45', 'PCOS_ONLY'],
  targetRootCauses: ['DHT', 'GENETICS', 'HORMONAL_SHIFT'],
  expectedBiomarkers: ['Serum DHT reduction >60%', 'Scalp DHT reduction on biopsy'],
  monitoringParameters: [
    'Serum DHT and testosterone (baseline and 3 months)',
    'PSA (males >40 years; baseline and annually)',
    'Liver function tests (if prolonged use)',
    'Sexual function assessment (PRO questionnaire)',
  ],
  evidenceLevel: 'STRONG',
  contraindications: [
    'Pregnancy (finasteride Category X)',
    'Women of childbearing potential without contraception',
    'Prostate cancer (without urological monitoring)',
    'Hepatic impairment',
  ],
  lastReviewed: '2025-01-01',
};

const FOLLICLE_STIMULATION_KNOWLEDGE: TherapyKnowledge = {
  therapyNeed: 'FOLLICLE_STIMULATION',
  displayName: 'Follicle Stimulation',
  description:
    'Direct stimulation of dormant or miniaturised follicles to re-enter the anagen ' +
    'growth phase, increasing density and promoting vellus-to-terminal conversion.',
  clinicalRationale:
    'Follicle stimulation addresses the downstream consequence of miniaturisation: follicles ' +
    'that are alive but arrested in telogen or producing only vellus hairs. Vasodilatory, ' +
    'growth factor, and peptide-based approaches attempt to restore active cycling.',
  mechanisms: [
    {
      label: 'Potassium Channel Activation (Minoxidil)',
      pathway: 'Minoxidil → K+ channel opening → vasodilation → VEGF upregulation → anagen entry',
      targetTissue: 'Dermal papilla cells, perifollicular microvasculature',
      description:
        'Minoxidil sulphate opens ATP-sensitive potassium channels in dermal papilla cells ' +
        'and vascular smooth muscle, increasing scalp perfusion and follicular growth factor delivery.',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Peptide-Mediated Growth Factor Activation',
      pathway: 'Peptides (Redensyl, Procapil) → stem cell activation → anagen initiation',
      targetTissue: 'Outer root sheath stem cells, dermal papilla',
      description:
        'Compounds like redensyl activate ORSm (outer root sheath) stem cells to proliferate and ' +
        'differentiate, restarting the hair growth cycle.',
      evidenceLevel: 'EMERGING',
    },
    {
      label: 'Wnt/β-Catenin Pathway Activation',
      pathway: 'Wnt ligands → Frizzled receptors → β-catenin stabilisation → anagen gene expression',
      targetTissue: 'Dermal papilla cells',
      description:
        'Wnt/β-catenin signalling is essential for anagen initiation; multiple therapeutic ' +
        'compounds are being developed to activate this pathway.',
      evidenceLevel: 'EMERGING',
    },
  ],
  category: 'TOPICAL',
  targetConditions: [
    'AGA_FEMALE_123',
    'AGA_FEMALE_45',
    'AGA_MALE_123',
    'AGA_MALE_45',
    'TE_STRESS',
    'TE_NUTRITION',
    'ALOPECIA_AREATA',
  ],
  targetRootCauses: ['DHT', 'GENETICS', 'STRESS', 'IRON_DEFICIENCY'],
  expectedBiomarkers: [
    'Increased terminal hair count on phototrichogram',
    'Reduced miniaturisation ratio on trichoscopy',
    'Increased anagen/telogen ratio on scalp biopsy',
  ],
  monitoringParameters: [
    'Phototrichogram at 3 and 6 months',
    'Global photography at 3, 6, 12 months',
    'Patient-reported shedding score',
  ],
  evidenceLevel: 'STRONG',
  contraindications: [
    'Pregnancy (minoxidil)',
    'Breastfeeding (minoxidil)',
    'Hypotension',
  ],
  lastReviewed: '2025-01-01',
};

const INFLAMMATION_CONTROL_KNOWLEDGE: TherapyKnowledge = {
  therapyNeed: 'INFLAMMATION_CONTROL',
  displayName: 'Inflammation Control',
  description:
    'Reduction of perifollicular and scalp inflammation to halt inflammatory follicle damage ' +
    'and create an environment conducive to regrowth.',
  clinicalRationale:
    'Subclinical perifollicular inflammation is present in up to 40% of AGA biopsies and is ' +
    'a key driver of follicle miniaturisation. Seborrhoeic dermatitis, Malassezia colonisation, ' +
    'and innate immune activation accelerate androgenic alopecia and TE. ' +
    'Addressing inflammation is a disease-modifying, not merely symptomatic, intervention.',
  mechanisms: [
    {
      label: 'Antifungal Reduction of Malassezia',
      pathway: 'Ketoconazole → Malassezia eradication → reduced IL-1α, TNF-α',
      targetTissue: 'Scalp stratum corneum, follicular infundibulum',
      description: 'Malassezia is the primary driver of scalp inflammatory cascade in seborrhoeic dermatitis.',
      evidenceLevel: 'STRONG',
    },
    {
      label: 'Anti-inflammatory Nutritional Support',
      pathway: 'Omega-3, zinc, vitamin D → reduced pro-inflammatory cytokine production',
      targetTissue: 'Perifollicular dermis, immune cells',
      description: 'Omega-3 fatty acids and micronutrients modulate the scalp inflammatory milieu.',
      evidenceLevel: 'MODERATE',
    },
  ],
  category: 'TOPICAL',
  targetConditions: [
    'SCALP_INFLAM',
    'AGA_MALE_123',
    'AGA_FEMALE_123',
    'TE_STRESS',
    'ALOPECIA_AREATA',
  ],
  targetRootCauses: ['STRESS', 'POOR_NUTRITION', 'AUTOIMMUNE'],
  expectedBiomarkers: [
    'Reduced scalp TEWL (transepidermal water loss)',
    'Reduced dandruff score',
    'Reduced perifollicular erythema on trichoscopy',
  ],
  monitoringParameters: [
    'Seborrhoeic dermatitis score at 4 and 8 weeks',
    'Patient-reported scalp itch/burn score',
    'Trichoscopy perifollicular erythema',
  ],
  evidenceLevel: 'STRONG',
  contraindications: ['Ketoconazole hypersensitivity'],
  lastReviewed: '2025-01-01',
};

const SHEDDING_ARREST_KNOWLEDGE: TherapyKnowledge = {
  therapyNeed: 'SHEDDING_ARREST',
  displayName: 'Shedding Arrest',
  description:
    'Reduction of active hair shedding to within normal limits (≤100 hairs/day) ' +
    'by addressing the underlying driver of telogen phase acceleration.',
  clinicalRationale:
    'Active shedding above 100–150 hairs/day represents clinically significant telogen effluvium. ' +
    'Treatment targets the specific aetiology (DHT, nutritional, stress, hormonal) to normalise ' +
    'the anagen-to-telogen ratio. Without shedding arrest, ongoing density loss prevents ' +
    'assessment of regrowth efficacy.',
  mechanisms: [
    {
      label: 'Anagen Cycle Stabilisation',
      pathway:
        'Address root cause (DHT suppression, nutritional repletion, stress reduction) ' +
        '→ normalise HPA axis → restore anagen cycling',
      targetTissue: 'Hair follicle bulge stem cells, dermal papilla',
      description:
        'Removing the stimulus that prematurely drives follicles into telogen allows ' +
        'spontaneous return to normal anagen-telogen cycling.',
      evidenceLevel: 'STRONG',
    },
  ],
  category: 'ORAL_SUPPLEMENT',
  targetConditions: [
    'TE_STRESS',
    'TE_NUTRITION',
    'AGA_MALE_123',
    'AGA_FEMALE_123',
    'THYROID_HYPO',
    'IRON_DEFICIENCY',
  ],
  targetRootCauses: ['STRESS', 'IRON_DEFICIENCY', 'POOR_NUTRITION', 'DHT', 'HYPOTHYROID'],
  expectedBiomarkers: [
    'Daily shed count reduced to <100',
    'Negative pull test',
    'Normalisation of ferritin, thyroid, and micronutrient labs',
  ],
  monitoringParameters: [
    'Patient-reported daily shed count',
    'Pull test at 6 and 12 weeks',
    'Laboratory markers specific to aetiology (ferritin, TSH, zinc)',
  ],
  evidenceLevel: 'STRONG',
  contraindications: [],
  lastReviewed: '2025-01-01',
};

export const THERAPIES_KB: TherapyKnowledgeRegistry = {
  DHT_SUPPRESSION: DHT_SUPPRESSION_KNOWLEDGE,
  FOLLICLE_STIMULATION: FOLLICLE_STIMULATION_KNOWLEDGE,
  INFLAMMATION_CONTROL: INFLAMMATION_CONTROL_KNOWLEDGE,
  SHEDDING_ARREST: SHEDDING_ARREST_KNOWLEDGE,
  // TODO: METABOLIC_SUPPORT — metabolic pathway support for hair
  // TODO: IMMUNE_MODULATION — immune regulation for AA
  // TODO: IRON_REPLETION — iron replacement protocols
  // TODO: HORMONAL_REBALANCING — HRT and hormonal correction
  // TODO: ANTIOXIDANT_SUPPORT — oxidative stress reduction
  // TODO: GUT_RESTORATION — gut microbiome and malabsorption
  // TODO: THYROID_SUPPORT — thyroid-hair axis
  // TODO: CIRCADIAN_RESET — sleep and circadian rhythm intervention
  // TODO: SHAFT_REPAIR — structural hair damage repair
  // TODO: LACTATION_SUPPORT — breastfeeding-safe protocols
  // TODO: MELANOCYTE_PROTECTION — premature greying prevention
  // TODO: ANDROGENIC_CORRECTION — PCOS androgen correction
  // TODO: NEUROLOGICAL_OCD_SUPPORT — trichotillomania support
  // TODO: WEIGHT_LOSS_RECOVERY — GLP-1 and crash diet hair recovery
  // TODO: PREGNANCY_SUPPORT — pregnancy-safe hair care
} as const;
