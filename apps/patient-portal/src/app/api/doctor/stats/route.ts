import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clinicScope,
  getClinicContext,
  handleAuthError,
  isSuperAdmin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await getClinicContext();

    const url = new URL(req.url);
    const requestedClinicId = url.searchParams.get("clinicId");

    // SUPER_ADMIN sees platform-wide stats unless they ask for one clinic
    // (preview mode). Clinic-scoped roles are pinned to their JWT clinic.
    const scope = isSuperAdmin(ctx.role)
      ? requestedClinicId
        ? { clinicId: requestedClinicId }
        : {}
      : clinicScope(ctx);

    const baseWhere = { ...scope, deletedAt: null };

    const [patients, reports, pending, recent] = await Promise.all([
      prisma.patient.count({ where: baseWhere }),
      prisma.assessment.count({ where: { ...baseWhere, status: "COMPLETED" } }),
      prisma.assessment.count({
        where: { ...baseWhere, status: { notIn: ["COMPLETED", "FAILED"] } },
      }),
      prisma.assessment.findMany({
        where: { ...baseWhere, status: "COMPLETED" },
        take: 5,
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          submittedAt: true,
          status: true,
          patient: { select: { name: true } },
          clinic: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      counts: { patients, reports, pending },
      recent: recent.map((r) => ({
        id: r.id,
        patientName: r.patient.name,
        clinicName: r.clinic.name,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        status: r.status,
      })),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[DOCTOR STATS API]", err);
    return NextResponse.json(
      {
        counts: { patients: 0, reports: 0, pending: 0 },
        recent: [],
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
