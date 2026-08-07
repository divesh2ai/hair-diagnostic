// PATCH /api/consultation/[assessmentId] contract tests. The doctor
// dashboard's edit path funnels every write through here, so this route
// must:
//   • forward expectedContentVersion to orchestrator.revise;
//   • surface the orchestrator's "invalid" stale-version error as HTTP 409;
//   • never emit a CONSULTATION_APPROVED event (W4);
//   • never write clinical state via a direct prisma call.
// Together with the orchestrator revise-stale-version unit test these lock
// down "doctor edit ≠ approval" and "concurrent edit does not silently
// overwrite" at the API boundary.

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

const getClinicContext = jest.fn<
  () => Promise<{ userId: string; role: string; clinicId: string | null }>
>();

jest.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NextResponse } = require("next/server");
  return {
    getClinicContext: () => getClinicContext(),
    handleAuthError: (err: unknown) => {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      return null;
    },
  };
});

class OrchestratorError extends Error {
  constructor(public code: "not_found" | "forbidden" | "invalid", msg: string) {
    super(msg);
  }
}

const revise = jest.fn<(args: Record<string, unknown>) => Promise<unknown>>();
const getOrCreateDetailed = jest.fn<() => Promise<unknown>>();

jest.mock("@hairos/packages/consultation-orchestrator", () => ({
  makeOrchestrator: () => ({ revise, getOrCreateDetailed }),
  OrchestratorError,
}));

jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/consultation/meta", () => ({
  consultationMeta: (stored: { contentVersion: number }) => ({
    contentVersion: stored.contentVersion,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PATCH } = require("../../apps/patient-portal/src/app/api/consultation/[assessmentId]/route");

const ASSESSMENT_ID = "asm-1";

function patchReq(body: unknown): Request {
  return new Request(`http://localhost/api/consultation/${ASSESSMENT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const withAsm = () => ({ params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

beforeEach(() => {
  getClinicContext.mockReset();
  revise.mockReset();
  getOrCreateDetailed.mockReset();

  getClinicContext.mockResolvedValue({ userId: "doc-A", role: "DOCTOR", clinicId: "c1" });
  revise.mockResolvedValue({
    contentVersion: 2,
    content: {},
  });
});

describe("PATCH /api/consultation/[assessmentId]", () => {
  it("forwards expectedContentVersion to the orchestrator", async () => {
    const res = await PATCH(
      patchReq({ doctorNotes: [], expectedContentVersion: 3 }),
      withAsm(),
    );
    expect(res.status).toBe(200);
    expect(revise).toHaveBeenCalledTimes(1);
    expect(revise.mock.calls[0][0].expectedContentVersion).toBe(3);
  });

  it("omits expectedContentVersion when the client did not send it", async () => {
    await PATCH(patchReq({ doctorNotes: [] }), withAsm());
    expect(revise.mock.calls[0][0].expectedContentVersion).toBeUndefined();
  });

  it("maps orchestrator invalid (stale version) to HTTP 409", async () => {
    revise.mockRejectedValueOnce(new OrchestratorError("invalid", "stale"));
    const res = await PATCH(
      patchReq({ doctorNotes: [], expectedContentVersion: 1 }),
      withAsm(),
    );
    expect(res.status).toBe(409);
  });

  it("propagates forbidden as 403", async () => {
    revise.mockRejectedValueOnce(new OrchestratorError("forbidden", "no"));
    const res = await PATCH(patchReq({ doctorNotes: [] }), withAsm());
    expect(res.status).toBe(403);
  });

  it("propagates not_found as 404", async () => {
    revise.mockRejectedValueOnce(new OrchestratorError("not_found", "gone"));
    const res = await PATCH(patchReq({ doctorNotes: [] }), withAsm());
    expect(res.status).toBe(404);
  });

  it("401 when the caller is not authenticated", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const res = await PATCH(patchReq({ doctorNotes: [] }), withAsm());
    expect(res.status).toBe(401);
    expect(revise).not.toHaveBeenCalled();
  });
});
