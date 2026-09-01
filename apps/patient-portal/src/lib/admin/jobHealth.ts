// Operational health of the assessment pipeline.
//
// ── The problem this fixes ──────────────────────────────────────────────────
// Platform health was `100 − (FAILED ÷ assessments)` over a rolling 7 days.
// Two things fall through that:
//
//   1. PARTIAL_FAILURE is not FAILED, so it scored as success.
//   2. A job wedged mid-pipeline never reaches a terminal state at all, so it
//      is invisible to a formula that only counts terminal failures.
//
// Observed on staging while writing this: 5 PARTIAL_FAILURE and 4 assessments
// stalled mid-pipeline for over six days, with zero FAILED — so the console
// reported 100/100 "Healthy" while nine records needed a human.
//
// ── Deliberately not a cleverer formula ─────────────────────────────────────
// The score stays the windowed failure-rate complement it always was, so the
// number does not silently change meaning. What is new is that stalled work is
// COUNTED and can pull the BAND down on its own. A band is a claim an operator
// can check; a weighted composite score is a number nobody can argue with.
//
// Nothing here writes to the database. A job is never re-statused just because
// it is old — staleness is an observation about a row, not a change to it.

import type { AssessmentStatus } from "@prisma/client";

/**
 * Statuses where the pipeline is actively expected to make progress. A row
 * sitting in one of these past the threshold below is stalled.
 */
export const IN_FLIGHT_STATUSES = [
  "PENDING",
  "QUEUED",
  "NORMALIZING",
  "RUNNING_CLINICAL_ENGINE",
  "GENERATING_RECOMMENDATIONS",
  "GENERATING_NARRATIVE",
  "GENERATING_VIDEO_SCRIPT",
  "RENDERING_VIDEO",
  "GENERATING_REPORT",
  "REPORT_GENERATING",
] as const satisfies readonly AssessmentStatus[];

/**
 * Terminal failures. PARTIAL_FAILURE belongs here: the patient's record is
 * incomplete and somebody has to look at it, which is the only test that
 * matters for an operational health signal.
 */
export const FAILURE_STATUSES = [
  "FAILED",
  "PARTIAL_FAILURE",
] as const satisfies readonly AssessmentStatus[];

/**
 * Resting states — NOT stalled however long they sit.
 *
 * CLINICAL_READY and COMPLETED are both waiting on a human, not on the
 * pipeline. Counting a case that has been waiting three days for a doctor as
 * a "stuck job" would flood the operational signal with clinical backlog and
 * make the one genuinely wedged pipeline invisible.
 */
export const RESTING_STATUSES = [
  "CLINICAL_READY",
  "COMPLETED",
] as const satisfies readonly AssessmentStatus[];

/**
 * How long an in-flight assessment may go without a write before it is called
 * stalled.
 *
 * Chosen conservatively. A healthy run moves through the whole pipeline in
 * minutes, so 60 minutes is roughly an order of magnitude of headroom — late
 * enough that a slow or retrying run is never libelled, early enough that a
 * genuinely wedged job surfaces the same working day. The stalled rows on
 * staging were six days old; nothing here is a close call.
 *
 * Exported so the API can state the threshold it used rather than leaving the
 * reader to guess what "stuck" meant.
 */
export const STALE_AFTER_MINUTES = 60;

export type JobClass =
  | "processing"
  | "stalled"
  | "awaiting_review"
  | "completed"
  | "failed";

const IN_FLIGHT: ReadonlySet<string> = new Set<string>(IN_FLIGHT_STATUSES);
const FAILED: ReadonlySet<string> = new Set<string>(FAILURE_STATUSES);

export interface JobLike {
  status: AssessmentStatus | string;
  /** Last write to the row. The pipeline touches this on every transition. */
  updatedAt: Date;
}

/**
 * Classify one assessment. Pure: same inputs, same answer, no clock of its
 * own — `now` is passed in so tests do not have to travel in time.
 */
export function classifyJob(
  job: JobLike,
  now: Date,
  staleAfterMinutes: number = STALE_AFTER_MINUTES,
): JobClass {
  if (FAILED.has(job.status)) return "failed";
  if (job.status === "COMPLETED") return "completed";
  if (job.status === "CLINICAL_READY") return "awaiting_review";

  if (IN_FLIGHT.has(job.status)) {
    const ageMinutes = (now.getTime() - job.updatedAt.getTime()) / 60_000;
    return ageMinutes > staleAfterMinutes ? "stalled" : "processing";
  }

  // An unrecognised status is not silently treated as healthy. Reporting it as
  // processing keeps it in view without asserting a failure we cannot prove.
  return "processing";
}

