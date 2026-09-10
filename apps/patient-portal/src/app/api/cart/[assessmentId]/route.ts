import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInr } from "@/lib/pricing/kitPrices";
import { evaluateOrderForPatientCharge } from "@/lib/commerce/sellability";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { verifyCartToken } from "@/lib/cartToken";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { recordPatientOpen } from "@/lib/journey/events";

// GET /api/cart/[assessmentId] — token-gated.
//
// Returns the kit order intent belonging to the assessment's current approved
// consultation version, formatted as a shopping cart (line items with prices).
// Consumed by the patient-facing /cart/[assessmentId] page so the doctor's
// approved plan can be reviewed and confirmed by the patient.
//
// ── Access contract ─────────────────────────────────────────────────────────
// Two, and only two, callers may read this:
//
//   1. PATIENT — presents `?t=<cart token>` signed by the server and bound to
//      THIS assessment id. See lib/cartToken. No account, no login: the link
//      the doctor sends over WhatsApp carries its own authority.
//   2. DOCTOR — an authenticated session whose clinic owns the assessment.
//      This is what keeps the doctor-side cart preview working, and it is
//      clinic-scoped, so it is not a way around tenant isolation.
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

/**
 * Which caller this is — not merely whether they are allowed in.
 *
 * ── Why the answer is no longer a boolean ───────────────────────────────────
 * The two authorised callers are now materially different downstream: a
 * patient opening their cart is an engagement event the doctor's journey view
 * reports as "patient viewed cart", and a doctor opening their own preview is
 * not. A boolean forces the caller to guess which happened, and the guess that
 * gets written is "someone looked at it" — which is how a doctor's own
 * verification click ends up displayed to that doctor as proof the patient
 * has seen the plan.
 *
 * Token first: it is the patient path, it is the common case, and it costs no
 * database round trip. The doctor-session fallback is only consulted when
 * there is no usable token, so a doctor previewing the cart still works while
 * an anonymous caller never triggers an auth lookup.
 */
type CartCaller =
  | { kind: "patient"; token: string }
  | { kind: "doctor" }
  | { kind: "denied" };

