import type { AvatarScript } from "../../ai-engine/narrative-engine/types";
import type {
  GetStatusResult,
  StartRenderInput,
  StartRenderResult,
  VideoProvider,
  VideoStatus,
} from "../types";

/**
 * HeyGen V2 video provider.
 *
 * Env:
 *   HEYGEN_API_KEY     — required. X-Api-Key header value.
 *   HEYGEN_AVATAR_ID   — required. The avatar_id of the doctor persona.
 *   HEYGEN_VOICE_ID    — required. The voice_id used for narration.
 *   HEYGEN_API_BASE    — optional. Defaults to https://api.heygen.com.
 *   HEYGEN_DIMENSION_W — optional. Defaults to 1280.
 *   HEYGEN_DIMENSION_H — optional. Defaults to 720.
 *   HEYGEN_BACKGROUND  — optional. Hex color (e.g. "#ffffff") or "transparent".
 *                        Defaults to "#ffffff".
 *
 * API references:
 *   Generate: POST {base}/v2/video/generate
 *   Status:   GET  {base}/v1/video_status.get?video_id=...
 */

const DEFAULT_API_BASE = "https://api.heygen.com";

interface HeyGenGenerateResponse {
  error?: { message?: string } | null;
  data?: { video_id?: string };
}

interface HeyGenStatusResponse {
  error?: { message?: string } | null;
  data?: {
    status?: "pending" | "processing" | "completed" | "failed";
    video_url?: string | null;
    thumbnail_url?: string | null;
    duration?: number | null;
    error?: { message?: string } | null;
  };
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`HeyGen provider misconfigured: ${name} is not set`);
  }
  return v;
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

/**
 * Flattens an AvatarScript into a single narration string. HeyGen V2 accepts
 * one or more video_inputs; we keep it simple and concatenate so the patient
 * gets one continuous briefing. Scene transitions live in the visualCue layer
 * which the renderer can use later.
 */
function flattenScriptToNarration(script: AvatarScript): string {
  const parts: string[] = [];
  if (script.intro?.text) parts.push(script.intro.text.trim());
  for (const scene of script.scenes) {
    if (scene.narration) parts.push(scene.narration.trim());
  }
  if (script.outro?.text) parts.push(script.outro.text.trim());
  return parts.filter(Boolean).join(" ");
}

function mapHeygenStatus(s: string | undefined): VideoStatus {
  switch (s) {
    case "completed":
      return "READY";
    case "failed":
      return "FAILED";
    case "pending":
    case "processing":
      return "RENDERING";
    default:
      return "RENDERING";
  }
}

export const heygenVideoProvider: VideoProvider = {
  name: "heygen",

  async startRender(input: StartRenderInput): Promise<StartRenderResult> {
    const apiKey = envOrThrow("HEYGEN_API_KEY");
    const avatarId = envOrThrow("HEYGEN_AVATAR_ID");
    const voiceId = envOrThrow("HEYGEN_VOICE_ID");
    const base = envOr("HEYGEN_API_BASE", DEFAULT_API_BASE);
    const width = Number(envOr("HEYGEN_DIMENSION_W", "1280"));
    const height = Number(envOr("HEYGEN_DIMENSION_H", "720"));
    const background = envOr("HEYGEN_BACKGROUND", "#ffffff");

    const narration = flattenScriptToNarration(input.script);
    if (!narration) {
      throw new Error("HeyGen provider: avatar script produced empty narration");
    }

    const body = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: narration,
            voice_id: voiceId,
          },
          background:
            background === "transparent"
              ? { type: "color", value: "transparent" }
              : { type: "color", value: background },
        },
      ],
      dimension: { width, height },
      // HeyGen accepts a caller-supplied callback_id — surface our assessmentId
      // so webhooks (when wired) can correlate without DB joins.
      callback_id: input.assessmentId,
    };

    const res = await fetch(`${base}/v2/video/generate`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HeyGen generate failed: HTTP ${res.status} ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as HeyGenGenerateResponse;
    if (json.error) {
      throw new Error(`HeyGen generate error: ${json.error.message ?? "unknown"}`);
    }
    const videoId = json.data?.video_id;
    if (!videoId) {
      throw new Error("HeyGen generate response missing data.video_id");
    }

    return { providerJobId: videoId };
  },

  async getStatus(providerJobId: string): Promise<GetStatusResult> {
    const apiKey = envOrThrow("HEYGEN_API_KEY");
    const base = envOr("HEYGEN_API_BASE", DEFAULT_API_BASE);

    const url = `${base}/v1/video_status.get?video_id=${encodeURIComponent(providerJobId)}`;
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: "FAILED",
        error: `HeyGen status HTTP ${res.status} ${text.slice(0, 300)}`,
      };
    }

    const json = (await res.json()) as HeyGenStatusResponse;
    if (json.error) {
      return { status: "FAILED", error: json.error.message ?? "HeyGen status error" };
    }

    const data = json.data ?? {};
    const status = mapHeygenStatus(data.status);

    if (status === "READY") {
      return {
        status,
        videoUrl: data.video_url ?? null,
        thumbnailUrl: data.thumbnail_url ?? null,
        durationSec: data.duration ?? null,
      };
    }
    if (status === "FAILED") {
      return {
        status,
        error: data.error?.message ?? "HeyGen reported failed render",
      };
    }
    return { status };
  },
};
