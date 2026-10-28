import { NextResponse, after } from "next/server";
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
//   • Never re-drives a row with a live Phase-A lease (a worker is already on
//     it), nor one past the retry ceiling. Both are reported as skipped.
//   • Never deletes, closes, cancels, or fabricates a terminal state. The only
//     write to a clinical row is the one resumeOrchestration() already makes.
//   • Bounded: the scan is capped (and truncation is reported, not hidden), and
//     a single call re-drives at most EXECUTE_BATCH_CAP jobs.
//   • Every requeue and the sweep summary are audited with the row's ACTUAL
//     before/after status, so the trail never claims a requeue the orchestrator
//     silently declined (retry ceiling / ineligible reclaim both no-op).
//
// ── Why execution is offloaded to after() ────────────────────────────────────
// resumeOrchestration() sleeps a retry backoff and then runs the full Phase A +
// Phase B pipeline (seconds to tens of seconds each). Awaiting that serially
// for a batch inside the request would blow the function timeout and leave jobs
// half-driven — the exact abandonment this endpoint exists to cure. So, exactly
// like the sibling /api/assessment/orchestrate route, the HTTP response returns
// as soon as the plan is computed and the re-drives run in an after() callback
// (the platform keeps the lambda alive for its duration). The response reports
// what was DISPATCHED; per-job success/failure lands in the audit log.
//
// A durable queue (Inngest is scaffolded but unwired) remains the right home for
// large backlogs; this endpoint is deliberately bounded and is the operator's
// manual recovery lever for the handful of jobs that slip through.

/** How many stalled rows the scan reads. Above this we report truncation
 *  rather than silently hiding the excess. */
const SCAN_CAP = 200;
/** Hard ceiling on how many jobs one call will re-drive, even if asked for more. */
const EXECUTE_BATCH_CAP = 25;

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
      EXECUTE_BATCH_CAP,
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
      take: SCAN_CAP,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        retryCount: true,
        phaseALeaseExpiresAt: true,
      },
    });

    // If the scan hit its cap there may be more stalled rows than we can see;
    // say so rather than letting `scanned` imply the whole population.
    const scanTruncated = rows.length === SCAN_CAP;

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
        note: 'No rows were modified. POST { "execute": true } to re-drive the eligible jobs.',
        scanned: rows.length,
        scanTruncated,
        ...plan,
      });
    }

    // Execute: offload the re-drives to after() so the response returns promptly
    // and no single request awaits a batch of full pipeline runs. Per-job audit
    // records the ACTUAL outcome (status before → after), so a resume the
    // orchestrator silently declined (retry ceiling / ineligible) is logged as
    // `no_change`, never as a requeue that did not happen.
    const dispatched = plan.eligible.map((e) => e.id);

    after(async () => {
      let requeued = 0;
      let noChange = 0;
      let failed = 0;

      for (const item of plan.eligible) {
        let before: string | null = null;
        try {
          const pre = await prisma.assessment.findUnique({
            where: { id: item.id },
            select: { status: true },
          });
          before = pre?.status ?? null;

          await resumeOrchestration(item.id);

          const post = await prisma.assessment.findUnique({
            where: { id: item.id },
            select: { status: true },
          });
          const after_ = post?.status ?? null;
          const changed = after_ !== before;
          if (changed) requeued += 1;
          else noChange += 1;

          await writeAuditLog({
            action: "ASSESSMENT_RECOVERY_REQUEUED",
            entityType: "assessment",
            entityId: item.id,
            assessmentId: item.id,
            actorId: ctx.userId,
            actorRole: ctx.role,
            actorType: "admin",
            metadata: {
              statusBefore: before,
              statusAfter: after_,
              // false = resumeOrchestration() declined (retry ceiling or
              // ineligible reclaim); the row was NOT re-driven.
              reDriven: changed,
              ageMinutes: item.ageMinutes,
              retryCount: item.retryCount,
            },
          }).catch(() => {});
        } catch (err) {
          failed += 1;
          await writeAuditLog({
            action: "ASSESSMENT_RECOVERY_REQUEUED",
            entityType: "assessment",
            entityId: item.id,
            assessmentId: item.id,
            actorId: ctx.userId,
            actorRole: ctx.role,
            actorType: "admin",
            metadata: {
              statusBefore: before,
              reDriven: false,
              error: err instanceof Error ? err.message : String(err),
            },
          }).catch(() => {});
        }
      }

      await writeAuditLog({
        action: "ASSESSMENT_RECOVERY_SWEEP",
        entityType: "platform",
        entityId: "stalled-jobs",
        actorId: ctx.userId,
        actorRole: ctx.role,
        actorType: "admin",
        metadata: {
          scanned: rows.length,
          scanTruncated,
          dispatched: dispatched.length,
          reDriven: requeued,
          noChange,
          failed,
          skipped: plan.skipped.length,
        },
      }).catch(() => {});
    });

    return NextResponse.json({
      mode: "executed",
      note: "Re-drives dispatched in the background; per-job outcome is in the audit log (ASSESSMENT_RECOVERY_REQUEUED / _SWEEP).",
      scanned: rows.length,
      scanTruncated,
      dispatched,
      dispatchedCount: dispatched.length,
      skipped: plan.skipped,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN STALLED RECOVERY]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
