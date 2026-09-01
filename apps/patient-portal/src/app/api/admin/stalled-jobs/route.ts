import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  classifyJob,
  FAILURE_STATUSES,
  IN_FLIGHT_STATUSES,
  STALE_AFTER_MINUTES,
} from "@/lib/admin/jobHealth";

export const dynamic = "force-dynamic";

// GET /api/admin/stalled-jobs
//
// The drill-down behind the health band: which assessments are actually
// stalled or failed, so "4 stalled" is a list a person can work rather than a
// number they have to trust.
//
// ── Observes, never repairs ─────────────────────────────────────────────────
// This endpoint is strictly read-only. It does not re-status, retry, cancel or
// touch a single row. Marking a job FAILED because it is old would destroy the
// evidence needed to find out why it stalled, and would do it under the guise
// of a health check.

const MAX_ROWS = 200;

export async function GET() {
  try {
    await assertSuperAdmin();

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);

    const [stalled, failed] = await prisma.$transaction([
      prisma.assessment.findMany({
        where: {
          deletedAt: null,
          status: { in: [...IN_FLIGHT_STATUSES] },
          updatedAt: { lt: staleBefore },
        },
        orderBy: { updatedAt: "asc" },
        take: MAX_ROWS,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          queuedAt: true,
          startedAt: true,
          updatedAt: true,
          clinic: { select: { id: true, name: true } },
        },
      }),
      prisma.assessment.findMany({
        where: {
          deletedAt: null,
          status: { in: [...FAILURE_STATUSES] },
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_ROWS,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          clinic: { select: { id: true, name: true } },
        },
      }),
    ]);

    const minutesSince = (d: Date) =>
      Math.round((now.getTime() - d.getTime()) / 60_000);

    return NextResponse.json({
      staleAfterMinutes: STALE_AFTER_MINUTES,
      inFlightStatuses: IN_FLIGHT_STATUSES,
      stalled: {
        count: stalled.length,
        truncated: stalled.length === MAX_ROWS,
        rows: stalled.map((a) => ({
          assessmentId: a.id,
          status: a.status,
          classification: classifyJob(
            { status: a.status, updatedAt: a.updatedAt },
            now,
          ),
          clinicId: a.clinic.id,
          clinicName: a.clinic.name,
          submittedAt: a.submittedAt.toISOString(),
          queuedAt: a.queuedAt?.toISOString() ?? null,
          startedAt: a.startedAt?.toISOString() ?? null,
          lastProgressAt: a.updatedAt.toISOString(),
          stalledForMinutes: minutesSince(a.updatedAt),
        })),
      },
      failed: {
        count: failed.length,
        truncated: failed.length === MAX_ROWS,
        rows: failed.map((a) => ({
          assessmentId: a.id,
          status: a.status,
          clinicId: a.clinic.id,
          clinicName: a.clinic.name,
          submittedAt: a.submittedAt.toISOString(),
          lastProgressAt: a.updatedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN STALLED JOBS]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
