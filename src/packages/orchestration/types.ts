import type { QuestionnaireSubmission } from "../ai-engine/questionnaire-engine";
import type { ClinicalProfile } from "../ai-engine/clinical-engine/types";
import type { TherapyNeeds } from "../ai-engine/therapy-engine/types";
import type { KitRecommendation } from "../ai-engine/kit-scorer/types";
import type { NarrativeResult } from "../ai-engine/explanations/types";

export type { QuestionnaireSubmission };

export type PipelineStage =
  | "questionnaire"
  | "clinical"
  | "therapy"
  | "recommendations"
  | "narratives";

export interface PipelineRuntimeMetadata {
  readonly pipelineVersion: string;
  readonly executionId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly completedStages: readonly PipelineStage[];
}

export interface AssessmentPipelineResult {
  readonly runtime: PipelineRuntimeMetadata;
  readonly clinical: ClinicalProfile;
  readonly therapy: TherapyNeeds;
  readonly recommendations: KitRecommendation;
  readonly narratives: NarrativeResult;
}
