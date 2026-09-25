import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { newRequestId } from "@/lib/consultation/loadReview";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

// PATCH /api/cart/[assessmentId]/quantity — doctor-only.
//
// Sets the CLINIC ORDER quantity for one kit in the doctor's approved order.
// This is an ordering fact, not a clinical one: KitOrderIntent.kitIds — the
// approved prescription — is never touched here, only KitOrderIntent.quantities,
// the sibling column that already exists for exactly this (see
// lib/consultation/approvedOrder's header on why it has sat unused). Ordering
// two boxes of a 1-month protocol does not silently rewrite it into a 2-month
// protocol; the consultation this order was cut from stays exactly what the
// doctor approved.
//
// Doctor-only, clinic-scoped: a patient's cart token grants READ, never write
// — quantity is the clinic's ordering decision, not the patient's.

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: code, message, requestId }, { status });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = newRequestId();
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) {
    const code = authResult.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
    return errorResponse(authResult.status, code, "Not authorised.", requestId);
  }
  const { doctor, authUserId, authRole, mode } = authResult;
  const { assessmentId } = await ctx.params;

  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) {
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", "This assessment is no longer available.", requestId);
  }
  if (assertDoctorInClinic(doctor, target.clinicId)) {
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", "This assessment is no longer available.", requestId);
  }

  const body = (await req.json().catch(() => ({}))) as {
    kitId?: unknown;
    quantity?: unknown;
  };
  const kitId = typeof body.kitId === "string" ? body.kitId : "";
  const quantity = typeof body.quantity === "number" ? body.quantity : NaN;

  // Integer, at least 1. A clinic order line with zero or negative units is
  // not a smaller order — that is what removing the kit from the approved
  // lineup means, and that is a clinical edit made in the review page, not
  // here.
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return errorResponse(
      400,
      "INVALID_QUANTITY",
      "Quantity must be a whole number between 1 and 99.",
      requestId,
    );
  }

  const approved = await resolveApprovedOrder(prisma, assessmentId);
  if (!approved) {
    return errorResponse(
      409,
      "NO_ACTIVE_ORDER",
      "No approved clinic order exists for this assessment yet.",
      requestId,
    );
  }
  if (!approved.kitIds.includes(kitId)) {
    return errorResponse(
      400,
      "KIT_NOT_IN_ORDER",
      "That kit is not in the current approved order.",
      requestId,
    );
  }

  // Merge into the existing map rather than replace it — a quantity set on
  // one line must not silently reset every other line back to the fallback
  // of 1.
  const nextQuantities: Record<string, number> = {
    ...(approved.quantities ?? {}),
    [kitId]: quantity,
  };

  await prisma.kitOrderIntent.update({
    where: { id: approved.intentId },
    data: { quantities: nextQuantities },
  });

  await writeAuditLog({
    action: "CLINIC_ORDER_QUANTITY_UPDATED",
    entityType: "KitOrderIntent",
    entityId: approved.intentId,
    actorId: authUserId,
    actorRole: authRole,
    actorType: mode,
    assessmentId,
    metadata: {
      clinicId: doctor.clinicId,
      actingDoctorId: doctor.id,
      kitId,
      quantity,
    },
  }).catch((err) => console.error("[cart.quantity] audit failed", err));

  return NextResponse.json({ ok: true, kitId, quantity });
}
