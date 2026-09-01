// Server-side authorization on clinic location writes.
//
// A clinic coordinate is a claim about where a real medical practice stands,
// and the national map presents it as fact. Who may write one is therefore a
// server question, never a matter of which buttons the console chose to
// render — a hidden control is not an access control.
//
// These cases assert both directions on every mutating route: the wrong caller
// is refused before any write is attempted, and the right caller is served.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/api/clinic-location-authz.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

class ForbiddenError extends Error {
  constructor(m = "Super Admin only") {
    super(m);
    this.name = "ForbiddenError";
  }
}
class UnauthorizedError extends Error {
  constructor(m = "Unauthorized") {
    super(m);
    this.name = "Unauthorized";
  }
}

const SUPER_ADMIN_CTX = { userId: "admin-77", role: "SUPER_ADMIN", clinicId: null };
let authImpl: () => Promise<typeof SUPER_ADMIN_CTX> = () =>
  Promise.resolve(SUPER_ADMIN_CTX);

jest.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NextResponse } = require("next/server");
  return {
    assertSuperAdmin: () => authImpl(),
    assertClinicAccess: () => authImpl(),
    handleAuthError: (err: Error) => {
      if (err?.name === "ForbiddenError")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (err?.name === "Unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return null;
    },
  };
});

/** Every write the routes could attempt, so an escaped one is visible. */
const writes: string[] = [];
/** Audit rows the routes emit. A coordinate change must leave a trail. */
const audits: Array<{ action: string; entityId: string; actorId: string | null }> = [];
const location = {
  id: "loc-1",
  clinicId: "clinic-1",
  branchName: "Bandra West",
  isPrimary: true,
  latitude: null,
  longitude: null,
  geoStatus: "UNSET",
  status: "ACTIVE",
  deletedAt: null,
};

const prismaMock = {
  clinic: {
    findUnique: () => Promise.resolve({ id: "clinic-1", deletedAt: null }),
    findFirst: () => Promise.resolve({ id: "clinic-1", deletedAt: null }),
  },
  clinicLocation: {
    findMany: () => Promise.resolve([location]),
    findUnique: () => Promise.resolve(location),
    findFirst: () => Promise.resolve(location),
    create: (args: unknown) => {
      writes.push("create");
      return Promise.resolve({ ...location, ...(args as { data?: object }).data });
    },
    update: (args: unknown) => {
      writes.push("update");
      return Promise.resolve({ ...location, ...(args as { data?: object }).data });
    },
    updateMany: () => {
      writes.push("updateMany");
      return Promise.resolve({ count: 0 });
    },
    count: () => Promise.resolve(1),
  },
  auditLog: {
    create: (args: { data: { action: string; entityId: string; actorId: string | null } }) => {
      audits.push(args.data);
      return Promise.resolve(args.data);
    },
  },
  $transaction: (arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(prismaMock)
      : Promise.all(arg as Promise<unknown>[]),
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

/* eslint-disable @typescript-eslint/no-var-requires */
const locations = require("@/app/api/admin/clinics/[id]/locations/route") as {
  POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
};
const single = require("@/app/api/admin/locations/[locationId]/route") as {
  PATCH: (
    req: Request,
    ctx: { params: Promise<{ locationId: string }> },
  ) => Promise<Response>;
  DELETE: (
    req: Request,
    ctx: { params: Promise<{ locationId: string }> },
  ) => Promise<Response>;
};
/* eslint-enable @typescript-eslint/no-var-requires */

const post = (body: unknown) =>
  new Request("http://t/api/admin/clinics/clinic-1/locations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const patch = (body: unknown) =>
  new Request("http://t/api/admin/locations/loc-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const clinicParams = { params: Promise.resolve({ id: "clinic-1" }) };
const locParams = { params: Promise.resolve({ locationId: "loc-1" }) };

beforeEach(() => {
  writes.length = 0;
  audits.length = 0;
  authImpl = () => Promise.resolve(SUPER_ADMIN_CTX);
});

describe("only a Super Admin may write a clinic coordinate", () => {
  it("refuses an unauthenticated caller on create", async () => {
    authImpl = () => Promise.reject(new UnauthorizedError());
    const res = await locations.POST(
      post({ branchName: "Bandra West", latitude: 19.0596, longitude: 72.8295 }),
      clinicParams,
    );
    expect(res.status).toBe(401);
    // Refused before the write, not after it.
    expect(writes).toEqual([]);
  });

  it("refuses a non-Super-Admin caller on create", async () => {
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await locations.POST(
      post({ branchName: "Bandra West", latitude: 19.0596, longitude: 72.8295 }),
      clinicParams,
    );
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("refuses a non-Super-Admin caller moving an existing pin", async () => {
    // The sharpest case: moving a pin needs no new record, so a route that
    // only guarded creation would let anyone relocate a live clinic.
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await single.PATCH(
      patch({ latitude: 0, longitude: 0 }),
      locParams,
    );
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("refuses a non-Super-Admin caller retiring a branch", async () => {
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await single.DELETE(
      new Request("http://t/api/admin/locations/loc-1", { method: "DELETE" }),
      locParams,
    );
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("serves a Super Admin", async () => {
    const res = await locations.POST(
      post({ branchName: "Bandra West", latitude: 19.0596, longitude: 72.8295 }),
      clinicParams,
    );
    expect(res.status).toBeLessThan(400);
    expect(writes).toContain("create");
    // Moving a clinic on the national map is a consequential act by a
    // platform-wide role, so it leaves a trail naming who did it.
    expect(audits).toHaveLength(1);
    expect(audits[0]!.actorId).toBe(SUPER_ADMIN_CTX.userId);
  });
});

describe("invalid coordinates are rejected at the server, not just the form", () => {
  it.each([
    ["latitude out of range", { latitude: 91, longitude: 72.8295 }],
    ["longitude out of range", { latitude: 19.0596, longitude: 181 }],
    ["a lone latitude", { latitude: 19.0596 }],
    ["a lone longitude", { longitude: 72.8295 }],
  ])("refuses %s on create and writes nothing", async (_label, coords) => {
    const res = await locations.POST(
      post({ branchName: "Bandra West", ...coords }),
      clinicParams,
    );
    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it("refuses an out-of-range coordinate on update", async () => {
    const res = await single.PATCH(patch({ latitude: -91, longitude: 0 }), locParams);
    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it("accepts a valid pin on update", async () => {
    const res = await single.PATCH(
      patch({ latitude: 19.0596, longitude: 72.8295 }),
      locParams,
    );
    expect(res.status).toBeLessThan(400);
    expect(writes.length).toBeGreaterThan(0);
    expect(audits).toHaveLength(1);
  });

  it("refuses a coordinate that is not a number at all", async () => {
    const res = await single.PATCH(
      patch({ latitude: "nineteen", longitude: 72.8295 }),
      locParams,
    );
    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });
});
