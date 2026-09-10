import { NextResponse } from "next/server";
import { confirmPayment } from "@/lib/payments/confirmPayment";
import {
  PAYMENT_NOT_PROVISIONED,
  PaymentNotProvisionedError,
} from "@/lib/payments/paymentStore";
import {
  isKnownProvider,
  verifyWebhookSignature,
} from "@/lib/payments/webhookVerifier";

// POST /api/payments/webhook/[provider]
//
// The ONLY unauthenticated path in the platform that can mark an order paid,
// and the signature is the whole of its authentication. See
// lib/payments/webhookVerifier.
//
// ── What the body may and may not decide ────────────────────────────────────
// The body names an order and a payment reference. It does NOT get to say
// which clinic the order belongs to, who the doctor is, or whether the order
// exists — every one of those is read from our own rows in confirmPayment. A
// webhook that names an unknown order changes nothing.
//
// The amount IS taken from the body, because it is the provider's statement of
// what was actually collected and we have no better source. It is recorded for
// reconciliation, never used to authorise anything: no code path compares it
// to the cart subtotal and refuses, because a partial payment is a commercial
// dispute for a human, not a 400 to a gateway that will retry it forever.
//
// ── Why duplicates answer 200 ───────────────────────────────────────────────
// Every gateway retries until it gets a 2xx. A duplicate is normal operation,
// so it is acknowledged as success — `outcome: "already_paid"` tells the
// operator what happened without asking the provider to keep trying. Returning
// 409 here would produce an unbounded retry storm against a working endpoint.

export const dynamic = "force-dynamic";

interface WebhookBody {
  kitOrderIntentId?: string;
  /** The provider's own payment id. Stored for reconciliation. */
  paymentId?: string;
  amountMinor?: number;
  event?: string;
}

/**
 * Provider event names that mean "money was captured".
 *
 * An allowlist, not a "not a failure" check: gateways emit authorisation,
 * capture, refund and dispute events on the same endpoint, and treating
 * anything unrecognised as a success is how an authorisation-only event —
 * money held, not taken — marks an order paid.
 */
const CAPTURED_EVENTS: ReadonlySet<string> = new Set([
  "payment.captured",
  "payment_captured",
  "payment.succeeded",
  "charge.succeeded",
  "payment_intent.succeeded",
]);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;

  if (!isKnownProvider(provider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  // Read once, as text. Re-serialising a parsed object changes byte order and
  // breaks every genuine signature — see verifyWebhookSignature.
  const rawBody = await req.text();

  const verdict = verifyWebhookSignature(provider, rawBody, req.headers);
  if (!verdict.ok) {
    // One status and one body for every rejection reason. A caller must not be
    // able to distinguish "this deployment has no secret for that provider"
    // from "your signature was wrong" — the first is a configuration fact
    // worth probing for.
    //
    // The reason is logged server-side, where an operator can see it, and is
    // deliberately not echoed.
    console.warn(`[payments] webhook rejected: ${provider} ${verdict.reason}`);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const event = body.event ?? "";
  if (!CAPTURED_EVENTS.has(event)) {
    // Acknowledged, not acted on. A 2xx stops the retry loop for an event this
    // endpoint has no opinion about; a 4xx would make the gateway redeliver a
    // refund notification indefinitely.
    return NextResponse.json({ ok: true, ignored: event || "unspecified" });
  }

  const kitOrderIntentId = body.kitOrderIntentId;
  if (!kitOrderIntentId || typeof kitOrderIntentId !== "string") {
    return NextResponse.json({ error: "missing_order" }, { status: 400 });
  }

  const amountMinor =
    typeof body.amountMinor === "number" && Number.isFinite(body.amountMinor)
      ? Math.round(body.amountMinor)
      : null;

  try {
    const result = await confirmPayment({
      kitOrderIntentId,
      source: "PROVIDER_WEBHOOK",
      amountMinor,
      provider,
      providerRef: typeof body.paymentId === "string" ? body.paymentId : null,
      // No human took this action; naming one would be a false attribution.
      recordedByDoctorId: null,
      actorId: null,
      actorType: "system",
      // A gateway callback is not scoped to a tenant — the order it names IS
      // the tenant, and that is read from our own row.
      requireClinicId: null,
    });

    if (!result.ok) {
      // Acknowledged rather than 4xx'd, for the retry-storm reason: none of
      // these are fixable by the gateway trying again, and a prober must not
      // be able to use this endpoint to test whether an order id exists.
      //
      // `reference_conflict` is the sharpest of them — the same payment id
      // arriving for a second order — and it is already audited by
      // confirmPayment, so an operator can reconcile it.
      console.warn(`[payments] webhook not applied: ${result.reason}`);
      return NextResponse.json({ ok: true, ignored: result.reason });
    }

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      fulfilmentCreated: result.fulfilmentCreated,
      // Which branch the order took. Surfaced so an operator reading a webhook
      // log can tell a patient-delivery order (no clinic request, correctly)
      // from a clinic order whose request failed to appear.
      mode: result.mode,
    });
  } catch (err) {
    if (err instanceof PaymentNotProvisionedError) {
      // 503, deliberately, so the gateway RETRIES. This is the one failure
      // here that a retry genuinely fixes: the migration gets applied and the
      // redelivered event lands correctly. Swallowing it as 200 would lose a
      // real payment.
      return NextResponse.json({ error: PAYMENT_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}
