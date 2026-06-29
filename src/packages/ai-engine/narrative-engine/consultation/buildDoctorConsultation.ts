import type { NarrativePipelineInput, AvatarDialogueSegment } from '../types';
import {
  formatAvatarSpeech,
  getAvatarIntroText,
  getAvatarOutroText,
} from '../formatters/formatAvatarSpeech';
import { mapKitToNarrativeBundle } from '../mappers/mapKitToNarrativeBundle';
import { buildPrognosisNarrative } from '../buildFinalNarrative';
import {
  DIAGNOSIS_LABELS,
  RECOVERY_WINDOWS,
  THERAPY_NEED_PATIENT_LABELS,
  PIPELINE_VERSION,
} from '../constants';
import { mapSeverityToTone } from '../mappers/mapSeverityToTone';
import { resolvePatientName, nowISO } from '../utils';
import {
  composeChapter1Narration,
  composeChapter2Narration,
  composeChapter3Narration,
  composeChapter4Narration,
  composeChapter5Narration,
  rootCauseLabelsFromProfile,
} from './chapterSpeech';
import {
  buildChapter1FollowUps,
  buildChapter2FollowUps,
  buildChapter3FollowUps,
  buildChapter4FollowUps,
  buildChapter5FollowUps,
} from './followUpPrompts';
import {
  CONSULTATION_SCRIPT_VERSION,
  type ConsultationChapter,
  type ConsultationGreeting,
  type ConsultationClosing,
  type DoctorConsultationScript,
  type ConsultationLanguage,
} from './types';

// ─── Builder ──────────────────────────────────────────────────────────────────
//
// Pure function — same inputs the legacy `build3DAvatarScript` consumes, plus
// an optional language. Produces the runtime-agnostic DoctorConsultationScript.
//
// Reuses every existing speech helper, kit/therapy mapper, and prognosis
// composer. Only adds: chapter regrouping (7 → 5), gesture categories, and
// per-chapter follow-up prompts.
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildDoctorConsultationOptions {
  readonly language?: ConsultationLanguage;
}

