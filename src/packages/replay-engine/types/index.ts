/**
 * Shared types for the HairOS Replay Execution Layer V1.
 *
 * All types are pure data — no behaviour. Engines depend on these
 * types and on the corpus schema (docs/replay-corpus-v2/HAIROS_REPLAY_CASE_SCHEMA.ts).
 *
 * NOTE: We intentionally re-declare the case shape here as a structural
 * type rather than importing the .ts schema from /docs to keep the
 * tsconfig include surface small. The shape MUST stay in lockstep with
 * HAIROS_REPLAY_CASE_SCHEMA.ts.
 */

export type Severity = "mild" | "moderate" | "severe";

export type PresentationClarity =
  | "clear"
  | "ambiguous"
  | "conflicting"
  | "edge_case";

export type FailureSeverity = "info" | "minor" | "major" | "critical";

export type FailureComponent =
  | "SIGNAL_FAILURE"
  | "PATHWAY_FAILURE"
  | "ROOTCAUSE_FAILURE"
  | "PROTOCOL_FAILURE"
  | "MONITORING_FAILURE"
  | "NARRATIVE_FAILURE"
  | "GOVERNANCE_FAILURE";

export interface ExpectedSignalAssertion {
  signalId: string;
  minConfidence: number;
  mustBePrimary?: boolean;
}

export interface ExpectedPathwayAssertion {
  pathwayId: string;
  minActivation: number;
  role: "leading" | "supporting" | "modulator";
}

export interface ExpectedRootCauseAssertion {
  causeId: string;
  minPosterior: number;
  surfaceAs: "lead" | "co-lead" | "candidate";
}

export interface ExpectedDiagnosis {
  primary: string;
  secondary?: string[];
  legacyDiagnosisKey: string;
  legacyDiagnosisKeyAlternates?: string[];
}

export interface ExpectedMonitoring {
  required: string[];
  recommended?: string[];
  forbidden?: string[];
}

export interface ExpectedNarrative {
  themes: string[];
  mustContainTokens?: string[];
  mustNotContainTokens?: string[];
}

export interface AdversarialMeta {
  isAdversarial: true;
  expectedPrimaryDriver: string;
  expectedSecondaryDrivers: string[];
  commonFailureModes: Array<{
    failureMode: string;
    impactedComponent:
      | "SIGNAL"
      | "PATHWAY"
      | "ROOTCAUSE"
      | "PROTOCOL"
      | "MONITORING"
      | "NARRATIVE";
    description: string;
  }>;
}

export interface QuestionnaireAnswers {
  sex: "Male" | "Female";
  age: string;
  goal: string[];
  grade?: string;
  scalp?: string[];
  cause?: string[];
  lifestyle?: string[];
  thyroid?: string[];
  hormonal?: string[];
  immunity?: string[];
  deficiency?: string[];
  gut?: string[];
  diet?: string[];
  hairtype?: string[];
  treatment?: string[];
  duration?: string;
  count?: string;
  extended?: Record<string, unknown>;
}

export interface ClinicalReplayCase {
  caseId: string;
  corpusVersion: string;
  description: string;
  category: string;
  severity: Severity;
  presentationClarity: PresentationClarity;
  demographicProfile: {
    sex: "Male" | "Female";
    age: string;
    region?: string | null;
    dietType?: "Vegetarian" | "Vegan" | "Mixed";
    bmiBand?: "underweight" | "normal" | "overweight" | "obese";
  };
  questionnaireAnswers: QuestionnaireAnswers;
  expectedSignals: ExpectedSignalAssertion[];
  expectedPathways: ExpectedPathwayAssertion[];
  expectedRootCauses: ExpectedRootCauseAssertion[];
  expectedDiagnosis: ExpectedDiagnosis;
  expectedSeverity: Severity;
  expectedProtocolClass: string;
  expectedTherapyNeeds: string[];
  expectedMonitoringRequirements: ExpectedMonitoring;
  expectedNarrativeThemes: ExpectedNarrative;
  clinicalRationale: {
    whyPrimary: string;
    whyNotCompetitors: Record<string, string>;
  };
  adversarial?: AdversarialMeta;
}

// ── Pipeline intermediates ────────────────────────────────────────────────

export interface ExtractedSignal {
  signalId: string;
  confidence: number;
  primary: boolean;
  source: "questionnaire" | "derived";
}

