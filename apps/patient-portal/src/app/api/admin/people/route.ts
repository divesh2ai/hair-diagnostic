import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  loadPeopleDirectory,
  type AccessLevel,
  type PersonRow,
} from "@/lib/admin/peopleDirectory";

export const dynamic = "force-dynamic";

// GET /api/admin/people?role=&clinic=&status=&q=&includePatients=
//
// The platform's people and what they can reach. Read-only in SA-1 by
// deliberate scope: this phase gives the Super Admin sight of who holds
// access, not the ability to change it. Granting and revoking touch the JWT
// claims hook and the membership tables at once and deserve their own phase
// with their own audit events.
//
// ── Patients are excluded by default ────────────────────────────────────────
// Patients hold auth accounts too, and in production they will outnumber staff
// by orders of magnitude. This is a governance screen about who can operate
// the platform, so it defaults to staff identities and admits patients only on
// explicit request. That also keeps the payload bounded.

/** Hard ceiling on a single response, whatever the filters say. */
const MAX_ROWS = 500;

function matches(person: PersonRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    (person.email ?? "").toLowerCase().includes(needle) ||
    (person.name ?? "").toLowerCase().includes(needle) ||
    person.userId.toLowerCase().includes(needle) ||
    person.clinicNames.some((c) => c.toLowerCase().includes(needle))
  );
}

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();

    const url = new URL(req.url);
    const role = url.searchParams.get("role")?.trim() ?? "";
    const clinic = url.searchParams.get("clinic")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const q = url.searchParams.get("q")?.trim() ?? "";
    const includePatients =
      url.searchParams.get("includePatients") === "true";

    const directory = await loadPeopleDirectory();

    let rows = directory.people;
    if (!includePatients) {
      rows = rows.filter((p) => p.accessLevel !== "PATIENT");
    }
    if (role) {
      rows = rows.filter((p) => p.accessLevel === (role as AccessLevel));
    }
    if (clinic) {
      rows = rows.filter((p) => p.clinicNames.includes(clinic));
    }
    if (status === "roleless") {
      rows = rows.filter((p) => p.accessLevel === "NONE");
    } else if (status === "inactive") {
      rows = rows.filter((p) => p.inactive);
    } else if (status === "clinic_unclear") {
      rows = rows.filter((p) => p.clinicUnclear);
    } else if (status === "never_signed_in") {
      rows = rows.filter((p) => !p.lastSignInAt);
    }
    if (q) {
      rows = rows.filter((p) => matches(p, q));
    }

    const matched = rows.length;
    const truncated = matched > MAX_ROWS;

    return NextResponse.json({
      // Summary always describes the WHOLE directory, never the filtered view.
      // A count that silently followed the filters would make "2 roleless
      // accounts" mean something different on every screen.
      summary: directory.summary,
      invitations: directory.invitations,
      authReadable: directory.authReadable,
      people: rows.slice(0, MAX_ROWS),
      matched,
      truncated,
      // Clinic list for the filter control, derived from what actually exists.
      clinics: [
        ...new Set(directory.people.flatMap((p) => p.clinicNames)),
      ].sort(),
      patientsIncluded: includePatients,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN PEOPLE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
