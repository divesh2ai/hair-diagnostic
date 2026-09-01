// SA-1 — server-side authorization on the new Super Admin endpoints.
//
// These three routes expose the platform's account directory, its clinical
// governance history, and its stalled operational work. All three are new
// surfaces, and all three must refuse a caller who is not SUPER_ADMIN at the
// SERVER, not by hiding a nav link. Each test asserts both directions: the
// wrong role is refused, and the right role is served.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/api/admin-sa1-guards.test.ts

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

const SUPER_ADMIN_CTX = {
  userId: "admin-77",
  role: "SUPER_ADMIN",
  clinicId: null,
};
let authImpl: () => Promise<typeof SUPER_ADMIN_CTX> = () =>
  Promise.resolve(SUPER_ADMIN_CTX);

jest.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NextResponse } = require("next/server");
  return {
    assertSuperAdmin: () => authImpl(),
    handleAuthError: (err: Error) => {
      if (err?.name === "ForbiddenError")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (err?.name === "Unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return null;
    },
  };
});

// Minimal Prisma that satisfies every read the three routes make.
const empty = () => Promise.resolve([]);
const prismaMock = {
  organizationMember: { findMany: empty },
  clinicMember: { findMany: empty },
  doctor: { findMany: empty },
  patient: { findMany: empty },
  clinic: { findMany: empty },
  clinicInvitation: { groupBy: empty },
  knowledgeReviewAction: {
    findMany: empty,
    findUnique: () => Promise.resolve(null),
    count: () => Promise.resolve(0),
    groupBy: empty,
  },
  assessment: { findMany: empty },
  $queryRaw: empty,
  $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
};
jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

/* eslint-disable @typescript-eslint/no-var-requires */
const people = require("@/app/api/admin/people/route") as {
  GET: (req: Request) => Promise<Response>;
};
const governance = require("@/app/api/admin/clinical-governance/route") as {
  GET: (req: Request) => Promise<Response>;
};
const stalled = require("@/app/api/admin/stalled-jobs/route") as {
  GET: () => Promise<Response>;
};
/* eslint-enable @typescript-eslint/no-var-requires */

const ENDPOINTS: {
  name: string;
  call: () => Promise<Response>;
}[] = [
  {
    name: "People & Access",
    call: () => people.GET(new Request("http://localhost/api/admin/people")),
  },
  {
    name: "Clinical Governance",
    call: () =>
      governance.GET(
        new Request("http://localhost/api/admin/clinical-governance"),
      ),
  },
  { name: "Stalled jobs", call: () => stalled.GET() },
];

beforeEach(() => {
  authImpl = () => Promise.resolve(SUPER_ADMIN_CTX);
});

describe.each(ENDPOINTS)("$name", ({ call }) => {
  it("refuses a caller whose role is not SUPER_ADMIN", async () => {
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("refuses an unauthenticated caller", async () => {
    authImpl = () => Promise.reject(new UnauthorizedError());
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("serves a SUPER_ADMIN", async () => {
    const res = await call();
    expect(res.status).toBe(200);
  });

  it("returns no payload body on refusal", async () => {
    // A 403 that still leaks the rows it was guarding is not a guard.
    authImpl = () => Promise.reject(new ForbiddenError());
    const body = await (await call()).json();
    expect(body).toEqual({ error: "Forbidden" });
  });
});

describe("People & Access — data exposure", () => {
  it("excludes patients unless explicitly requested", async () => {
    const body = await (
      await people.GET(new Request("http://localhost/api/admin/people"))
    ).json();
    expect(body.patientsIncluded).toBe(false);
  });

  it("reports the auth directory as readable or not, rather than empty", async () => {
    const body = await (
      await people.GET(new Request("http://localhost/api/admin/people"))
    ).json();
    // An unreadable directory and an empty one look identical in a list and
    // mean opposite things, so the flag must always be present.
    expect(typeof body.authReadable).toBe("boolean");
  });
});
