import type { KitId } from '../../types';
import type { SafetyFinding } from '../safety-evaluator/types';
import type { ConditionId } from '../kit-scorer/registry/conditionKitRegistry';
import type {
  KitScoringDiagnostics,
  RecommendationDecision,
  RecommendationStatus,
} from './types';
import type { RecommendationReasonCode } from './reasonCodes';
import { SAFETY_RULE_TO_REASON } from './reasonCodes';
import { deriveTier } from './deriveTier';

// ─────────────────────────────────────────────────────────────────────────────
// buildDecisions — pure adapter.
//
// Consumes the KitScoringDiagnostics already produced by the live pipeline
// and emits one RecommendationDecision per evaluated kit. Does NOT invoke
// detectConditions, resolveKitInteractions, or evaluateSafety again. Every
// clinical fact on a decision is copied out of `diagnostics`.
//
// The universe of evaluated kits is the union of:
//   • kits kept in finalSequenceAfterSafety
//   • kits in legacySequenceBeforeSafety that were stripped by safety
//   • kits explicitly named as blocked by the safety evaluator
//   • kits reachable from surviving conditions (candidateKits)
//
// A kit that is not clinically indicated AND not blocked will surface as
// `not_applicable` when it appears anywhere in that universe. Otherwise it
// is simply not evaluated — the adapter does not fabricate decisions for
// kits the pipeline never considered.
// ─────────────────────────────────────────────────────────────────────────────

