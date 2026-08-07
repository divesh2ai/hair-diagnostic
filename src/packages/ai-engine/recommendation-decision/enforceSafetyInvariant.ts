import type { KitId } from '../../types';
import type { RecommendationDecision, Discrepancy } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// enforceSafetyInvariant — the single terminal boundary that guarantees a
// safety-blocked kit cannot reach the final recommendation list.
//
// The adapter is NOT a second safety evaluator. It ONLY consumes the verdict
// that lives on each decision (populated by buildDecisions from the existing
// evaluator's output). This function:
//
//   1. Coerces every decision where safety.allowed === false into
//      status="excluded", finalRank=null.
//   2. Emits LEGACY_RANKED_BLOCKED_KIT discrepancies when the pre-filter
//      legacy sequence had ranked a blocked kit.
//   3. Returns a `filteredFinalOrder` that is the exact final rank list a
//      caller may consume — guaranteed free of blocked kits.
//
// It does NOT mutate the decisions array in place; it returns a new one so
// the trace preserves both raw and enforced views. In practice buildDecisions
// already sets status="excluded" for blocked kits — the enforcement here is
// belt-and-braces: even if a future edit to buildDecisions regressed, this
// layer would still catch and correct the violation.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnforcementResult {
  readonly decisions: readonly RecommendationDecision[];
  readonly filteredFinalOrder: readonly KitId[];
  readonly discrepancies: readonly Discrepancy[];
}

export function enforceSafetyInvariant(
  decisions: readonly RecommendationDecision[],
  legacySequenceBeforeSafety: readonly KitId[],
): EnforcementResult {
  const legacySet = new Set(legacySequenceBeforeSafety);
  const discrepancies: Discrepancy[] = [];

  const enforced: RecommendationDecision[] = decisions.map((d) => {
    if (d.safety.allowed) return d;

    // Blocked kit that legacy sequence attempted to rank — surface as defect.
    if (legacySet.has(d.kitId)) {
      discrepancies.push({
        code: 'LEGACY_RANKED_BLOCKED_KIT',
        kitId: d.kitId,
        detail: `Kit ${d.kitId} was placed in the legacy sequence before the safety evaluator declared it blocked.`,
      });
    }

    // Coerce: status excluded, finalRank null, block codes on top of reasons.
    return {
      ...d,
      status: 'excluded' as const,
      ordering: {
        tier: d.ordering.tier,
        tieBreaker: null,
        finalRank: null,
      },
    };
  });

  // Rebuild filtered final order from the enforced decisions, preserving
  // whatever ranks buildDecisions assigned (they came from the live pipeline).
  const filteredFinalOrder = enforced
    .filter((d) => d.status === 'recommended' && d.ordering.finalRank !== null)
    .slice()
    .sort((a, b) => (a.ordering.finalRank ?? 0) - (b.ordering.finalRank ?? 0))
    .map((d) => d.kitId);

  return { decisions: enforced, filteredFinalOrder, discrepancies };
}
