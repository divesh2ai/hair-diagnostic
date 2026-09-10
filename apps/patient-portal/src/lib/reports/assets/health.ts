// Operating the render pipeline: what an on-call person needs to know, and
// the thresholds that decide whether they need to know it now.
//
// ── What is deliberately not here ───────────────────────────────────────────
// No patient identifiers, no assessment content, no report text, no storage
// paths. An operational dashboard is read by people who have every reason to
// see queue depth and no clinical reason to see a patient's diagnosis, and a
// health surface that leaks PHI is a health surface that has to be locked down
// until it is useless.

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { MAX_RENDER_ATTEMPTS } from "./contract";
import { tolerant } from "./repository";
import { isStorageConfigured } from "./storage";

export interface RenderHealth {
  /** False when the migration has not been applied — everything below is zero. */
  provisioned: boolean;
  /** False when object storage is unconfigured, which no queue depth reveals. */
  storageConfigured: boolean;

  counts: {
    pending: number;
    queued: number;
    rendering: number;
    ready: number;
    failed: number;
  };

  /** Over the trailing window, so a healthy history cannot hide a bad hour. */
  window: {
    hours: number;
    rendered: number;
    failed: number;
    /** rendered / (rendered + failed), or null when nothing was attempted. */
    successRate: number | null;
    medianRenderMs: number | null;
    p95RenderMs: number | null;
  };

  /** ISO 8601. The single most useful number on this page. */
  oldestPendingAt: string | null;
  oldestPendingAgeMinutes: number | null;

  /** Failure codes and their counts in the window. Codes only, never messages. */
  failureCodes: { code: string; count: number }[];

  alerts: RenderAlert[];
}

export interface RenderAlert {
  code:
    | "QUEUE_STALLED"
    | "FAILURE_RATE_HIGH"
    | "STORAGE_UNCONFIGURED"
    | "NOT_PROVISIONED"
    | "RENDER_STUCK";
  severity: "warn" | "critical";
  message: string;
}

/**
 * A one-pager that has been waiting this long is not slow, it is stuck.
 *
 * The retry schedule spends its whole budget inside about six minutes, so
 * anything still PENDING after fifteen has either lost every worker or is not
 * being swept at all. Both are the same page for an operator: nobody is
 * rendering.
 */
const STALLED_PENDING_MINUTES = 15;

/**
 * A lease is two minutes. A row still RENDERING after ten has been claimed by
 * workers that keep dying, which the attempt count alone would not reveal.
 */
const STUCK_RENDERING_MINUTES = 10;

/** Below this, over a window with enough attempts to mean anything, page someone. */
const MIN_SUCCESS_RATE = 0.8;
const MIN_ATTEMPTS_FOR_RATE = 5;

