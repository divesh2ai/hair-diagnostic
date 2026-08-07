import type { KitId, TherapyNeed } from '../../types';
import type { ConditionId } from '../kit-scorer/registry/conditionKitRegistry';
import type { ResolutionResult } from '../kit-scorer/resolution/resolveKitInteractions';
import type { SafetyEvaluationResult } from '../safety-evaluator/types';
import type { RecommendationReasonCode } from './reasonCodes';

// ─────────────────────────────────────────────────────────────────────────────
// KitScoringDiagnostics — additive internal payload emitted by buildKitSequence
// when the caller opts into trace mode. Represents the EXACT execution path
// that produced the recommendation, not a reconstruction. The adapter
// (buildDecisions / buildTrace) must consume these values verbatim and must
// NOT re-invoke detectConditions / resolveKitInteractions / evaluateSafety.
// ─────────────────────────────────────────────────────────────────────────────

export interface KitOrderingSource {
  /**
   * Position of the kit inside kitPrioritizer's explicit PRIORITY_ORDER head
   * array. Present iff the kit was lifted by that explicit rule. Absent
   * means the kit did not match any explicit priority slot and its final
   * position was inherited from the upstream `phases` order.
   */
  readonly priorityOrderIndex?: number;
  /**
   * Position of the kit inside the pre-priority `phases` array (i.e. the
   * dedup order fed to prioritizeKits). Always populated when the kit was
   * present as a candidate.
   */
  readonly inheritedInsertionIndex?: number;
  /**
   * Rule labels from resolveKitInteractions.applied that reference this kit's
   * condition, if any. Read-only quotes of the live audit trail.
   */
  readonly ruleLabels?: readonly string[];
  /**
   * Which bucket of kitPrioritizer's locked constants the kit fell into
   * (ROOT_CAUSE_HEAD, DISEASE_KITS, HORMONAL_KITS, MID_SUPPORT,
   * PATTERN_KITS_LAST, etc.). `null` when the kit did not match any bucket.
   */
  readonly bucket?: string | null;
}

export interface KitSafetyProvenance {
  readonly kitId: KitId;
  readonly therapies: readonly string[];
  readonly safetyRules: readonly string[];
  readonly blockedTherapies: readonly string[];
  readonly compositionVerifiable: boolean;
}

