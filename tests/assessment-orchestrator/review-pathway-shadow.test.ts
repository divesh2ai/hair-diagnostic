import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyReviewPathway, REVIEW_PATHWAY_CLASSIFIER_VERSION, REVIEW_PATHWAY_REASON_CODES, REVIEW_PATHWAYS } from "../../packages/shared/review-pathway";
import { evaluateAndPersistReviewPathway } from "../../src/packages/assessment-orchestrator/review-pathway/evaluateAndPersistReviewPathway";
import { buildReviewPathwayInput } from "../../src/packages/assessment-orchestrator/review-pathway/buildReviewPathwayInput";
import { computeReviewPathwaySource } from "../../src/packages/assessment-orchestrator/review-pathway/computeReviewPathwaySource";
import { persistReviewPathway } from "../../src/packages/assessment-orchestrator/review-pathway/persistReviewPathway";
import type { ClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/types";
import type { KitRecommendation } from "../../src/packages/ai-engine/kit-scorer/types";
import type { TherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/types";
import type { PatientAnswers } from "../../src/packages/types";

const baseAnswers: PatientAnswers = {
  sex: "female",
  age: 32,
  goal: [],
  hairtype: [],
  scalp: [],
  cause: [],
  immunity: [],
  thyroid: [],
  hormonal: [],
  gut: [],
  deficiency: [],
  diet: [],
  lifestyle: [],
  treatment: [],
  medical: "",
  medical_detail: "",
  is_pregnant: false,
};

const baseClinical: ClinicalProfile = {
  primaryDiagnosis: "AGA_FEMALE_123",
  primaryScore: 0,
  secondaryDiagnoses: [],
  allScores: {},
  scalpStates: [],
  rootCauses: [],
  severity: "MILD",
  flags: {
    isRegrowGoal: false,
    hasGreyGoal: false,
    hasHairGoal: true,
    isVeg: false,
    isMale: false,
    isPregnant: false,
    isGrade45: false,
    isGrade123: true,
    hasActiveShedding: false,
    hasNoVisibleFall: true,
    hasGLP1Early: false,
    hasGLP1Late: false,
    hasCrashDiet: false,
    age: 32,
    goal: "",
    grade: "",
    count: "",
    duration: "",
  },
};

const baseTherapy: TherapyNeeds = {
  needs: [],
  needReasons: {},
};

const baseRecommendations: KitRecommendation = {
  rankedKits: [],
  protocolLabel: "",
  protocolRationale: "",
  selectionJustification: "",
  appliedRules: [],
  ruleTrace: [],
  adjunctProtocol: {
    scalpCorrection: [],
    follicularSupport: [],
    barrierRepair: [],
    lifestyleInterventions: [],
    validationWarnings: [],
  },
} as unknown as KitRecommendation;

function makeArgs(overrides: Partial<Parameters<typeof evaluateAndPersistReviewPathway>[0]> = {}) {
  return {
    prisma: {
      assessment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    } as unknown as PrismaClient,
    assessmentId: "asm-shadow-1",
    clinicId: "clinic-1",
    evaluatedFrom: "PHASE_A" as const,
    assessmentStatus: "CLINICAL_READY",
    consultationExists: false,
    answers: baseAnswers,
    clinical: baseClinical,
    therapy: baseTherapy,
    recommendations: baseRecommendations,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("review pathway shadow persistence", () => {
  it("stays disabled without writing when the shadow flag is off", async () => {
    vi.stubEnv("FEATURE_REVIEW_PATHWAY_SHADOW", "false");
    const args = makeArgs();
    const persist = vi.fn();

    const result = await evaluateAndPersistReviewPathway(args, {
      persist,
      logEvent: vi.fn(),
      classifier: classifyReviewPathway,
    });

    expect(result.action).toBe("DISABLED");
    expect(persist).not.toHaveBeenCalled();
    expect((args.prisma.assessment.findUnique as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("skips an unchanged source without persisting again", async () => {
    vi.stubEnv("FEATURE_REVIEW_PATHWAY_SHADOW", "true");
    const args = makeArgs();
    const built = buildReviewPathwayInput(args);
    const source = computeReviewPathwaySource({
      ...built,
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      evaluatedFrom: "PHASE_A",
    });

    (args.prisma.assessment.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      reviewPathwayVersion: source.classifierVersion,
      reviewPathwaySource: { sourceSignature: source.sourceSignature },
    });

    const persist = vi.fn();
    const result = await evaluateAndPersistReviewPathway(args, {
      persist,
      logEvent: vi.fn(),
      classifier: classifyReviewPathway,
    });

    expect(result.action).toBe("SKIPPED");
    expect(result.skipReason).toBe("UNCHANGED");
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails closed when persistence rejects", async () => {
    vi.stubEnv("FEATURE_REVIEW_PATHWAY_SHADOW", "true");
    const args = makeArgs();
    (args.prisma.assessment.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const persist = vi.fn().mockRejectedValue(new Error("db down"));

    const result = await evaluateAndPersistReviewPathway(args, {
      persist,
      logEvent: vi.fn(),
      classifier: classifyReviewPathway,
    });

    expect(result.action).toBe("FAILED");
    expect(result.errorCode).toBe("Error");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("persists review pathway fields on Assessment", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      assessment: { update },
    } as unknown as PrismaClient;
    const source = computeReviewPathwaySource({
      ...buildReviewPathwayInput(makeArgs()),
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      evaluatedFrom: "PHASE_A",
    });
    const evaluatedAt = new Date("2026-07-09T00:00:00.000Z");

    await persistReviewPathway(prisma, {
      assessmentId: "asm-write-1",
      decision: {
        classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
        pathway: REVIEW_PATHWAYS.FOCUSED_REVIEW,
        reasonCodes: [REVIEW_PATHWAY_REASON_CODES.FOCUSED_PREGNANCY],
      },
      source,
      evaluatedAt,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "asm-write-1" },
      data: {
        reviewPathway: REVIEW_PATHWAYS.FOCUSED_REVIEW,
        reviewPathwayReasons: [REVIEW_PATHWAY_REASON_CODES.FOCUSED_PREGNANCY],
        reviewPathwayVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
        reviewPathwayEvaluatedAt: evaluatedAt,
      },
    });
    expect(update.mock.calls[0]?.[0]?.data.reviewPathwaySource).toMatchObject({
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      sourceSignature: source.sourceSignature,
    });
  });
});
