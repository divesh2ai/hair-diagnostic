import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const [clinics, doctors, assessments, failures, logs] = await Promise.all([
      prisma.clinic.count(),
      prisma.doctor.count(),
      prisma.assessment.count(),
      prisma.assessment.count({ where: { status: "FAILED" } }),
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
  } catch {
    return NextResponse.json({
      clinics: 0,
      doctors: 0,
      assessments: 0,
      failures: 0,
      avgOrchestrationMs: 0,
    });
  }
}