export interface KitScoringDiagnostics {
  readonly detectedConditions: readonly ConditionId[];
  readonly therapyNeeds: readonly TherapyNeed[];
  readonly interactionResolution: ResolutionResult;
  /**
   * Kits reachable from the surviving condition set — the dedup output BEFORE
   * prioritisation. Order preserved because it is one of the identified
   * ordering-dependency sources.
   */
  readonly candidateKits: readonly KitId[];
  /**
   * Sequenced kits BEFORE canonical safety filtering (after clinic
   * substitutions). Used by the adapter to detect LEGACY_RANKED_BLOCKED_KIT.
   */
  readonly legacySequenceBeforeSafety: readonly KitId[];
  /**
   * Final sequence AFTER safety filtering + budget cap. Byte-for-byte the
   * ordered kit ids of KitRecommendation.rankedKits.
   */
  readonly finalSequenceAfterSafety: readonly KitId[];
  readonly safetyEvaluation: SafetyEvaluationResult;
  /** Per-kit ordering-source dossier for every kit observed in the pipeline. */
  readonly orderingSources: Readonly<Record<KitId, KitOrderingSource>>;
  /**
   * Per-condition rationale strings (from CONDITION_KIT_REGISTRY) as they
   * were applied, so the adapter can attribute conditionsMatched without
   * re-reading the registry.
   */
  readonly conditionKitMap: Readonly<
    Record<KitId, { conditions: readonly ConditionId[]; rationales: readonly string[] }>
  >;
  readonly compositionSafety?: Readonly<Record<KitId, KitSafetyProvenance>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RecommendationDecision — one record per evaluated kit. Machine-readable,
// no free text. Consumed by the trace surface and by the enforcement layer.
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationStatus = 'recommended' | 'excluded' | 'not_applicable';

export interface ScoreModifier {
  readonly code: RecommendationReasonCode;
  readonly delta: number;
}

export interface RecommendationScoring {
  readonly baseScore: number;
  readonly modifiers: readonly ScoreModifier[];
  readonly finalScore: number;
}

export interface RecommendationOrdering {
  /**
   * Provisional tier — strictly observational. Derived from kitPrioritizer's
   * explicit buckets. `null` (with LEGACY_SEQUENCE_POLICY in reasonCodes)
   * whenever the live pipeline does not provide enough evidence to explain
   * the position.
   */
  readonly tier: 1 | 2 | 3 | 4 | null;
  /** Which stable tie-breaker was used. Always 'legacy-sequence-index' today. */
  readonly tieBreaker: string | null;
  /** 1-based rank in the final safety-filtered list, or null if excluded. */
  readonly finalRank: number | null;
}

export interface RecommendationDecision {
  readonly kitId: KitId;
  readonly status: RecommendationStatus;
  readonly conditionsMatched: readonly ConditionId[];
  readonly eligibility: {
    readonly eligible: boolean;
    readonly reasonCodes: readonly RecommendationReasonCode[];
  };
  readonly safety: {
    readonly allowed: boolean;
    readonly blockingCodes: readonly RecommendationReasonCode[];
    /**
     * The evaluator's own ruleIds, preserved verbatim, so downstream can
     * cross-reference the SafetyFinding without a second lookup.
     */
    readonly sourceRuleIds: readonly string[];
  };
  readonly scoring: RecommendationScoring;
  readonly ordering: RecommendationOrdering;
  readonly reasonCodes: readonly RecommendationReasonCode[];
  /**
   * Live rule-label strings copied from resolveKitInteractions.applied that
   * mention this kit's condition. Preserved for the doctor-facing audit
   * surface. Contains no PII.
   */
  readonly auditStrings: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RecommendationTrace — full per-assessment execution snapshot. Opt-in via
// scoreKits({ trace: true }). Must NEVER be exposed to patient-facing APIs,
// PDFs, or public report routes. No PII, no raw answers, no notes, no URLs.
// ─────────────────────────────────────────────────────────────────────────────

export interface TraceProvenance {
  readonly pipelineVersion: 'current-live';
  readonly traceMode: true;
  readonly derivedFromSingleExecution: true;
  /** Documented ordering dependencies inherited from the live pipeline. */
  readonly orderingDependencies: readonly string[];
  readonly fixtureProvenance?: {
    readonly source: 'synthetic' | 'existing_regression' | 'anonymized_real_case';
    readonly expectedOutputSource: 'none' | 'accepted_baseline' | 'clinical_rule_reference';
    readonly intent: readonly ('trace_completeness' | 'safety' | 'ordering' | 'eligibility')[];
    readonly clinicalCorrectnessAsserted: boolean;
  };
}

export type DiscrepancyCode =
  | 'LEGACY_RANKED_BLOCKED_KIT'
  | 'NO_INDICATION_IN_FINAL'
  | 'NO_MACHINE_REASON_AVAILABLE'
  | 'IMPLICIT_ORDER_FALLBACK'
  | 'SEQUENCE_DIVERGENCE'
  | 'FINAL_KIT_CONTAINS_BLOCKED_THERAPY'
  | 'KIT_SAFETY_COMPOSITION_UNVERIFIED';

export interface Discrepancy {
  readonly code: DiscrepancyCode;
  readonly kitId?: KitId;
  /** Short machine-readable detail — no PII, no free-text patient content. */
  readonly detail: string;
}

export interface RecommendationTrace {
  readonly provenance: TraceProvenance;
  readonly assessmentId: string;
  readonly detectedConditions: readonly ConditionId[];
  readonly therapyNeeds: readonly TherapyNeed[];
  readonly safetyBlocks: readonly {
    readonly kitId: KitId;
    readonly ruleIds: readonly string[];
    readonly codes: readonly RecommendationReasonCode[];
  }[];
  readonly evaluatedKits: readonly RecommendationDecision[];
  readonly legacySequence: readonly KitId[];
  readonly finalSequence: readonly KitId[];
  readonly discrepancies: readonly Discrepancy[];
}
