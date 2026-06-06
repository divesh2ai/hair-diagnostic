import type { DiagnosisKey, Severity, RootCause, ScalpState } from '../../types';
import type { TherapyNeed } from '../therapy-engine/types';
import type { KitId } from '../kit-scorer/types';

// ─── Narrative Length & Target ────────────────────────────────────────────────

export type NarrativeLength = 'short' | 'medium' | 'detailed';
export type NarrativeTarget = 'doctor-report' | 'patient-report' | 'pdf' | 'avatar' | 'dashboard' | 'whatsapp';
export type NarrativeTone = 'clinical' | 'empathetic' | 'motivational' | 'reassuring' | 'technical';

// ─── Shared Building Blocks ───────────────────────────────────────────────────

export interface NarrativeSection {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly bullets?: readonly string[];
  readonly subsections?: readonly NarrativeSection[];
  readonly renderAs: 'paragraph' | 'bullets' | 'table' | 'timeline' | 'card';
}

export interface TimelineEvent {
  readonly weekRange: string;
  readonly phase: 'early' | 'mid' | 'late' | 'maintenance';
  readonly milestone: string;
  readonly expectation: string;
  readonly confidenceNote: string;
  readonly isConditional: boolean;
}

export interface IngredientHighlight {
  readonly name: string;
  readonly role: string;
  readonly mechanism: string;
  readonly evidenceNote: string;
}

export interface RecoveryExpectation {
  readonly bestCase: string;
  readonly typicalCase: string;
  readonly conservativeCase: string;
  readonly variabilityNote: string;
  readonly keyDependencies: readonly string[];
}

export interface FollowupPlan {
  readonly recommendedAt: string;
  readonly reason: string;
  readonly priority: 'routine' | 'elevated' | 'urgent';
  readonly assessmentPoints: readonly string[];
  readonly escalationTriggers: readonly string[];
}

export interface EducationalInsight {
  readonly topic: string;
  readonly patientFriendlyExplanation: string;
  readonly clinicalContext: string;
  readonly relevantBecause: string;
}

export interface ConfidenceExplanation {
  readonly score: number;
  readonly level: 'low' | 'moderate' | 'high';
  readonly supportingSignals: readonly string[];
  readonly limitingFactors: readonly string[];
  readonly differentiationNote: string;
}

// ─── Kit Narrative ────────────────────────────────────────────────────────────

export interface KitNarrative {
  readonly kitId: KitId;
  readonly displayName: string;
  readonly phase: number;
  readonly reasonForSelection: string;
  readonly triggeringSignals: readonly string[];
  readonly targetedMechanisms: readonly string[];
  readonly ingredientHighlights: readonly IngredientHighlight[];
  readonly biologicalExplanation: string;
  readonly expectedBenefits: readonly string[];
  readonly usageImportance: string;
  readonly expectedTimeline: string;
  readonly consistencyNote: string;
  readonly patientFriendlyPurpose: string;
}

// ─── Therapy Explanation ──────────────────────────────────────────────────────

export interface TherapyExplanation {
  readonly need: TherapyNeed;
  readonly displayLabel: string;
  readonly whyNeeded: string;
  readonly howAddressed: string;
  readonly clinicalSignificance: string;
  readonly patientExplanation: string;
}

// ─── Prognosis Narrative ──────────────────────────────────────────────────────

export interface PrognosisNarrative {
  readonly shortSummary: string;
  readonly detailedText: string;
  readonly recoveryExpectation: RecoveryExpectation;
  readonly timelineEvents: readonly TimelineEvent[];
  readonly adherenceImpact: string;
  readonly geneticFactorNote: string;
  readonly reversibilityStatement: string;
}

// ─── Doctor Report ────────────────────────────────────────────────────────────

export interface DoctorReport {
  readonly generatedAt: string;
  readonly patientRef: string;
  readonly clinicalSummary: NarrativeSection;
  readonly primaryDiagnosis: NarrativeSection;
  readonly differentialDiagnoses: NarrativeSection;
  readonly severityAssessment: NarrativeSection;
  readonly rootCauseAnalysis: NarrativeSection;
  readonly signalInterpretation: NarrativeSection;
  readonly therapyLogic: NarrativeSection;
  readonly kitRationale: NarrativeSection;
  readonly ingredientMechanisms: NarrativeSection;
  readonly prognosis: NarrativeSection;
  readonly riskFactors: NarrativeSection;
  readonly contraindications: NarrativeSection;
  readonly followUpRecommendations: NarrativeSection;
  readonly expectedRecoveryTimeline: NarrativeSection;
  readonly confidenceExplanation: ConfidenceExplanation;
  readonly kitNarratives: readonly KitNarrative[];
  readonly therapyExplanations: readonly TherapyExplanation[];
  readonly prognosisNarrative: PrognosisNarrative;
  readonly followupPlan: FollowupPlan;
  readonly doctorNotes?: readonly string[];
  readonly metadata: NarrativeMetadata;
}

// ─── Patient Report ───────────────────────────────────────────────────────────

export interface PatientReport {
  readonly generatedAt: string;
  readonly greeting: string;
  readonly whatIsHappening: NarrativeSection;
  readonly whyItIsHappening: NarrativeSection;
  readonly isItReversible: NarrativeSection;
  readonly howTherapiesWork: NarrativeSection;
  readonly howKitsHelp: NarrativeSection;
  readonly whatToExpect: NarrativeSection;
  readonly realisticTimeline: NarrativeSection;
  readonly preventionAdvice: NarrativeSection;
  readonly reassuranceSection: NarrativeSection;
  readonly kitNarratives: readonly KitNarrative[];
  readonly prognosisNarrative: PrognosisNarrative;
  readonly followupPlan: FollowupPlan;
  readonly educationalInsights: readonly EducationalInsight[];
  readonly metadata: NarrativeMetadata;
}

