import type { NarrativePipelineInput, ValidationResult } from '../types';

export function validateNarrativeContext(input: NarrativePipelineInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Patient ────────────────────────────────────────────────────────────────
  if (!input.patient) {
    errors.push('patient is required');
  } else {
    if (!input.patient.sex) errors.push('patient.sex is required');
    if (input.patient.age === undefined || input.patient.age === null) {
      errors.push('patient.age is required');
    }
    if (!input.patient.goal) errors.push('patient.goal is required');
  }

  // ── Clinical Profile ──────────────────────────────────────────────────────
  if (!input.clinicalProfile) {
    errors.push('clinicalProfile is required');
  } else {
    if (!input.clinicalProfile.primaryDiagnosis) {
      errors.push('clinicalProfile.primaryDiagnosis is required');
    }
    if (!input.clinicalProfile.severity) {
      errors.push('clinicalProfile.severity is required');
    }
    if (!Array.isArray(input.clinicalProfile.rootCauses)) {
      errors.push('clinicalProfile.rootCauses must be an array');
    }
    if (input.clinicalProfile.primaryScore < 0) {
      errors.push('clinicalProfile.primaryScore must be non-negative');
    }
  }

  // ── Therapy Plan ──────────────────────────────────────────────────────────
  if (!input.therapyPlan) {
    errors.push('therapyPlan is required');
  } else {
    if (!Array.isArray(input.therapyPlan.needs)) {
      errors.push('therapyPlan.needs must be an array');
    }
    if (input.therapyPlan.needs.length === 0) {
      warnings.push('therapyPlan.needs is empty — narrative may lack therapeutic specificity');
    }
  }

  // ── Kit Recommendation ────────────────────────────────────────────────────
  if (!input.kitRecommendation) {
    errors.push('kitRecommendation is required');
  } else {
    if (!Array.isArray(input.kitRecommendation.rankedKits)) {
      errors.push('kitRecommendation.rankedKits must be an array');
    }
    if (input.kitRecommendation.rankedKits.length === 0) {
      warnings.push('kitRecommendation.rankedKits is empty — kit narratives will not be generated');
    }
    if (!input.kitRecommendation.protocolLabel) {
      warnings.push('kitRecommendation.protocolLabel is missing');
    }
  }

  // ── Explanation Result ────────────────────────────────────────────────────
  if (!input.explanationResult) {
    errors.push('explanationResult is required');
  } else {
    if (!input.explanationResult.doctorSummary) {
      warnings.push('explanationResult.doctorSummary is empty');
    }
    if (!input.explanationResult.patientSummary) {
      warnings.push('explanationResult.patientSummary is empty');
    }
  }

  // ── Warnings for missing optional enrichment ──────────────────────────────
  if (!input.prognosis) {
    warnings.push('prognosis not provided — prognosis narrative will be generated from clinical data only');
  }
  if (!input.topicals || input.topicals.length === 0) {
    warnings.push('topicals not provided — topical ingredient details will not be included');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