export interface ActivatedPathway {
  pathwayId: string;
  activation: number;
  contributingSignals: string[];
}

export interface CausePosterior {
  causeId: string;
  logScore: number;
  posterior: number;
}

export interface DiagnosisResult {
  primary: string;
  coExplanations: string[];
  legacyDiagnosisKey: string;
  severity: Severity;
  confidence: number;
}

export interface RootCauseResult {
  ranked: CausePosterior[];
  dissent: number; // top1 - top2
  compositeRuleSatisfied: boolean;
}

export interface ProtocolResult {
  protocolClass: string;
  recommendedKits: string[];
  firedRules: string[];
  therapyNeeds: string[];
}

export interface MonitoringResult {
  scheduled: string[];
}

export interface NarrativeResult {
  themes: string[];
  patientFraming: string;
  doctorFraming: string;
  scientificFraming: string;
}

export interface ReplayIntermediates {
  extractedSignals: ExtractedSignal[];
  activatedPathways: ActivatedPathway[];
  causePosteriors: CausePosterior[];
}

export interface ReplayResult {
  caseId: string;
  startedAt: string;
  durationMs: number;
  diagnosisResult: DiagnosisResult;
  rootCauseResult: RootCauseResult;
  protocolResult: ProtocolResult;
  monitoringResult: MonitoringResult;
  narrativeResult: NarrativeResult;
  intermediates: ReplayIntermediates;
}

// ── Validator outputs ──────────────────────────────────────────────────────

export interface Finding {
  code: string;
  severity: FailureSeverity;
  component: FailureComponent;
  expected: unknown;
  actual: unknown;
  message: string;
  patternKey: string;
}

export interface ValidatorOutcome {
  pass: boolean;
  score: number; // 0..100
  findings: Finding[];
}

export interface CaseValidation {
  caseId: string;
  rootCause: ValidatorOutcome;
  pathway: ValidatorOutcome;
  treatment: ValidatorOutcome;
  narrative: ValidatorOutcome;
  governance: ValidatorOutcome;
  overallScore: number;
  overallPass: boolean;
}

// ── Pipeline contract ──────────────────────────────────────────────────────

export interface ClinicalPipeline {
  extractSignals(c: ClinicalReplayCase): ExtractedSignal[];
  activatePathways(signals: ExtractedSignal[]): ActivatedPathway[];
  rankCauses(
    signals: ExtractedSignal[],
    pathways: ActivatedPathway[]
  ): { posteriors: CausePosterior[]; dissent: number; compositeRuleSatisfied: boolean };
  buildDiagnosis(
    c: ClinicalReplayCase,
    posteriors: CausePosterior[],
    pathways: ActivatedPathway[]
  ): DiagnosisResult;
  buildProtocol(
    c: ClinicalReplayCase,
    diag: DiagnosisResult,
    pathways: ActivatedPathway[]
  ): ProtocolResult;
  scheduleMonitoring(
    c: ClinicalReplayCase,
    diag: DiagnosisResult,
    protocol: ProtocolResult
  ): MonitoringResult;
  composeNarrative(
    c: ClinicalReplayCase,
    diag: DiagnosisResult,
    protocol: ProtocolResult
  ): NarrativeResult;
}

// ── Reporting ──────────────────────────────────────────────────────────────

export interface DimensionScore {
  score: number;       // 0..100
  pass: boolean;
  floor: number;
}

export interface CategoryScore {
  category: string;
  count: number;
  score: number;
  pass: boolean;
}

export interface BenchmarkScoreboard {
  corpusVersion: string;
  replayId: string;
  startedAt: string;
  cases: number;
  dimensions: {
    rootCause: DimensionScore;
    pathway: DimensionScore;
    treatment: DimensionScore;
    narrative: DimensionScore;
    governance: DimensionScore;
    overall: DimensionScore;
  };
  categories: CategoryScore[];
  criticalFindings: number;
  warningFindings: number;
  topFailurePatterns: Array<{ patternKey: string; count: number }>;
  highRiskFailurePatterns: Array<{ patternKey: string; count: number; rate: number }>;
  driftVsBaseline: {
    baselineFound: boolean;
    overallDelta: number;
    rootCauseDelta: number;
  };
  performance: {
    sweepMs: number;
    singleCaseP95Ms: number;
  };
  overallPass: boolean;
  blockReasons: string[];
}
