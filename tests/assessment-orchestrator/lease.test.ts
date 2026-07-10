// Doctor Clinical Validation Loop — Phase A execution-lease coverage.
// Pure Prisma-shape stub tests, following the pattern in single-flight.test.ts
// so we don't drag in the whole orchestrator + PDF ESM chain.

import { describe, it, expect } from "vitest";
import {
  claimPhaseA,
  renewLease,
  reclaimStalePhaseA,
  LeaseLostError,
  ReclaimNotEligibleError,
  MAX_PHASE_A_ATTEMPTS,
  PhaseAAlreadyRunningError,
} from "../../src/packages/assessment-orchestrator/claim";
import type { PrismaClient } from "@prisma/client";

type Row = {
  id: string;
  status: string;
  executionId: string | null;
  phaseAExecutionId: string | null;
  phaseALeaseExpiresAt: Date | null;
  phaseAAttempt: number;
  lastCompletedStage: string | null;
} | null;

function matchesWhere(row: NonNullable<Row>, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "id") {
      if (row.id !== v) return false;
      continue;
    }
    if (k === "status" && typeof v === "object" && v && "in" in v) {
      const list = (v as { in: string[] }).in;
      if (!list.includes(row.status)) return false;
      continue;
    }
    if (k === "phaseAExecutionId") {
      if (row.phaseAExecutionId !== v) return false;
      continue;
    }
    if (k === "phaseALeaseExpiresAt" && typeof v === "object" && v && "lt" in v) {
      const cutoff = (v as { lt: Date }).lt;
      if (!row.phaseALeaseExpiresAt || row.phaseALeaseExpiresAt >= cutoff) return false;
      continue;
    }
    if (k === "phaseAAttempt" && typeof v === "object" && v && "lt" in v) {
      const cutoff = (v as { lt: number }).lt;
      if (row.phaseAAttempt >= cutoff) return false;
      continue;
    }
  }
  return true;
}

function stubPrisma(initial: Row): { prisma: PrismaClient; getRow: () => Row } {
  let row: Row = initial;
  const prisma = {
    assessment: {
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown> & { phaseAAttempt?: { increment: number } };
      }) => {
        if (!row) return { count: 0 };
        if (!matchesWhere(row, where)) return { count: 0 };
        const nextAttempt =
          typeof data.phaseAAttempt === "object" &&
          data.phaseAAttempt &&
          "increment" in (data.phaseAAttempt as object)
            ? row.phaseAAttempt +
              (data.phaseAAttempt as { increment: number }).increment
            : row.phaseAAttempt;
        row = {
          ...row,
          ...(data as Partial<NonNullable<Row>>),
          phaseAAttempt: nextAttempt,
        };
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (!row || row.id !== where.id) return null;
        return { ...row };
      },
    },
  } as unknown as PrismaClient;
  return { prisma, getRow: () => row };
}

const baseRow = (over: Partial<NonNullable<Row>> = {}): Row => ({
  id: "asm-1",
  status: "PENDING",
  executionId: null,
  phaseAExecutionId: null,
  phaseALeaseExpiresAt: null,
  phaseAAttempt: 0,
  lastCompletedStage: null,
  ...over,
});

describe("Phase A lease — claim writes executionId + expiry + attempt", () => {
  it("claimPhaseA populates phaseAExecutionId, phaseALeaseExpiresAt, phaseAAttempt", async () => {
    const { prisma, getRow } = stubPrisma(baseRow());
    const now = new Date("2026-07-06T10:00:00Z");
    const result = await claimPhaseA(prisma, "asm-1", "exec-1", now, 60_000);

    expect(result.executionId).toBe("exec-1");
    expect(result.leaseExpiresAt.getTime()).toBe(now.getTime() + 60_000);
    expect(result.attempt).toBe(1);
    const r = getRow();
    expect(r?.phaseAExecutionId).toBe("exec-1");
    expect(r?.phaseALeaseExpiresAt).toEqual(new Date(now.getTime() + 60_000));
    expect(r?.phaseAAttempt).toBe(1);
  });

  it("second claim with live lease throws PhaseAAlreadyRunningError", async () => {
    const { prisma } = stubPrisma(baseRow());
    await claimPhaseA(prisma, "asm-1", "exec-1", new Date());
    await expect(claimPhaseA(prisma, "asm-1", "exec-2")).rejects.toBeInstanceOf(
      PhaseAAlreadyRunningError,
    );
  });
});

