import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";

// GET /api/doctor/orders — recent KitOrderIntent rows for the caller's
// clinic. Super admin sees platform-wide. Feeds the /doctor/orders and
// /clinic/orders tables.

const LIMIT = 100;

export async function GET() {
  const auth = await requireRole(
    SystemRole.DOCTOR,
    SystemRole.CLINIC_ADMIN,
    SystemRole.SUPER_ADMIN,
    SystemRole.STAFF,
  );
  if (auth instanceof NextResponse) return auth;

  const where = isSuperAdmin(auth.user_role)
    ? {}
    : { clinicId: auth.clinic_id ?? "__none__" };

  const rows = await prisma.kitOrderIntent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      status: true,
      kitIds: true,
      createdAt: true,
      assessment: {
        select: { id: true, patient: { select: { name: true } } },
      },
      doctor: { select: { name: true } },
      clinic: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      kitCount: r.kitIds.length,
      kitIds: r.kitIds,
      patientName: r.assessment?.patient?.name ?? "—",
      assessmentId: r.assessment?.id ?? null,
      doctorName: r.doctor?.name ?? "—",
      clinicName: r.clinic?.name ?? "—",
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
