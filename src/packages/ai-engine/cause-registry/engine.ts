import type { DetectedPathwaySet, PathwayId } from '../pathway-engine';
import type { DetectedSignalSet, SignalWeight } from '../signal-registry';
import { CAUSE_CATALOG, CAUSE_REGISTRY_VERSION } from './catalog';
import type {
  CauseContribution,
  DetectedRootCause,
  DetectedRootCauseSet,
  PathwayContribution,
  RootCauseDefinition,
  RootCauseId,
  RootCauseRole,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE ENGINE — Pure mechanics
//
// CONTRACT: This file contains zero hardcoded clinical knowledge.
//   - No cause id string literals.
//   - No signal id string literals.
//   - No pathway id string literals.
//   - No clinical narrative text.
//   - No clinical exclusion rules outside what the catalog declares.
//
// Tunables live at the top of the file as a single CONFIG block. Adjust here
// to retune ranking globally; adjust the catalog to retune anything clinical.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  /** Weight applied to pathway-derived contribution. */
  pathwayScale: 30,
  /** Weight applied to signal-confirmation contribution. */
  signalScale: 5,
  /** Per-extra-pathway multi-pathway bonus (multiplier). */
  multiPathwayBonusPerExtra: 0.15,
  /** Severity prior multiplier applied to final score. */
  severityPriorMult: { LOW: 0.85, MEDIUM: 1.0, HIGH: 1.15 } as Record<SignalWeight, number>,
  /** Score thresholds for bucketing. */
  primaryFloor: 35,
  secondaryFloor: 25,
  contributingFloor: 12,
  /** Confidence bucketing on final score. */
  confidenceHighFloor: 60,
  confidenceMediumFloor: 30,
  /** Bucket-demotion delta applied when `excludes` triggers. */
  excludesDemotionScore: 12,
  /** Minimum rank gap an excluder enforces over its excluded causes. */
  excludesRankGap: 1,
};

// ── helpers ─────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const bucketConfidence = (score: number): SignalWeight => {
  if (score >= CONFIG.confidenceHighFloor) return 'HIGH';
  if (score >= CONFIG.confidenceMediumFloor) return 'MEDIUM';
  return 'LOW';
};

const isEligible = (
  def: RootCauseDefinition,
  signals: DetectedSignalSet,
): boolean => {
  if (!def.mandatorySignals || def.mandatorySignals.length === 0) return true;
  return def.mandatorySignals.some((id) => signals.byId[id]);
};

// Score one cause. Returns null if ineligible.
function scoreCause(
  def: RootCauseDefinition,
  signals: DetectedSignalSet,
  pathways: DetectedPathwaySet,
): {
  rawScore: number;
  pathwayTrace: PathwayContribution[];
  signalTrace: CauseContribution[];
  drivingPathways: PathwayId[];
  supportingSignals: string[];
} | null {
  if (!isEligible(def, signals)) return null;

  // Pathway contribution
  const pathwayTrace: PathwayContribution[] = [];
  const drivingPathways: PathwayId[] = [];
  let pathwaySum = 0;
  let activePathwayCount = 0;
  for (const aff of def.pathwayAffinities) {
    const p = pathways.byId[aff.pathwayId];
    if (!p || p.strength === 'INACTIVE') continue;
    const delta = aff.weight * (p.score / 100);
    pathwaySum += delta;
    pathwayTrace.push({
      pathwayId: aff.pathwayId,
      affinity: aff.weight,
      pathwayScore: p.score,
      delta: +(delta * CONFIG.pathwayScale).toFixed(2),
    });
    drivingPathways.push(aff.pathwayId);
    activePathwayCount++;
  }

  // Signal contribution
  const signalTrace: CauseContribution[] = [];
  const supportingSignals: string[] = [];
  let signalSum = 0;
  for (const conf of def.signalConfirmations) {
    const s = signals.byId[conf.signalId];
    if (!s) continue;
    signalSum += conf.weight;
    signalTrace.push({
      signalId: conf.signalId,
      role: conf.role,
      delta: +(conf.weight * CONFIG.signalScale).toFixed(2),
    });
    supportingSignals.push(conf.signalId);
  }

  // Raw score before bonuses
  let raw = pathwaySum * CONFIG.pathwayScale + signalSum * CONFIG.signalScale;

  // Multi-pathway breadth bonus — diminishing-returns style
  if (activePathwayCount > 1) {
    raw *= 1 + CONFIG.multiPathwayBonusPerExtra * (activePathwayCount - 1);
  }

  // Severity prior multiplier
  raw *= CONFIG.severityPriorMult[def.severityPrior];

  return {
    rawScore: clamp(raw, 0, 100),
    pathwayTrace,
    signalTrace,
    drivingPathways,
    supportingSignals,
  };
}

