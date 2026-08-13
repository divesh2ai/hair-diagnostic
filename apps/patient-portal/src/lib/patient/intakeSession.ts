import { createHmac, randomUUID, timingSafeEqual } from "crypto";

// Short-lived, server-signed token for the anonymous patient intake flow.
//
// Why this exists: the identity lookup takes a phone number and answers
// "has this clinic seen this number?". If the caller could name any clinic it
// liked, that endpoint would be a clinic-attendance oracle — feed it a number
// and a clinic slug (which is public, it's in the QR URL) and learn where
// someone has sought treatment. That is a privacy leak dressed as a UX
// convenience.
//
// So the clinic is never read from the request body. It is carried inside a
// token the server issued after resolving the slug itself, which gives us:
//
//   * a scope that the client cannot widen or swap
//   * a per-session budget, so one issued token buys a handful of lookups
//     rather than an unbounded scripted sweep
//   * a short expiry, because an intake happens in minutes, not days
//
// Format:  <b64url(payload-json)>.<b64url(hmac-hex)>
// Payload: { c: clinicId, j: sessionId, e: expiresAtEpochMs }

// Long enough for a patient to fumble a phone number at reception, short
// enough that a leaked token is worthless by the time it is replayed.
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function getSecret(): string {
  // Shares the review-token secret: same trust domain (server-signed, no
  // database row), one rotation lever.
  const s = process.env.REVIEW_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REVIEW_TOKEN_SECRET is required in production");
    }
    return "dev-only-review-secret-do-not-use-in-prod";
  }
  return s;
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const padded =
    s.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

interface SessionPayload {
  c: string; // clinicId — resolved server-side, never client-supplied
  j: string; // session id, used as the per-session rate-limit key
  e: number; // expiresAtEpochMs
}

export interface IntakeSession {
  token: string;
  sessionId: string;
  expiresAt: number;
}

export function signIntakeSession(
  clinicId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): IntakeSession {
  const sessionId = randomUUID();
  const expiresAt = Date.now() + ttlMs;
  const payload: SessionPayload = { c: clinicId, j: sessionId, e: expiresAt };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", getSecret()).update(body).digest("hex");
  return { token: `${body}.${b64url(mac)}`, sessionId, expiresAt };
}

export type IntakeSessionError =
  | "MALFORMED"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "INVALID_PAYLOAD";

export type VerifyIntakeSession =
  | { ok: true; clinicId: string; sessionId: string; expiresAt: number }
  | { ok: false; error: IntakeSessionError };

export function verifyIntakeSession(token: unknown): VerifyIntakeSession {
  if (typeof token !== "string" || token === "") {
    return { ok: false, error: "MALFORMED" };
  }

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

  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (
    typeof payload.c !== "string" ||
    !payload.c ||
    typeof payload.j !== "string" ||
    !payload.j ||
    typeof payload.e !== "number"
  ) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  if (Date.now() > payload.e) return { ok: false, error: "EXPIRED" };

  return {
    ok: true,
    clinicId: payload.c,
    sessionId: payload.j,
    expiresAt: payload.e,
  };
}

/**
 * Read a session's identifiers ignoring expiry. Signature still required.
 *
 * ── This grants nothing ─────────────────────────────────────────────────────
 * It must never gate a lookup, a read, or anything a caller could learn
 * something from. Its one job is correlation at submission: matching a
 * completed assessment back to the ClinicVisit opened for the same session, so
 * the patient leaves "In Clinic" and appears in the Review Queue.
 *
 * Expiry is deliberately not enforced there. The token lives 30 minutes and an
 * unhurried assessment can outlast it; refusing the link would leave a patient
 * rendered as still-filling-in the assessment they had just submitted, on both
 * halves of the dashboard at once. The link is also independently constrained:
 * the caller checks the clinic matches the submission and the visit is still
 * open, and the row it writes carries no clinical content.
 */
export function readIntakeSessionForLinking(
  token: unknown,
): { clinicId: string; sessionId: string } | null {
  const verified = verifyIntakeSession(token);
  if (verified.ok) {
    return { clinicId: verified.clinicId, sessionId: verified.sessionId };
  }
  if (verified.error !== "EXPIRED") return null;

  // Expired but signed: re-read the payload, which verifyIntakeSession has
  // already proven authentic and well-formed before rejecting it on age alone.
  const [body] = String(token).split(".");
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    return { clinicId: payload.c, sessionId: payload.j };
  } catch {
    return null;
  }
}
