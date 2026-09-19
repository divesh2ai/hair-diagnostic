import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordPatientOpen } from "@/lib/journey/events";
import { resolveCartCaller, loadCartData } from "@/lib/cart/loadCartData";

// GET /api/cart/[assessmentId] — token-gated.
//
// Returns the kit order intent belonging to the assessment's current approved
// consultation version, formatted for whichever caller is asking. The actual
// query lives in lib/cart/loadCartData, shared with the page's own server
// component so the doctor's preview and the patient's view can never disagree
// about which order this is.
//
// ── Access contract ─────────────────────────────────────────────────────────
// Two, and only two, callers may read this:
//
//   1. PATIENT — presents `?t=<cart token>` signed by the server and bound to
//      THIS assessment id. See lib/cartToken. No account, no login: the link
//      the doctor sends over WhatsApp carries its own authority.
//   2. DOCTOR — an authenticated session whose clinic owns the assessment.
//      This is what keeps the doctor-side clinic-order preview working, and
//      it is clinic-scoped, so it is not a way around tenant isolation.
//
// Everything else is a 404. The assessment cuid ALONE is no longer sufficient:
// it is an identifier, not a credential, and it previously returned the
// patient's name and phone to anyone holding it.
//
// Every rejection answers 404 with the same body as a genuine miss —
// deliberately, and for the same reason /api/consultation does it: a 401 or
// 403 here would confirm that an order exists for an assessment the caller
// cannot read, which is itself a disclosure about a patient.

export const dynamic = "force-dynamic";

const NOT_FOUND_BODY = {
  error: "no_active_order",
  message:
    "No confirmed plan yet — please wait for your doctor to approve your report.",
};

function notFound() {
  return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;
  const token = new URL(req.url).searchParams.get("t");

  const caller = await resolveCartCaller(assessmentId, token);
  if (caller.kind === "denied") return notFound();

  const cart = await loadCartData(prisma, assessmentId, caller);
  if (!cart) return notFound();

  // The patient actually saw their plan.
  //
  // Recorded here rather than inside loadCartData: that module is also called
  // from the page's server render, and a view recorded on every render (React
  // Strict Mode, a retry, a refresh) would overstate engagement. This route
  // fires once per actual client fetch. Awaited but never throwing — see
  // lib/journey/events.
  if (caller.kind === "patient") {
    await recordPatientOpen({
      assessmentId,
      subject: "CART",
      token: caller.token,
    });
  }

  return NextResponse.json(cart);
}