describe("renewLease — guards mutations against reclaim", () => {
  it("renewLease writes when executionId matches", async () => {
    const now = new Date();
    const { prisma, getRow } = stubPrisma(
      baseRow({
        status: "NORMALIZING",
        phaseAExecutionId: "exec-1",
        phaseALeaseExpiresAt: new Date(now.getTime() + 60_000),
      }),
    );
    await renewLease(
      prisma,
      "asm-1",
      "exec-1",
      { lastCompletedStage: "normalize" },
      now,
      60_000,
    );
    expect(getRow()?.lastCompletedStage).toBe("normalize");
  });

  it("renewLease throws LeaseLostError when executionId no longer matches", async () => {
    const now = new Date();
    const { prisma } = stubPrisma(
      baseRow({
        status: "NORMALIZING",
        phaseAExecutionId: "exec-fresh",
        phaseALeaseExpiresAt: new Date(now.getTime() + 60_000),
      }),
    );
    await expect(
      renewLease(prisma, "asm-1", "exec-stale", { lastCompletedStage: "x" }, now),
    ).rejects.toBeInstanceOf(LeaseLostError);
  });
});

describe("reclaimStalePhaseA — atomic ownership transfer", () => {
  it("reclaims when lease has expired and status is in-flight", async () => {
    const now = new Date("2026-07-06T10:05:00Z");
    const past = new Date(now.getTime() - 60_000);
    const { prisma, getRow } = stubPrisma(
      baseRow({
        status: "NORMALIZING",
        phaseAExecutionId: "exec-old",
        phaseALeaseExpiresAt: past,
        phaseAAttempt: 1,
      }),
    );

    const result = await reclaimStalePhaseA(prisma, "asm-1", "exec-new", now, 60_000);
    expect(result.oldExecutionId).toBe("exec-old");
    expect(result.newExecutionId).toBe("exec-new");
    expect(result.attempt).toBe(1);
    expect(result.staleMs).toBe(60_000);

    const r = getRow();
    expect(r?.status).toBe("QUEUED");
    expect(r?.phaseAExecutionId).toBe("exec-new");
  });

  it("refuses reclaim when lease has NOT expired", async () => {
    const now = new Date();
    const { prisma } = stubPrisma(
      baseRow({
        status: "NORMALIZING",
        phaseAExecutionId: "exec-old",
        phaseALeaseExpiresAt: new Date(now.getTime() + 30_000),
        phaseAAttempt: 1,
      }),
    );
    await expect(
      reclaimStalePhaseA(prisma, "asm-1", "exec-new", now),
    ).rejects.toBeInstanceOf(ReclaimNotEligibleError);
  });

  it("refuses when phaseAAttempt has reached the cap", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);
    const { prisma } = stubPrisma(
      baseRow({
        status: "NORMALIZING",
        phaseAExecutionId: "exec-old",
        phaseALeaseExpiresAt: past,
        phaseAAttempt: MAX_PHASE_A_ATTEMPTS,
      }),
    );
    await expect(
      reclaimStalePhaseA(prisma, "asm-1", "exec-new", now),
    ).rejects.toBeInstanceOf(ReclaimNotEligibleError);
  });

  it("late original worker's renewLease fails after reclaim", async () => {
    const now = new Date("2026-07-06T10:05:00Z");
    const past = new Date(now.getTime() - 60_000);
    const { prisma } = stubPrisma(
      baseRow({
        status: "NORMALIZING",
        phaseAExecutionId: "exec-old",
        phaseALeaseExpiresAt: past,
        phaseAAttempt: 1,
      }),
    );

    await reclaimStalePhaseA(prisma, "asm-1", "exec-new", now);
    await expect(
      renewLease(prisma, "asm-1", "exec-old", { lastCompletedStage: "clinical" }, now),
    ).rejects.toBeInstanceOf(LeaseLostError);
  });
});
