import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { loadClinicianRoster, type ClinicianRow } from "@/lib/admin/clinicianRoster";

export const dynamic = "force-dynamic";

// GET /api/admin/clinicians?q=&clinic=&status=
//
// Every clinician on the platform, including the ones who cannot sign in yet.
// The companion to /api/admin/people: that endpoint is keyed on the auth
// account and therefore cannot see a doctor provisioned ahead of their login;
// this one is keyed on the Doctor row and reports access as an attribute.
//
// Read-only, matching /api/admin/people. Activating or deactivating a doctor
// already has an audited, clinic-scoped path at
// PATCH /api/clinic/doctors/[id]; duplicating it behind a super-admin gate
// would give the same act two audit trails.

function matches(c: ClinicianRow, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    c.name.toLowerCase().includes(needle) ||
    (c.email ?? "").toLowerCase().includes(needle) ||
    (c.phone ?? "").toLowerCase().includes(needle) ||
    c.clinicName.toLowerCase().includes(needle) ||
    c.doctorId.toLowerCase().includes(needle) ||
    c.locations.some((l) => l.branchName.toLowerCase().includes(needle))
  );
}

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const clinic = url.searchParams.get("clinic")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";

    const roster = await loadClinicianRoster();
    let rows = roster.clinicians;

    if (clinic) rows = rows.filter((c) => c.clinicName === clinic);
    if (status === "contact_required") {
      rows = rows.filter((c) => c.contactStatus === "CONTACT_REQUIRED");
    } else if (status === "unconfirmed") {
      rows = rows.filter((c) => c.contactStatus === "UNCONFIRMED");
    } else if (status === "no_dashboard") {
      rows = rows.filter((c) => !c.dashboardAccess);
    } else if (status === "multi_location") {
      rows = rows.filter((c) => c.locationCount > 1);
    } else if (status === "deactivated") {
      rows = rows.filter((c) => c.accountStatus !== "ACTIVE");
    }
    if (q) rows = rows.filter((c) => matches(c, q));

    return NextResponse.json({
      // The summary always describes the whole roster, never the filtered
      // view, so "3 contact-required" means the same thing on every screen.
      summary: roster.summary,
      authReadable: roster.authReadable,
      clinicians: rows,
      matched: rows.length,
      clinics: [...new Set(roster.clinicians.map((c) => c.clinicName))].sort(),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINICIANS]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
