import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Doctor-facing patient list. Scoped to the caller's own Doctor row's
// clinic — no `?clinicId=` override. Cross-clinic inspection belongs on
// /api/admin/* under a SUPER_ADMIN role check; routing it through the
// Doctor API would grant Doctor-role identity to a super-admin's queries
// in a different clinic, which is not the security model.
export async function GET(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const url = new URL(req.url);
  const doctorId = url.searchParams.get("doctorId");

  try {
    const patients = await prisma.patient.findMany({
      where: {
        clinicId: doctor.clinicId,
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
