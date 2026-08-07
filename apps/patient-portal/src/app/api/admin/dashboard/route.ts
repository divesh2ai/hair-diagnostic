import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Super Admin dashboard payload. One round trip; numbers are cheap counts.
export async function GET() {
  try {
    await assertSuperAdmin();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      1,
    );
    const startOfLastMonth = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() - 1,
      1,
    );

    // Deployed Prisma uses pgbouncer with connection_limit=1 (see DATABASE_URL).
    // A Promise.all of 12 independent queries starves that single connection
    // and blows the lambda timeout. $transaction runs the whole batch inside
    // one connection sequentially, which is what pgbouncer expects.
    const [
      clinicsTotal,
      clinicsActive,
      doctorsTotal,
      patientsTotal,
      assessmentsToday,
      reportsToday,
      assessmentsThisMonth,
      assessmentsLastMonth,
      recentClinics,
      recentDoctors,
      recentAssessments,
      failures,
    ] = await prisma.$transaction([
      prisma.clinic.count({ where: { deletedAt: null } }),
      prisma.clinic.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.doctor.count({ where: { deletedAt: null } }),
      prisma.patient.count({ where: { deletedAt: null } }),
      prisma.assessment.count({
        where: { deletedAt: null, submittedAt: { gte: startOfToday } },
      }),
      prisma.assessment.count({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          completedAt: { gte: startOfToday },
        },
      }),
      prisma.assessment.count({
        where: { deletedAt: null, submittedAt: { gte: startOfMonth } },
      }),
      prisma.assessment.count({
        where: {
          deletedAt: null,
          submittedAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),
      prisma.clinic.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.doctor.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          photoUrl: true,
          clinic: { select: { name: true } },
          createdAt: true,
        },
      }),
      prisma.assessment.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          patient: { select: { name: true } },
          clinic: { select: { name: true } },
        },
      }),
      prisma.assessment.count({
        where: { deletedAt: null, status: "FAILED" },
      }),
    ]);

    const growth =
      assessmentsLastMonth > 0
        ? Math.round(
            ((assessmentsThisMonth - assessmentsLastMonth) /
              assessmentsLastMonth) *
              100,
          )
        : assessmentsThisMonth > 0
          ? 100
          : 0;

    const failureRate =
      assessmentsThisMonth > 0
        ? Math.round((failures / Math.max(1, assessmentsThisMonth)) * 100)
        : 0;

    // Simple platform-health heuristic: 100 minus the rolling failure rate,
    // floored at 0. UI labels >90 healthy, 70–90 watch, <70 degraded.
    const platformHealth = Math.max(0, 100 - failureRate);

    return NextResponse.json({
      metrics: {
        clinicsTotal,
        clinicsActive,
        doctorsTotal,
        patientsTotal,
        assessmentsToday,
        reportsToday,
        monthlyGrowth: growth,
        platformHealth,
      },
      recent: {
        clinics: recentClinics.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
        doctors: recentDoctors.map((d) => ({
          id: d.id,
          name: d.name,
          email: d.email,
          avatarUrl: d.avatarUrl ?? d.photoUrl,
          clinicName: d.clinic.name,
          createdAt: d.createdAt.toISOString(),
        })),
        assessments: recentAssessments.map((a) => ({
          id: a.id,
          status: a.status,
          submittedAt: a.submittedAt?.toISOString() ?? null,
          patientName: a.patient.name,
          clinicName: a.clinic.name,
        })),
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN DASHBOARD]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
