import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import {
  cancelAppointment,
  AppointmentsNotProvisionedError,
  APPOINTMENTS_NOT_PROVISIONED,
} from "@/lib/doctor/appointments";

export const dynamic = "force-dynamic";

// Cancel a booking.
//
// A named action rather than DELETE, because nothing is deleted: the row moves
// to CANCELLED and keeps its place in the day. A clinic that held an afternoon
// and released it should read as exactly that, not as an afternoon nobody ever
// booked.
//
// Clinic scoping is enforced inside the UPDATE's WHERE clause (see
// lib/doctor/appointments), so an id from another clinic matches nothing and
// comes back as a 404 — the same answer as an id that does not exist.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const cancelled = await cancelAppointment({ id, clinicId: doctor.clinicId });
    if (!cancelled) {
      // Unknown id, another clinic's id, or already cancelled. All three are
      // "there is no scheduled appointment here for you to cancel".
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppointmentsNotProvisionedError) {
      console.error("[DOCTOR APPOINTMENT CANCEL]", err.message);
      return NextResponse.json(
        { error: "unavailable", reason: APPOINTMENTS_NOT_PROVISIONED },
        { status: 503 },
      );
    }
    console.error("[DOCTOR APPOINTMENT CANCEL]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
