/**
 * Therapy Knowledge Schema
 */

export const THERAPY_REQUIRED_FIELDS = [
  'therapyNeed',
  'displayName',
  'description',
  'clinicalRationale',
  'mechanisms',
  'category',
  'targetConditions',
  'targetRootCauses',
  'expectedBiomarkers',
  'monitoringParameters',
  'evidenceLevel',
  'contraindications',
  'lastReviewed',
] as const;

export type TherapyRequiredField = (typeof THERAPY_REQUIRED_FIELDS)[number];

export const THERAPY_CATEGORIES = [
  'TOPICAL',
  'ORAL_SUPPLEMENT',
  'PRESCRIPTION_ORAL',
  'INJECTABLE',
  'DEVICE',
  'LIFESTYLE',
] as const;

export const THERAPY_ARRAY_MINIMUMS: Record<string, number> = {
  mechanisms: 1,
  targetConditions: 1,
  targetRootCauses: 0,
  expectedBiomarkers: 0,
  monitoringParameters: 1,
} as const;
