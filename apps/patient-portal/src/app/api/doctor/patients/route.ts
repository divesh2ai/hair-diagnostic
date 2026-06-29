import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  clinicScope,
  getClinicContext,
  handleAuthError,
  isSuperAdmin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Doctor-facing patient list. Tenant-scoped via JWT clinic_id; SUPER_ADMIN
// can optionally pass ?clinicId= to inspect any clinic in preview mode.
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await getClinicContext();
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");
  const requestedClinicId = url.searchParams.get("clinicId");

  const scope = isSuperAdmin(ctx.role)
    ? requestedClinicId
      ? { clinicId: requestedClinicId }
      : {}
    : clinicScope(ctx);

  try {
    const patients = await prisma.patient.findMany({
      where: {
        ...scope,
        ...(doctorId ? { doctorId } : {}),
        deletedAt: null,
      },
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { assessments: true } },
        assessments: {
          take: 1,
          orderBy: { submittedAt: "desc" },
          select: { id: true, status: true, submittedAt: true },
        },
      },
    });

    return NextResponse.json({
      patients: patients.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        assessmentCount: p._count.assessments,
        lastAssessment: p.assessments[0]?.submittedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Doctor patients API:", error);
    return NextResponse.json({ patients: [], error: "Internal" }, { status: 500 });
  }
}
