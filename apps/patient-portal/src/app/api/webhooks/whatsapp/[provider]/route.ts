import { NextResponse } from "next/server";
import {
  DELIVERY_NOT_PROVISIONED,
  DeliveryNotProvisionedError,
  markProviderStatus,
  markDeliveryFailed,
} from "@/lib/delivery/deliveryStore";
import {
  isKnownStatusProvider,
  parseMetaStatusEvents,
  verifyWhatsappWebhookSignature,
} from "@/lib/delivery/whatsappWebhook";

// POST /api/webhooks/whatsapp/[provider]   — provider delivery status callbacks
// GET  /api/webhooks/whatsapp/[provider]   — Meta's subscription handshake
//
// Turns "the provider accepted the message" into "the phone received it" and
// "the patient read it". Until this existed, `deliveredAt` and `readAt` could
// never be anything but null, so the doctor's journey could only ever claim
// SENT — and `markProviderStatus` sat unused.
//
// ── Nothing here is trusted before the signature ────────────────────────────
// This is a public URL that mutates delivery state. The body is parsed only
// after `verifyWhatsappWebhookSignature` passes, and every rejection answers
// the same 401 so a caller cannot distinguish "no secret configured" from
// "wrong signature".
//
// ── Unknown message ids are ignored, not errors ─────────────────────────────
// A callback carries only the provider's message id. It may name a message we
// never sent (a shared phone number id, a replayed capture, another
// environment's traffic). `markProviderStatus` matches on `messageId` and
// updates zero rows for an unknown one; that is reported as `ignored`, with a
// 200, because a 404 would make the provider retry a callback that can never
// succeed.
//
// ── Idempotency ─────────────────────────────────────────────────────────────
// Providers redeliver. The writer uses COALESCE on both timestamps, so the
// FIRST delivered/read instant wins and a redelivery cannot move a timestamp
// that reporting is measured against. Applying the same event fifty times is
// indistinguishable from applying it once.
//
// ── Logging ─────────────────────────────────────────────────────────────────
// No phone numbers, no message bodies, no tokens, no message ids. Counts and
// reason codes only. A message id is a join key into a patient's delivery
// history and does not belong in an aggregated log.

export const dynamic = "force-dynamic";

/**
 * Meta's subscription handshake.
 *
 * Meta will not deliver callbacks until the URL echoes `hub.challenge` back in
 * response to a GET carrying a verify token it was configured with. Compared
 * against `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; without one configured the
 * handshake is refused rather than echoing whatever it is handed, which would
 * let anyone subscribe this endpoint.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  if (!isKnownStatusProvider(provider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected || mode !== "subscribe" || token !== expected || !challenge) {
    return NextResponse.json({ error: "verification_failed" }, { status: 403 });
  }

  // Meta requires the bare challenge string, not JSON.
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;

  if (!isKnownStatusProvider(provider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  // Read once as text — re-serialising a parsed object changes byte order and
  // invalidates every genuine signature.
  const rawBody = await req.text();

  const verdict = verifyWhatsappWebhookSignature(provider, rawBody, req.headers);
  if (!verdict.ok) {
    console.warn(`[whatsapp-webhook] rejected: ${provider} ${verdict.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const events = parseMetaStatusEvents(parsed);
  if (events.length === 0) {
    // Meta delivers many event shapes to one URL. Acknowledging the ones this
    // endpoint has no opinion about stops an endless redelivery loop.
    return NextResponse.json({ ok: true, applied: 0, ignored: 0 });
  }

  let applied = 0;
  let ignored = 0;

  try {
    for (const event of events) {
      if (event.status === "failed") {
        // A provider-side failure AFTER acceptance. Recorded as FAILED so the
        // action centre surfaces it — a message the provider took and then
        // could not deliver is exactly the case a doctor would otherwise
        // believe had arrived.
        const row = await markDeliveryFailed({
          deliveryId: event.messageId,
          error: "provider_reported_failure",
          providerStatus: event.raw,
          byMessageId: true,
        });
        if (row) applied++;
        else ignored++;
        continue;
      }

      // `sent` carries no new information — the row is already SENT from the
      // send call — but it is applied anyway so `providerStatus` reflects the
      // provider's latest word.
      const row = await markProviderStatus({
        messageId: event.messageId,
        delivered: event.status === "delivered" || event.status === "read",
        // Meta does not re-send `delivered` before `read`; a read receipt
        // implies delivery, so both are set to keep the row coherent.
        read: event.status === "read",
        providerStatus: event.raw,
      });
      if (row) applied++;
      else ignored++;
    }

    return NextResponse.json({ ok: true, applied, ignored });
  } catch (err) {
    if (err instanceof DeliveryNotProvisionedError) {
      // 503 so the provider RETRIES — this is the one failure a retry fixes.
      return NextResponse.json({ error: DELIVERY_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}
