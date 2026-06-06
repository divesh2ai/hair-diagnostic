import type { BiologicalPathway, PathwayId } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// PATHWAY CATALOG
//
// The 10 canonical biological pathways. Each is authored as:
//   - contributors: list of (signalId, role) — PRIMARY signals drive score,
//     SUPPORTING signals add weight, MODIFIER signals shift severity but not
//     pathway activation.
//   - requiresAny: at least one of these signals must fire to consider the
//     pathway active (gates against false positives from MODIFIER-only sets).
//   - suppressors: signals that, when fired, deduct from pathway score.
//
// Authoring rule of thumb:
//   - PRIMARY: ~+30 base (a single one can move a pathway to MODERATE)
//   - SUPPORTING: ~+15
//   - MODIFIER: ~+5  (rarely activates a pathway on its own)
// (Exact numerics live in engine.ts so the catalog stays declarative.)
// ─────────────────────────────────────────────────────────────────────────────

export const PATHWAY_ENGINE_VERSION = '1.0.0';

const P = (p: BiologicalPathway): BiologicalPathway => Object.freeze(p);

export const PATHWAY_CATALOG: ReadonlyArray<BiologicalPathway> = Object.freeze([
  P({
    id: 'FOLLICULAR_MINIATURIZATION',
    label: 'Follicular Miniaturization',
    description:
      'Progressive shrinking of terminal follicles into vellus follicles under androgenic / genetic drive.',
    contributors: [
      { signalId: 'FOLLICULAR_MINIATURIZATION_PATTERN', role: 'PRIMARY' },
      { signalId: 'ADVANCED_PATTERN_LOSS',              role: 'PRIMARY' },
      { signalId: 'GENETIC_PREDISPOSITION',             role: 'PRIMARY' },
      { signalId: 'EARLY_PATTERN_LOSS',                 role: 'SUPPORTING' },
      { signalId: 'ANDROGEN_EXPOSURE_LIFESTYLE',        role: 'SUPPORTING' },
      { signalId: 'OILY_SCALP',                         role: 'SUPPORTING' },
      { signalId: 'DANDRUFF',                           role: 'SUPPORTING' },
      { signalId: 'PCOS',                               role: 'SUPPORTING' },
      { signalId: 'AGE_OVER_30',                        role: 'MODIFIER' },
      { signalId: 'CHRONIC_TELOGEN',                    role: 'MODIFIER' },
      { signalId: 'FOLLICULAR_STRESS',                  role: 'MODIFIER' },
    ],
    requiresAny: [
      'FOLLICULAR_MINIATURIZATION_PATTERN',
      'ADVANCED_PATTERN_LOSS',
      'EARLY_PATTERN_LOSS',
      'GENETIC_PREDISPOSITION',
      'ANDROGEN_EXPOSURE_LIFESTYLE',
    ],
  }),

  P({
    id: 'TELOGEN_CYCLE_DISRUPTION',
    label: 'Telogen Cycle Disruption',
    description:
      'Abnormal shift of follicles from anagen to telogen, producing diffuse shedding without pattern change.',
    contributors: [
      { signalId: 'ACTIVE_SHEDDING',            role: 'PRIMARY' },
      { signalId: 'CHRONIC_TELOGEN',            role: 'PRIMARY' },
      { signalId: 'POST_PARTUM',                role: 'PRIMARY' },
      { signalId: 'RECENT_ILLNESS_OR_SURGERY',  role: 'PRIMARY' },
      { signalId: 'PSYCHOLOGICAL_STRESS',       role: 'PRIMARY' },
      { signalId: 'RAPID_WEIGHT_LOSS',          role: 'PRIMARY' },
      { signalId: 'HYPOTHYROIDISM',             role: 'SUPPORTING' },
      { signalId: 'HYPERTHYROIDISM',            role: 'SUPPORTING' },
      { signalId: 'IRON_DEFICIENCY',            role: 'SUPPORTING' },
      { signalId: 'MEDICATION_INDUCED',         role: 'SUPPORTING' },
      { signalId: 'LONG_DURATION_SHEDDING',     role: 'SUPPORTING' },
      { signalId: 'HAIR_CYCLE_DYSREGULATION',   role: 'SUPPORTING' },
      { signalId: 'CIRCADIAN_DISRUPTION',       role: 'MODIFIER' },
      { signalId: 'CRASH_DIETING',              role: 'SUPPORTING' },
    ],
    requiresAny: [
      'ACTIVE_SHEDDING', 'CHRONIC_TELOGEN', 'POST_PARTUM',
      'RECENT_ILLNESS_OR_SURGERY', 'PSYCHOLOGICAL_STRESS', 'RAPID_WEIGHT_LOSS',
      'HAIR_CYCLE_DYSREGULATION',
    ],
    suppressors: ['NO_VISIBLE_FALL'],
  }),

  P({
    id: 'SCALP_INFLAMMATION',
    label: 'Scalp Inflammation',
    description:
      'Perifollicular inflammation impairing the follicular microenvironment and accelerating miniaturization.',
    contributors: [
      { signalId: 'ACTIVE_INFLAMMATION',             role: 'PRIMARY' },
      { signalId: 'PSORIATIC_SCALP',                 role: 'PRIMARY' },
      { signalId: 'CHRONIC_INFLAMMATORY_PHENOTYPE',  role: 'PRIMARY' },
      { signalId: 'DANDRUFF',                        role: 'SUPPORTING' },
      { signalId: 'OILY_SCALP',                      role: 'SUPPORTING' },
      { signalId: 'SCALP_BARRIER_DYSFUNCTION',       role: 'SUPPORTING' },
      { signalId: 'DRY_SCALP',                       role: 'MODIFIER' },
      { signalId: 'SENSITIVE_SCALP',                 role: 'MODIFIER' },
    ],
    requiresAny: [
      'ACTIVE_INFLAMMATION', 'PSORIATIC_SCALP', 'CHRONIC_INFLAMMATORY_PHENOTYPE',
      'DANDRUFF', 'OILY_SCALP', 'SCALP_BARRIER_DYSFUNCTION',
    ],
  }),

  P({
    id: 'IMMUNE_DYSREGULATION',
    label: 'Immune Dysregulation',
    description:
      'Aberrant immune activity targeting follicles or maintaining a pro-inflammatory state.',
    contributors: [
      { signalId: 'AUTOIMMUNE_HAIR_LOSS',            role: 'PRIMARY' },
      { signalId: 'IMMUNE_DYSREGULATION_SYSTEMIC',   role: 'PRIMARY' },
      { signalId: 'PSORIATIC_SCALP',                 role: 'SUPPORTING' },
      { signalId: 'CHRONIC_INFLAMMATORY_PHENOTYPE',  role: 'SUPPORTING' },
      { signalId: 'PATCHY_LOSS',                     role: 'SUPPORTING' },
      { signalId: 'GUT_DYSFUNCTION',                 role: 'MODIFIER' },
    ],
    requiresAny: ['AUTOIMMUNE_HAIR_LOSS', 'IMMUNE_DYSREGULATION_SYSTEMIC', 'PATCHY_LOSS'],
  }),

  P({
    id: 'HORMONAL_DYSREGULATION',
    label: 'Hormonal Dysregulation',
    description:
      'Sex-hormone or thyroid-hormone disturbance shifting follicular behavior.',
    contributors: [
      { signalId: 'PCOS',                       role: 'PRIMARY' },
      { signalId: 'PERIMENOPAUSE_TRANSITION',   role: 'PRIMARY' },
      { signalId: 'MENOPAUSE',                  role: 'PRIMARY' },
      { signalId: 'POST_MENOPAUSE',             role: 'PRIMARY' },
      { signalId: 'HYPOTHYROIDISM',             role: 'PRIMARY' },
      { signalId: 'HYPERTHYROIDISM',            role: 'PRIMARY' },
      { signalId: 'POST_PARTUM',                role: 'PRIMARY' },
      { signalId: 'ENDOMETRIOSIS',              role: 'SUPPORTING' },
      { signalId: 'HORMONAL_SHIFT_GENERIC',     role: 'SUPPORTING' },
      { signalId: 'ANDROGEN_EXPOSURE_LIFESTYLE',role: 'MODIFIER' },
      { signalId: 'PREGNANCY',                  role: 'MODIFIER' },
    ],
    requiresAny: [
      'PCOS', 'PERIMENOPAUSE_TRANSITION', 'MENOPAUSE', 'POST_MENOPAUSE',
      'HYPOTHYROIDISM', 'HYPERTHYROIDISM', 'POST_PARTUM',
      'ENDOMETRIOSIS', 'HORMONAL_SHIFT_GENERIC', 'PREGNANCY',
    ],
  }),

  P({
    id: 'METABOLIC_DYSFUNCTION',
    label: 'Metabolic Dysfunction',
    description:
      'Insulin resistance, obesity, or sedentary metabolic state impacting follicular blood supply and androgen handling.',
    contributors: [
      { signalId: 'DIABETES',                role: 'PRIMARY' },
      { signalId: 'METABOLIC_DYSFUNCTION',   role: 'PRIMARY' },
      { signalId: 'PCOS',                    role: 'SUPPORTING' },
      { signalId: 'RAPID_WEIGHT_LOSS',       role: 'SUPPORTING' },
      { signalId: 'CRASH_DIETING',           role: 'SUPPORTING' },
    ],
    requiresAny: ['DIABETES', 'METABOLIC_DYSFUNCTION', 'RAPID_WEIGHT_LOSS'],
  }),

  P({
    id: 'OXIDATIVE_STRESS',
    label: 'Oxidative Stress',
    description:
      'Elevated reactive oxygen species overwhelming follicular antioxidant defenses.',
    contributors: [
      { signalId: 'OXIDATIVE_STRESS',                role: 'PRIMARY' },
      { signalId: 'IMMUNE_DYSREGULATION_SYSTEMIC',   role: 'SUPPORTING' },
      { signalId: 'METABOLIC_DYSFUNCTION',           role: 'SUPPORTING' },
      { signalId: 'CIRCADIAN_DISRUPTION',            role: 'MODIFIER' },
      { signalId: 'CHRONIC_INFLAMMATORY_PHENOTYPE',  role: 'MODIFIER' },
    ],
    requiresAny: ['OXIDATIVE_STRESS'],
  }),

  P({
    id: 'NUTRITIONAL_LIMITATION',
    label: 'Nutritional Limitation',
    description:
      'Micronutrient or macronutrient under-supply constraining hair-shaft synthesis and anagen maintenance.',
    contributors: [
      { signalId: 'IRON_DEFICIENCY',         role: 'PRIMARY' },
      { signalId: 'CRASH_DIETING',           role: 'PRIMARY' },
      { signalId: 'POOR_DIET_QUALITY',       role: 'PRIMARY' },
      { signalId: 'RAPID_WEIGHT_LOSS',       role: 'SUPPORTING' },
      { signalId: 'GUT_DYSFUNCTION',         role: 'SUPPORTING' },
      { signalId: 'VEGETARIAN_PROFILE',      role: 'MODIFIER' },
    ],
    requiresAny: ['IRON_DEFICIENCY', 'CRASH_DIETING', 'POOR_DIET_QUALITY', 'RAPID_WEIGHT_LOSS'],
  }),

  P({
    id: 'GUT_HAIR_AXIS',
    label: 'Gut-Hair Axis Dysfunction',
    description:
      'Compromised gut function impairing nutrient absorption and modulating systemic inflammation.',
    contributors: [
      { signalId: 'GUT_DYSFUNCTION',                 role: 'PRIMARY' },
      { signalId: 'IRON_DEFICIENCY',                 role: 'SUPPORTING' },
      { signalId: 'IMMUNE_DYSREGULATION_SYSTEMIC',   role: 'MODIFIER' },
      { signalId: 'CHRONIC_INFLAMMATORY_PHENOTYPE',  role: 'MODIFIER' },
    ],
    requiresAny: ['GUT_DYSFUNCTION'],
  }),

  P({
    id: 'HAIR_SHAFT_DAMAGE',
    label: 'Hair Shaft Damage',
    description:
      'Cuticular and cortical damage to existing shafts — distinct from follicular loss.',
    contributors: [
      { signalId: 'SHAFT_DAMAGE',             role: 'PRIMARY' },
      { signalId: 'CHEMICAL_HEAT_EXPOSURE',   role: 'SUPPORTING' },
      { signalId: 'HARD_WATER_EXPOSURE',      role: 'SUPPORTING' },
    ],
    requiresAny: ['SHAFT_DAMAGE', 'CHEMICAL_HEAT_EXPOSURE', 'HARD_WATER_EXPOSURE'],
  }),
]);

const BY_ID = Object.freeze(
  PATHWAY_CATALOG.reduce<Record<PathwayId, BiologicalPathway>>((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<PathwayId, BiologicalPathway>),
);

export function getPathway(id: PathwayId): BiologicalPathway {
  return BY_ID[id];
}

export const PATHWAY_IDS: ReadonlyArray<PathwayId> = Object.freeze(
  PATHWAY_CATALOG.map((p) => p.id),
);
