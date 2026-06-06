import type { PathwayId } from '../pathway-engine';
import type { SignalId, SignalWeight } from '../signal-registry';

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE ENGINE TYPES — CLEAN V2 CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

export type RootCauseId =
  | 'ANDROGEN_DRIVEN_MINIATURIZATION'
  | 'STRESS_DRIVEN_TE'
  | 'POST_PARTUM_TE'
  | 'ILLNESS_DRIVEN_TE'
  | 'MEDICATION_INDUCED_TE'
  | 'RAPID_WEIGHT_LOSS_TE'
  | 'PCOS_DRIVEN_HORMONAL'
  | 'MENOPAUSAL_TRANSITION'
  | 'HYPOTHYROID_HAIR_LOSS'
  | 'HYPERTHYROID_HAIR_LOSS'
  | 'IRON_DEFICIENCY_ANAEMIA'
  | 'NUTRITIONAL_HAIR_STRESS'
  | 'AUTOIMMUNE_HAIR_LOSS'
  | 'INFLAMMATORY_SCALP_DYSFUNCTION'
  | 'GUT_AXIS_DYSFUNCTION'
  | 'OXIDATIVE_LIFESTYLE'
  | 'CIRCADIAN_DRIVEN_TE'
  | 'METABOLIC_DRIVEN_HAIR_LOSS'
  | 'HAIR_SHAFT_DAMAGE_SYNDROME'
  | 'TRICHOTILLOMANIA_CAUSE'
  | 'MULTIFACTORIAL_HAIR_LOSS';

/** Pathway affinity */
export interface PathwayAffinity {
  readonly pathwayId: PathwayId;
  readonly weight: number; // 0–1
}

export type SignalConfirmationRole = 'CONFIRMS' | 'SUPPORTS' | 'MODIFIES';

export interface SignalConfirmation {
  readonly signalId: SignalId;
  readonly weight: number;
  readonly role: SignalConfirmationRole;
}

/** FINAL SOURCE OF TRUTH */
export interface RootCauseDefinition {
  readonly id: RootCauseId;
  readonly label: string;
  readonly narrativeMeaning: string;

  readonly severityPrior: SignalWeight;

  readonly pathwayAffinities: ReadonlyArray<PathwayAffinity>;
  readonly signalConfirmations: ReadonlyArray<SignalConfirmation>;

  readonly mandatorySignals?: ReadonlyArray<SignalId>;
  readonly excludes?: ReadonlyArray<RootCauseId>;
}

export type RootCauseRole = 'PRIMARY' | 'SECONDARY' | 'CONTRIBUTING';

export interface CauseContribution {
  readonly signalId: SignalId;
  readonly role: SignalConfirmationRole;
  readonly delta: number;
}

export interface PathwayContribution {
  readonly pathwayId: PathwayId;
  readonly affinity: number;
  readonly pathwayScore: number;
  readonly delta: number;
}

export interface DetectedRootCause {
  readonly id: RootCauseId;
  readonly role: RootCauseRole;
  readonly score: number;
  readonly confidence: SignalWeight;
  readonly severity: SignalWeight;

  readonly supportingSignals: readonly SignalId[];
  readonly drivingPathways: readonly PathwayId[];

  readonly demotedCauses: readonly RootCauseId[];

  readonly signalTrace: readonly CauseContribution[];
  readonly pathwayTrace: readonly PathwayContribution[];
}

export interface DetectedRootCauseSet {
  readonly all: readonly DetectedRootCause[];
  readonly primary: DetectedRootCause | null;
  readonly secondary: readonly DetectedRootCause[];
  readonly contributing: readonly DetectedRootCause[];
  readonly byId: Readonly<Partial<Record<RootCauseId, DetectedRootCause>>>;
  readonly engineVersion: string;
}