import type { KitRecommendation, ScoredKit } from '../../kit-scorer/types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { PatientAnswers } from '../../../types';
import type { KitNarrative, IngredientHighlight } from '../types';
import { THERAPY_NEED_PATIENT_LABELS, THERAPY_NEED_LABELS } from '../constants';
import { isFemale, resolveAge, joinWithAnd } from '../utils';

// ─── Kit Selection Reason Builder ────────────────────────────────────────────

export function mapKitToNarrativeBundle(
  kitRecommendation: KitRecommendation,
  profile: ClinicalProfile,
  patient: PatientAnswers
): readonly KitNarrative[] {
  return kitRecommendation.rankedKits.map(kit =>
    buildKitNarrative(kit, kitRecommendation, profile, patient)
  );
}

function buildKitNarrative(
  kit: ScoredKit,
  recommendation: KitRecommendation,
  profile: ClinicalProfile,
  patient: PatientAnswers
): KitNarrative {
  const age = resolveAge(patient);
  const female = isFemale(patient);

  const triggeringSignals = buildTriggeringSignals(kit, profile, patient);
  const targetedMechanisms = kit.matchedNeeds.map(n => THERAPY_NEED_LABELS[n]);
  const ingredientHighlights = buildIngredientHighlights(kit.kitId, kit.matchedNeeds, profile, female);
  const biologicalExplanation = buildBiologicalExplanation(kit.kitId, kit.matchedNeeds, profile);
  const expectedBenefits = buildExpectedBenefits(kit.kitId, kit.matchedNeeds, profile.severity);
  const usageImportance = buildUsageImportance(kit.kitId, kit.matchedNeeds);
  const expectedTimeline = buildExpectedTimeline(kit.kitId, profile.primaryDiagnosis, profile.severity);
  const patientFriendlyPurpose = buildPatientFriendlyPurpose(kit.matchedNeeds, female, age);

  const reasonForSelection = buildReasonForSelection(kit, recommendation, profile);
  const consistencyNote = buildConsistencyNote(kit.kitId, kit.matchedNeeds);

  return {
    kitId: kit.kitId,
    displayName: formatKitDisplayName(kit.kitId),
    phase: kit.phase,
    reasonForSelection,
    triggeringSignals,
    targetedMechanisms,
    ingredientHighlights,
    biologicalExplanation,
    expectedBenefits,
    usageImportance,
    expectedTimeline,
    consistencyNote,
    patientFriendlyPurpose,
  };
}

function buildReasonForSelection(
  kit: ScoredKit,
  recommendation: KitRecommendation,
  profile: ClinicalProfile
): string {
  const needLabels = kit.matchedNeeds.slice(0, 3).map(n => THERAPY_NEED_LABELS[n]);
  const reasonParts = kit.reasons.slice(0, 2);

  if (reasonParts.length > 0) {
    return `${reasonParts[0]}. This kit was selected because it directly addresses ${joinWithAnd(needLabels)} — the therapeutic priorities identified in your clinical assessment.`;
  }

  return `This kit was selected for Phase ${kit.phase} of your protocol because it addresses ${joinWithAnd(needLabels)}, matching ${kit.matchedNeeds.length} of your identified therapy needs.`;
}

function buildTriggeringSignals(
  kit: ScoredKit,
  profile: ClinicalProfile,
  patient: PatientAnswers
): readonly string[] {
  const signals: string[] = [];

  if (kit.matchedNeeds.includes('DHT_SUPPRESSION')) {
    signals.push(`Androgenetic pattern identified (${profile.primaryDiagnosis.replace(/_/g, ' ')})`);
  }
  if (kit.matchedNeeds.includes('SHEDDING_ARREST') && profile.flags.hasActiveShedding) {
    signals.push('Active shedding pattern confirmed in assessment');
  }
  if (kit.matchedNeeds.includes('IRON_REPLETION') && profile.rootCauses.includes('IRON_DEFICIENCY')) {
    signals.push('Iron deficiency identified as root cause');
  }
  if (kit.matchedNeeds.includes('HORMONAL_REBALANCING')) {
    signals.push('Hormonal imbalance identified as contributing driver');
  }
  if (kit.matchedNeeds.includes('INFLAMMATION_CONTROL') && profile.scalpStates.some(s => s.includes('INFLAM'))) {
    signals.push('Scalp inflammation confirmed in scalp assessment');
  }
  if (kit.matchedNeeds.includes('THYROID_SUPPORT') && profile.rootCauses.includes('HYPOTHYROID')) {
    signals.push('Thyroid dysfunction identified');
  }
  if (kit.matchedNeeds.includes('FOLLICLE_STIMULATION') && profile.flags.isGrade123) {
    signals.push('Follicle miniaturisation at Grade 1–3 — high stimulation response expected');
  }
  if (kit.matchedNeeds.includes('METABOLIC_SUPPORT') && profile.rootCauses.includes('METABOLIC')) {
    signals.push('Metabolic dysfunction contributing to hair loss');
  }
  if (profile.flags.isGrade45 && kit.phase === 1) {
    signals.push('Advanced grade — high-priority Phase 1 intervention selected');
  }

  if (signals.length === 0) {
    signals.push(`${kit.matchedNeeds.length} matching therapy needs identified in clinical assessment`);
  }

  return signals;
}

