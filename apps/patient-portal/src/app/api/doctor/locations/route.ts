import { NextResponse } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { loadDoctorLocations } from "@/lib/doctor/locations";

export const dynamic = "force-dynamic";

// GET /api/doctor/locations — the branches of the acting doctor's clinic.
//
// The clinic id comes from `requireDoctorContext`, which resolves it from the
// live Doctor row at request time. It is never read from the query string, so
// there is no id for a caller to change: a doctor in clinic A cannot ask this
// endpoint for clinic B's branches because clinic B is not expressible in the
// request.
//
// What the payload may and may not claim is documented once, in
// lib/doctor/locations.
export async function GET() {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await loadDoctorLocations(auth.doctor.clinicId));
}
