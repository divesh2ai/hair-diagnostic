import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertClinicAccess,
  getClinicContext,
  handleAuthError,
  isSuperAdmin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Look up first so we can scope the access check to the row's clinic.
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
      // Don't leak existence vs. permission — use the same 404 for both.
      const ctx = await getClinicContext();
      void ctx;
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Now enforce tenant scope on the resolved clinic.
    const ctx = await getClinicContext();
    if (!isSuperAdmin(ctx.role)) {
      await assertClinicAccess(patient.clinicId);
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
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[DOCTOR PATIENT API]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