// Bucket by score thresholds.
function bucketRole(score: number): RootCauseRole | null {
  if (score >= CONFIG.primaryFloor) return 'PRIMARY';
  if (score >= CONFIG.secondaryFloor) return 'SECONDARY';
  if (score >= CONFIG.contributingFloor) return 'CONTRIBUTING';
  return null;
}

// ── public API ──────────────────────────────────────────────────────────────

export function evaluateRootCauses(
  signals: DetectedSignalSet,
  pathways: DetectedPathwaySet,
): DetectedRootCauseSet {
  // 1. Score every eligible cause.
  const scored: Array<{ def: RootCauseDefinition; score: number; details: NonNullable<ReturnType<typeof scoreCause>> }> = [];
  for (const def of CAUSE_CATALOG) {
    const r = scoreCause(def, signals, pathways);
    if (!r) continue;
    scored.push({ def, score: r.rawScore, details: r });
  }

  // 2. Apply catalog-declared exclusions (data-driven; no clinical strings here).
  //    Sort by score descending; a higher-scoring cause demotes any cause in
  //    its `excludes` by `excludesDemotionScore`.
  scored.sort((a, b) => b.score - a.score);

  // Excluder semantics: when an excluder is eligible, every cause listed in
  // its `excludes` is capped to rank strictly below the excluder. Demotion
  // applies the larger of two penalties: a flat deduction, or a cap to
  // `excluder.score - excludesRankGap`. This guarantees clinically incompatible
  // causes can never outrank a confirmed excluder.
  const demotionMap: Map<string, Set<string>> = new Map();
  for (const winner of scored) {
    if (!winner.def.excludes || winner.def.excludes.length === 0) continue;
    for (const loserId of winner.def.excludes) {
      const loser = scored.find((c) => c.def.id === loserId);
      if (!loser) continue;
      const flat = loser.score - CONFIG.excludesDemotionScore;
      const cap  = winner.score - CONFIG.excludesRankGap;
      loser.score = Math.max(0, Math.min(flat, cap));
      if (!demotionMap.has(winner.def.id)) demotionMap.set(winner.def.id, new Set());
      demotionMap.get(winner.def.id)!.add(loserId);
    }
  }

  // 3. Re-sort post-demotion and bucket.
  scored.sort((a, b) => b.score - a.score);

  let primary: DetectedRootCause | null = null;
  const secondary: DetectedRootCause[] = [];
  const contributing: DetectedRootCause[] = [];
  const all: DetectedRootCause[] = [];
  const byId: Partial<Record<RootCauseId, DetectedRootCause>> = {};

  for (const s of scored) {
    const role = bucketRole(s.score);
    if (!role) continue;

    const adjusted: RootCauseRole = role === 'PRIMARY' && primary ? 'SECONDARY' : role;

    const detected: DetectedRootCause = Object.freeze({
      id: s.def.id,
      role: adjusted,
      score: +s.score.toFixed(2),
      confidence: bucketConfidence(s.score),
      severity: s.def.severityPrior,
      supportingSignals: Object.freeze(s.details.supportingSignals),
      drivingPathways: Object.freeze(s.details.drivingPathways),
      demotedCauses: Object.freeze(Array.from(demotionMap.get(s.def.id) ?? [])) as readonly RootCauseId[],
      signalTrace: Object.freeze(s.details.signalTrace),
      pathwayTrace: Object.freeze(s.details.pathwayTrace),
    });

    all.push(detected);
    byId[s.def.id] = detected;

    if (adjusted === 'PRIMARY' && !primary) primary = detected;
    else if (adjusted === 'SECONDARY') secondary.push(detected);
    else if (adjusted === 'CONTRIBUTING') contributing.push(detected);
  }

  return Object.freeze({
    all: Object.freeze(all),
    primary,
    secondary: Object.freeze(secondary),
    contributing: Object.freeze(contributing),
    byId: Object.freeze(byId),
    engineVersion: CAUSE_REGISTRY_VERSION,
  });
}
