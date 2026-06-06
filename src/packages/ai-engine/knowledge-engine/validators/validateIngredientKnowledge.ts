import type { IngredientKnowledge, ValidationResult } from '../types';
import {
  INGREDIENT_REQUIRED_FIELDS,
  INGREDIENT_ARRAY_MINIMUMS,
  INGREDIENT_CATEGORIES,
  INTERACTION_TYPES,
} from '../schemas/ingredient.schema';
import { EVIDENCE_LEVELS } from '../schemas/condition.schema';

export function validateIngredientKnowledge(entry: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof entry !== 'object' || entry === null) {
    return { valid: false, errors: ['Entry is not an object'], warnings: [] };
  }

  const record = entry as Record<string, unknown>;

  for (const field of INGREDIENT_REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const typed = entry as IngredientKnowledge;

  if (typeof typed.ingredientId !== 'string' || typed.ingredientId.trim() === '') {
    errors.push('ingredientId must be a non-empty string');
  }

  if (!INGREDIENT_CATEGORIES.includes(typed.category as typeof INGREDIENT_CATEGORIES[number])) {
    errors.push(`category "${typed.category}" is not a valid IngredientCategory`);
  }

  if (!EVIDENCE_LEVELS.includes(typed.evidenceLevel)) {
    errors.push(`evidenceLevel "${typed.evidenceLevel}" is not a valid EvidenceLevel`);
  }

  for (const [field, minimum] of Object.entries(INGREDIENT_ARRAY_MINIMUMS)) {
    const value = record[field] as unknown[];
    if (!Array.isArray(value)) {
      errors.push(`"${field}" must be an array`);
    } else if (value.length < minimum) {
      errors.push(`"${field}" must have at least ${minimum} item(s); found ${value.length}`);
    }
  }

  for (const interaction of typed.interactions) {
    if (!INTERACTION_TYPES.includes(interaction.type as typeof INTERACTION_TYPES[number])) {
      errors.push(`Interaction type "${interaction.type}" is invalid`);
    }
  }

  if (!typed.dosageGuidance.unit || !typed.dosageGuidance.frequency) {
    warnings.push('dosageGuidance is missing unit or frequency');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidIngredientKnowledge(entry: unknown, context = ''): void {
  const result = validateIngredientKnowledge(entry);
  if (!result.valid) {
    const prefix = context ? `[${context}] ` : '';
    throw new Error(
      `${prefix}Invalid IngredientKnowledge entry:\n${result.errors.join('\n')}`
    );
  }
}
