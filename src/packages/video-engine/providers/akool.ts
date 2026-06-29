import type { AvatarScript } from "../../ai-engine/narrative-engine/types";
import type {
  GetStatusResult,
  StartRenderInput,
  StartRenderResult,
  VideoProvider,
  VideoStatus,
} from "../types";

/**
 * Akool Open API v3 — Talking Photo / Talking Avatar provider.
 *
 * Env (required):
 *   AKOOL_CLIENT_ID       — OAuth client id from Akool dashboard.
 *   AKOOL_CLIENT_SECRET   — OAuth client secret.
 *   AKOOL_AVATAR_ID       — id of the talking-photo / avatar asset.
 *   AKOOL_VOICE_ID        — id of the voice to use for TTS.
 *
 * Env (optional):
 *   AKOOL_API_BASE        — defaults to https://openapi.akool.com.
 *   AKOOL_TOKEN_PATH      — defaults to /api/open/v3/getToken.
 *   AKOOL_CREATE_PATH     — defaults to /api/open/v3/content/video/createbytalkingphoto.
 *   AKOOL_STATUS_PATH     — defaults to /api/open/v3/content/video/infobymodelid.
 *   AKOOL_DIMENSION_W     — defaults to 1280.
 *   AKOOL_DIMENSION_H     — defaults to 720.
 *
 * NOTE on endpoint paths:
 *   Akool's REST surface has shifted between v2 and v3. If your dashboard shows
 *   different paths (e.g. /api/open/v3/talkingavatar/create), override them via
 *   the AKOOL_*_PATH env vars rather than editing this file.
 */

const DEFAULT_API_BASE = "https://openapi.akool.com";
const DEFAULT_TOKEN_PATH = "/api/open/v3/getToken";
const DEFAULT_CREATE_PATH = "/api/open/v3/content/video/createbytalkingphoto";
const DEFAULT_STATUS_PATH = "/api/open/v3/content/video/infobymodelid";

interface AkoolTokenResponse {
  code?: number;
  msg?: string;
  token?: string;
  data?: { token?: string };
}

interface AkoolCreateResponse {
  code?: number;
  msg?: string;
  data?: {
    _id?: string;
    video_id?: string;
    task_id?: string;
  };
}

interface AkoolStatusResponse {
  code?: number;
  msg?: string;
  data?: {
    // Akool's video_status is documented as numeric:
    //  1 = queueing, 2 = processing, 3 = success, 4 = failed.
    video_status?: number;
    status?: number;
    video?: string | null;
    video_url?: string | null;
    thumbnail?: string | null;
    duration?: number | null;
    error?: string | null;
  };
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Akool provider misconfigured: ${name} is not set`);
  }
  return v;
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

// ─── Token cache ──────────────────────────────────────────────────────────────
// Akool tokens are documented as valid for ~1 year, but we still cache + refresh
// on 401. Shared across hot reloads via globalThis.

interface CachedToken {
  token: string;
  fetchedAt: number;
}
const g = globalThis as unknown as { _akoolToken?: CachedToken };

async function getAccessToken(force = false): Promise<string> {
  if (!force && g._akoolToken && Date.now() - g._akoolToken.fetchedAt < 23 * 60 * 60 * 1000) {
    return g._akoolToken.token;
  }
  const base = envOr("AKOOL_API_BASE", DEFAULT_API_BASE);
  const path = envOr("AKOOL_TOKEN_PATH", DEFAULT_TOKEN_PATH);
  const clientId = envOrThrow("AKOOL_CLIENT_ID");
  const clientSecret = envOrThrow("AKOOL_CLIENT_SECRET");

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Akool token HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as AkoolTokenResponse;
  const token = json.token ?? json.data?.token;
  if (!token) {
    throw new Error(`Akool token response missing token: ${JSON.stringify(json).slice(0, 300)}`);
  }
  g._akoolToken = { token, fetchedAt: Date.now() };
  return token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flattenScriptToNarration(script: AvatarScript): string {
  const parts: string[] = [];
  if (script.intro?.text) parts.push(script.intro.text.trim());
  for (const scene of script.scenes) {
    if (scene.narration) parts.push(scene.narration.trim());
  }
  if (script.outro?.text) parts.push(script.outro.text.trim());
  return parts.filter(Boolean).join(" ");
}

function mapAkoolStatus(s: number | undefined): VideoStatus {
  switch (s) {
    case 3:
      return "READY";
    case 4:
      return "FAILED";
    case 1:
    case 2:
      return "RENDERING";
    default:
      return "RENDERING";
  }
}

async function authedFetch(url: string, init: RequestInit, retryOn401 = true): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (res.status === 401 && retryOn401) {
    await getAccessToken(true);
    return authedFetch(url, init, false);
  }
  return res;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const akoolVideoProvider: VideoProvider = {
  name: "akool" as VideoProvider["name"],

  async startRender(input: StartRenderInput): Promise<StartRenderResult> {
    const base = envOr("AKOOL_API_BASE", DEFAULT_API_BASE);
    const path = envOr("AKOOL_CREATE_PATH", DEFAULT_CREATE_PATH);
    const avatarId = envOrThrow("AKOOL_AVATAR_ID");
    const voiceId = envOrThrow("AKOOL_VOICE_ID");
    const width = Number(envOr("AKOOL_DIMENSION_W", "1280"));
    const height = Number(envOr("AKOOL_DIMENSION_H", "720"));

    const narration = flattenScriptToNarration(input.script);
    if (!narration) {
      throw new Error("Akool provider: avatar script produced empty narration");
    }

    const body = {
      avatar_id: avatarId,
      voice_id: voiceId,
      text: narration,
      width,
      height,
      // Surface assessmentId so Akool webhooks (when wired) can correlate.
      webhook_data: { assessmentId: input.assessmentId },
    };

    const res = await authedFetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Akool create failed: HTTP ${res.status} ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as AkoolCreateResponse;
    if (json.code !== undefined && json.code !== 1000 && json.code !== 0 && json.code !== 200) {
      throw new Error(`Akool create error code ${json.code}: ${json.msg ?? "unknown"}`);
    }

    const id = json.data?._id ?? json.data?.video_id ?? json.data?.task_id;
    if (!id) {
      throw new Error(`Akool create response missing job id: ${JSON.stringify(json).slice(0, 300)}`);
    }
    return { providerJobId: id };
  },

  async getStatus(providerJobId: string): Promise<GetStatusResult> {
    const base = envOr("AKOOL_API_BASE", DEFAULT_API_BASE);
    const path = envOr("AKOOL_STATUS_PATH", DEFAULT_STATUS_PATH);
    const url = `${base}${path}?_id=${encodeURIComponent(providerJobId)}`;

    const res = await authedFetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "FAILED", error: `Akool status HTTP ${res.status} ${text.slice(0, 300)}` };
    }

    const json = (await res.json()) as AkoolStatusResponse;
    const data = json.data ?? {};
    const status = mapAkoolStatus(data.video_status ?? data.status);

    if (status === "READY") {
      return {
        status,
        videoUrl: data.video ?? data.video_url ?? null,
        thumbnailUrl: data.thumbnail ?? null,
        durationSec: data.duration ?? null,
      };
    }
    if (status === "FAILED") {
      return { status, error: data.error ?? json.msg ?? "Akool reported failed render" };
    }
    return { status };
  },
};
