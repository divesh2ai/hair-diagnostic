import type { KitId } from '../../../types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { KitRecommendation, RuleTrace } from '../../kit-scorer/types';
import type {
  ProtocolExplanationResult,
  PhaseExplanation,
  SuppressionExplanation,
} from '../types';

import { PROTOCOL_EXPLANATIONS } from '../dictionaries/protocols';
import { KIT_EXPLANATIONS } from '../dictionaries/kits';
import { lookupOrFallback, formatBullet, deduplicateStrings, normaliseKey } from '../utils';

// ─────────────────────────────────────────────────────────────────────────────
// buildProtocolExplanation
//
// Converts a KitRecommendation + ClinicalProfile into a structured explanation
// of why the selected protocol was chosen, why precedence rules fired, and
// why certain kits were suppressed or reordered.
// ─────────────────────────────────────────────────────────────────────────────

export function buildProtocolExplanation(
  kitRecommendation: KitRecommendation,
  clinicalProfile: ClinicalProfile
): ProtocolExplanationResult {
  const primaryDx = clinicalProfile.primaryDiagnosis;
  const protocolEntry = lookupOrFallback(PROTOCOL_EXPLANATIONS, primaryDx);

  // ── 1. Protocol selection reason ──────────────────────────────────────────
  const selectedReason = formatBullet(protocolEntry.clinical);

  // ── 2. Phase breakdown — explain each ranked kit's position ───────────────
  const phaseBreakdown = buildPhaseBreakdown(
    kitRecommendation.rankedKits.map((k) => k.kitId),
    'phaseRationale' in protocolEntry
      ? (protocolEntry as { phaseRationale: string[] }).phaseRationale
      : []
  );

  // ── 3. Suppression explanation — inferred from rule trace ─────────────────
  const suppressedProtocols = buildSuppressionExplanations(kitRecommendation.ruleTrace);

  // ── 4. Fired precedence rules — extracted from appliedRules ───────────────
  const firedPrecedenceRules = deduplicateStrings(
    kitRecommendation.appliedRules.filter(isPrecedenceRule)
  );

  return {
    protocolLabel: kitRecommendation.protocolLabel,
    selectedReason,
    phaseBreakdown,
    suppressedProtocols,
    firedPrecedenceRules,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a PhaseExplanation for each kit in the final ranked order.
 * If a matching phaseRationale string is available from the protocol dictionary,
 * it is used as whyThisPhase; otherwise it is inferred from the kit entry.
 */
function buildPhaseBreakdown(
  kitIds: KitId[],
  phaseRationales: string[]
): PhaseExplanation[] {
  return kitIds.map((kitId, index) => {
    const kitEntry = KIT_EXPLANATIONS[normaliseKey(kitId)];
    const clinicalPurpose = kitEntry?.clinical ?? `No registered explanation for kit: ${kitId}`;

    // Use the dictionary phase rationale when available (keyed by order index)
    const rationaleEntry = phaseRationales[index];
    const whyThisPhase = rationaleEntry
      ? rationaleEntry.replace(/^Phase \d+ — [^:]+:\s*/i, '').trim()
      : inferPhaseReason(index, kitIds.length);

    return {
      phase: index + 1,
      kitId,
      clinicalPurpose: formatBullet(clinicalPurpose),
      whyThisPhase: formatBullet(whyThisPhase),
    };
  });
}

/**
 * Infers a phase position reason when no dictionary entry is present.
 * Used as a safe fallback for runtime-injected kits.
 */
function inferPhaseReason(index: number, total: number): string {
  if (index === 0) return 'First phase priority: foundational correction before downstream interventions can take effect.';
  if (index === total - 1) return 'Final phase: supportive restoration applied into a prepared follicular environment.';
  return `Intermediate phase ${index + 1}: sequential correction building on preceding phase outcomes.`;
}

/**
 * Converts the engine's rule trace into human-readable suppression explanations.
 * A suppression event is identified by any rule trace where the kit list shrinks
 * (kits were removed), or where a kit is replaced (before has X, after has Y instead).
 */
function buildSuppressionExplanations(ruleTrace: RuleTrace[]): SuppressionExplanation[] {
  const suppressions: SuppressionExplanation[] = [];

  for (const trace of ruleTrace) {
    const beforeSet = new Set(trace.before);
    const afterSet = new Set(trace.after);

    // Kits that were in 'before' but not in 'after' = removed/suppressed
    const removedKits = trace.before.filter((k) => !afterSet.has(k));

    for (const suppressed of removedKits) {
      // Determine if a replacement was injected at the same position
      const addedKits = trace.after.filter((k) => !beforeSet.has(k));
      const replacedBy = addedKits.length === 1 ? addedKits[0] : undefined;

      suppressions.push({
        suppressedKitId: suppressed,
        reason: formatBullet(trace.reason),
        replacedBy,
      });
    }
  }

  return suppressions;
}

/**
 * Identifies rules that are precedence/ordering rules vs. simple scoring rules.
 * Based on naming conventions used in the kit-scorer rule files.
 */
function isPrecedenceRule(ruleName: string): boolean {
  const precedenceKeywords = [
    'Precedence',
    'Lock',
    'Override',
    'Suppression',
    'Gate',
    'Last',
    'First',
    'Phase0',
    'Boost',
    'Block',
  ];
  return precedenceKeywords.some((kw) =>
    ruleName.toLowerCase().includes(kw.toLowerCase())
  );
}
