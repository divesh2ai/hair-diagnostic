// Super Admin — audit log read + export.
//
// Three properties are locked here, and a failure in any of them is a
// governance finding rather than a formatting nit:
//
//   1. Only SUPER_ADMIN can read or export the audit log.
//   2. The export FAILS CLOSED — if the AUDIT_LOG_EXPORTED row cannot be
//      written, no CSV is returned. Exporting the platform's complete
//      activity history was previously the one privileged export that left no
//      trace at all.
//   3. An unknown action name is reported as a filter mismatch, not as an
//      empty log. The old UI offered a free-text "Action contains…" box
//      against an API doing exact matching, so a near-miss returned a
//      confident, wrong "no entries".
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/api/admin-audit-export.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type Row = Record<string, unknown>;

// ── Auth, switchable per test ──────────────────────────────────────────────
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

// ── Audit writer, switchable to failing ────────────────────────────────────
let auditShouldFail = false;
const auditCalls: Row[] = [];
jest.mock("@/lib/audit/writeAuditLog", () => ({
  writeAuditLog: (input: Row) => {
    auditCalls.push(input);
    if (auditShouldFail) return Promise.reject(new Error("audit table down"));
    return Promise.resolve();
  },
}));

// ── Prisma ─────────────────────────────────────────────────────────────────
let auditRows: Row[] = [];
let auditTotal = 0;
let capturedWhere: Row | null = null;

const prismaMock = {
  auditLog: {
    findMany: (args: { where: Row }) => {
      capturedWhere = args.where;
      return Promise.resolve(auditRows);
    },
    count: () => Promise.resolve(auditTotal),
    // Distinct historical actions — the facet that keeps pre-canonical events
    // reachable from the console.
    groupBy: () => Promise.resolve(historicalActions),
  },
  // Enrichment lookups — empty by default; one test populates them.
  organizationMember: { findMany: () => Promise.resolve(orgMembers) },
  clinicMember: { findMany: () => Promise.resolve([]) },
  doctor: { findMany: () => Promise.resolve([]) },
  clinic: { findMany: () => Promise.resolve(clinicRows) },
  $queryRaw: () => Promise.resolve([]),
  // The route batches findMany + count; resolve the array it is given.
  $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
};

let orgMembers: Row[] = [];
let clinicRows: Row[] = [];
let historicalActions: { action: string; _count: number }[] = [];

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require("@/app/api/admin/audit/route") as {
  GET: (req: Request) => Promise<Response>;
};

const url = (qs: string) => new Request(`http://localhost/api/admin/audit${qs}`);

beforeEach(() => {
  authImpl = () => Promise.resolve(SUPER_ADMIN_CTX);
  auditShouldFail = false;
  auditCalls.length = 0;
  auditRows = [];
  auditTotal = 0;
  capturedWhere = null;
  orgMembers = [];
  clinicRows = [];
  historicalActions = [];
});

describe("authorization", () => {
  it("refuses a non-super-admin with 403", async () => {
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await GET(url(""));
    expect(res.status).toBe(403);
  });

  it("refuses an unauthenticated caller with 401", async () => {
    authImpl = () => Promise.reject(new UnauthorizedError());
    const res = await GET(url(""));
    expect(res.status).toBe(401);
  });

  it("refuses a non-super-admin the CSV export too", async () => {
    // UI hiding is not authorization; the export path has its own guard.
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await GET(url("?export=csv"));
    expect(res.status).toBe(403);
    expect(auditCalls).toHaveLength(0);
  });
});

