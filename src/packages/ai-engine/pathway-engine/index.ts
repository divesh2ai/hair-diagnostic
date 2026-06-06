// ─────────────────────────────────────────────────────────────────────────────
// BIOLOGICAL PATHWAY ENGINE — Public API
//
// Phase 2 of HairOS V2. Reads the Signal Registry's DetectedSignalSet and
// produces a DetectedPathwaySet over the 10 canonical pathways.
//
// Additive: does not replace any existing engine. Phase 3 (Root Cause) will
// consume DetectedPathwaySet.
// ─────────────────────────────────────────────────────────────────────────────

export { evaluatePathways } from './engine';
export {
  PATHWAY_CATALOG,
  PATHWAY_IDS,
  PATHWAY_ENGINE_VERSION,
  getPathway,
} from './catalog';
export type {
  PathwayId,
  BiologicalPathway,
  DetectedPathway,
  DetectedPathwaySet,
  PathwayContributor,
  PathwayStrength,
  SignalRole,
} from './types';