function buildIngredientHighlights(
  kitId: string,
  needs: readonly import('../../therapy-engine/types').TherapyNeed[],
  profile: ClinicalProfile,
  female: boolean
): readonly IngredientHighlight[] {
  const highlights: IngredientHighlight[] = [];

  // DHT suppression ingredients
  if (needs.includes('DHT_SUPPRESSION')) {
    if (!female) {
      highlights.push({
        name: 'Finasteride / Dutasteride',
        role: '5α-reductase inhibitor',
        mechanism: 'Blocks conversion of testosterone to DHT, reducing follicle miniaturisation signal by up to 70%.',
        evidenceNote: 'Strong evidence — first-line for male AGA (ISHRS/EDA guidelines).',
      });
    } else {
      highlights.push({
        name: 'Spironolactone / Saw Palmetto Extract',
        role: 'Androgen receptor blocker / 5α-reductase modulator',
        mechanism: 'Reduces androgen receptor binding at follicles, mitigating DHT-driven miniaturisation in hormone-sensitive FPHL.',
        evidenceNote: 'Moderate-strong evidence in FPHL with androgenic component.',
      });
    }
  }

  // Follicle stimulation
  if (needs.includes('FOLLICLE_STIMULATION')) {
    highlights.push({
      name: 'Minoxidil',
      role: 'Follicle stimulator / vasodilator',
      mechanism: 'Opens potassium channels, increases follicle blood flow and prostaglandin E2, prolonging anagen and reactivating dormant follicles.',
      evidenceNote: 'Strongest evidence base of any topical hair treatment. FDA-approved for both genders.',
    });
  }

  // Inflammation control
  if (needs.includes('INFLAMMATION_CONTROL')) {
    highlights.push({
      name: 'Ketoconazole / Zinc Pyrithione',
      role: 'Anti-inflammatory / anti-fungal',
      mechanism: 'Reduces scalp Malassezia colonisation and associated IL-1α/PGD2 release, lowering follicular inflammation and sebum-driven damage.',
      evidenceNote: 'Ketoconazole 2% shown to reduce scalp inflammation and complement finasteride therapy.',
    });
  }

  // Iron repletion
  if (needs.includes('IRON_REPLETION')) {
    highlights.push({
      name: 'Ferrous Bisglycinate / Iron Chelate',
      role: 'Iron supplement',
      mechanism: 'Highly bioavailable iron form restores ferritin stores, supporting ribonucleotide reductase activity in rapidly dividing hair matrix cells.',
      evidenceNote: 'Ferritin >40–70 ng/mL consistently associated with TE resolution in nutritional hair loss.',
    });
  }

  // Hormonal rebalancing
  if (needs.includes('HORMONAL_REBALANCING') && female) {
    highlights.push({
      name: 'Myo-Inositol / DIM (Diindolylmethane)',
      role: 'Hormonal modulator',
      mechanism: 'Myo-inositol improves insulin sensitivity and reduces androgen production in PCOS; DIM supports oestrogen metabolism balance.',
      evidenceNote: 'Myo-inositol: RCT evidence in PCOS-related androgenic hair loss.',
    });
  }

  // Antioxidant support
  if (needs.includes('ANTIOXIDANT_SUPPORT')) {
    highlights.push({
      name: 'Vitamin E / CoQ10 / Astaxanthin',
      role: 'Antioxidant complex',
      mechanism: 'Neutralises ROS in follicle mitochondria, protecting against oxidative DNA damage and reducing premature catagen entry.',
      evidenceNote: 'Combination antioxidants shown to improve hair density markers in oxidative stress hair loss.',
    });
  }

  // Thyroid support
  if (needs.includes('THYROID_SUPPORT')) {
    highlights.push({
      name: 'Selenium / Iodine / L-Tyrosine',
      role: 'Thyroid cofactors',
      mechanism: 'Selenium and iodine are essential for thyroid hormone synthesis; L-tyrosine is the structural precursor to T3/T4.',
      evidenceNote: 'Supportive; works alongside medical thyroid management not as a replacement.',
    });
  }

  // Gut restoration
  if (needs.includes('GUT_RESTORATION')) {
    highlights.push({
      name: 'Multi-strain Probiotics / Digestive Enzymes',
      role: 'Gut restoration complex',
      mechanism: 'Restores microbiome diversity and intestinal barrier integrity, improving absorption of iron, zinc, B12, and amino acids critical for follicle function.',
      evidenceNote: 'Indirect evidence via nutrient absorption improvement and systemic inflammation reduction.',
    });
  }

  return highlights;
}