export function buildDecisions(
  diagnostics: KitScoringDiagnostics,
): RecommendationDecision[] {
  const {
    interactionResolution,
    candidateKits,
    legacySequenceBeforeSafety,
    finalSequenceAfterSafety,
    safetyEvaluation,
    conditionKitMap,
  } = diagnostics;

  // Universe of kits the adapter will emit a decision for.
  const universe = new Set<KitId>();
  for (const k of candidateKits) universe.add(k);
  for (const k of legacySequenceBeforeSafety) universe.add(k);
  for (const k of finalSequenceAfterSafety) universe.add(k);
  for (const k of safetyEvaluation.blockedKits) universe.add(k);

  // Index safety findings by blocked kit for O(1) lookup.
  const safetyByKit = indexSafetyByKit(safetyEvaluation.findings);

  // Set of kits legacy sequence attempted to rank before safety stripping.
  const legacySet = new Set<KitId>(legacySequenceBeforeSafety);
  // Set of kits present in the final list.
  const finalRankIndex = new Map<KitId, number>();
  finalSequenceAfterSafety.forEach((k, i) => finalRankIndex.set(k, i + 1));

  // Applied rule strings from resolveKitInteractions — used to attribute
  // supersession / unification / mutex to the specific kit whose condition
  // was dropped.
  const appliedRules = interactionResolution.applied;

  const decisions: RecommendationDecision[] = [];

  for (const kitId of universe) {
    const cKit = conditionKitMap[kitId];
    const conditionsMatched = cKit?.conditions ?? [];
    const conditionRationales = cKit?.rationales ?? [];

    // ── Safety verdict (single source: safetyEvaluation) ──────────────────
    const findings = safetyByKit.get(kitId) ?? [];
    const safetyBlocked = safetyEvaluation.blockedKits.includes(kitId);
    const blockingCodes: RecommendationReasonCode[] = [];
    const sourceRuleIds: string[] = [];
    for (const f of findings) {
      if (f.severity !== 'BLOCK') continue;
      const code =
        SAFETY_RULE_TO_REASON[f.ruleId as string] ?? 'SAFETY_BLOCKED_UNKNOWN_RULE';
      blockingCodes.push(code);
      sourceRuleIds.push(f.ruleId);
    }

    // ── Eligibility (adapter-side categorisation only — no clinical rule) ──
    const eligibilityCodes: RecommendationReasonCode[] = [];
    let eligible: boolean;

    if (conditionsMatched.length > 0) {
      eligible = true;
      eligibilityCodes.push('ELIGIBLE_CONDITION_MATCH');
    } else {
      eligible = false;
      eligibilityCodes.push('NO_ACTIVE_INDICATION');
    }

    // Attribution: which resolveKitInteractions rules touched this kit's
    // conditions? Verbatim copy of the audit line — no re-classification.
    const auditStrings = appliedRules.filter((line) =>
      conditionsMatched.some((c) => line.includes(c)),
    );
    for (const line of auditStrings) {
      if (/UNIFY/i.test(line)) eligibilityCodes.push('UNIFIED_INTO_ANOTHER_KIT');
      else if (/MUTEX/i.test(line)) eligibilityCodes.push('MUTEX_LOST_TO_HIGHER_PRIORITY_KIT');
      else if (/SUPERSEDES|SUPERSED/i.test(line)) eligibilityCodes.push('SUPERSEDED_BY_INTERACTION_RULE');
    }

    // Budget cap detection: kit made it through legacy + safety filter but
    // fell off the end of the truncation. We flag it as excluded via cap.
    const legacyPostSafetyIndex = legacySequenceAfterSafetyIndex(
      legacySequenceBeforeSafety,
      safetyEvaluation.blockedKits,
      kitId,
    );
    const truncatedByBudget =
      legacyPostSafetyIndex !== -1 &&
      !finalRankIndex.has(kitId) &&
      !safetyBlocked;
    if (truncatedByBudget) {
      eligibilityCodes.push('BUDGET_CAP_TRUNCATED');
    }

    // ── Status (deterministic) ────────────────────────────────────────────
    let status: RecommendationStatus;
    if (safetyBlocked) status = 'excluded';
    else if (finalRankIndex.has(kitId)) status = 'recommended';
    else if (truncatedByBudget) status = 'excluded';
    else if (conditionsMatched.length === 0) status = 'not_applicable';
    else status = 'excluded';

    // ── Scoring (live pipeline exposes only sequence position, not a
    //    per-kit score breakdown; do not invent components) ────────────────
    const finalRank = finalRankIndex.get(kitId) ?? null;
    const baseScore = finalRank !== null ? Math.max(100 - (finalRank - 1) * 8, 40) : 0;
    const scoring = {
      baseScore,
      modifiers: [
        { code: 'LEGACY_SCORE_COMPONENT_UNAVAILABLE' as const, delta: 0 },
      ],
      finalScore: baseScore,
    };

    // ── Ordering (observational tier from kitPrioritizer buckets) ─────────
    const { tier, tieBreaker } = deriveTier(kitId, diagnostics);
    const ordering = {
      tier,
      tieBreaker: finalRank !== null ? tieBreaker : null,
      finalRank,
    };

    // Assemble consolidated reasonCodes list (safety-blocking wins).
    const reasonCodes: RecommendationReasonCode[] = [];
    for (const c of blockingCodes) reasonCodes.push(c);
    for (const c of eligibilityCodes) reasonCodes.push(c);
    if (finalRank !== null && tier === null) {
      reasonCodes.push('LEGACY_SEQUENCE_POLICY');
    }
    if (finalRank !== null && reasonCodes.length === 0) {
      reasonCodes.push('NO_MACHINE_REASON_AVAILABLE');
    }

    // The conditionRationales carry NO PII (kit-registry strings only) but
    // we do not surface them on the decision — auditStrings already covers
    // the machine-readable side. Suppress unused var:
    void conditionRationales;

    decisions.push({
      kitId,
      status,
      conditionsMatched,
      eligibility: {
        eligible,
        reasonCodes: dedupCodes(eligibilityCodes),
      },
      safety: {
        allowed: !safetyBlocked,
        blockingCodes: dedupCodes(blockingCodes),
        sourceRuleIds,
      },
      scoring,
      ordering,
      reasonCodes: dedupCodes(reasonCodes),
      auditStrings,
    });

    // Legacy-set / legacyBlocked cross-ref is surfaced by buildTrace, not
    // duplicated here. Keeping the set reference alive prevents dead-code
    // warnings without emitting a false decision code.
    void legacySet;
  }

  return decisions;
}

function indexSafetyByKit(
  findings: readonly SafetyFinding[],
): Map<KitId, SafetyFinding[]> {
  const out = new Map<KitId, SafetyFinding[]>();
  for (const f of findings) {
    if (!f.blockedKits) continue;
    for (const k of f.blockedKits) {
      const arr = out.get(k) ?? [];
      arr.push(f);
      out.set(k, arr);
    }
  }
  return out;
}

// Where would `kitId` sit in the sequence AFTER safety filtering but BEFORE
// budget cap? Used to detect BUDGET_CAP_TRUNCATED without re-running the
// legacy filter — we walk the same input and count blocked-out positions.
function legacySequenceAfterSafetyIndex(
  legacy: readonly KitId[],
  blocked: readonly KitId[],
  kitId: KitId,
): number {
  const blockedSet = new Set(blocked);
  let idx = 0;
  for (const k of legacy) {
    if (blockedSet.has(k)) continue;
    if (k === kitId) return idx;
    idx += 1;
  }
  return -1;
}

function dedupCodes(
  codes: readonly RecommendationReasonCode[],
): RecommendationReasonCode[] {
  const seen = new Set<RecommendationReasonCode>();
  const out: RecommendationReasonCode[] = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

// Suppress unused-import guard for ConditionId — reachable via types only.
export type { ConditionId };
