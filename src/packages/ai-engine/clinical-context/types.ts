/**
 * ClinicalContext — the single canonical object every downstream consumer
 * (PDF, doctor dashboard, patient report, AI avatar, WhatsApp assistant,
 * RAG chatbot, multilingual reports) must read from. No downstream component
 * may re-interpret the raw questionnaire answers independently; doing so
 * caused the "Normal scalp → dandruff/itching" leak class.
 *
 * The context bundles:
 *   - ClinicalFacts (reported + inferred)
 *   - SelectedKits with per-kit rationale tied to detected conditions
 *   - RejectedKits with the rule that filtered them out (for doctor audit)
 *   - Sequencing (phase order)
 *   - Interaction rules that fired
 *   - Evidence-grounding violations
 *
 * This file defines the shape; `buildClinicalContext.ts` builds it.
 */

import type { ClinicalFacts, FactKey } from '../clinical-facts/types';
import type { GroundingViolation } from '../clinical-facts/validateEvidenceGrounding';
import type { ReasoningGap } from './validateReasoningCompleteness';
import type { KitId, RootCause, DiagnosisKey, TherapyNeed } from '../../types';

// ── Selected / rejected kits ───────────────────────────────────────────────

export interface KitRationale {
  /** Detected conditions / root causes that justify this kit. */
  readonly drivenBy: readonly RootCause[];
  /** Pathways the kit addresses (signal-registry-style ids when available). */
  readonly pathways: readonly string[];
  /** Therapy needs satisfied by the kit. */
  readonly satisfies: readonly TherapyNeed[];
  /** Free-form clinical justification. */
  readonly rationale: string;
  /** Interaction rules that allowed or prioritised this kit. */
  readonly enabledBy: readonly string[];
}

export interface SelectedKit {
  readonly kitId: KitId;
  readonly displayName: string;
  readonly phase: number;
  readonly score: number;
  readonly rationale: KitRationale;
}

export interface RejectedKit {
  readonly kitId: KitId;
  /** Rule id (from RuleTrace) that removed the kit. */
  readonly removedByRule: string;
  /** Human-readable reason captured by the rule. */
  readonly reason: string;
  /** Kit ids that superseded this one when removal was due to superseding. */
  readonly supersededBy?: readonly KitId[];
}

// ── Sequencing ─────────────────────────────────────────────────────────────

export interface PhasePlan {
  readonly phase: number;
  readonly kitIds: readonly KitId[];
  /** Why this phase precedes the next — e.g. "clear inflammation before DHT correction." */
  readonly sequencingRationale: string;
}

// ── ClinicalContext ────────────────────────────────────────────────────────

export interface ClinicalContext {
  readonly assessmentId: string;
  readonly facts: ClinicalFacts;
  readonly primaryDiagnosis: DiagnosisKey;

  readonly selectedKits: readonly SelectedKit[];
  readonly rejectedKits: readonly RejectedKit[];
  readonly sequencing: readonly PhasePlan[];

  /** Names of interaction rules that fired during kit selection. */
  readonly interactionRules: readonly string[];

  /**
   * Evidence used to support the kit selections. Same FactKey vocabulary
   * as ClinicalFacts; consumers can render "Why this kit?" tooltips by
   * intersecting this list with the kit's `rationale.drivenBy`.
   */
  readonly evidence: readonly FactKey[];

  /**
   * Evidence-grounding violations carried forward from narrative assembly.
   * Empty when the narrative is fully grounded; non-empty blocks PDF.
   */
  readonly groundingViolations: readonly GroundingViolation[];

  /**
   * Reasoning completeness gaps detected by the self-reflection pass.
   * Examples: a selected kit that doesn't appear in the narrative; a
   * detected condition that's used to drive recommendations but never
   * explained to the patient. Empty when the narrative is complete.
   * Non-empty blocks PDF the same way groundingViolations does.
   */
  readonly reasoningGaps: readonly ReasoningGap[];
}
