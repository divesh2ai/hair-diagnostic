import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCartToken } from "@/lib/cartToken";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { evaluateOrderForPatientCharge } from "@/lib/commerce/sellability";
import {
  PAYMENT_NOT_PROVISIONED,
  PaymentNotProvisionedError,
  startCheckout,
} from "@/lib/payments/paymentStore";

// POST /api/cart/[assessmentId]/checkout?t=<cart token>
//
// "The patient has begun paying."
//
// ══ WHAT THIS CAN AND CANNOT DO ═════════════════════════════════════════════
//
// It writes PENDING and a `checkoutStartedAt`, and that is the entire extent of
// its power. There is no argument it accepts, and no code path from it, that
// produces PAID — that transition lives in `markPaid`, which is only reachable
// from a signature-verified gateway callback or an authenticated clinic
// session (see KitOrderPaymentSource, which has exactly those two members).
//
// This distinction is the reason a patient-callable checkout endpoint is safe
// to have at all. The naive version of this feature — a browser POSTing
// "payment complete", or a `?paid=true` redirect the server trusts — is a free
// kits button. So the endpoint that the patient CAN call is deliberately the
// one that records intent, and the endpoints that record money are the ones
// they cannot reach.
//
// The worst a hostile caller with a valid token can do here is repeatedly
// assert that they are looking at their own checkout page, which is what the
// endpoint is for. `startCheckout` keeps the FIRST timestamp via COALESCE, so
// they cannot even reset the abandoned-cart clock ops follows up on.
//
// ══ ACCESS ═════════════════════════════════════════════════════════════════
// Token only — no doctor-session fallback, unlike the cart READ. A doctor
// previewing a cart is not starting a checkout, and letting a session through
// here would let a doctor's own verification click start the patient's payment
// clock. Same 404-for-everything concealment as the read endpoint.

export const dynamic = "force-dynamic";

const NOT_FOUND_BODY = {
  error: "no_active_order",
  message:
    "No confirmed plan yet — please wait for your doctor to approve your report.",
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;

  const token = new URL(req.url).searchParams.get("t");
  if (!token) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });

  const verdict = verifyCartToken(token, assessmentId);
  if (!verdict.ok) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });

  // Resolved through the same function the cart read uses, so "there is a
  // checkout to start" cannot disagree with "there is a cart to show".
  const approved = await resolveApprovedOrder(prisma, assessmentId);
  if (!approved) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });

  // Commercial gate. The cart read already refuses to show a total for an
  // order with a non-chargeable line, but a UI that declines to render a
  // button is not a control — this endpoint is reachable directly with a
  // valid token. Monetary progression stops here too, on the same decision.
  const commercial = evaluateOrderForPatientCharge(approved.kitIds);
  if (!commercial.chargeable) {
    return NextResponse.json(
      {
        error: "ORDER_NOT_CHARGEABLE",
        // Internal reason codes, safe to surface: they name a state, never a
        // price. The clinic needs them to know what to fix.
        reasons: commercial.blockingReasons,
      },
      { status: 409 },
    );
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!assessment) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });

  try {
    const payment = await startCheckout({
      kitOrderIntentId: approved.intentId,
      clinicId: assessment.clinicId,
      assessmentId,
      // Deliberately null. The amount a patient owes is derived from the kit
      // registry and price table at read time, and quoting it back from a
      // patient-triggered write would put a number the browser was involved in
      // onto a commercial row. The authoritative amount arrives with the
      // payment confirmation, from the gateway or the clinic.
      amountMinor: null,
    });

    return NextResponse.json({
      ok: true,
      status: payment.status,
      checkoutStartedAt: payment.checkoutStartedAt,
    });
  } catch (err) {
    if (err instanceof PaymentNotProvisionedError) {
      // 503 with a reason code. The patient's cart page treats this as "carry
      // on" rather than an error — being unable to RECORD that a checkout
      // started must not stop the patient from checking out.
      return NextResponse.json({ error: PAYMENT_NOT_PROVISIONED }, { status: 503 });
    }
    throw err;
  }
}
