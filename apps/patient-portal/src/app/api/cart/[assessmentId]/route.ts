import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceForKit, totalRevenueInr, formatInr } from "@/lib/pricing/kitPrices";
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

  const lineItems = intent.kitIds.map((kitId) => {
    const info = getKitInfo(kitId);
    return {
      kitId,
      displayName: info?.displayName ?? kitId,
      description: info?.treatmentObjective ?? null,
      quantity: 1,
      unitPriceInr: priceForKit(kitId),
      unitPriceLabel: formatInr(priceForKit(kitId)),
    };
  });
  const subtotal = totalRevenueInr(intent.kitIds);

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
    subtotalInr: subtotal,
    subtotalLabel: formatInr(subtotal),
  });
}
