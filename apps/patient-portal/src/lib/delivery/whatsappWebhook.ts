import { createHmac, timingSafeEqual } from "crypto";

// WhatsApp provider status callbacks — the contract, verification and parsing.
//
// ══ WHAT THIS IS FOR ════════════════════════════════════════════════════════
//
// `sendPatientLink` can record that a provider ACCEPTED a message. It cannot
// know whether the message reached the phone, or whether anyone read it —
// every WhatsApp Business API reports those asynchronously, minutes or hours
// later, to a callback URL. Without a receiver, `deliveredAt` and `readAt`
// stay null forever and the doctor's journey can only ever say "sent".
//
// This module is the receiver's contract. It is implemented against Meta's
// Cloud API because that is the adapter `whatsappProvider` already targets;
// nothing here needs provider credentials to be correct, only the app secret
// at verification time.
//
// ══ THE SIGNATURE ═══════════════════════════════════════════════════════════
//
// Meta signs the RAW request body with the app secret and sends
// `X-Hub-Signature-256: sha256=<hex>`. That signature is the whole
// authentication of a public URL that mutates delivery state, so it is
// verified before the body is parsed and every ambiguity fails closed.
//
// The `sha256=` prefix is part of the header format, not the digest — it is
// stripped before comparison. A verifier that forgets is one that rejects
// every genuine callback and then gets "fixed" by weakening the check.

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

/** Providers whose status callbacks this deployment accepts, and their header. */
const SIGNATURE_HEADER: Record<string, string> = {
  meta_cloud: "x-hub-signature-256",
};

export function isKnownStatusProvider(provider: string): boolean {
  return Object.prototype.hasOwnProperty.call(SIGNATURE_HEADER, provider);
}

function secretFor(provider: string): string | null {
  const specific = process.env[`WHATSAPP_WEBHOOK_SECRET_${provider.toUpperCase()}`];
  return specific ?? process.env.WHATSAPP_WEBHOOK_SECRET ?? null;
}

export function verifyWhatsappWebhookSignature(
  provider: string,
  rawBody: string,
  headers: Headers,
): WebhookVerdict {
  const headerName = SIGNATURE_HEADER[provider];
  if (!headerName) return { ok: false, reason: "unknown_provider" };

  const secret = secretFor(provider);
  if (!secret) return { ok: false, reason: "not_configured" };

  const provided = headers.get(headerName);
  if (!provided) return { ok: false, reason: "missing_signature" };

  // `sha256=` is Meta's header format. Tolerated but not required, so a
  // synthetic fixture may send the bare digest.
  const offered = provided.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  // Length compared first: timingSafeEqual THROWS on unequal lengths, and an
  // exception here would become a 500, which tells a prober more than a 401.
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true };
}

/**
 * One status transition reported by the provider.
 *
 * `messageId` is the provider's own id, which is what `sendPatientLink` stored
 * on the delivery row — it is the ONLY join key a callback carries. There is
 * no assessment id, no patient id and no clinic in these payloads, which is
 * why an unknown id can only be ignored.
 */
export interface ProviderStatusEvent {
  messageId: string;
  /** Normalised. Meta sends lowercase; other providers may not. */
  status: "sent" | "delivered" | "read" | "failed";
  /** The provider's raw status string, kept verbatim for support triage. */
  raw: string;
}

interface MetaStatusPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        statuses?: Array<{ id?: string; status?: string }>;
      };
    }>;
  }>;
}

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  "sent",
  "delivered",
  "read",
  "failed",
]);

/**
 * Pull the status transitions out of a Meta Cloud API webhook body.
 *
 * ── Deliberately total ──────────────────────────────────────────────────────
 * Returns an empty array for anything it does not recognise rather than
 * throwing. Meta delivers many event shapes to one URL — inbound messages,
 * template approvals, account alerts — and a receiver that throws on the ones
 * it does not care about returns 5xx, which makes the provider retry them
 * forever and eventually throttle the endpoint that DOES matter.
 *
 * Unknown status strings are dropped for the same reason a payment webhook
 * allowlists its capture events: guessing that an unrecognised status means
 * "delivered" is how a message that failed gets recorded as received.
 */
export function parseMetaStatusEvents(body: unknown): ProviderStatusEvent[] {
  const payload = body as MetaStatusPayload;
  const out: ProviderStatusEvent[] = [];

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const s of change?.value?.statuses ?? []) {
        const id = typeof s?.id === "string" ? s.id : null;
        const raw = typeof s?.status === "string" ? s.status : null;
        if (!id || !raw) continue;
        const normalised = raw.toLowerCase();
        if (!KNOWN_STATUSES.has(normalised)) continue;
        out.push({
          messageId: id,
          status: normalised as ProviderStatusEvent["status"],
          raw,
        });
      }
    }
  }
  return out;
}
