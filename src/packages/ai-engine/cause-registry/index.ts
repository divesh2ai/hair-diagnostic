// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE ENGINE — Public API (Phase 3)
//
// Reads DetectedSignalSet + DetectedPathwaySet and produces a
// DetectedRootCauseSet bucketed into PRIMARY / SECONDARY / CONTRIBUTING.
//
// All clinical knowledge lives in catalog.ts. engine.ts is pure mechanics.
// ─────────────────────────────────────────────────────────────────────────────

export { evaluateRootCauses } from './engine';
export {
  CAUSE_CATALOG,
  CAUSE_IDS,
  CAUSE_REGISTRY_VERSION,
  getCause,
} from './catalog';
export type {
  RootCauseId,
  RootCauseRole,
  RootCauseDefinition,
  DetectedRootCause,
  DetectedRootCauseSet,
  CauseContribution,
  PathwayContribution,
  PathwayAffinity,
  SignalConfirmation,
  SignalConfirmationRole,
} from './types';