/**
 * The product's three operational states, plus "unknown".
 *
 * Named to match how an operator would describe the platform out loud, not how
 * a rate behaves:
 *   healthy   no meaningful operational exception
 *   watch     problems exist and need attention; the platform still works
 *   critical  a workflow or system failure needs intervention
 *   unknown   nothing happened in the window — no evidence either way
 */
export type HealthBand = "healthy" | "watch" | "critical" | "unknown";

export interface HealthInput {
  /** Assessments created inside the rolling window. Denominator for the rate. */
  windowTotal: number;
  /** FAILED inside the window. */
  failed: number;
  /** PARTIAL_FAILURE inside the window. */
  partialFailure: number;
  /**
   * Stalled in-flight assessments. Counted across ALL time on purpose: a job
   * wedged nine days ago is still wedged today, and a window would let it age
   * out of the health signal while still being broken.
   */
  stalled: number;
}

export interface HealthResult {
  /**
   * 100 − windowed failure rate, or `null` when the window is empty.
   *
   * Null rather than 100. The old code returned a perfect score for a quiet
   * week, which meant a total intake outage — zero assessments arriving —
   * displayed as maximum health.
   */
  score: number | null;
  band: HealthBand;
  failureRatePct: number | null;
  windowTotal: number;
  failed: number;
  partialFailure: number;
  stalled: number;
  staleAfterMinutes: number;
  /** Plain-language justification for the band. Rendered, not just logged. */
  reasons: string[];
}

/**
 * Combine the counts into a score, a band and the reasons for the band.
 *
 * ── The score is a RATE, not a health grade ────────────────────────────────
 * `score` is 100 minus the windowed failure rate and nothing more. It knows
 * nothing about stalled work, which is why it can read 100 while four jobs are
 * wedged. Presenting it as "100/100" next to a "Watch" badge was therefore a
 * contradiction the UI created, not a bug in the arithmetic — the number was
 * answering a narrower question than its label claimed.
 *
 * The maths below is unchanged. `band` is the operational verdict and the
 * thing to lead with; the score is a supporting statistic and must be labelled
 * as the failure rate it is.
 *
 * Band rules, in precedence order:
 *   critical  failure rate ≥ 30%, or 5+ stalled jobs
 *   watch     failure rate ≥ 10%, or any stalled job, or any partial failure
 *   unknown   nothing in the window and nothing stalled — no evidence either way
 *   healthy   everything else
 *
 * A single stalled job is enough to leave "healthy". That is the whole point:
 * the previous behaviour was to report perfect health with work wedged.
 */
export function computePlatformHealth(input: HealthInput): HealthResult {
  const { windowTotal, failed, partialFailure, stalled } = input;
  const failures = failed + partialFailure;

  const failureRatePct =
    windowTotal > 0 ? Math.round((failures / windowTotal) * 100) : null;

  const score =
    failureRatePct === null
      ? null
      : Math.min(100, Math.max(0, 100 - failureRatePct));

  const reasons: string[] = [];
  if (failed > 0) {
    reasons.push(`${failed} assessment${failed === 1 ? "" : "s"} failed in the last 7 days`);
  }
  if (partialFailure > 0) {
    reasons.push(
      `${partialFailure} completed with partial failure in the last 7 days`,
    );
  }
  if (stalled > 0) {
    reasons.push(
      `${stalled} assessment${stalled === 1 ? " is" : "s are"} stalled mid-pipeline ` +
        `(no progress for over ${STALE_AFTER_MINUTES} minutes)`,
    );
  }

  let band: HealthBand;
  if ((failureRatePct !== null && failureRatePct >= 30) || stalled >= 5) {
    band = "critical";
  } else if (
    (failureRatePct !== null && failureRatePct >= 10) ||
    stalled > 0 ||
    partialFailure > 0
  ) {
    band = "watch";
  } else if (windowTotal === 0 && stalled === 0) {
    band = "unknown";
    reasons.push("No assessments in the last 7 days — nothing to measure");
  } else {
    band = "healthy";
    reasons.push("No failed or stalled work in the last 7 days");
  }

  return {
    score,
    band,
    failureRatePct,
    windowTotal,
    failed,
    partialFailure,
    stalled,
    staleAfterMinutes: STALE_AFTER_MINUTES,
    reasons,
  };
}
