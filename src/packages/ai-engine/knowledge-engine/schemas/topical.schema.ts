/**
 * Topical Knowledge Schema
 */

export const TOPICAL_REQUIRED_FIELDS = [
  'topicalId',
  'displayName',
  'formulation',
  'activeIngredients',
  'ingredientIds',
  'scalpPenetration',
  'follicularTargeting',
  'applicationGuidance',
  'irritationRisks',
  'inflammationModulation',
  'targetScalpStates',
  'targetTherapyNeeds',
  'contraindications',
  'pregnancySafe',
  'mechanisms',
  'evidenceLevel',
  'lastReviewed',
] as const;

export type TopicalRequiredField = (typeof TOPICAL_REQUIRED_FIELDS)[number];

export const PENETRATION_DEPTHS = [
  'SURFACE',
  'EPIDERMAL',
  'DERMAL',
  'FOLLICULAR',
  'TRANSDERMAL',
] as const;

export const FOLLICULAR_PHASES = [
  'ANAGEN',
  'CATAGEN',
  'TELOGEN',
  'ALL_PHASES',
] as const;

export const IRRITATION_RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;

export const INFLAMMATION_EFFECTS = [
  'REDUCES',
  'NEUTRAL',
  'MAY_INCREASE',
] as const;

export const TOPICAL_ARRAY_MINIMUMS: Record<string, number> = {
  activeIngredients: 1,
  ingredientIds: 1,
  targetScalpStates: 0,
  targetTherapyNeeds: 1,
  mechanisms: 1,
} as const;
