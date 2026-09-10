import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import {
  EMPTY_DASHBOARD_COUNTS,
  loadDashboardStats,
} from "@/lib/doctor/dashboardStats";

export const dynamic = "force-dynamic";

// Polling transport for /doctor.
//
// The query itself lives in lib/doctor/dashboardStats so the SERVER RENDER of
// /doctor and the 15-second poll answer from one definition. This route is now
// only two things: the clinic gate, and the JSON envelope.
//
// Doctor dashboard stats are always pinned to the caller's own clinic.
// Platform-wide stats live on /api/admin/dashboard under a super-admin gate.
// The former `?clinicId=` cross-clinic peek was a source of ambiguity —
// removed.
export async function GET() {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  try {
    return NextResponse.json(await loadDashboardStats(doctor.clinicId));
  } catch (err) {
    console.error("[DOCTOR STATS API]", err);
    return NextResponse.json(
      {
        counts: EMPTY_DASHBOARD_COUNTS,
        queue: [],
        inClinic: [],
        inClinicTotal: 0,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
