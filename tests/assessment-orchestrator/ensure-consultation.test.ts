// Regression cover for eager Consultation persistence at the end of Phase A.
//
// The defect: Consultation + ConsultationVersion were only ever written
// lazily, on the first doctor READ. A clinic whose doctors had not yet worked
// the queue therefore had assessments, AI artifacts and PDFs but zero
// canonical consultations, while a clinic whose doctors HAD worked the queue
// looked healthy. These tests pin the pipeline-side guarantee and — crucially
// — that it does not branch on anything clinic-shaped.

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getOrCreateDetailed = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock("../../src/packages/consultation-orchestrator", () => {
  const actual = jest.requireActual<
    typeof import("../../src/packages/consultation-orchestrator")
  >("../../src/packages/consultation-orchestrator");
  return {
    ...actual,
    makeOrchestrator: () => ({ getOrCreateDetailed }),
  };
});

import {
  ensureConsultationForAssessment,
  ensureConsultationGuarded,
  consultationStageOutcome,
  PIPELINE_ACTOR_ID,
} from "../../src/packages/assessment-orchestrator/persistence/ensureConsultation";
import { OrchestratorError } from "../../src/packages/consultation-orchestrator";

const ASSESSMENT = "cmu5c7ee9000610h74z0nbpl3";
const CONSULTATION = "cons-1";
// Matches storedVersion().clinicId — the clinic that owns the assessment.
const CLINIC = "cmt74rliq0002246pswtdxyyj";

/**
 * Minimal Prisma stand-in. `existing` models what is already on disk for the
 * assessment's consultation: null = nothing, or a row with/without a
 * currentVersionId. `clinicId` is the assessment row's server-verified clinic
 * (null models a missing assessment).
 */
function makePrisma(
  existing: { id: string; currentVersionId: string | null } | null,
  clinicId: string | null = CLINIC,
) {
  return {
    assessment: {
      findUnique: jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValue(clinicId ? { clinicId } : null),
    },
    consultation: {
      findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(existing),
    },
  } as any;
}

function storedVersion(contentVersion = 1) {
  return {
    id: `v-${contentVersion}`,
    consultationId: CONSULTATION,
    clinicId: "cmt74rliq0002246pswtdxyyj",
    contentVersion,
    content: {} as any,
    contentHash: "hash",
    createdAt: new Date().toISOString(),
    createdBy: PIPELINE_ACTOR_ID,
    metadata: {
      approvalStatus: "PENDING_REVIEW" as const,
      approvedBy: null,
      approvedAt: null,
      approvalNotes: null,
    },
  };
}

