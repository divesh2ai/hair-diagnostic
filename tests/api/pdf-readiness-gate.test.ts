// GET /api/assessment/pdf must fail closed at 422 when the persisted
// clinical-readiness snapshot on the current consultation version does not
// clear — even if approvalStatus = APPROVED. This catches the "approved
// once, later engine change poisoned the snapshot" and "historical row
// with no snapshot" cases.

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

jest.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NextResponse } = require("next/server");
  return {
    getClinicContext: () => getClinicContext(),
    isSuperAdmin: (r: string) => isSuperAdmin(r),
    handleAuthError: (err: unknown) => {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      return null;
    },
  };
});

const artifactFindUnique = jest.fn<() => Promise<{ content: Record<string, unknown> } | null>>();
const assessmentFindUnique = jest.fn<
  () => Promise<{ patient: { name: string }; clinicId: string } | null>
>();
const consultationFindUnique = jest.fn<
  () => Promise<{
    currentVersion: {
      approvalStatus: string;
      content: Record<string, unknown> | null;
    } | null;
  } | null>
>();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    assessment: { findUnique: assessmentFindUnique, findFirst: jest.fn(), update: jest.fn() },
    aIArtifact: { findUnique: artifactFindUnique, findFirst: jest.fn(), upsert: jest.fn() },
    consultation: { findUnique: consultationFindUnique },
    auditLog: { create: jest.fn() },
  })),
  ArtifactType: {
    REPORT: "REPORT",
    CLINICAL_REASONING: "CLINICAL_REASONING",
    VISUAL_JOURNEY: "VISUAL_JOURNEY",
    NARRATIVES: "NARRATIVES",
    RECOMMENDATIONS: "RECOMMENDATIONS",
    THERAPY_PLAN: "THERAPY_PLAN",
  },
}));

jest.mock("@hairos/packages/pdf-engine", () => ({
  generateAndStoreReports: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require("../../apps/patient-portal/src/app/api/assessment/pdf/route");

function getReq(id: string): Request {
  return new Request(`http://localhost/api/assessment/pdf?id=${id}`, { method: "GET" });
}

const CLEAN_SNAPSHOT = {
  schemaVersion: 1,
  evaluatedAt: "2026-07-03T00:00:00.000Z",
  sourceClinicalArtifactVersion: "v4",
  isReadyForApproval: true,
  groundingViolations: [],
  reasoningGaps: [],
  blockingCodes: [],
  summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
};

const BLOCKED_SNAPSHOT = {
  ...CLEAN_SNAPSHOT,
  isReadyForApproval: false,
  groundingViolations: [
    { ruleId: "scalp.dandruff", section: "What We Found", summary: "mentions dandruff" },
  ],
  blockingCodes: ["GROUNDING_VIOLATION_PRESENT"],
  summary: { groundingViolationCount: 1, reasoningGapCount: 0 },
};

beforeEach(() => {
  getClinicContext.mockReset();
  isSuperAdmin.mockReset();
  artifactFindUnique.mockReset();
  assessmentFindUnique.mockReset();
  consultationFindUnique.mockReset();

  isSuperAdmin.mockImplementation((r) => r === "SUPER_ADMIN");
  artifactFindUnique.mockResolvedValue({ content: { patientPdfUrl: "https://x.pdf" } });
  assessmentFindUnique.mockResolvedValue({
    patient: { name: "P" },
    clinicId: "c1",
  });
});

describe("GET /api/assessment/pdf — readiness gate", () => {
  it("APPROVED + clean snapshot → 200 stream", async () => {
    getClinicContext.mockResolvedValueOnce({ userId: "u", role: "DOCTOR", clinicId: "c1" });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: {
        approvalStatus: "APPROVED",
        content: { clinicalReadiness: CLEAN_SNAPSHOT },
      },
    });
    const originalFetch = global.fetch;
    (global as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
      headers: new Headers({ "content-type": "application/pdf" }),
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(200);
    (global as { fetch: unknown }).fetch = originalFetch;
  });

  it("APPROVED + blocked snapshot → 422 with structured code", async () => {
    getClinicContext.mockResolvedValueOnce({ userId: "u", role: "DOCTOR", clinicId: "c1" });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: {
        approvalStatus: "APPROVED",
        content: { clinicalReadiness: BLOCKED_SNAPSHOT },
      },
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe("readiness_blocked");
    expect(Array.isArray(body.blockingCodes)).toBe(true);
    expect(body.blockingCodes).toContain("GROUNDING_VIOLATION_PRESENT");
    expect(body.groundingViolationCount).toBe(1);
  });

  it("APPROVED + missing snapshot (historical row) → 422 READINESS_SNAPSHOT_MISSING", async () => {
    getClinicContext.mockResolvedValueOnce({ userId: "u", role: "DOCTOR", clinicId: "c1" });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: { approvalStatus: "APPROVED", content: {} },
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.blockingCodes).toContain("READINESS_SNAPSHOT_MISSING");
  });

  it("Not APPROVED → still blocked at the approval gate before readiness runs", async () => {
    getClinicContext.mockResolvedValueOnce({ userId: "u", role: "DOCTOR", clinicId: "c1" });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: {
        approvalStatus: "PENDING_REVIEW",
        content: { clinicalReadiness: CLEAN_SNAPSHOT },
      },
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(403);
  });
});
