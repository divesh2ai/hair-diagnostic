import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { confirmPayment } from "@/lib/payments/confirmPayment";
import {
  PAYMENT_NOT_PROVISIONED,
  PaymentNotProvisionedError,
} from "@/lib/payments/paymentStore";
import {
  FULFILMENT_NOT_PROVISIONED,
  FulfilmentNotProvisionedError,
} from "@/lib/fulfilment/fulfilmentStore";

// POST /api/doctor/orders/[intentId]/payment
//
// "The patient paid at the counter."
//
// ── Why this is an authoritative source and a browser is not ────────────────
// Wave-0 clinics collect by card, UPI or cash at the desk. That payment is
// real, and the only system that can witness it is a person at the clinic. So
// the authority here is the AUTHENTICATED CLINIC SESSION: a named doctor, in
// the clinic that owns the order, recording something they did. The row keeps
// their id, so the claim is attributable and reviewable.
//
// The contrast that matters is with the patient's browser. A `?paid=true`
// redirect, a client-side "payment succeeded" POST, or any state the patient's
// device asserts about itself would be a free-kit button. There is no endpoint
// in this application a patient can call that produces PAID —
// `KitOrderPaymentSource` has exactly two members and neither is reachable
// without a clinic session or a verified gateway signature.
//
// ── Tenant isolation ────────────────────────────────────────────────────────
// `requireClinicId` is passed down into confirmPayment, which compares it to
// the order's own clinicId before writing anything. A doctor cannot mark
// another clinic's order paid by guessing an intent id.

export const dynamic = "force-dynamic";

/** ₹5,00,000. A counter payment above this is a typo, not a sale. */
const MAX_AMOUNT_MINOR = 50_000_000;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ intentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, mode } = authResult;

  const { intentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    amountMinor?: number;
    reference?: string;
  };

  // Amount is optional — a clinic that has not configured pricing still needs
  // to be able to say "this was settled" — but a supplied amount must be sane.
  let amountMinor: number | null = null;
  if (body.amountMinor !== undefined && body.amountMinor !== null) {
    if (
      typeof body.amountMinor !== "number" ||
      !Number.isFinite(body.amountMinor) ||
      body.amountMinor < 0 ||
      body.amountMinor > MAX_AMOUNT_MINOR
    ) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }
    amountMinor = Math.round(body.amountMinor);
  }

  // Free text the clinic uses to tie this to their own till — a card terminal
  // reference, a UPI transaction id. Trimmed and bounded; never parsed.
  const reference =
    typeof body.reference === "string" && body.reference.trim().length > 0
      ? body.reference.trim().slice(0, 128)
      : null;

  try {
    const result = await confirmPayment({
      kitOrderIntentId: intentId,
      source: "CLINIC_COUNTER",
      amountMinor,
      provider: "clinic_counter",
      providerRef: reference,
      recordedByDoctorId: doctor.id,
      actorId: authUserId,
      actorType: mode,
      requireClinicId: doctor.clinicId,
    });

    if (!result.ok) {
      // A reused till reference is a real, actionable operator mistake, so it
      // is named — it says nothing about another tenant, unlike the two
      // below.
      if (result.reason === "reference_conflict") {
        return NextResponse.json(
          { error: "reference_already_used" },
          { status: 409 },
        );
      }
      // `order_not_found` and `cross_clinic` answer 404 with the SAME body. A
      // 403 on cross_clinic would confirm that an order with this id exists at
      // another clinic — the same concealment pattern the cart and
      // consultation routes already use.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      // The caller needs to be able to say "already recorded" rather than
      // showing a second success toast for a double-submitted form.
      outcome: result.outcome,
      payment: {
        status: result.payment.status,
        paidAt: result.payment.paidAt,
        amountMinor: result.payment.amountMinor,
      },
      fulfilment: result.fulfilment
        ? { id: result.fulfilment.id, status: result.fulfilment.status }
        : null,
      fulfilmentCreated: result.fulfilmentCreated,
      mode: result.mode,
    });
  } catch (err) {
    if (err instanceof PaymentNotProvisionedError) {
      return NextResponse.json({ error: PAYMENT_NOT_PROVISIONED }, { status: 503 });
    }
    if (err instanceof FulfilmentNotProvisionedError) {
      return NextResponse.json({ error: FULFILMENT_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}
