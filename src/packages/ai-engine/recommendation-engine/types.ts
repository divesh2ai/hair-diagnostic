export type EvidenceLevel = 'High' | 'Medium' | 'Low';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';
export type SeverityLevel = 'Mild' | 'Moderate' | 'Severe' | 'Extreme';
export type FrequencyType = 'Daily' | 'Twice Daily' | 'Weekly' | 'Monthly' | 'As Needed';

export interface BaseRecommendation {
  readonly rationale: string;
  readonly mechanism: string;
  readonly evidenceLevel: EvidenceLevel;
  readonly contraindications: readonly string[];
  readonly expectedTimeToBenefit: string;
  readonly severityModifier: number;
  readonly confidence: ConfidenceLevel;
}

export interface RecommendationContext {
  readonly age: number;
  readonly gender: 'Male' | 'Female' | 'Other';
  readonly severity: SeverityLevel;
  readonly conditions: readonly string[];
  readonly allergies: readonly string[];
  readonly currentMedications: readonly string[];
  readonly previousTreatments: readonly string[];
  readonly pregnancyStatus?: boolean;
}

export interface TherapyRecommendation extends BaseRecommendation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface TopicalRecommendation extends BaseRecommendation {
  readonly id: string;
  readonly name: string;
  readonly activeIngredients: readonly string[];
  readonly concentration: string;
  readonly vehicle: string;
}

export interface SerumRecommendation extends BaseRecommendation {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly keyIngredients: readonly string[];
}

export interface ProcedureRecommendation extends BaseRecommendation {
  readonly id: string;
  readonly name: string;
  readonly procedureType: string;
  readonly sessionCount: number;
  readonly intervalWeeks: number;
  readonly maintenanceNeeded: boolean;
  readonly idealCandidate: string;
  readonly recoveryConsiderations: readonly string[];
}

export interface MonitoringCheckpoint {
  readonly month: number;
  readonly metricsToTrack: readonly string[];
  readonly expectedMilestones: readonly string[];
}

export interface EscalationTrigger {
  readonly condition: string;
  readonly actionToTake: string;
  readonly timeframeMonths: number;
}

export interface TimelinePhase {
  readonly phaseName: string;
  readonly durationMonths: number;
  readonly description: string;
  readonly primaryFocus: string;
  readonly checkpoints: readonly MonitoringCheckpoint[];
  readonly escalationTriggers: readonly EscalationTrigger[];
}

export interface ProtocolTimeline {
  readonly totalDurationMonths: number;
  readonly phases: readonly TimelinePhase[];
}

export interface UsageInstruction {
  readonly recommendationId: string;
  readonly frequency: FrequencyType;
  readonly timeOfDay: 'Morning' | 'Evening' | 'Both' | 'Any';
  readonly applicationMethod: string;
  readonly amount: string;
  readonly specialInstructions: readonly string[];
}

export interface ContraindicationWarning {
  readonly recommendationId: string;
  readonly conditionOrMedication: string;
  readonly severity: 'Absolute' | 'Relative';
  readonly rationale: string;
  readonly alternativeSuggestion?: string;
}

export interface ExpectedOutcome {
  readonly recommendationId: string;
  readonly metric: string;
  readonly timeframeMonths: number;
  readonly expectedImprovementPercentage: number;
  readonly description: string;
}

export interface AdherenceTip {
  readonly title: string;
  readonly description: string;
  readonly relatedRecommendations: readonly string[];
}

export interface FullRecommendation {
  readonly context: RecommendationContext;
  readonly therapies: readonly TherapyRecommendation[];
  readonly topicals: readonly TopicalRecommendation[];
  readonly serums: readonly SerumRecommendation[];
  readonly procedures: readonly ProcedureRecommendation[];
  readonly timeline: ProtocolTimeline;
  readonly usageInstructions: readonly UsageInstruction[];
  readonly contraindications: readonly ContraindicationWarning[];
  readonly expectedOutcomes: readonly ExpectedOutcome[];
  readonly adherenceTips: readonly AdherenceTip[];
}
