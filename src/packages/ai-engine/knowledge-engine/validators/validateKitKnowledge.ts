import type { KitKnowledge, ValidationResult } from '../types';
import {
  KIT_REQUIRED_FIELDS,
  KIT_ARRAY_MINIMUMS,
  KIT_COMPONENT_TYPES,
} from '../schemas/kit.schema';
import { EVIDENCE_LEVELS, ISO_DATE_REGEX } from '../schemas/condition.schema';

export function validateKitKnowledge(entry: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof entry !== 'object' || entry === null) {
    return { valid: false, errors: ['Entry is not an object'], warnings: [] };
  }

  const record = entry as Record<string, unknown>;

  for (const field of KIT_REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const typed = entry as KitKnowledge;

  if (typeof typed.kitId !== 'string' || typed.kitId.trim() === '') {
    errors.push('kitId must be a non-empty string');
  }

  if (!EVIDENCE_LEVELS.includes(typed.evidenceLevel)) {
    errors.push(`evidenceLevel "${typed.evidenceLevel}" is not a valid EvidenceLevel`);
  }

  if (!ISO_DATE_REGEX.test(typed.lastReviewed)) {
    errors.push(`lastReviewed "${typed.lastReviewed}" must be in YYYY-MM-DD format`);
  }

  for (const [field, minimum] of Object.entries(KIT_ARRAY_MINIMUMS)) {
    const value = record[field] as unknown[];
    if (!Array.isArray(value)) {
      errors.push(`"${field}" must be an array`);
    } else if (value.length < minimum) {
      errors.push(`"${field}" must have at least ${minimum} item(s); found ${value.length}`);
    }
  }

  for (const component of typed.components) {
    if (!KIT_COMPONENT_TYPES.includes(component.type as 'TOPICAL' | 'ORAL' | 'DEVICE')) {
      errors.push(`Component type "${component.type}" is invalid`);
    }
    if (!component.productId || !component.displayName) {
      errors.push(`Component missing productId or displayName`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidKitKnowledge(entry: unknown, context = ''): void {
  const result = validateKitKnowledge(entry);
  if (!result.valid) {
    const prefix = context ? `[${context}] ` : '';
    throw new Error(`${prefix}Invalid KitKnowledge entry:\n${result.errors.join('\n')}`);
  }
}
