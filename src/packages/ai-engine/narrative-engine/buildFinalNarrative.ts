import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';
import type { KitRecommendation } from '../kit-scorer/types';
import type { ComposedNarrative } from '../explanations/composers/types';
import type {
  PrognosisNarrative,
  RecoveryExpectation,
  TherapyExplanation,
  FollowupPlan,
} from './types';
import {
  RECOVERY_WINDOWS,
  THERAPY_NEED_LABELS,
  THERAPY_NEED_PATIENT_LABELS,
  FOLLOWUP_PRIORITY_BY_SEVERITY,
} from './constants';
import { mapTherapyToTimeline } from './mappers/mapTherapyToTimeline';

// ─── Prognosis Narrative Builder ──────────────────────────────────────────────

export function buildPrognosisNarrative(
  profile: ClinicalProfile,
  therapyPlan: TherapyNeeds,
  kitRecommendation: KitRecommendation,
  composedPrognosis?: ComposedNarrative
): PrognosisNarrative {
  const recoveryWindow = RECOVERY_WINDOWS[profile.primaryDiagnosis];
  const timelineEvents = mapTherapyToTimeline(therapyPlan, kitRecommendation, profile);

  const shortSummary = composedPrognosis?.short
    ?? buildShortPrognosisSummary(profile, recoveryWindow);

  const detailedText = composedPrognosis?.full
    ?? buildDetailedPrognosisText(profile, recoveryWindow);

  const recoveryExpectation = buildRecoveryExpectation(profile, recoveryWindow);
  const adherenceImpact = buildAdherenceImpact(profile);
  const geneticFactorNote = buildGeneticFactorNote(profile);
  const reversibilityStatement = buildReversibilityStatement(profile);

  return {
    shortSummary,
    detailedText,
    recoveryExpectation,
    timelineEvents,
    adherenceImpact,
    geneticFactorNote,
    reversibilityStatement,
  };
}

function buildShortPrognosisSummary(profile: ClinicalProfile, recoveryWindow: string): string {
  const severityMap: Record<typeof profile.severity, string> = {
    MILD: `With early-stage presentation, the prognosis is favourable. ${recoveryWindow}.`,
    MODERATE: `With consistent treatment, meaningful improvement is achievable. ${recoveryWindow}.`,
    SEVERE: `Stabilisation followed by gradual improvement is the expected trajectory. ${recoveryWindow}.`,
  };
  return severityMap[profile.severity];
}

function buildDetailedPrognosisText(profile: ClinicalProfile, recoveryWindow: string): string {
  const base = `Based on the clinical profile — ${profile.primaryDiagnosis.replace(/_/g, ' ')}, ${profile.severity.toLowerCase()} severity — the expected recovery trajectory is: ${recoveryWindow}.`;

  const adherence = ' Individual outcomes are substantially influenced by protocol adherence, with patients in the top adherence quartile consistently achieving outcomes at or above projected timelines.';

  const genetics = profile.rootCauses.includes('GENETICS') || profile.rootCauses.includes('DHT')
    ? ' Genetic predisposition introduces variability; however, evidence-based topical and systemic therapy has demonstrated efficacy even in genetically driven cases.'
    : '';

  const severity = profile.severity === 'SEVERE'
    ? ' At this severity level, complete regrowth cannot be guaranteed. The primary clinical objectives are stabilisation of further loss, followed by optimisation of existing follicle density.'
    : profile.severity === 'MODERATE'
    ? ' Moderate presentation carries a good prognosis with structured intervention. Partial-to-significant regrowth is expected in adherent patients.'
    : ' Early-stage presentation carries an excellent prognosis. Most patients achieve significant density recovery with consistent treatment.';

  return base + adherence + genetics + severity;
}

