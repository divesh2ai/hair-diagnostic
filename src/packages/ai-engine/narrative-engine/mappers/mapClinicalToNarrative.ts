import type { ClinicalProfile } from '../../clinical-engine/types';
import type { PatientAnswers } from '../../../types';
import type { EducationalInsight, ConfidenceExplanation } from '../types';
import {
  DIAGNOSIS_LABELS,
  ROOT_CAUSE_LABELS,
  CONDITION_REVERSIBILITY,
  SEVERITY_CLINICAL_LABELS,
} from '../constants';
import { confidenceLevel, joinWithAnd, resolveAge, isFemale } from '../utils';

// ─── Clinical-to-Narrative Signal Map ────────────────────────────────────────

export interface ClinicalNarrativeContext {
  readonly diagnosisLabel: string;
  readonly severityLabel: string;
  readonly reversibility: 'reversible' | 'partially-reversible' | 'chronic-manageable';
  readonly rootCausesSummary: string;
  readonly rootCauseBullets: readonly string[];
  readonly differentialsSummary: string;
  readonly signalSummary: string;
  readonly patientContext: string;
  readonly educationalInsights: readonly EducationalInsight[];
  readonly confidenceExplanation: ConfidenceExplanation;
}

export function mapClinicalToNarrative(
  profile: ClinicalProfile,
  patient: PatientAnswers
): ClinicalNarrativeContext {
  const age = resolveAge(patient);
  const female = isFemale(patient);
  const diagnosisLabel = DIAGNOSIS_LABELS[profile.primaryDiagnosis];
  const severityLabel = SEVERITY_CLINICAL_LABELS[profile.severity];
  const reversibility = CONDITION_REVERSIBILITY[profile.primaryDiagnosis];

  const rootCauseBullets = profile.rootCauses.map(rc => ROOT_CAUSE_LABELS[rc]);
  const rootCausesSummary =
    rootCauseBullets.length > 0
      ? `Primary drivers identified: ${joinWithAnd(rootCauseBullets)}.`
      : 'Root causes under further assessment.';

  const differentialsSummary = profile.secondaryDiagnoses.length > 0
    ? `Differential diagnoses considered: ${profile.secondaryDiagnoses
        .slice(0, 3)
        .map(d => `${DIAGNOSIS_LABELS[d.key]} (score: ${d.score})`)
        .join('; ')}.`
    : 'No significant differential diagnoses identified.';

  const scalpContext = profile.scalpStates.length > 0
    ? `Scalp states include ${joinWithAnd(profile.scalpStates.map(s => s.replace(/_/g, ' ').toLowerCase()))}.`
    : '';

  const signalSummary = buildSignalSummary(profile, patient, age, female);
  const patientContext = buildPatientContext(patient, age, female);

  const educationalInsights = buildEducationalInsights(profile, patient);
  const confidenceExplanation = buildConfidenceExplanation(profile);

  return {
    diagnosisLabel,
    severityLabel,
    reversibility,
    rootCausesSummary,
    rootCauseBullets,
    differentialsSummary: `${differentialsSummary} ${scalpContext}`.trim(),
    signalSummary,
    patientContext,
    educationalInsights,
    confidenceExplanation,
  };
}

function buildSignalSummary(
  profile: ClinicalProfile,
  patient: PatientAnswers,
  age: number,
  female: boolean
): string {
  const parts: string[] = [];

  if (profile.flags.hasActiveShedding) {
    parts.push('active shedding pattern is present');
  }
  if (profile.flags.isGrade45) {
    parts.push('advanced follicular miniaturisation is noted');
  }
  if (profile.flags.isGrade123) {
    parts.push('early-to-moderate follicular involvement is present');
  }
  if (profile.rootCauses.includes('DHT')) {
    parts.push('androgenic activity is a primary driver');
  }
  if (profile.rootCauses.includes('STRESS')) {
    parts.push('stress-triggered growth cycle disruption is a factor');
  }
  if (profile.rootCauses.includes('IRON_DEFICIENCY')) {
    parts.push('iron stores are insufficient for optimal follicle function');
  }
  if (profile.rootCauses.includes('HYPOTHYROID')) {
    parts.push('thyroid insufficiency is impacting follicle cycling');
  }
  if (profile.rootCauses.includes('PCOS')) {
    parts.push('androgen excess from PCOS is driving follicular sensitivity');
  }
  if (female && profile.rootCauses.includes('HORMONAL_SHIFT')) {
    parts.push('oestrogen decline is reducing follicle protection');
  }
  if (age > 50 && female) {
    parts.push('menopausal hormonal transition adds to follicular vulnerability');
  }
  if (profile.rootCauses.includes('GUT_MALABSORPTION')) {
    parts.push('gut malabsorption is limiting nutrient delivery to follicles');
  }

  return parts.length > 0
    ? `Key signals: ${joinWithAnd(parts)}.`
    : 'Clinical signals point to the diagnosed condition.';
}

function buildPatientContext(patient: PatientAnswers, age: number, female: boolean): string {
  const parts: string[] = [];
  parts.push(`${age}-year-old ${female ? 'female' : 'male'}`);
  if (patient.duration) {
    parts.push(`presenting with ${patient.duration} of hair loss`);
  }
  if (patient.lifestyle?.includes('HIGH_STRESS')) {
    parts.push('high psychological stress reported');
  }
  if (patient.is_pregnant) {
    parts.push('currently pregnant');
  }
  if (patient.planning_pregnancy) {
    parts.push('planning pregnancy — protocol modified accordingly');
  }
  if (patient.hasHypertension) {
    parts.push('hypertension noted — contraindication review applied');
  }
  return parts.join(', ') + '.';
}

