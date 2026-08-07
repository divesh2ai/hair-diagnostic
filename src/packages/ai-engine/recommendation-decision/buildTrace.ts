import type { KitId } from '../../types';
import type {
  KitScoringDiagnostics,
  RecommendationDecision,
  RecommendationTrace,
  Discrepancy,
} from './types';
import { SAFETY_RULE_TO_REASON } from './reasonCodes';
import { enforceSafetyInvariant } from './enforceSafetyInvariant';

// ─────────────────────────────────────────────────────────────────────────────
// buildTrace — assembles the opt-in trace payload for one assessment.
//
// Contains no PII. Every field is either an enum id, a kit id, a condition
// id, a therapy-need enum, or a numeric index — the same primitives already
// present in the live sequencer's audit trail. Raw patient answers, doctor
// notes, tokens, URLs, and free text NEVER pass through here.
//
// Discrepancies detected:
//   • LEGACY_RANKED_BLOCKED_KIT   — via enforceSafetyInvariant
//   • NO_INDICATION_IN_FINAL      — kit in finalSequence with 0 conditions
//   • NO_MACHINE_REASON_AVAILABLE — kit in finalSequence with empty reasons
//   • IMPLICIT_ORDER_FALLBACK     — kit in finalSequence with tier===null
//   • SEQUENCE_DIVERGENCE         — filtered legacy order ≠ finalSequence
// ─────────────────────────────────────────────────────────────────────────────

export function buildTrace(
  assessmentId: string,
  diagnostics: KitScoringDiagnostics,
  decisions: readonly RecommendationDecision[],
  fixtureProvenance?: RecommendationTrace['provenance']['fixtureProvenance'],
): RecommendationTrace {
  const {
    detectedConditions,
    therapyNeeds,
    legacySequenceBeforeSafety,
    finalSequenceAfterSafety,
    safetyEvaluation,
  } = diagnostics;

  // ── Safety invariant enforcement ─────────────────────────────────────────
  const enforcement = enforceSafetyInvariant(decisions, legacySequenceBeforeSafety);
  const enforced = enforcement.decisions;
  const discrepancies: Discrepancy[] = [...enforcement.discrepancies];

  // ── Discrepancy detectors on the enforced decision set ───────────────────
  const finalSet = new Set(finalSequenceAfterSafety);
  for (const d of enforced) {
    if (!finalSet.has(d.kitId)) continue;

    if (d.conditionsMatched.length === 0) {
      discrepancies.push({
        code: 'NO_INDICATION_IN_FINAL',
        kitId: d.kitId,
        detail: `Kit ${d.kitId} appears in the final sequence with no matched condition.`,
      });
    }
    if (d.reasonCodes.length === 0) {
      discrepancies.push({
        code: 'NO_MACHINE_REASON_AVAILABLE',
        kitId: d.kitId,
        detail: `Kit ${d.kitId} in the final sequence has no machine-readable reason code.`,
      });
    }
    if (d.ordering.tier === null) {
      discrepancies.push({
        code: 'IMPLICIT_ORDER_FALLBACK',
        kitId: d.kitId,
        detail: `Kit ${d.kitId} occupies its final rank without matching an explicit kitPrioritizer bucket; ordering inherited from insertion / traversal order.`,
      });
    }

    const prov = diagnostics.compositionSafety?.[d.kitId];
    if (prov) {
      if (!prov.compositionVerifiable) {
        discrepancies.push({
          code: 'KIT_SAFETY_COMPOSITION_UNVERIFIED',
          kitId: d.kitId,
          detail: `Composition for kit ${d.kitId} is unverified (no formulation metadata available).`,
        });
      }
      if (prov.blockedTherapies.length > 0) {
        discrepancies.push({
          code: 'FINAL_KIT_CONTAINS_BLOCKED_THERAPY',
          kitId: d.kitId,
          detail: `Kit ${d.kitId} in the final sequence contains blocked therapies: ${prov.blockedTherapies.join(', ')}.`,
        });
      }
    }
  }

  // Sequence divergence: filtered canonical order (legacy minus blocked)
  // versus the live pipeline's final list. Divergence exposes places where
  // the live sequencer applied truncation / substitution that the trace
  // cannot explain from diagnostics alone.
  const canonicalFilteredLegacy = filterBlocked(
    legacySequenceBeforeSafety,
    safetyEvaluation.blockedKits,
  );
  if (!arraysEqual(canonicalFilteredLegacy, finalSequenceAfterSafety)) {
    discrepancies.push({
      code: 'SEQUENCE_DIVERGENCE',
      detail: `Filtered legacy [${canonicalFilteredLegacy.join(' > ')}] differs from final [${finalSequenceAfterSafety.join(' > ')}].`,
    });
  }

  // ── Safety block summary ─────────────────────────────────────────────────
  const safetyBlocks = safetyEvaluation.blockedKits.map((kitId) => {
    const ruleIds: string[] = [];
    for (const f of safetyEvaluation.findings) {
      if (f.severity === 'BLOCK' && f.blockedKits?.includes(kitId)) {
        ruleIds.push(f.ruleId);
      }
    }
    const codes = ruleIds.map(
      (rid) => SAFETY_RULE_TO_REASON[rid] ?? 'SAFETY_BLOCKED_UNKNOWN_RULE',
    );
    return { kitId, ruleIds, codes };
  });

  return {
    provenance: {
      pipelineVersion: 'current-live',
      traceMode: true,
      derivedFromSingleExecution: true,
      orderingDependencies: [
        'priority_order',                 // kitPrioritizer PRIORITY_ORDER indexOf scan
        'set_insertion_order',            // detectConditions returns Set<ConditionId>
        'condition_traversal_order',      // buildKitSequence for-of resolution.conditions
        'dedup_insertion_order',          // buildKitSequence dedupKits push-order
        'clinic_substitution_order',      // clinicConfig.availableKits ordering
      ],
      ...(fixtureProvenance ? { fixtureProvenance } : {}),
    },
    assessmentId,
    detectedConditions,
    therapyNeeds,
    safetyBlocks,
    evaluatedKits: enforced,
    legacySequence: legacySequenceBeforeSafety,
    finalSequence: finalSequenceAfterSafety,
    discrepancies,
  };
}

function filterBlocked(
  seq: readonly KitId[],
  blocked: readonly KitId[],
): KitId[] {
  const set = new Set(blocked);
  return seq.filter((k) => !set.has(k));
}

function arraysEqual(a: readonly KitId[], b: readonly KitId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