beforeEach(() => {
  getOrCreateDetailed.mockReset();
  // Silence the intentional console.warn/error on the skip + fail paths.
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("ensureConsultationForAssessment", () => {
  it("creates a Consultation + first version for a real clinic assessment", async () => {
    getOrCreateDetailed.mockResolvedValue(storedVersion(1));

    const result = await ensureConsultationForAssessment(makePrisma(null), ASSESSMENT);

    expect(result.status).toBe("created");
    expect(result.consultationId).toBe(CONSULTATION);
    // Consultation.currentVersionId points at the generated version: the
    // orchestrator returns the version it pointed the consultation at.
    expect(result.contentVersion).toBe(1);
  });

  it("presents the assessment's own server-verified clinic as the access context", async () => {
    getOrCreateDetailed.mockResolvedValue(storedVersion(1));

    await ensureConsultationForAssessment(makePrisma(null), ASSESSMENT);

    expect(getOrCreateDetailed).toHaveBeenCalledWith({
      assessmentId: ASSESSMENT,
      // The pipeline passes the assessment's OWN clinicId (read from the DB row)
      // so the orchestrator's existing clinic-equality guard passes legitimately
      // — not a cross-clinic bypass. role "SYSTEM" is provenance only and carries
      // no read privilege; the real guard is pinned in
      // tests/consultation-orchestrator/access-and-events.test.ts.
      ctx: { actorId: PIPELINE_ACTOR_ID, role: "SYSTEM", clinicId: CLINIC },
    });
  });

  it("reports an already-persisted consultation as existing, not a new one", async () => {
    getOrCreateDetailed.mockResolvedValue(storedVersion(1));

    const result = await ensureConsultationForAssessment(
      makePrisma({ id: CONSULTATION, currentVersionId: "v-1" }),
      ASSESSMENT,
    );

    expect(result.status).toBe("existing");
    expect(result.consultationId).toBe(CONSULTATION);
  });

  it("is idempotent under retry — no duplicate Consultation, no duplicate version", async () => {
    // First run: nothing on disk. Second run (a pipeline retry) sees the row
    // the first run created, and the orchestrator returns that same version.
    const prismaFirst = makePrisma(null);
    getOrCreateDetailed.mockResolvedValue(storedVersion(1));
    const first = await ensureConsultationForAssessment(prismaFirst, ASSESSMENT);

    const prismaRetry = makePrisma({ id: CONSULTATION, currentVersionId: "v-1" });
    const retry = await ensureConsultationForAssessment(prismaRetry, ASSESSMENT);

    expect(first.status).toBe("created");
    expect(retry.status).toBe("existing");
    expect(retry.consultationId).toBe(first.consultationId);
    expect(retry.contentVersion).toBe(first.contentVersion);
  });

  it("scopes to each assessment's own clinic and does not branch on cohort / slug", async () => {
    // Two different clinics own two different assessments. Persistence must be
    // identical in shape for both — the only difference is each ctx carrying its
    // OWN assessment's clinicId (server-verified), never a cohort/slug branch.
    getOrCreateDetailed.mockResolvedValue(storedVersion(1));

    const CLINIC_OTHER = "cmu2dzwnk000214fd8b06msjg";
    const a1 = await ensureConsultationForAssessment(makePrisma(null, CLINIC), ASSESSMENT);
    const a2 = await ensureConsultationForAssessment(
      makePrisma(null, CLINIC_OTHER),
      "cmu2dzwnk000214fd8b06msjg",
    );

    expect(a1.status).toBe("created");
    expect(a2.status).toBe("created");
    const [firstCall, secondCall] = getOrCreateDetailed.mock.calls as any[];
    expect(firstCall[0].ctx.clinicId).toBe(CLINIC);
    expect(secondCall[0].ctx.clinicId).toBe(CLINIC_OTHER);
    // Identical in every respect except the assessment's own clinic.
    expect(firstCall[0].ctx.role).toBe("SYSTEM");
    expect(secondCall[0].ctx.role).toBe("SYSTEM");
    expect(firstCall[0].ctx.actorId).toBe(secondCall[0].ctx.actorId);
  });
});

describe("consultationStageOutcome — honest stage status (no false success)", () => {
  it("created / existing → SUCCESS", () => {
    expect(consultationStageOutcome({ status: "created", consultationId: "c" })).toEqual({
      status: "SUCCESS",
    });
    expect(consultationStageOutcome({ status: "existing", consultationId: "c" })).toEqual({
      status: "SUCCESS",
    });
  });

  it("failed (swallowed persistence error) → FAILED, never SUCCESS", () => {
    expect(consultationStageOutcome({ status: "failed", reason: "Cross-clinic access denied" })).toEqual(
      { status: "FAILED", error: "Cross-clinic access denied" },
    );
  });

  it("skipped (not_composable) → SKIPPED, not SUCCESS", () => {
    const out = consultationStageOutcome({ status: "skipped", reason: "no stored questionnaire" });
    expect(out.status).toBe("SKIPPED");
    expect(out.status).not.toBe("SUCCESS");
  });
});

describe("ensureConsultationGuarded", () => {
  it("never throws when the orchestrator fails, so a good clinical run survives", async () => {
    getOrCreateDetailed.mockRejectedValue(new Error("connection reset"));

    const result = await ensureConsultationGuarded(makePrisma(null), ASSESSMENT);

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("connection reset");
  });

  it("classifies a record with no stored questionnaire as skipped, not failed", async () => {
    // not_composable is a data condition, not a persistence fault — the review
    // queue already withholds these rows (reviewQueue.ts REVIEWABLE_SOURCE_SQL).
    getOrCreateDetailed.mockRejectedValue(
      new OrchestratorError("not_composable", "Assessment x has no stored questionnaire"),
    );

    const result = await ensureConsultationGuarded(makePrisma(null), ASSESSMENT);

    expect(result.status).toBe("skipped");
  });

  it("passes a successful create straight through", async () => {
    getOrCreateDetailed.mockResolvedValue(storedVersion(1));

    const result = await ensureConsultationGuarded(makePrisma(null), ASSESSMENT);

    expect(result.status).toBe("created");
    expect(result.consultationId).toBe(CONSULTATION);
  });
});
