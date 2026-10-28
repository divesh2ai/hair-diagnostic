import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { IN_FLIGHT_STATUSES, STALE_AFTER_MINUTES } from "@/lib/admin/jobHealth";
import {
  selectRecoverableJobs,
  DEFAULT_RECOVERY_LIMIT,
  type RecoveryCandidateRow,
} from "@/lib/admin/stalledRecovery";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { resumeOrchestration } from "@hairos/packages/assessment-orchestrator";

export const dynamic = "force-dynamic";

// POST /api/admin/stalled-jobs/recover
//
// The ACTION behind the read-only /api/admin/stalled-jobs drill-down: re-drive
// assessments that got abandoned mid-pipeline when their orchestration lambda
// died, by handing each one to the existing idempotent `resumeOrchestration()`
// primitive (which reclaims a stale Phase-A lease if needed, enforces its own
// retry ceiling, and re-runs the whole pipeline — completed artifacts are
// overwritten with identical content).
//
// ── Safety model ─────────────────────────────────────────────────────────────
//   • Super-Admin only.
//   • DRY-RUN BY DEFAULT. A plain POST (or { execute: false }) returns the plan
//     — which rows would be re-driven and which are skipped and why — and
//     writes NOTHING. Re-driving only happens on an explicit { execute: true }.
//   • Never re-drives a row with a live lease (a worker is already on it), nor
//     one past the retry ceiling. Both are reported as skipped, not touched.
//   • Never deletes, closes, cancels, or fabricates a terminal state. The only
//     write to a clinical row is the one resumeOrchestration() already makes.
//   • Bounded: at most HARD_CAP rows are even considered per call.
//   • Every requeue and the sweep summary are audited.
const HARD_CAP = 100;

type RecoverBody = {
  execute?: boolean;
  limit?: number;
};

export async function POST(req: Request) {
  try {
    const ctx = await assertSuperAdmin();

    const body = (await req.json().catch(() => ({}))) as RecoverBody;
    const execute = body?.execute === true;
    const requestedLimit = Number(body?.limit);
    const limit = Math.min(
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : DEFAULT_RECOVERY_LIMIT,
      HARD_CAP,
    );

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);

    // Only in-flight + already-stale rows are candidates. The selector applies
    // the lease / retry / staleness rules; this query just narrows the scan.
    const rows = await prisma.assessment.findMany({
      where: {
        deletedAt: null,
        status: { in: [...IN_FLIGHT_STATUSES] },
        updatedAt: { lt: staleBefore },
      },
      orderBy: { updatedAt: "asc" },
      take: HARD_CAP,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        retryCount: true,
        phaseALeaseExpiresAt: true,
        clinic: { select: { id: true, name: true } },
      },
    });

    const candidates: RecoveryCandidateRow[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      updatedAt: r.updatedAt,
      retryCount: r.retryCount,
      phaseALeaseExpiresAt: r.phaseALeaseExpiresAt,
    }));

    const plan = selectRecoverableJobs(candidates, now, { limit });

    if (!execute) {
      return NextResponse.json({
        mode: "dry_run",
        note: "No rows were modified. POST { \"execute\": true } to re-drive the eligible jobs.",
        scanned: rows.length,
        ...plan,
      });
    }

    // Execute: re-drive each eligible job. One failure must not abort the batch
    // — record it and carry on, so a single poison row cannot block recovery of
    // the rest.
    const results: Array<{ id: string; requeued: boolean; error?: string }> =
      [];
    for (const item of plan.eligible) {
      try {
        await resumeOrchestration(item.id);
        results.push({ id: item.id, requeued: true });
        await writeAuditLog({
          action: "ASSESSMENT_RECOVERY_REQUEUED",
          entityType: "assessment",
          entityId: item.id,
          assessmentId: item.id,
          actorId: ctx.userId,
          actorRole: ctx.role,
          actorType: "admin",
          metadata: {
            status: item.status,
            ageMinutes: item.ageMinutes,
            retryCount: item.retryCount,
          },
        }).catch(() => {});
      } catch (err) {
        results.push({
          id: item.id,
          requeued: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const succeeded = results.filter((r) => r.requeued).length;
    await writeAuditLog({
      action: "ASSESSMENT_RECOVERY_SWEEP",
      entityType: "platform",
      entityId: "stalled-jobs",
      actorId: ctx.userId,
      actorRole: ctx.role,
      actorType: "admin",
      metadata: {
        scanned: rows.length,
        attempted: plan.eligible.length,
        succeeded,
        failed: plan.eligible.length - succeeded,
        skipped: plan.skipped.length,
      },
    }).catch(() => {});

    return NextResponse.json({
      mode: "executed",
      scanned: rows.length,
      attempted: plan.eligible.length,
      succeeded,
      results,
      skipped: plan.skipped,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN STALLED RECOVERY]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
