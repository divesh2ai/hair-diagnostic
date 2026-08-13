import type { SourceRef } from "./types";

export type GeneralConversationContext = {
  activeProductFamily?: string;
  activeVariant?: string;
  activeIngredient?: string;
  activeCondition?: string;
  activeLifestyleFactor?: string;
  previousSources: SourceRef[];
  updatedAt: number;
};

const EMPTY_CONTEXT = (): GeneralConversationContext => ({ previousSources: [], updatedAt: Date.now() });

export class GeneralConversationStore {
  private readonly contexts = new Map<string, GeneralConversationContext>();

  constructor(private readonly ttlMs = 30 * 60_000) {}

  get(conversationId: string): GeneralConversationContext {
    const context = this.contexts.get(conversationId);
    if (!context || Date.now() - context.updatedAt > this.ttlMs) {
      this.contexts.delete(conversationId);
      return EMPTY_CONTEXT();
    }
    return { ...context, previousSources: [...context.previousSources] };
  }

  set(conversationId: string, context: GeneralConversationContext): void {
    this.contexts.set(conversationId, { ...context, previousSources: [...context.previousSources], updatedAt: Date.now() });
    if (this.contexts.size > 2_000) this.prune();
  }

  private prune(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [id, context] of this.contexts) if (context.updatedAt < cutoff) this.contexts.delete(id);
  }
}
