import type {
  AvatarProvider,
  AvatarSessionEvent,
  AvatarSessionListener,
  ConsultationSession,
  ConsultationSessionState,
  OpenSessionInput,
} from '../types';
import type {
  ConsultationChapterId,
  FollowUpPrompt,
} from '../../ai-engine/narrative-engine/consultation/types';

// ─── Null provider ────────────────────────────────────────────────────────────
//
// Text-only fallback. Always available. Drives a consultation session purely
// from the script's narration text — no audio, no video, no live stream.
// Used as the default runtime when no real provider is configured, and as a
// graceful degradation path when a richer provider fails.
//
// Implementation note: this provider intentionally lives in avatar-engine
// (not video-engine). It proves the runtime contract is genuinely decoupled
// from any video pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export const nullAvatarProvider: AvatarProvider = {
  info: {
    name: 'null',
    tier: 'REALTIME',
    supportsFollowUpQA: false,
    supportsChapterNavigation: true,
  },

  async openSession(input: OpenSessionInput): Promise<ConsultationSession> {
    return new NullConsultationSession(input);
  },
};

class NullConsultationSession implements ConsultationSession {
  readonly sessionId: string;
  private state: ConsultationSessionState;
  private listeners = new Set<AvatarSessionListener>();
  private chaptersById: Map<ConsultationChapterId, number>;

  constructor(private readonly input: OpenSessionInput) {
    this.sessionId = `null-${input.assessmentId}-${Date.now()}`;
    this.state = {
      sessionId: this.sessionId,
      status: 'READY',
      currentChapterId: null,
      elapsedSeconds: 0,
      error: null,
    };
    this.chaptersById = new Map(
      input.script.chapters.map((c, i) => [c.id, i]),
    );
  }

  getState(): ConsultationSessionState {
    return this.state;
  }

  async play(chapterId?: ConsultationChapterId): Promise<void> {
    const targetId = chapterId ?? this.input.script.chapters[0].id;
    this.transition({ status: 'PLAYING', currentChapterId: targetId });
    this.emit({ type: 'CHAPTER_STARTED', state: this.state });
  }

  async pause(): Promise<void> {
    this.transition({ status: 'PAUSED' });
  }

  async seekToChapter(chapterId: ConsultationChapterId): Promise<void> {
    if (!this.chaptersById.has(chapterId)) {
      throw new Error(`Unknown chapter: ${chapterId}`);
    }
    this.transition({ currentChapterId: chapterId });
  }

  async askFollowUp(
    _prompt: FollowUpPrompt | { freeformText: string },
  ): Promise<string> {
    // Null provider does not generate answers — caller should fall back to
    // showing the prompt's hint or the chapter narration.
    return 'Follow-up answers are not available in this consultation mode.';
  }

  subscribe(listener: AvatarSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async close(): Promise<void> {
    this.transition({ status: 'COMPLETED' });
    this.listeners.clear();
  }

  private transition(patch: Partial<ConsultationSessionState>): void {
    this.state = { ...this.state, ...patch };
    this.emit({ type: 'STATUS_CHANGED', state: this.state });
  }

  private emit(event: AvatarSessionEvent): void {
    for (const l of this.listeners) l(event);
  }
}
