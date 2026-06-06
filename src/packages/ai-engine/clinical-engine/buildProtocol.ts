import type { ClinicalProfile, ClinicalFlags } from './types';
import type { ScoredConditionResult } from './scoreConditions';
import type { DerivedSignals } from './deriveSignals';

// ─────────────────────────────────────────────────────────────────────────────
// BUILD PROTOCOL — scored result + derived signals → ClinicalProfile
//
// Pure assembly: no scoring logic, no signal derivation.
// Combines the outputs of scoreConditions() and deriveSignals() into the
// ClinicalProfile contract consumed by downstream engines (kit-scorer,
// therapy-engine, report narration, clinic dashboards).
//
// Future expansion: kit sequence assembly from DiagnosisKey → KitId[] will
// live here, driven by protocols/global.json, once the protocol layer is wired.
// ─────────────────────────────────────────────────────────────────────────────

export function buildClinicalProfile(
  scored: ScoredConditionResult,
  derived: DerivedSignals,
  flags: ClinicalFlags,
): ClinicalProfile {
  return {
    primaryDiagnosis: scored.dominant,
    primaryScore: scored.topScore,
    secondaryDiagnoses: scored.secondary,
    allScores: scored.allScores,
    scalpStates: derived.scalpStates,
    rootCauses: derived.rootCauses,
    severity: derived.severity,
    flags,
  };
}
