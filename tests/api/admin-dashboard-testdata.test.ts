// Default dashboard KPIs exclude confirmed test/demo clinics.
//
// The property under test: when a confirmed-test clinic exists, every
// real-business count the Overview shows (doctors, patients, assessments,
// access-ready, health window) is scoped with `clinicId NOT IN [testIds]`, and
// the clinic status counts with `id NOT IN [testIds]`. Classification is by the
// shared explicit-marker classifier, so this is wired, not hand-maintained.
//
// Runner: JEST.  npx jest tests/api/admin-dashboard-testdata.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type Where = Record<string, unknown>;
const countCalls: Array<{ model: string; where: Where }> = [];

function countRecorder(model: string) {
  return (args?: { where?: Where }) => {
    countCalls.push({ model, where: args?.where ?? {} });
    return Promise.resolve(0);
  };
}

// Two clinics: one explicit TEST (slug carries the `test` token), one real.
const IDENTITIES = [
  { id: "test-x", name: "DrFACT Mumbai Test Clinic", slug: "drfact-mumbai-test" },
  { id: "real-y", name: "Reniu Clinic", slug: "reniu-clinic" },
];

const prismaMock = {
  // The pre-transaction identity read has no `take`; the in-transaction
  // recents read has `take: 5`. Distinguish them so recents stays iterable
  // with the createdAt the route maps over.
  clinic: {
    findMany: (args?: { take?: number }) =>
      Promise.resolve(args?.take ? [] : IDENTITIES),
    count: countRecorder("clinic"),
  },
  doctor: { count: countRecorder("doctor"), findMany: () => Promise.resolve([]) },
  patient: { count: countRecorder("patient") },
  assessment: { count: countRecorder("assessment"), findMany: () => Promise.resolve([]) },
  // $transaction ignores the ops (they already recorded their where above) and
  // resolves a fixed, correctly-ordered payload so the route can destructure.
  $transaction: () =>
    Promise.resolve([2, 2, 3, 40, 1, 1, 1, 1, [], [], [], 0, 10, 0, 0, 2, 9, 1]),
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
jest.mock("@/lib/auth", () => ({
  assertSuperAdmin: () => Promise.resolve({ userId: "a", role: "SUPER_ADMIN", clinicId: null }),
  handleAuthError: () => null,
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const dashboardRoute = require("../../apps/patient-portal/src/app/api/admin/dashboard/route");

beforeEach(() => {
  countCalls.length = 0;
});

describe("GET /api/admin/dashboard — confirmed test clinics excluded from KPIs", () => {
  it("scopes volume counts with clinicId NOT IN [testIds]", async () => {
    await dashboardRoute.GET();
    const scoped = countCalls.filter(
      (c) => c.model === "doctor" || c.model === "patient" || c.model === "assessment",
    );
    expect(scoped.length).toBeGreaterThan(0);
    for (const c of scoped) {
      expect(c.where.clinicId).toEqual({ notIn: ["test-x"] });
    }
  });

  it("scopes clinic status counts with id NOT IN [testIds]", async () => {
    await dashboardRoute.GET();
    const clinicCounts = countCalls.filter((c) => c.model === "clinic");
    expect(clinicCounts.length).toBeGreaterThan(0);
    for (const c of clinicCounts) {
      expect(c.where.id).toEqual({ notIn: ["test-x"] });
    }
  });

  it("reports the data-class split and the true all-clinic total", async () => {
    const body = await (await dashboardRoute.GET()).json();
    expect(body.metrics.clinicsTestDemo).toBe(1);
    expect(body.metrics.clinicsReal).toBe(1);
    expect(body.metrics.clinicsUncertain).toBe(0);
    expect(body.metrics.clinicsAllIncludingTest).toBe(2);
  });
});