describe("action filtering", () => {
  it("reports an unknown action as a filter mismatch, not an empty log", async () => {
    const res = await GET(url("?action=CLINIC"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.unknownAction).toBe(true);
    expect(body.requestedAction).toBe("CLINIC");
    expect(body.rows).toEqual([]);
    // Short-circuited: a filter that cannot match must not cost a query.
    expect(capturedWhere).toBeNull();
  });

  it("applies a known action as an exact filter", async () => {
    auditRows = [];
    auditTotal = 0;
    const res = await GET(url("?action=CLINIC_CREATED"));
    const body = await res.json();
    expect(body.unknownAction).toBe(false);
    expect(capturedWhere).toMatchObject({ action: "CLINIC_CREATED" });
  });

  it("does not filter by action when none is given", async () => {
    await GET(url(""));
    expect(capturedWhere).not.toBeNull();
    expect(capturedWhere).not.toHaveProperty("action");
  });
});

describe("export fails closed", () => {
  const oneRow = () => [
    {
      id: "a1",
      createdAt: new Date("2026-08-30T10:00:00Z"),
      actorId: "user-1",
      actorRole: "SUPER_ADMIN",
      actorType: "admin",
      action: "CLINIC_CREATED",
      entityType: "Clinic",
      entityId: "clinic-1",
      metadata: { clinicId: "clinic-1" },
      assessment: null,
    },
  ];

  it("writes an AUDIT_LOG_EXPORTED row before returning the CSV", async () => {
    auditRows = oneRow();
    auditTotal = 1;
    const res = await GET(url("?export=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: "AUDIT_LOG_EXPORTED",
      entityType: "AuditLog",
      actorId: "admin-77",
      actorRole: "SUPER_ADMIN",
      actorType: "admin",
    });
  });

  it("returns NO CSV when the audit write fails", async () => {
    auditRows = oneRow();
    auditTotal = 1;
    auditShouldFail = true;
    const res = await GET(url("?export=csv"));
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).not.toContain("text/csv");
    const body = await res.json();
    expect(body.error).toMatch(/could not be recorded/i);
  });

  it("records the filter envelope but never the search text", async () => {
    auditRows = oneRow();
    auditTotal = 1;
    await GET(url("?export=csv&search=patient@example.com&action=CLINIC_CREATED"));
    const meta = auditCalls[0].metadata as Row;
    const filters = meta.filters as Row;
    expect(filters.action).toBe("CLINIC_CREATED");
    expect(filters.searchProvided).toBe(true);
    expect(filters.searchLength).toBe("patient@example.com".length);
    // The typed search term can carry a patient identifier — presence and
    // length only, never the value.
    expect(JSON.stringify(meta)).not.toContain("patient@example.com");
  });

  it("reports truncation in the metadata and the filename", async () => {
    auditRows = oneRow();
    auditTotal = 9999;
    const res = await GET(url("?export=csv"));
    expect(res.headers.get("x-export-truncated")).toBe("true");
    expect(res.headers.get("content-disposition")).toContain("PARTIAL");
    expect((auditCalls[0].metadata as Row).truncated).toBe(true);
  });

  it("does not write an export audit row for an ordinary read", async () => {
    auditRows = oneRow();
    auditTotal = 1;
    await GET(url(""));
    expect(auditCalls).toHaveLength(0);
  });
});

