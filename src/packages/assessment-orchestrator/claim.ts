// Atomic single-flight claim for Phase A, plus a lease/reclaim path so a
// crashed worker cannot strand an assessment mid-run.
//
// The claim uses updateMany with a status-guarded WHERE clause — the DB does
// the compare-and-set atomically. count === 0 ⇒ someone else already owns
// the run (or no such row).
//
// Lease model (Phase A only — Phase B is guarded by status compare-and-set +
// the AIArtifact.assessmentId_type unique constraint, NOT this lease):
//
//   1. claimPhaseA writes { phaseAExecutionId, phaseALeaseExpiresAt } atop
//      the status transition. This is the sole write that mints a lease.
//   2. Any intra-Phase-A state mutation goes through renewLease(), which
//      requires the current row still carries this executionId. A late
//      original worker whose lease was reclaimed hits a WHERE-mismatch and
//      LeaseLostError; it aborts without overwriting the new worker's state.
//   3. reclaimStalePhaseA atomically replaces an expired lease's
//      executionId + status with a fresh execution and returns the new
//      execution's identifiers, or throws if the row is not actually stale
//      or has exhausted its retry budget.
//
// The lease deliberately does NOT extend to Phase B (report generation),
// which is safe through Assessment.status compare-and-set (PARTIAL_FAILURE|
// COMPLETED → REPORT_GENERATING) plus the existing unique REPORT artifact
// upsert.

import type { PrismaClient } from "@prisma/client";
import { AssessmentStatus } from "@prisma/client";

export const PHASE_A_STARTABLE_STATES: AssessmentStatus[] = [
  AssessmentStatus.PENDING,
  AssessmentStatus.QUEUED,
  AssessmentStatus.FAILED,
  AssessmentStatus.PARTIAL_FAILURE,
];

// Statuses that mean "Phase A is in-flight". A row stuck in one of these
// with an expired lease is a candidate for reclaim.
export const PHASE_A_IN_FLIGHT_STATES: AssessmentStatus[] = [
  AssessmentStatus.NORMALIZING,
  AssessmentStatus.RUNNING_CLINICAL_ENGINE,
  AssessmentStatus.GENERATING_RECOMMENDATIONS,
];

/**
 * Default lease TTL. Long enough for the slowest observed clinical pipeline
 * (single-digit seconds) plus a wide safety margin; short enough that a
 * crashed worker isn't waited on for hours. Callers may override for tests.
 */
export const DEFAULT_PHASE_A_LEASE_MS = 90_000;

/**
 * Bounded retry count for reclaim. A row that has been reclaimed this many
 * times without succeeding is dead — refuse further reclaims and leave it
 * for manual triage. Aligns with the existing MAX_RETRIES in resume().
 */
export const MAX_PHASE_A_ATTEMPTS = 3;

export class PhaseAAlreadyRunningError extends Error {
  constructor(
    public readonly assessmentId: string,
    public readonly currentStatus: AssessmentStatus | null,
    public readonly executionId: string | null,
  ) {
    super(
      `Assessment ${assessmentId} already has an active or completed run ` +
        `(status=${currentStatus ?? "missing"}, executionId=${executionId ?? "null"})`,
    );
    this.name = "PhaseAAlreadyRunningError";
  }
}

export class LeaseLostError extends Error {
  constructor(
    public readonly assessmentId: string,
    public readonly executionId: string,
  ) {
    super(
      `Phase A lease for assessment ${assessmentId} is no longer owned by ` +
        `execution ${executionId} — worker must abort without further writes`,
    );
    this.name = "LeaseLostError";
  }
}

export class ReclaimNotEligibleError extends Error {
  constructor(
    public readonly assessmentId: string,
    public readonly reason:
      | "not_stale"
      | "not_found"
      | "max_attempts_reached",
  ) {
    super(`Cannot reclaim Phase A for ${assessmentId}: ${reason}`);
    this.name = "ReclaimNotEligibleError";
  }
}

export interface ClaimResult {
  executionId: string;
  claimedAt: Date;
  leaseExpiresAt: Date;
  attempt: number;
}

/**
 * Attempt to claim Phase A for `assessmentId`. Resolves with the new
 * executionId + lease on success. Throws `PhaseAAlreadyRunningError` if
 * another caller already owns the row (or the row is in a non-runnable state).
 */
