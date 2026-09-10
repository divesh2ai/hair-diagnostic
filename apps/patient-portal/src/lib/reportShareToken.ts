import { createHmac, timingSafeEqual } from "crypto";

// Shared-secret HMAC token gating the PATIENT-FACING clinical report.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Before this, the only ways a patient could be handed their report were a
// Supabase storage URL (permanent, unauthenticated, and — in production today
// — sitting in a public bucket whose object paths contain patient names), or
// `/reports/<assessmentId>/one-page`, which requires a clinic session the
// patient does not have. Neither is a patient delivery mechanism: one is an
// uncontrolled leak, the other is a login wall.
//
// This is the third option — an application-controlled credential the server
// mints, the server validates, and the application can reason about.
//
// ── Why it extends the existing contract rather than competing with it ──────
// `reviewToken.ts` (doctor review links) and `cartToken.ts` (patient cart)
// already establish the platform's share-token shape: a signed, self-carrying
// payload with no database row, domain-separated by a key label so a token
// minted for one surface cannot open another. A third mechanism — opaque
// random strings in a lookup table — would mean two competing answers to
// "what is a share token here", two revocation stories, and two sets of
// verification bugs. So this is the same primitive with its own domain.
//
// Format:  <b64url(payload-json)>.<b64url(hmac-hex)>
// Payload: { a: assessmentId, e: expiresAtEpochMs, p: "report.v1" }
//
// ── What is deliberately NOT in the token ───────────────────────────────────
// No patient name, no phone, no clinic, no diagnosis, no artifact id, no
// storage path. The payload is an assessment id, an expiry and a purpose, so a
// token intercepted in transit discloses nothing by itself and is worthless
// without being presented to this server. This matters more here than on the
// cart: the object behind this link is the clinical record.

// ── Lifetime ────────────────────────────────────────────────────────────────
// Shorter than the cart's 90 days, on purpose. The cart is a commercial
// document the patient is expected to return to while deciding; the report is
// the clinical record, so its link is the most sensitive credential the
// platform hands out and its exposure window should be the smallest one that
// is still usable. 30 days covers "read it, show it to my family, come back to
// it after the follow-up call", and re-sending is now a single doctor action
// rather than a support request — so expiry is cheap to recover from.
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Domain separation. The signing key is derived from the shared secret with a
// fixed label, so report, cart and review tokens minted from the SAME secret
// carry different signatures and none validates in another's verifier.
//
// Without this the payloads would be dangerously close: a cart token and a
// report token differ only by the `p` field, and a verifier that checked the
// signature before the purpose would accept the wrong one for a moment. The
// key label makes the signatures themselves disagree, so the mistake cannot be
// made even by a careless future verifier.
const KEY_LABEL = "hairos.report-share-token.v1";
const PURPOSE = "report.v1";

function getSecret(): string {
  // Falls back through the existing secrets so no new environment variable is
  // required to deploy this. REPORT_SHARE_TOKEN_SECRET is honoured first for
  // deployments that want the report surface revocable independently of the
  // cart — which is the whole point of being able to rotate one and not the
  // other, and is the recommended production configuration.
  const s =
    process.env.REPORT_SHARE_TOKEN_SECRET ??
    process.env.CART_TOKEN_SECRET ??
    process.env.REVIEW_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REPORT_SHARE_TOKEN_SECRET, CART_TOKEN_SECRET or REVIEW_TOKEN_SECRET is required in production",
      );
    }
    // Dev-only fallback so the local server boots without extra setup.
    return "dev-only-report-share-secret-do-not-use-in-prod";
  }
  return s;
}

function signingKey(): Buffer {
  return createHmac("sha256", getSecret()).update(KEY_LABEL).digest();
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

interface ReportShareTokenPayload {
  a: string; // assessmentId
  e: number; // expiresAtEpochMs
  p: string; // purpose
}

export function signReportShareToken(
  assessmentId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload: ReportShareTokenPayload = {
    a: assessmentId,
    e: Date.now() + ttlMs,
    p: PURPOSE,
  };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", signingKey()).update(body).digest("hex");
  return `${body}.${b64url(mac)}`;
}

export type ReportShareTokenError =
  | "MALFORMED"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "INVALID_PAYLOAD"
  | "WRONG_PURPOSE";

export type VerifyReportShareTokenResult =
  | { ok: true; assessmentId: string; expiresAt: number }
  | { ok: false; error: ReportShareTokenError };

/**
 * Verify a report share token and return the ONE assessment it opens.
 *
 * ── Why this signature differs from verifyCartToken's ───────────────────────
 * The cart verifier takes an `expectedAssessmentId` because the cart URL
 * carries the assessment id in its path and the token beside it — so there are
 * two claims about which record is meant, and they must be compared.
 *
 * Here the token is the WHOLE address: `/patient/report/<token>`. There is no
 * second claim to compare against, so the token does not authorise access to
 * an assessment the caller named — it NAMES the assessment. That removes the
 * mismatch class entirely rather than guarding against it: a caller cannot
 * present assessment A's token for assessment B, because there is nowhere in
 * the request to say "B".
 *
 * The caller must therefore use the returned `assessmentId` and nothing else
 * when loading the record. Reading an id from anywhere else in the request
 * would re-introduce exactly the confused-deputy bug this shape removes.
 */
export function verifyReportShareToken(
  token: string,
): VerifyReportShareTokenResult {
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

  let payload: ReportShareTokenPayload;
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

  // Purpose check runs before expiry so a replayed cart or review token is
  // reported as what it is rather than as a stale report token.
  if (payload.p !== PURPOSE) {
    return { ok: false, error: "WRONG_PURPOSE" };
  }

  if (Date.now() > payload.e) {
    return { ok: false, error: "EXPIRED" };
  }

  return { ok: true, assessmentId: payload.a, expiresAt: payload.e };
}

/** Patient-facing path for a minted token. One place builds this URL. */
export function patientReportHref(token: string): string {
  return `/patient/report/${encodeURIComponent(token)}`;
}

/**
 * Absolute form, for a link that leaves the app — the WhatsApp message.
 *
 * `origin` must be supplied by the caller. A relative path in a message sent
 * to a patient goes nowhere, and NEXT_PUBLIC_APP_URL can name a host that does
 * not serve this clinic — the same reasoning as `absoluteCartUrl`.
 */
export function absolutePatientReportUrl(origin: string, token: string): string {
  return `${origin}${patientReportHref(token)}`;
}