describe("enrichment", () => {
  const rowWithActor = () => [
    {
      id: "a1",
      createdAt: new Date("2026-08-30T10:00:00Z"),
      actorId: "user-1",
      actorRole: null,
      actorType: "admin",
      action: "CLINIC_UPDATED",
      entityType: "Clinic",
      entityId: "clinic-1",
      metadata: { clinicId: "clinic-1" },
      assessment: null,
    },
  ];

  it("resolves an actor to a person while keeping the raw id", async () => {
    auditRows = rowWithActor();
    auditTotal = 1;
    orgMembers = [
      {
        supabaseUserId: "user-1",
        name: "Dr Priya Shah",
        email: "priya@example.com",
        role: "SUPER_ADMIN",
      },
    ];
    const body = await (await GET(url(""))).json();
    expect(body.rows[0].actor).toMatchObject({
      name: "Dr Priya Shah",
      email: "priya@example.com",
      currentRole: "SUPER_ADMIN",
      source: "organization_member",
    });
    // The immutable identifier survives enrichment.
    expect(body.rows[0].actorId).toBe("user-1");
  });

  it("does not invent an identity for an unresolvable actor", async () => {
    auditRows = rowWithActor();
    auditTotal = 1;
    const body = await (await GET(url(""))).json();
    expect(body.rows[0].actor.name).toBeNull();
    expect(body.rows[0].actor.email).toBeNull();
    expect(body.rows[0].actor.source).toBe("unresolved");
  });

  it("attributes a Clinic-entity event to its clinic", async () => {
    auditRows = rowWithActor();
    auditTotal = 1;
    clinicRows = [{ id: "clinic-1", name: "DrFACT Mumbai" }];
    const body = await (await GET(url(""))).json();
    expect(body.rows[0].clinic).toMatchObject({
      id: "clinic-1",
      name: "DrFACT Mumbai",
      source: "entity_is_clinic",
    });
  });

  it("marks an event with no derivable clinic as unattributed", async () => {
    auditRows = [
      {
        id: "a2",
        createdAt: new Date("2026-08-30T10:00:00Z"),
        actorId: null,
        actorRole: null,
        actorType: "system",
        action: "PLATFORM_SETTINGS_UPDATED",
        entityType: "PlatformSettings",
        entityId: "singleton",
        metadata: { fieldsChanged: ["defaultLocale"] },
        assessment: null,
      },
    ];
    auditTotal = 1;
    const body = await (await GET(url(""))).json();
    // Not "no clinic" — we never captured one. Different claim.
    expect(body.rows[0].clinic).toBeNull();
    expect(body.rows[0].clinicAttribution).toBe("unattributed");
  });
});

describe("legacy action taxonomy", () => {
  // Four rows on staging predate the canonical SCREAMING_SNAKE list and use a
  // dotted convention. Validating only against the canonical list made those
  // events impossible to filter to — an audit row that exists and cannot be
  // reached is, to an investigator, a missing row.
  it("accepts a historical action that is not in the canonical list", async () => {
    historicalActions = [{ action: "clinic.activated", _count: 1 }];
    auditRows = [];
    auditTotal = 0;
    const body = await (await GET(url("?action=clinic.activated"))).json();
    expect(body.unknownAction).toBe(false);
    // It reached the query rather than short-circuiting as unknown.
    expect(capturedWhere).toMatchObject({ action: "clinic.activated" });
  });

  it("still rejects an action that is neither canonical nor historical", async () => {
    historicalActions = [{ action: "clinic.activated", _count: 1 }];
    const body = await (await GET(url("?action=NOT_A_REAL_ACTION"))).json();
    expect(body.unknownAction).toBe(true);
    expect(capturedWhere).toBeNull();
  });

  it("returns a facet marking canonical and legacy values apart", async () => {
    historicalActions = [
      { action: "clinic.activated", _count: 1 },
      { action: "CLINIC_CREATED", _count: 7 },
    ];
    const body = await (await GET(url(""))).json();
    const facet: { value: string; count: number; canonical: boolean }[] =
      body.actionFacet;

    const legacy = facet.find((f) => f.value === "clinic.activated");
    expect(legacy).toMatchObject({ canonical: false, count: 1 });

    const canonical = facet.find((f) => f.value === "CLINIC_CREATED");
    expect(canonical).toMatchObject({ canonical: true, count: 7 });

    // Canonical actions that have never fired are still offered, with count 0 —
    // "this governance event has never happened" is itself a finding.
    const neverFired = facet.find((f) => f.value === "CLINIC_ARCHIVED");
    expect(neverFired).toMatchObject({ canonical: true, count: 0 });
  });

  it("exposes the facet even when the action filter is unknown", async () => {
    historicalActions = [{ action: "doctor.invited", _count: 1 }];
    const body = await (await GET(url("?action=bogus"))).json();
    expect(body.unknownAction).toBe(true);
    // The picker must still be able to render, otherwise the user is stranded.
    expect(body.actionFacet.some((f: { value: string }) => f.value === "doctor.invited")).toBe(true);
  });
});
