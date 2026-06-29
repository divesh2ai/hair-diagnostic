import type { AvatarDialogueSegment, AvatarEmotion } from '../types';
import type { Severity, DiagnosisKey, RootCause } from '../../../types';

// ─── Doctor Consultation Script — content model ───────────────────────────────
//
// The DoctorConsultationScript is the *primary* clinical content artifact for
// the DrFACT AI consultation experience. It is intentionally runtime-agnostic:
// the same script can be driven by a prerendered video provider, a real-time
// avatar runtime, or a text-only fallback (see avatar-engine package).
//
// Five fixed chapters mirror the patient's mental model of the visit:
//   1. WHAT  — what is happening to my hair
//   2. WHY   — why is this happening
//   3. INSIDE — what is happening inside my body (biology)
//   4. RECOVER — can my hair recover
//   5. NEXT   — what should I do next
//
// Chapters are typed as a discriminated union (not a free-form scene array) so
// the consumer can rely on each chapter existing and being addressable by id.
// ─────────────────────────────────────────────────────────────────────────────

export const CONSULTATION_SCRIPT_VERSION = '1.0' as const;

export type ConsultationChapterId =
  | 'what-is-happening'
  | 'why-is-this-happening'
  | 'inside-your-body'
  | 'can-i-recover'
  | 'what-to-do-next';

export const CONSULTATION_CHAPTER_ORDER: readonly ConsultationChapterId[] = [
  'what-is-happening',
  'why-is-this-happening',
  'inside-your-body',
  'can-i-recover',
  'what-to-do-next',
] as const;

/** Spec-defined gesture vocabulary the avatar layer can map to provider primitives. */
export type GestureCategory = 'explanation' | 'reassurance' | 'educational' | 'summary';

/** Optional language code (ISO-639-1). English-only at v1; reserved for i18n. */
export type ConsultationLanguage =
  | 'en' | 'hi' | 'mr' | 'gu' | 'bn' | 'ta' | 'te' | 'kn' | 'ml';

/**
 * A patient question the doctor anticipates after a given chapter.
 * The avatar runtime can surface these as tap-to-ask chips; if the runtime
 * supports live dialogue, the `id` is what gets sent back to the script
 * engine to generate an answer.
 */
export interface FollowUpPrompt {
  readonly id: string;
  readonly chapterId: ConsultationChapterId;
  /** Patient-voice question, e.g. "How long until I see new growth?" */
  readonly question: string;
  /** One-line hint shown beside the chip; optional. */
  readonly hint?: string;
}

/**
 * One consultation chapter. Holds the doctor's narration plus the metadata an
 * avatar runtime needs to drive the moment (gesture, emotion, visual cue).
 * Does NOT hold any provider-specific fields (no avatar_id, voice_id, etc).
 */
export interface ConsultationChapter {
  readonly id: ConsultationChapterId;
  readonly chapterNumber: 1 | 2 | 3 | 4 | 5;
  /** Patient-facing chapter title shown in the chapter rail. */
  readonly title: string;
  /** The patient question this chapter answers (the spec's chapter headline). */
  readonly headline: string;
  /** Full narration as one string — what the doctor says, naturalised. */
  readonly narration: string;
  /** Segmented narration with per-segment emotion + emphasis for delivery. */
  readonly segments: readonly AvatarDialogueSegment[];
  readonly emotion: AvatarEmotion;
  readonly gestureCategory: GestureCategory;
  /** Display-side cue, e.g. "SHOW_FOLLICLE_CROSS_SECTION". Provider-agnostic. */
  readonly visualCue: string;
  readonly emphasizedWords?: readonly string[];
  /** WPM-based estimate; the real-time runtime may ignore and use audio length. */
  readonly estimatedDurationSeconds: number;
  /** Suggested follow-ups the patient might ask after this chapter. */
  readonly followUpPrompts: readonly FollowUpPrompt[];
}

/**
 * Greeting and closing are dialogue segments rather than chapters because they
 * are short, don't have a chapter-rail entry, and have no follow-up prompts.
 */
export interface ConsultationGreeting {
  readonly segment: AvatarDialogueSegment;
  readonly estimatedDurationSeconds: number;
}

export interface ConsultationClosing {
  readonly segment: AvatarDialogueSegment;
  readonly estimatedDurationSeconds: number;
}

/** Lightweight clinical context the runtime / UI may need without re-deriving. */
export interface ConsultationContext {
  readonly diagnosisKey: DiagnosisKey;
  readonly diagnosisLabel: string;
  readonly severity: Severity;
  readonly rootCauses: readonly RootCause[];
  readonly recoveryWindow: string;
}

export interface ConsultationMetadata {
  readonly version: typeof CONSULTATION_SCRIPT_VERSION;
  readonly generatedAt: string;
  readonly language: ConsultationLanguage;
  /** Pipeline that produced this script (for audit). */
  readonly pipelineVersion: string;
}

/**
 * The primary content artifact. Self-contained — a renderer or runtime should
 * never need to re-query the clinical engine to drive playback.
 */
export interface DoctorConsultationScript {
  readonly title: string;
  readonly patientName: string;
  readonly context: ConsultationContext;
  readonly greeting: ConsultationGreeting;
  /** Always exactly 5 chapters in CONSULTATION_CHAPTER_ORDER. */
  readonly chapters: readonly [
    ConsultationChapter,
    ConsultationChapter,
    ConsultationChapter,
    ConsultationChapter,
    ConsultationChapter,
  ];
  readonly closing: ConsultationClosing;
  readonly totalEstimatedDurationSeconds: number;
  readonly metadata: ConsultationMetadata;
}
