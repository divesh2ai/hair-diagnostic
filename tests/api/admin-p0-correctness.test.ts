// Super Admin P0 correctness — regression suite.
//
// These tests exist because every defect below shipped silently. None of them
// threw, none of them logged; they simply reported numbers that were not true,
// or (in the funnel's case) failed in a way the UI swallowed. Assertions here
// are therefore written against the QUERY SHAPE as well as the output value —
// a health score can be "90" for the right or the wrong reason, and only the
// query tells you which.
//
// Runner: JEST, not vitest. `npm test` runs vitest, which will report this
// file as a failure because it uses jest.mock. Run it with:
//   npx jest tests/api/admin-p0-correctness.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type Where = Record<string, unknown>;
type Call = { model: string; op: string; args: Where };

// Every prisma model call records itself and returns an opaque marker. The
// markers are what $transaction receives, so we can assert on the exact
// queries a route issued without a database.
const calls: Call[] = [];
let txResults: unknown[] = [];

function recorder(model: string, op: string) {
  return (args?: Where) => {
    calls.push({ model, op, args: args ?? {} });
    return { __marker: `${model}.${op}` };
  };
}

// Same recording, but resolves to an empty array. The audit route enriches its
// rows at read time (actor identity, clinic attribution) with lookups that run
// OUTSIDE $transaction, so those calls receive the real return value and must
// be iterable. $transaction ignores the ops it is handed, so a list-returning
// recorder is safe for models the dashboard also batches.
function recorderList(model: string, op: string) {
  return (args?: Where) => {
    calls.push({ model, op, args: args ?? {} });
    return Promise.resolve([] as unknown[]);
  };
}

