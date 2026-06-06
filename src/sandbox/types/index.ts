// ─────────────────────────────────────────────────────────────────────────────
// HairOS Clinical Validation System — Shared Types
// Single source of truth for all sandbox, regression, and QA types.
// ─────────────────────────────────────────────────────────────────────────────

import type { PatientAnswers, DiagnosisKey, ScalpState, RootCause, TherapyNeed, Severity } from "../../packages/types";

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT FIXTURE — Full-schema fixture format
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientDemographics {
  id: string;
  name: string;
  age: number;
  sex: "Male" | "Female";
  description: string;
}

export interface ExpectedClinicalSignals {
  diagnoses: DiagnosisKey[];
  scalpStates: ScalpState[];
  rootCauses: RootCause[];
  therapyNeeds: TherapyNeed[];
  severity: Severity;
}

export interface ExpectedRecommendations {
  topKit: string;
  mustIncludeKits: string[];
  mustExcludeKits: string[];
  mustTriggerRules: string[];
  mustBlockRules: string[];
  protocolLabel?: string;
}

export interface ExpectedNarrativePatterns {
  doctorNarrativeMustContain: string[];
  patientNarrativeMustContain: string[];
  mustNotContain?: string[];
}

/** Full production fixture schema for regression, QA, and sandbox use. */
export interface ClinicalPatientFixture {
  patient: PatientDemographics;
  questionnaireAnswers: PatientAnswers;
  expectedClinicalSignals: ExpectedClinicalSignals;
  expectedRecommendations: ExpectedRecommendations;
  expectedNarrativePatterns: ExpectedNarrativePatterns;
  /** Optional budget tier override. Defaults to STANDARD. */
  budget?: "ESSENTIAL" | "STANDARD" | "COMPREHENSIVE";
  /** Free-form clinical notes for human auditors. */
  clinicalNotes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION FLOW VALIDATOR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type QuestionId = string;

export type BranchTrigger =
  | "GENDER_MALE"
  | "GENDER_FEMALE"
  | "RECENT_ILLNESS_YES"
  | "POSTPARTUM_YES"
  | "HORMONAL_ACTIVE"
  | "AGE_FILTER"
  | "CONDITIONAL_VISIBLE";

export interface QuestionFlowStep {
  questionId: QuestionId;
  presented: boolean;
  skipped: boolean;
  skipReason?: BranchTrigger | string;
  answeredWith?: string | string[];
}

export interface BranchingPath {
  trigger: BranchTrigger;
  affectedQuestions: QuestionId[];
  result: "SHOWN" | "HIDDEN";
}

export interface QuestionFlowTrace {
  totalQuestionsInSchema: number;
  questionsPresented: QuestionId[];
  questionsSkipped: QuestionId[];
  branchingPath: BranchingPath[];
  steps: QuestionFlowStep[];
}

export interface FlowValidationResult {
  passed: boolean;
  errors: FlowValidationError[];
  warnings: FlowValidationWarning[];
  trace: QuestionFlowTrace;
}

export interface FlowValidationError {
  code: string;
  message: string;
  questionId?: QuestionId;
}

export interface FlowValidationWarning {
  code: string;
  message: string;
  questionId?: QuestionId;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZATION VALIDATOR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizationCheckResult {
  field: string;
  input: unknown;
  output: unknown;
  passed: boolean;
  reason?: string;
}

export interface NormalizationValidationReport {
  passed: boolean;
  checks: NormalizationCheckResult[];
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION ENGINE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DriftSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface DriftItem {
  field: string;
  severity: DriftSeverity;
  oldValue: unknown;
  newValue: unknown;
  description: string;
}

export interface MissingOutputItem {
  field: string;
  expectedValue: unknown;
  description: string;
  severity: DriftSeverity;
}

export interface BaselineOutput {
  fixtureId: string;
  generatedAt: string;
  pipelineVersion: string;
  primaryDiagnosis: string;
  scalpStates: string[];
  rootCauses: string[];
  therapyNeeds: string[];
  severity: string;
  rankedKitIds: string[];
  appliedRules: string[];
  protocolLabel: string;
  doctorNarrativeHash?: string;
  patientNarrativeHash?: string;
}

export interface RegressionComparisonResult {
  fixtureId: string;
  passed: boolean;
  criticalFailures: number;
  totalDrifts: number;
  drifts: DriftItem[];
  missingOutputs: MissingOutputItem[];
  regressionSummary: string;
  comparedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFF ENGINE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DiffOperation = "EQUAL" | "ADDED" | "REMOVED" | "CHANGED";

export interface TextDiffChunk {
  operation: DiffOperation;
  value: string;
}

export interface ListDiff<T = string> {
  added: T[];
  removed: T[];
  unchanged: T[];
}

export interface ArtifactDiff {
  field: string;
  oldValue: string | string[] | null;
  newValue: string | string[] | null;
  diffChunks?: TextDiffChunk[];
  listDiff?: ListDiff;
  hasDifference: boolean;
}

export interface ArtifactDiffReport {
  fixtureId: string;
  diffs: ArtifactDiff[];
  totalChanges: number;
  hasRegressions: boolean;
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATION VALIDATOR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type OrchestrationStage =
  | "questionnaire"
  | "clinical"
  | "therapy"
  | "recommendations"
  | "narratives"
  | "pdf";

export interface OrchestrationStageResult {
  stage: OrchestrationStage;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "PENDING";
  durationMs: number;
  error?: string;
}

export interface OrchestrationValidationReport {
  executionId: string;
  passed: boolean;
  stages: OrchestrationStageResult[];
  totalDurationMs: number;
  errors: string[];
  warnings: string[];
  validatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT VALIDATOR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportSection {
  sectionId: string;
  label: string;
  present: boolean;
  minLength?: number;
  actualLength?: number;
}

export interface ReportValidationResult {
  passed: boolean;
  sections: ReportSection[];
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// QA SESSION — Full session state for the sandbox dashboard
// ─────────────────────────────────────────────────────────────────────────────

export type QASessionStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING";

export interface QASessionResult {
  sessionId: string;
  fixtureId: string;
  status: QASessionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  flowValidation?: FlowValidationResult;
  normalizationValidation?: NormalizationValidationReport;
  regressionComparison?: RegressionComparisonResult;
  orchestrationValidation?: OrchestrationValidationReport;
  reportValidation?: ReportValidationResult;
  artifactDiff?: ArtifactDiffReport;
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// QA DASHBOARD API PAYLOAD
// ─────────────────────────────────────────────────────────────────────────────

export interface QADashboardSummary {
  totalFixtures: number;
  passed: number;
  failed: number;
  warnings: number;
  lastRunAt: string | null;
  sessions: QASessionResult[];
}
