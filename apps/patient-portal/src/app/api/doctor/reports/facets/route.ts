import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Filter facets for the Reports listing. Doctor-scoped — the caller only
// ever sees their own clinic + colleagues + diagnoses that appear in their
// clinic's data. The former SUPER_ADMIN cross-tenant view lived on the
// same endpoint; that cross-clinic capability belongs on /api/admin/*
// under a super-admin gate and is intentionally removed here.
export async function GET() {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;
  const clinicId = doctor.clinicId;

  try {
    const [clinics, doctors, diagnoses, severities] = await Promise.all([
      prisma.clinic.findMany({
        where: { isActive: true, deletedAt: null, id: clinicId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.doctor.findMany({
        where: { isActive: true, deletedAt: null, clinicId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.$queryRaw<Array<{ v: string }>>(Prisma.sql`
        SELECT DISTINCT art.content->>'primaryDiagnosis' AS v
        FROM "AIArtifact" art
        JOIN "Assessment" a ON a.id = art."assessmentId"
        WHERE art.type = 'SEVERITY_ANALYSIS'
          AND art.content->>'primaryDiagnosis' IS NOT NULL
          AND a."clinicId" = ${clinicId}
        ORDER BY v ASC
      `),
      prisma.$queryRaw<Array<{ v: string }>>(Prisma.sql`
        SELECT DISTINCT art.content->>'severity' AS v
        FROM "AIArtifact" art
        JOIN "Assessment" a ON a.id = art."assessmentId"
        WHERE art.type = 'SEVERITY_ANALYSIS'
          AND art.content->>'severity' IS NOT NULL
          AND a."clinicId" = ${clinicId}
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
    console.error("[DOCTOR FACETS API]", err);
    return NextResponse.json(
      { clinics: [], doctors: [], diagnoses: [], severities: [], statuses: [] },
      { status: 500 },
    );
  }
}
