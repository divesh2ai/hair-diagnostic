import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  FULFILMENT_NOT_PROVISIONED,
  FulfilmentNotProvisionedError,
  readFulfilmentByIntent,
  readFulfilmentMode,
  setFulfilmentMode,
} from "@/lib/fulfilment/fulfilmentStore";
import { parseFulfilmentMode } from "@/lib/fulfilment/newOrderMode";

// PUT /api/doctor/orders/[intentId]/fulfilment-mode   { "mode": "PATIENT" }
//
// The per-order override of the clinic's default destination.
//
// ── Why an override exists at all ───────────────────────────────────────────
// The clinic setting covers the arrangement; this covers the exception — a
// patient who cannot come back to collect, a clinic out of stock of one kit.
// Without it the only way to change one order would be to change the clinic
// default, which would silently move every subsequent order too.
//
// ── The window in which it may be used ──────────────────────────────────────
// Before fulfilment starts, and not after. Once a `ClinicKitFulfilment` row
// exists, ops has been told to pack a box for a destination; flipping the
// order to PATIENT at that point would leave a live request nobody owns and a
// journey that contradicts itself. The refusal is explicit rather than a
// silent no-op, so the doctor learns they need to ring ops instead.
//
// ── Enum safety ─────────────────────────────────────────────────────────────
// The body is a browser string. `parseFulfilmentMode` admits exactly two
// literals; anything else is 400 before a value can reach a
// `::"KitFulfilmentMode"` cast.

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ intentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode: actorMode } = authResult;

  const { intentId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { mode?: unknown };
  const mode = parseFulfilmentMode(body.mode);
  if (!mode) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  try {
    // Fulfilment already under way is a hard stop — checked before the write,
    // and the write is separately clinic-scoped, so a race that slipped past
    // this check still could not touch another tenant's order.
    const existing = await readFulfilmentByIntent(intentId);
    if (existing) {
      return NextResponse.json(
        {
          error: "fulfilment_already_started",
          status: existing.status,
        },
        { status: 409 },
      );
    }

    const previous = await readFulfilmentMode(intentId);

    const { updated } = await setFulfilmentMode({
      kitOrderIntentId: intentId,
      mode,
      // Tenant scope is part of the UPDATE's WHERE clause, not a prior read.
      requireClinicId: doctor.clinicId,
    });

    if (!updated) {
      // Unknown order, or another clinic's. Same 404 for both — a 403 would
      // confirm the order exists elsewhere.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await writeAuditLog({
      action: "KIT_ORDER_FULFILMENT_MODE_SET",
      entityType: "KitOrderIntent",
      entityId: intentId,
      clinicId: doctor.clinicId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: actorMode,
      // Commercial routing only — no patient, no clinical content.
      metadata: {
        from: previous ?? null,
        to: mode,
        actingDoctorId: doctor.id,
      },
    });

    return NextResponse.json({ ok: true, mode });
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
