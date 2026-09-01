// Super Admin national network map — data layer.
//
// The single property this suite exists to defend: a clinic without a real
// coordinate is NEVER plotted. The schema is explicit that coordinates are
// only ever written by a human pin or a geocoded full address, so inferring a
// position from a city or state name would put a clinic somewhere it is not —
// on the one page whose entire purpose is knowing where the network is.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/api/admin-network.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type Row = Record<string, unknown>;

let clinicRows: Row[] = [];
let windowGroups: Row[] = [];
let totalGroups: Row[] = [];
const groupByCalls: Row[] = [];
let clinicFindManyCalls = 0;

const txMock = {
  clinic: {
    findMany: () => {
      clinicFindManyCalls += 1;
      return Promise.resolve(clinicRows);
    },
  },
  kitOrderIntent: {
    groupBy: (args: Row) => {
      groupByCalls.push(args);
      // The window query is the one carrying a createdAt filter.
      const where = args.where as Row | undefined;
      const isWindow = !!(where && (where as Row).createdAt);
      return Promise.resolve(isWindow ? windowGroups : totalGroups);
    },
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: typeof txMock) => unknown) => Promise.resolve(fn(txMock)),
  },
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const { loadNetworkSnapshot, ACTIVITY_WINDOW_DAYS } = require("../../apps/patient-portal/src/lib/admin/network/snapshot");

function location(over: Partial<Row> = {}): Row {
  return {
    id: "loc-1",
    branchName: "Main",
    isPrimary: true,
    latitude: 19.076,
    longitude: 72.8777,
    geoStatus: "PINNED",
    status: "OPEN",
    city: "Mumbai",
    state: "Maharashtra",
    deletedAt: null,
    ...over,
  };
}

function clinic(over: Partial<Row> = {}): Row {
  return {
    id: "clinic-a",
    name: "Mumbai Hair Clinic",
    slug: "mumbai-hair",
    status: "ACTIVE",
    locations: [location()],
    ...over,
  };
}

beforeEach(() => {
  clinicRows = [clinic()];
  windowGroups = [{ clinicId: "clinic-a", _count: { _all: 5 } }];
  totalGroups = [{ clinicId: "clinic-a", _count: { _all: 12 } }];
  groupByCalls.length = 0;
  clinicFindManyCalls = 0;
});

describe("plotting — a position is never invented", () => {
  it("REGRESSION: a clinic with no coordinate is off-map, not placed at its city", async () => {
    clinicRows = [
      clinic({
        id: "no-coord",
        name: "Delhi Scalp Centre",
        // A full address with NO latitude/longitude. The temptation is to
        // plot this at Delhi's centre; that would be a fabricated position.
        locations: [
          location({
            id: "loc-x",
            latitude: null,
            longitude: null,
            geoStatus: "UNSET",
            city: "New Delhi",
            state: "Delhi",
          }),
        ],
      }),
    ];
    windowGroups = [];
    totalGroups = [];

    const snap = await loadNetworkSnapshot();
    expect(snap.onMap).toHaveLength(0);
    expect(snap.offMap).toHaveLength(1);
    expect(snap.offMap[0].branches).toHaveLength(0);
    expect(snap.offMap[0].unmappableBranches[0].reason).toMatch(/needs a map pin/i);
    expect(snap.totals.branchesOnMap).toBe(0);
  });

  it("excludes CLOSED branches from the map", async () => {
    clinicRows = [
      clinic({
        locations: [location({ id: "open", status: "OPEN" }), location({ id: "shut", status: "CLOSED", isPrimary: false })],
      }),
    ];
    const snap = await loadNetworkSnapshot();
    expect(snap.onMap[0].branches.map((b: Row) => b.locationId)).toEqual(["open"]);
    expect(snap.onMap[0].unmappableBranches[0].reason).toMatch(/closed/i);
  });

  it("distinguishes a human pin from a geocoded position", async () => {
    clinicRows = [
      clinic({
        locations: [
          location({ id: "pinned", geoStatus: "PINNED" }),
          location({ id: "derived", geoStatus: "GEOCODED", isPrimary: false }),
        ],
      }),
    ];
    const snap = await loadNetworkSnapshot();
    // Kept distinct because one is an asserted fact and the other is derived.
    expect(snap.totals.pinnedBranches).toBe(1);
    expect(snap.totals.geocodedBranches).toBe(1);
  });
});

