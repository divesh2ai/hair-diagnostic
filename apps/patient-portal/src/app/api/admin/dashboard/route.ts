import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  computePlatformHealth,
  IN_FLIGHT_STATUSES,
  STALE_AFTER_MINUTES,
} from "@/lib/admin/jobHealth";
import { tallyDataClasses, isConfirmedTest } from "@/lib/admin/testData";

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

    // ── Test-data separation (read-only, classification only) ────────────────
    // Identify confirmed-test/demo clinics BEFORE the count batch so their
    // synthetic patients, doctors and assessments can be excluded from the
    // default real-business KPIs. One trivial 16-row read; it also gives the
    // real/test/uncertain tally and the true all-clinic total for free.
    //
    // `notTest` is built so it SPREADS TO NOTHING when there is no confirmed
    // test clinic (e.g. production): the where-clauses are then byte-identical
    // to before, which is why the existing dashboard tests pass unchanged.
    const clinicIdentities = await prisma.clinic.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    const dataClasses = tallyDataClasses(clinicIdentities);
    const testClinicIds = clinicIdentities.filter(isConfirmedTest).map((c) => c.id);
    const notTest = testClinicIds.length > 0 ? { notIn: testClinicIds } : undefined;
    // Spread into a where to scope it to real-business clinics; `{}` when none.
    const byClinic = notTest ? { clinicId: notTest } : {};
    const byClinicId = notTest ? { id: notTest } : {};

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
      partialFailuresInHealthWindow,
      stalledAssessments,
      doctorsAccessReady,
      assessmentsTotal,
      clinicsAccessReady,
    ] = await prisma.$transaction([
      // Clinic status counts, scoped to real-business clinics (test excluded).
      prisma.clinic.count({ where: { deletedAt: null, ...byClinicId } }),
      prisma.clinic.count({ where: { deletedAt: null, status: "ACTIVE", ...byClinicId } }),
      prisma.doctor.count({ where: { deletedAt: null, ...byClinic } }),
      prisma.patient.count({ where: { deletedAt: null, ...byClinic } }),
      prisma.assessment.count({
        where: { deletedAt: null, submittedAt: { gte: startOfToday }, ...byClinic },
      }),
      prisma.assessment.count({
        where: {
          deletedAt: null,
          status: "COMPLETED",
          completedAt: { gte: startOfToday },
          ...byClinic,
        },
      }),
      prisma.assessment.count({
        where: { deletedAt: null, submittedAt: { gte: startOfMonth }, ...byClinic },
      }),
      prisma.assessment.count({
        where: {
          deletedAt: null,
          submittedAt: { gte: startOfLastMonth, lt: lastMonthCutoff },
          ...byClinic,
        },
      }),
      prisma.clinic.findMany({
        where: { deletedAt: null, ...byClinicId },
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
        where: { deletedAt: null, ...byClinic },
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
        where: { deletedAt: null, ...byClinic },
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
      // Both sides of the health rate share one 7-day window. Test clinics are
      // excluded so synthetic failures don't distort the real platform health.
      prisma.assessment.count({
        where: {
          deletedAt: null,
          status: "FAILED",
          createdAt: { gte: startOfHealthWindow },
          ...byClinic,
        },
      }),
      prisma.assessment.count({
        where: {
          deletedAt: null,
          createdAt: { gte: startOfHealthWindow },
          ...byClinic,
        },
      }),
      // PARTIAL_FAILURE was scoring as success. The patient's record is
      // incomplete and a human has to look at it, which is the only test an
      // operational health signal should apply.
      prisma.assessment.count({
        where: {
          deletedAt: null,
          status: "PARTIAL_FAILURE",
          createdAt: { gte: startOfHealthWindow },
          ...byClinic,
        },
      }),
      // Stalled mid-pipeline: in an actively-progressing status with no write
      // for longer than the threshold. Counted across ALL time, not the health
      // window — a job wedged nine days ago is still wedged today, and a
      // window would let it quietly age out of the signal.
      prisma.assessment.count({
        where: {
          deletedAt: null,
          status: { in: [...IN_FLIGHT_STATUSES] },
          updatedAt: {
            lt: new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000),
          },
          ...byClinic,
        },
      }),
      // ── Command-centre additions (read-only counts) ───────────────────────
      // Access-ready = an active, non-deleted doctor whose auth identity is
      // linked (supabaseUserId OR supabasePhoneUserId). This is "provisioned to
      // sign in", NOT proof of a successful live OTP/OAuth login. Test clinics'
      // doctors are excluded — a provisioned QA doctor is not real readiness.
      prisma.doctor.count({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { supabaseUserId: { not: null } },
            { supabasePhoneUserId: { not: null } },
          ],
          ...byClinic,
        },
      }),
      // Total patient assessments (volume), excluding soft-deleted and test.
      prisma.assessment.count({ where: { deletedAt: null, ...byClinic } }),
      // ACTIVE clinics that have at least one access-ready doctor. Used only for
      // the readiness summary; it is NOT a claim of operational verification.
      prisma.clinic.count({
        where: {
          deletedAt: null,
          status: "ACTIVE",
          ...byClinicId,
          doctors: {
            some: {
              isActive: true,
              deletedAt: null,
              OR: [
                { supabaseUserId: { not: null } },
                { supabasePhoneUserId: { not: null } },
              ],
            },
          },
        },
      }),
    ]);

    // Retained for existing consumers. Note the `: 100` branch: with no
    // previous-period activity there is no percentage change, and 100 is an
    // assertion the data cannot support. The console no longer reads this
    // field — it reads the raw pair below and decides for itself whether a
    // percentage is meaningful at this sample size (lib/admin/growth.ts).
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

    // Health now counts three things, not one: terminal failures, partial
    // failures, and work stalled mid-pipeline. See lib/admin/jobHealth for the
    // banding rules and why a single stalled job is enough to leave "healthy".
    //
    // `score` is null when the window is empty — the old code returned 100 for
    // a quiet week, so a total intake outage displayed as maximum health.
    const health = computePlatformHealth({
      windowTotal: assessmentsInHealthWindow,
      failed: failuresInHealthWindow,
      partialFailure: partialFailuresInHealthWindow,
      stalled: stalledAssessments,
    });

    // Retained for existing consumers of `metrics.platformHealth`, which is a
    // number. Null (no evidence) is reported as 100 here to preserve the old
    // shape; anything reading the honest value should read `health` instead.
    const platformHealth = health.score ?? 100;

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
        // The two numbers behind that percentage. A comparison cannot be read
        // honestly without its denominator: +450% is nine extra patients on a
        // base of two, and only the raw pair makes that visible. Both counts
        // are the ones already queried above — nothing is recomputed and no
        // new query was added to expose them.
        assessmentsThisMonth,
        assessmentsLastMonth,
        platformHealth,
        // Command-centre metrics + readiness summary inputs.
        doctorsAccessReady,
        assessmentsTotal,
        // Clinic readiness tiers. operationallyVerified is intentionally null:
        // no trustworthy golden-path verification record source exists yet, so
        // the UI shows "Verification pending" rather than inferring it from
        // activity rows. clinicsActive is the DATABASE ACTIVE count above.
        clinicsAccessReady,
        clinicsOperationallyVerified: null as number | null,
        // Test-data separation. Every count ABOVE now excludes confirmed
        // test/demo clinics by default — clinicsTotal/clinicsActive, the doctor,
        // patient and assessment volumes, access-ready and health all describe
        // the real-business network. These fields expose the split and the true
        // all-clinic total so nothing is hidden and the UI can note what was
        // excluded. `clinicsAllIncludingTest` counts every non-deleted clinic.
        clinicsReal: dataClasses.real,
        clinicsTestDemo: dataClasses.test,
        clinicsUncertain: dataClasses.uncertain,
        clinicsAllIncludingTest: clinicIdentities.length,
      },
      // The honest health object: band, reasons, and the counts behind them.
      // Additive — `metrics.platformHealth` is untouched for existing callers.
      health,
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
