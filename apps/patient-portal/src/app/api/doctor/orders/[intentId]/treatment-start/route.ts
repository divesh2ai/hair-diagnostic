import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  FULFILMENT_NOT_PROVISIONED,
  FulfilmentNotProvisionedError,
  recordTreatmentStart,
} from "@/lib/fulfilment/fulfilmentStore";

// POST /api/doctor/orders/[intentId]/treatment-start   { "startedAt": "2026-09-01" }
//
// Records the day the patient actually began the protocol.
//
// ══ THE CONTRACT ════════════════════════════════════════════════════════════
//
// This value is the anchor every future follow-up will be measured from — Day
// 30, Day 60, Day 90 — so it is worth being precise about what it is NOT.
//
// It is not the assessment date: the patient had no kits then.
// It is not the approval date: approval is a clinical decision, not a dose.
// It is not the payment date: paying on Friday and collecting on Tuesday is
//   the normal shape of a clinic-supplied order.
// It is not the delivery date: stock reaching the clinic is not the patient
//   opening a bottle, and for a clinic-supplied kit those are days apart.
//
// Every one of those is available and every one of them would be wrong, which
// is exactly why the column exists and is nullable rather than derived. A
// derived start date produces follow-up prompts that are silently early or
// late for every patient, and nothing in the data would ever reveal it.
//
// So: a human states it. NULL means "not started", which is a true and useful
// state — and the follow-up scheduling this eventually feeds must treat it
// that way rather than substituting a proxy.
//
// ══ WHAT THIS PHASE DOES NOT DO ═════════════════════════════════════════════
// No follow-up questionnaire, no scheduling, no reminders. This establishes
// the anchor and nothing more; PART 16 is deliberately preparation only.

export const dynamic = "force-dynamic";

/**
 * How far back a start date may be placed.
 *
 * A clinician recording a start a week or two after the fact is ordinary; one
 * recording it six months back is either a typo or a data-migration attempt,
 * and both should be refused rather than silently anchoring a follow-up
 * schedule that is already expired.
 */
const MAX_BACKDATE_DAYS = 90;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ intentId: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor, authUserId, authRole, mode } = authResult;

  const { intentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { startedAt?: string };

  // Defaults to now. A clinician handing the kit over and pressing the button
  // in the same minute should not have to type a date.
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const now = Date.now();
  // A future start date is refused outright rather than clamped. "Treatment
  // started" is a statement about something that has happened; clamping a
  // typo'd 2027 to today would record a fact the clinician did not assert.
  if (startedAt.getTime() > now + 60_000) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }
  if (startedAt.getTime() < now - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "too_far_back" }, { status: 400 });
  }

  try {
    const result = await recordTreatmentStart({
      kitOrderIntentId: intentId,
      // Tenant scope is part of the UPDATE's WHERE clause, not a prior read —
      // a doctor cannot anchor another clinic's order by guessing its id.
      clinicId: doctor.clinicId,
      startedAt,
      doctorId: doctor.id,
      source: "DOCTOR_RECORDED",
    });

    if (!result.ok) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (result.alreadyRecorded) {
      // Not an error, and deliberately not an overwrite. Other things will be
      // anchored to this date; moving it silently on a second click would
      // shift a follow-up schedule with no record that it happened. Changing a
      // recorded start is not possible through this path at all.
      return NextResponse.json({
        ok: true,
        alreadyRecorded: true,
        startedAt: result.startedAt,
      });
    }

    await writeAuditLog({
      action: "TREATMENT_START_RECORDED",
      entityType: "KitOrderIntent",
      entityId: intentId,
      clinicId: doctor.clinicId,
      actorId: authUserId,
      actorRole: authRole,
      actorType: mode,
      metadata: {
        startedAt: result.startedAt,
        source: "DOCTOR_RECORDED",
        actingDoctorId: doctor.id,
      },
    });

    return NextResponse.json({
      ok: true,
      alreadyRecorded: false,
      startedAt: result.startedAt,
    });
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