function buildRecoveryExpectation(
  profile: ClinicalProfile,
  recoveryWindow: string
): RecoveryExpectation {
  const bestCases: Record<typeof profile.severity, string> = {
    MILD: 'Full shedding arrest within 4–6 weeks; visible density improvement by month 3–4; near-complete recovery by month 6.',
    MODERATE: 'Shedding arrest by 6–8 weeks; noticeable improvement by month 4–6; significant density recovery by month 9–12.',
    SEVERE: 'Stabilisation by 8–12 weeks; early improvement signals by month 6; meaningful density change by month 12–18.',
  };

  const typicalCases: Record<typeof profile.severity, string> = {
    MILD: 'Reduced shedding within 6–8 weeks; improved coverage by month 4–5; sustained improvement with maintenance.',
    MODERATE: 'Reduced shedding by 8–10 weeks; visible improvement by month 6–9; continued improvement with adherence.',
    SEVERE: 'Slowed progression by 10–14 weeks; stabilisation by month 4–6; gradual improvement thereafter.',
  };

  const conservativeCases: Record<typeof profile.severity, string> = {
    MILD: 'Shedding reduction within 3 months; density improvement visible by month 6.',
    MODERATE: 'Stabilisation within 3 months; density improvement visible by month 9.',
    SEVERE: 'Stabilisation within 4–6 months; modest improvement visible by month 12–18.',
  };

  return {
    bestCase: bestCases[profile.severity],
    typicalCase: typicalCases[profile.severity],
    conservativeCase: conservativeCases[profile.severity],
    variabilityNote: 'Individual responses vary. Factors including genetics, comorbidities, adherence, hormonal status, and nutritional baseline all influence outcomes.',
    keyDependencies: [
      'Daily protocol adherence',
      profile.rootCauses.includes('IRON_DEFICIENCY') ? 'Iron replenishment to therapeutic target (ferritin >70 ng/mL)' : '',
      profile.rootCauses.includes('HYPOTHYROID') ? 'Thyroid normalisation' : '',
      profile.rootCauses.includes('STRESS') ? 'Stress management' : '',
      profile.rootCauses.includes('PCOS') ? 'Hormonal management' : '',
      'Regular clinic review',
    ].filter(Boolean),
  };
}

function buildAdherenceImpact(profile: ClinicalProfile): string {
  return 'Clinical data consistently shows that patients in the top adherence quartile achieve outcomes 40–60% better than those with intermittent use. Skipping treatment, even briefly, reactivates the biological mechanisms driving hair loss. Adherence is a clinical variable — not a willpower issue — and should be supported by daily reminders and clinic follow-up.';
}

function buildGeneticFactorNote(profile: ClinicalProfile): string {
  if (!profile.rootCauses.includes('GENETICS') && !profile.rootCauses.includes('DHT')) {
    return 'No significant genetic predisposition was identified as a primary driver in this case.';
  }
  return 'Genetic factors contribute to this presentation. Genetic predisposition cannot be eliminated; however, targeted therapy significantly modifies the phenotypic expression of genetic hair loss susceptibility. Long-term maintenance therapy is expected.';
}

function buildReversibilityStatement(profile: ClinicalProfile): string {
  const map = {
    reversible: 'This condition is reversible. With appropriate treatment targeting the identified root cause(s), full recovery of hair density is a realistic expectation.',
    'partially-reversible': 'This condition is partially reversible. Significant improvement is expected with treatment, but some degree of ongoing management may be required, particularly where genetic or hormonal factors are present.',
    'chronic-manageable': 'This is a chronic, manageable condition. The clinical goal is long-term density preservation and optimisation, rather than complete reversal. Maintenance therapy is expected indefinitely.',
  };

  const reversibility = profile.rootCauses.includes('GENETICS') || profile.rootCauses.includes('DHT')
    ? 'chronic-manageable'
    : profile.primaryDiagnosis.startsWith('TE_')
    ? 'reversible'
    : 'partially-reversible';

  return map[reversibility];
}

// ─── Therapy Explanations ─────────────────────────────────────────────────────

export function buildTherapyExplanations(
  therapyPlan: TherapyNeeds,
  profile: ClinicalProfile
): readonly TherapyExplanation[] {
  return therapyPlan.needs.map(need => {
    const reasons = therapyPlan.needReasons[need] ?? [];
    return {
      need,
      displayLabel: THERAPY_NEED_LABELS[need],
      whyNeeded: reasons[0] ?? `${THERAPY_NEED_LABELS[need]} was identified as a therapy need based on clinical signals.`,
      howAddressed: buildHowAddressed(need),
      clinicalSignificance: buildClinicalSignificance(need, profile),
      patientExplanation: buildPatientTherapyExplanation(need),
    };
  });
}

