// ─────────────────────────────────────────────────────────────────────────────
// Canonical Consultation — single source of truth for clinical content across
// Doctor Dashboard, Patient Report, PDF, AI Video, WhatsApp, EMR, mobile apps,
// and future RAG / multilingual rendering layers.
//
// Diagnosis & treatment content lives inside the embedded ClinicalReport
// (already produced by the ai-engine pipeline). The Consultation type *wraps*
// that clinical payload with consultation-level metadata: evidence catalogue,
// confidence, doctor edits/notes, attachments, follow-up plan, audit trail,
// and version info.
//
// Presentation layers MUST NOT recompute clinical content. They render the
// fields below as-is. Doctors edit a Consultation, not the raw ClinicalReport.
//
// Importing this module:
//   import type { Consultation } from "@hairos/shared/types/consultation";
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ClinicalReport,
  ClinicalInsightStory,
  ClinicalInterpretation,
  RootCauseAnalysis,
  TreatmentPhase,
  TopicalRecommendation,
  UniversalRecoveryMilestone,
  DietLifestyleRecommendation,
  GeneralLifestyleGuide,
  PlanReasoning,
  FinalClinicalAssessment,
  ImpactLevel,
} from "../../../src/packages/ai-engine/report-engine/types";

// Re-export the embedded clinical types so consumers only need a single import.
export type {
  ClinicalReport,
  ClinicalInsightStory,
  ClinicalInterpretation,
  RootCauseAnalysis,
  TreatmentPhase,
  TopicalRecommendation,
  UniversalRecoveryMilestone,
  DietLifestyleRecommendation,
  GeneralLifestyleGuide,
  PlanReasoning,
  FinalClinicalAssessment,
  ImpactLevel,
};

// ── Identity / patient context ───────────────────────────────────────────────

export interface ConsultationPatient {
  id: string;
  name: string;
  age: number;
  sex: string;
  /** ISO-639-1 — patient's preferred language for rendered output. */
  language?: string;
  phone?: string | null;
  email?: string | null;
}

export interface ConsultationAssessmentRef {
  id: string;
  submittedAt: string;
  /** Reproduces the raw answers used by the engine — never mutated. */
  rawAnswers: Record<string, unknown>;
  source: "QR" | "DOCTOR" | "PORTAL" | "WHATSAPP" | string;
}

// ── Evidence catalogue — what fed the diagnosis ─────────────────────────────

export type EvidenceStatus = "USED" | "NOT_PROVIDED" | "FUTURE";

export interface EvidenceItem {
  kind:
    | "ASSESSMENT_QUESTIONNAIRE"
    | "SCALP_IMAGES"
    | "DOCTOR_NOTES"
    | "CLINIC_OBSERVATIONS"
    | "PREVIOUS_CONSULTATION"
    | "PREVIOUS_REPORTS"
    | "LAB_REPORTS"
    | "TRICHOSCOPY"
    | "WEARABLES"
    | "GENETICS";
  status: EvidenceStatus;
  /** Free-text — e.g. "12 scalp photos, vertex + occipital + temporal". */
  detail?: string;
  /** When this evidence was contributed (ISO). Omitted for FUTURE items. */
  capturedAt?: string;
}

export interface ClinicalEvidence {
  /** Always present — questionnaire is mandatory by contract. */
  questionnaire: EvidenceItem;
  /** Ordered catalogue. UI renders this verbatim. */
  items: EvidenceItem[];
}

// ── Diagnosis & severity ────────────────────────────────────────────────────

export type Severity = "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";

export interface DifferentialDiagnosis {
  /** Internal diagnosis key — kept for routing / RAG lookups. */
  key: string;
  /** Patient-facing label, e.g. "Telogen Effluvium — Stress-driven". */
  label: string;
  /** 0–1 ranking score (kit-scorer style). UI may render as %. */
  score: number;
  /** Which patient signals contributed to this differential. */
  supportingSignals: string[];
}

export interface Diagnosis {
  /** Primary working diagnosis label. */
  primary: string;
  /** Internal diagnosis key for the primary. */
  primaryKey: string;
  /** Ordered differentials excluding the primary. */
  differentials: DifferentialDiagnosis[];
  severity: Severity;
  /** Where the severity came from — "engine" vs. "doctor_override". */
  severitySource: "engine" | "doctor_override";
}

// ── Confidence ──────────────────────────────────────────────────────────────

export type ConfidenceBand = "low" | "moderate" | "high";

export interface ConfidenceScore {
  /** 0–1 — bucketed into bands for UI. */
  score: number;
  band: ConfidenceBand;
  /** Plain-language note shown to clinicians, not patients. */
  rationale: string;
}

export interface MissingInformation {
  /** Evidence kind whose absence reduces confidence. */
  kind: EvidenceItem["kind"];
  /** Why it would help, e.g. "Vertex photo confirms miniaturisation pattern". */
  reason: string;
  /** Surfaced as a patient-side suggestion, e.g. "Upload scalp images". */
  suggestion: string;
}

export interface Confidence {
  overall: ConfidenceScore;
  bySection: {
    diagnosis: ConfidenceScore;
    rootCause: ConfidenceScore;
    treatment: ConfidenceScore;
  };
  /** Inputs the engine wishes it had. */
  missingInformation: MissingInformation[];
}

// ── Treatment plan (structured, not free-text) ──────────────────────────────

export type TreatmentTier = "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM" | "MAINTENANCE";

