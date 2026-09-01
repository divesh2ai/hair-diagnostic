import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  FULFILMENT_NOT_PROVISIONED,
  FulfilmentNotProvisionedError,
  transitionFulfilment,
} from "@/lib/fulfilment/fulfilmentStore";
import {
  isFulfilmentStatus,
  type FulfilmentStatus,
} from "@/lib/fulfilment/stateMachine";

// POST /api/admin/fulfilment/[id]/transition   { "to": "PACKED", "notes": "…" }
//
// The ops side of the fulfilment state machine. Super Admin only.
//
// ── Why the browser cannot set a state directly ─────────────────────────────
// There is no "update fulfilment" endpoint that takes a status and writes it.
// This route accepts a TARGET and asks the state machine whether the move is
// legal from wherever the row actually is, then performs it as a conditional
// UPDATE guarded on the current status. A client that posts
// `{ to: "DELIVERED" }` at a REQUESTED row is refused with the moves that
// were available instead — it cannot skip CONFIRMED, PACKED and DISPATCHED,
// and it cannot walk a row backwards to re-open a closed case.
//
// ── ACKNOWLEDGED is not available here ──────────────────────────────────────
// "The clinic received the box" is a statement only the clinic can truthfully
// make, so it lives on the doctor-side endpoint
// (/api/doctor/fulfilment/[id]/acknowledge) and is refused here. An ops user
// who can close their own delivery loop is an ops user whose delivery
// confirmations mean nothing.

export const dynamic = "force-dynamic";

/** Everything ops may drive. Deliberately excludes ACKNOWLEDGED. */
const OPS_TRANSITIONS: ReadonlySet<FulfilmentStatus> = new Set<FulfilmentStatus>([
  "CONFIRMED",
  "PACKED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
]);

const MAX_NOTES = 500;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await assertSuperAdmin();
  } catch (err) {
    const response = handleAuthError(err);
    if (response) return response;
    throw err;
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    notes?: string;
  };

  if (!isFulfilmentStatus(body.to)) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  const to = body.to;

  if (!OPS_TRANSITIONS.has(to)) {
    return NextResponse.json(
      { error: "forbidden_target", reason: "clinic_owned_transition" },
      { status: 403 },
    );
  }

  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, MAX_NOTES)
      : null;

  try {
    const result = await transitionFulfilment({ id, to, notes });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (result.reason === "conflict") {
        // Someone else moved this row between our read and our write. 409 and
        // the state we saw, so the operator refreshes rather than retrying
        // into the same race.
        return NextResponse.json(
          { error: "conflict", from: result.from },
          { status: 409 },
        );
      }

      // A rejected transition is audited. An operator repeatedly trying to
      // skip a step is a process problem worth being able to see, and a
      // rejection that leaves no trace is invisible to everyone except the
      // person who hit it.
      await writeAuditLog({
        action: "KIT_FULFILMENT_TRANSITION_REJECTED",
        entityType: "ClinicKitFulfilment",
        entityId: id,
        actorId: actor.userId,
        actorRole: actor.role,
        actorType: "admin",
        metadata: { from: result.from, attempted: to, reason: result.reason },
      }).catch(() => {
        /* never fail a refusal because its audit row could not be written */
      });

      return NextResponse.json(
        {
          error: "illegal_transition",
          from: result.from,
          attempted: to,
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
      actorId: actor.userId,
      actorRole: actor.role,
      actorType: "admin",
      // Previous state, new state, actor and time — the four facts PART 9 asks
      // for, on the platform's existing audit table rather than in a bespoke
      // transition log that would duplicate it.
      metadata: {
        from: result.from,
        to: result.fulfilment.status,
        kitOrderIntentId: result.fulfilment.kitOrderIntentId,
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
