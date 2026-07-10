// Orchestrator integration test for the review-pathway shadow guard.
//
// Verifies the wiring added by Commit B without booting the entire pipeline.
// The guarded call has been extracted into `runReviewPathwayShadowGuarded` so
// its five behavioral contracts can be tested with mocks/spies at the module
// boundary — following the same "avoid the @react-pdf/renderer ESM chain"
// pattern used by tests/assessment-orchestrator/single-flight.test.ts and
// lease.test.ts.
//
// Ordering — the evaluator invocation occurring before the CLINICAL_READY
// lease-renew — is a lexical invariant of index.ts (the call sits inside the
// clinical_summary runStage callback, whose outer runPhaseA function only
// reaches its `renewLease({ status: CLINICAL_READY })` after the callback has
// resolved). That structural fact is asserted below via a file-content check
// so the test guards against accidental reordering.

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runReviewPathwayShadowGuarded } from "../../src/packages/assessment-orchestrator/review-pathway/runReviewPathwayShadowGuarded";
import { REVIEW_PATHWAYS, REVIEW_PATHWAY_CLASSIFIER_VERSION } from "../../packages/shared/review-pathway";
import type { ClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/types";
import type { KitRecommendation } from "../../src/packages/ai-engine/kit-scorer/types";
import type { TherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/types";
import type { PatientAnswers } from "../../src/packages/types";

/* ─── Fixtures ─────────────────────────────────────────────────────────── */

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

const ASSESSMENT_ID = "asm-integration-1";
const CLINIC_ID = "clinic-integration-1";

function makeArgs() {
  return {
    assessmentId: ASSESSMENT_ID,
    clinicId: CLINIC_ID,
    answers: baseAnswers,
    clinical: baseClinical,
    therapy: baseTherapy,
    recommendations: baseRecommendations,
  };
}

function makePrisma(): PrismaClient {
  return {} as unknown as PrismaClient;
}

/* ─── Shared spies ─────────────────────────────────────────────────────── */

let evaluator: ReturnType<typeof vi.fn>;
let logEvent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  evaluator = vi.fn().mockResolvedValue({
    assessmentId: ASSESSMENT_ID,
    pathway: REVIEW_PATHWAYS.ROUTINE_REVIEW,
    reasonCodes: [],
    classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
    sourceSignature: "sig-1",
    action: "WRITTEN",
  });
  logEvent = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ─── Tests ────────────────────────────────────────────────────────────── */

describe("review-pathway shadow integration (Commit B wiring)", () => {
  /* Case 1 — Correct ordering + argument shape */
  it("invokes the evaluator once with PHASE_A / CLINICAL_READY / consultationExists=false", async () => {
    await runReviewPathwayShadowGuarded(makePrisma(), makeArgs(), { evaluator, logEvent });

    expect(evaluator).toHaveBeenCalledTimes(1);
    const [callArgs, callDeps] = evaluator.mock.calls[0]!;
    expect(callArgs).toMatchObject({
      assessmentId: ASSESSMENT_ID,
      clinicId: CLINIC_ID,
      evaluatedFrom: "PHASE_A",
      consultationExists: false,
      assessmentStatus: "CLINICAL_READY",
    });
    // Payload is a strict superset — clinical/therapy/recommendations/answers threaded through.
    expect(callArgs.answers).toBe(baseAnswers);
    expect(callArgs.clinical).toBe(baseClinical);
    expect(callArgs.therapy).toBe(baseTherapy);
    expect(callArgs.recommendations).toBe(baseRecommendations);
    // Structured event logger wired in so the evaluator's internal
    // REVIEW_PATHWAY_* events reach the assessment event stream.
    expect(callDeps).toMatchObject({ logEvent });
  });

  it("guarantees the evaluator call is lexically before the outer CLINICAL_READY renewLease in runPhaseA", () => {
    // Structural invariant. runPhaseA's clinical_summary stage awaits the
    // guarded call inside its runStage callback; the outer renewLease that
    // sets status: CLINICAL_READY only runs after that callback resolves.
    // Any refactor that moves the call after the outer renewLease trips
    // this assertion.
    const indexPath = path.resolve(
      __dirname,
      "../../src/packages/assessment-orchestrator/index.ts",
    );
    const source = readFileSync(indexPath, "utf8");

    const helperCallLine = source.split("\n").findIndex((l) =>
      l.includes("runReviewPathwayShadowGuarded("),
    );
    const clinicalReadyRenewLine = source.split("\n").findIndex((l) =>
      l.includes("status: AssessmentStatus.CLINICAL_READY"),
    );

    expect(helperCallLine).toBeGreaterThan(-1);
    expect(clinicalReadyRenewLine).toBeGreaterThan(-1);
    expect(helperCallLine).toBeLessThan(clinicalReadyRenewLine);
  });

  /* Case 2 — Unexpected evaluator throw is isolated */
  it("does not propagate an unexpected evaluator throw; emits REVIEW_PATHWAY_INPUT_MALFORMED", async () => {
    evaluator.mockRejectedValue(new Error("classifier-boom"));

    // No throw should escape.
    await expect(
      runReviewPathwayShadowGuarded(makePrisma(), makeArgs(), { evaluator, logEvent }),
    ).resolves.toBeUndefined();

    expect(evaluator).toHaveBeenCalledTimes(1);
    // Structured event routed through the assessment event stream, not console.
    expect(logEvent).toHaveBeenCalledTimes(1);
    const [, assessmentId, eventType, opts] = logEvent.mock.calls[0]!;
    expect(assessmentId).toBe(ASSESSMENT_ID);
    expect(eventType).toBe("REVIEW_PATHWAY_INPUT_MALFORMED");
    expect(opts).toMatchObject({
      stage: "review_pathway",
      message: "classifier-boom",
      metadata: expect.objectContaining({
        assessmentId: ASSESSMENT_ID,
        clinicId: CLINIC_ID,
        evaluatedFrom: "PHASE_A",
        errorCode: "Error",
      }),
    });
  });

  it("swallows a logAssessmentEvent failure inside the catch so CLINICAL_READY is never blocked", async () => {
    evaluator.mockRejectedValue(new Error("classifier-boom"));
    logEvent.mockRejectedValue(new Error("event-stream-down"));

    // Even when the fallback event logger itself throws, the guard still resolves.
    await expect(
      runReviewPathwayShadowGuarded(makePrisma(), makeArgs(), { evaluator, logEvent }),
    ).resolves.toBeUndefined();
  });

  /* Case 3 — Feature disabled */
  it("resolves cleanly when the evaluator returns action=DISABLED (feature flag off)", async () => {
    evaluator.mockResolvedValue({
      assessmentId: ASSESSMENT_ID,
      pathway: REVIEW_PATHWAYS.ROUTINE_REVIEW,
      reasonCodes: [],
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      sourceSignature: "sig-disabled",
      action: "DISABLED",
    });

    await expect(
      runReviewPathwayShadowGuarded(makePrisma(), makeArgs(), { evaluator, logEvent }),
    ).resolves.toBeUndefined();

    // Evaluator was consulted (its DISABLED short-circuit is internal); no
    // failure event was emitted; caller can now proceed to CLINICAL_READY.
    expect(evaluator).toHaveBeenCalledTimes(1);
    expect(logEvent).not.toHaveBeenCalled();
  });

  /* Case 4 — SKIPPED (unchanged signature) */
  it("does not re-invoke the evaluator when it returns action=SKIPPED", async () => {
    evaluator.mockResolvedValue({
      assessmentId: ASSESSMENT_ID,
      pathway: REVIEW_PATHWAYS.ROUTINE_REVIEW,
      reasonCodes: [],
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      sourceSignature: "sig-unchanged",
      action: "SKIPPED",
      skipReason: "UNCHANGED",
    });

    await runReviewPathwayShadowGuarded(makePrisma(), makeArgs(), { evaluator, logEvent });

    expect(evaluator).toHaveBeenCalledTimes(1);
    expect(logEvent).not.toHaveBeenCalled();
  });

  /* Case 5 — No behavioral coupling */
  it("returns void regardless of pathway/reasonCodes/action (no downstream branching)", async () => {
    // Escalated result the classifier can emit.
    evaluator.mockResolvedValue({
      assessmentId: ASSESSMENT_ID,
      pathway: REVIEW_PATHWAYS.EXAMINATION_REQUIRED,
      reasonCodes: ["EXAM_SCALP_LESION"],
      classifierVersion: REVIEW_PATHWAY_CLASSIFIER_VERSION,
      sourceSignature: "sig-escalated",
      action: "WRITTEN",
    });

    const result = await runReviewPathwayShadowGuarded(
      makePrisma(),
      makeArgs(),
      { evaluator, logEvent },
    );

    // Contract: guard returns void. No pathway/reason data is exposed to the
    // caller, so index.ts cannot branch on the classifier decision.
    expect(result).toBeUndefined();
    expect(evaluator).toHaveBeenCalledTimes(1);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("guarantees the orchestrator does not consume any evaluator return field", () => {
    // Structural invariant: index.ts calls runReviewPathwayShadowGuarded as a
    // fire-and-continue statement — `await runReviewPathwayShadowGuarded(...)`
    // with no assignment. If a future refactor captures the return, this
    // check trips.
    const indexPath = path.resolve(
      __dirname,
      "../../src/packages/assessment-orchestrator/index.ts",
    );
    const source = readFileSync(indexPath, "utf8");
    // Match the call line and confirm it doesn't have a `const X = ` or `let X = `.
    const callLines = source
      .split("\n")
      .filter((l) => l.includes("runReviewPathwayShadowGuarded("));
    expect(callLines.length).toBeGreaterThan(0);
    for (const line of callLines) {
      expect(line).not.toMatch(/^(?:\s*)(?:const|let|var)\s+\w+\s*=\s*await\s+runReviewPathwayShadowGuarded/);
    }
  });
});
