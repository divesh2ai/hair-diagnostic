/**
 * Condition Knowledge Schema
 * Defines required fields, allowed values, and structural constraints.
 * Used by validators to gate malformed entries at the boundary.
 */

import type { EvidenceLevel } from '../types';

export const EVIDENCE_LEVELS: readonly EvidenceLevel[] = [
  'STRONG',
  'MODERATE',
  'EMERGING',
  'EXPERT',
  'THEORETICAL',
] as const;

export const CONTRAINDICATION_SEVERITIES = [
  'ABSOLUTE',
  'RELATIVE',
  'CAUTION',
] as const;

export const CONFIDENCE_FACTOR_DIRECTIONS = [
  'INCREASES_CONFIDENCE',
  'DECREASES_CONFIDENCE',
] as const;

export const PROGRESSION_REVERSIBILITY = [true, false] as const;

/** Required top-level fields on a ConditionKnowledge entry */
export const CONDITION_REQUIRED_FIELDS = [
  'diagnosisKey',
  'displayName',
  'shortName',
  'description',
  'clinicalDescription',
  'mechanisms',
  'triggers',
  'symptoms',
  'progression',
  'prognosis',
  'recommendedTherapies',
  'contraindications',
  'confidenceFactors',
  'relatedConditions',
  'rootCauses',
  'evidenceLevel',
  'lastReviewed',
] as const;

export type ConditionRequiredField = (typeof CONDITION_REQUIRED_FIELDS)[number];

/** Minimum array lengths to prevent empty-shell entries */
export const CONDITION_ARRAY_MINIMUMS: Record<string, number> = {
  mechanisms: 1,
  triggers: 0,
  symptoms: 1,
  progression: 1,
  prognosis: 1,
  recommendedTherapies: 1,
  rootCauses: 1,
} as const;

/** Confidence factor weight bounds */
export const CONFIDENCE_WEIGHT_MIN = 0.0;
export const CONFIDENCE_WEIGHT_MAX = 1.0;

/** ISO 8601 date regex for lastReviewed validation */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
