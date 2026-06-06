/**
 * Kit Knowledge Schema
 */

export const KIT_REQUIRED_FIELDS = [
  'kitId',
  'displayName',
  'shortName',
  'category',
  'description',
  'clinicalRationale',
  'targetDiagnoses',
  'targetTherapyNeeds',
  'components',
  'keyIngredients',
  'contraindications',
  'pregnancySafe',
  'expectedOutcomes',
  'timeToEffect',
  'phaseCompatibility',
  'evidenceLevel',
  'lastReviewed',
] as const;

export type KitRequiredField = (typeof KIT_REQUIRED_FIELDS)[number];

export const KIT_COMPONENT_TYPES = ['TOPICAL', 'ORAL', 'DEVICE'] as const;

export const KIT_ARRAY_MINIMUMS: Record<string, number> = {
  targetDiagnoses: 1,
  targetTherapyNeeds: 1,
  components: 1,
  keyIngredients: 1,
  expectedOutcomes: 1,
  phaseCompatibility: 1,
} as const;