describe("attention — deterministic, and always explained", () => {
  it("REGRESSION: an ACTIVE clinic with no mappable branch is an action", async () => {
    clinicRows = [clinic({ status: "ACTIVE", locations: [location({ latitude: null, longitude: null })] })];
    const snap = await loadNetworkSnapshot();
    expect(snap.offMap[0].attention.level).toBe("action");
    expect(snap.offMap[0].attention.reasons).toContain("Active clinic with no mappable branch");
  });

  it("flags a suspended clinic as an action", async () => {
    clinicRows = [clinic({ status: "SUSPENDED" })];
    const snap = await loadNetworkSnapshot();
    expect(snap.onMap[0].attention.level).toBe("action");
    expect(snap.onMap[0].attention.reasons).toContain("Clinic suspended");
  });

  it("flags an onboarding branch as a watch", async () => {
    clinicRows = [clinic({ locations: [location({ status: "ONBOARDING" })] })];
    const snap = await loadNetworkSnapshot();
    expect(snap.onMap[0].attention.level).toBe("watch");
    expect(snap.onMap[0].attention.reasons.join(" ")).toMatch(/onboarding/i);
  });

  it("distinguishes never-active from recently-quiet", async () => {
    windowGroups = [];
    totalGroups = [];
    const never = await loadNetworkSnapshot();
    expect(never.onMap[0].attention.reasons).toContain("No kit order intents ever recorded");

    windowGroups = [];
    totalGroups = [{ clinicId: "clinic-a", _count: { _all: 9 } }];
    const quiet = await loadNetworkSnapshot();
    expect(quiet.onMap[0].attention.reasons).toContain(
      `No kit order intents in the last ${ACTIVITY_WINDOW_DAYS} days`,
    );
  });

  it("a healthy, active, located clinic needs no attention", async () => {
    const snap = await loadNetworkSnapshot();
    expect(snap.onMap[0].attention.level).toBe("none");
    expect(snap.onMap[0].attention.reasons).toEqual([]);
  });

  it("every non-none level carries at least one stated reason", async () => {
    clinicRows = [
      clinic({ status: "SUSPENDED" }),
      clinic({ id: "b", name: "B", status: "ACTIVE", locations: [location({ status: "ONBOARDING" })] }),
    ];
    const snap = await loadNetworkSnapshot();
    for (const c of [...snap.onMap, ...snap.offMap]) {
      if (c.attention.level !== "none") expect(c.attention.reasons.length).toBeGreaterThan(0);
    }
  });
});

describe("rollups reconcile with what is drawn", () => {
  it("state presence counts every branch; only pinned ones are drawable", async () => {
    // Presence in a state and a pin on the map are separate facts, and only
    // the second needs a coordinate. The rollup used to require a coordinate
    // for both, which reported no presence anywhere on a network where every
    // clinic has an address and none has been pinned — a stronger claim than
    // the data supports, and the wrong one.
    clinicRows = [
      clinic(),
      clinic({
        id: "off",
        name: "Unplotted",
        locations: [location({ id: "l2", latitude: null, longitude: null, state: "Maharashtra" })],
      }),
    ];
    const snap = await loadNetworkSnapshot();
    const mh = snap.states.find((s: Row) => s.state === "Maharashtra");
    // Both clinics operate in the state, so both are counted as present.
    expect(mh.clinics).toBe(2);
    expect(mh.branches).toBe(2);
    // Only one of those branches carries a coordinate, and the rollup keeps
    // that difference visible instead of hiding it behind one number.
    expect(mh.branchesOnMap).toBe(1);
    expect(snap.totals.branchesOnMap).toBe(1);
    expect(snap.totals.clinicsOffMap).toBe(1);
  });

  it("a state with no pinned branch is still reported as present", async () => {
    // The live network on 2026-09-01: addresses everywhere, coordinates
    // nowhere. The map draws nothing and the state list must still be right.
    clinicRows = [
      clinic({
        locations: [location({ latitude: null, longitude: null, state: "Maharashtra" })],
      }),
    ];
    const snap = await loadNetworkSnapshot();
    expect(snap.totals.branchesOnMap).toBe(0);
    const mh = snap.states.find((s: Row) => s.state === "Maharashtra");
    expect(mh.clinics).toBe(1);
    expect(mh.branchesOnMap).toBe(0);
  });

  it("counts clinics that record no state at all, rather than dropping them", async () => {
    clinicRows = [clinic({ locations: [] })];
    const snap = await loadNetworkSnapshot();
    expect(snap.clinicsWithoutState).toBe(1);
    expect(snap.states).toEqual([]);
  });

  it("totals account for every clinic exactly once", async () => {
    clinicRows = [
      clinic(),
      clinic({ id: "off", name: "Unplotted", locations: [] }),
    ];
    const snap = await loadNetworkSnapshot();
    expect(snap.totals.clinics).toBe(2);
    expect(snap.totals.clinicsOnMap + snap.totals.clinicsOffMap).toBe(snap.totals.clinics);
  });

  it("a clinic with no branches at all is reported honestly", async () => {
    clinicRows = [clinic({ locations: [] })];
    const snap = await loadNetworkSnapshot();
    expect(snap.offMap[0].unmappableBranches).toEqual([]);
    expect(snap.offMap[0].attention.level).toBe("action");
  });
});

describe("query shape", () => {
  it("PERFORMANCE: uses grouped counts, not one query per clinic", async () => {
    clinicRows = [
      clinic({ id: "c1" }),
      clinic({ id: "c2" }),
      clinic({ id: "c3" }),
      clinic({ id: "c4" }),
    ];
    await loadNetworkSnapshot();
    // One clinic read plus exactly two groupBy calls, regardless of how many
    // clinics exist — the map must not become an N+1 as the network grows.
    expect(clinicFindManyCalls).toBe(1);
    expect(groupByCalls).toHaveLength(2);
  });

  it("scopes activity counts to non-deleted clinics", async () => {
    await loadNetworkSnapshot();
    for (const call of groupByCalls) {
      expect((call.where as Row).clinic).toEqual({ deletedAt: null });
    }
  });

  it("the windowed count is bounded and the total is not", async () => {
    await loadNetworkSnapshot();
    const windowed = groupByCalls.filter((c) => (c.where as Row).createdAt);
    const total = groupByCalls.filter((c) => !(c.where as Row).createdAt);
    expect(windowed).toHaveLength(1);
    expect(total).toHaveLength(1);
    const gte = ((windowed[0]!.where as Row).createdAt as { gte: Date }).gte;
    expect(gte).toBeInstanceOf(Date);
    expect(Date.now() - gte.getTime()).toBeCloseTo(
      ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      -4,
    );
  });
});
