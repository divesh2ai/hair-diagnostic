import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError, getClinicContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

// PATCH /api/admin/clinicians/[id]
//
// Super Admin may activate or deactivate a Doctor row. This is the only
// mutation exposed from the admin console; clinical approvals and prescriptions
// are never editable here (separation: admin = access, doctor = clinical).
//
// Deactivation takes effect on the Doctor's very next request: requireDoctorContext
// re-reads the isActive flag from the DB on every call, so there is no JWT
// expiry window to wait out.
//
// Audited: every change writes an AuditLog row with the actor, the doctor id,
// and the direction of the change.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertSuperAdmin();
    const ctx = await getClinicContext();
    const { id } = await params;

    let body: { isActive: boolean };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive (boolean) is required" },
        { status: 400 },
      );
    }

    const doctor = await prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        clinicId: true,
        isActive: true,
        provisioningStatus: true,
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (doctor.isActive === body.isActive) {
      // Already in the desired state — idempotent.
      return NextResponse.json({ doctor, changed: false });
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: { isActive: body.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        clinicId: true,
        isActive: true,
        provisioningStatus: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      action: body.isActive ? "DOCTOR_ACTIVATED" : "DOCTOR_DEACTIVATED",
      entityType: "Doctor",
      entityId: doctor.id,
      actorId: ctx.userId,
      actorRole: ctx.role as never,
      actorType: "admin",
      clinicId: doctor.clinicId,
      metadata: {
        doctorName: doctor.name,
        clinicId: doctor.clinicId,
        previousIsActive: doctor.isActive,
        newIsActive: body.isActive,
      },
    });

    return NextResponse.json({ doctor: updated, changed: true });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINICIAN PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
