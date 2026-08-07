// W5 — safeDispatchOrchestration regressions.
//
// We mock @hairos/packages/assessment-orchestrator so we don't drag the PDF
// engine (ESM) into jest. The behaviors we care about:
//   1. Duplicate dispatch (patient double-submit) → second call sees
//      PhaseAAlreadyRunningError, exits quietly, never schedules Phase B.
//   2. Phase A success → Phase B is invoked exactly once.
//   3. Phase A real failure → logged as PHASE-A-FAIL, no Phase B.
//   4. Phase B failure → swallowed (must never throw out of the dispatcher,
//      because Vercel `after()` would surface it as a lambda error and the
//      patient response has already returned).

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

class PhaseAAlreadyRunningError extends Error {
  constructor(
    public readonly assessmentId: string,
    public readonly currentStatus: string | null,
    public readonly executionId: string | null,
  ) {
    super("already running");
    this.name = "PhaseAAlreadyRunningError";
  }
}

const runA = jest.fn<(id: string) => Promise<{ assessmentId: string }>>();
const runB = jest.fn<(ctx: { assessmentId: string }) => Promise<void>>();

jest.mock("@hairos/packages/assessment-orchestrator", () => ({
  runAssessmentPhaseA: (id: string) => runA(id),
  runAssessmentPhaseB: (ctx: { assessmentId: string }) => runB(ctx),
  PhaseAAlreadyRunningError,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeDispatchOrchestration } = require("../../apps/patient-portal/src/lib/orchestration/dispatch");

describe("safeDispatchOrchestration (W5)", () => {
  beforeEach(() => {
    runA.mockReset();
    runB.mockReset();
  });

  it("runs Phase B after a successful Phase A claim", async () => {
    runA.mockResolvedValue({ assessmentId: "asm-1" });
    runB.mockResolvedValue(undefined);

    await safeDispatchOrchestration("asm-1");

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledWith({ assessmentId: "asm-1" });
  });

  it("duplicate dispatch exits quietly and does NOT run Phase B", async () => {
    // First call wins.
    runA.mockResolvedValueOnce({ assessmentId: "asm-1" });
    // Second call loses the claim.
    runA.mockRejectedValueOnce(new PhaseAAlreadyRunningError("asm-1", "NORMALIZING", "exec-1"));
    runB.mockResolvedValue(undefined);

    await safeDispatchOrchestration("asm-1");
    await safeDispatchOrchestration("asm-1");

    expect(runA).toHaveBeenCalledTimes(2);
    // Phase B only fired for the winner.
    expect(runB).toHaveBeenCalledTimes(1);
  });

  it("Phase A real failure is logged; Phase B is NOT scheduled", async () => {
    runA.mockRejectedValue(new Error("db unreachable"));

    await expect(safeDispatchOrchestration("asm-1")).resolves.toBeUndefined();

    expect(runB).not.toHaveBeenCalled();
  });

  it("Phase B failure is swallowed (never throws out of the dispatcher)", async () => {
    runA.mockResolvedValue({ assessmentId: "asm-1" });
    runB.mockRejectedValue(new Error("pdf upload timeout"));

    await expect(safeDispatchOrchestration("asm-1")).resolves.toBeUndefined();
  });

  it("concurrent double-submit yields exactly one Phase A and one Phase B", async () => {
    // Simulate the claim: only the first invocation is allowed through.
    let claimed = false;
    runA.mockImplementation(async (id) => {
      if (claimed) throw new PhaseAAlreadyRunningError(id, "NORMALIZING", "exec-1");
      claimed = true;
      return { assessmentId: id };
    });
    runB.mockResolvedValue(undefined);

    await Promise.all([
      safeDispatchOrchestration("asm-1"),
      safeDispatchOrchestration("asm-1"),
    ]);

    expect(runA).toHaveBeenCalledTimes(2);
    expect(runB).toHaveBeenCalledTimes(1);
  });
});
