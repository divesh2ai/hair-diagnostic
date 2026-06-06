import type { ClinicalSignal } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL SIGNAL CATALOG
//
// Biology-shaped signals. Pathway IDs in `typicalPathways` are forward
// references — the Pathway Engine (Phase 2) will define the canonical list.
// They are authoring hints, not contracts.
//
// Naming convention:
//   <BIOLOGY>_<PHENOTYPE>  — e.g. FOLLICULAR_MINIATURIZATION_PATTERN
//
// Severity / confidence weights are deliberately coarse. The pathway scoring
// pass converts these into numeric contributions.
// ─────────────────────────────────────────────────────────────────────────────

export const SIGNAL_REGISTRY_VERSION = '1.0.0';

const C = (signal: ClinicalSignal): ClinicalSignal => Object.freeze(signal);

export const SIGNAL_CATALOG: ReadonlyArray<ClinicalSignal> = Object.freeze([
  // ── SHEDDING ──────────────────────────────────────────────────────────────
  C({
    id: 'ACTIVE_SHEDDING',
    category: 'SHEDDING',
    biologicalSystem: 'HAIR_CYCLE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'The patient is currently losing hair at a rate above physiological baseline.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'CHRONIC_TELOGEN',
    category: 'SHEDDING',
    biologicalSystem: 'HAIR_CYCLE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Shedding has persisted long enough that the hair cycle has shifted toward sustained telogen dominance.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION', 'FOLLICULAR_MINIATURIZATION'],
  }),
  C({
    id: 'LONG_DURATION_SHEDDING',
    category: 'SHEDDING',
    biologicalSystem: 'HAIR_CYCLE',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Duration of hair fall exceeds 12 months — a marker of follicular stress and chronicity.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'NO_VISIBLE_FALL',
    category: 'SHEDDING',
    biologicalSystem: 'HAIR_CYCLE',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Active shedding has stopped; remaining concern is regrowth and density, not loss.',
  }),
  C({
    id: 'HAIR_CYCLE_DYSREGULATION',
    category: 'SHEDDING',
    biologicalSystem: 'HAIR_CYCLE',
    severityWeight: 'HIGH',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning:
      'The follicular cycle is dysregulated — anagen is shortened, telogen prolonged, or shedding desynchronized.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),

  // ── PATTERN ───────────────────────────────────────────────────────────────
  C({
    id: 'FOLLICULAR_MINIATURIZATION_PATTERN',
    category: 'PATTERN',
    biologicalSystem: 'FOLLICLE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Visible thinning, widening parting, or crown / temple recession consistent with androgen-driven follicular miniaturization.',
    typicalPathways: ['FOLLICULAR_MINIATURIZATION'],
  }),
  C({
    id: 'ADVANCED_PATTERN_LOSS',
    category: 'PATTERN',
    biologicalSystem: 'FOLLICLE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Grade 4 or 5 pattern loss — substantial portion of follicles already miniaturized or absent.',
    typicalPathways: ['FOLLICULAR_MINIATURIZATION'],
  }),
  C({
    id: 'EARLY_PATTERN_LOSS',
    category: 'PATTERN',
    biologicalSystem: 'FOLLICLE',
    severityWeight: 'LOW',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning:
      'Grade 1–2 pattern loss — early-stage miniaturization with high follicular reserve.',
    typicalPathways: ['FOLLICULAR_MINIATURIZATION'],
  }),
  C({
    id: 'PATCHY_LOSS',
    category: 'PATTERN',
    biologicalSystem: 'IMMUNE_SYSTEM',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Circular or patchy hair loss consistent with autoimmune alopecia areata.',
    typicalPathways: ['IMMUNE_DYSREGULATION'],
  }),

  // ── SCALP ─────────────────────────────────────────────────────────────────
  C({
    id: 'OILY_SCALP',
    category: 'SCALP',
    biologicalSystem: 'SCALP_BARRIER',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Excess sebum production indicating sebaceous gland hyperactivity, often DHT-mediated.',
    typicalPathways: ['SCALP_INFLAMMATION', 'FOLLICULAR_MINIATURIZATION'],
  }),
  C({
    id: 'DRY_SCALP',
    category: 'SCALP',
    biologicalSystem: 'SCALP_BARRIER',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Compromised lipid barrier and reduced sebum, predisposing to flaking and irritation.',
    typicalPathways: ['SCALP_INFLAMMATION'],
  }),
  C({
    id: 'DANDRUFF',
    category: 'SCALP',
    biologicalSystem: 'SCALP_BARRIER',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Malassezia-driven flaking with follicular irritation — frequently co-occurs with AGA.',
    typicalPathways: ['SCALP_INFLAMMATION', 'FOLLICULAR_MINIATURIZATION'],
  }),
  C({
    id: 'SCALP_BARRIER_DYSFUNCTION',
    category: 'SCALP',
    biologicalSystem: 'SCALP_BARRIER',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'The scalp barrier is impaired, reducing follicular protection and increasing inflammation susceptibility.',
    typicalPathways: ['SCALP_INFLAMMATION'],
  }),
  C({
    id: 'PSORIATIC_SCALP',
    category: 'SCALP',
    biologicalSystem: 'IMMUNE_SYSTEM',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Psoriasis involvement of the scalp — chronic T-cell driven inflammation.',
    typicalPathways: ['SCALP_INFLAMMATION', 'IMMUNE_DYSREGULATION'],
  }),
  C({
    id: 'SENSITIVE_SCALP',
    category: 'SCALP',
    biologicalSystem: 'SCALP_BARRIER',
    severityWeight: 'LOW',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Heightened scalp reactivity — narrows the safe formulation window.',
  }),

  // ── INFLAMMATION ──────────────────────────────────────────────────────────
  C({
    id: 'ACTIVE_INFLAMMATION',
    category: 'INFLAMMATION',
    biologicalSystem: 'SCALP_BARRIER',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Visible scalp redness, burning, boils, or pimples — perifollicular inflammation actively disrupting follicles.',
    typicalPathways: ['SCALP_INFLAMMATION'],
  }),
  C({
    id: 'CHRONIC_INFLAMMATORY_PHENOTYPE',
    category: 'INFLAMMATION',
    biologicalSystem: 'IMMUNE_SYSTEM',
    severityWeight: 'HIGH',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning:
      'Pattern of long-standing inflammatory burden across scalp and systemic compartments.',
    typicalPathways: ['SCALP_INFLAMMATION', 'IMMUNE_DYSREGULATION'],
  }),
  C({
    id: 'FOLLICULAR_STRESS',
    category: 'INFLAMMATION',
    biologicalSystem: 'FOLLICLE',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning:
      'Follicles under sustained stress from chronicity, inflammation, or metabolic insult — recovery latency increased.',
    typicalPathways: ['FOLLICULAR_MINIATURIZATION', 'TELOGEN_CYCLE_DISRUPTION'],
  }),

  // ── IMMUNE ────────────────────────────────────────────────────────────────
  C({
    id: 'IMMUNE_DYSREGULATION_SYSTEMIC',
    category: 'IMMUNE',
    biologicalSystem: 'IMMUNE_SYSTEM',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning:
      'Allergies, asthma, frequent infections or skin rashes suggesting an over- or under-modulated immune system.',
    typicalPathways: ['IMMUNE_DYSREGULATION'],
  }),
  C({
    id: 'AUTOIMMUNE_HAIR_LOSS',
    category: 'IMMUNE',
    biologicalSystem: 'IMMUNE_SYSTEM',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Confirmed alopecia areata — T-cell attack on anagen follicles.',
    typicalPathways: ['IMMUNE_DYSREGULATION'],
  }),

  // ── HORMONAL ──────────────────────────────────────────────────────────────
  C({
    id: 'PCOS',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Polycystic ovary syndrome — hyperandrogenism and insulin resistance driving follicular miniaturization.',
    typicalPathways: ['HORMONAL_DYSREGULATION', 'FOLLICULAR_MINIATURIZATION', 'METABOLIC_DYSFUNCTION'],
  }),
  C({
    id: 'PERIMENOPAUSE_TRANSITION',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Estrogen decline and relative androgen excess during the perimenopausal transition.',
    typicalPathways: ['HORMONAL_DYSREGULATION'],
  }),
  C({
    id: 'MENOPAUSE',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Established menopause with sustained estrogen withdrawal.',
    typicalPathways: ['HORMONAL_DYSREGULATION'],
  }),
  C({
    id: 'POST_MENOPAUSE',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Post-menopausal state — chronic low estrogen with cumulative follicular impact.',
    typicalPathways: ['HORMONAL_DYSREGULATION'],
  }),
  C({
    id: 'POST_PARTUM',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Post-partum telogen effluvium driven by abrupt estrogen withdrawal after delivery.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION', 'HORMONAL_DYSREGULATION'],
  }),
  C({
    id: 'PREGNANCY',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Currently pregnant — contraindicates most active hair therapies.',
  }),
  C({
    id: 'ENDOMETRIOSIS',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Endometriosis — estrogen-dominant inflammatory milieu.',
    typicalPathways: ['HORMONAL_DYSREGULATION'],
  }),
  C({
    id: 'HORMONAL_SHIFT_GENERIC',
    category: 'HORMONAL',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'LOW',
    narrativeMeaning: 'Non-specific hormonal disturbance reported by the patient.',
  }),

  // ── THYROID ───────────────────────────────────────────────────────────────
  C({
    id: 'HYPOTHYROIDISM',
    category: 'THYROID',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Underactive thyroid — slows hair growth rate and prolongs telogen.',
    typicalPathways: ['HORMONAL_DYSREGULATION', 'TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'HYPERTHYROIDISM',
    category: 'THYROID',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Overactive thyroid — accelerated catagen entry and diffuse shedding.',
    typicalPathways: ['HORMONAL_DYSREGULATION', 'TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'DIABETES',
    category: 'METABOLIC',
    biologicalSystem: 'METABOLIC_SYSTEM',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Established or pre-diabetes — insulin resistance with microvascular impact on follicles.',
    typicalPathways: ['METABOLIC_DYSFUNCTION'],
  }),

  // ── METABOLIC ─────────────────────────────────────────────────────────────
  C({
    id: 'METABOLIC_DYSFUNCTION',
    category: 'METABOLIC',
    biologicalSystem: 'METABOLIC_SYSTEM',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Obesity, sedentary lifestyle, or insulin-resistance signals.',
    typicalPathways: ['METABOLIC_DYSFUNCTION'],
  }),
  C({
    id: 'RAPID_WEIGHT_LOSS',
    category: 'METABOLIC',
    biologicalSystem: 'METABOLIC_SYSTEM',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'GLP-1 use or crash dieting — rapid catabolic state triggering telogen effluvium.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION', 'NUTRITIONAL_LIMITATION'],
  }),

  // ── OXIDATIVE ─────────────────────────────────────────────────────────────
  C({
    id: 'OXIDATIVE_STRESS',
    category: 'OXIDATIVE',
    biologicalSystem: 'REDOX',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Smoking, vaping, or alcohol exposure — elevated reactive oxygen species impacting follicles.',
    typicalPathways: ['OXIDATIVE_STRESS'],
  }),

  // ── NUTRITIONAL ───────────────────────────────────────────────────────────
  C({
    id: 'IRON_DEFICIENCY',
    category: 'NUTRITIONAL',
    biologicalSystem: 'NUTRITION',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Iron deficiency or anaemia — limits oxygen delivery and ferritin-dependent anagen.',
    typicalPathways: ['NUTRITIONAL_LIMITATION', 'TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'POOR_DIET_QUALITY',
    category: 'NUTRITIONAL',
    biologicalSystem: 'NUTRITION',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Irregular or poor-quality diet — risk of multi-micronutrient under-supply.',
    typicalPathways: ['NUTRITIONAL_LIMITATION'],
  }),
  C({
    id: 'VEGETARIAN_PROFILE',
    category: 'NUTRITIONAL',
    biologicalSystem: 'NUTRITION',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Plant-based diet — modifies micronutrient risk profile (iron, B12, protein adequacy).',
  }),
  C({
    id: 'CRASH_DIETING',
    category: 'NUTRITIONAL',
    biologicalSystem: 'NUTRITION',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Severely restrictive dieting — acute caloric and protein deficit driving shedding.',
    typicalPathways: ['NUTRITIONAL_LIMITATION', 'TELOGEN_CYCLE_DISRUPTION'],
  }),

  // ── GUT ───────────────────────────────────────────────────────────────────
  C({
    id: 'GUT_DYSFUNCTION',
    category: 'GUT',
    biologicalSystem: 'GUT_AXIS',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'IBS, GERD, bloating, or Crohn-spectrum signals — gut-hair axis dysfunction impairing nutrient absorption.',
    typicalPathways: ['GUT_HAIR_AXIS', 'NUTRITIONAL_LIMITATION'],
  }),

  // ── SHAFT ─────────────────────────────────────────────────────────────────
  C({
    id: 'SHAFT_DAMAGE',
    category: 'SHAFT',
    biologicalSystem: 'SHAFT_INTEGRITY',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Broken or short hairs indicating shaft fragility — distinct from follicular loss.',
    typicalPathways: ['HAIR_SHAFT_DAMAGE'],
  }),
  C({
    id: 'CHEMICAL_HEAT_EXPOSURE',
    category: 'SHAFT',
    biologicalSystem: 'SHAFT_INTEGRITY',
    severityWeight: 'LOW',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'History of heat or chemical treatments — predisposes to cuticle damage if combined with breakage.',
    typicalPathways: ['HAIR_SHAFT_DAMAGE'],
  }),
  C({
    id: 'HARD_WATER_EXPOSURE',
    category: 'SHAFT',
    biologicalSystem: 'SHAFT_INTEGRITY',
    severityWeight: 'LOW',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Mineral-heavy water exposure — contributes to shaft brittleness and scalp residue.',
    typicalPathways: ['HAIR_SHAFT_DAMAGE'],
  }),

  // ── LIFESTYLE ─────────────────────────────────────────────────────────────
  C({
    id: 'CIRCADIAN_DISRUPTION',
    category: 'LIFESTYLE',
    biologicalSystem: 'CIRCADIAN',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Night shift work or frequent flying — circadian disruption impacting follicular cycling.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'ANDROGEN_EXPOSURE_LIFESTYLE',
    category: 'LIFESTYLE',
    biologicalSystem: 'ENDOCRINE',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Heavy gym or bodybuilding context — possible exogenous or endogenous androgen elevation.',
    typicalPathways: ['FOLLICULAR_MINIATURIZATION'],
  }),

  // ── PSYCH / NEURO ─────────────────────────────────────────────────────────
  C({
    id: 'PSYCHOLOGICAL_STRESS',
    category: 'PSYCH_NEURO',
    biologicalSystem: 'NEURO_PSYCH',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Self-reported stress, anxiety, or depression — well-established TE driver.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'TRICHOTILLOMANIA',
    category: 'PSYCH_NEURO',
    biologicalSystem: 'NEURO_PSYCH',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Compulsive hair pulling (trichotillomania) — mechanical follicular trauma.',
  }),

  // ── GENETIC ───────────────────────────────────────────────────────────────
  C({
    id: 'GENETIC_PREDISPOSITION',
    category: 'GENETIC',
    biologicalSystem: 'GENOMIC',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Family history of hair loss — established androgenetic risk.',
    typicalPathways: ['FOLLICULAR_MINIATURIZATION'],
  }),

  // ── ILLNESS / MEDICATION ──────────────────────────────────────────────────
  C({
    id: 'RECENT_ILLNESS_OR_SURGERY',
    category: 'ILLNESS',
    biologicalSystem: 'SYSTEMIC_HEALTH',
    severityWeight: 'HIGH',
    confidenceWeight: 'HIGH',
    narrativeMeaning:
      'Recent acute illness or surgery — known precipitant of acute telogen effluvium with 2–3 month lag.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'MEDICATION_INDUCED',
    category: 'ILLNESS',
    biologicalSystem: 'SYSTEMIC_HEALTH',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Current medication potentially contributing to anagen or telogen disruption.',
    typicalPathways: ['TELOGEN_CYCLE_DISRUPTION'],
  }),
  C({
    id: 'CHRONIC_MEDICAL_CONDITION',
    category: 'ILLNESS',
    biologicalSystem: 'SYSTEMIC_HEALTH',
    severityWeight: 'MEDIUM',
    confidenceWeight: 'MEDIUM',
    narrativeMeaning: 'Chronic medical condition contributing systemic inflammatory or metabolic load.',
  }),

  // ── GOAL ──────────────────────────────────────────────────────────────────
  C({
    id: 'REGROW_ONLY_GOAL',
    category: 'GOAL',
    biologicalSystem: 'NONE',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Patient reports shedding has stopped — goal is regrowth, not loss arrest.',
  }),
  C({
    id: 'GREY_CONCERN_GOAL',
    category: 'GOAL',
    biologicalSystem: 'NONE',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Early greying is a stated co-concern.',
  }),

  // ── DEMOGRAPHIC MODIFIERS ─────────────────────────────────────────────────
  C({
    id: 'AGE_OVER_30',
    category: 'DEMOGRAPHIC',
    biologicalSystem: 'NONE',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Age above 30 — modestly elevated baseline AGA risk.',
  }),
  C({
    id: 'AGE_UNDER_30_FEMALE',
    category: 'DEMOGRAPHIC',
    biologicalSystem: 'NONE',
    severityWeight: 'LOW',
    confidenceWeight: 'HIGH',
    narrativeMeaning: 'Female under 30 — FPHL diagnosis gated; TE pathways usually more appropriate.',
  }),
]);

const BY_ID: Readonly<Record<string, ClinicalSignal>> = Object.freeze(
  SIGNAL_CATALOG.reduce<Record<string, ClinicalSignal>>((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {}),
);

/** Lookup a signal definition by id. */
export function getSignal(id: string): ClinicalSignal | undefined {
  return BY_ID[id];
}

/** Assert that an id corresponds to a real catalog entry. */
export function requireSignal(id: string): ClinicalSignal {
  const s = BY_ID[id];
  if (!s) throw new Error(`[signal-registry] Unknown signal id: ${id}`);
  return s;
}

export const SIGNAL_IDS: ReadonlyArray<string> = Object.freeze(
  SIGNAL_CATALOG.map((s) => s.id),
);
