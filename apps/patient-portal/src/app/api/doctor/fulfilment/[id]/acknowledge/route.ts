import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  FULFILMENT_NOT_PROVISIONED,
  FulfilmentNotProvisionedError,
  transitionFulfilment,
} from "@/lib/fulfilment/fulfilmentStore";

// POST /api/doctor/fulfilment/[id]/acknowledge   { "notes": "…" }
//
// The clinic confirming a delivery physically arrived.
//
// ── Why the clinic and not Ops owns this ────────────────────────────────────
// Ops can say a box left the building; only the clinic can say one arrived.
// Letting an ops user mark their own delivery ACKNOWLEDGED would make the
// state a restatement of DISPATCHED — the loop would close itself, and the
// action centre's "deliveries awaiting clinic acknowledgement" group would
// never contain anything. So the ops endpoint refuses this target and this
// endpoint accepts nothing else.
//
// ── Tenant isolation is in the same statement as the write ──────────────────
// `requireClinicId` is passed into transitionFulfilment, which folds it into
// the lookup rather than checking it in a separate read the next edit could
// drop. A doctor guessing another clinic's fulfilment id gets 404, not 403 —
// a 403 would confirm the row exists somewhere.

export const dynamic = "force-dynamic";

const MAX_NOTES = 500;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode } = authResult;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { notes?: string };
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, MAX_NOTES)
      : null;

  try {
    const result = await transitionFulfilment({
      id,
      to: "ACKNOWLEDGED",
      acknowledgedByDoctorId: doctor.id,
      notes,
      requireClinicId: doctor.clinicId,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (result.reason === "conflict") {
        return NextResponse.json(
          { error: "conflict", from: result.from },
          { status: 409 },
        );
      }
      // The realistic case: the clinic is trying to confirm receipt of
      // something ops has not marked DELIVERED yet. Saying so — with the
      // current state — is more useful than a bare refusal, and it is the
      // clinic's own record so there is nothing to conceal.
      return NextResponse.json(
        {
          error: "illegal_transition",
          from: result.from,
          attempted: "ACKNOWLEDGED",
          allowed: result.allowed,
        },
        { status: 409 },
      );
    }

    await writeAuditLog({
      action: "KIT_FULFILMENT_STATE_CHANGED",
      entityType: "ClinicKitFulfilment",
      entityId: result.fulfilment.id,
      assessmentId: result.fulfilment.assessmentId,
      clinicId: result.fulfilment.clinicId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: mode,
      metadata: {
        from: result.from,
        to: result.fulfilment.status,
        kitOrderIntentId: result.fulfilment.kitOrderIntentId,
        acknowledgedByDoctorId: doctor.id,
      },
    });

    return NextResponse.json({ ok: true, fulfilment: result.fulfilment });
  } catch (err) {
    if (err instanceof FulfilmentNotProvisionedError) {
      return NextResponse.json(
        { error: FULFILMENT_NOT_PROVISIONED },
        { status: 503 },
      );
    }
    throw err;
  }
}
