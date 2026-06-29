import type { AvatarScript } from "../ai-engine/narrative-engine/types";
import { getVideoProvider } from "./providers";
import type { VideoArtifactContent, VideoProviderName } from "./types";

export interface RenderAvatarVideoInput {
  assessmentId: string;
  script: AvatarScript;
  providerName?: VideoProviderName;
}

/**
 * Kicks off a video render. Does NOT block until the video is ready —
 * returns the initial RENDERING artifact content so the orchestrator can
 * persist it immediately and continue to the next stage (visual/pdf).
 *
 * A separate poller (pollVideoUntilReady) advances the artifact to READY/FAILED.
 */
export async function startAvatarVideoRender(
  input: RenderAvatarVideoInput
): Promise<VideoArtifactContent> {
  const provider = getVideoProvider(input.providerName);
  const now = new Date().toISOString();

  try {
    const { providerJobId } = await provider.startRender({
      script: input.script,
      assessmentId: input.assessmentId,
    });
    return {
      status: "RENDERING",
      provider: provider.name,
      providerJobId,
      videoUrl: null,
      thumbnailUrl: null,
      durationSec: null,
      renderStartedAt: now,
      renderCompletedAt: null,
      error: null,
    };
  } catch (err) {
    return {
      status: "FAILED",
      provider: provider.name,
      providerJobId: null,
      videoUrl: null,
      thumbnailUrl: null,
      durationSec: null,
      renderStartedAt: now,
      renderCompletedAt: now,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Polls the provider for a single artifact and returns the updated content.
 * Caller decides when to write it back to the DB.
 */
export async function probeVideoStatus(
  current: VideoArtifactContent
): Promise<VideoArtifactContent> {
  if (current.status === "READY" || current.status === "FAILED") return current;
  if (!current.providerJobId) return current;

  const provider = getVideoProvider(current.provider);
  const result = await provider.getStatus(current.providerJobId);

  if (result.status === "READY") {
    return {
      ...current,
      status: "READY",
      videoUrl: result.videoUrl ?? null,
      thumbnailUrl: result.thumbnailUrl ?? null,
      durationSec: result.durationSec ?? null,
      renderCompletedAt: new Date().toISOString(),
      error: null,
    };
  }

  if (result.status === "FAILED") {
    return {
      ...current,
      status: "FAILED",
      renderCompletedAt: new Date().toISOString(),
      error: result.error ?? "Render failed",
    };
  }

  return current;
}
