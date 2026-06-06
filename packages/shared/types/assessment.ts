export type AssessmentProcessingStatus =
  | "PENDING"
  | "QUEUED"
  | "NORMALIZING"
  | "RUNNING_CLINICAL_ENGINE"
  | "GENERATING_RECOMMENDATIONS"
  | "GENERATING_REPORT"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL_FAILURE";

export type AssessmentArtifactType =
  | "CLINICAL_REASONING"
  | "SEVERITY_ANALYSIS"
  | "RECOMMENDATIONS"
  | "NARRATIVES"
  | "REPORT"
  | "THERAPY_PLAN"
  | "VISUAL_JOURNEY"
  | "PIPELINE_RUNTIME";

export interface AssessmentArtifact {
  id: string;
  type: AssessmentArtifactType | string;
  content: unknown;
  createdAt: string;
  generationMs: number | null;
  schemaVersion?: string | null;
  engineVersion?: string | null;
}

export interface AssessmentEventPayload {
  id: string;
  type: string;
  stage: string | null;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface AssessmentOrchestrationLog {
  id: string;
  stage: string;
  status: string;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface AssessmentProcessingState {
  status: AssessmentProcessingStatus;
  progressPercent: number;
  isStuck: boolean;
  stage: string | null;
  executionId: string | null;
  retryCount: number;
  lastCompletedStage: string | null;
  lastError: string | null;
  errors: string[];
}

export interface AssessmentStatusResponse {
  success: boolean;
  assessmentId?: string;
  status?: AssessmentProcessingStatus | string;
  progressPercent?: number;
  isStuck?: boolean;
  startedAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  artifacts?: Record<string, AssessmentArtifact> | AssessmentArtifact[];
  artifactPresence?: Record<string, boolean>;
  timing?: {
    queueLatencyMs: number | null;
    orchestrationDurationMs: number | null;
  };
  errors?: string[];
  events?: AssessmentEventPayload[];
  orchestration?: {
    stage: string | null;
    executionId: string | null;
    retryCount: number;
    lastCompletedStage: string | null;
    logs: AssessmentOrchestrationLog[];
  };
  error?: string;
}

export interface AssessmentReportPayload {
  assessmentId: string;
  status: AssessmentProcessingStatus | string;
  progressPercent: number;
  isStuck: boolean;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  patient?: {
    name?: string | null;
    age?: number | null;
    gender?: string | null;
  };
  clinic?: {
    name?: string | null;
  };
  artifacts: AssessmentArtifact[];
  artifactByType: Record<string, AssessmentArtifact>;
  artifactPresence: Record<string, boolean>;
  processing: AssessmentProcessingState;
  events: AssessmentEventPayload[];
  orchestrationLogs: AssessmentOrchestrationLog[];
}