export function buildDoctorConsultation(
  input: NarrativePipelineInput,
  options: BuildDoctorConsultationOptions = {},
): DoctorConsultationScript {
  const language = options.language ?? 'en';
  const {
    patient,
    clinicalProfile: profile,
    therapyPlan,
    kitRecommendation,
    prognosis,
  } = input;

  const patientName = resolvePatientName(patient);
  const diagnosisLabel = DIAGNOSIS_LABELS[profile.primaryDiagnosis];
  const recoveryWindow = RECOVERY_WINDOWS[profile.primaryDiagnosis];
  const tone = mapSeverityToTone(profile.severity);
  const kitNarratives = mapKitToNarrativeBundle(kitRecommendation, profile, patient);
  const primaryKit = kitNarratives[0] ?? null;
  const prognosisNarrative = buildPrognosisNarrative(profile, therapyPlan, kitRecommendation, prognosis);
  const rootCauseLabels = rootCauseLabelsFromProfile(profile);
  const therapyLabels = therapyPlan.needs.map(n => THERAPY_NEED_PATIENT_LABELS[n]);

  // ── Greeting ───────────────────────────────────────────────────────────────
  const greetingSegment = formatAvatarSpeech(
    getAvatarIntroText(patientName, diagnosisLabel, profile.severity),
    tone.primaryTone === 'empathetic' ? 'empathetic' : 'warm',
    [patientName],
    800,
  );
  const greeting: ConsultationGreeting = {
    segment: greetingSegment,
    estimatedDurationSeconds: estimateDuration(greetingSegment.text),
  };

  // ── Chapters ───────────────────────────────────────────────────────────────
  const ch1: ConsultationChapter = buildChapter({
    id: 'what-is-happening',
    chapterNumber: 1,
    title: 'What is happening to your hair',
    headline: 'What is happening to my hair?',
    narration: composeChapter1Narration(patientName, diagnosisLabel, profile.severity),
    emotion: tone.primaryTone === 'empathetic' ? 'serious' : 'neutral',
    gestureCategory: 'explanation',
    visualCue: 'SHOW_HAIR_FOLLICLE_CROSS_SECTION',
    emphasizedWords: [diagnosisLabel, profile.severity.toLowerCase()],
    followUpPrompts: buildChapter1FollowUps(profile, diagnosisLabel),
  });

  const ch2: ConsultationChapter = buildChapter({
    id: 'why-is-this-happening',
    chapterNumber: 2,
    title: 'Why this is happening',
    headline: 'Why is this happening?',
    narration: composeChapter2Narration(rootCauseLabels, profile.flags.hasActiveShedding),
    emotion: 'empathetic',
    gestureCategory: 'explanation',
    visualCue: 'SHOW_FOLLICLE_MINIATURISATION_ANIMATION',
    emphasizedWords: rootCauseLabels.slice(0, 3),
    followUpPrompts: buildChapter2FollowUps(profile),
  });

  const ch3: ConsultationChapter = buildChapter({
    id: 'inside-your-body',
    chapterNumber: 3,
    title: 'What is happening inside your body',
    headline: 'What is happening inside my body?',
    narration: composeChapter3Narration(profile.rootCauses, profile),
    emotion: 'confident',
    gestureCategory: 'educational',
    visualCue: 'SHOW_HORMONAL_INFLAMMATION_PATHWAYS',
    emphasizedWords: ['follicle', 'cycle', 'reversible'],
    followUpPrompts: buildChapter3FollowUps(profile),
  });

  const ch4: ConsultationChapter = buildChapter({
    id: 'can-i-recover',
    chapterNumber: 4,
    title: 'Whether your hair can recover',
    headline: 'Can my hair recover?',
    narration: composeChapter4Narration(
      prognosisNarrative.recoveryExpectation.typicalCase,
      recoveryWindow,
      profile.severity,
    ),
    emotion: 'encouraging',
    gestureCategory: 'reassurance',
    visualCue: 'SHOW_RECOVERY_TIMELINE_ANIMATION',
    emphasizedWords: [recoveryWindow, 'consistent', 'improvement'],
    followUpPrompts: buildChapter4FollowUps(recoveryWindow),
  });

  const ch5: ConsultationChapter = buildChapter({
    id: 'what-to-do-next',
    chapterNumber: 5,
    title: 'What you should do next',
    headline: 'What should I do next?',
    narration: composeChapter5Narration({
      patientName,
      therapyLabels,
      primaryKitName: primaryKit?.displayName ?? null,
      primaryKitPurpose: primaryKit?.patientFriendlyPurpose ?? null,
      primaryKitTimeline: primaryKit?.expectedTimeline ?? null,
    }),
    emotion: 'confident',
    gestureCategory: 'summary',
    visualCue: 'SHOW_DAILY_ROUTINE_REMINDER',
    emphasizedWords: ['every single day', 'routine', 'protocol'],
    followUpPrompts: buildChapter5FollowUps(kitRecommendation),
  });

  // ── Closing ────────────────────────────────────────────────────────────────
  const closingSegment = formatAvatarSpeech(
    getAvatarOutroText(patientName, recoveryWindow, profile.severity),
    'encouraging',
    ['consistent', 'committed', 'possible'],
    1200,
  );
  const closing: ConsultationClosing = {
    segment: closingSegment,
    estimatedDurationSeconds: estimateDuration(closingSegment.text),
  };

  const chapters: DoctorConsultationScript['chapters'] = [ch1, ch2, ch3, ch4, ch5];
  const totalEstimatedDurationSeconds =
    greeting.estimatedDurationSeconds +
    chapters.reduce((sum, c) => sum + c.estimatedDurationSeconds, 0) +
    closing.estimatedDurationSeconds;

  return {
    title: `DrFACT AI Consultation — ${patientName}`,
    patientName,
    context: {
      diagnosisKey: profile.primaryDiagnosis,
      diagnosisLabel,
      severity: profile.severity,
      rootCauses: profile.rootCauses,
      recoveryWindow,
    },
    greeting,
    chapters,
    closing,
    totalEstimatedDurationSeconds,
    metadata: {
      version: CONSULTATION_SCRIPT_VERSION,
      generatedAt: nowISO(),
      language,
      pipelineVersion: PIPELINE_VERSION,
    },
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface BuildChapterArgs {
  readonly id: ConsultationChapter['id'];
  readonly chapterNumber: ConsultationChapter['chapterNumber'];
  readonly title: string;
  readonly headline: string;
  readonly narration: string;
  readonly emotion: ConsultationChapter['emotion'];
  readonly gestureCategory: ConsultationChapter['gestureCategory'];
  readonly visualCue: string;
  readonly emphasizedWords: readonly string[];
  readonly followUpPrompts: ConsultationChapter['followUpPrompts'];
}

function buildChapter(args: BuildChapterArgs): ConsultationChapter {
  const segments: readonly AvatarDialogueSegment[] = [
    formatAvatarSpeech(args.narration, args.emotion, args.emphasizedWords as string[]),
  ];
  return {
    id: args.id,
    chapterNumber: args.chapterNumber,
    title: args.title,
    headline: args.headline,
    narration: args.narration,
    segments,
    emotion: args.emotion,
    gestureCategory: args.gestureCategory,
    visualCue: args.visualCue,
    emphasizedWords: args.emphasizedWords,
    estimatedDurationSeconds: estimateDuration(args.narration),
    followUpPrompts: args.followUpPrompts,
  };
}

// Same WPM model the legacy avatar script uses (140 wpm measured clinical speech).
function estimateDuration(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(10, Math.round((wordCount / 140) * 60));
}
