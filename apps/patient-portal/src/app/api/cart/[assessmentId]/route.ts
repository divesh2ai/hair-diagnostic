import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInrFromMinor } from "@/lib/commerce/kitPricing";
import { evaluateOrderForPatientCharge } from "@/lib/commerce/sellability";
import { getKitInfo } from "@hairos/packages/registries/kits/info";

// GET /api/cart/[assessmentId] — public.
//
// Returns the most-recent active kit order intent tied to the assessment,
// formatted as a shopping cart (line items with prices). Consumed by the
// patient-facing /cart/[assessmentId] page so the doctor's approved plan
// can be reviewed and confirmed by the patient.
//
// Security note: assessment IDs are cuids and treated as bearer tokens for
// the demo. Production should sign these URLs (JWT or clinic-scoped token).
//
// ══ WHY PRICING HERE IS NOT `priceForKit` ═══════════════════════════════════
//
// This route used to quote `priceForKit(kitId)`, which is
// `KIT_PRICE_INR[kitId] ?? 5500`. Two things were wrong with that at the
// PATIENT boundary specifically:
//
//   - The fallback. An identifier the map did not know was quoted at Rs 5,500,
//     a figure that corresponds to no product and no price sheet. The governed
//     budget alternatives (M4+, F4+, PRO IMMUNE 1, STRESS BUST 3 …) are exactly
//     such identifiers — none of them is in KIT_PRICE_INR — so a doctor could
//     substitute a kit down to Rs 1,655 and the patient would be shown
//     Rs 5,500 for it.
//   - The name. `getKitInfo` normalises its argument, so an unconfirmed
//     identifier could render a similar-looking product's name beside that
//     invented price.
//
// Both are now decided by the same governance layer the doctor's substitution
// UI uses — `lib/commerce/sellability`, over `kitIdentity` + `kitPricing` — so
// there is ONE authoritative price outcome, and the doctor and the patient
// cannot be looking at different numbers for the same kit.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await ctx.params;

  const intent = await prisma.kitOrderIntent.findFirst({
    where: { assessmentId, status: "READY_FOR_FULFILMENT" },
    orderBy: { createdAt: "desc" },
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
  });

  if (!intent) {
    return NextResponse.json(
      { error: "no_active_order", message: "No confirmed plan yet — please wait for your doctor to approve your report." },
      { status: 404 },
    );
  }

  const commercial = evaluateOrderForPatientCharge(intent.kitIds);

  const lineItems = intent.kitIds.map((kitId, i) => {
    const decision = commercial.lines[i]!;

    // A product name is shown only once its commercial identity is approved.
    // An unresolved line keeps the raw prescribed identifier, so the patient
    // and the clinic are looking at the same string when they talk about it.
    const info = decision.canonicalKitId ? getKitInfo(decision.canonicalKitId) : null;

    const commercialState = decision.sellable
      ? ("CHARGEABLE" as const)
      : decision.reasons.includes("KIT_IDENTITY_REQUIRES_REVIEW")
        ? ("IDENTITY_REVIEW" as const)
        : decision.reasons.includes("KIT_NOT_IN_CATALOGUE")
          ? ("UNAVAILABLE" as const)
          : ("PRICE_PENDING" as const);

    // Null unless the line is genuinely chargeable. There is no fallback, no
    // default, and no PRICE_PRESENT figure dressed up as a price.
    const unitPriceMinor = decision.chargeableAmountMinor;

    return {
      kitId,
      sourceIdentifierSnapshot: decision.sourceIdentifierSnapshot,
      displayName: info?.displayName ?? null,
      description: info?.treatmentObjective ?? null,
      quantity: 1,
      commercialState,
      blockingReasons: decision.reasons,
      unitPriceMinor,
      unitPriceLabel: unitPriceMinor === null ? null : formatInrFromMinor(unitPriceMinor),
      lineTotalMinor: unitPriceMinor,
    };
  });

  // A part-priced cart is not a cart. A patient shown a subtotal reads it as
  // the price of everything in front of them, so if any line is not chargeable
  // there is no honest total to display — and therefore no total.
  const subtotalMinor = commercial.chargeable
    ? lineItems.reduce((sum, li) => sum + (li.lineTotalMinor ?? 0), 0)
    : null;

  return NextResponse.json({
    order: {
      id: intent.id,
      status: intent.status,
      createdAt: intent.createdAt.toISOString(),
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
    subtotalLabel: subtotalMinor === null ? null : formatInrFromMinor(subtotalMinor),
  });
}
