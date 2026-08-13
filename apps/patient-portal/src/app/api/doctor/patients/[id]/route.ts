import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const { id } = await params;

  try {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        clinic: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
        assessments: {
          where: { deletedAt: null },
          orderBy: { submittedAt: "desc" },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            artifacts: {
              where: { type: "SEVERITY_ANALYSIS" },
              select: { content: true },
            },
          },
        },
      },
    });

    if (!patient) {
      // Same 404 for missing and forbidden — don't leak existence.
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Cross-clinic reject — same 404 as missing, so we do not leak that
    // a patient with this id exists in a different clinic.
    if (assertDoctorInClinic(doctor, patient.clinicId)) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        age: patient.age,
        gender: patient.gender,
        clinic: patient.clinic,
        doctor: patient.doctor,
        assessments: patient.assessments.map((a) => {
          const sev = a.artifacts[0]?.content as
            | { primaryDiagnosis?: string; severity?: string }
            | undefined;
          return {
            id: a.id,
            status: a.status,
            submittedAt: a.submittedAt?.toISOString() ?? null,
            primaryDiagnosis: sev?.primaryDiagnosis ?? null,
            severity: sev?.severity ?? null,
          };
        }),
      },
    });
  } catch (err) {
    console.error("[DOCTOR PATIENT API]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
