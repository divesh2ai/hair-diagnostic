import type { DetectedSignal, DetectedSignalSet, SignalWeight } from '../signal-registry';
import { getSignal } from '../signal-registry';
import type {
  BiologicalPathway,
  DetectedPathway,
  DetectedPathwaySet,
  PathwayId,
  PathwayStrength,
  SignalRole,
} from './types';
import { PATHWAY_CATALOG, PATHWAY_ENGINE_VERSION } from './catalog';

// ─────────────────────────────────────────────────────────────────────────────
// PATHWAY ENGINE — DetectedSignalSet → DetectedPathwaySet
//
// Scoring (per pathway):
//   contribution(signal) = roleBase[role] × severityMult(signal.severity)
//   raw = sum of contributions − sum of suppressor penalties
//   score = clamp(raw, 0, 100)
//
// Strength bucketing:
//   score >= 70 → HIGH
//   score >= 40 → MODERATE
//   score >= 15 → LOW
//   else        → INACTIVE
//
// Confidence:
//   max signal-confidence among contributors, weighted by number of distinct
//   PRIMARY contributors.
//
// Severity:
//   max signal-severity among contributors. (Severity != strength: a single
//   PRIMARY HIGH-severity signal can yield HIGH severity at MODERATE strength.)
//
// Gating:
//   if requiresAny is set and none of those signals fired → pathway is INACTIVE
//   regardless of other contributions.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_BASE: Record<SignalRole, number> = {
  PRIMARY:    30,
  SUPPORTING: 15,
  MODIFIER:    5,
};

const SEVERITY_MULT: Record<SignalWeight, number> = {
  HIGH:   1.0,
  MEDIUM: 0.7,
  LOW:    0.4,
};

const SUPPRESSOR_PENALTY = 40;

const WEIGHT_RANK: Record<SignalWeight, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function bucketStrength(score: number): PathwayStrength {
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MODERATE';
  if (score >= 15) return 'LOW';
  return 'INACTIVE';
}

function maxWeight(weights: readonly SignalWeight[]): SignalWeight {
  let best: SignalWeight = 'LOW';
  for (const w of weights) if (WEIGHT_RANK[w] > WEIGHT_RANK[best]) best = w;
  return best;
}

function evaluatePathway(
  pathway: BiologicalPathway,
  byId: Readonly<Record<string, DetectedSignal>>,
): DetectedPathway {
  // Gating check.
  if (pathway.requiresAny && pathway.requiresAny.length > 0) {
    const gateOpen = pathway.requiresAny.some((id) => byId[id]);
    if (!gateOpen) {
      return makeInactive(pathway.id);
    }
  }

  const contributionTrace: Array<{ signalId: string; role: SignalRole; delta: number }> = [];
  const supporting: string[] = [];
  const contributorSeverities: SignalWeight[] = [];
  const contributorConfidences: SignalWeight[] = [];
  let primaryCount = 0;
  let raw = 0;

  for (const c of pathway.contributors) {
    const fired = byId[c.signalId];
    if (!fired) continue;
    const sigDef = getSignal(c.signalId);
    if (!sigDef) continue; // catalog-vs-registry drift safety
    const mult = SEVERITY_MULT[fired.severity];
    const delta = Math.round(ROLE_BASE[c.role] * mult);
    raw += delta;
    contributionTrace.push({ signalId: c.signalId, role: c.role, delta });
    supporting.push(c.signalId);
    contributorSeverities.push(fired.severity);
    contributorConfidences.push(fired.confidence);
    if (c.role === 'PRIMARY') primaryCount++;
  }

  // Suppressors deduct.
  const suppressing: string[] = [];
  if (pathway.suppressors) {
    for (const sId of pathway.suppressors) {
      if (byId[sId]) {
        raw -= SUPPRESSOR_PENALTY;
        suppressing.push(sId);
        contributionTrace.push({ signalId: sId, role: 'MODIFIER', delta: -SUPPRESSOR_PENALTY });
      }
    }
  }

  const score = Math.max(0, Math.min(100, raw));
  const strength = bucketStrength(score);

  // Confidence: highest contributor confidence, downgraded if no PRIMARY fired.
  let confidence: SignalWeight =
    contributorConfidences.length > 0 ? maxWeight(contributorConfidences) : 'LOW';
  if (primaryCount === 0 && confidence === 'HIGH') confidence = 'MEDIUM';

  const severity: SignalWeight =
    contributorSeverities.length > 0 ? maxWeight(contributorSeverities) : 'LOW';

  return Object.freeze({
    id: pathway.id,
    score,
    strength,
    confidence,
    severity,
    supportingSignals: Object.freeze(supporting),
    suppressingSignals: Object.freeze(suppressing),
    contributionTrace: Object.freeze(contributionTrace),
  });
}

function makeInactive(id: PathwayId): DetectedPathway {
  return Object.freeze({
    id,
    score: 0,
    strength: 'INACTIVE' as const,
    confidence: 'LOW' as const,
    severity: 'LOW' as const,
    supportingSignals: Object.freeze([] as string[]),
    suppressingSignals: Object.freeze([] as string[]),
    contributionTrace: Object.freeze([] as Array<{ signalId: string; role: SignalRole; delta: number }>),
  });
}

/** Public API. */
export function evaluatePathways(signals: DetectedSignalSet): DetectedPathwaySet {
  const all: DetectedPathway[] = PATHWAY_CATALOG.map((p) =>
    evaluatePathway(p, signals.byId),
  );
  const active = all.filter((p) => p.strength !== 'INACTIVE');
  const byId = Object.freeze(
    all.reduce<Record<PathwayId, DetectedPathway>>((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<PathwayId, DetectedPathway>),
  );
  return Object.freeze({
    all: Object.freeze(all),
    active: Object.freeze(active),
    byId,
    engineVersion: PATHWAY_ENGINE_VERSION,
  });
}
