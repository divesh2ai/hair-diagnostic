import { describe, it, expect } from "vitest";
import {
  buildDashboardAttention,
  LONG_WAIT_MS,
} from "@/lib/doctor/dashboardAttention";

// The Needs-attention panel is the only place the dashboard says something is
// WRONG. Everything it claims has to come from data we actually hold, and
// silence has to be the default — a standing "all clear" on a routine day is
// what teaches a clinician to skip the region where a real warning will one
// day appear.

const NOW = Date.parse("2026-09-07T10:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("dashboard attention — silence by default", () => {
  it("says nothing at all when nothing is wrong", () => {
    const items = buildDashboardAttention({
      counts: {},
      queue: [{ submittedAt: minutesAgo(2) }],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("never emits an all-clear line", () => {
    const items = buildDashboardAttention({ counts: {}, queue: [], now: NOW });
    expect(items.map((i) => i.title).join(" ")).not.toMatch(/no red flags|all clear|everything/i);
  });
});

describe("dashboard attention — withheld records are stated, not dropped", () => {
  it("reports a pending case the queue could not offer", () => {
    const items = buildDashboardAttention({
      counts: { unopenable: 1 },
      queue: [],
      now: NOW,
    });
    const held = items.find((i) => i.key === "unopenable");
    expect(held).toBeDefined();
    expect(held!.title).toBe("1 record is held back from the queue");
    expect(held!.detail).toBe(
      "No stored assessment responses — the review cannot be opened",
    );
    // Sent to the All tab, where such a record is still visible and is NOT
    // labelled "Ready for review".
    expect(held!.href).toBe("/doctor/reports?tab=all");
  });

  it("pluralises without inventing a remedy", () => {
    const [held] = buildDashboardAttention({
      counts: { unopenable: 3 },
      queue: [],
      now: NOW,
    });
    expect(held.title).toBe("3 records are held back from the queue");
    expect(held.detail).not.toMatch(/resubmit|recover|restore|contact/i);
  });

  it("stays silent at zero rather than printing a standing 0", () => {
    const items = buildDashboardAttention({
      counts: { unopenable: 0 },
      queue: [],
      now: NOW,
    });
    expect(items.find((i) => i.key === "unopenable")).toBeUndefined();
  });
});

describe("dashboard attention — failed reports and long waits", () => {
  it("counts failed report generation as danger, not as a clinical finding", () => {
    const [failed] = buildDashboardAttention({
      counts: { needsAttention: 5 },
      queue: [],
      now: NOW,
    });
    expect(failed.title).toBe("5 reports need attention");
    expect(failed.tone).toBe("danger");
  });

  it("flags waits strictly OVER the boundary, not at it", () => {
    const atBoundary = buildDashboardAttention({
      counts: {},
      queue: [{ submittedAt: new Date(NOW - LONG_WAIT_MS).toISOString() }],
      now: NOW,
    });
    expect(atBoundary).toEqual([]);

    const past = buildDashboardAttention({
      counts: {},
      queue: [{ submittedAt: new Date(NOW - LONG_WAIT_MS - 1000).toISOString() }],
      now: NOW,
    });
    expect(past[0].title).toBe("1 patient waiting over 15 min");
  });

  it("scopes the long-wait claim to the deck, never to the clinic", () => {
    const [wait] = buildDashboardAttention({
      counts: {},
      queue: [{ submittedAt: minutesAgo(40) }, { submittedAt: minutesAgo(30) }],
      now: NOW,
    });
    expect(wait.title).toBe("2 patients waiting over 15 min");
    expect(wait.detail).toContain("In your deck");
  });

  it("ignores rows with no submission time rather than guessing one", () => {
    const items = buildDashboardAttention({
      counts: {},
      queue: [{ submittedAt: null }],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("orders danger before the two warnings", () => {
    const items = buildDashboardAttention({
      counts: { needsAttention: 2, unopenable: 1 },
      queue: [{ submittedAt: minutesAgo(60) }],
      now: NOW,
    });
    expect(items.map((i) => i.key)).toEqual(["reports", "unopenable", "long-wait"]);
  });
});
