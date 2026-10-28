// Stalled-job recovery selection for the Super Admin command centre.
//
// ── Why this exists ──────────────────────────────────────────────────────────
// Assessment orchestration runs inside the request lambda's `after()` window
// (see lib/orchestration/dispatch.ts) — there is no durable external queue in
// the deployed configuration (Inngest is documented but not wired). If the
// lambda freezes or times out mid-pipeline, the row is left in an in-flight
// status with `retryCount = 0` and NO error recorded (the orchestrator's own
// failure handler never got to run), and nothing ever drives it again.
//
// Observed on staging: 5 assessments wedged this way — 3 in GENERATING_REPORT /
// REPORT_GENERATING / QUEUED since Aug 24, and 2 in PENDING since Oct 13 — all
// with retryCount 0 and no lastError. The health band already SURFACES them
// (lib/admin/jobHealth), but nothing RECOVERS them.
//
// ── What this module is (and is not) ─────────────────────────────────────────
// This is the pure, side-effect-free SELECTOR: given already-loaded rows and a
// clock, it decides which jobs are safe to re-drive and which must be left
// alone, and WHY. It performs no I/O and re-statuses nothing. The actual
// re-drive is done by the recover route, which hands each eligible id to the
// existing `resumeOrchestration()` primitive — the same idempotent re-entry
// path used everywhere else. Nothing here (or there) deletes, closes, or
// fabricates a terminal state to flatter the dashboard.

import { IN_FLIGHT_STATUSES, STALE_AFTER_MINUTES } from "@/lib/admin/jobHealth";

/**
 * Recovery retry ceiling. A row re-driven this many times without reaching a
 * terminal state is left for manual triage rather than re-driven forever.
 * Deliberately equal to the orchestrator's own `MAX_RETRIES` and
 * `MAX_PHASE_A_ATTEMPTS` (both 3) so this selector never offers a job the
 * orchestrator would then refuse — the two agree on what "dead" means.
 */
export const MAX_RECOVERY_RETRIES = 3;

/** Default cap on how many jobs one sweep will re-drive. */
export const DEFAULT_RECOVERY_LIMIT = 25;

/** The minimal shape the selector needs from an Assessment row. */
export type RecoveryCandidateRow = {
  id: string;
  status: string;
  /** Last write to the row. The pipeline touches this on every transition. */
  updatedAt: Date;
  /** Completed recovery attempts so far. */
  retryCount: number;
  /**
   * Phase-A lease expiry, when the row carries one. A value in the FUTURE
   * means a worker is (or very recently was) actively running this row, so it
   * must never be double-driven. Null/absent means no live owner.
   */
  phaseALeaseExpiresAt?: Date | null;
};

export type SkipReason =
  | "not_in_flight"
  | "not_stale"
  | "live_lease"
  | "max_retries_exhausted"
  | "over_batch_limit";

export type RecoveryPlanItem = {
  id: string;
  status: string;
  ageMinutes: number;
  retryCount: number;
};

export type SkippedItem = { id: string; reason: SkipReason };

export type RecoveryPlan = {
  eligible: RecoveryPlanItem[];
  skipped: SkippedItem[];
  staleAfterMinutes: number;
  maxRetries: number;
  limit: number;
};

const IN_FLIGHT: ReadonlySet<string> = new Set<string>(IN_FLIGHT_STATUSES);

/**
 * Decide which stalled jobs to re-drive. Pure: same inputs, same answer, no
 * clock of its own (`now` is injected so tests need not travel in time).
 *
 * A row is ELIGIBLE only when ALL hold:
 *   • status is an in-flight (actively-progressing) status, and
 *   • it has gone longer than `staleAfterMinutes` without a write, and
 *   • it has no live lease (no owner currently running it), and
 *   • it has not exhausted the retry ceiling.
 *
 * Everything else is reported in `skipped` with the reason, so the sweep is a
 * list an operator can argue with rather than an opaque number. Oldest rows
 * are considered first — a job wedged longest is the most urgent and the least
 * likely to still have a live worker.
 */
export function selectRecoverableJobs(
  rows: RecoveryCandidateRow[],
  now: Date = new Date(),
  opts: { staleAfterMinutes?: number; maxRetries?: number; limit?: number } = {},
): RecoveryPlan {
  const staleAfterMinutes = opts.staleAfterMinutes ?? STALE_AFTER_MINUTES;
  const maxRetries = opts.maxRetries ?? MAX_RECOVERY_RETRIES;
  const limit = opts.limit ?? DEFAULT_RECOVERY_LIMIT;

  const eligible: RecoveryPlanItem[] = [];
  const skipped: SkippedItem[] = [];

  const ordered = [...rows].sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  );

  for (const row of ordered) {
    if (!IN_FLIGHT.has(row.status)) {
      skipped.push({ id: row.id, reason: "not_in_flight" });
      continue;
    }

    const ageMinutes = (now.getTime() - row.updatedAt.getTime()) / 60_000;
    if (ageMinutes <= staleAfterMinutes) {
      skipped.push({ id: row.id, reason: "not_stale" });
      continue;
    }

    if (
      row.phaseALeaseExpiresAt &&
      row.phaseALeaseExpiresAt.getTime() > now.getTime()
    ) {
      skipped.push({ id: row.id, reason: "live_lease" });
      continue;
    }

    if (row.retryCount >= maxRetries) {
      skipped.push({ id: row.id, reason: "max_retries_exhausted" });
      continue;
    }

    if (eligible.length >= limit) {
      // Over the per-sweep cap. Not an error — these are genuinely recoverable
      // and will be picked up by the next sweep. Reported so the count is
      // never silently lost.
      skipped.push({ id: row.id, reason: "over_batch_limit" });
      continue;
    }

    eligible.push({
      id: row.id,
      status: row.status,
      ageMinutes: Math.round(ageMinutes),
      retryCount: row.retryCount,
    });
  }

  return { eligible, skipped, staleAfterMinutes, maxRetries, limit };
}
