import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { resolveApprovedOrder } from "@/lib/consultation/approvedOrder";
import { newRequestId } from "@/lib/consultation/loadReview";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

// POST /api/cart/[assessmentId]/confirm — doctor-only.
//
// "Confirm Clinic Order" — the doctor signing off that the quantities on this
// order are final and the clinic should proceed with fulfilment. It is a
// confirmation of an order that has existed, as READY_FOR_FULFILMENT, since
// approval created it (see approveAndCreateOrder); no new KitOrderStatus is
// introduced for it, because the task that added this endpoint was told not
// to invent a migration for a state that already exists in substance. What
// this endpoint adds is the audit trail entry — proof of WHEN the doctor
// looked at the final quantities and said "ship this" — which the order
// itself carries no other record of.

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: code, message, requestId }, { status });
}

export async function POST(
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

  const approved = await resolveApprovedOrder(prisma, assessmentId);
  if (!approved) {
    return errorResponse(
      409,
      "NO_ACTIVE_ORDER",
      "No approved clinic order exists for this assessment yet.",
      requestId,
    );
  }

  await writeAuditLog({
    action: "CLINIC_ORDER_CONFIRMED",
    entityType: "KitOrderIntent",
    entityId: approved.intentId,
    actorId: authUserId,
    actorRole: authRole,
    actorType: mode,
    assessmentId,
    metadata: {
      clinicId: doctor.clinicId,
      actingDoctorId: doctor.id,
      kitIds: approved.kitIds,
      quantities: approved.quantities,
    },
  }).catch((err) => console.error("[cart.confirm] audit failed", err));

  return NextResponse.json({ ok: true, intentId: approved.intentId });
}
