import type {
  DiagnosisKey,
  RootCause,
  TherapyNeed,
  ScalpState,
  KitId,
} from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';
import type { KitRecommendation } from '../kit-scorer/types';

// ─── Explanation severity (lowercase to distinguish from clinical Severity) ───

export type ExplanationSeverity = 'low' | 'moderate' | 'high';

// ─── Base dictionary entry ────────────────────────────────────────────────────

export interface ExplanationEntry {
  /** Clinician-facing text — precise medical terminology */
  clinical: string;
  /** Patient-facing text — plain language, empathetic tone */
  patient: string;
  severity?: ExplanationSeverity;
  category?: string;
}

// ─── Typed dictionary shapes ──────────────────────────────────────────────────

export type SignalDictionary     = Record<RootCause, ExplanationEntry>;
export type ConditionDictionary  = Record<DiagnosisKey, ExplanationEntry>;
export type TherapyNeedDictionary = Record<TherapyNeed, ExplanationEntry>;
export type ScalpStateDictionary = Record<ScalpState, ExplanationEntry>;
export type LifestyleDictionary  = Record<string, ExplanationEntry>;
export type RiskFactorDictionary = Record<string, ExplanationEntry>;

// ─── Protocol dictionary entry ────────────────────────────────────────────────

export interface ProtocolExplanationEntry {
  /** Clinician-readable rationale for this protocol selection */
  clinical: string;
  /** Patient-friendly explanation of why this treatment path was chosen */
  patient: string;
  /** Ordered strings explaining each phase's clinical purpose */
  phaseRationale: string[];
}

export type ProtocolDictionary = Record<DiagnosisKey, ProtocolExplanationEntry>;

// ─── Kit dictionary entry ─────────────────────────────────────────────────────

export interface KitDictionaryEntry {
  /** One-line clinical description for the prescriber */
  clinical: string;
  /** Patient-friendly kit description */
  patient: string;
  /** Expected therapeutic outcomes used in explanation bullets */
  expectedOutcomes: string[];
  /** Primary mechanism of action */
  mechanismOfAction: string;
  /** Therapy needs this kit directly addresses */
  targetNeeds: TherapyNeed[];
  category?: string;
}

export type KitDictionary = Record<string, KitDictionaryEntry>;

// ─── Builder outputs ──────────────────────────────────────────────────────────

export interface ClinicalReasoningResult {
  /** Medical-grade bullet points for the prescriber */
  clinicalBullets: string[];
  /** Plain-language bullet points for the patient */
  patientBullets: string[];
  /** Top 1-3 root-cause drivers behind the diagnosis */
  dominantDrivers: string[];
  /** Risk factors that compound the clinical picture */
  riskFactors: string[];
}

export interface PhaseExplanation {
  phase: number;
  kitId: KitId;
  /** Why this kit serves its clinical purpose */
  clinicalPurpose: string;
  /** Why this kit sits at this specific phase position */
  whyThisPhase: string;
}

export interface SuppressionExplanation {
  suppressedKitId: KitId;
  reason: string;
  replacedBy?: KitId;
}

export interface ProtocolExplanationResult {
  protocolLabel: string;
  /** High-level reason this protocol was selected over alternatives */
  selectedReason: string;
  phaseBreakdown: PhaseExplanation[];
  suppressedProtocols: SuppressionExplanation[];
  firedPrecedenceRules: string[];
}

export interface KitExplanationItem {
  kitId: KitId;
  whySelected: string[];
  expectedOutcomes: string[];
  clinicalPurpose: string;
  patientFriendlyPurpose: string;
}

// ─── Narrative ────────────────────────────────────────────────────────────────

export type NarrativeLength = 'short' | 'medium' | 'detailed';

export interface NarrativeResult {
  doctorSummary: string;
  patientSummary: string;
  narrative: string;
  length: NarrativeLength;
}

// ─── Explanation context passed to all narrative builders ─────────────────────

export interface ExplanationContext {
  clinicalProfile: ClinicalProfile;
  therapyNeeds: TherapyNeeds;
  kitRecommendation: KitRecommendation;
  narrativeLength?: NarrativeLength;
  /** Optional patient first name for personalized patient-facing copy */
  patientName?: string;
}

// ─── Fallback when a dictionary key is missing ────────────────────────────────

export interface FallbackExplanation extends ExplanationEntry {
  isFallback: true;
}

// ─── Priority-sorted explanation item used by utils ──────────────────────────

export interface RankedExplanation {
  key: string;
  entry: ExplanationEntry;
  /** Numeric weight — higher = more prominent in output */
  priority: number;
}