function buildEducationalInsights(
  profile: ClinicalProfile,
  patient: PatientAnswers
): readonly EducationalInsight[] {
  const insights: EducationalInsight[] = [];

  if (profile.rootCauses.includes('DHT')) {
    insights.push({
      topic: 'DHT and follicle miniaturisation',
      patientFriendlyExplanation:
        'DHT is a form of testosterone that binds to receptors in genetically sensitive follicles, causing them to gradually shrink and produce finer, shorter hairs over time.',
      clinicalContext:
        'Dihydrotestosterone (5α-reduced androgen) binds AR receptors in follicular dermal papillae, triggering progressive miniaturisation in susceptible individuals.',
      relevantBecause:
        'DHT sensitivity is identified as a primary driver in your case, making DHT-blocking therapies central to your protocol.',
    });
  }

  if (profile.rootCauses.includes('STRESS')) {
    insights.push({
      topic: 'How stress disrupts hair growth cycles',
      patientFriendlyExplanation:
        'Under sustained stress, cortisol signals hair follicles to prematurely enter a resting phase, leading to diffuse shedding 2–3 months after the stressful period.',
      clinicalContext:
        'Elevated corticotropin-releasing hormone (CRH) disrupts the anagen-to-catagen transition via neuroimmune signalling at the follicular dermal papilla.',
      relevantBecause:
        'Stress-triggered telogen shift is part of your current hair loss pattern, making cortisol management relevant to your recovery.',
    });
  }

  if (profile.rootCauses.includes('IRON_DEFICIENCY')) {
    insights.push({
      topic: 'Iron and hair growth',
      patientFriendlyExplanation:
        'Hair follicles are among the most metabolically active cells in the body and are highly sensitive to iron levels. Low iron forces your body to prioritise vital organs over hair growth.',
      clinicalContext:
        'Ferritin below 40 ng/mL is consistently associated with telogen effluvium. Iron is essential for ribonucleotide reductase activity in rapidly dividing follicle matrix cells.',
      relevantBecause:
        'Iron insufficiency is contributing to your current shedding and is a correctable factor in your recovery plan.',
    });
  }

  if (profile.rootCauses.includes('PCOS')) {
    insights.push({
      topic: 'PCOS and androgenic hair loss',
      patientFriendlyExplanation:
        'PCOS causes the ovaries to produce excess androgens. These androgens are converted to DHT at the follicle level, triggering the same miniaturisation seen in genetic hair loss.',
      clinicalContext:
        'PCOS-associated hyperandrogenism elevates free testosterone and DHEAS, increasing 5α-reductase activity at susceptible follicles.',
      relevantBecause:
        'PCOS-driven androgen excess is a central driver in your case, requiring hormonal-level correction alongside topical therapy.',
    });
  }

  if (profile.rootCauses.includes('HORMONAL_SHIFT')) {
    insights.push({
      topic: 'Oestrogen and hair protection',
      patientFriendlyExplanation:
        'Oestrogen extends the active growth phase of hair follicles. As levels decline during menopause, follicles shorten their growth cycles, producing finer, shorter hairs.',
      clinicalContext:
        'Oestradiol prolongs anagen via ERα/ERβ receptor signalling in follicular keratinocytes and dermal papilla cells. Declining levels accelerate AGA in genetically predisposed women.',
      relevantBecause:
        'Hormonal transition is amplifying follicular vulnerability in your case, making hormonal support a key pillar of your protocol.',
    });
  }

  return insights;
}

function buildConfidenceExplanation(profile: ClinicalProfile): ConfidenceExplanation {
  const score = Math.min(100, Math.round(profile.primaryScore));
  const level = confidenceLevel(score);

  const supportingSignals: string[] = [];
  const limitingFactors: string[] = [];

  if (profile.flags.hasActiveShedding) supportingSignals.push('Active shedding pattern aligns with diagnosis');
  if (profile.rootCauses.length > 2) supportingSignals.push(`${profile.rootCauses.length} concordant root cause signals identified`);
  if (profile.scalpStates.length > 0) supportingSignals.push('Scalp states corroborate underlying mechanism');

  if (profile.secondaryDiagnoses.length > 0 && profile.secondaryDiagnoses[0].score > 60) {
    limitingFactors.push(
      `${DIAGNOSIS_LABELS[profile.secondaryDiagnoses[0].key]} remains a significant differential (score: ${profile.secondaryDiagnoses[0].score})`
    );
  }
  if (profile.rootCauses.length < 2) {
    limitingFactors.push('Limited root cause corroboration; additional workup may improve precision');
  }

  const differentiationNote =
    profile.secondaryDiagnoses.length > 0
      ? `Primary diagnosis was distinguished from ${DIAGNOSIS_LABELS[profile.secondaryDiagnoses[0].key]} based on signal weighting.`
      : 'Diagnosis was established with high signal concordance.';

  return {
    score,
    level,
    supportingSignals,
    limitingFactors,
    differentiationNote,
  };
}
