import type { PDFPayload, ValidationResult } from '../types';

export function validatePDFPayload(payload: PDFPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!payload.version) errors.push('payload.version is required');
  if (!payload.generatedAt) errors.push('payload.generatedAt is required');
  if (!payload.patientRef) errors.push('payload.patientRef is required');

  if (!payload.doctorSections || payload.doctorSections.length === 0) {
    errors.push('payload.doctorSections must not be empty');
  }
  if (!payload.patientSections || payload.patientSections.length === 0) {
    errors.push('payload.patientSections must not be empty');
  }

  if (!payload.disclaimers || payload.disclaimers.length === 0) {
    errors.push('payload.disclaimers must not be empty — medical-legal requirement');
  }

  if (!payload.metadata) {
    errors.push('payload.metadata is required');
  }

  // Serialisation safety checks
  const serialised = JSON.stringify(payload);
  if (serialised.includes('"undefined"') || serialised.includes('undefined')) {
    warnings.push('payload may contain undefined values — verify before PDF rendering');
  }

  // Section content checks
  payload.doctorSections?.forEach((section, i) => {
    if (!section.id) errors.push(`doctorSections[${i}].id is required`);
    if (!section.title) errors.push(`doctorSections[${i}].title is required`);
    if (!section.content) warnings.push(`doctorSections[${i}].content is empty`);
  });

  payload.patientSections?.forEach((section, i) => {
    if (!section.id) errors.push(`patientSections[${i}].id is required`);
    if (!section.title) errors.push(`patientSections[${i}].title is required`);
    if (!section.content) warnings.push(`patientSections[${i}].content is empty`);
  });

  // Table validation
  payload.kitTables?.forEach((table, i) => {
    if (!table.title) warnings.push(`kitTables[${i}].title is missing`);
    if (!table.headers || table.headers.length === 0) {
      errors.push(`kitTables[${i}].headers is required`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
