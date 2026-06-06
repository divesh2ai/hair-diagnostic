import type { NarrativePipelineInput, AvatarScript, AvatarScene, AvatarDialogueSegment, KitNarrative } from './types';
import {
  formatAvatarSpeech,
  getAvatarIntroText,
  getAvatarOutroText,
  getUnderstandingProblemSpeech,
  getWhyFolliclesWeakenedSpeech,
  getWhatTriggeredSheddingSpeech,
  getHowTherapiesWorkSpeech,
  getHowKitsHelpSpeech,
  getRecoveryExpectationsSpeech,
  getComplianceSpeech,
} from './formatters/formatAvatarSpeech';
import { mapKitToNarrativeBundle } from './mappers/mapKitToNarrativeBundle';
import { buildPrognosisNarrative } from './buildFinalNarrative';
import { DIAGNOSIS_LABELS, ROOT_CAUSE_LABELS, RECOVERY_WINDOWS, THERAPY_NEED_PATIENT_LABELS } from './constants';
import { resolvePatientName, nowISO } from './utils';
import { mapSeverityToTone } from './mappers/mapSeverityToTone';

// ─── 3D Avatar Script Builder ─────────────────────────────────────────────────

export function build3DAvatarScript(input: NarrativePipelineInput): AvatarScript {
  const {
    patient,
    clinicalProfile: profile,
    therapyPlan,
    kitRecommendation,
    prognosis,
  } = input;

  const patientName = resolvePatientName(patient);
  const diagnosisLabel = DIAGNOSIS_LABELS[profile.primaryDiagnosis];
  const tone = mapSeverityToTone(profile.severity);
  const kitNarratives = mapKitToNarrativeBundle(kitRecommendation, profile, patient);
  const prognosisNarrative = buildPrognosisNarrative(profile, therapyPlan, kitRecommendation, prognosis);
  const recoveryWindow = RECOVERY_WINDOWS[profile.primaryDiagnosis];
  const rootCauseLabels = profile.rootCauses.map(rc => ROOT_CAUSE_LABELS[rc]);
  const therapyLabels = therapyPlan.needs.map(n => THERAPY_NEED_PATIENT_LABELS[n]);

  const primaryKit = kitNarratives[0];

  const intro: AvatarDialogueSegment = formatAvatarSpeech(
    getAvatarIntroText(patientName, diagnosisLabel, profile.severity),
    tone.primaryTone === 'empathetic' ? 'empathetic' : 'warm',
    [patientName],
    800
  );

  const scenes: AvatarScene[] = [
    buildUnderstandingProblemScene(patientName, diagnosisLabel, profile, tone),
    buildWhyFolliclesWeakenedScene(rootCauseLabels, profile),
    buildTriggersScene(rootCauseLabels, profile),
    buildTherapiesWorkScene(therapyLabels, profile),
    ...(primaryKit ? [buildKitSupportScene(primaryKit, recoveryWindow)] : []),
    buildRecoveryScene(prognosisNarrative, recoveryWindow, profile),
    buildComplianceScene(patientName, profile),
  ];

  const outro: AvatarDialogueSegment = formatAvatarSpeech(
    getAvatarOutroText(patientName, recoveryWindow, profile.severity),
    'encouraging',
    ['consistent', 'committed', 'possible'],
    1200
  );

  const totalDurationSeconds = intro.pauseAfterMs
    ? Math.round((intro.pauseAfterMs / 1000) + scenes.reduce((sum, s) => sum + s.durationSeconds, 0) + (outro.pauseAfterMs ?? 0) / 1000)
    : scenes.reduce((sum, s) => sum + s.durationSeconds, 0) + 30;

  return {
    title: `HairOS Report — ${patientName}`,
    patientName,
    totalDurationSeconds,
    intro,
    scenes,
    outro,
    generatedAt: nowISO(),
  };
}

// ─── Scene Builders ───────────────────────────────────────────────────────────

function buildUnderstandingProblemScene(
  patientName: string,
  diagnosisLabel: string,
  profile: import('../clinical-engine/types').ClinicalProfile,
  tone: ReturnType<typeof mapSeverityToTone>
): AvatarScene {
  const narration = getUnderstandingProblemSpeech(diagnosisLabel, profile.severity, patientName);

  return {
    sceneId: 'understanding-problem',
    title: 'Understanding Your Diagnosis',
    narration,
    segments: [
      formatAvatarSpeech(narration, tone.primaryTone === 'empathetic' ? 'serious' : 'neutral', [diagnosisLabel]),
    ],
    emotion: tone.primaryTone === 'empathetic' ? 'serious' : 'neutral',
    visualCue: 'SHOW_HAIR_FOLLICLE_CROSS_SECTION',
    durationSeconds: estimateDuration(narration),
    emphasizedWords: [diagnosisLabel, profile.severity.toLowerCase()],
  };
}