async function resolveCaller(
  req: Request,
  assessmentId: string,
): Promise<CartCaller> {
  const token = new URL(req.url).searchParams.get("t");
  if (token) {
    const verdict = verifyCartToken(token, assessmentId);
    if (verdict.ok) return { kind: "patient", token };
    // A present-but-invalid token is never upgraded to a session check —
    // falling through would let a bad token probe for a doctor session.
    return { kind: "denied" };
  }

  try {
    const authResult = await requireDoctorContext();
    if (authResult instanceof NextResponse) return { kind: "denied" };
    const { doctor } = authResult;
    const target = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { clinicId: true },
    });
    if (!target) return { kind: "denied" };
    // assertDoctorInClinic returns truthy when the doctor is OUTSIDE the
    // clinic — same polarity the consultation routes rely on.
    return assertDoctorInClinic(doctor, target.clinicId)
      ? { kind: "denied" }
      : { kind: "doctor" };
  } catch {
    return { kind: "denied" };
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;

  const caller = await resolveCaller(req, assessmentId);
  if (caller.kind === "denied") {
    return notFound();
  }

  // WHICH ORDER — resolved by version identity, shared with the doctor review.
  //
  // This used to be `findFirst({ assessmentId, status: READY }, orderBy:
  // createdAt desc)`: "the newest matching row". The doctor's review page
  // answered the same question with a DIFFERENT query, so on any assessment
  // carrying more than one intent the two surfaces could name different
  // orders. resolveApprovedOrder is now the single answer for both — see
  // lib/consultation/approvedOrder for why version identity is exact and
  // recency is not.
  const approved = await resolveApprovedOrder(prisma, assessmentId);

  const intent = approved
    ? await prisma.kitOrderIntent.findUnique({
        where: { id: approved.intentId },
        select: {
          id: true,
          kitIds: true,
          createdAt: true,
          status: true,
          assessment: {
            select: {
              id: true,
              patient: { select: { name: true, phone: true } },
            },
          },
          clinic: {
            select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true },
          },
          doctor: {
            select: { name: true, specialization: true, avatarUrl: true, photoUrl: true },
          },
        },
      })
    : null;

  if (!intent || !approved) {
    return notFound();
  }

  // The patient actually saw their cart.
  //
  // Recorded here rather than at the top of the handler, and only for the
  // patient caller: an event written before the order resolved would claim a
  // view of a cart that then answered "no confirmed plan yet", and one written
  // for a doctor session would report the doctor's own preview click back to
  // them as patient engagement. Awaited but never throwing — see
  // lib/journey/events.
  if (caller.kind === "patient") {
    await recordPatientOpen({
      assessmentId,
      subject: "CART",
      token: caller.token,
    });
  }

  // The LINEUP is a snapshot: `intent.kitIds` was frozen at approval and is
  // never recomputed from the assessment or the recommendation engine.
  //
  // Names, objectives and prices are NOT snapshotted — they resolve against
  // the current kit registry and price table on every read. That is a
  // deliberate limit of the existing schema, not something introduced here:
  // a price change moves this cart, and it moves the doctor's preview by the
  // same amount at the same moment, because both render this one response.
  //
  // Quantity prefers the persisted map and falls back to 1. In practice the
  // map is always null — approveAndCreateOrder writes Prisma.JsonNull on every
  // intent — so this is forward-compatibility, not a live feature.
  const qtyFor = (kitId: string) => approved.quantities?.[kitId] ?? 1;

  // Commercial identity and price are decided by the governance layer, never
  // by the clinical registry and never by `priceForKit`.
  //
  // Both of the things this replaces were actively wrong for a patient:
  //   - `getKitInfo` normalises its argument, so "PRO FACT META B PCOS"
  //     resolved to the vegetarian PCOS kit — a product nobody approved for
  //     that prescription.
  //   - `priceForKit` is `KIT_PRICE_INR[id] ?? 5500`, so any identifier the
  //     map did not know was quoted at a figure that came from nowhere. That
  //     was 16 of the 28 kit lines actually on file.
  //
  // Both are now out of this path entirely.
  const commercial = evaluateOrderForPatientCharge(intent.kitIds);

  const lineItems = intent.kitIds.map((kitId, i) => {
    const decision = commercial.lines[i]!;
    const quantity = qtyFor(kitId);

    // A product name is shown only once its commercial identity is approved.
    // An unresolved line deliberately has no display name: it keeps the raw
    // prescribed identifier, so the patient and the clinic are looking at the
    // same string when they talk about it.
    const info = decision.canonicalKitId ? getKitInfo(decision.canonicalKitId) : null;

    const commercialState = decision.sellable
      ? ("CHARGEABLE" as const)
      : decision.reasons.includes("KIT_IDENTITY_REQUIRES_REVIEW")
        ? ("IDENTITY_REVIEW" as const)
        : decision.reasons.includes("KIT_NOT_IN_CATALOGUE")
          ? ("UNAVAILABLE" as const)
          : ("PRICE_PENDING" as const);

    // Null unless the line is genuinely chargeable. There is no fallback,
    // no default, and no PRICE_PRESENT figure dressed up as a price.
    const unitPriceMinor = decision.chargeableAmountMinor;

    return {
      kitId,
      // The identifier exactly as the clinical system supplied it. Never
      // overwritten with the canonical form.
      sourceIdentifierSnapshot: decision.sourceIdentifierSnapshot,
      displayName: info?.displayName ?? null,
      description: info?.treatmentObjective ?? null,
      quantity,
      commercialState,
      blockingReasons: decision.reasons,
      unitPriceMinor,
      unitPriceLabel:
        unitPriceMinor === null ? null : formatInr(unitPriceMinor / 100),
      lineTotalMinor:
        unitPriceMinor === null ? null : unitPriceMinor * quantity,
    };
  });

  // A part-priced cart is not a cart. A patient shown a subtotal reads it as
  // the price of everything in front of them, so if any line is not
  // chargeable there is no honest total to display — and therefore no total.
  const subtotalMinor = commercial.chargeable
    ? lineItems.reduce((sum, li) => sum + (li.lineTotalMinor ?? 0), 0)
    : null;

  return NextResponse.json({
    order: {
      id: intent.id,
      status: intent.status,
      createdAt: intent.createdAt.toISOString(),
      // Order identity, echoed so the doctor's preview and this cart can be
      // PROVEN to be the same snapshot rather than assumed to be.
      consultationVersionId: approved.consultationVersionId,
      contentVersion: approved.contentVersion,
    },
    patient: intent.assessment?.patient
      ? { name: intent.assessment.patient.name, phone: intent.assessment.patient.phone }
      : null,
    clinic: intent.clinic
      ? {
          name: intent.clinic.name,
          slug: intent.clinic.slug,
          logoUrl: intent.clinic.logoUrl,
          primaryColor: intent.clinic.primaryColor,
        }
      : null,
    doctor: intent.doctor
      ? {
          name: intent.doctor.name,
          specialization: intent.doctor.specialization,
          photoUrl: intent.doctor.avatarUrl ?? intent.doctor.photoUrl ?? null,
        }
      : null,
    lineItems,
    // The single flag the patient UI gates monetary progression on. False
    // whenever any line is unresolved, unavailable, or priced but unapproved.
    chargeable: commercial.chargeable,
    blockingReasons: commercial.blockingReasons,
    subtotalMinor,
    subtotalLabel: subtotalMinor === null ? null : formatInr(subtotalMinor / 100),
  });
}
