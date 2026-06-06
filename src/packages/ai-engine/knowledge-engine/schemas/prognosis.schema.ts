/**
 * Prognosis Knowledge Schema
 */

export const PROGNOSIS_REQUIRED_FIELDS = [
  'diagnosisKey',
  'severity',
  'displayName',
  'baselineOutcome',
  'withOptimalTreatment',
  'withoutTreatment',
  'outcomes',
  'modifiers',
  'keySuccessFactors',
  'warningSignals',
  'referralCriteria',
  'evidenceLevel',
  'lastReviewed',
] as const;

export type PrognosisRequiredField = (typeof PROGNOSIS_REQUIRED_FIELDS)[number];

export const PROGNOSIS_TIMEFRAMES = [
  'SHORT_TERM',
  'MEDIUM_TERM',
  'LONG_TERM',
] as const;

export const MODIFIER_DIRECTIONS = ['IMPROVES', 'WORSENS', 'NEUTRAL'] as const;
export const MODIFIER_MAGNITUDES = ['HIGH', 'MODERATE', 'LOW'] as const;
export const SEVERITY_VALUES = ['MILD', 'MODERATE', 'SEVERE'] as const;

export const PROGNOSIS_ARRAY_MINIMUMS: Record<string, number> = {
  outcomes: 1,
  modifiers: 0,
  keySuccessFactors: 1,
  warningSignals: 0,
  referralCriteria: 0,
} as const;
