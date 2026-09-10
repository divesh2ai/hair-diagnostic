import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// The ReportAsset row is both the durable record and the queue, so every one
// of these operations is a concurrency primitive. They are tested against a
// fake client rather than a database because what is being asserted is the
// SHAPE of each write — that a claim is a conditional update, that a result
// write requires the lease, that a duplicate insert converges — and a real
// database would confirm the same shape more slowly.

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const {
  ensureAsset,
  claimNextDue,
  markReady,
  markAttemptFailed,
  resetForRetry,
  tolerant,
  ReportAssetsNotProvisionedError,
} = await import("@/lib/reports/assets/repository");
const { MAX_RENDER_ATTEMPTS } = await import("@/lib/reports/assets/contract");

const INPUT = {
  clinicId: "clinic_1",
  patientId: "patient_1",
  assessmentId: "assessment_1",
  consultationId: "consultation_1",
  consultationVersionId: "cv_1",
  contentVersion: 3,
  type: "ONE_PAGER_PNG" as const,
  templateVersion: "hair-one-pager-v1",
  rendererVersion: "chromium-png-v1",
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset_1",
    ...INPUT,
    status: "PENDING",
    attemptCount: 0,
    leaseId: null,
    leaseExpiresAt: null,
    createdAt: new Date("2026-09-07T09:00:00Z"),
    ...overrides,
  };
}

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError("boom", {
    code,
    clientVersion: "5.22.0",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakeDb = any;

describe("ensureAsset — idempotency is the database's job", () => {
  it("creates the PENDING row on first request", async () => {
    const db: FakeDb = {
      reportAsset: {
        create: vi.fn(async () => row()),
        findUnique: vi.fn(),
      },
    };
    const result = await ensureAsset(INPUT, db);
    expect(result.created).toBe(true);
    expect(db.reportAsset.create).toHaveBeenCalledOnce();
    expect(db.reportAsset.create.mock.calls[0][0].data.status).toBe("PENDING");
  });

  it("converges on the winner's row when the unique index refuses a duplicate", async () => {
    // Two approvals arriving together. `findFirst` then `create` would let both
    // through; attempting the insert means the loser learns it lost.
    const db: FakeDb = {
      reportAsset: {
        create: vi.fn(async () => {
          throw known("P2002");
        }),
        findUnique: vi.fn(async () => row({ id: "asset_winner" })),
      },
    };
    const result = await ensureAsset(INPUT, db);
    expect(result.created).toBe(false);
    expect(result.asset.id).toBe("asset_winner");
    expect(db.reportAsset.findUnique.mock.calls[0][0].where.render_key).toEqual({
      consultationVersionId: "cv_1",
      type: "ONE_PAGER_PNG",
      templateVersion: "hair-one-pager-v1",
      rendererVersion: "chromium-png-v1",
    });
  });

  it("reports an unprovisioned table as such, not as an unknown fault", async () => {
    const db: FakeDb = {
      reportAsset: {
        create: vi.fn(async () => {
          throw known("P2021");
        }),
      },
    };
    await expect(ensureAsset(INPUT, db)).rejects.toBeInstanceOf(
      ReportAssetsNotProvisionedError,
    );
  });
});

describe("claimNextDue — two workers cannot hold one row", () => {
  it("claims by conditional update and returns the lease", async () => {
    const db: FakeDb = {
      reportAsset: {
        findFirst: vi.fn(async () => row()),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => row({ status: "RENDERING", attemptCount: 1 })),
      },
    };
    const claim = await claimNextDue({}, db);
    expect(claim).not.toBeNull();
    expect(claim!.leaseId).toMatch(/^lease_/);

    const update = db.reportAsset.updateMany.mock.calls[0][0];
    // The WHERE carries the state we expect to find. Without it the update is
    // a blind write and the race is lost silently.
    expect(update.where).toMatchObject({ id: "asset_1", status: "PENDING", attemptCount: 0 });
    expect(update.data.status).toBe("RENDERING");
    expect(update.data.attemptCount).toBe(1);
    expect(update.data.leaseExpiresAt).toBeInstanceOf(Date);
  });

  it("returns null — not the row — when another worker got there first", async () => {
    const db: FakeDb = {
      reportAsset: {
        findFirst: vi.fn(async () => row()),
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUnique: vi.fn(),
      },
    };
    expect(await claimNextDue({}, db)).toBeNull();
    // Critically, it does NOT go on to render a row it does not own.
    expect(db.reportAsset.findUnique).not.toHaveBeenCalled();
  });

  it("considers a RENDERING row whose lease has expired to be reclaimable", async () => {
    const db: FakeDb = {
      reportAsset: {
        findFirst: vi.fn(async () => null),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    await claimNextDue({ now: new Date("2026-09-07T10:00:00Z") }, db);
    const where = db.reportAsset.findFirst.mock.calls[0][0].where;
    const reclaim = where.OR.find((c: { status: string }) => c.status === "RENDERING");
    expect(reclaim).toBeDefined();
    expect(reclaim.leaseExpiresAt.lt).toEqual(new Date("2026-09-07T10:00:00Z"));
  });

  it("is idle rather than inventive when there is no work", async () => {
    const db: FakeDb = { reportAsset: { findFirst: vi.fn(async () => null) } };
    expect(await claimNextDue({}, db)).toBeNull();
  });
});

describe("markReady — a result write requires the lease that produced it", () => {
  const ready = {
    assetId: "asset_1",
    leaseId: "lease_abc",
    storageBucket: "report-assets",
    storagePath: "clinic/clinic_1/consultation/cv_1/one-pager/asset_1.png",
    mimeType: "image/png",
    byteSize: 120_000,
    sha256: "a".repeat(64),
  };

  it("records the bytes and clears the lease", async () => {
    const db: FakeDb = { reportAsset: { updateMany: vi.fn(async () => ({ count: 1 })) } };
    expect(await markReady(ready, db)).toBe(true);
    const call = db.reportAsset.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "asset_1", leaseId: "lease_abc", status: "RENDERING" });
    expect(call.data.status).toBe("READY");
    expect(call.data.sha256).toBe(ready.sha256);
    expect(call.data.leaseId).toBeNull();
  });

  it("refuses a worker whose lease was reclaimed mid-render", async () => {
    // The slow worker's object is at its own asset-id path, so it cannot
    // corrupt the successor's result — but it must not claim success either.
    const db: FakeDb = { reportAsset: { updateMany: vi.fn(async () => ({ count: 0 })) } };
    expect(await markReady(ready, db)).toBe(false);
  });
});

describe("markAttemptFailed — the retry decision", () => {
  it("schedules another attempt while budget remains", async () => {
    const db: FakeDb = {
      reportAsset: {
        findUnique: vi.fn(async () => ({ attemptCount: 1 })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const result = await markAttemptFailed(
      {
        assetId: "asset_1",
        leaseId: "lease_abc",
        code: "RENDER_TIMEOUT",
        detail: "timed out",
        permanent: false,
      },
      db,
    );
    expect(result.terminal).toBe(false);
    const data = db.reportAsset.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.nextAttemptAt).toBeInstanceOf(Date);
    expect(data.errorCode).toBe("RENDER_TIMEOUT");
  });

  it("gives up once the budget is spent", async () => {
    const db: FakeDb = {
      reportAsset: {
        findUnique: vi.fn(async () => ({ attemptCount: MAX_RENDER_ATTEMPTS })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const result = await markAttemptFailed(
      {
        assetId: "asset_1",
        leaseId: "lease_abc",
        code: "RENDER_TIMEOUT",
        detail: "timed out",
        permanent: false,
      },
      db,
    );
    expect(result.terminal).toBe(true);
    const data = db.reportAsset.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.nextAttemptAt).toBeNull();
  });

  it("fails a permanent error immediately, with budget still on the clock", async () => {
    const db: FakeDb = {
      reportAsset: {
        findUnique: vi.fn(async () => ({ attemptCount: 1 })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const result = await markAttemptFailed(
      {
        assetId: "asset_1",
        leaseId: "lease_abc",
        code: "SOURCE_NOT_APPROVED",
        detail: "not approved",
        permanent: true,
      },
      db,
    );
    expect(result.terminal).toBe(true);
    expect(db.reportAsset.updateMany.mock.calls[0][0].data.status).toBe("FAILED");
  });
});

describe("resetForRetry — deliberate, and never over a delivered artefact", () => {
  it("restores the budget of a FAILED row", async () => {
    const db: FakeDb = { reportAsset: { updateMany: vi.fn(async () => ({ count: 1 })) } };
    expect(await resetForRetry("asset_1", db)).toBe(true);
    const call = db.reportAsset.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "asset_1", status: "FAILED" });
    expect(call.data.attemptCount).toBe(0);
  });

  it("will not touch a READY row", async () => {
    // Enforced in the WHERE clause: a READY artefact may already have been
    // delivered, and re-rendering over it would change what a patient got.
    const db: FakeDb = { reportAsset: { updateMany: vi.fn(async () => ({ count: 0 })) } };
    expect(await resetForRetry("asset_1", db)).toBe(false);
    expect(db.reportAsset.updateMany.mock.calls[0][0].where.status).toBe("FAILED");
  });
});

describe("tolerant — an unmigrated deployment is not an outage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers with the fallback rather than throwing", async () => {
    const result = await tolerant(async () => {
      throw new ReportAssetsNotProvisionedError();
    }, null);
    expect(result).toBeNull();
  });

  it("still propagates a real failure", async () => {
    await expect(
      tolerant(async () => {
        throw new Error("database is on fire");
      }, null),
    ).rejects.toThrow("database is on fire");
  });
});
