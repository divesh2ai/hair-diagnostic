// Verifies the atomic Phase A claim (W3). Tests the extracted helper so we
// don't need to import the whole orchestrator (which pulls @react-pdf/renderer
// via the PDF engine — ESM, unloadable under jest).
//
// The helper is a pure function over a Prisma-shaped API; we hand it a
// stub that models the DB compare-and-set semantics.

import { describe, it, expect, beforeEach } from "vitest";
import { claimPhaseA, PhaseAAlreadyRunningError, PHASE_A_STARTABLE_STATES } from "../../src/packages/assessment-orchestrator/claim";
import type { PrismaClient } from "@prisma/client";

type Row = { id: string; status: string; executionId: string | null } | null;

function stubPrisma(initial: Row): { prisma: PrismaClient; getRow: () => Row } {
  let row: Row = initial;
  const prisma = {
    assessment: {
      updateMany: async ({ where, data }: { where: { id: string; status: { in: string[] } }; data: { status: string; executionId: string } }) => {
        if (!row || row.id !== where.id) return { count: 0 };
        if (!where.status.in.includes(row.status)) return { count: 0 };
        row = { ...row, status: data.status, executionId: data.executionId };
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (!row || row.id !== where.id) return null;
        return { status: row.status, executionId: row.executionId };
      },
    },
  } as unknown as PrismaClient;
  return { prisma, getRow: () => row };
}

describe("claimPhaseA (W3) — atomic single-flight", () => {
  it("first caller wins; second observes NORMALIZING and is rejected", async () => {
    const { prisma, getRow } = stubPrisma({ id: "asm-1", status: "PENDING", executionId: null });

    const first = await claimPhaseA(prisma, "asm-1", "exec-1");
    expect(first.executionId).toBe("exec-1");
    expect(getRow()?.status).toBe("NORMALIZING");
    expect(getRow()?.executionId).toBe("exec-1");

    await expect(claimPhaseA(prisma, "asm-1", "exec-2")).rejects.toBeInstanceOf(PhaseAAlreadyRunningError);
    // Loser sees the winner's execution id, not their own.
    expect(getRow()?.executionId).toBe("exec-1");
  });

  it("QUEUED is startable (resume path)", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "QUEUED", executionId: null });
    await expect(claimPhaseA(prisma, "asm-1", "exec-1")).resolves.toEqual(expect.objectContaining({ executionId: "exec-1" }));
  });

  it("FAILED is startable (retry path)", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "FAILED", executionId: "prior" });
    const res = await claimPhaseA(prisma, "asm-1", "exec-new");
    expect(res.executionId).toBe("exec-new");
  });

  it("PARTIAL_FAILURE is startable (retry path)", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "PARTIAL_FAILURE", executionId: "prior" });
    await expect(claimPhaseA(prisma, "asm-1", "exec-new")).resolves.toBeTruthy();
  });

  it("NORMALIZING blocks re-entry", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "NORMALIZING", executionId: "in-flight" });
    await expect(claimPhaseA(prisma, "asm-1", "exec-2")).rejects.toBeInstanceOf(PhaseAAlreadyRunningError);
  });

  it("RUNNING_CLINICAL_ENGINE blocks re-entry", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "RUNNING_CLINICAL_ENGINE", executionId: "in-flight" });
    await expect(claimPhaseA(prisma, "asm-1", "exec-2")).rejects.toBeInstanceOf(PhaseAAlreadyRunningError);
  });

  it("CLINICAL_READY blocks re-entry", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "CLINICAL_READY", executionId: "prior" });
    const err = await claimPhaseA(prisma, "asm-1", "exec-2").catch((e) => e);
    expect(err).toBeInstanceOf(PhaseAAlreadyRunningError);
    expect((err as PhaseAAlreadyRunningError).executionId).toBe("prior");
    expect((err as PhaseAAlreadyRunningError).currentStatus).toBe("CLINICAL_READY");
  });

  it("COMPLETED blocks re-entry", async () => {
    const { prisma } = stubPrisma({ id: "asm-1", status: "COMPLETED", executionId: "prior" });
    await expect(claimPhaseA(prisma, "asm-1", "exec-2")).rejects.toBeInstanceOf(PhaseAAlreadyRunningError);
  });

  it("missing row surfaces as PhaseAAlreadyRunningError with null status", async () => {
    const { prisma } = stubPrisma(null);
    const err = await claimPhaseA(prisma, "asm-missing", "exec-1").catch((e) => e);
    expect(err).toBeInstanceOf(PhaseAAlreadyRunningError);
    expect((err as PhaseAAlreadyRunningError).currentStatus).toBeNull();
  });

  it("exposes runnable-state constant for callers to reason about", () => {
    expect(PHASE_A_STARTABLE_STATES).toEqual(["PENDING", "QUEUED", "FAILED", "PARTIAL_FAILURE"]);
  });
});
