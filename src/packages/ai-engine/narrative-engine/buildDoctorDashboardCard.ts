import type { NarrativePipelineInput, DoctorDashboardCard, FollowupPriority } from './types';
import {
  DIAGNOSIS_LABELS,
  ROOT_CAUSE_LABELS,
  THERAPY_NEED_LABELS,
  FOLLOWUP_PRIORITY_BY_SEVERITY,
  HIGH_ATTENTION_DIAGNOSES,
  RECOVERY_WINDOWS,
} from './constants';
import { resolvePatientName, confidenceLevel, nowISO } from './utils';

// ─── Doctor Dashboard Card Builder ───────────────────────────────────────────

export function buildDoctorDashboardCard(input: NarrativePipelineInput): DoctorDashboardCard {
  const {
    patient,
    clinicalProfile: profile,
    therapyPlan,
    kitRecommendation,
  } = input;

  const patientName = resolvePatientName(patient);
  const primaryCondition = DIAGNOSIS_LABELS[profile.primaryDiagnosis];
  const recoveryWindow = RECOVERY_WINDOWS[profile.primaryDiagnosis];
  const primaryKit = kitRecommendation.rankedKits[0];

  const confLevel = confidenceLevel(profile.primaryScore);
  const basePriority = FOLLOWUP_PRIORITY_BY_SEVERITY[profile.severity];
  const { priority, doctorAttentionNeeded, attentionReasons } = resolveFollowupPriority(
    profile,
    patient,
    basePriority
  );

  const contraindications = resolveContraindications(patient, profile);
  const riskFlags = resolveRiskFlags(profile, patient);

  return {
    patientRef: patientName,
    patientName,
    primaryCondition,
    severity: profile.severity,
    diagnosisKey: profile.primaryDiagnosis,
    confidence: Math.min(100, Math.round(profile.primaryScore)),
    confidenceLevel: confLevel,
    primaryKit: primaryKit ? formatKitName(primaryKit.kitId) : 'Not assigned',
    kitPhaseCount: kitRecommendation.rankedKits.length,
    recoveryWindow,
    riskFlags,
    rootCauses: profile.rootCauses.map(rc => ROOT_CAUSE_LABELS[rc]),
    therapyNeeds: therapyPlan.needs.map(n => THERAPY_NEED_LABELS[n]),
    followupPriority: priority,
    doctorAttentionNeeded,
    attentionReasons,
    contraindications,
    generatedAt: nowISO(),
  };
}

// ─── Priority Resolution ──────────────────────────────────────────────────────

function resolveFollowupPriority(
  profile: import('../clinical-engine/types').ClinicalProfile,
  patient: import('../../types').PatientAnswers,
  basePriority: FollowupPriority
): { priority: FollowupPriority; doctorAttentionNeeded: boolean; attentionReasons: readonly string[] } {
  const reasons: string[] = [];
  let priority = basePriority;
  let doctorAttentionNeeded = false;

  if (HIGH_ATTENTION_DIAGNOSES.has(profile.primaryDiagnosis)) {
    priority = 'elevated';
    doctorAttentionNeeded = true;
    reasons.push(`High-attention diagnosis: ${DIAGNOSIS_LABELS[profile.primaryDiagnosis]}`);
  }

  if (patient.is_pregnant) {
    priority = 'urgent';
    doctorAttentionNeeded = true;
    reasons.push('Patient is pregnant — contraindication review required before protocol initiation');
  }

  if (patient.planning_pregnancy) {
    priority = priority === 'urgent' ? 'urgent' : 'elevated';
    doctorAttentionNeeded = true;
    reasons.push('Planning pregnancy — finasteride/dutasteride must be avoided and flagged');
  }

  if (patient.hasHypertension) {
    doctorAttentionNeeded = true;
    reasons.push('Hypertension — oral minoxidil requires BP monitoring protocol');
  }

  if (profile.severity === 'SEVERE' && profile.flags.isGrade45) {
    doctorAttentionNeeded = true;
    reasons.push('Grade 4–5 severity — specialist referral consideration recommended');
  }

  if (profile.secondaryDiagnoses.length > 0 && profile.secondaryDiagnoses[0].score > 70) {
    reasons.push(`High differential confidence: ${DIAGNOSIS_LABELS[profile.secondaryDiagnoses[0].key]} (score: ${profile.secondaryDiagnoses[0].score}) — confirm diagnosis`);
  }

  if (profile.rootCauses.includes('AUTOIMMUNE')) {
    doctorAttentionNeeded = true;
    reasons.push('Autoimmune component — dermatology/immunology co-management may be indicated');
  }

  return { priority, doctorAttentionNeeded, attentionReasons: reasons };
}

// ─── Risk Flags ───────────────────────────────────────────────────────────────

function resolveRiskFlags(
  profile: import('../clinical-engine/types').ClinicalProfile,
  patient: import('../../types').PatientAnswers
): readonly string[] {
  const flags: string[] = [];

  if (profile.flags.isGrade45) flags.push('Advanced follicular miniaturisation (Grade 4–5)');
  if (profile.flags.hasActiveShedding) flags.push('Active shedding pattern at time of assessment');
  if (profile.rootCauses.includes('GENETICS')) flags.push('Genetic predisposition — long-term management required');
  if (profile.rootCauses.length > 4) flags.push(`Complex multi-factorial aetiology (${profile.rootCauses.length} root causes)`);
  if (profile.primaryScore < 60) flags.push('Moderate diagnostic confidence — consider additional workup');
  if (profile.secondaryDiagnoses.length > 0 && profile.secondaryDiagnoses[0].score > 65) {
    flags.push('Significant differential diagnosis — confirm with clinical exam');
  }

  return flags;
}

// ─── Contraindication Summary ─────────────────────────────────────────────────

function resolveContraindications(
  patient: import('../../types').PatientAnswers,
  profile: import('../clinical-engine/types').ClinicalProfile
): readonly string[] {
  const contra: string[] = [];

  if (patient.is_pregnant) contra.push('Pregnancy: multiple agents contraindicated');
  if (patient.planning_pregnancy) contra.push('Planning pregnancy: 5α-reductase inhibitors contraindicated');
  if (patient.hasHypertension) contra.push('Hypertension: oral minoxidil requires monitoring');
  if (profile.primaryDiagnosis === 'ALOPECIA_AREATA') contra.push('AA: systemic immunosuppressant caution');

  return contra;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKitName(kitId: string): string {
  return kitId
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/Aga/g, 'AGA')
    .replace(/Pcos/g, 'PCOS');
}
