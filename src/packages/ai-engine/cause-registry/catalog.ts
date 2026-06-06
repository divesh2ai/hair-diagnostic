import type { RootCauseDefinition, RootCauseId } from './types';

export const CAUSE_REGISTRY_VERSION = '3.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// ROOT CAUSE REGISTRY — PHASE 3 CLEAN BUILD
// No Phase 4 fields allowed here
// ─────────────────────────────────────────────────────────────────────────────

const C = (c: RootCauseDefinition): RootCauseDefinition => Object.freeze(c);

export const CAUSE_CATALOG: ReadonlyArray<RootCauseDefinition> = Object.freeze([

// ───────────────────────── ANDROGENIC ─────────────────────────

C({
  id: 'ANDROGEN_DRIVEN_MINIATURIZATION',
  label: 'Androgen-Driven Follicular Miniaturization',
  narrativeMeaning:
    'Genetically susceptible follicles progressively miniaturize under androgen influence.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'FOLLICULAR_MINIATURIZATION', weight: 1.0 },
    { pathwayId: 'SCALP_INFLAMMATION', weight: 0.2 },
  ],
  signalConfirmations: [
    { signalId: 'GENETIC_PREDISPOSITION', weight: 3.0, role: 'CONFIRMS' },
    { signalId: 'FOLLICULAR_MINIATURIZATION_PATTERN', weight: 3.0, role: 'CONFIRMS' },
    { signalId: 'ADVANCED_PATTERN_LOSS', weight: 1.5, role: 'SUPPORTS' },
    { signalId: 'EARLY_PATTERN_LOSS', weight: 1.5, role: 'SUPPORTS' },
    { signalId: 'ANDROGEN_EXPOSURE_LIFESTYLE', weight: 1.5, role: 'SUPPORTS' },
  ],
  mandatorySignals: [
    'FOLLICULAR_MINIATURIZATION_PATTERN',
    'GENETIC_PREDISPOSITION',
  ],
}),

// ───────────────────────── TELogen EFFLUVIUM ─────────────────────────

C({
  id: 'STRESS_DRIVEN_TE',
  label: 'Stress-Driven Telogen Effluvium',
  narrativeMeaning:
    'Psychological stress shifts follicles into telogen causing diffuse shedding after a delay.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 0.7 },
  ],
  signalConfirmations: [
    { signalId: 'PSYCHOLOGICAL_STRESS', weight: 3.0, role: 'CONFIRMS' },
    { signalId: 'ACTIVE_SHEDDING', weight: 1.5, role: 'SUPPORTS' },
  ],
  mandatorySignals: ['PSYCHOLOGICAL_STRESS'],
}),

C({
  id: 'POST_PARTUM_TE',
  label: 'Post-Partum Telogen Effluvium',
  narrativeMeaning:
    'Post-delivery hormonal withdrawal triggers synchronized follicular shedding.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'POST_PARTUM', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['POST_PARTUM'],
}),

C({
  id: 'ILLNESS_DRIVEN_TE',
  label: 'Illness / Surgery Telogen Effluvium',
  narrativeMeaning:
    'Systemic illness or surgery causes delayed synchronized hair shedding.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'RECENT_ILLNESS_OR_SURGERY', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['RECENT_ILLNESS_OR_SURGERY'],
}),