function buildBiologicalExplanation(
  kitId: string,
  needs: readonly import('../../therapy-engine/types').TherapyNeed[],
  profile: ClinicalProfile
): string {
  const needLabels = needs.slice(0, 3).map(n => THERAPY_NEED_PATIENT_LABELS[n]);
  const mechanismSummary = joinWithAnd(needLabels);

  const severityContext = profile.severity === 'SEVERE'
    ? ' Given the advanced stage of presentation, this kit forms the cornerstone of stabilisation before regrowth can be supported.'
    : profile.severity === 'MODERATE'
    ? ' At your current stage, this kit is expected to both slow progression and begin supporting follicle recovery.'
    : ' At your early-stage presentation, the biological conditions remain favourable for a strong response.';

  return `This kit works biologically by ${mechanismSummary}. The active ingredients are formulated to deliver these effects at the follicle level, where hair loss originates.${severityContext}`;
}

function buildExpectedBenefits(
  kitId: string,
  needs: readonly import('../../therapy-engine/types').TherapyNeed[],
  severity: import('../../../types').Severity
): readonly string[] {
  const benefits: string[] = [];

  if (needs.includes('SHEDDING_ARREST')) {
    benefits.push('Reduction in daily hair fall within 4–8 weeks');
  }
  if (needs.includes('DHT_SUPPRESSION')) {
    benefits.push('Slowing of follicle miniaturisation with continued use');
  }
  if (needs.includes('FOLLICLE_STIMULATION')) {
    benefits.push('Reactivation of dormant follicles; fine new hair growth visible at 3–6 months');
  }
  if (needs.includes('INFLAMMATION_CONTROL')) {
    benefits.push('Improved scalp condition: reduced redness, oiliness, and itch');
  }
  if (needs.includes('IRON_REPLETION')) {
    benefits.push('Restored energy metabolism in follicle cells; reduced shedding within 3–6 months');
  }
  if (needs.includes('HORMONAL_REBALANCING')) {
    benefits.push('Gradual reduction in hormonally-driven follicle stress over 3–6 months');
  }
  if (needs.includes('ANTIOXIDANT_SUPPORT')) {
    benefits.push('Improved hair fibre quality and reduced oxidative follicle damage');
  }

  if (severity === 'SEVERE' && !benefits.includes('Slowing of follicle miniaturisation with continued use')) {
    benefits.unshift('Stabilisation of further hair loss — the primary goal at this stage');
  }

  return benefits.length > 0
    ? benefits
    : ['Progressive improvement in hair density and scalp health with consistent use'];
}

function buildUsageImportance(
  kitId: string,
  needs: readonly import('../../therapy-engine/types').TherapyNeed[]
): string {
  if (needs.includes('DHT_SUPPRESSION')) {
    return 'DHT-suppressing therapy requires consistent daily use to maintain reduced DHT levels. Missing doses allows DHT to recover quickly, reversing progress within weeks.';
  }
  if (needs.includes('FOLLICLE_STIMULATION')) {
    return 'Follicle stimulation therapy works cumulatively. The first 3 months build the foundation — inconsistent use significantly delays the point at which visible results appear.';
  }
  if (needs.includes('IRON_REPLETION')) {
    return 'Iron supplementation requires consistent daily intake to rebuild depleted stores. Ferritin levels recover slowly — usually over 3–6 months — and intermittent use prolongs the deficiency.';
  }
  return 'Consistent daily use is essential. Hair growth cycles operate on a 3–6 month timeline, and irregular use interrupts the therapeutic continuity needed for measurable results.';
}

function buildExpectedTimeline(
  kitId: string,
  diagnosis: import('../../../types').DiagnosisKey,
  severity: import('../../../types').Severity
): string {
  const base: Record<import('../../../types').Severity, string> = {
    MILD: 'Early improvement (reduced shedding) expected within 4–8 weeks. Visible density improvement typically seen at 3–6 months.',
    MODERATE: 'Shedding reduction expected within 6–10 weeks. Measurable density improvement at 6–9 months with consistent use.',
    SEVERE: 'Stabilisation (slowing of progression) is the first milestone — expected within 8–12 weeks. Density improvement, where follicles are viable, may take 9–15 months.',
  };
  return base[severity];
}

function buildPatientFriendlyPurpose(
  needs: readonly import('../../therapy-engine/types').TherapyNeed[],
  female: boolean,
  age: number
): string {
  const topNeeds = needs.slice(0, 2).map(n => THERAPY_NEED_PATIENT_LABELS[n]);
  return `This kit is specifically designed for ${joinWithAnd(topNeeds)}, personalised to your clinical profile.`;
}

function buildConsistencyNote(
  kitId: string,
  needs: readonly import('../../therapy-engine/types').TherapyNeed[]
): string {
  const isTopical = kitId.toLowerCase().includes('topical') ||
    needs.includes('FOLLICLE_STIMULATION') ||
    needs.includes('DHT_SUPPRESSION');

  if (isTopical) {
    return 'Apply as directed every day — consistency is more important than any single application. Missing days extends the timeline to visible results.';
  }
  return 'Take as directed every day. Hair supplementation requires sustained blood levels to support the follicle growth cycle — sporadic use will not deliver results.';
}

function formatKitDisplayName(kitId: string): string {
  return kitId
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/Aga/g, 'AGA')
    .replace(/Pcos/g, 'PCOS')
    .replace(/Te/g, 'TE');
}
