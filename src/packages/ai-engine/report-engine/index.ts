export { buildClinicalReport } from "./buildClinicalReport";
export type {
  ClinicalReport,
  PatientSummary,
  QuestionnaireSelections,
  ClinicalInterpretation,
  ImpactLevel,
  RootCauseCategory,
  RootCauseCondition,
  RootCauseAnalysis,
  TreatmentPhase,
  RoadmapMonth,
  RoadmapMilestone,
  CategoryRationale,
  PlanReasoning,
  DietLifestyleRecommendation,
} from "./types";

// ── V3 narrative voice layer (patient-facing) ─────────────────────────────
export { composeNarrativeV3 } from "./v3";
export type {
  NarrativeReportV3,
  NarrativeV3SchemaVersion,
  ClinicalSummarySection,
  BarrierImpact,
  RecoveryStrategySection,
  RecommendedKitsSection,
  RecommendedKitEntry,
  FormulationGroupLine,
  RecoveryOutlookSection,
  RecoveryOutlookEntry,
  DietLifestyleSection,
  DietLifestyleLine,
} from "./v3";
