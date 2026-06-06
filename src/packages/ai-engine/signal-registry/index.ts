import type { PatientAnswers } from '../../types';
import type { DetectedSignal, DetectedSignalSet } from './types';
import { runAllDetectors } from './detectors';
import { SIGNAL_REGISTRY_VERSION } from './catalog';

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL SIGNAL REGISTRY — Public API
//
// Phase 1 entry point: PatientAnswers → DetectedSignalSet.
//
// This module is *additive*. It does not replace `evaluateClinicalProfile()`.
// Phase 2 (Pathway Engine) will consume `DetectedSignalSet`. The legacy
// clinical engine continues to operate unchanged until Phase 2 lands and
// parity is confirmed via replay/snapshot.
// ─────────────────────────────────────────────────────────────────────────────

export function detectSignals(ans: PatientAnswers): DetectedSignalSet {
  const signals = runAllDetectors(ans);
  const byId: Record<string, DetectedSignal> = {};
  for (const s of signals) byId[s.id] = s;
  return Object.freeze({
    signals,
    byId: Object.freeze(byId),
    registryVersion: SIGNAL_REGISTRY_VERSION,
  });
}

export { SIGNAL_CATALOG, SIGNAL_IDS, getSignal, requireSignal, SIGNAL_REGISTRY_VERSION } from './catalog';
export type {
  ClinicalSignal,
  DetectedSignal,
  DetectedSignalSet,
  SignalEvidence,
  SignalCategory,
  BiologicalSystem,
  SignalWeight,
  SignalId,
} from './types';
