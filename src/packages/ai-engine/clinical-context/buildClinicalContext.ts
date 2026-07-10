/**
 * Builds the canonical ClinicalContext from the engine outputs already
 * computed elsewhere in the pipeline. This function should NEVER re-derive
 * facts or kit selections; it composes existing outputs into one object so
 * every consumer reads from the same place.
 */

import type { ClinicalFacts } from '../clinical-facts/types';
import type { KitRecommendation, ScoredKit, RuleTrace } from '../kit-scorer/types';
import type { GroundingViolation } from '../clinical-facts/validateEvidenceGrounding';
import type { KitId, RootCause, DiagnosisKey, TherapyNeed } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import { hasFact } from '../clinical-facts/buildClinicalFacts';
import type {
  ClinicalContext,
  SelectedKit,
  RejectedKit,
  PhasePlan,
  KitRationale,
} from './types';
import type { ReasoningGap } from './validateReasoningCompleteness';

// ── Selected kits ──────────────────────────────────────────────────────────

function buildSelectedKits(
  scored: readonly ScoredKit[],
  profile: ClinicalProfile,
  appliedRules: readonly string[],
): SelectedKit[] {
  return scored.map((sk) => {
    const rationale: KitRationale = {
      drivenBy: profile.rootCauses.filter((rc) => isRcRelevant(rc, sk)),
      pathways: [],
      satisfies: sk.matchedNeeds,
      rationale: sk.reasons.join(' · ') || `Selected to address ${sk.matchedNeeds.join(', ')}.`,
      enabledBy: appliedRules.filter((r) => mentionsKit(r, sk.kitId)),
    };
    return {
      kitId: sk.kitId,
      displayName: sk.kitId, // displayName comes from the kit registry elsewhere; consumer can enrich
      phase: sk.phase,
      score: sk.score,
      rationale,
    };
  });
}

// Heuristic: a root cause is relevant to a kit if its name (or close proxy)
// appears in any of the kit's reason strings. Conservative — we only attribute
// a kit to a root cause when the scorer's own reasoning surfaced it.
function isRcRelevant(rc: RootCause, sk: ScoredKit): boolean {
  const corpus = sk.reasons.join(' ').toUpperCase();
  return corpus.includes(rc);
}

function mentionsKit(rule: string, kitId: KitId): boolean {
  return rule.toUpperCase().includes(String(kitId).toUpperCase());
}

// ── Rejected kits (from RuleTrace deltas) ──────────────────────────────────

function buildRejectedKits(ruleTrace: readonly RuleTrace[]): RejectedKit[] {
  const rejected: RejectedKit[] = [];
  for (const trace of ruleTrace) {
    const removed = trace.before.filter((kid) => !trace.after.includes(kid));
    for (const kitId of removed) {
      rejected.push({
        kitId,
        removedByRule: trace.rule,
        reason: trace.reason,
        // When a rule's `after` contains kits that weren't in `before`, treat
        // them as the superseders. This is a heuristic — explicit supersede
        // metadata on the rule would be better, but this gives the doctor
        // dashboard enough to audit "why was X dropped" today.
        supersededBy: trace.after.filter((k) => !trace.before.includes(k)),
      });
    }
  }
  return rejected;
}

// ── Sequencing ─────────────────────────────────────────────────────────────

function buildSequencing(
  scored: readonly ScoredKit[],
  protocolRationale: string,
): PhasePlan[] {
  const byPhase = new Map<number, KitId[]>();
  for (const sk of scored) {
    const list = byPhase.get(sk.phase) ?? [];
    list.push(sk.kitId);
    byPhase.set(sk.phase, list);
  }
  return Array.from(byPhase.entries())
    .sort(([a], [b]) => a - b)
    .map(([phase, kitIds]) => ({
      phase,
      kitIds,
      // Phase-level rationale is not yet broken down per-phase by the
      // scorer; for now we surface the protocol-level rationale on every
      // phase so the doctor dashboard has something coherent to render.
      // Replace with phase-specific text when the sequencer exposes it.
      sequencingRationale: protocolRationale,
    }));
}

// ── Evidence collection ────────────────────────────────────────────────────

function collectEvidence(facts: ClinicalFacts): ClinicalContext['evidence'] {
  // Enumerate every FactKey and keep the ones that resolve true. Gives
  // consumers a single canonical list of "supported by this patient" claims.
  const all = [
    'scalp.dandruff','scalp.oily','scalp.dry','scalp.inflamed','scalp.psoriatic',
    'scalp.sensitive','scalp.anyNonNormal','scalp.normal',
    'history.stress','history.pcos','history.thyroid','history.metabolic',
    'history.ironRisk','history.postpartum','history.menopause','history.gi',
    'history.illness','history.glp1','history.weightLoss','history.circadian',
    'history.oxidative','history.family','history.pulling','history.autoimmune',
    'diet.normal','diet.restricted',
    'sex.male','sex.female','state.pregnant','state.planningPregnancy',
    'inferred.dhtDriver','inferred.stressDriver','inferred.nutritionDriver',
    'inferred.activeShedding',
  ] as const;
  return all.filter((k) => hasFact(facts, k));
}

// ── Public entry point ─────────────────────────────────────────────────────

export interface BuildClinicalContextInput {
  readonly assessmentId: string;
  readonly facts: ClinicalFacts;
  readonly profile: ClinicalProfile;
  readonly kitRecommendation: KitRecommendation;
  readonly groundingViolations?: readonly GroundingViolation[];
  /** Reasoning gaps detected by validateReasoningCompleteness. */
  readonly reasoningGaps?: readonly ReasoningGap[];
}

export function buildClinicalContext(input: BuildClinicalContextInput): ClinicalContext {
  const { facts, profile, kitRecommendation } = input;
  const selectedKits = buildSelectedKits(
    kitRecommendation.rankedKits,
    profile,
    kitRecommendation.appliedRules,
  );
  const rejectedKits = buildRejectedKits(kitRecommendation.ruleTrace ?? []);
  const sequencing = buildSequencing(
    kitRecommendation.rankedKits,
    kitRecommendation.protocolRationale,
  );
  return {
    assessmentId: input.assessmentId,
    facts,
    primaryDiagnosis: profile.primaryDiagnosis,
    selectedKits,
    rejectedKits,
    sequencing,
    interactionRules: kitRecommendation.appliedRules ?? [],
    evidence: collectEvidence(facts),
    groundingViolations: input.groundingViolations ?? [],
    reasoningGaps: input.reasoningGaps ?? [],
  };
}
