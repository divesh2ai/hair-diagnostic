/**
 * validateConditionKnowledge
 *
 * Runtime validation gate for ConditionKnowledge entries.
 * Malformed entries are rejected before they can reach production systems.
 * Call this in KB index files or in CI test suites.
 */

import type { ConditionKnowledge, ValidationResult } from '../types';
import {
  CONDITION_REQUIRED_FIELDS,
  CONDITION_ARRAY_MINIMUMS,
  EVIDENCE_LEVELS,
  ISO_DATE_REGEX,
  CONFIDENCE_WEIGHT_MIN,
  CONFIDENCE_WEIGHT_MAX,
} from '../schemas/condition.schema';

export function validateConditionKnowledge(entry: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof entry !== 'object' || entry === null) {
    return { valid: false, errors: ['Entry is not an object'], warnings: [] };
  }

  const record = entry as Record<string, unknown>;

  // Required fields presence
  for (const field of CONDITION_REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const typed = entry as ConditionKnowledge;

  // diagnosisKey must be a non-empty string
  if (typeof typed.diagnosisKey !== 'string' || typed.diagnosisKey.trim() === '') {
    errors.push('diagnosisKey must be a non-empty string');
  }

  // displayName and shortName
  if (typeof typed.displayName !== 'string' || typed.displayName.trim() === '') {
    errors.push('displayName must be a non-empty string');
  }
  if (typeof typed.shortName !== 'string' || typed.shortName.trim() === '') {
    errors.push('shortName must be a non-empty string');
  }

  // evidenceLevel must be a valid value
  if (!EVIDENCE_LEVELS.includes(typed.evidenceLevel)) {
    errors.push(`evidenceLevel "${typed.evidenceLevel}" is not a valid EvidenceLevel`);
  }

  // lastReviewed must be ISO date
  if (!ISO_DATE_REGEX.test(typed.lastReviewed)) {
    errors.push(`lastReviewed "${typed.lastReviewed}" must be in YYYY-MM-DD format`);
  }

  // Array minimum length checks
  for (const [field, minimum] of Object.entries(CONDITION_ARRAY_MINIMUMS)) {
    const value = record[field];
    if (!Array.isArray(value) && !(value && typeof value === 'object' && 'length' in value)) {
      errors.push(`"${field}" must be an array`);
    } else {
      const arr = value as unknown[];
      if (arr.length < minimum) {
        errors.push(`"${field}" must contain at least ${minimum} item(s); found ${arr.length}`);
      }
    }
  }

  // Confidence factor weight bounds
  for (const cf of typed.confidenceFactors) {
    if (typeof cf.weight !== 'number' || cf.weight < CONFIDENCE_WEIGHT_MIN || cf.weight > CONFIDENCE_WEIGHT_MAX) {
      errors.push(
        `ConfidenceFactor "${cf.factor}" weight ${cf.weight} must be between ${CONFIDENCE_WEIGHT_MIN} and ${CONFIDENCE_WEIGHT_MAX}`
      );
    }
  }

  // Warn if no contraindications are listed (may be intentional for benign conditions)
  if (typed.contraindications.length === 0) {
    warnings.push('No contraindications listed — confirm this is intentional for this condition');
  }

  // Warn if mechanisms are generic
  for (const mechanism of typed.mechanisms) {
    if (mechanism.pathway.trim() === '') {
      warnings.push(`Mechanism "${mechanism.label}" has an empty pathway — should include biochemical chain`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Throws an error if the entry is invalid.
 * Use in registry index files to prevent invalid entries from being loaded.
 */
export function assertValidConditionKnowledge(entry: unknown, context = ''): void {
  const result = validateConditionKnowledge(entry);
  if (!result.valid) {
    const prefix = context ? `[${context}] ` : '';
    throw new Error(
      `${prefix}Invalid ConditionKnowledge entry:\n${result.errors.join('\n')}`
    );
  }
}
