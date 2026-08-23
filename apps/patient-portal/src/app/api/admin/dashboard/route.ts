import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Super Admin dashboard payload. One round trip; numbers are cheap counts.
export async function GET() {
  try {
    await assertSuperAdmin();

    const now = new Date();
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

    // Month-to-date growth must compare like with like. Comparing a partial
    // current month against a COMPLETE previous month made growth read
    // negative for the first ~29 days of every month regardless of real
    // performance. Cut last month at the same elapsed offset instead.
    const elapsedMs = now.getTime() - startOfMonth.getTime();
    const lastMonthCutoff = new Date(startOfLastMonth.getTime() + elapsedMs);

    // Platform health is a RATE, so numerator and denominator must share one
    // window. The previous formula divided all-time failures by this month's
    // assessments — a ratio between two different periods, which grew without
    // bound as the platform aged and floored the score at 0 ("Degraded") on a
    // perfectly healthy platform. A 7-day rolling window is both self-
    // consistent and actually current.
    const startOfHealthWindow = new Date(
      startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000,
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
      assessmentsCompletedToday,
      assessmentsThisMonth,
      assessmentsLastMonth,
      recentClinics,
      recentDoctors,
      recentAssessments,
      failuresInHealthWindow,
      assessmentsInHealthWindow,
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
          submittedAt: { gte: startOfLastMonth, lt: lastMonthCutoff },
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
      // Both sides of the health rate share one 7-day window.
      prisma.assessment.count({
        where: {
          deletedAt: null,
          status: "FAILED",
          createdAt: { gte: startOfHealthWindow },
        },
      }),
      prisma.assessment.count({
        where: {
          deletedAt: null,
          createdAt: { gte: startOfHealthWindow },
        },
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

    // 7-day rolling failure rate. With no assessments in the window there is
    // no evidence of failure, so health is 100 rather than 0 — a quiet week
    // is not a degraded platform.
    const failureRate =
      assessmentsInHealthWindow > 0
        ? Math.round((failuresInHealthWindow / assessmentsInHealthWindow) * 100)
        : 0;

    // 100 minus the rolling failure rate, clamped to 0–100. UI labels
    // >90 healthy, 70–90 watch, <70 degraded.
    const platformHealth = Math.min(100, Math.max(0, 100 - failureRate));

    return NextResponse.json({
      metrics: {
        clinicsTotal,
        clinicsActive,
        doctorsTotal,
        patientsTotal,
        assessmentsToday,
        // Renamed from `reportsToday`: this counts Assessment rows that
        // reached COMPLETED today, which is completed assessments, not
        // generated reports. The old name asserted something the query
        // never measured.
        assessmentsCompletedToday,
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