const prismaMock = {
  $transaction: (ops: unknown[]) => Promise.resolve(txResults),
  assessment: {
    count: recorder("assessment", "count"),
    findMany: recorder("assessment", "findMany"),
  },
  clinic: { count: recorder("clinic", "count"), findMany: recorderList("clinic", "findMany") },
  doctor: { count: recorder("doctor", "count"), findMany: recorderList("doctor", "findMany") },
  patient: { count: recorder("patient", "count") },
  kitOrderIntent: { count: recorder("kitOrderIntent", "count") },
  orchestrationLog: { findMany: recorder("orchestrationLog", "findMany") },
  auditLog: {
    findMany: recorder("auditLog", "findMany"),
    count: recorder("auditLog", "count"),
    // The audit CSV export now records itself as AUDIT_LOG_EXPORTED and fails
    // closed, so the export path writes a row before it returns the file.
    create: recorder("auditLog", "create"),
    // The action facet is the union of the canonical taxonomy and the distinct
    // actions actually present, so pre-canonical values stay selectable. It
    // runs on every audit read, including the export path.
    groupBy: recorderList("auditLog", "groupBy"),
  },
  // Read-time actor resolution.
  organizationMember: { findMany: recorderList("organizationMember", "findMany") },
  clinicMember: { findMany: recorderList("clinicMember", "findMany") },
  $queryRaw: () => Promise.resolve([] as unknown[]),
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

jest.mock("@/lib/auth", () => ({
  assertSuperAdmin: () =>
    Promise.resolve({ userId: "admin-1", role: "SUPER_ADMIN", clinicId: null }),
  requireRole: () =>
    Promise.resolve({ sub: "admin-1", user_role: "SUPER_ADMIN", clinic_id: null }),
  handleAuthError: () => null,
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const dashboardRoute = require("../../apps/patient-portal/src/app/api/admin/dashboard/route");
const funnelRoute = require("../../apps/patient-portal/src/app/api/admin/funnel/route");
const auditRoute = require("../../apps/patient-portal/src/app/api/admin/audit/route");

beforeEach(() => {
  calls.length = 0;
  txResults = [];
});

function callsFor(model: string, op: string): Where[] {
  return calls.filter((c) => c.model === model && c.op === op).map((c) => c.args);
}

// ---------------------------------------------------------------------------
// Platform health — the headline defect. The old formula divided ALL-TIME
// failures by THIS MONTH's assessments: a ratio between two different windows.
// ---------------------------------------------------------------------------

/** Ordered payload the dashboard's $transaction resolves to. */
function dashboardTx(opts: {
  failuresInWindow: number;
  assessmentsInWindow: number;
  thisMonth?: number;
  lastMonth?: number;
  completedToday?: number;
  partialFailuresInWindow?: number;
  stalled?: number;
}) {
  return [
    3, // clinicsTotal
    2, // clinicsActive
    5, // doctorsTotal
    40, // patientsTotal
    7, // assessmentsToday
    opts.completedToday ?? 4, // assessmentsCompletedToday
    opts.thisMonth ?? 100, // assessmentsThisMonth
    opts.lastMonth ?? 100, // assessmentsLastMonth
    [], // recentClinics
    [], // recentDoctors
    [], // recentAssessments
    opts.failuresInWindow,
    opts.assessmentsInWindow,
    // Health now also counts partial failures and work stalled mid-pipeline.
    // Both default to 0 so every assertion below keeps its original meaning:
    // with no partial failures and nothing stalled, the score is still the
    // same-window failure-rate complement these tests were written to lock.
    opts.partialFailuresInWindow ?? 0,
    opts.stalled ?? 0,
  ];
}

async function runDashboard(tx: unknown[]) {
  txResults = tx;
  const res = await dashboardRoute.GET();
  return res.json();
}

describe("GET /api/admin/dashboard — platform health is a same-window rate", () => {
  it("computes the failure rate from one shared 7-day window", async () => {
    const body = await runDashboard(
      dashboardTx({ failuresInWindow: 10, assessmentsInWindow: 100 }),
    );
    // 10 failures / 100 assessments = 10% → health 90.
    expect(body.metrics.platformHealth).toBe(90);
  });

  it("REGRESSION: a quiet window reports 100, not 0", async () => {
    // The old formula divided a non-zero all-time failure count by zero-ish
    // recent volume, drove the rate past 100, and floored health at 0 —
    // rendering "Degraded" on a platform that had simply been quiet.
    const body = await runDashboard(
      dashboardTx({ failuresInWindow: 0, assessmentsInWindow: 0 }),
    );
    expect(body.metrics.platformHealth).toBe(100);
  });

  it("REGRESSION: health can never exceed 100 or fall below 0", async () => {
    const allFailed = await runDashboard(
      dashboardTx({ failuresInWindow: 50, assessmentsInWindow: 50 }),
    );
    expect(allFailed.metrics.platformHealth).toBe(0);

    const noneFailed = await runDashboard(
      dashboardTx({ failuresInWindow: 0, assessmentsInWindow: 50 }),
    );
    expect(noneFailed.metrics.platformHealth).toBe(100);
    expect(noneFailed.metrics.platformHealth).toBeLessThanOrEqual(100);
  });

  it("REGRESSION: both sides of the rate query the SAME window boundary", async () => {
    await runDashboard(dashboardTx({ failuresInWindow: 1, assessmentsInWindow: 10 }));
    const counts = callsFor("assessment", "count");

    const failureQuery = counts.find(
      (c) => (c.where as Where)?.status === "FAILED",
    );
    expect(failureQuery).toBeDefined();
    const failureWindow = (failureQuery!.where as Where).createdAt as {
      gte: Date;
    };
    expect(failureWindow?.gte).toBeInstanceOf(Date);

    // The denominator must use an identical lower bound and no status filter.
    const denominator = counts.find(
      (c) =>
        (c.where as Where)?.status === undefined &&
        ((c.where as Where)?.createdAt as { gte?: Date })?.gte?.getTime() ===
          failureWindow.gte.getTime(),
    );
    expect(denominator).toBeDefined();
  });

  it("REGRESSION: the failure count is scoped, not all-time", async () => {
    await runDashboard(dashboardTx({ failuresInWindow: 1, assessmentsInWindow: 10 }));
    const failureQuery = callsFor("assessment", "count").find(
      (c) => (c.where as Where)?.status === "FAILED",
    );
    // An unbounded { status: FAILED, deletedAt: null } query is the old bug.
    expect((failureQuery!.where as Where).createdAt).toBeDefined();
  });
});

describe("GET /api/admin/dashboard — metric naming and windows", () => {
  it("REGRESSION: exposes assessmentsCompletedToday, never the mislabelled reportsToday", async () => {
    const body = await runDashboard(
      dashboardTx({ failuresInWindow: 0, assessmentsInWindow: 10, completedToday: 9 }),
    );
    expect(body.metrics.assessmentsCompletedToday).toBe(9);
    // The old key asserted these were generated reports. They are not.
    expect(body.metrics).not.toHaveProperty("reportsToday");
  });

  it("REGRESSION: month-to-date growth compares equal-length windows", async () => {
    await runDashboard(dashboardTx({ failuresInWindow: 0, assessmentsInWindow: 1 }));
    const counts = callsFor("assessment", "count");

    // The last-month window must be cut at the same elapsed offset, not run
    // to the start of this month (a full month vs a partial one).
    const lastMonthQuery = counts.find(
      (c) => ((c.where as Where)?.submittedAt as { lt?: Date })?.lt !== undefined,
    );
    expect(lastMonthQuery).toBeDefined();
    const window = lastMonthQuery!.where as Where;
    const range = window.submittedAt as { gte: Date; lt: Date };

    // Match the month-to-date query by its exact boundary. Several counts
    // filter on `submittedAt: { gte }` (today, this month), so identify this
    // one by value rather than taking the first match.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthQuery = counts.find(
      (c) =>
        ((c.where as Where)?.submittedAt as { gte?: Date })?.gte?.getTime() ===
        startOfMonth.getTime(),
    );
    expect(thisMonthQuery).toBeDefined();

    const lastMonthSpan = range.lt.getTime() - range.gte.getTime();
    const thisMonthSpan = Date.now() - startOfMonth.getTime();
    // Same elapsed span, within a second of clock drift between the two.
    // Comparing a partial current month against a COMPLETE previous month is
    // the bug: it made growth read negative for most of every month.
    expect(Math.abs(lastMonthSpan - thisMonthSpan)).toBeLessThan(1000);
  });

  it("scopes every assessment metric to non-deleted rows", async () => {
    await runDashboard(dashboardTx({ failuresInWindow: 0, assessmentsInWindow: 1 }));
    for (const c of callsFor("assessment", "count")) {
      expect((c.where as Where).deletedAt).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Funnel — was returning 500 in production and the dashboard hid it.
// ---------------------------------------------------------------------------

const FUNNEL_TX = [
  200, // started
  150, // completed
  90, // approved
  30, // editsRequested
  10, // rejected
  60, // kitOrders
  45, // kitOrdersActive
  3, // clinics
  5, // doctors
];

async function runFunnel() {
  txResults = FUNNEL_TX;
  const res = await funnelRoute.GET();
  return res.json();
}

describe("GET /api/admin/funnel", () => {
  it("REGRESSION: never queries NEEDS_REVISION, which is not a ReviewDecision", async () => {
    await runFunnel();
    // ReviewDecision = PENDING | APPROVED | EDITS_REQUESTED | REJECTED.
    // Passing an unknown member makes Prisma throw at runtime; this route has
    // no try/catch, so the whole endpoint 500'd and the funnel card silently
    // never rendered.
    const serialized = JSON.stringify(callsFor("assessment", "count"));
    expect(serialized).not.toContain("NEEDS_REVISION");

    const VALID = ["PENDING", "APPROVED", "EDITS_REQUESTED", "REJECTED"];
    for (const c of callsFor("assessment", "count")) {
      const decision = (c.where as Where).reviewDecision;
      if (decision !== undefined) expect(VALID).toContain(decision);
    }
  });

  it("REGRESSION: the approved stage counts APPROVED only", async () => {
    const body = await runFunnel();
    expect(body.funnel.approved).toBe(90);
    // A rejection is not forward progress; it is reported as a leak.
    expect(body.leaks.editsRequested).toBe(30);
    expect(body.leaks.rejected).toBe(10);
    expect(body.funnel).not.toHaveProperty("reviewed");
  });

  it("REGRESSION: the completed stage is not a tautology on a non-null column", async () => {
    await runFunnel();
    // submittedAt is `DateTime @default(now())` — never null — so the old
    // `{ not: null }` filter matched every row and the stage always equalled
    // the one above it.
    const serialized = JSON.stringify(callsFor("assessment", "count"));
    expect(serialized).not.toContain("submittedAt");

    const completed = callsFor("assessment", "count").find(
      (c) => (c.where as Where).status === "COMPLETED",
    );
    expect(completed).toBeDefined();
  });

  it("REGRESSION: every assessment count excludes soft-deleted rows", async () => {
    await runFunnel();
    const counts = callsFor("assessment", "count");
    expect(counts.length).toBeGreaterThan(0);
    for (const c of counts) {
      // Without this the funnel's first bar disagreed with the metric cards
      // rendered directly above it on the same screen.
      expect((c.where as Where).deletedAt).toBeNull();
    }
  });

  it("QUERY SAFETY: batches through $transaction, not Promise.all", async () => {
    // pgbouncer runs with connection_limit=1; parallel independent queries
    // starve the single connection. This was the last admin route still
    // issuing Promise.all, and the widest.
    const spy = jest.spyOn(prismaMock, "$transaction");
    txResults = FUNNEL_TX;
    await funnelRoute.GET();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(Array.isArray(spy.mock.calls[0]![0])).toBe(true);
    // All nine counts ride in one batch.
    expect((spy.mock.calls[0]![0] as unknown[]).length).toBe(9);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Audit CSV export — an evidence artefact, so encoding correctness matters.
// ---------------------------------------------------------------------------

function auditRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a1",
    createdAt: new Date("2026-08-22T10:00:00.000Z"),
    actorId: "admin-1",
    actorRole: "SUPER_ADMIN",
    actorType: "admin",
    action: "CLINIC_ARCHIVED",
    entityType: "Clinic",
    entityId: "clinic-1",
    metadata: {},
    assessment: { clinic: { id: "c1", name: "Plain Clinic", slug: "plain" } },
    ...overrides,
  };
}

async function runCsv(rows: unknown[], total: number) {
  txResults = [rows, total];
  const res = await auditRoute.GET(
    new Request("https://x.test/api/admin/audit?export=csv"),
  );
  return { res, text: await res.text() };
}

describe("GET /api/admin/audit?export=csv", () => {
  it("REGRESSION: quotes fields containing commas instead of deleting them", async () => {
    const { text } = await runCsv(
      [
        auditRow({
          assessment: {
            clinic: { id: "c1", name: "Sharma, Rao & Co", slug: "sr" },
          },
        }),
      ],
      1,
    );
    // The old code did `.replace(/,/g, " ")`, silently altering exported data.
    expect(text).toContain('"Sharma, Rao & Co"');
    expect(text).not.toContain("Sharma  Rao");
  });

  it("REGRESSION: escapes embedded quotes and newlines without shifting columns", async () => {
    const { text } = await runCsv(
      [
        auditRow({
          assessment: {
            clinic: { id: "c1", name: 'The "Best" Clinic\nBranch 2', slug: "b" },
          },
        }),
      ],
      1,
    );
    // RFC 4180: wrap in quotes, double any embedded quote.
    expect(text).toContain('"The ""Best"" Clinic\nBranch 2"');

    // Column count is the guard against a quoted field shifting the row. It
    // grew from 9 to 13 when the export gained read-time enrichment:
    // actorEmail, actorName, actorRoleCurrent and clinicAttributionSource.
    // actorRoleAtEvent (stored on the row) and actorRoleCurrent (looked up
    // now) are separate columns on purpose — they are different claims.
    const header = text.split("\r\n")[0]!;
    expect(header.split(",").length).toBe(13);
    expect(header).toContain("actorEmail");
    expect(header).toContain("clinicAttributionSource");
  });

  it("REGRESSION: a truncated export announces itself in the filename", async () => {
    const rows = Array.from({ length: 5000 }, () => auditRow());
    const { res } = await runCsv(rows, 12345);

    expect(res.headers.get("x-export-truncated")).toBe("true");
    expect(res.headers.get("x-export-total")).toBe("12345");
    // The UI downloads this via window.location.href, so response headers are
    // never seen by the person opening the file — the filename must say it.
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("PARTIAL");
    expect(disposition).toContain("of-12345");
  });

  it("a complete export is not labelled partial", async () => {
    const { res } = await runCsv([auditRow()], 1);
    expect(res.headers.get("x-export-truncated")).toBe("false");
    expect(res.headers.get("content-disposition")).not.toContain("PARTIAL");
  });
});
