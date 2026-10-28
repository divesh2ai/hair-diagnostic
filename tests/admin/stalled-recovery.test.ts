// Stalled-job recovery selection — the rules that decide which wedged
// assessments are safe to re-drive and which must be left alone.
//
// These lock down the fix for the 5 stalled jobs observed on staging: jobs
// abandoned mid-pipeline (lambda died, retryCount 0, no error) must be
// re-driven, while jobs with a live worker, a fresh write, or an exhausted
// retry budget must NOT be touched. The selector is pure, so no DB is needed.
//
// Runner: vitest (`npm test`).

import { describe, it, expect } from "vitest";
import {
  selectRecoverableJobs,
  MAX_RECOVERY_RETRIES,
  DEFAULT_RECOVERY_LIMIT,
  type RecoveryCandidateRow,
} from "@/lib/admin/stalledRecovery";
import { STALE_AFTER_MINUTES } from "@/lib/admin/jobHealth";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const minutesAhead = (n: number) => new Date(NOW.getTime() + n * 60_000);

function row(over: Partial<RecoveryCandidateRow> = {}): RecoveryCandidateRow {
  return {
    id: over.id ?? "a1",
    status: over.status ?? "GENERATING_REPORT",
    updatedAt: over.updatedAt ?? minutesAgo(STALE_AFTER_MINUTES + 60),
    retryCount: over.retryCount ?? 0,
    phaseALeaseExpiresAt:
      "phaseALeaseExpiresAt" in over ? over.phaseALeaseExpiresAt : null,
  };
}

describe("selectRecoverableJobs — eligibility", () => {
  it("re-drives a stale in-flight job with no lease and retries left", () => {
    const plan = selectRecoverableJobs([row({ id: "stuck" })], NOW);
    expect(plan.eligible.map((e) => e.id)).toEqual(["stuck"]);
    expect(plan.skipped).toHaveLength(0);
  });

  it("reproduces the 5 staging stalled jobs as all-eligible", () => {
    // 3 DrFACT Mumbai (Aug 24) + 2 Acube (Oct 13), all in-flight, retry 0, no lease.
    const rows: RecoveryCandidateRow[] = [
      row({ id: "mum-queued", status: "QUEUED", updatedAt: new Date("2026-08-24T00:00:00Z") }),
      row({ id: "mum-genrep", status: "GENERATING_REPORT", updatedAt: new Date("2026-08-24T00:00:00Z") }),
      row({ id: "mum-reprep", status: "REPORT_GENERATING", updatedAt: new Date("2026-08-24T00:00:00Z") }),
      row({ id: "acube-1", status: "PENDING", updatedAt: new Date("2026-10-13T00:00:00Z") }),
      row({ id: "acube-2", status: "PENDING", updatedAt: new Date("2026-10-13T00:00:00Z") }),
    ];
    const plan = selectRecoverableJobs(rows, NOW);
    expect(plan.eligible).toHaveLength(5);
    expect(plan.skipped).toHaveLength(0);
  });
});

describe("selectRecoverableJobs — things it must NOT touch", () => {
  it("skips a resting status (not in-flight), e.g. CLINICAL_READY", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "resting", status: "CLINICAL_READY" })],
      NOW,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skipped).toEqual([{ id: "resting", reason: "not_in_flight" }]);
  });

  it("skips a COMPLETED job", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "done", status: "COMPLETED" })],
      NOW,
    );
    expect(plan.skipped).toEqual([{ id: "done", reason: "not_in_flight" }]);
  });

  it("skips a job still within the stale window (a live run, not wedged)", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "fresh", updatedAt: minutesAgo(STALE_AFTER_MINUTES - 1) })],
      NOW,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skipped).toEqual([{ id: "fresh", reason: "not_stale" }]);
  });

  it("treats the staleness boundary as exclusive (exactly threshold = not stale)", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "edge", updatedAt: minutesAgo(STALE_AFTER_MINUTES) })],
      NOW,
    );
    expect(plan.skipped).toEqual([{ id: "edge", reason: "not_stale" }]);
  });

  it("skips a job whose Phase-A lease is still live (a worker owns it)", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "owned", phaseALeaseExpiresAt: minutesAhead(1) })],
      NOW,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skipped).toEqual([{ id: "owned", reason: "live_lease" }]);
  });

  it("re-drives a job whose lease has EXPIRED (the worker is gone)", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "expired", phaseALeaseExpiresAt: minutesAgo(5) })],
      NOW,
    );
    expect(plan.eligible.map((e) => e.id)).toEqual(["expired"]);
  });

  it("refuses a job that has exhausted the retry ceiling", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "dead", retryCount: MAX_RECOVERY_RETRIES })],
      NOW,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skipped).toEqual([
      { id: "dead", reason: "max_retries_exhausted" },
    ]);
  });

  it("still re-drives at one below the ceiling", () => {
    const plan = selectRecoverableJobs(
      [row({ id: "lastchance", retryCount: MAX_RECOVERY_RETRIES - 1 })],
      NOW,
    );
    expect(plan.eligible.map((e) => e.id)).toEqual(["lastchance"]);
  });
});

describe("selectRecoverableJobs — ordering & batch cap", () => {
  it("considers the oldest-stuck jobs first", () => {
    const rows = [
      row({ id: "newer", updatedAt: minutesAgo(120) }),
      row({ id: "older", updatedAt: minutesAgo(600) }),
    ];
    const plan = selectRecoverableJobs(rows, NOW);
    expect(plan.eligible.map((e) => e.id)).toEqual(["older", "newer"]);
  });

  it("caps the batch and reports the overflow as skipped (not lost)", () => {
    const rows: RecoveryCandidateRow[] = Array.from({ length: 5 }, (_, i) =>
      row({ id: `j${i}`, updatedAt: minutesAgo(200 + i) }),
    );
    const plan = selectRecoverableJobs(rows, NOW, { limit: 2 });
    expect(plan.eligible).toHaveLength(2);
    expect(plan.skipped).toHaveLength(3);
    expect(plan.skipped.every((s) => s.reason === "over_batch_limit")).toBe(true);
  });

  it("defaults to DEFAULT_RECOVERY_LIMIT when no limit is given", () => {
    const rows: RecoveryCandidateRow[] = Array.from(
      { length: DEFAULT_RECOVERY_LIMIT + 3 },
      (_, i) => row({ id: `j${i}`, updatedAt: minutesAgo(200 + i) }),
    );
    const plan = selectRecoverableJobs(rows, NOW);
    expect(plan.eligible).toHaveLength(DEFAULT_RECOVERY_LIMIT);
    expect(plan.skipped).toHaveLength(3);
  });
});
