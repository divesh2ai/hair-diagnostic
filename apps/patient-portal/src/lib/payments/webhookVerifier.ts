import { createHmac, timingSafeEqual } from "crypto";

// Payment webhook authentication.
//
// ── The property this file exists to hold ───────────────────────────────────
// A payment webhook endpoint is, by construction, an unauthenticated public
// URL that flips an order to PAID. If its only check is "the body looks like a
// payment event", then anyone who can guess an order id gets free kits. The
// signature IS the authentication, and it is the whole of it.
//
// ── Why it is provider-shaped but provider-agnostic ─────────────────────────
// No gateway is integrated yet — the cart's confirm button is still a
// placeholder. Rather than guess at one vendor's exact scheme and hard-code
// it, this implements the form all three candidates share (Razorpay,
// Instamojo, Stripe all sign the RAW request body with HMAC-SHA256 under a
// shared secret and send the hex digest in a header) and names the header per
// provider. Wiring a real gateway is then a header name and a secret.
//
// ── Fail closed ─────────────────────────────────────────────────────────────
// Every ambiguity resolves to rejection: no secret configured, unknown
// provider, missing header, wrong length, malformed hex. There is deliberately
// no development bypass — a `NODE_ENV !== "production"` escape hatch in a
// payment verifier is a bypass that ships, and staging carries real-shaped
// orders.

export type WebhookVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unknown_provider"
        | "not_configured"
        | "missing_signature"
        | "invalid_signature";
    };

/**
 * Providers this deployment will accept callbacks from, and the header each
 * one signs with.
 *
 * An allowlist rather than a free-form path segment: without it,
 * `/api/payments/webhook/<anything>` is a route that exists, and the first
 * question in an incident is which of them are real.
 */
const PROVIDER_SIGNATURE_HEADER: Record<string, string> = {
  razorpay: "x-razorpay-signature",
  instamojo: "x-instamojo-signature",
  stripe: "stripe-signature",
};

export function isKnownProvider(provider: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    PROVIDER_SIGNATURE_HEADER,
    provider,
  );
}

/**
 * Per-provider secret, so rotating one gateway does not invalidate another.
 * `PAYMENT_WEBHOOK_SECRET` is the shared fallback for a single-gateway
 * deployment.
 */
function secretFor(provider: string): string | null {
  const specific =
    process.env[`PAYMENT_WEBHOOK_SECRET_${provider.toUpperCase()}`];
  return specific ?? process.env.PAYMENT_WEBHOOK_SECRET ?? null;
}

/**
 * Verify a webhook signature over the RAW request body.
 *
 * `rawBody` must be the exact bytes received. Re-serialising a parsed object
 * changes key order and whitespace, so the digest stops matching and every
 * genuine callback is rejected — which then gets "fixed" by weakening the
 * check. The route reads `req.text()` once and parses afterwards for this
 * reason.
 */
export function verifyWebhookSignature(
  provider: string,
  rawBody: string,
  headers: Headers,
): WebhookVerdict {
  const headerName = PROVIDER_SIGNATURE_HEADER[provider];
  if (!headerName) return { ok: false, reason: "unknown_provider" };

  const secret = secretFor(provider);
  if (!secret) return { ok: false, reason: "not_configured" };

  const provided = headers.get(headerName);
  if (!provided) return { ok: false, reason: "missing_signature" };

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  // Length is compared before the constant-time comparison because
  // timingSafeEqual THROWS on unequal lengths — an exception here would become
  // a 500, and a 500 tells a prober something a 401 does not.
  const a = Buffer.from(provided.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true };
}
