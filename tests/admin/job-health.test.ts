// Platform health — stalled work must not read as healthy.
//
// The bug this locks down: health was `100 − (FAILED ÷ assessments)`, so an
// assessment wedged mid-pipeline scored as success (it never reaches a
// terminal state) and PARTIAL_FAILURE scored as success too (it is not
// FAILED). Observed on staging: 5 partial failures and 4 assessments stalled
// for six days, zero FAILED, and the console reporting 100/100 "Healthy".
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/admin/job-health.test.ts

import { describe, it, expect } from "@jest/globals";
import {
  classifyJob,
  computePlatformHealth,
  IN_FLIGHT_STATUSES,
  FAILURE_STATUSES,
  RESTING_STATUSES,
  STALE_AFTER_MINUTES,
} from "@/lib/admin/jobHealth";

const NOW = new Date("2026-08-31T12:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

describe("classifyJob", () => {
  it("calls a fresh in-flight job processing, not stalled", () => {
    expect(
      classifyJob({ status: "GENERATING_REPORT", updatedAt: minutesAgo(5) }, NOW),
    ).toBe("processing");
  });

  it("calls an in-flight job past the threshold stalled", () => {
    expect(
      classifyJob(
        { status: "GENERATING_REPORT", updatedAt: minutesAgo(STALE_AFTER_MINUTES + 1) },
        NOW,
      ),
    ).toBe("stalled");
  });

  it("does not flip exactly at the threshold — strictly greater than", () => {
    expect(
      classifyJob(
        { status: "QUEUED", updatedAt: minutesAgo(STALE_AFTER_MINUTES) },
        NOW,
      ),
    ).toBe("processing");
  });

  it("classifies every in-flight status as stalled once old enough", () => {
    for (const status of IN_FLIGHT_STATUSES) {
      expect(
        classifyJob({ status, updatedAt: minutesAgo(60 * 24 * 6) }, NOW),
      ).toBe("stalled");
    }
  });

  it("never calls a resting state stalled, however old", () => {
    // A case waiting on a doctor is clinical backlog, not a wedged pipeline.
    // Counting it here would flood the operational signal and bury the one
    // genuinely broken job.
    for (const status of RESTING_STATUSES) {
      const veryOld = classifyJob(
        { status, updatedAt: minutesAgo(60 * 24 * 90) },
        NOW,
      );
      expect(veryOld).not.toBe("stalled");
    }
  });

  it("reports both failure statuses as failed", () => {
    for (const status of FAILURE_STATUSES) {
      expect(classifyJob({ status, updatedAt: minutesAgo(1) }, NOW)).toBe(
        "failed",
      );
    }
  });

  it("does not treat an unrecognised status as healthy", () => {
    expect(
      classifyJob({ status: "SOME_NEW_STATUS", updatedAt: minutesAgo(1) }, NOW),
    ).toBe("processing");
  });
});

describe("computePlatformHealth", () => {
  it("reports healthy when nothing is failed or stalled", () => {
    const h = computePlatformHealth({
      windowTotal: 20,
      failed: 0,
      partialFailure: 0,
      stalled: 0,
    });
    expect(h.band).toBe("healthy");
    expect(h.score).toBe(100);
  });

  it("REGRESSION: a single stalled job cannot read as healthy", () => {
    // The exact staging shape: no terminal failures at all, so the failure
    // rate is 0 and the score is a perfect 100 — but work is wedged, so the
    // band must not say healthy.
    const h = computePlatformHealth({
      windowTotal: 20,
      failed: 0,
      partialFailure: 0,
      stalled: 1,
    });
    expect(h.score).toBe(100);
    expect(h.band).toBe("watch");
    expect(h.reasons.join(" ")).toMatch(/stalled/i);
  });

  it("REGRESSION: partial failures are counted as failures", () => {
    const h = computePlatformHealth({
      windowTotal: 10,
      failed: 0,
      partialFailure: 5,
      stalled: 0,
    });
    expect(h.failureRatePct).toBe(50);
    expect(h.score).toBe(50);
    expect(h.band).toBe("critical");
  });

  it("reproduces the observed staging state as not-healthy", () => {
    // 5 partial failures, 4 stalled, 0 failed — previously 100/100 Healthy.
    const h = computePlatformHealth({
      windowTotal: 32,
      failed: 0,
      partialFailure: 5,
      stalled: 4,
    });
    expect(h.band).not.toBe("healthy");
    expect(h.stalled).toBe(4);
    expect(h.partialFailure).toBe(5);
  });

  it("degrades on five or more stalled jobs regardless of failure rate", () => {
    const h = computePlatformHealth({
      windowTotal: 1000,
      failed: 0,
      partialFailure: 0,
      stalled: 5,
    });
    expect(h.band).toBe("critical");
  });

  it("returns unknown, not 100, when there is nothing to measure", () => {
    // A total intake outage used to display as maximum health.
    const h = computePlatformHealth({
      windowTotal: 0,
      failed: 0,
      partialFailure: 0,
      stalled: 0,
    });
    expect(h.score).toBeNull();
    expect(h.band).toBe("unknown");
  });

  it("still surfaces stalled work when the window itself is empty", () => {
    const h = computePlatformHealth({
      windowTotal: 0,
      failed: 0,
      partialFailure: 0,
      stalled: 3,
    });
    expect(h.band).toBe("watch");
    expect(h.score).toBeNull();
  });

  it("clamps the score to 0 and never goes negative", () => {
    const h = computePlatformHealth({
      windowTotal: 10,
      failed: 8,
      partialFailure: 6,
      stalled: 0,
    });
    expect(h.score).toBe(0);
    expect(h.band).toBe("critical");
  });

  it("always states a reason for a non-healthy band", () => {
    const h = computePlatformHealth({
      windowTotal: 10,
      failed: 1,
      partialFailure: 0,
      stalled: 2,
    });
    expect(h.band).not.toBe("healthy");
    expect(h.reasons.length).toBeGreaterThan(0);
  });
});
