import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';
import type { KitRecommendation } from '../kit-scorer/types';
import type { NarrativeResult } from '../explanations/types';
import type { ComposedNarrative } from '../explanations/composers/types';
import type { PatientAnswers } from '../../types';
import type { DoctorReport, NarrativePipelineInput, NarrativeMetadata } from './types';
import { mapClinicalToNarrative } from './mappers/mapClinicalToNarrative';
import { mapKitToNarrativeBundle } from './mappers/mapKitToNarrativeBundle';
import { mapTherapyToTimeline, mapTherapyToClinicianTimeline } from './mappers/mapTherapyToTimeline';
import {
  formatClinicalSummarySection,
  formatPrimaryDiagnosisSection,
  formatDifferentialDiagnosesSection,
  formatSeverityAssessmentSection,
  formatRootCauseAnalysisSection,
  formatSignalInterpretationSection,
  formatTherapyLogicSection,
  formatKitRationaleSection,
  formatIngredientMechanismsSection,
  formatPrognosisSection,
  formatRiskFactorsSection,
  formatContraindicationsSection,
  formatFollowUpSection,
  formatRecoveryTimelineSection,
} from './formatters/formatDoctorSections';
import { buildPrognosisNarrative, buildTherapyExplanations, buildFollowupPlan } from './buildFinalNarrative';
import { resolvePatientName, nowISO, buildMetadata } from './utils';

// ─── Doctor Report Builder ────────────────────────────────────────────────────

export function buildDoctorReport(input: NarrativePipelineInput): DoctorReport {
  const {
    patient,
    clinicalProfile: profile,
    therapyPlan,
    kitRecommendation,
    explanationResult,
    prognosis,
    doctorNotes,
    narrativeLength = 'medium',
  } = input;

  const patientRef = resolvePatientName(patient);
  const ctx = mapClinicalToNarrative(profile, patient);
  const kitNarratives = mapKitToNarrativeBundle(kitRecommendation, profile, patient);
  const therapyExplanations = buildTherapyExplanations(therapyPlan, profile);
  const prognosisNarrative = buildPrognosisNarrative(profile, therapyPlan, kitRecommendation, prognosis);
  const followupPlan = buildFollowupPlan(profile);
  const clinicianTimeline = mapTherapyToClinicianTimeline(therapyPlan, profile);

  const metadata: NarrativeMetadata = {
    ...buildMetadata(profile, kitRecommendation.rankedKits.length, narrativeLength),
    therapyNeedCount: therapyPlan.needs.length,
  };

  return {
    generatedAt: nowISO(),
    patientRef,

    clinicalSummary: formatClinicalSummarySection(ctx, profile, therapyPlan, kitRecommendation),
    primaryDiagnosis: formatPrimaryDiagnosisSection(ctx, profile),
    differentialDiagnoses: formatDifferentialDiagnosesSection(ctx, profile),
    severityAssessment: formatSeverityAssessmentSection(profile, ctx),
    rootCauseAnalysis: formatRootCauseAnalysisSection(ctx, profile),
    signalInterpretation: formatSignalInterpretationSection(profile, ctx),
    therapyLogic: formatTherapyLogicSection(therapyPlan, profile),
    kitRationale: formatKitRationaleSection(kitRecommendation, kitNarratives),
    ingredientMechanisms: formatIngredientMechanismsSection(kitNarratives),
    prognosis: formatPrognosisSection(prognosisNarrative, profile),
    riskFactors: formatRiskFactorsSection(profile, ctx),
    contraindications: formatContraindicationsSection(profile, patient),
    followUpRecommendations: formatFollowUpSection(profile),
    expectedRecoveryTimeline: formatRecoveryTimelineSection(clinicianTimeline),

    confidenceExplanation: ctx.confidenceExplanation,
    kitNarratives,
    therapyExplanations,
    prognosisNarrative,
    followupPlan,

    doctorNotes: doctorNotes ?? [],
    metadata,
  };
}
