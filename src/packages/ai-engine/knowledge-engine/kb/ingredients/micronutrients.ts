import type { IngredientKnowledge } from '../../types';

export const BIOTIN: IngredientKnowledge = {
  ingredientId: 'biotin',
  displayName: 'Biotin (Vitamin B7)',
  aliases: ['Vitamin H', 'coenzyme R', 'D-biotin'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Cofactor in carboxylase enzymes essential for fatty acid synthesis, gluconeogenesis, ' +
      'and amino acid catabolism — all required for rapid hair matrix cell proliferation.',
    'Supports keratin infrastructure by facilitating amino acid metabolism ' +
      'and energy production in the hair follicle bulb.',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Evidence for biotin supplementation is strongest in confirmed biotin deficiency. ' +
    'In biotin-sufficient individuals, supplementation shows minimal demonstrated benefit. ' +
    'Biotin deficiency (rare) causes diffuse alopecia, brittle nails, and dermatitis.',
  contraindications: [
    'Interferes with immunoassay-based laboratory tests (thyroid, cardiac troponin) at high doses — ' +
      'discontinue 48–72 hours before blood tests',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '2.5–5 mg per day',
    unit: 'mg',
    frequency: 'Once daily',
    notes:
      'RDA is 30 μg/day; supplemental doses are 2,500–5,000 μg. ' +
      'Supplement only if biotin deficiency suspected. Discontinue before lab tests.',
  },
  interactions: [
    {
      ingredient: 'Zinc',
      type: 'SYNERGISTIC',
      note: 'Combined micronutrient support for follicular metabolism.',
    },
  ],
  sideEffects: [
    'Interference with laboratory assay results (dose-dependent)',
    'Acne exacerbation in susceptible individuals (anecdotal)',
  ],
  onsetOfAction: 'Benefit in deficiency states: 2–4 months.',
};

export const ZINC: IngredientKnowledge = {
  ingredientId: 'zinc',
  displayName: 'Zinc',
  aliases: ['zinc sulphate', 'zinc gluconate', 'zinc picolinate'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Essential cofactor for 5α-reductase: zinc inhibits Type I and II 5α-reductase activity, ' +
      'mildly reducing local DHT production.',
    'Keratin synthesis: zinc is required for protein synthesis enzymes and structural keratin polymerisation.',
    'Immune modulation: zinc maintains T-regulatory cell function and reduces excessive scalp inflammation.',
    'Sebum regulation: zinc reduces sebaceous gland activity, lowering Malassezia substrate.',
  ],
  targetedNeeds: ['DHT_SUPPRESSION', 'INFLAMMATION_CONTROL', 'METABOLIC_SUPPORT'],
  evidenceLevel: 'MODERATE',
  clinicalEvidence:
    'Zinc deficiency is associated with hair loss. Studies show low serum zinc in patients ' +
    'with alopecia areata, TE, and AGA. Supplementation improves hair loss in zinc-deficient patients; ' +
    'benefit in zinc-sufficient individuals is less established.',
  contraindications: [
    'High-dose zinc (>40 mg/day long-term) may inhibit copper absorption — monitor copper status',
    'Do not co-administer with high-dose iron supplements (competitive absorption)',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '15–30 mg elemental zinc per day',
    maximum: '40 mg per day (tolerable upper intake level)',
    unit: 'mg',
    frequency: 'Once daily with food',
    notes:
      'Zinc gluconate or picolinate preferred for bioavailability. Take with food to reduce nausea. ' +
      'Do not take within 2 hours of iron supplementation.',
  },
  interactions: [
    {
      ingredient: 'Iron',
      type: 'ANTAGONISTIC',
      note: 'Competitive intestinal absorption; separate dosing by 2 hours.',
    },
    {
      ingredient: 'Biotin',
      type: 'SYNERGISTIC',
      note: 'Complementary micronutrient support for follicular function.',
    },
  ],
  sideEffects: [
    'Nausea (take with food)',
    'Metallic taste',
    'Copper deficiency with long-term high-dose use',
    'Gastrointestinal upset',
  ],
  onsetOfAction: 'Serum normalisation: 4–8 weeks. Hair improvement: 3–4 months.',
};

export const IRON_BISGLYCINATE: IngredientKnowledge = {
  ingredientId: 'iron_bisglycinate',
  displayName: 'Iron (as Bisglycinate)',
  aliases: ['ferrous bisglycinate', 'iron glycinate', 'Ferrochel'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Cofactor for ribonucleotide reductase, the rate-limiting enzyme in DNA synthesis, ' +
      'supporting the rapid cell division of hair matrix cells.',
    'Haemoglobin synthesis: adequate iron ensures follicular oxygenation via haemoglobin-rich ' +
      'perifollicular capillaries.',
    'Ferritin storage: hair follicle uses ferritin as a local iron store; ferritin <30 ng/mL ' +
      'is associated with hair loss independent of anaemia.',
  ],
  targetedNeeds: ['IRON_REPLETION', 'METABOLIC_SUPPORT', 'SHEDDING_ARREST'],
  evidenceLevel: 'STRONG',
  clinicalEvidence:
    'Multiple studies demonstrate association between low ferritin and hair loss in women. ' +
    'Ferritin repletion to >70 ng/mL associated with hair loss improvement. ' +
    'Bisglycinate form preferred for reduced GI side effects and superior bioavailability vs ferrous sulphate.',
  contraindications: [
    'Hereditary haemochromatosis (absolute contraindication)',
    'Haemosiderosis or iron overload states',
    'Do not use with antacids or calcium supplements (reduced absorption)',
    'Active gastrointestinal bleeding — treat underlying cause first',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '25–50 mg elemental iron per day as bisglycinate',
    unit: 'mg elemental iron',
    frequency: 'Once daily on empty stomach (or with food if GI intolerance)',
    notes:
      'Target ferritin >70 ng/mL for hair benefit. Vitamin C (250 mg) taken simultaneously enhances absorption. ' +
      'Recheck ferritin after 3 months. Avoid tea, coffee, calcium within 2 hours.',
  },
  interactions: [
    {
      ingredient: 'Zinc',
      type: 'ANTAGONISTIC',
      note: 'Competitive absorption; separate by 2 hours.',
    },
    {
      ingredient: 'Vitamin C',
      type: 'SYNERGISTIC',
      note: 'Ascorbic acid reduces Fe3+ to Fe2+, significantly enhancing non-haem iron absorption.',
    },
  ],
  sideEffects: [
    'Constipation (less common with bisglycinate than ferrous sulphate)',
    'Nausea and gastrointestinal discomfort',
    'Dark stools (expected; not harmful)',
    'Black staining of teeth (liquid formulations; use straw)',
  ],
  onsetOfAction: 'Ferritin normalisation: 8–16 weeks. Hair improvement: 3–6 months.',
  references: [
    'Trost LB et al. Iron deficiency and hair loss. J Am Acad Dermatol. 2006.',
    'Rushton DH. Nutritional factors and hair loss. Clin Exp Dermatol. 2002.',
  ],
};

export const VITAMIN_D3: IngredientKnowledge = {
  ingredientId: 'vitamin_d3',
  displayName: 'Vitamin D3 (Cholecalciferol)',
  aliases: ['cholecalciferol', '25-hydroxyvitamin D', 'calciferol'],
  category: 'VITAMIN_MINERAL',
  mechanismsOfAction: [
    'Vitamin D receptor (VDR) signalling: VDR is expressed in hair follicle keratinocytes ' +
      'and dermal papilla cells; VDR activation is required for anagen cycle re-entry.',
    'Keratinocyte differentiation: 1,25-dihydroxyvitamin D regulates keratinocyte proliferation ' +
      'and differentiation in the follicular epithelium.',
    'Immune modulation: vitamin D promotes T-regulatory cell function, relevant in alopecia areata.',
  ],
  targetedNeeds: ['METABOLIC_SUPPORT', 'IMMUNE_MODULATION'],
  evidenceLevel: 'EMERGING',
  clinicalEvidence:
    'Cross-sectional studies show lower serum 25(OH)D in women with TE and alopecia areata. ' +
    'Association with AGA is less established. Supplementation studies show improvement in ' +
    'TE when deficiency is corrected.',
  contraindications: [
    'Hypercalcaemia or hypercalciuria',
    'Sarcoidosis or granulomatous conditions (risk of hypercalcaemia)',
    'High-dose supplementation requires 25(OH)D monitoring to prevent toxicity',
  ],
  pregnancySafe: true,
  breastfeedingSafe: true,
  dosageGuidance: {
    typical: '2,000–4,000 IU per day',
    maximum: '10,000 IU/day (safe upper limit)',
    unit: 'IU',
    frequency: 'Once daily with a fatty meal',
    notes: 'Check serum 25(OH)D before supplementing. Target 50–80 ng/mL. Recheck at 3 months.',
  },
  interactions: [
    {
      ingredient: 'Zinc',
      type: 'SYNERGISTIC',
      note: 'Zinc and vitamin D both support immune regulation in alopecia areata.',
    },
  ],
  sideEffects: [
    'Hypercalcaemia at very high doses (>10,000 IU/day long-term)',
    'Nausea, weakness at toxic levels',
  ],
  onsetOfAction: 'Serum 25(OH)D normalisation: 8–12 weeks. Hair benefit in deficiency: 3–6 months.',
};
