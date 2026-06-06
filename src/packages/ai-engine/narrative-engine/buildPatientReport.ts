import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';
import type { NarrativePipelineInput, PatientReport, NarrativeMetadata } from './types';
import { mapClinicalToNarrative } from './mappers/mapClinicalToNarrative';
import { mapSeverityToTone, getPatientOpeningStatement } from './mappers/mapSeverityToTone';
import { mapKitToNarrativeBundle } from './mappers/mapKitToNarrativeBundle';
import { mapConditionToEducation } from './mappers/mapConditionToEducation';
import { mapTherapyToTimeline } from './mappers/mapTherapyToTimeline';
import {
  formatWhatIsHappeningSection,
  formatWhyItIsHappeningSection,
  formatIsItReversibleSection,
  formatHowTherapiesWorkSection,
  formatHowKitsHelpSection,
  formatWhatToExpectSection,
  formatRealisticTimelineSection,
  formatPreventionAdviceSection,
  formatReassuranceSection,
  formatEducationalInsightsSection,
} from './formatters/formatPatientSections';
import { buildPrognosisNarrative, buildFollowupPlan } from './buildFinalNarrative';
import { resolvePatientName, nowISO, buildMetadata } from './utils';

// ─── Patient Report Builder ───────────────────────────────────────────────────

export function buildPatientReport(input: NarrativePipelineInput): PatientReport {
  const {
    patient,
    clinicalProfile: profile,
    therapyPlan,
    kitRecommendation,
    prognosis,
    narrativeLength = 'medium',
  } = input;

  const patientName = resolvePatientName(patient);
  const ctx = mapClinicalToNarrative(profile, patient);
  const tone = mapSeverityToTone(profile.severity);
  const kitNarratives = mapKitToNarrativeBundle(kitRecommendation, profile, patient);
  const prognosisNarrative = buildPrognosisNarrative(profile, therapyPlan, kitRecommendation, prognosis);
  const followupPlan = buildFollowupPlan(profile);
  const timeline = mapTherapyToTimeline(therapyPlan, kitRecommendation, profile);
  const conditionInsights = mapConditionToEducation(profile.primaryDiagnosis);
  const clinicalInsights = ctx.educationalInsights;
  const allInsights = [...conditionInsights, ...clinicalInsights].slice(0, 4);

  const greeting = buildGreeting(patientName, profile, tone);

  const metadata: NarrativeMetadata = {
    ...buildMetadata(profile, kitRecommendation.rankedKits.length, narrativeLength),
    therapyNeedCount: therapyPlan.needs.length,
  };

  return {
    generatedAt: nowISO(),
    greeting,

    whatIsHappening: formatWhatIsHappeningSection(ctx, profile, patient, tone),
    whyItIsHappening: formatWhyItIsHappeningSection(ctx, profile, patient),
    isItReversible: formatIsItReversibleSection(profile, patient),
    howTherapiesWork: formatHowTherapiesWorkSection(therapyPlan, patient),
    howKitsHelp: formatHowKitsHelpSection(kitNarratives),
    whatToExpect: formatWhatToExpectSection(prognosisNarrative, profile),
    realisticTimeline: formatRealisticTimelineSection(timeline),
    preventionAdvice: formatPreventionAdviceSection(profile, patient),
    reassuranceSection: formatReassuranceSection(profile, patient, tone),

    kitNarratives,
    prognosisNarrative,
    followupPlan,
    educationalInsights: allInsights,
    metadata,
  };
}

function buildGreeting(
  patientName: string,
  profile: ClinicalProfile,
  tone: ReturnType<typeof mapSeverityToTone>
): string {
  const openingStatement = getPatientOpeningStatement(profile.severity);
  return `Hi ${patientName}, ${openingStatement.charAt(0).toLowerCase() + openingStatement.slice(1)}`;
}
