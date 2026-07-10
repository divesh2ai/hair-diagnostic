// Review-pathway shadow guard.
//
// Extracted so the try/catch around the shadow evaluator is unit-testable
// without booting the whole orchestrator (which pulls @react-pdf/renderer via
// the PDF engine — ESM, unloadable under jest and heavy under vitest).
//
// Semantics:
//   • Evaluator is invoked once with `evaluatedFrom: "PHASE_A"` and the
//     impending status `CLINICAL_READY`.
//   • Known evaluator failure modes (feature disabled, unchanged signature,
//     persist failure) are surfaced by the evaluator itself via its return
//     value and structured events — this wrapper does NOT branch on them.
//   • Any unexpected escaped throw is caught, logged through the assessment
//     event stream as REVIEW_PATHWAY_INPUT_MALFORMED, then swallowed. The
//     wrapper always resolves so the caller can proceed to CLINICAL_READY.
//   • Returns void — the pathway result must not influence downstream kit
//     selection, queue routing, PDF generation, or approval state.

import { AssessmentStatus, type PrismaClient } from "@prisma/client";
import type { evaluateClinicalProfile } from "../../ai-engine/clinical-engine/evaluateClinicalProfile";
import type { mapTherapyNeeds } from "../../ai-engine/therapy-engine/mapTherapyNeeds";
import type { scoreKits } from "../../ai-engine/kit-scorer/scoreKits";
import type { PatientAnswers } from "../../types";
import { logAssessmentEvent } from "../events";
import { evaluateAndPersistReviewPathway } from "./evaluateAndPersistReviewPathway";

export interface ReviewPathwayShadowArgs {
  readonly assessmentId: string;
  readonly clinicId: string;
  readonly answers: PatientAnswers;
  readonly clinical: ReturnType<typeof evaluateClinicalProfile>;
  readonly therapy: ReturnType<typeof mapTherapyNeeds>;
  readonly recommendations: ReturnType<typeof scoreKits>;
}

export interface ReviewPathwayShadowDeps {
  readonly evaluator?: typeof evaluateAndPersistReviewPathway;
  readonly logEvent?: typeof logAssessmentEvent;
}

export async function runReviewPathwayShadowGuarded(
  prismaClient: PrismaClient,
  args: ReviewPathwayShadowArgs,
  deps: ReviewPathwayShadowDeps = {},
): Promise<void> {
  const evaluator = deps.evaluator ?? evaluateAndPersistReviewPathway;
  const logEvent = deps.logEvent ?? logAssessmentEvent;

  try {
    await evaluator(
      {
        prisma: prismaClient,
        assessmentId: args.assessmentId,
        clinicId: args.clinicId,
        evaluatedFrom: "PHASE_A",
        consultationExists: false,
        assessmentStatus: AssessmentStatus.CLINICAL_READY,
        answers: args.answers,
        clinical: args.clinical,
        therapy: args.therapy,
        recommendations: args.recommendations,
      },
      { logEvent },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof Error && err.name ? err.name : "UnknownError";
    await logEvent(prismaClient, args.assessmentId, "REVIEW_PATHWAY_INPUT_MALFORMED", {
      stage: "review_pathway",
      message,
      metadata: {
        assessmentId: args.assessmentId,
        clinicId: args.clinicId,
        evaluatedFrom: "PHASE_A",
        errorCode,
      },
    }).catch(() => {
      // Best-effort structured event; never rethrow.
    });
  }
}