function buildWhyFolliclesWeakenedScene(
  rootCauseLabels: readonly string[],
  profile: import('../clinical-engine/types').ClinicalProfile
): AvatarScene {
  const narration = getWhyFolliclesWeakenedSpeech(rootCauseLabels);

  return {
    sceneId: 'why-follicles-weakened',
    title: 'Why Your Follicles Are Struggling',
    narration,
    segments: [
      formatAvatarSpeech(narration, 'empathetic', rootCauseLabels.slice(0, 2) as string[]),
    ],
    emotion: 'empathetic',
    visualCue: 'SHOW_FOLLICLE_MINIATURISATION_ANIMATION',
    durationSeconds: estimateDuration(narration),
    emphasizedWords: rootCauseLabels.slice(0, 3) as string[],
  };
}

function buildTriggersScene(
  rootCauseLabels: readonly string[],
  profile: import('../clinical-engine/types').ClinicalProfile
): AvatarScene {
  const narration = getWhatTriggeredSheddingSpeech(
    rootCauseLabels,
    profile.flags.hasActiveShedding
  );

  return {
    sceneId: 'what-triggered-shedding',
    title: 'What Triggered Your Hair Loss',
    narration,
    segments: [
      formatAvatarSpeech(narration, 'neutral'),
    ],
    emotion: 'neutral',
    visualCue: 'SHOW_HAIR_GROWTH_CYCLE_DISRUPTION',
    durationSeconds: estimateDuration(narration),
  };
}

function buildTherapiesWorkScene(
  therapyLabels: readonly string[],
  profile: import('../clinical-engine/types').ClinicalProfile
): AvatarScene {
  const narration = getHowTherapiesWorkSpeech(therapyLabels);

  return {
    sceneId: 'how-therapies-work',
    title: 'How Your Therapies Work',
    narration,
    segments: [
      formatAvatarSpeech(narration, 'confident', therapyLabels.slice(0, 2) as string[]),
    ],
    emotion: 'confident',
    visualCue: 'SHOW_THERAPY_MECHANISM_DIAGRAM',
    durationSeconds: estimateDuration(narration),
    emphasizedWords: ['simultaneously', 'personalised', 'targeted'],
  };
}

function buildKitSupportScene(
  primaryKit: KitNarrative,
  recoveryWindow: string
): AvatarScene {
  const narration = getHowKitsHelpSpeech(
    primaryKit.displayName,
    primaryKit.patientFriendlyPurpose,
    primaryKit.expectedTimeline
  );

  return {
    sceneId: 'how-kits-support',
    title: `Your Kit: ${primaryKit.displayName}`,
    narration,
    segments: [
      formatAvatarSpeech(narration, 'warm', [primaryKit.displayName]),
    ],
    emotion: 'warm',
    visualCue: `SHOW_KIT_PRODUCT_${primaryKit.kitId}`,
    durationSeconds: estimateDuration(narration),
    emphasizedWords: [primaryKit.displayName, 'consistent'],
  };
}

function buildRecoveryScene(
  prognosisNarrative: ReturnType<typeof buildPrognosisNarrative>,
  recoveryWindow: string,
  profile: import('../clinical-engine/types').ClinicalProfile
): AvatarScene {
  const narration = getRecoveryExpectationsSpeech(
    prognosisNarrative.recoveryExpectation.typicalCase,
    recoveryWindow,
    profile.severity
  );

  return {
    sceneId: 'recovery-expectations',
    title: 'What to Expect on Your Journey',
    narration,
    segments: [
      formatAvatarSpeech(narration, 'encouraging', [recoveryWindow]),
    ],
    emotion: 'encouraging',
    visualCue: 'SHOW_RECOVERY_TIMELINE_ANIMATION',
    durationSeconds: estimateDuration(narration),
    emphasizedWords: [recoveryWindow, 'consistent', 'improvement'],
  };
}

function buildComplianceScene(
  patientName: string,
  profile: import('../clinical-engine/types').ClinicalProfile
): AvatarScene {
  const narration = getComplianceSpeech(patientName);

  return {
    sceneId: 'compliance-motivation',
    title: 'The Key to Your Results',
    narration,
    segments: [
      formatAvatarSpeech(narration, 'serious', ['every single day', 'consistency', 'commitment'], 500),
    ],
    emotion: 'serious',
    visualCue: 'SHOW_DAILY_ROUTINE_REMINDER',
    durationSeconds: estimateDuration(narration),
    emphasizedWords: ['every single day', 'routine', 'protocol'],
  };
}

// ─── Duration Estimation ──────────────────────────────────────────────────────

function estimateDuration(text: string): number {
  // Average English speech: ~130–150 words per minute for measured clinical speech
  const wordCount = text.split(/\s+/).length;
  return Math.max(10, Math.round((wordCount / 140) * 60));
}
