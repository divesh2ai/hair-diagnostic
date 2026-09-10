import { createHmac, timingSafeEqual } from "crypto";

// Shared-secret HMAC token gating the patient cart.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// `/api/cart/[assessmentId]` used to be open: the assessment cuid alone
// returned the patient's name and phone. A cuid is unguessable but it is not a
// credential — it appears in doctor-side URLs, in WhatsApp messages, in
// browser history and in server logs, and it never expires. Anyone who came
// into possession of one held permanent read access to that patient's PII.
//
// The token carries the binding itself rather than a database row, matching
// `reviewToken.ts`: no lookup is needed to validate one, and revoking every
// outstanding token is a secret rotation. The only claims are the assessment
// id, an expiry, and a purpose — deliberately no name, phone, order id or
// clinic, so a leaked token discloses nothing on its own and must still be
// presented to the server to be worth anything.
//
// Format:  <b64url(payload-json)>.<b64url(hmac-hex)>
// Payload: { a: assessmentId, e: expiresAtEpochMs, p: "cart.v1" }

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Domain separation. The signing key is derived from the shared secret with a
// fixed label, so a review token and a cart token minted from the SAME secret
// carry different signatures and neither validates in the other's verifier.
// Without this, `reviewToken`'s `{a,e}` payload would be byte-identical to a
// cart payload that omitted `p`, and one token would open both surfaces.
const KEY_LABEL = "hairos.cart-token.v1";
const PURPOSE = "cart.v1";

function getSecret(): string {
  // Falls back to REVIEW_TOKEN_SECRET so no new environment variable is
  // required to deploy this. CART_TOKEN_SECRET is honoured first for
  // deployments that want the two surfaces revocable independently.
  const s = process.env.CART_TOKEN_SECRET ?? process.env.REVIEW_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CART_TOKEN_SECRET or REVIEW_TOKEN_SECRET is required in production",
      );
    }
    // Dev-only fallback so the local server boots without extra setup.
    return "dev-only-cart-secret-do-not-use-in-prod";
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
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

interface CartTokenPayload {
  a: string; // assessmentId
  e: number; // expiresAtEpochMs
  p: string; // purpose
}

export function signCartToken(
  assessmentId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload: CartTokenPayload = {
    a: assessmentId,
    e: Date.now() + ttlMs,
    p: PURPOSE,
  };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", signingKey()).update(body).digest("hex");
  return `${body}.${b64url(mac)}`;
}

export type CartTokenError =
  | "MALFORMED"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "INVALID_PAYLOAD"
  | "WRONG_PURPOSE"
  | "ASSESSMENT_MISMATCH";

export type VerifyCartTokenResult =
  | { ok: true; assessmentId: string; expiresAt: number }
  | { ok: false; error: CartTokenError };

/**
 * Verify a cart token AND bind it to the assessment being requested.
 *
 * `expectedAssessmentId` is not optional on purpose. A verifier that only
 * answered "is this signature valid" would happily accept assessment A's
 * token on a request for assessment B — the signature is genuine, it is just
 * for someone else's record. Binding is the whole point, so it is part of the
 * one call every caller must make.
 */
export function verifyCartToken(
  token: string,
  expectedAssessmentId: string,
): VerifyCartTokenResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "MALFORMED" };

  const [body, providedSig] = parts;
  const expectedSig = b64url(
    createHmac("sha256", signingKey()).update(body).digest("hex"),
  );

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "INVALID_SIGNATURE" };
  }

  let payload: CartTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (
    typeof payload.a !== "string" ||
    !payload.a ||
    typeof payload.e !== "number" ||
    typeof payload.p !== "string"
  ) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  // Purpose check runs before expiry so a replayed review token is reported as
  // what it is rather than as a stale cart token.
  if (payload.p !== PURPOSE) {
    return { ok: false, error: "WRONG_PURPOSE" };
  }

  if (Date.now() > payload.e) {
    return { ok: false, error: "EXPIRED" };
  }

  // The binding. Compared last so the cheaper structural failures are
  // reported first, but no result is `ok` without it.
  if (payload.a !== expectedAssessmentId) {
    return { ok: false, error: "ASSESSMENT_MISMATCH" };
  }

  return { ok: true, assessmentId: payload.a, expiresAt: payload.e };
}
