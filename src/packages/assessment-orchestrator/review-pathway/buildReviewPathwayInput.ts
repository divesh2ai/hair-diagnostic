import type { KitRecommendation } from "../../ai-engine/kit-scorer/types";
import type { ClinicalProfile } from "../../ai-engine/clinical-engine/types";
import type { TherapyNeeds } from "../../ai-engine/therapy-engine/types";
import type { PatientAnswers } from "../../types";
import type {
  ReviewPathwayClassifierInput,
  ReviewReadinessSnapshot,
} from "@shared/review-pathway";

export type ReviewPathwayEvaluationFrom = "PHASE_A" | "CONSULTATION_RECOMPUTE" | "DRY_RUN";
export type ReviewPathwaySnapshotState = "ABSENT" | "VALID" | "MALFORMED";

export interface ReviewPathwayBuildArgs {
  readonly assessmentStatus: string | null | undefined;
  readonly consultationExists: boolean;
  readonly readinessSnapshot?: unknown;
  readonly answers: PatientAnswers;
  readonly clinical: ClinicalProfile;
  readonly therapy: TherapyNeeds;
  readonly recommendations: KitRecommendation;
}

export interface ReviewPathwayBuildResult {
  readonly classifierInput: ReviewPathwayClassifierInput;
  readonly normalizedInput: Record<string, unknown>;
  readonly consultationExists: boolean;
  readonly readinessSnapshotState: ReviewPathwaySnapshotState;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function collectStrings(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => collectStrings(entry));
  if (typeof value === "string") return [normalizeText(value)];
  return [normalizeText(String(value))];
}

function sortedUniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.flatMap((value) => collectStrings(value)).filter(Boolean))).sort();
}



function isValidReadinessSnapshot(value: unknown): value is ReviewReadinessSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schemaVersion === 1 &&
    typeof snapshot.isReadyForApproval === "boolean" &&
    Array.isArray(snapshot.groundingViolations) &&
    Array.isArray(snapshot.reasoningGaps)
  );
}

function normalizeReadinessSnapshotForSource(snapshot: ReviewReadinessSnapshot): Record<string, unknown> {
  return {
    schemaVersion: snapshot.schemaVersion,
    isReadyForApproval: snapshot.isReadyForApproval,
    groundingViolationCount: snapshot.groundingViolations.length,
    reasoningGapCount: snapshot.reasoningGaps.length,
    approvalBlocked: snapshot.approvalBlocked === true,
  };
}

function normalizeList(values: unknown): string[] {
  return sortedUniqueStrings(Array.isArray(values) ? values : [values]);
}

function buildAnswerSignals(answers: PatientAnswers): Record<string, unknown> {
  return {
    goal: normalizeList(answers.goal),
    hairtype: normalizeList(answers.hairtype),
    scalp: normalizeList(answers.scalp),
    cause: normalizeList(answers.cause),
    immunity: normalizeList(answers.immunity),
    thyroid: normalizeList(answers.thyroid),
    hormonal: normalizeList(answers.hormonal),
    gut: normalizeList(answers.gut),
    deficiency: normalizeList(answers.deficiency),
    diet: normalizeList(answers.diet),
    lifestyle: normalizeList(answers.lifestyle),
    treatment: normalizeList(answers.treatment),
    medical: normalizeList([answers.medical, answers.medical_detail]),
  };
}

function buildClinicalSignals(clinical: ClinicalProfile): Record<string, unknown> {
  return {
    primaryDiagnosis: clinical.primaryDiagnosis,
    rootCauses: [...new Set(clinical.rootCauses)].sort(),
    flags: {
      isPregnant: clinical.flags.isPregnant,
      hasActiveShedding: clinical.flags.hasActiveShedding,
      hasGLP1Early: clinical.flags.hasGLP1Early,
      hasGLP1Late: clinical.flags.hasGLP1Late,
      hasCrashDiet: clinical.flags.hasCrashDiet,
      isGrade45: clinical.flags.isGrade45,
      isGrade123: clinical.flags.isGrade123,
    },
  };
}

function buildTherapySignals(therapy: TherapyNeeds): Record<string, unknown> {
  return {
    needs: [...new Set(therapy.needs)].sort(),
  };
}

function buildRecommendationSignals(recommendations: KitRecommendation): Record<string, unknown> {
  return {
    appliedRules: [...new Set(recommendations.appliedRules)].sort(),
  };
}

