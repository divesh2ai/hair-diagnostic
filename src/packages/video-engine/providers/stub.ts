import { randomUUID } from "node:crypto";
import type {
  GetStatusResult,
  StartRenderInput,
  StartRenderResult,
  VideoProvider,
} from "../types";

interface StubJobState {
  startedAt: number;
  status: "RENDERING" | "READY" | "FAILED";
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  error: string | null;
}

// In-memory job ledger. Shared across hot reloads via globalThis so dev mode
// doesn't drop in-flight renders. Production replaces this with the real
// provider's polling/webhook.
const g = globalThis as unknown as { _hairosStubVideoJobs?: Map<string, StubJobState> };
const JOBS: Map<string, StubJobState> = g._hairosStubVideoJobs ?? new Map();
if (process.env.NODE_ENV !== "production") g._hairosStubVideoJobs = JOBS;

const SIMULATED_RENDER_MS = 45_000;
const PLACEHOLDER_VIDEO_URL = "/video-placeholder.mp4";
const PLACEHOLDER_THUMB_URL = "/video-placeholder-poster.jpg";
const PLACEHOLDER_DURATION_SEC = 90;

export const stubVideoProvider: VideoProvider = {
  name: "stub",

  async startRender(_input: StartRenderInput): Promise<StartRenderResult> {
    const providerJobId = `stub-${randomUUID()}`;
    JOBS.set(providerJobId, {
      startedAt: Date.now(),
      status: "RENDERING",
      videoUrl: null,
      thumbnailUrl: null,
      durationSec: null,
      error: null,
    });
    return { providerJobId };
  },

  async getStatus(providerJobId: string): Promise<GetStatusResult> {
    const job = JOBS.get(providerJobId);
    if (!job) {
      return { status: "FAILED", error: `Unknown providerJobId ${providerJobId}` };
    }

    if (job.status === "RENDERING" && Date.now() - job.startedAt >= SIMULATED_RENDER_MS) {
      job.status = "READY";
      job.videoUrl = PLACEHOLDER_VIDEO_URL;
      job.thumbnailUrl = PLACEHOLDER_THUMB_URL;
      job.durationSec = PLACEHOLDER_DURATION_SEC;
    }

    return {
      status: job.status,
      videoUrl: job.videoUrl,
      thumbnailUrl: job.thumbnailUrl,
      durationSec: job.durationSec,
      error: job.error,
    };
  },
};
