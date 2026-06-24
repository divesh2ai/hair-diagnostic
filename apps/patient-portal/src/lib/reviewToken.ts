import { createHmac, timingSafeEqual } from "crypto";

// Shared-secret HMAC token used for doctor "review this report" links.
// We deliberately avoid storing tokens in the database — the token itself
// carries the assessmentId + expiry, signed by the server so it cannot be
// forged. A token therefore needs no lookup to be useful; revoking a
// token just means rotating REVIEW_TOKEN_SECRET.
//
// Format:  <b64url(payload-json)>.<b64url(hmac-hex)>
// Payload: { a: assessmentId, e: expiresAtEpochMs }

const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getSecret(): string {
  const s = process.env.REVIEW_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REVIEW_TOKEN_SECRET is required in production");
    }
    // Dev-only fallback so the local server boots without extra setup.
    return "dev-only-review-secret-do-not-use-in-prod";
  }
  return s;
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

interface TokenPayload {
  a: string; // assessmentId
  e: number; // expiresAtEpochMs
}

export function signReviewToken(
  assessmentId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload: TokenPayload = {
    a: assessmentId,
    e: Date.now() + ttlMs,
  };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", getSecret()).update(body).digest("hex");
  return `${body}.${b64url(mac)}`;
}

export type ReviewTokenError =
  | "MALFORMED"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "INVALID_PAYLOAD";

export type VerifyResult =
  | { ok: true; assessmentId: string; expiresAt: number }
  | { ok: false; error: ReviewTokenError };

export function verifyReviewToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "MALFORMED" };

  const [body, providedSig] = parts;
  const expectedSig = b64url(
    createHmac("sha256", getSecret()).update(body).digest("hex"),
  );

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "INVALID_SIGNATURE" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (
    typeof payload.a !== "string" ||
    !payload.a ||
    typeof payload.e !== "number"
  ) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (Date.now() > payload.e) {
    return { ok: false, error: "EXPIRED" };
  }

  return { ok: true, assessmentId: payload.a, expiresAt: payload.e };
}