function buildHowAddressed(need: import('../therapy-engine/types').TherapyNeed): string {
  const map: Partial<Record<import('../therapy-engine/types').TherapyNeed, string>> = {
    DHT_SUPPRESSION: 'Addressed via 5α-reductase inhibitors (finasteride/dutasteride) and/or androgen receptor modulators.',
    INFLAMMATION_CONTROL: 'Addressed via antifungal/anti-inflammatory scalp formulations and dietary anti-inflammatory support.',
    FOLLICLE_STIMULATION: 'Addressed via minoxidil and follicle-activating topical compounds (VEGF stimulators, PGE2 promoters).',
    IRON_REPLETION: 'Addressed via highly bioavailable oral iron supplementation targeting ferritin restoration to >70 ng/mL.',
    HORMONAL_REBALANCING: 'Addressed via hormonal modulators appropriate to gender and hormonal aetiology.',
    THYROID_SUPPORT: 'Addressed via thyroid cofactor supplementation alongside medical thyroid management.',
    GUT_RESTORATION: 'Addressed via multi-strain probiotics and digestive enzyme support to restore nutrient absorption.',
    SHEDDING_ARREST: 'Addressed via fast-acting topical and systemic shedding inhibitors as Phase 1 priority.',
    ANTIOXIDANT_SUPPORT: 'Addressed via antioxidant complex (Vitamin E, CoQ10, Astaxanthin) targeting follicle ROS damage.',
  };
  return map[need] ?? `${THERAPY_NEED_LABELS[need]} is addressed through targeted components of the recommended protocol.`;
}

function buildClinicalSignificance(
  need: import('../therapy-engine/types').TherapyNeed,
  profile: ClinicalProfile
): string {
  const map: Partial<Record<import('../therapy-engine/types').TherapyNeed, string>> = {
    DHT_SUPPRESSION: 'DHT is the primary driver of androgenic alopecia; its suppression is the most evidence-backed intervention in both male and female AGA.',
    FOLLICLE_STIMULATION: 'Follicle stimulation (minoxidil) has the strongest clinical evidence base of any hair loss intervention, with FDA approval for both genders.',
    INFLAMMATION_CONTROL: 'Scalp inflammation maintains a hostile follicular microenvironment; resolution is a prerequisite for effective regrowth.',
    IRON_REPLETION: 'Ferritin is the most commonly identified correctable nutritional deficiency in hair loss patients and is directly amenable to treatment.',
    SHEDDING_ARREST: 'Rapid shedding arrest is clinically valuable for both patient confidence and follicle preservation.',
  };
  return map[need] ?? `${THERAPY_NEED_LABELS[need]} is clinically significant in this presentation.`;
}

function buildPatientTherapyExplanation(need: import('../therapy-engine/types').TherapyNeed): string {
  const label = THERAPY_NEED_PATIENT_LABELS[need];
  return `This part of your protocol focuses on ${label}. It works with the other elements of your plan to address your hair loss from multiple angles simultaneously.`;
}

// ─── Followup Plan ────────────────────────────────────────────────────────────

export function buildFollowupPlan(profile: ClinicalProfile): FollowupPlan {
  const priority = FOLLOWUP_PRIORITY_BY_SEVERITY[profile.severity];
  const windowMap: Record<typeof profile.severity, string> = {
    MILD: '6 months post-initiation',
    MODERATE: '3 months post-initiation, then 6-monthly',
    SEVERE: '6 weeks post-initiation, then 3-monthly',
  };

  const assessmentPoints = [
    'Photographic comparison (standardised lighting and position)',
    'Patient-reported shedding score',
    'Trichoscopic follicle density assessment',
    profile.rootCauses.includes('IRON_DEFICIENCY') ? 'Ferritin retest' : '',
    profile.rootCauses.includes('HYPOTHYROID') ? 'Thyroid panel retest' : '',
    profile.rootCauses.includes('PCOS') ? 'Hormonal panel assessment' : '',
    'Protocol adherence review',
    'Side effect screening',
  ].filter(Boolean) as string[];

  const escalationTriggers = [
    'Continued worsening of hair loss despite 3+ months of adherent therapy',
    'New-onset alopecia areata patches',
    'Rapid progression beyond Grade 5',
    profile.primaryDiagnosis === 'ALOPECIA_AREATA' ? 'Expansion of patchy loss to diffuse pattern' : '',
    'Adverse reactions to protocol components',
  ].filter(Boolean) as string[];

  return {
    recommendedAt: windowMap[profile.severity],
    reason: `${priority.charAt(0).toUpperCase() + priority.slice(1)}-priority follow-up based on ${profile.severity.toLowerCase()} severity presentation.`,
    priority,
    assessmentPoints,
    escalationTriggers,
  };
}
