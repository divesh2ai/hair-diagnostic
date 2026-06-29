export type AssessmentProcessingStatus =
  | "PENDING"
  | "QUEUED"
  | "NORMALIZING"
  | "RUNNING_CLINICAL_ENGINE"
  | "GENERATING_RECOMMENDATIONS"
  | "GENERATING_NARRATIVE"
  | "GENERATING_VIDEO_SCRIPT"
  | "RENDERING_VIDEO"
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
  | "PIPELINE_RUNTIME"
  | "VIDEO_SCRIPT"
  | "AVATAR_VIDEO";

export type VideoExperienceState = "PENDING" | "RENDERING" | "READY" | "UNAVAILABLE";

export interface VideoExperienceBlock {
  state: VideoExperienceState;
  url: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
}

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

export interface NarrativeSection {
  full: string;
  short: string;
  segments: Array<{ label: string; text: string }>;
  length: "brief" | "detailed" | string;
  target: string;
  locale: string;
  generatedAt: string;
}

export interface EnrichedTherapyNeed {
  need: string;
  title: string;
  clinicalRationale: string;
  patientExplanation: string;
}

export interface EnrichedRootCause {
  cause: string;
  title: string;
  clinicalContext: string;
  patientFriendly: string;
}

export interface AssessmentNarratives {
  executiveSummary: string;
  doctorNarrative: NarrativeSection;
  patientNarrative: NarrativeSection;
  therapyExplanation: NarrativeSection;
  lifestylePlan: NarrativeSection;
  prognosis: NarrativeSection;
  monitoringPlan: NarrativeSection;
  enrichedTherapyNeeds: EnrichedTherapyNeed[];
  enrichedRootCauses: EnrichedRootCause[];
  /** V4 structured clinical report — patient summary, treatment strategy, roadmap, etc. */
  clinicalReport?: Record<string, unknown> | null;
  /**
   * Runtime-agnostic 5-chapter DoctorConsultationScript produced by the
   * narrative pipeline. Drives the DoctorConsultationViewer at the top of
   * the patient report. Typed as `unknown` here to keep the shared types
   * package free of ai-engine imports; the viewer casts at the boundary.
   */
  doctorConsultation?: Record<string, unknown> | null;
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
  narratives?: AssessmentNarratives | null;
  video?: VideoExperienceBlock;
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
  narratives: AssessmentNarratives | null;
  video: VideoExperienceBlock;
  processing: AssessmentProcessingState;
  events: AssessmentEventPayload[];
  orchestrationLogs: AssessmentOrchestrationLog[];
}
