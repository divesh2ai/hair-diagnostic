import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { zonedWallTimeToUtc } from "@/lib/format/clinicDay";
import {
  createAppointment,
  AppointmentsNotProvisionedError,
  APPOINTMENTS_NOT_PROVISIONED,
} from "@/lib/doctor/appointments";

export const dynamic = "force-dynamic";

// Book a future visit for an existing patient.
//
// ── The time the doctor typed is clinic wall-clock time ─────────────────────
// The client sends `date` + `time` as the doctor read them off the booking
// form — "2026-09-15", "14:30" — and never an instant. Letting the browser
// build a Date would silently record the DOCTOR'S timezone: a clinician
// booking from another country would put the patient in the chair at the
// wrong hour, and nothing in the data would show why. The clinic's own
// timezone converts it, on the server, once.
//
// ── Reads are on /api/doctor/calendar ───────────────────────────────────────
// There is no GET here. The calendar already returns a month of appointments
// alongside that month's assessments, and the patient list carries each
// patient's next booking. A third read path would be a third place for
// "which appointments exist" to drift.

/** Bounds on a consultation slot. Wide on purpose — clinics differ. */
const MIN_MINUTES = 5;
const MAX_MINUTES = 240;
const REASON_MAX = 120;
const NOTES_MAX = 1000;

/** How far ahead a booking may be made. Beyond this it is almost always a typo. */
const MAX_MONTHS_AHEAD = 24;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function bad(reason: string) {
  return NextResponse.json({ error: "bad_request", reason }, { status: 400 });
}

export async function POST(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("body must be JSON");
  }

  const patientId = typeof body.patientId === "string" ? body.patientId : "";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const durationMinutes =
    typeof body.durationMinutes === "number" ? body.durationMinutes : 20;
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, REASON_MAX)
      : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, NOTES_MAX)
      : null;

  if (!patientId) return bad("patientId is required");
  if (!DATE_RE.test(date)) return bad("date must be YYYY-MM-DD");
  if (!TIME_RE.test(time)) return bad("time must be HH:MM (24h)");
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MIN_MINUTES ||
    durationMinutes > MAX_MINUTES
  ) {
    return bad(`durationMinutes must be ${MIN_MINUTES}–${MAX_MINUTES}`);
  }

  try {
    // Patient must exist and belong to the caller's clinic. Same 404 for
    // "missing" and "other clinic", matching /api/doctor/patients/[id] — a
    // different response would confirm that an id exists elsewhere.
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, clinicId: true, deletedAt: true },
    });
    if (!patient || patient.deletedAt) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (assertDoctorInClinic(doctor, patient.clinicId)) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: doctor.clinicId },
      select: { timezone: true },
    });
    const timeZone = clinic?.timezone || "Asia/Kolkata";

    const scheduledAt = zonedWallTimeToUtc(date, time, timeZone);
    if (Number.isNaN(scheduledAt.getTime())) return bad("unparseable date/time");

    // Future only. This endpoint books; it does not backfill attendance
    // history, and a past "appointment" would render on the calendar as
    // something the clinic still expects to happen.
    if (scheduledAt.getTime() <= Date.now()) {
      return bad("appointment must be in the future");
    }
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + MAX_MONTHS_AHEAD);
    if (scheduledAt > horizon) {
      return bad(`appointment must be within ${MAX_MONTHS_AHEAD} months`);
    }

    const appointment = await createAppointment({
      clinicId: doctor.clinicId,
      patientId,
      // Booked with the doctor doing the booking. A "book for a colleague"
      // picker needs a roster UI and a conflict rule, neither of which has
      // been designed; defaulting to someone else silently would be worse
      // than not offering it.
      doctorId: doctor.id,
      scheduledAt,
      durationMinutes,
      reason,
      notes,
      createdByDoctorId: doctor.id,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    if (err instanceof AppointmentsNotProvisionedError) {
      console.error("[DOCTOR APPOINTMENTS API]", err.message);
      return NextResponse.json(
        { error: "unavailable", reason: APPOINTMENTS_NOT_PROVISIONED },
        { status: 503 },
      );
    }
    console.error("[DOCTOR APPOINTMENTS API]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
