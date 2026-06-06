/**
 * Lifestyle Guidance Knowledge Schema
 */

export const LIFESTYLE_REQUIRED_FIELDS = [
  'guidanceId',
  'category',
  'displayName',
  'description',
  'relevantConditions',
  'relevantRootCauses',
  'recommendations',
  'avoidances',
  'evidenceLevel',
  'patientNote',
  'clinicalNote',
  'lastReviewed',
] as const;

export type LifestyleRequiredField = (typeof LIFESTYLE_REQUIRED_FIELDS)[number];

export const LIFESTYLE_CATEGORIES = [
  'NUTRITION',
  'SLEEP',
  'STRESS',
  'EXERCISE',
  'CHEMICAL_EXPOSURE',
  'HEAT_STYLING',
  'SCALP_CARE',
  'HYDRATION',
] as const;

export const RECOMMENDATION_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export const LIFESTYLE_ARRAY_MINIMUMS: Record<string, number> = {
  relevantConditions: 0,
  relevantRootCauses: 0,
  recommendations: 1,
  avoidances: 0,
} as const;