export type RecommendationKind =
  | "MEDICATION"
  | "PROCEDURE"
  | "LIFESTYLE"
  | "HAIR_CARE"
  | "DIET"
  | "FOLLOW_UP"
  | "KIT"
  | "TOPICAL";

export type RecommendationPriority = "URGENT" | "HIGH" | "STANDARD" | "OPTIONAL";

export type EvidenceLevel = "A" | "B" | "C" | "EXPERT_OPINION" | "UNGRADED";

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  tier: TreatmentTier;
  title: string;
  description: string;
  priority: RecommendationPriority;
  /** ISO-8601 duration ("P3M") or human label ("3 months"). */
  duration?: string;
  /** Whether a doctor has edited this. Generated items default to false. */
  doctorEditable: boolean;
  doctorEdited?: boolean;
  evidenceLevel?: EvidenceLevel;
  /** Free-form metadata — kit ID, drug code, procedure ID, etc. */
  meta?: Record<string, unknown>;
}

export interface TreatmentPlan {
  /** Tiered recommendations. Renderers group by tier. */
  recommendations: Recommendation[];
  /** Verbatim kit-driven treatment phases from the engine. */
  kitPhases: TreatmentPhase[];
  /** Topicals — kept separate so renderers can show them in a different shelf. */
  topicals: TopicalRecommendation[];
  /** Topicals explicitly excluded for this patient with reasons. */
  topicalCautions: { name: string; reason: string }[];
  /** Universal recovery windows + 3-bullet expectations. */
  expectedTimeline: UniversalRecoveryMilestone[];
}

// ── Patient education ───────────────────────────────────────────────────────

export interface PatientEducationCard {
  id: string;
  title: string;
  body: string;
  /** Bound to a root cause, a kit, or a lifestyle topic. */
  topic: string;
}

export interface PatientEducation {
  /** Verbatim Clinical Insight & Recovery Story — patient voice. */
  story: ClinicalInsightStory;
  /** Final dermatologist-style narration (used by video / avatar pipelines). */
  finalAssessment: FinalClinicalAssessment;
  /** Additional educational tiles (lifestyle, diet, topical care). */
  cards: PatientEducationCard[];
  /** Generic guidance shown to every patient. */
  generalLifestyle: GeneralLifestyleGuide;
  /** Condition-mapped diet & lifestyle. */
  conditionLifestyle: DietLifestyleRecommendation[];
}

// ── Follow-up & doctor notes ────────────────────────────────────────────────

export interface FollowUpPlan {
  /** Suggested next consultation cadence, e.g. "12 weeks". */
  cadence: string;
  /** Specific checks the doctor wants at follow-up. */
  reviewChecks: string[];
  /** ISO timestamp of the next appointment if booked. */
  nextAppointmentAt?: string;
}

export interface DoctorNote {
  id: string;
  doctorId: string;
  doctorName?: string;
  body: string;
  createdAt: string;
  /** When the note was last edited (omitted if never). */
  updatedAt?: string;
  /** Whether this note is shared with the patient. Defaults to false. */
  visibleToPatient: boolean;
}

// ── Attachments ─────────────────────────────────────────────────────────────

export interface ConsultationAttachment {
  id: string;
  kind: "IMAGE" | "PDF" | "VIDEO" | "LAB_REPORT" | "OTHER";
  url: string;
  label?: string;
  uploadedAt: string;
  uploadedBy: string;
  /** Optional bytes — UI shows size when present. */
  sizeBytes?: number;
  /** MIME — useful for renderer routing. */
  mime?: string;
}

// ── Audit & versioning ──────────────────────────────────────────────────────

export interface ConsultationAudit {
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  /** Append-only log of state transitions and edits. */
  events: {
    at: string;
    by: string;
    kind: "CREATED" | "EDITED" | "APPROVED" | "REJECTED" | "REOPENED" | "EXPORTED";
    note?: string;
  }[];
}

export interface ConsultationVersion {
  /** Bumped when the Consultation contract changes shape. */
  schemaVersion: "v1";
  /** Bumped each time the consultation content materially changes. */
  contentVersion: number;
  /** Engine versions that produced this consultation. */
  engines: {
    clinical: string;
    therapy: string;
    kits: string;
    narrative: string;
    report: string;
  };
}

// ── Top-level Consultation ──────────────────────────────────────────────────

export interface Consultation {
  /** Stable id — typically the assessmentId, but kept as its own field so a
   *  consultation can later span multiple assessments (longitudinal care). */
  id: string;
  patient: ConsultationPatient;
  assessment: ConsultationAssessmentRef;
  evidence: ClinicalEvidence;
  diagnosis: Diagnosis;
  /** One-line clinical translations of the strongest signals, doctor-tone. */
  clinicalFindings: ClinicalInterpretation[];
  rootCause: RootCauseAnalysis;
  /** Why the chosen plan addresses the categorised root cause picture. */
  rootCauseRationale: PlanReasoning;
  confidence: Confidence;
  treatmentPlan: TreatmentPlan;
  patientEducation: PatientEducation;
  followUp?: FollowUpPlan;
  doctorNotes: DoctorNote[];
  attachments: ConsultationAttachment[];
  audit: ConsultationAudit;
  version: ConsultationVersion;
  /** Embedded ClinicalReport for renderers that already speak the v4 shape
   *  (PDF, existing patient report view). New code SHOULD prefer the typed
   *  fields above. This field is the back-compat bridge. */
  clinicalReport: ClinicalReport;
}
