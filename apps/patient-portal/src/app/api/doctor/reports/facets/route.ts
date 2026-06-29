import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getClinicContext,
  handleAuthError,
  isSuperAdmin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Filter facets for the Reports listing. Tenant-scoped: a doctor in clinic A
// must not see clinic B's name appear in the clinic dropdown, nor doctor B's
// name appear in the doctor dropdown. SUPER_ADMIN sees the full set.
export async function GET() {
  try {
    const ctx = await getClinicContext();
    const superAdmin = isSuperAdmin(ctx.role);

    const clinicWhere = superAdmin
      ? { isActive: true, deletedAt: null }
      : { isActive: true, deletedAt: null, id: ctx.clinicId ?? "__none__" };

    const doctorWhere = superAdmin
      ? { isActive: true, deletedAt: null }
      : { isActive: true, deletedAt: null, clinicId: ctx.clinicId ?? "__none__" };

    const [clinics, doctors, diagnoses, severities] = await Promise.all([
      prisma.clinic.findMany({
        where: clinicWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.doctor.findMany({
        where: doctorWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      superAdmin
        ? prisma.$queryRawUnsafe<Array<{ v: string }>>(`
            SELECT DISTINCT content->>'primaryDiagnosis' AS v
            FROM "AIArtifact"
            WHERE type = 'SEVERITY_ANALYSIS'
              AND content->>'primaryDiagnosis' IS NOT NULL
            ORDER BY v ASC
          `)
        : prisma.$queryRaw<Array<{ v: string }>>(Prisma.sql`
            SELECT DISTINCT art.content->>'primaryDiagnosis' AS v
            FROM "AIArtifact" art
            JOIN "Assessment" a ON a.id = art."assessmentId"
            WHERE art.type = 'SEVERITY_ANALYSIS'
              AND art.content->>'primaryDiagnosis' IS NOT NULL
              AND a."clinicId" = ${ctx.clinicId ?? "__none__"}
            ORDER BY v ASC
          `),
      superAdmin
        ? prisma.$queryRawUnsafe<Array<{ v: string }>>(`
            SELECT DISTINCT content->>'severity' AS v
            FROM "AIArtifact"
            WHERE type = 'SEVERITY_ANALYSIS'
              AND content->>'severity' IS NOT NULL
            ORDER BY v ASC
          `)
        : prisma.$queryRaw<Array<{ v: string }>>(Prisma.sql`
            SELECT DISTINCT art.content->>'severity' AS v
            FROM "AIArtifact" art
            JOIN "Assessment" a ON a.id = art."assessmentId"
            WHERE art.type = 'SEVERITY_ANALYSIS'
              AND art.content->>'severity' IS NOT NULL
              AND a."clinicId" = ${ctx.clinicId ?? "__none__"}
            ORDER BY v ASC
          `),
    ]);

    return NextResponse.json({
      clinics,
      doctors,
      diagnoses: diagnoses.map((d) => d.v),
      severities: severities.map((d) => d.v),
      statuses: [
        "PENDING",
        "QUEUED",
        "NORMALIZING",
        "RUNNING_CLINICAL_ENGINE",
        "GENERATING_RECOMMENDATIONS",
        "GENERATING_REPORT",
        "COMPLETED",
        "FAILED",
        "PARTIAL_FAILURE",
      ],
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[DOCTOR FACETS API]", err);
    return NextResponse.json(
      { clinics: [], doctors: [], diagnoses: [], severities: [], statuses: [] },
      { status: 500 },
    );
  }
}