C({
  id: 'MEDICATION_INDUCED_TE',
  label: 'Medication-Induced Telogen Effluvium',
  narrativeMeaning:
    'Certain medications disrupt anagen maintenance and trigger shedding.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 0.7 },
  ],
  signalConfirmations: [
    { signalId: 'MEDICATION_INDUCED', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['MEDICATION_INDUCED'],
}),

C({
  id: 'RAPID_WEIGHT_LOSS_TE',
  label: 'Rapid Weight Loss Telogen Effluvium',
  narrativeMeaning:
    'Metabolic stress from rapid weight loss triggers diffuse shedding.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'RAPID_WEIGHT_LOSS', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['RAPID_WEIGHT_LOSS'],
}),

// ───────────────────────── HORMONAL ─────────────────────────

C({
  id: 'PCOS_DRIVEN_HORMONAL',
  label: 'PCOS-Driven Hormonal Hair Loss',
  narrativeMeaning:
    'Hormonal imbalance in PCOS drives follicular miniaturization in female pattern loss.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'HORMONAL_DYSREGULATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'PCOS', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['PCOS'],
}),

C({
  id: 'MENOPAUSAL_TRANSITION',
  label: 'Menopausal Hair Loss',
  narrativeMeaning:
    'Estrogen decline shifts follicular cycling and accelerates thinning.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'HORMONAL_DYSREGULATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'MENOPAUSE', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['MENOPAUSE'],
}),

C({
  id: 'HYPOTHYROID_HAIR_LOSS',
  label: 'Hypothyroid Hair Loss',
  narrativeMeaning:
    'Low thyroid function slows hair cycling and prolongs telogen.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'HORMONAL_DYSREGULATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'HYPOTHYROIDISM', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['HYPOTHYROIDISM'],
}),

C({
  id: 'HYPERTHYROID_HAIR_LOSS',
  label: 'Hyperthyroid Hair Loss',
  narrativeMeaning:
    'Excess thyroid activity accelerates follicular cycling disruption.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'HORMONAL_DYSREGULATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'HYPERTHYROIDISM', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['HYPERTHYROIDISM'],
}),

// ───────────────────────── NUTRITIONAL ─────────────────────────

C({
  id: 'IRON_DEFICIENCY_ANAEMIA',
  label: 'Iron Deficiency Anaemia',
  narrativeMeaning:
    'Low iron stores impair follicular oxygenation and growth.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'NUTRITIONAL_LIMITATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'IRON_DEFICIENCY', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['IRON_DEFICIENCY'],
}),

C({
  id: 'NUTRITIONAL_HAIR_STRESS',
  label: 'Nutritional Hair Stress',
  narrativeMeaning:
    'Poor nutrition limits follicular building blocks.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'NUTRITIONAL_LIMITATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'POOR_DIET_QUALITY', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['POOR_DIET_QUALITY'],
}),

// ───────────────────────── IMMUNE ─────────────────────────

C({
  id: 'AUTOIMMUNE_HAIR_LOSS',
  label: 'Autoimmune Hair Loss',
  narrativeMeaning:
    'Immune system attacks anagen follicles causing patchy loss.',
  severityPrior: 'HIGH',
  pathwayAffinities: [
    { pathwayId: 'IMMUNE_DYSREGULATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'AUTOIMMUNE_HAIR_LOSS', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['AUTOIMMUNE_HAIR_LOSS'],
}),

// ───────────────────────── SCALP INFLAMMATION ─────────────────────────

C({
  id: 'INFLAMMATORY_SCALP_DYSFUNCTION',
  label: 'Inflammatory Scalp Dysfunction',
  narrativeMeaning:
    'Chronic scalp inflammation damages follicular environment.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'SCALP_INFLAMMATION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'ACTIVE_INFLAMMATION', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['ACTIVE_INFLAMMATION'],
}),

// ───────────────────────── GUT / METABOLIC / OXIDATIVE ─────────────────────────

C({
  id: 'GUT_AXIS_DYSFUNCTION',
  label: 'Gut Axis Dysfunction',
  narrativeMeaning:
    'Gut impairment reduces nutrient absorption affecting hair growth.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'GUT_HAIR_AXIS', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'GUT_DYSFUNCTION', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['GUT_DYSFUNCTION'],
}),

C({
  id: 'METABOLIC_DRIVEN_HAIR_LOSS',
  label: 'Metabolic Hair Loss',
  narrativeMeaning:
    'Metabolic dysfunction reduces follicular efficiency.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'METABOLIC_DYSFUNCTION', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'METABOLIC_DYSFUNCTION', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['METABOLIC_DYSFUNCTION'],
}),

C({
  id: 'OXIDATIVE_LIFESTYLE',
  label: 'Oxidative Stress Hair Loss',
  narrativeMeaning:
    'Lifestyle-induced oxidative stress damages follicles.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'OXIDATIVE_STRESS', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'OXIDATIVE_STRESS', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['OXIDATIVE_STRESS'],
}),

C({
  id: 'CIRCADIAN_DRIVEN_TE',
  label: 'Circadian Hair Loss',
  narrativeMeaning:
    'Sleep cycle disruption affects follicular rhythm.',
  severityPrior: 'LOW',
  pathwayAffinities: [
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 0.4 },
  ],
  signalConfirmations: [
    { signalId: 'CIRCADIAN_DISRUPTION', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['CIRCADIAN_DISRUPTION'],
}),

// ───────────────────────── SHAFT DAMAGE ─────────────────────────

C({
  id: 'HAIR_SHAFT_DAMAGE_SYNDROME',
  label: 'Hair Shaft Damage Syndrome',
  narrativeMeaning:
    'Damage to hair shaft rather than follicle.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'HAIR_SHAFT_DAMAGE', weight: 1.0 },
  ],
  signalConfirmations: [
    { signalId: 'SHAFT_DAMAGE', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['SHAFT_DAMAGE'],
}),

// ───────────────────────── BEHAVIOURAL ─────────────────────────

C({
  id: 'TRICHOTILLOMANIA_CAUSE',
  label: 'Trichotillomania',
  narrativeMeaning:
    'Compulsive hair pulling causes mechanical loss.',
  severityPrior: 'HIGH',
  pathwayAffinities: [],
  signalConfirmations: [
    { signalId: 'TRICHOTILLOMANIA', weight: 3.0, role: 'CONFIRMS' },
  ],
  mandatorySignals: ['TRICHOTILLOMANIA'],
}),

// ───────────────────────── MULTIFACTORIAL ─────────────────────────

C({
  id: 'MULTIFACTORIAL_HAIR_LOSS',
  label: 'Multifactorial Hair Loss',
  narrativeMeaning:
    'Multiple overlapping biological drivers with no dominant cause.',
  severityPrior: 'MEDIUM',
  pathwayAffinities: [
    { pathwayId: 'FOLLICULAR_MINIATURIZATION', weight: 0.3 },
    { pathwayId: 'TELOGEN_CYCLE_DISRUPTION', weight: 0.3 },
    { pathwayId: 'SCALP_INFLAMMATION', weight: 0.3 },
  ],
  signalConfirmations: [],
}),

]);

const BY_ID = Object.freeze(
  CAUSE_CATALOG.reduce<Record<RootCauseId, RootCauseDefinition>>((acc, c) => {
    acc[c.id] = c;
    return acc;
  }, {} as Record<RootCauseId, RootCauseDefinition>),
);

export function getCause(id: RootCauseId): RootCauseDefinition {
  return BY_ID[id];
}

export const CAUSE_IDS: ReadonlyArray<RootCauseId> = Object.freeze(
  CAUSE_CATALOG.map((c) => c.id),
);