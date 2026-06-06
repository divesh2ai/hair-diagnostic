import type { SignalWeight, SignalId } from '../signal-registry';

// ─────────────────────────────────────────────────────────────────────────────
// BIOLOGICAL PATHWAY ENGINE — Phase 2 types
//
// A biological pathway is a mechanism of hair loss / dysfunction. The engine's
// job is to read the Signal Registry's DetectedSignalSet and decide which
// pathways are active, how strong they are, and how confident the platform
// can be in each conclusion.
//
// The 10 canonical pathways come from the V2 directive. The engine never
// invents pathway IDs at runtime — the catalog is closed.
// ─────────────────────────────────────────────────────────────────────────────

export type PathwayId =
  | 'FOLLICULAR_MINIATURIZATION'
  | 'TELOGEN_CYCLE_DISRUPTION'
  | 'SCALP_INFLAMMATION'
  | 'IMMUNE_DYSREGULATION'
  | 'HORMONAL_DYSREGULATION'
  | 'METABOLIC_DYSFUNCTION'
  | 'OXIDATIVE_STRESS'
  | 'NUTRITIONAL_LIMITATION'
  | 'GUT_HAIR_AXIS'
  | 'HAIR_SHAFT_DAMAGE';

/**
 * Per-signal contribution role inside a pathway. Roles modulate scoring so we
 * never collapse "12 weak signals" into a high-strength pathway just by count.
 */
export type SignalRole = 'PRIMARY' | 'SUPPORTING' | 'MODIFIER';

export interface PathwayContributor {
  readonly signalId: SignalId;
  readonly role: SignalRole;
}

/** Catalog entry — defines what makes a pathway, narratively and mechanically. */
export interface BiologicalPathway {
  readonly id: PathwayId;
  /** Display label, used by narrative engine. */
  readonly label: string;
  /** Short biological description. */
  readonly description: string;
  /** Signals that, when fired, push this pathway toward active. */
  readonly contributors: readonly PathwayContributor[];
  /**
   * Optional gating signal ids — pathway cannot be active unless at least one of
   * these fired. Used to prevent e.g. SCALP_INFLAMMATION from firing on systemic
   * inflammation alone.
   */
  readonly requiresAny?: readonly SignalId[];
  /**
   * Optional suppressor ids — fired suppressors reduce strength (e.g. NO_VISIBLE_FALL
   * suppresses TELOGEN_CYCLE_DISRUPTION).
   */
  readonly suppressors?: readonly SignalId[];
}

export type PathwayStrength = 'INACTIVE' | 'LOW' | 'MODERATE' | 'HIGH';

/** A pathway that was evaluated for a specific patient. */
export interface DetectedPathway {
  readonly id: PathwayId;
  /** 0..100 — used by downstream engines as the canonical pathway score. */
  readonly score: number;
  /** Categorical bucket derived from `score`. */
  readonly strength: PathwayStrength;
  /** Catalog confidence × evidence breadth, bucketed. */
  readonly confidence: SignalWeight;
  /** Derived severity — distinct from strength: HIGH severity may exist at MODERATE strength. */
  readonly severity: SignalWeight;
  /** Signal ids that contributed positively. */
  readonly supportingSignals: readonly SignalId[];
  /** Signal ids that suppressed this pathway. */
  readonly suppressingSignals: readonly SignalId[];
  /** Why-trace: per-contributor numeric contribution for Phase 10 explainability. */
  readonly contributionTrace: ReadonlyArray<{
    readonly signalId: SignalId;
    readonly role: SignalRole;
    readonly delta: number;
  }>;
}

export interface DetectedPathwaySet {
  /** All catalog pathways, in canonical order. INACTIVE ones included. */
  readonly all: readonly DetectedPathway[];
  /** Convenience: only pathways with strength !== INACTIVE. */
  readonly active: readonly DetectedPathway[];
  readonly byId: Readonly<Record<PathwayId, DetectedPathway>>;
  readonly engineVersion: string;
}
