// The credential the render worker presents to the page it screenshots.
//
// ── The problem this solves ─────────────────────────────────────────────────
// A headless browser is a second HTTP client. Whatever page it opens has to
// authorise it, and the three obvious answers are all wrong:
//
//   • forward the doctor's session cookie — which is what the previous
//     renderer did. It ties an artefact to whoever happened to press a button,
//     puts a live credential inside a background job, and means a render can
//     only ever happen while a human is holding a session.
//   • a `?skipAuth=true` on the report route — an unauthenticated read of a
//     patient's clinical record, one typo away from being reachable.
//   • ALLOW_DEV_LOGIN in a deployed environment — a general-purpose bypass
//     retained in Preview or Production, which is the same thing with worse
//     branding.
//
// So the worker gets its own credential: an HMAC token that opens exactly ONE
// artefact for a few minutes and nothing else, ever.
//
// ── Why it extends the existing contract ────────────────────────────────────
// reviewToken.ts, cartToken.ts and reportShareToken.ts already establish the
// platform's token shape — a signed, self-carrying payload with no database
// row, domain-separated by a key label so a token minted for one surface
// cannot open another. A fourth mechanism would mean a fourth verifier with a
// fourth set of bugs. This is the same primitive with its own domain.
//
// Format:  <b64url(payload-json)>.<b64url(hmac-hex)>
// Payload: { i: assetId, v: consultationVersionId, k: assetType,
//            e: expiresAtEpochMs, p: "render.v1" }
//
// ── What is deliberately NOT in it ──────────────────────────────────────────
// No URL, no storage path, no clinic, no patient, no assessment id. The token
// names an ARTEFACT, and the render target derives everything else from the
// database row that artefact id identifies. A token therefore cannot ask the
// browser to visit a destination of the holder's choosing — which is the
// property that keeps the renderer from becoming an SSRF primitive.

import { createHmac, timingSafeEqual } from "crypto";
import type { ReportAssetType } from "@prisma/client";

/**
 * Minutes, not days.
 *
 * This token exists for the duration of one render. It is minted immediately
 * before the browser launches and is worthless by the time the invocation
 * ends, so the exposure window is bounded by the render itself rather than by
 * anybody remembering to revoke something. Generous enough to survive a cold
 * Chromium start on a serverless instance.
 */
const DEFAULT_TTL_MS = 3 * 60 * 1000;

/**
 * Domain separation. The signing key is derived from the shared secret with a
 * fixed label, so a render token and a patient report token minted from the
 * SAME secret carry different signatures and neither validates in the other's
 * verifier.
 */
const KEY_LABEL = "hairos.report-render-token.v1";
const PURPOSE = "render.v1";

function getSecret(): string {
  // Falls back through the existing secrets so no new environment variable is
  // required to deploy this. RENDER_TOKEN_SECRET is honoured first for
  // deployments that want the render surface revocable independently of the
  // patient-facing ones — which is the recommended production configuration,
  // because rotating it costs at most one in-flight render.
  const s =
    process.env.RENDER_TOKEN_SECRET ??
    process.env.REPORT_SHARE_TOKEN_SECRET ??
    process.env.CART_TOKEN_SECRET ??
    process.env.REVIEW_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RENDER_TOKEN_SECRET, REPORT_SHARE_TOKEN_SECRET, CART_TOKEN_SECRET or REVIEW_TOKEN_SECRET is required in production",
      );
    }
    return "dev-only-render-token-secret-do-not-use-in-prod";
  }
  return s;
}

function signingKey(): Buffer {
  return createHmac("sha256", getSecret()).update(KEY_LABEL).digest();
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const padded =
    s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

interface RenderTokenPayload {
  i: string; // reportAssetId
  v: string; // consultationVersionId
  k: string; // ReportAssetType
  e: number; // expiresAtEpochMs
  p: string; // purpose
}

export function signRenderToken(
  input: { assetId: string; consultationVersionId: string; type: ReportAssetType },
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload: RenderTokenPayload = {
    i: input.assetId,
    v: input.consultationVersionId,
    k: input.type,
    e: Date.now() + ttlMs,
    p: PURPOSE,
  };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", signingKey()).update(body).digest("hex");
  return `${body}.${b64url(mac)}`;
}

export type RenderTokenError =
  | "MALFORMED"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "INVALID_PAYLOAD"
  | "WRONG_PURPOSE";

export type VerifyRenderTokenResult =
  | {
      ok: true;
      assetId: string;
      consultationVersionId: string;
      type: ReportAssetType;
      expiresAt: number;
    }
  | { ok: false; error: RenderTokenError };

/**
 * Verify a render token and return the ONE artefact it opens.
 *
 * Like the patient report token, the token NAMES its subject rather than
 * authorising access to a subject the caller named. The render target must use
 * the returned `assetId` and nothing from the rest of the request — reading an
 * id from a query string beside the token would re-introduce exactly the
 * confused-deputy bug this shape removes.
 */
export function verifyRenderToken(token: string): VerifyRenderTokenResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "MALFORMED" };

  const [body, providedSig] = parts;
  const expectedSig = b64url(createHmac("sha256", signingKey()).update(body).digest("hex"));

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "INVALID_SIGNATURE" };
  }

  let payload: RenderTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (
    typeof payload.i !== "string" ||
    !payload.i ||
    typeof payload.v !== "string" ||
    !payload.v ||
    typeof payload.k !== "string" ||
    typeof payload.e !== "number" ||
    typeof payload.p !== "string"
  ) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  // Purpose before expiry, so a replayed cart or review token is reported as
  // what it is rather than as a stale render token.
  if (payload.p !== PURPOSE) {
    return { ok: false, error: "WRONG_PURPOSE" };
  }

  if (Date.now() > payload.e) {
    return { ok: false, error: "EXPIRED" };
  }

  return {
    ok: true,
    assetId: payload.i,
    consultationVersionId: payload.v,
    type: payload.k as ReportAssetType,
    expiresAt: payload.e,
  };
}

/** The one place that builds the render target's path. */
export function renderTargetHref(token: string): string {
  return `/internal/render/one-pager/${encodeURIComponent(token)}`;
}
