import type { KitId, TherapyNeed } from '../../types';

export type { KitId };
import type { ClinicalFlags } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire Engine Types
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionOption {
  label: string;
  value: string;

  scoringSignals?: string[];
  filterOpts?: string[];
}

export interface SkipLogic {
  when: string;

  equals?: string;
  includes?: string;

  action: 'SHOW' | 'HIDE' | 'SKIP';
}

export interface Question {
  id: string;

  section: string;

  type:
    | 'single-select'
    | 'multi-select'
    | 'number'
    | 'text'
    | 'slider';

  title: string;

  subtitle?: string;

  options?: QuestionOption[];

  skipLogic?: SkipLogic[];

  mutualExclusivity?: string[];

  scoringSignals?: string[];

  uiMetadata?: {
    columns?: number;
    searchable?: boolean;
  };
}

export interface QuestionnaireSection {
  id: string;

  title: string;

  description?: string;

  questions: Question[];
}

export interface QuestionnaireSchema {
  schemaVersion?: string;

  sourceFile?: string;

  extractedBy?: string;

  extractionDate?: string;

  sections: QuestionnaireSection[];
}

export type PatientAnswers = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire Schema Normalizer
// Supports:
// - id OR sectionId
// - inconsistent extracted AI schema
// - optional metadata
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeQuestionnaireSchema(
  schema: any
): QuestionnaireSchema {
  return {
    schemaVersion: schema?.schemaVersion,
    sourceFile: schema?.sourceFile,
    extractedBy: schema?.extractedBy,
    extractionDate: schema?.extractionDate,

    sections: (schema?.sections || []).map((section: any) => ({
      id: section.id ?? section.sectionId,

      title: section.title,

      description: section.description,

      questions: (section.questions || []).map((q: any) => ({
        id: q.id,

        section: q.section ?? (section.id ?? section.sectionId),

        type: q.type,

        title: q.title ?? q.label,

        subtitle: q.subtitle,

        options: q.options,

        skipLogic: q.skipLogic,

        mutualExclusivity: q.mutualExclusivity,

        scoringSignals: q.scoringSignals,

        uiMetadata: q.uiMetadata
      }))
    }))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Protocol configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ProtocolEntry {
  label: string;
  rationale: string;
  phases: KitId[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinic configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ClinicConfig {
  clinicId: string;

  availableKits: KitId[];

  // Maps unavailable kit → preferred clinic substitute
  substitutions?: Partial<Record<KitId, KitId>>;
}

export type BudgetTier = 'ESSENTIAL' | 'STANDARD' | 'COMPREHENSIVE';

export interface BudgetProfile {
  tier: BudgetTier;
  maxKits: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule Trace Instrumentation
// Phase 2 — Observability Layer
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleTrace {
  rule: string;

  before: KitId[];

  after: KitId[];

  reason: string;

  signals?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Scored kit output
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoredKit {
  kitId: KitId;

  score: number;

  matchedNeeds: TherapyNeed[];

  reasons: string[];

  phase: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adjunct protocol types — SCALP CORRECTION · FOLLICULAR SUPPORT · BARRIER REPAIR
// ─────────────────────────────────────────────────────────────────────────────

export type AdjunctCategory =
  | 'SCALP_CORRECTION'     // medicated shampoos, anti-dandruff, sebum regulation
  | 'FOLLICULAR_SUPPORT'   // scalp serums, anti-inflammatory topical support
  | 'BARRIER_REPAIR'       // treatment-history shaft repair, moisture barrier
  | 'LIFESTYLE_SUPPORT';   // non-product lifestyle interventions

export interface AdjunctItem {
  /** Display name — matches canonical product name in products.json */
  productName: string;
  category: AdjunctCategory;
  /** One-line clinical reason for injection */
  indication: string;
  /** Mechanism / clinical rationale paragraph */
  clinicalRationale: string;
  /** Patient-facing usage instruction */
  usageInstruction: string;
  /** Rule code for observability */
  appliedRule: string;
}

export interface AdjunctProtocol {
  scalpCorrection:       AdjunctItem[];
  follicularSupport:     AdjunctItem[];
  barrierRepair:         AdjunctItem[];
  lifestyleInterventions: AdjunctItem[];
  /** Clinical completeness warnings — raised when a detected signal has no matching adjunct */
  validationWarnings:    string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Final recommendation object returned by scoreKits()
// ─────────────────────────────────────────────────────────────────────────────

export interface KitRecommendation {
  rankedKits: ScoredKit[];

  protocolLabel: string;

  protocolRationale: string;

  selectionJustification: string;

  appliedRules: string[];

  // Full observability layer
  ruleTrace: RuleTrace[];

  // Multi-layer adjunct protocol — scalp correction, follicular support, barrier repair
  adjunctProtocol: AdjunctProtocol;

  /**
   * Canonical safety / eligibility evaluation. Same evaluator consumed by the
   * topical engine — pregnancy / hypertension / finasteride / age gates live
   * ONLY here. Never rebuild these checks downstream.
   */
  safety?: import('../safety-evaluator').SafetyEvaluationResult;

  /**
   * OPT-IN diagnostics from the current execution. Populated ONLY when the
   * caller passes { trace: true } to scoreKits. Additive; existing consumers
   * ignore it. Must never be surfaced on patient-facing APIs or PDFs.
   */
  diagnostics?: import('../recommendation-decision').KitScoringDiagnostics;

  /**
   * OPT-IN canonical recommendation decisions — one per evaluated kit.
   * Populated ONLY when scoreKits is called with { trace: true }.
   * Additive; not surfaced to patient-facing outputs.
   */
  decisions?: import('../recommendation-decision').RecommendationDecision[];

  /**
   * OPT-IN full trace payload. Populated ONLY when scoreKits is called with
   * { trace: true } and includes provenance + discrepancies. Development /
   * QA / doctor-diagnostics only — never exposed to patient-facing surfaces.
   */
  trace?: import('../recommendation-decision').RecommendationTrace;
}

// ─────────────────────────────────────────────────────────────────────────────
// Immutable scoring context
// Passed across rule pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface KitScorerContext {
  phases: KitId[];

  flags: ClinicalFlags;

  therapyNeeds: TherapyNeeds;

  appliedRules: string[];

  // Rule-level audit trail
  ruleTrace?: RuleTrace[];
}