// ─── Avatar Script ────────────────────────────────────────────────────────────

export type AvatarEmotion = 'neutral' | 'empathetic' | 'encouraging' | 'serious' | 'warm' | 'confident';

export interface AvatarDialogueSegment {
  readonly text: string;
  readonly emotion: AvatarEmotion;
  readonly emphasis?: readonly string[];
  readonly pauseAfterMs?: number;
}

export interface AvatarScene {
  readonly sceneId: string;
  readonly title: string;
  readonly narration: string;
  readonly segments: readonly AvatarDialogueSegment[];
  readonly emotion: AvatarEmotion;
  readonly visualCue: string;
  readonly durationSeconds: number;
  readonly emphasizedWords?: readonly string[];
}

export interface AvatarScript {
  readonly title: string;
  readonly patientName: string;
  readonly totalDurationSeconds: number;
  readonly intro: AvatarDialogueSegment;
  readonly scenes: readonly AvatarScene[];
  readonly outro: AvatarDialogueSegment;
  readonly generatedAt: string;
}

// ─── Doctor Dashboard Card ────────────────────────────────────────────────────

export type FollowupPriority = 'routine' | 'elevated' | 'urgent';

export interface DoctorDashboardCard {
  readonly patientRef: string;
  readonly patientName: string;
  readonly primaryCondition: string;
  readonly severity: Severity;
  readonly diagnosisKey: DiagnosisKey;
  readonly confidence: number;
  readonly confidenceLevel: 'low' | 'moderate' | 'high';
  readonly primaryKit: string;
  readonly kitPhaseCount: number;
  readonly recoveryWindow: string;
  readonly riskFlags: readonly string[];
  readonly rootCauses: readonly string[];
  readonly therapyNeeds: readonly string[];
  readonly followupPriority: FollowupPriority;
  readonly doctorAttentionNeeded: boolean;
  readonly attentionReasons: readonly string[];
  readonly contraindications: readonly string[];
  readonly generatedAt: string;
}

// ─── WhatsApp Summary ─────────────────────────────────────────────────────────

export interface WhatsAppSummary {
  readonly message: string;
  readonly characterCount: number;
  readonly patientName: string;
  readonly diagnosis: string;
  readonly topTherapy: string;
  readonly topKit: string;
  readonly timelineHighlight: string;
  readonly ctaText: string;
  readonly generatedAt: string;
}

// ─── PDF Payload ──────────────────────────────────────────────────────────────

export interface PDFChartData {
  readonly type: 'bar' | 'timeline' | 'progress' | 'radial';
  readonly title: string;
  readonly labels: readonly string[];
  readonly values: readonly number[];
  readonly unit?: string;
  readonly colorScheme: 'clinical' | 'warm' | 'neutral';
}

export interface PDFTable {
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly footnote?: string;
}

export interface PDFIngredientCard {
  readonly ingredientName: string;
  readonly role: string;
  readonly mechanism: string;
  readonly evidenceLevel: string;
  readonly targetConditions: readonly string[];
}

export interface PDFSection {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly bullets?: readonly string[];
  readonly table?: PDFTable;
  readonly chart?: PDFChartData;
  readonly ingredientCards?: readonly PDFIngredientCard[];
  readonly pageBreakBefore: boolean;
}

export interface PDFPayload {
  readonly version: '1.0';
  readonly generatedAt: string;
  readonly patientRef: string;
  readonly patientName: string;
  readonly clinicBrandingPlaceholder: string;
  readonly doctorSections: readonly PDFSection[];
  readonly patientSections: readonly PDFSection[];
  readonly therapyTimeline: readonly TimelineEvent[];
  readonly kitTables: readonly PDFTable[];
  readonly prognosisTables: readonly PDFTable[];
  readonly ingredientMechanismCards: readonly PDFIngredientCard[];
  readonly disclaimers: readonly string[];
  readonly metadata: NarrativeMetadata;
}

// ─── Pipeline I/O ─────────────────────────────────────────────────────────────

export interface NarrativeMetadata {
  readonly diagnosisKey: DiagnosisKey;
  readonly severity: Severity;
  readonly rootCauses: readonly RootCause[];
  readonly scalpStates: readonly ScalpState[];
  readonly therapyNeedCount: number;
  readonly kitCount: number;
  readonly narrativeLength: NarrativeLength;
  readonly pipelineVersion: string;
  readonly generatedAt: string;
}

export interface NarrativePipelineInput {
  readonly patient: import('../../types').PatientAnswers;
  readonly clinicalProfile: import('../clinical-engine/types').ClinicalProfile;
  readonly therapyPlan: import('../therapy-engine/types').TherapyNeeds;
  readonly kitRecommendation: import('../kit-scorer/types').KitRecommendation;
  readonly explanationResult: import('../explanations/types').NarrativeResult;
  readonly prognosis?: import('../explanations/composers/types').ComposedNarrative;
  readonly topicals?: readonly import('../knowledge-engine/types').TopicalKnowledge[];
  readonly doctorNotes?: readonly string[];
  readonly narrativeLength?: NarrativeLength;
  readonly includeAvatarScript?: boolean;
  readonly includeWhatsAppSummary?: boolean;
}

export interface NarrativePipelineOutput {
  readonly doctorReport: DoctorReport;
  readonly patientReport: PatientReport;
  readonly pdfPayload: PDFPayload;
  readonly avatarScript?: AvatarScript;
  readonly dashboardCard: DoctorDashboardCard;
  readonly whatsappSummary?: WhatsAppSummary;
  readonly metadata: NarrativeMetadata;
}

// ─── Validation Result ────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
