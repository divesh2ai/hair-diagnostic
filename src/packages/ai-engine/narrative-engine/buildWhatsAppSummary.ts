import type { NarrativePipelineInput, WhatsAppSummary } from './types';
import { DIAGNOSIS_LABELS, RECOVERY_WINDOWS, THERAPY_NEED_PATIENT_LABELS } from './constants';
import { resolvePatientName, truncate, nowISO } from './utils';
import { mapKitToNarrativeBundle } from './mappers/mapKitToNarrativeBundle';
import { mapSeverityToTone } from './mappers/mapSeverityToTone';

const MAX_CHARS = 1200;

// ─── WhatsApp Summary Builder ─────────────────────────────────────────────────

export function buildWhatsAppSummary(input: NarrativePipelineInput): WhatsAppSummary {
  const {
    patient,
    clinicalProfile: profile,
    therapyPlan,
    kitRecommendation,
  } = input;

  const patientName = resolvePatientName(patient);
  const diagnosisLabel = DIAGNOSIS_LABELS[profile.primaryDiagnosis];
  const recoveryWindow = RECOVERY_WINDOWS[profile.primaryDiagnosis];
  const tone = mapSeverityToTone(profile.severity);
  const kitNarratives = mapKitToNarrativeBundle(kitRecommendation, profile, patient);
  const primaryKit = kitNarratives[0];
  const topTherapy = therapyPlan.needs.length > 0
    ? THERAPY_NEED_PATIENT_LABELS[therapyPlan.needs[0]]
    : 'supporting your hair health';

  const topKitName = primaryKit?.displayName ?? 'your recommended kit';
  const timelineHighlight = getTimelineHighlight(recoveryWindow, profile.severity);
  const reassurance = getReassuranceMessage(profile.severity, diagnosisLabel);
  const ctaText = buildCTA(profile.severity);
  const message = buildMessage(
    patientName,
    diagnosisLabel,
    reassurance,
    topTherapy,
    topKitName,
    timelineHighlight,
    ctaText,
    profile
  );

  return {
    message,
    characterCount: message.length,
    patientName,
    diagnosis: diagnosisLabel,
    topTherapy,
    topKit: topKitName,
    timelineHighlight,
    ctaText,
    generatedAt: nowISO(),
  };
}

// ─── Message Builder ──────────────────────────────────────────────────────────

function buildMessage(
  patientName: string,
  diagnosis: string,
  reassurance: string,
  topTherapy: string,
  topKit: string,
  timeline: string,
  cta: string,
  profile: import('../clinical-engine/types').ClinicalProfile
): string {
  const severityIcon = profile.severity === 'SEVERE' ? '⚠️' : profile.severity === 'MODERATE' ? '📋' : '✅';

  const lines = [
    `Hi ${patientName} 👋`,
    '',
    `Your HairOS report is ready. Here's your summary:`,
    '',
    `${severityIcon} *Diagnosis:* ${diagnosis}`,
    `🎯 *Primary Focus:* ${topTherapy.charAt(0).toUpperCase() + topTherapy.slice(1)}`,
    `💊 *Your Kit:* ${topKit}`,
    `📅 *Expected Timeline:* ${timeline}`,
    '',
    reassurance,
    '',
    `📞 ${cta}`,
    '',
    '_Your full personalised report has been sent to your clinic. Please review it with your care team at your next visit._',
  ];

  const full = lines.join('\n');
  if (full.length <= MAX_CHARS) return full;

  // Trim reassurance if too long
  const trimmedReassurance = truncate(reassurance, 150);
  const trimmedLines = [
    `Hi ${patientName} 👋`,
    '',
    `*Diagnosis:* ${diagnosis}`,
    `*Primary Focus:* ${topTherapy.charAt(0).toUpperCase() + topTherapy.slice(1)}`,
    `*Your Kit:* ${topKit}`,
    `*Timeline:* ${timeline}`,
    '',
    trimmedReassurance,
    '',
    cta,
  ];

  return truncate(trimmedLines.join('\n'), MAX_CHARS);
}

// ─── Reassurance by Severity ──────────────────────────────────────────────────

function getReassuranceMessage(
  severity: import('../../../types').Severity,
  diagnosisLabel: string
): string {
  const map: Record<typeof severity, string> = {
    MILD: `Your hair loss is at an early stage — and that's great news. With consistent use of your protocol, most patients at this stage see meaningful improvement within a few months. You've caught this early. 🌱`,
    MODERATE: `Your protocol has been personalised to every signal in your assessment. Patients at your stage who follow their protocol consistently see real, measurable results. Consistency is your most powerful tool. 💪`,
    SEVERE: `We know this has been difficult. Your protocol is comprehensive and has been built specifically for your level of presentation. Progress takes time, but it's achievable — and you're in the right place. 🤝`,
  };
  return map[severity];
}

// ─── Timeline Highlight ───────────────────────────────────────────────────────

function getTimelineHighlight(
  recoveryWindow: string,
  severity: import('../../../types').Severity
): string {
  // Extract just the key first timeframe
  const shortened = recoveryWindow.split(';')[0].trim();
  if (shortened.length > 60) return shortened.slice(0, 57) + '...';
  return shortened;
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function buildCTA(severity: import('../../../types').Severity): string {
  if (severity === 'SEVERE') {
    return 'Your care team will be in touch to schedule your follow-up consultation. Please don\'t hesitate to reach out.';
  }
  if (severity === 'MODERATE') {
    return 'Your 3-month follow-up has been noted. Contact your clinic with any questions in the meantime.';
  }
  return 'Your 6-month follow-up will track your progress. Reach out anytime if you have questions.';
}
