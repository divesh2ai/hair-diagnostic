// Super Admin mutations must leave an audit trail.
//
// Before this suite, every Super Admin write was silent: creating a tenant,
// reconfiguring it, suspending it, or ARCHIVING it (a soft-delete of the whole
// clinic) produced no AuditLog row at all. The audit page was real and
// populated — with patient, doctor and consultation events — while being
// completely blind to the most privileged actor on the platform.
//
// These tests exercise the real writeAuditLog against a mocked prisma, so the
// assertion covers the call site AND the writer.
//
// Runner: JEST (see the note in admin-p0-correctness.test.ts).
//   npx jest tests/api/admin-mutation-audit.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

type Row = Record<string, unknown>;

const auditCreate = jest.fn<(args: { data: Row }) => Promise<Row>>();
let clinicRow: Row | null = { id: "clinic-1" };
let updatedClinic: Row = {
  id: "clinic-1",
  slug: "demo",
  status: "ACTIVE",
  isActive: true,
  deletedAt: null,
};

const prismaMock = {
  auditLog: { create: (args: { data: Row }) => auditCreate(args) },
  clinic: {
    findFirst: () => Promise.resolve(clinicRow),
    findUnique: () => Promise.resolve(null),
    create: () =>
      Promise.resolve({ id: "clinic-new", slug: "new-clinic", name: "New Clinic" }),
    update: () => Promise.resolve(updatedClinic),
  },
  subscription: { upsert: () => Promise.resolve({}) },
  platformSettings: {
    upsert: () => Promise.resolve({ id: "settings-1", singletonKey: "singleton" }),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

jest.mock("@/lib/auth", () => ({
  assertSuperAdmin: () =>
    Promise.resolve({ userId: "admin-42", role: "SUPER_ADMIN", clinicId: null }),
  handleAuthError: () => null,
}));

// `next` is installed only under apps/patient-portal and jest.config maps just
// `next/server`, so this one is declared virtual rather than widening the
// shared config for a single test.
jest.mock("next/cache", () => ({ revalidateTag: () => undefined }), {
  virtual: true,
});
jest.mock("@/lib/clinics/getClinicLandingData", () => ({
  clinicCacheTag: (slug: string) => `clinic:${slug}`,
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const clinicsRoute = require("../../apps/patient-portal/src/app/api/admin/clinics/route");
const clinicDetailRoute = require("../../apps/patient-portal/src/app/api/admin/clinics/[id]/route");
const settingsRoute = require("../../apps/patient-portal/src/app/api/admin/platform-settings/route");

beforeEach(() => {
  auditCreate.mockReset();
  auditCreate.mockResolvedValue({});
  clinicRow = { id: "clinic-1" };
  updatedClinic = {
    id: "clinic-1",
    slug: "demo",
    status: "ACTIVE",
    isActive: true,
    deletedAt: null,
  };
});

function auditedRow(): Row {
  expect(auditCreate).toHaveBeenCalledTimes(1);
  return auditCreate.mock.calls[0]![0].data;
}

function jsonRequest(body: unknown): Request {
  return new Request("https://x.test/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

describe("clinic lifecycle transitions are audited", () => {
  it("REGRESSION: archiving a clinic records CLINIC_ARCHIVED", async () => {
    updatedClinic = {
      id: "clinic-1",
      slug: "demo",
      status: "ARCHIVED",
      isActive: false,
      deletedAt: new Date("2026-08-22T10:00:00.000Z"),
    };

    const res = await clinicDetailRoute.POST(
      jsonRequest({ action: "archive" }),
      params({ id: "clinic-1" }),
    );
    expect(res.status).toBe(200);

    const row = auditedRow();
    expect(row.action).toBe("CLINIC_ARCHIVED");
    expect(row.entityType).toBe("Clinic");
    expect(row.entityId).toBe("clinic-1");
    // Archive soft-deletes an entire tenant — the row must say so.
    expect((row.metadata as Row).softDeleted).toBe(true);
  });

  it("attributes the action to the acting admin, not to the system", async () => {
    await clinicDetailRoute.POST(
      jsonRequest({ action: "suspend" }),
      params({ id: "clinic-1" }),
    );
    const row = auditedRow();
    expect(row.actorId).toBe("admin-42");
    expect(row.actorRole).toBe("SUPER_ADMIN");
    expect(row.actorType).toBe("admin");
  });

  it("distinguishes suspend from activate", async () => {
    await clinicDetailRoute.POST(
      jsonRequest({ action: "suspend" }),
      params({ id: "clinic-1" }),
    );
    expect(auditedRow().action).toBe("CLINIC_SUSPENDED");

    auditCreate.mockReset();
    auditCreate.mockResolvedValue({});
    await clinicDetailRoute.POST(
      jsonRequest({ action: "activate" }),
      params({ id: "clinic-1" }),
    );
    expect(auditedRow().action).toBe("CLINIC_ACTIVATED");
  });

  it("does not write an audit row for a rejected action", async () => {
    const res = await clinicDetailRoute.POST(
      jsonRequest({ action: "nonsense" }),
      params({ id: "clinic-1" }),
    );
    expect(res.status).toBe(400);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("does not write an audit row when the clinic does not exist", async () => {
    clinicRow = null;
    const res = await clinicDetailRoute.POST(
      jsonRequest({ action: "archive" }),
      params({ id: "missing" }),
    );
    expect(res.status).toBe(404);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe("clinic creation and reconfiguration are audited", () => {
  it("REGRESSION: creating a clinic records CLINIC_CREATED", async () => {
    const res = await clinicsRoute.POST(
      jsonRequest({ name: "New Clinic", slug: "new-clinic" }),
    );
    expect(res.status).toBe(201);

    const row = auditedRow();
    expect(row.action).toBe("CLINIC_CREATED");
    expect(row.entityId).toBe("clinic-new");
    // AuditLog has no clinicId column, so identity is repeated in metadata to
    // keep the row searchable.
    expect((row.metadata as Row).slug).toBe("new-clinic");
  });

  it("REGRESSION: updating a clinic records which fields changed, not their values", async () => {
    await clinicDetailRoute.PATCH(
      jsonRequest({ name: "Renamed", phone: "+919876543210" }),
      params({ id: "clinic-1" }),
    );

    const row = auditedRow();
    expect(row.action).toBe("CLINIC_UPDATED");
    expect((row.metadata as Row).fieldsChanged).toEqual(["name", "phone"]);
    // The phone number itself must never enter the audit envelope.
    expect(JSON.stringify(row.metadata)).not.toContain("9876543210");
  });

  it("calls out a subscription change inside a clinic update", async () => {
    await clinicDetailRoute.PATCH(
      jsonRequest({
        subscription: { plan: "PROFESSIONAL", status: "ACTIVE" },
      }),
      params({ id: "clinic-1" }),
    );
    const meta = auditedRow().metadata as Row;
    expect(meta.subscriptionPlan).toBe("PROFESSIONAL");
    expect(meta.subscriptionStatus).toBe("ACTIVE");
  });
});

describe("platform settings changes are audited", () => {
  it("REGRESSION: records PLATFORM_SETTINGS_UPDATED with field names only", async () => {
    const req = new Request("https://x.test/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platformName: "HairOS India" }),
    });
    await settingsRoute.PATCH(req);

    const row = auditedRow();
    expect(row.action).toBe("PLATFORM_SETTINGS_UPDATED");
    expect(row.entityType).toBe("PlatformSettings");
    expect((row.metadata as Row).fieldsChanged).toEqual(["platformName"]);
    // These defaults apply to every clinic; the change is platform-wide.
    expect(row.actorId).toBe("admin-42");
  });
});
