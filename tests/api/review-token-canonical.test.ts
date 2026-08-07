// /api/review/[token] must delegate every approval to
// orchestrator.approve — the canonical approval boundary — and never write
// approval state to the database on its own. These tests exercise the real
// route handler with a mocked orchestrator and prisma so we can verify the
// exact call shape and that no direct approval-column write happens.

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { signReviewToken } from "../../apps/patient-portal/src/lib/reviewToken";

process.env.REVIEW_TOKEN_SECRET = "test-secret-for-review-token-canonicalization";

const approve = jest.fn<
  (args: {
    assessmentId: string;
    ctx: { actorId: string; role: string; clinicId: string | null };
    status: string;
    notes?: string;
  }) => Promise<unknown>
>();

class OrchestratorError extends Error {
  constructor(public code: "not_found" | "forbidden" | "invalid", msg: string) {
    super(msg);
  }
}
class ReadinessBlockedError extends Error {
  public readonly code = "readiness_blocked" as const;
  constructor(
    public decision: {
      ready: false;
      blockingCodes: string[];
      groundingViolationCount: number;
      reasoningGapCount: number;
      doctorSummary: string;
      groundingViolations: unknown[];
      reasoningGaps: unknown[];
    },
  ) {
    super(decision.doctorSummary);
  }
}

jest.mock("@hairos/packages/consultation-orchestrator", () => ({
  makeOrchestrator: () => ({ approve }),
  OrchestratorError,
  ReadinessBlockedError,
}));

// The token route imports the safe-decision stripper from
// @shared/clinical-readiness/evaluator directly; the real implementation is
// pure and side-effect-free, so no mock is needed.

const findUnique = jest.fn<(args: { where: { id: string } }) => Promise<unknown>>();
const update = jest.fn<
  (args: {
    where: { id: string };
    data: Record<string, unknown>;
    select?: Record<string, boolean>;
  }) => Promise<unknown>
>();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: {
      findUnique: (args: { where: { id: string } }) => findUnique(args),
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => update(args),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST, GET } = require("../../apps/patient-portal/src/app/api/review/[token]/route");

const ASSESSMENT_ID = "cabcdefghijklmnopqrstuv";
const CLINIC_ID = "clinic-1";

function jsonRequest(body: unknown, method: "POST" | "GET" = "POST"): Request {
  return new Request("http://localhost/api/review/tok", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function withToken(token: string): { params: Promise<{ token: string }> } {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  approve.mockReset();
  findUnique.mockReset();
  update.mockReset();

  approve.mockResolvedValue({});
  findUnique.mockResolvedValue({ id: ASSESSMENT_ID, clinicId: CLINIC_ID });
  update.mockResolvedValue({
    id: ASSESSMENT_ID,
    reviewDecision: "APPROVED",
    reviewerName: "Dr X",
    reviewedAt: new Date(),
  });
});

describe("/api/review/[token] POST — canonical delegation", () => {
  it("delegates to orchestrator.approve exactly once and never bypasses it", async () => {
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X", reviewerEmail: "x@e.com" }),
      withToken(token),
    );
    expect(res.status).toBe(200);
    expect(approve).toHaveBeenCalledTimes(1);
    const call = approve.mock.calls[0][0];
    expect(call.assessmentId).toBe(ASSESSMENT_ID);
    expect(call.status).toBe("APPROVED");
    expect(call.ctx.role).toBe("TOKEN_REVIEWER");
    expect(call.ctx.clinicId).toBe(CLINIC_ID);
    expect(call.ctx.actorId).toContain("review-token:");
    // Legacy mirror is still permitted but must not set reviewDecision
    // WITHOUT the orchestrator succeeding first.
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("maps EDITS_REQUESTED → REVISION_REQUESTED for the orchestrator", async () => {
    const token = signReviewToken(ASSESSMENT_ID);
    await POST(
      jsonRequest({
        decision: "EDITS_REQUESTED",
        reviewerName: "Dr X",
        notes: "please adjust dosage",
      }),
      withToken(token),
    );
    expect(approve.mock.calls[0][0].status).toBe("REVISION_REQUESTED");
  });

  it("does NOT call the orchestrator when the token is expired", async () => {
    const token = signReviewToken(ASSESSMENT_ID, -1_000);
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }),
      withToken(token),
    );
    expect(res.status).toBe(410);
    expect(approve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("does NOT call the orchestrator when the signature is bad", async () => {
    const token = signReviewToken(ASSESSMENT_ID);
    const tampered = token.slice(0, -3) + "XXX";
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }),
      withToken(tampered),
    );
    expect(res.status).toBe(401);
    expect(approve).not.toHaveBeenCalled();
  });

  it("does NOT call the orchestrator when the token is malformed", async () => {
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }),
      withToken("not-a-token"),
    );
    expect(res.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
  });

  it("rejects missing reviewer name before touching the orchestrator", async () => {
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "" }),
      withToken(token),
    );
    expect(res.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
  });

  it("rejects EDITS_REQUESTED without notes", async () => {
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "EDITS_REQUESTED", reviewerName: "Dr X" }),
      withToken(token),
    );
    expect(res.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
  });

  it("rejects unknown decisions", async () => {
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "MAYBE", reviewerName: "Dr X" }),
      withToken(token),
    );
    expect(res.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
  });

  it("propagates orchestrator forbidden as 403 and does NOT mirror to legacy flag", async () => {
    approve.mockRejectedValueOnce(new OrchestratorError("forbidden", "no"));
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }),
      withToken(token),
    );
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("propagates orchestrator invalid (state-guard failure) as 409 without mirroring", async () => {
    approve.mockRejectedValueOnce(new OrchestratorError("invalid", "still processing"));
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }),
      withToken(token),
    );
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("404s when the assessment referenced by the token no longer exists", async () => {
    findUnique.mockResolvedValueOnce(null);
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await POST(
      jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }),
      withToken(token),
    );
    expect(res.status).toBe(404);
    expect(approve).not.toHaveBeenCalled();
  });

  it("does NOT write reviewDecision via a direct prisma call unless orchestrator succeeded", async () => {
    // If the orchestrator throws non-Orchestrator errors, the route rethrows.
    approve.mockRejectedValueOnce(new Error("boom"));
    const token = signReviewToken(ASSESSMENT_ID);
    await expect(
      POST(jsonRequest({ decision: "APPROVED", reviewerName: "Dr X" }), withToken(token)),
    ).rejects.toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("/api/review/[token] GET — read-only", () => {
  it("returns 410 for expired tokens", async () => {
    const token = signReviewToken(ASSESSMENT_ID, -1000);
    const res = await GET(jsonRequest({}, "GET"), withToken(token));
    expect(res.status).toBe(410);
  });
});
