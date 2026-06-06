import { randomUUID } from "node:crypto";

import { evaluateClinicalProfile } from "../ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../ai-engine/kit-scorer/scoreKits";
import { buildNarrative } from "../ai-engine/explanations/builders/buildNarrative";
import { OPEN_CLINIC } from "../../sandbox/loaders/fixtureLoader";
import { mapPortalToPatientAnswers } from "../assessment-orchestrator/mapPortalAnswers";

import type { QuestionnaireSubmission, PipelineStage, AssessmentPipelineResult } from "./types";
import { PipelineExecutionError } from "./errors";

const PIPELINE_VERSION = "1.0.0";

/**
 * Canonical HairOS functional pipeline.
 * Accepts a raw questionnaire submission, runs all clinical engines in sequence,
 * and returns the full typed result without touching the database.
 * Used by sandbox CLI and baseline generation scripts.
 */
export async function runAssessmentPipeline(
  submission: QuestionnaireSubmission
): Promise<AssessmentPipelineResult> {
  const executionId = randomUUID();
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const completedStages: PipelineStage[] = [];

  try {
    // Stage 1: Normalize raw submission into typed PatientAnswers
    const answers = mapPortalToPatientAnswers(submission as Record<string, unknown>);
    completedStages.push("questionnaire");

    // Stage 2: Clinical Detection
    const clinical = evaluateClinicalProfile(answers);
    completedStages.push("clinical");

    // Stage 3: Therapy Mapping
    const therapy = mapTherapyNeeds(clinical);
    completedStages.push("therapy");

    // Stage 4: Kit Recommendations
    const recommendations = scoreKits(clinical, therapy, answers, OPEN_CLINIC, {
      tier: "STANDARD",
      maxKits: 5,
    });
    completedStages.push("recommendations");

    // Stage 5: Narrative Generation
    const narratives = buildNarrative({
      clinicalProfile: clinical,
      therapyNeeds: therapy,
      kitRecommendation: recommendations,
      narrativeLength: "detailed",
    });
    completedStages.push("narratives");

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;

    return {
      runtime: {
        pipelineVersion: PIPELINE_VERSION,
        executionId,
        startedAt,
        completedAt,
        durationMs,
        completedStages,
      },
      clinical,
      therapy,
      recommendations,
      narratives,
    };
  } catch (error: unknown) {
    const failedStage = determineFailedStage(completedStages);
    throw new PipelineExecutionError(
      `Pipeline execution failed at stage: ${failedStage}`,
      failedStage,
      executionId,
      error
    );
  }
}

function determineFailedStage(completed: readonly PipelineStage[]): PipelineStage {
  if (!completed.includes("questionnaire")) return "questionnaire";
  if (!completed.includes("clinical")) return "clinical";
  if (!completed.includes("therapy")) return "therapy";
  if (!completed.includes("recommendations")) return "recommendations";
  return "narratives";
}
