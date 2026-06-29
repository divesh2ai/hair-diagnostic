import type { AvatarScript } from "../ai-engine/narrative-engine/types";

export type VideoStatus = "PENDING" | "RENDERING" | "READY" | "FAILED";

export type VideoProviderName = "stub" | "heygen" | "did" | "synthesia" | "akool";

export interface VideoArtifactContent {
  status: VideoStatus;
  provider: VideoProviderName;
  providerJobId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  renderStartedAt: string;
  renderCompletedAt: string | null;
  error: string | null;
}

export interface StartRenderInput {
  script: AvatarScript;
  assessmentId: string;
}

export interface StartRenderResult {
  providerJobId: string;
}

export interface GetStatusResult {
  status: VideoStatus;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  error?: string | null;
}

export interface VideoProvider {
  readonly name: VideoProviderName;
  startRender(input: StartRenderInput): Promise<StartRenderResult>;
  getStatus(providerJobId: string): Promise<GetStatusResult>;
}
