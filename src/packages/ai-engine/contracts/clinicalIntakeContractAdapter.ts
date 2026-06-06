import type { QuestionnaireProfile } from "../questionnaire-engine/types";

export class ClinicalContractValidationError extends Error {
  public readonly missingFields: string[];
  public readonly invalidEnumFields: Record<string, string>;
  public readonly executionId?: string;

  constructor(
    message: string,
    missingFields: string[],
    invalidEnumFields: Record<string, string>,
    executionId?: string
  ) {
    super(message);
    this.name = "ClinicalContractValidationError";
    this.missingFields = missingFields;
    this.invalidEnumFields = invalidEnumFields;
    this.executionId = executionId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClinicalContractValidationError);
    }
  }
}

export interface ClinicalIntakeContractV1 {
  readonly contractVersion: "v1.0.0";
  readonly demographics: {
    readonly age: number;
    readonly biologicalSex: "MALE" | "FEMALE" | "UNKNOWN";
  };
  readonly symptoms: {
    readonly primaryConcerns: readonly string[];
    readonly onsetDurationMonths: number;
    readonly scalpCondition: "NORMAL" | "OILY" | "DRY" | "INFLAMED" | "UNKNOWN";
  };
  readonly patternIndicators: {
    readonly ludwigScale: string;
    readonly norwoodScale: string;
    readonly thinningAreas: readonly string[];
  };
  readonly lifestyleRiskFactors: {
    readonly stressLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
    readonly dietQuality: "POOR" | "FAIR" | "GOOD" | "UNKNOWN";
    readonly smokingStatus: boolean;
  };
  readonly medicalHistoryFlags: {
    readonly familyHistoryOfHairLoss: boolean;
    readonly knownDeficiencies: readonly string[];
    readonly currentMedications: readonly string[];
  };
  readonly labMarkerSummary: Record<string, string>;
}

export function clinicalIntakeContractAdapter(
  input: QuestionnaireProfile,
  executionId?: string
): ClinicalIntakeContractV1 {
  const missingFields: string[] = [];
  const invalidEnumFields: Record<string, string> = {};

  if (!input) {
    throw new ClinicalContractValidationError(
      "Missing input questionnaire profile",
      ["input"],
      {},
      executionId
    );
  }

  // 1. Validate required structure exists
  if (!input.demographics) missingFields.push("demographics");
  if (!input.symptoms) missingFields.push("symptoms");
  if (!input.patternIndicators) missingFields.push("patternIndicators");
  if (!input.lifestyleRiskFactors) missingFields.push("lifestyleRiskFactors");
  if (!input.medicalHistoryFlags) missingFields.push("medicalHistoryFlags");
  if (!input.labMarkerSummary) missingFields.push("labMarkerSummary");

  if (missingFields.length > 0) {
    throw new ClinicalContractValidationError(
      "Clinical contract validation failed: Missing required structural components.",
      missingFields,
      invalidEnumFields,
      executionId
    );
  }

  // 2. Ensure enum normalization and conversion of invalid to safe defaults
  const normalizeSex = (val: string): "MALE" | "FEMALE" | "UNKNOWN" => {
    if (val === "MALE" || val === "FEMALE") return val;
    return "UNKNOWN";
  };

  const normalizeScalp = (val: string): "NORMAL" | "OILY" | "DRY" | "INFLAMED" | "UNKNOWN" => {
    if (["NORMAL", "OILY", "DRY", "INFLAMED"].includes(val)) return val as any;
    return "UNKNOWN";
  };

  const normalizeLevel = (val: string): "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" => {
    if (["LOW", "MEDIUM", "HIGH"].includes(val)) return val as any;
    return "UNKNOWN";
  };

  const normalizeDiet = (val: string): "POOR" | "FAIR" | "GOOD" | "UNKNOWN" => {
    if (["POOR", "FAIR", "GOOD"].includes(val)) return val as any;
    return "UNKNOWN";
  };

  return {
    contractVersion: "v1.0.0",
    demographics: {
      age: typeof input.demographics?.age === "number" ? input.demographics.age : 0,
      biologicalSex: normalizeSex(input.demographics?.biologicalSex),
    },
    symptoms: {
      primaryConcerns: Array.isArray(input.symptoms?.primaryConcerns) ? [...input.symptoms.primaryConcerns] : [],
      onsetDurationMonths: typeof input.symptoms?.onsetDurationMonths === "number" ? input.symptoms.onsetDurationMonths : 0,
      scalpCondition: normalizeScalp(input.symptoms?.scalpCondition),
    },
    patternIndicators: {
      ludwigScale: typeof input.patternIndicators?.ludwigScale === "string" ? input.patternIndicators.ludwigScale : "UNKNOWN",
      norwoodScale: typeof input.patternIndicators?.norwoodScale === "string" ? input.patternIndicators.norwoodScale : "UNKNOWN",
      thinningAreas: Array.isArray(input.patternIndicators?.thinningAreas) ? [...input.patternIndicators.thinningAreas] : [],
    },
    lifestyleRiskFactors: {
      stressLevel: normalizeLevel(input.lifestyleRiskFactors?.stressLevel),
      dietQuality: normalizeDiet(input.lifestyleRiskFactors?.dietQuality),
      smokingStatus: typeof input.lifestyleRiskFactors?.smokingStatus === "boolean" ? input.lifestyleRiskFactors.smokingStatus : false,
    },
    medicalHistoryFlags: {
      familyHistoryOfHairLoss: typeof input.medicalHistoryFlags?.familyHistoryOfHairLoss === "boolean" ? input.medicalHistoryFlags.familyHistoryOfHairLoss : false,
      knownDeficiencies: Array.isArray(input.medicalHistoryFlags?.knownDeficiencies) ? [...input.medicalHistoryFlags.knownDeficiencies] : [],
      currentMedications: Array.isArray(input.medicalHistoryFlags?.currentMedications) ? [...input.medicalHistoryFlags.currentMedications] : [],
    },
    labMarkerSummary: input.labMarkerSummary ? { ...input.labMarkerSummary } : {},
  };
}
