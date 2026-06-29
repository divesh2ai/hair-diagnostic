import type {
  DoctorConsultationScript,
  ConsultationChapterId,
  FollowUpPrompt,
} from '../ai-engine/narrative-engine/consultation/types';

// ─── Avatar Engine — runtime contract ─────────────────────────────────────────
//
// The avatar engine is the layer that *drives* the DrFACT AI doctor for a
// patient. It is intentionally agnostic to the underlying technology: it can
// be backed by a prerendered video pipeline (today's HeyGen), a real-time
// streaming avatar (HeyGen Interactive, Soul Machines, custom WebGL), or a
// text-only fallback for low-bandwidth contexts.
//
// Two capability tiers:
//
//   • PrerenderedAvatarProvider — produces a finished video/audio artifact
//     ahead of patient view. Cheap, deterministic, no follow-up Q&A.
//
//   • RealtimeAvatarProvider   — opens a live session. The patient can
//     navigate chapters, replay, and ask follow-up questions; the doctor
//     responds in-stream. The consultation experience.
//
// Both providers consume the same DoctorConsultationScript. A consumer
// (patient portal) selects a runtime per request via getAvatarRuntime().
// ─────────────────────────────────────────────────────────────────────────────

export type AvatarProviderName =
  | 'null'           // text-only no-op (always available)
  | 'prerendered'    // legacy video-render path (delegates to video-engine)
  | 'heygen-realtime' // future
  | 'soulmachines'    // future
  | 'custom-webgl';   // future

export type AvatarCapabilityTier = 'PRERENDERED' | 'REALTIME';

export interface AvatarProviderInfo {
  readonly name: AvatarProviderName;
  readonly tier: AvatarCapabilityTier;
  /** True if the provider can answer ad-hoc follow-up questions in-session. */
  readonly supportsFollowUpQA: boolean;
  /** True if the provider exposes per-chapter playback controls. */
  readonly supportsChapterNavigation: boolean;
}

// ─── Session lifecycle ───────────────────────────────────────────────────────

export type ConsultationSessionStatus =
  | 'INITIALISING'
  | 'READY'
  | 'PLAYING'
  | 'PAUSED'
  | 'AWAITING_FOLLOWUP'
  | 'COMPLETED'
  | 'FAILED';

export interface ConsultationSessionState {
  readonly sessionId: string;
  readonly status: ConsultationSessionStatus;
  readonly currentChapterId: ConsultationChapterId | null;
  readonly elapsedSeconds: number;
  readonly error: string | null;
}

export interface OpenSessionInput {
  readonly assessmentId: string;
  readonly script: DoctorConsultationScript;
}

export interface AvatarSessionEvent {
  readonly type:
    | 'STATUS_CHANGED'
    | 'CHAPTER_STARTED'
    | 'CHAPTER_COMPLETED'
    | 'FOLLOWUP_ANSWERED'
    | 'ERROR';
  readonly state: ConsultationSessionState;
  /** For FOLLOWUP_ANSWERED, the text the doctor delivered. */
  readonly answerText?: string;
}

export type AvatarSessionListener = (event: AvatarSessionEvent) => void;

/**
 * Live handle on an open consultation session. Returned by realtime providers
 * and by prerendered providers wrapped in a minimal player shim.
 */
export interface ConsultationSession {
  readonly sessionId: string;
  getState(): ConsultationSessionState;
  /** Begin playback from the given chapter (defaults to chapter 1). */
  play(chapterId?: ConsultationChapterId): Promise<void>;
  pause(): Promise<void>;
  /** Jump to a specific chapter without playing. */
  seekToChapter(chapterId: ConsultationChapterId): Promise<void>;
  /**
   * Ask a follow-up question. Realtime providers stream the answer back via
   * the event listener; prerendered providers return the canned written
   * answer text (no avatar performance).
   */
  askFollowUp(prompt: FollowUpPrompt | { freeformText: string }): Promise<string>;
  /** Subscribe to lifecycle events. Returns an unsubscribe fn. */
  subscribe(listener: AvatarSessionListener): () => void;
  close(): Promise<void>;
}

// ─── Provider contract ───────────────────────────────────────────────────────

export interface AvatarProvider {
  readonly info: AvatarProviderInfo;
  openSession(input: OpenSessionInput): Promise<ConsultationSession>;
}