export function buildReviewPathwayInput(args: ReviewPathwayBuildArgs): ReviewPathwayBuildResult {
  const answerSignals = buildAnswerSignals(args.answers);
  const answerValues = Object.values(answerSignals).flatMap((value) => (Array.isArray(value) ? value : [value]))
    .flatMap((value) => collectStrings(value));
  const answerText = answerValues.join(" | ");

  const clinicalSignals = buildClinicalSignals(args.clinical);
  const therapySignals = buildTherapySignals(args.therapy);
  const recommendationSignals = buildRecommendationSignals(args.recommendations);

  const clinicalFlags = args.clinical.flags;
  const rootCauses = new Set(args.clinical.rootCauses);
  const therapyNeeds = new Set(args.therapy.needs);
  const appliedRules = new Set(args.recommendations.appliedRules.map(normalizeText));

  const pregnancy =
    args.answers.is_pregnant === true ||
    clinicalFlags.isPregnant ||
    /pregnan/.test(answerText);
  const postpartumOrBreastfeeding =
    /post[- ]?partum/.test(answerText) ||
    /post[- ]?delivery/.test(answerText) ||
    /breastfeed|breast feed|lactat|feeding/.test(answerText);
  const heavyBleeding = /heavy bleeding/.test(answerText);
  const structuredIronOrNutritionalIndicators =
    rootCauses.has("IRON_DEFICIENCY") ||
    therapyNeeds.has("IRON_REPLETION") ||
    /iron|anaemi|anemi|nutriti|deficien/.test(answerText);
  const significantSheddingIndicators =
    clinicalFlags.hasActiveShedding ||
    /shedding|falling|fall out|diffuse/.test(answerText);
  const rapidWeightLoss =
    rootCauses.has("RAPID_WEIGHT_LOSS") ||
    clinicalFlags.hasCrashDiet ||
    /rapid weight|crash diet|weight loss/.test(answerText);
  const treatmentSelectionImpact =
    therapyNeeds.has("WEIGHT_LOSS_RECOVERY") ||
    Array.from(appliedRules).some((rule) => /glp1|weight_loss|crash/.test(rule));
  const rapidWeightLossTreatmentImpact = rapidWeightLoss && treatmentSelectionImpact;
  const glp1Use =
    clinicalFlags.hasGLP1Early ||
    clinicalFlags.hasGLP1Late ||
    /glp-1|glp1/.test(answerText);
  const glp1TreatmentImpact = glp1Use && treatmentSelectionImpact;
  const circularOrCoinSizedBaldPatches =
    /patchy|circular bald|coin sized|coin-sized|bald patch/.test(answerText);
  const selfReportedAlopeciaAreata = /alopecia areata/.test(answerText);
  const scalpBoilsOrPustules = /boil|pustule|pimple/.test(answerText);

  const menopause = /peri[- ]?menop|post[- ]?menop|menopaus/.test(answerText);
  const perimenopause = /peri[- ]?menop/.test(answerText);
  const postMenopause = /post[- ]?menop/.test(answerText);
  const pcos = /pcos|pcod|pmos/.test(answerText);
  const thyroid = /hypothyroid|hyperthyroid|thyroid/.test(answerText);
  const diabetes = /diabetes|diabetic/.test(answerText);
  const preDiabetes = /pre[- ]?diabetes|prediabetes/.test(answerText);
  const endometriosis = /endometriosis/.test(answerText);
  const majorGiCondition = /gerd|ibs|crohn|ulcer|colitis|acid reflux|gi condition|gut/.test(answerText);
  const medicationHistory = /medicat|prescription|drug history|ongoing meds/.test(answerText);
  const scalpBurning = /burning/.test(answerText);
  const scalpPsoriasisOrInflammation = /psoriasis|inflammation/.test(answerText);
  const scalpRednessOrIrritation = /redness|irritation/.test(answerText);

  const readinessSnapshotState: ReviewPathwaySnapshotState = args.consultationExists
    ? isValidReadinessSnapshot(args.readinessSnapshot)
      ? "VALID"
      : "MALFORMED"
    : "ABSENT";

  const readinessSnapshot =
    readinessSnapshotState === "VALID" ? (args.readinessSnapshot as ReviewReadinessSnapshot) : undefined;

  const classifierInput: ReviewPathwayClassifierInput = {
    consultationExists: args.consultationExists,
    assessmentStatus: args.assessmentStatus ?? null,
    readinessSnapshot,
    menopause,
    perimenopause,
    postMenopause,
    pcos,
    thyroid,
    diabetes,
    preDiabetes,
    endometriosis,
    majorGiCondition,
    medicationHistory,
    scalpBurning,
    scalpPsoriasisOrInflammation,
    scalpRednessOrIrritation,
    pregnancy,
    postpartumOrBreastfeeding,
    heavyBleeding,
    structuredIronOrNutritionalIndicators,
    significantSheddingIndicators,
    rapidWeightLoss,
    rapidWeightLossTreatmentImpact,
    glp1Use,
    glp1TreatmentImpact,
    circularOrCoinSizedBaldPatches,
    selfReportedAlopeciaAreata,
    scalpBoilsOrPustules,
  };

  return {
    classifierInput,
    normalizedInput: {
      assessmentStatus: args.assessmentStatus ?? null,
      consultationExists: args.consultationExists,
      readinessSnapshotState,
      answerSignals,
      clinicalSignals,
      therapySignals,
      recommendationSignals,
      pathwaySignals: {
        pregnancy,
        postpartumOrBreastfeeding,
        heavyBleeding,
        structuredIronOrNutritionalIndicators,
        significantSheddingIndicators,
        rapidWeightLoss,
        rapidWeightLossTreatmentImpact,
        glp1Use,
        glp1TreatmentImpact,
        circularOrCoinSizedBaldPatches,
        selfReportedAlopeciaAreata,
        scalpBoilsOrPustules,
      },
      normalizedReadinessSnapshot:
        readinessSnapshotState === "VALID"
          ? normalizeReadinessSnapshotForSource(readinessSnapshot!)
          : null,
    },
    consultationExists: args.consultationExists,
    readinessSnapshotState,
  };
}


