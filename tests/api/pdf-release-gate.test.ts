// GET /api/assessment/pdf must not stream a report unless:
//   1. caller is authenticated,
//   2. caller belongs to the assessment's clinic (or is Super Admin),
//   3. the current Consultation version is APPROVED.
//
// Before this gate the endpoint would happily 200 any PDF to anyone who
// knew the assessmentId.

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
  () => Promise<{ currentVersion: { approvalStatus: string } | null } | null>
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

beforeEach(() => {
  getClinicContext.mockReset();
  isSuperAdmin.mockReset();
  artifactFindUnique.mockReset();
  assessmentFindUnique.mockReset();
  consultationFindUnique.mockReset();

  isSuperAdmin.mockImplementation((r) => r === "SUPER_ADMIN");
});

describe("GET /api/assessment/pdf — release gate", () => {
  it("401 when the caller is not authenticated", async () => {
    getClinicContext.mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(401);
  });

  it("400 without an assessment id", async () => {
    const res = await GET(new Request("http://localhost/api/assessment/pdf"));
    expect(res.status).toBe(400);
  });

  it("404 when the assessment does not exist", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "u",
      role: "DOCTOR",
      clinicId: "c1",
    });
    artifactFindUnique.mockResolvedValueOnce({ content: { patientPdfUrl: "https://x" } });
    assessmentFindUnique.mockResolvedValueOnce(null);
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: {
        approvalStatus: "APPROVED",
        content: {
          clinicalReadiness: {
            schemaVersion: 1,
            evaluatedAt: "2026-07-03T00:00:00.000Z",
            sourceClinicalArtifactVersion: "v4",
            isReadyForApproval: true,
            groundingViolations: [],
            reasoningGaps: [],
            blockingCodes: [],
            summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
          },
        },
      },
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(404);
  });

  it("403 when the caller belongs to a different clinic", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "u",
      role: "DOCTOR",
      clinicId: "c1",
    });
    artifactFindUnique.mockResolvedValueOnce({ content: { patientPdfUrl: "https://x" } });
    assessmentFindUnique.mockResolvedValueOnce({
      patient: { name: "P" },
      clinicId: "different-clinic",
    });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: {
        approvalStatus: "APPROVED",
        content: {
          clinicalReadiness: {
            schemaVersion: 1,
            evaluatedAt: "2026-07-03T00:00:00.000Z",
            sourceClinicalArtifactVersion: "v4",
            isReadyForApproval: true,
            groundingViolations: [],
            reasoningGaps: [],
            blockingCodes: [],
            summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
          },
        },
      },
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(403);
  });

  it("403 when the consultation is not APPROVED", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "u",
      role: "DOCTOR",
      clinicId: "c1",
    });
    artifactFindUnique.mockResolvedValueOnce({ content: { patientPdfUrl: "https://x" } });
    assessmentFindUnique.mockResolvedValueOnce({
      patient: { name: "P" },
      clinicId: "c1",
    });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: { approvalStatus: "PENDING_REVIEW" },
    });
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(403);
  });

  it("403 when no consultation exists yet", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "u",
      role: "DOCTOR",
      clinicId: "c1",
    });
    artifactFindUnique.mockResolvedValueOnce({ content: { patientPdfUrl: "https://x" } });
    assessmentFindUnique.mockResolvedValueOnce({
      patient: { name: "P" },
      clinicId: "c1",
    });
    consultationFindUnique.mockResolvedValueOnce(null);
    const res = await GET(getReq("abc"));
    expect(res.status).toBe(403);
  });

  it("Super Admin bypasses the clinic check", async () => {
    getClinicContext.mockResolvedValueOnce({
      userId: "sa",
      role: "SUPER_ADMIN",
      clinicId: null,
    });
    // Provide a valid patientPdfUrl and mock global fetch so the streaming
    // branch doesn't try to reach out.
    artifactFindUnique.mockResolvedValueOnce({
      content: { patientPdfUrl: "https://example.com/x.pdf" },
    });
    assessmentFindUnique.mockResolvedValueOnce({
      patient: { name: "P" },
      clinicId: "any-clinic",
    });
    consultationFindUnique.mockResolvedValueOnce({
      currentVersion: {
        approvalStatus: "APPROVED",
        content: {
          clinicalReadiness: {
            schemaVersion: 1,
            evaluatedAt: "2026-07-03T00:00:00.000Z",
            sourceClinicalArtifactVersion: "v4",
            isReadyForApproval: true,
            groundingViolations: [],
            reasoningGaps: [],
            blockingCodes: [],
            summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
          },
        },
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
});
