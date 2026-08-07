// GET /api/assessment/status access model.
// Before this pass the endpoint returned full PII + orchestration logs to any
// caller who knew a CUID. These tests lock the fail-closed contract:
//   • Cookie-authenticated clinic user → same-clinic only; cross-clinic 404
//     (not 403) so ids cannot be enumerated;
//   • SUPER_ADMIN reads across clinics;
//   • Signed review token bound to the same assessment id → full payload;
//   • Token bound to a different id → 404;
//   • Anonymous → strictly-minimum patient-safe subset (no PII, no artifact
//     content, no orchestration logs, no error text, no clinic identity).

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
const isSuperAdmin = jest.fn<(role: string) => boolean>();

jest.mock("@/lib/auth", () => ({
  getClinicContext: () => getClinicContext(),
  isSuperAdmin: (r: string) => isSuperAdmin(r),
}));

const assessmentFindUnique = jest.fn<
  () => Promise<Record<string, unknown> | null>
>();
const artifactFindMany = jest.fn<() => Promise<unknown[]>>();
const eventFindMany = jest.fn<() => Promise<unknown[]>>();
const logFindMany = jest.fn<() => Promise<unknown[]>>();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: { findUnique: () => assessmentFindUnique() },
    aIArtifact: { findMany: () => artifactFindMany() },
    assessmentEvent: { findMany: () => eventFindMany() },
    orchestrationLog: { findMany: () => logFindMany() },
  },
}));

jest.mock("@/lib/narratives/liftNarratives", () => ({
  liftNarratives: () => null,
}));

process.env.REVIEW_TOKEN_SECRET = "test-secret-for-status-route-auth";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require("../../apps/patient-portal/src/app/api/assessment/status/route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { signReviewToken } = require("../../apps/patient-portal/src/lib/reviewToken");

const CLINIC_A = "clinic-A";
const CLINIC_B = "clinic-B";
const ASSESSMENT_ID = "clnvalidcuid1234567890xyz";

function makeReq(id: string, token?: string): Request {
  const q = new URLSearchParams({ id });
  if (token) q.set("t", token);
  return new Request(`http://localhost/api/assessment/status?${q}`);
}

beforeEach(() => {
  getClinicContext.mockReset();
  isSuperAdmin.mockReset();
  assessmentFindUnique.mockReset();
  artifactFindMany.mockReset();
  eventFindMany.mockReset();
  logFindMany.mockReset();

  isSuperAdmin.mockImplementation((r) => r === "SUPER_ADMIN");
  artifactFindMany.mockResolvedValue([]);
  eventFindMany.mockResolvedValue([]);
  logFindMany.mockResolvedValue([]);
  assessmentFindUnique.mockResolvedValue({
    id: ASSESSMENT_ID,
    clinicId: CLINIC_A,
    status: "COMPLETED",
    orchestrationStage: null,
    orchestrationMeta: null,
    executionId: null,
    retryCount: 0,
    lastCompletedStage: null,
    lastError: null,
    submittedAt: new Date(),
    queuedAt: null,
    startedAt: null,
    completedAt: null,
    updatedAt: new Date(),
    patient: { name: "Priya", age: 32, gender: "female" },
    clinic: { name: "Skin First" },
  });
});

describe("GET /api/assessment/status", () => {
  it("400 on invalid id", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(new Request("http://localhost/api/assessment/status?id=nope"));
    expect(res.status).toBe(400);
  });

  it("anonymous: 200 with patient-safe subset — no PII, no artifact content, no logs", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(makeReq(ASSESSMENT_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.patient).toBeUndefined();
    expect(body.clinic).toBeUndefined();
    expect(body.orchestration).toBeUndefined();
    expect(body.artifacts).toBeUndefined();
    expect(body.errors).toBeUndefined();
    expect(body.events).toBeUndefined();
    expect(body.status).toBe("COMPLETED");
    expect(body.artifactPresence).toBeDefined();
  });

  it("clinic user, same clinic: full payload", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "doc",
      role: "DOCTOR",
      clinicId: CLINIC_A,
    });
    const res = await GET(makeReq(ASSESSMENT_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.patient).toBeDefined();
    expect(body.orchestration).toBeDefined();
  });

  it("clinic user, cross-clinic: 404 (does not leak existence)", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "doc",
      role: "DOCTOR",
      clinicId: CLINIC_B,
    });
    const res = await GET(makeReq(ASSESSMENT_ID));
    expect(res.status).toBe(404);
  });

  it("SUPER_ADMIN reads across clinics", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "sa",
      role: "SUPER_ADMIN",
      clinicId: null,
    });
    const res = await GET(makeReq(ASSESSMENT_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.patient).toBeDefined();
  });

  it("review token bound to the same assessment id: full payload", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const token = signReviewToken(ASSESSMENT_ID);
    const res = await GET(makeReq(ASSESSMENT_ID, token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.patient).toBeDefined();
    expect(body.orchestration).toBeDefined();
  });

  it("review token bound to a different assessment id: 404", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const token = signReviewToken("clnotheridvalidcuid98765");
    const res = await GET(makeReq(ASSESSMENT_ID, token));
    expect(res.status).toBe(404);
  });

  it("expired review token: 404 (no token-specific status leak)", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const token = signReviewToken(ASSESSMENT_ID, -1000);
    const res = await GET(makeReq(ASSESSMENT_ID, token));
    expect(res.status).toBe(404);
  });

  it("assessment not found: 404 (same shape as cross-clinic denial)", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    assessmentFindUnique.mockResolvedValueOnce(null);
    const res = await GET(makeReq(ASSESSMENT_ID));
    expect(res.status).toBe(404);
  });
});