export async function claimPhaseA(
  prisma: PrismaClient,
  assessmentId: string,
  executionId: string,
  now: Date = new Date(),
  leaseMs: number = DEFAULT_PHASE_A_LEASE_MS,
): Promise<ClaimResult> {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  const claim = await prisma.assessment.updateMany({
    where: {
      id: assessmentId,
      status: { in: PHASE_A_STARTABLE_STATES },
    },
    data: {
      status: AssessmentStatus.NORMALIZING,
      executionId,
      phaseAExecutionId: executionId,
      phaseALeaseExpiresAt: leaseExpiresAt,
      phaseAAttempt: { increment: 1 },
      queuedAt: now,
      startedAt: now,
    },
  });

  if (claim.count === 0) {
    const current = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { status: true, executionId: true },
    });
    throw new PhaseAAlreadyRunningError(
      assessmentId,
      current?.status ?? null,
      current?.executionId ?? null,
    );
  }

  const after = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { phaseAAttempt: true },
  });

  return {
    executionId,
    claimedAt: now,
    leaseExpiresAt,
    attempt: after?.phaseAAttempt ?? 1,
  };
}

/**
 * Guarded write helper: mutate an in-flight Phase A row only if this worker
 * still owns the lease. Uses an updateMany with a strict WHERE — a stale
 * worker whose executionId was replaced by reclaim gets count===0 and
 * LeaseLostError.
 *
 * Callers pass `data` in Prisma UncheckedUpdateInput shape. The lease itself
 * is refreshed on every guarded write so a slow (but alive) Phase A does not
 * accidentally look stale to a concurrent reclaim scan.
 */
export async function renewLease(
  prisma: PrismaClient,
  assessmentId: string,
  executionId: string,
  data: Record<string, unknown>,
  now: Date = new Date(),
  leaseMs: number = DEFAULT_PHASE_A_LEASE_MS,
): Promise<void> {
  const result = await prisma.assessment.updateMany({
    where: {
      id: assessmentId,
      phaseAExecutionId: executionId,
    },
    data: {
      ...data,
      phaseALeaseExpiresAt: new Date(now.getTime() + leaseMs),
    },
  });
  if (result.count === 0) {
    throw new LeaseLostError(assessmentId, executionId);
  }
}

export interface ReclaimResult {
  oldExecutionId: string | null;
  newExecutionId: string;
  attempt: number;
  staleMs: number;
  leaseExpiresAt: Date;
}

/**
 * Reclaim a stuck Phase A execution. Atomic compare-and-set on
 * (status IN in-flight AND phaseALeaseExpiresAt < now AND phaseAAttempt < MAX).
 * The winner mints a fresh executionId, the loser sees count===0 and gets
 * ReclaimNotEligibleError so the caller can back off.
 *
 * NOTE: this function does not itself start the pipeline — the caller must
 * fall through to the normal runAssessmentPhaseA() path after a successful
 * reclaim. The reclaim just makes the row claimable again.
 */
export async function reclaimStalePhaseA(
  prisma: PrismaClient,
  assessmentId: string,
  newExecutionId: string,
  now: Date = new Date(),
  leaseMs: number = DEFAULT_PHASE_A_LEASE_MS,
): Promise<ReclaimResult> {
  const before = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      status: true,
      phaseAExecutionId: true,
      phaseALeaseExpiresAt: true,
      phaseAAttempt: true,
    },
  });
  if (!before) {
    throw new ReclaimNotEligibleError(assessmentId, "not_found");
  }
  if (before.phaseAAttempt >= MAX_PHASE_A_ATTEMPTS) {
    throw new ReclaimNotEligibleError(assessmentId, "max_attempts_reached");
  }

  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  const result = await prisma.assessment.updateMany({
    where: {
      id: assessmentId,
      status: { in: PHASE_A_IN_FLIGHT_STATES },
      phaseALeaseExpiresAt: { lt: now },
      phaseAAttempt: { lt: MAX_PHASE_A_ATTEMPTS },
    },
    data: {
      // Move back into a startable state so claimPhaseA can win next.
      status: AssessmentStatus.QUEUED,
      phaseAExecutionId: newExecutionId,
      phaseALeaseExpiresAt: leaseExpiresAt,
    },
  });

  if (result.count === 0) {
    throw new ReclaimNotEligibleError(assessmentId, "not_stale");
  }

  const staleMs = before.phaseALeaseExpiresAt
    ? Math.max(0, now.getTime() - before.phaseALeaseExpiresAt.getTime())
    : 0;

  return {
    oldExecutionId: before.phaseAExecutionId,
    newExecutionId,
    attempt: before.phaseAAttempt,
    staleMs,
    leaseExpiresAt,
  };
}
