import type { AssessmentPipelineResult } from "../../packages/orchestration/types";

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
}

export interface PipelineIntegrityReport {
  readonly passed: boolean;
  readonly warnings: readonly ValidationWarning[];
  readonly errors: readonly ValidationError[];
  readonly validatedAt: string;
}

export function validatePipelineIntegrity(
  result: AssessmentPipelineResult,
): PipelineIntegrityReport {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];

  if (!result) {
    errors.push({ code: "MISSING_RESULT", message: "Pipeline result is entirely undefined.", stage: "orchestration" });
    return { passed: false, warnings, errors, validatedAt: new Date().toISOString() };
  }

  validateRuntime(result, warnings, errors);
  validateClinical(result, warnings, errors);
  validateTherapy(result, warnings, errors);
  validateRecommendations(result, warnings, errors);
  validateNarratives(result, warnings, errors);
  validateCrossEngineCoherence(result, warnings, errors);

  return {
    passed: errors.length === 0,
    warnings,
    errors,
    validatedAt: new Date().toISOString(),
  };
}

function validateRuntime(
  result: AssessmentPipelineResult,
  warnings: ValidationWarning[],
  errors: ValidationError[]
): void {
  const rt = result.runtime;
  if (!rt) {
    errors.push({ code: "RT_MISSING", message: "Runtime metadata is missing.", stage: "orchestration" });
    return;
  }

  if (!rt.executionId) errors.push({ code: "RT_NO_EXEC_ID", message: "Execution ID is missing.", stage: "orchestration" });
  if (rt.durationMs === undefined || rt.durationMs < 0) errors.push({ code: "RT_INVALID_DURATION", message: "Invalid duration.", stage: "orchestration" });

  const requiredStages = ["questionnaire", "clinical", "therapy", "recommendations", "narratives"];
  const completed = rt.completedStages || [];

  for (const stage of requiredStages) {
    if (!completed.includes(stage as any)) {
      errors.push({ code: "RT_STAGE_MISSING", message: `Required stage incomplete: ${stage}`, stage: "orchestration" });
    }
  }
}

function validateClinical(
  result: AssessmentPipelineResult,
  warnings: ValidationWarning[],
  errors: ValidationError[]
): void {
  const clinical = result.clinical;
  if (!clinical) {
    errors.push({ code: "CLINICAL_MISSING", message: "Clinical profile is missing.", stage: "clinical" });
    return;
  }

  if (!clinical.primaryDiagnosis) {
    errors.push({ code: "CLINICAL_NO_DIAGNOSIS", message: "Primary diagnosis is missing.", stage: "clinical" });
  }
  if (!clinical.severity) {
    errors.push({ code: "CLINICAL_NO_SEVERITY", message: "Severity is missing.", stage: "clinical" });
  }
  if (clinical.primaryScore === undefined || clinical.primaryScore < 0) {
    warnings.push({ code: "CLINICAL_LOW_SCORE", message: "Primary score is missing or zero.", stage: "clinical" });
  }
}

function validateTherapy(
  result: AssessmentPipelineResult,
  warnings: ValidationWarning[],
  errors: ValidationError[]
): void {
  const therapy = result.therapy;
  if (!therapy) {
    errors.push({ code: "THERAPY_MISSING", message: "Therapy plan is missing.", stage: "therapy" });
    return;
  }

  if (!therapy.needs || therapy.needs.length === 0) {
    errors.push({ code: "THERAPY_NO_NEEDS", message: "Therapy needs are empty.", stage: "therapy" });
  }
}

function validateRecommendations(
  result: AssessmentPipelineResult,
  warnings: ValidationWarning[],
  errors: ValidationError[]
): void {
  const recs = result.recommendations;
  if (!recs) {
    errors.push({ code: "REC_MISSING", message: "Recommendation bundle is missing.", stage: "recommendations" });
    return;
  }

  if (!recs.rankedKits || recs.rankedKits.length === 0) {
    warnings.push({ code: "REC_NO_KITS", message: "No kits were recommended.", stage: "recommendations" });
  }
  if (!recs.protocolLabel) {
    errors.push({ code: "REC_NO_PROTOCOL", message: "Protocol label is missing.", stage: "recommendations" });
  }
}

function validateNarratives(
  result: AssessmentPipelineResult,
  warnings: ValidationWarning[],
  errors: ValidationError[]
): void {
  const nar = result.narratives;
  if (!nar) {
    errors.push({ code: "NAR_MISSING", message: "Narrative result is missing.", stage: "narratives" });
    return;
  }

  if (!nar.doctorSummary) errors.push({ code: "NAR_NO_DOCTOR", message: "Doctor summary missing.", stage: "narratives" });
  if (!nar.patientSummary) errors.push({ code: "NAR_NO_PATIENT", message: "Patient summary missing.", stage: "narratives" });
}

function validateCrossEngineCoherence(
  result: AssessmentPipelineResult,
  warnings: ValidationWarning[],
  errors: ValidationError[]
): void {
  const clinical = result.clinical;
  const therapy = result.therapy;
  const recs = result.recommendations;

  const isSevere = clinical?.severity === "SEVERE";
  const hasTherapy = (therapy?.needs?.length ?? 0) > 0;

  if (isSevere && !hasTherapy) {
    errors.push({ code: "COH_SEVERE_NO_THERAPY", message: "Severe condition detected without corresponding therapies.", stage: "cross-engine" });
  }

  if (hasTherapy && (!recs?.rankedKits || recs.rankedKits.length === 0)) {
    warnings.push({ code: "COH_THERAPY_NO_PRODUCTS", message: "Therapy plan generated but no products recommended.", stage: "cross-engine" });
  }
}