export async function readRenderHealth(
  opts: { windowHours?: number; clinicId?: string | null } = {},
  prisma: PrismaClient = defaultPrisma,
): Promise<RenderHealth> {
  const windowHours = opts.windowHours ?? 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const scope = opts.clinicId ? { clinicId: opts.clinicId } : {};
  const storageConfigured = isStorageConfigured();

  const empty: RenderHealth = {
    provisioned: false,
    storageConfigured,
    counts: { pending: 0, queued: 0, rendering: 0, ready: 0, failed: 0 },
    window: {
      hours: windowHours,
      rendered: 0,
      failed: 0,
      successRate: null,
      medianRenderMs: null,
      p95RenderMs: null,
    },
    oldestPendingAt: null,
    oldestPendingAgeMinutes: null,
    failureCodes: [],
    alerts: [
      {
        code: "NOT_PROVISIONED",
        severity: "warn",
        message:
          "Report rendering is not provisioned here — apply 20260907_report_asset_pipeline. Report links still send; one-pagers do not.",
      },
    ],
  };

  return tolerant(async () => {
    const grouped = await prisma.reportAsset.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    });
    const counts = {
      pending: countOf(grouped, "PENDING"),
      queued: countOf(grouped, "QUEUED"),
      rendering: countOf(grouped, "RENDERING"),
      ready: countOf(grouped, "READY"),
      failed: countOf(grouped, "FAILED"),
    };

    const oldestPending = await prisma.reportAsset.findFirst({
      where: { ...scope, status: { in: ["PENDING", "QUEUED"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    // Render duration is measured as created → generated. Not a stopwatch
    // around the browser: what a clinic experiences is the wait from approval
    // to a shareable artefact, and a fast render behind a slow queue is not a
    // fast pipeline.
    const renderedInWindow = await prisma.reportAsset.findMany({
      where: { ...scope, status: "READY", generatedAt: { gte: since } },
      select: { createdAt: true, generatedAt: true },
      take: 1000,
    });
    const durations = renderedInWindow
      .map((r) => (r.generatedAt ? r.generatedAt.getTime() - r.createdAt.getTime() : null))
      .filter((d): d is number => typeof d === "number" && d >= 0)
      .sort((a, b) => a - b);

    const failedInWindow = await prisma.reportAsset.groupBy({
      by: ["errorCode"],
      where: { ...scope, status: "FAILED", updatedAt: { gte: since } },
      _count: { _all: true },
    });
    const failedCount = failedInWindow.reduce((sum, row) => sum + row._count._all, 0);
    const attempted = durations.length + failedCount;

    const stuckRendering = await prisma.reportAsset.count({
      where: {
        ...scope,
        status: "RENDERING",
        lastAttemptAt: { lt: new Date(Date.now() - STUCK_RENDERING_MINUTES * 60_000) },
      },
    });

    const oldestAgeMinutes = oldestPending
      ? Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 60_000)
      : null;

    const successRate = attempted > 0 ? durations.length / attempted : null;

    const alerts: RenderAlert[] = [];
    if (!storageConfigured) {
      alerts.push({
        code: "STORAGE_UNCONFIGURED",
        severity: "critical",
        message:
          "Object storage is not configured — no artefact can be stored, so every render will fail.",
      });
    }
    if (oldestAgeMinutes !== null && oldestAgeMinutes > STALLED_PENDING_MINUTES) {
      alerts.push({
        code: "QUEUE_STALLED",
        severity: "critical",
        message: `Oldest one-pager has been waiting ${oldestAgeMinutes} minutes. The retry budget is spent within about six, so nothing is draining the queue.`,
      });
    }
    if (stuckRendering > 0) {
      alerts.push({
        code: "RENDER_STUCK",
        severity: "warn",
        message: `${stuckRendering} render${stuckRendering === 1 ? " has" : "s have"} held a claim past its lease — workers are dying mid-render.`,
      });
    }
    if (
      successRate !== null &&
      attempted >= MIN_ATTEMPTS_FOR_RATE &&
      successRate < MIN_SUCCESS_RATE
    ) {
      alerts.push({
        code: "FAILURE_RATE_HIGH",
        severity: "critical",
        message: `${Math.round((1 - successRate) * 100)}% of renders failed in the last ${windowHours}h (${failedCount} of ${attempted}), after up to ${MAX_RENDER_ATTEMPTS} attempts each.`,
      });
    }

    return {
      provisioned: true,
      storageConfigured,
      counts,
      window: {
        hours: windowHours,
        rendered: durations.length,
        failed: failedCount,
        successRate,
        medianRenderMs: percentile(durations, 0.5),
        p95RenderMs: percentile(durations, 0.95),
      },
      oldestPendingAt: oldestPending?.createdAt.toISOString() ?? null,
      oldestPendingAgeMinutes: oldestAgeMinutes,
      failureCodes: failedInWindow
        .map((row) => ({ code: row.errorCode ?? "UNKNOWN_RENDER_ERROR", count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      alerts,
    };
  }, empty);
}

function countOf(
  grouped: { status: string; _count: { _all: number } }[],
  status: string,
): number {
  return grouped.find((g) => g.status === status)?._count._all ?? 0;
}

/** Nearest-rank percentile over an already-sorted array. Null when empty. */
function percentile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}
