import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

// Platform-wide metrics — SUPER_ADMIN only. CLINIC_ADMINs use /api/doctor/stats
// for clinic-scoped numbers.
export async function GET() {
  try {
    await assertSuperAdmin();

    // pgbouncer connection_limit=1 — batch as a transaction so all queries
    // share one connection sequentially instead of starving.
    const [clinics, doctors, assessments, failures, logs] = await prisma.$transaction([
      prisma.clinic.count({ where: { deletedAt: null } }),
      prisma.doctor.count({ where: { deletedAt: null } }),
      prisma.assessment.count({ where: { deletedAt: null } }),
      prisma.assessment.count({
        where: { deletedAt: null, status: "FAILED" },
      }),
      prisma.orchestrationLog.findMany({
        where: { status: "SUCCESS", durationMs: { not: null } },
        take: 100,
        orderBy: { createdAt: "desc" },
        select: { durationMs: true },
      }),
    ]);

    const durations = logs.map((l) => l.durationMs ?? 0).filter((d) => d > 0);
    const avgOrchestrationMs =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    return NextResponse.json({
      clinics,
      doctors,
      assessments,
      failures,
      avgOrchestrationMs,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN METRICS API]", err);
    return NextResponse.json(
      { clinics: 0, doctors: 0, assessments: 0, failures: 0, avgOrchestrationMs: 0 },
      { status: 500 },
    );
  }
}
