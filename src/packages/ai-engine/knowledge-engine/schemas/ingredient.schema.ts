/**
 * Ingredient Knowledge Schema
 */

export const INGREDIENT_REQUIRED_FIELDS = [
  'ingredientId',
  'displayName',
  'aliases',
  'category',
  'mechanismsOfAction',
  'targetedNeeds',
  'evidenceLevel',
  'clinicalEvidence',
  'contraindications',
  'pregnancySafe',
  'breastfeedingSafe',
  'dosageGuidance',
  'interactions',
  'sideEffects',
  'onsetOfAction',
] as const;

export type IngredientRequiredField = (typeof INGREDIENT_REQUIRED_FIELDS)[number];

export const INGREDIENT_CATEGORIES = [
  'DHT_INHIBITOR',
  'VASODILATOR',
  'PEPTIDE',
  'ANTIFUNGAL',
  'ANTI_INFLAMMATORY',
  'VITAMIN_MINERAL',
  'ADAPTOGEN',
  'HORMONE_MODULATOR',
  'ANTIOXIDANT',
  'KERATIN_SUPPORT',
  'PROBIOTIC',
  'BOTANICAL',
  'GROWTH_FACTOR',
] as const;

export const INTERACTION_TYPES = [
  'SYNERGISTIC',
  'ANTAGONISTIC',
  'NEUTRAL',
] as const;

export const INGREDIENT_ARRAY_MINIMUMS: Record<string, number> = {
  aliases: 0,
  mechanismsOfAction: 1,
  targetedNeeds: 1,
  contraindications: 0,
  interactions: 0,
  sideEffects: 0,
} as const;
