// Approval gate on the patient one-page report.
//
// The one-pager is the document a patient is meant to end up holding. Before
// this gate existed, `loadOnePageReportData` composed it from whatever the
// clinical pipeline had produced and labelled the result "Doctor approved
// plan" unconditionally — including while `approvalStatus` was still
// PENDING_REVIEW and no doctor had opened the case.
//
// Two separate rules are asserted here, because they are genuinely different:
//
//   1. ACCESS.    A conference token is patient-equivalent access: presented by
//                 someone with no clinic session. Those callers get the report
//                 only once a doctor has approved it.
//   2. LABELLING. A clinic or Super Admin session keeps pre-approval access —
//                 reviewing an unapproved draft is the job — but the document
//                 must say what it is. The same file gets printed and handed
//                 over, so a draft that calls itself an approved plan is a
//                 clinical-safety defect even for an internal audience.
//
// The view model builder is stubbed to echo its context. This suite is about
// the gate, not about report composition, which tests/reports/* already covers
// at length.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueAssessment = vi.fn();
const findFirstArtifact = vi.fn();
const getClinicContext = vi.fn();
const isConferenceMode = vi.fn();
const verifyReviewToken = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assessment: { findUnique: (...a: unknown[]) => findUniqueAssessment(...a) },
    aIArtifact: { findFirst: (...a: unknown[]) => findFirstArtifact(...a) },
  },
}));

vi.mock("@/lib/auth", () => ({
  getClinicContext: (...a: unknown[]) => getClinicContext(...a),
  handleAuthError: () => ({ status: 401 }),
  isSuperAdmin: (role: string) => role === "SUPER_ADMIN",
}));

vi.mock("@/lib/conferenceMode", () => ({
  isConferenceMode: () => isConferenceMode(),
}));

vi.mock("@/lib/reviewToken", () => ({
  signReviewToken: () => "signed-token",
  verifyReviewToken: (...a: unknown[]) => verifyReviewToken(...a),
}));

vi.mock("next/headers", () => ({ headers: async () => new Map() }));

// Echo the context back so the clinician/approval fields can be asserted
// without composing a real report.
vi.mock("@/lib/reports/one-page/viewModel", () => ({
  buildOnePageReportViewModel: (_report: unknown, context: unknown) => context,
}));

const { loadOnePageReportData, ReportAccessError } = await import(
  "@/lib/reports/one-page/loadReport"
);

const ASSESSMENT_ID = "asm-1";

// Verified against real staging data: every APPROVED ConsultationVersion row
// carries a populated treatmentPlan.kitPhases — buildConsultation's
// buildTreatmentPlan() always writes it at composition time, and
// orchestrator.revise() always bases a new version on the previous persisted
// content rather than a bare recompose, so a real approved row can never lack
// it (see loadReport.ts's fail-closed check, and
// docs/../ tests/post-approval/behavioural/fixture.ts's matching fix). This
// default keeps every "APPROVED" row in this file realistic; the one test
// that needs the genuinely-malformed shape passes `content` explicitly.
const REALISTIC_KIT_PHASES = [
  { phase: 1, kitId: "TEST_KIT", displayName: "Test Kit", whySelected: "fixture", supportingConditions: [], keyIngredients: [], mechanismOfAction: [], formulationGroups: [] },
];

function assessmentRow(
  approvalStatus: string | null,
  reviewDecision = "PENDING",
  content?: Record<string, unknown>,
) {
  return {
    id: ASSESSMENT_ID,
    clinicId: "clinic-1",
    reviewDecision,
    reviewedAt: null,
    reviewerName: null,
    updatedAt: new Date("2026-08-19T00:00:00.000Z"),
    rawResponses: {},
    patient: { name: "P", age: 30, gender: "female", phone: null },
    clinic: { name: "C", address: null, phone: null, logoUrl: null },
    reviewingDoctor: { name: "Dr A", signatureUrl: "https://example.com/sig.png" },
    consultations: [
      {
        currentVersion:
          approvalStatus === null
            ? null
            : {
                approvalStatus,
                approvedAt: null,
                approvedBy: "Dr A",
                content: content ?? { treatmentPlan: { kitPhases: REALISTIC_KIT_PHASES } },
              },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The loader has a local-export escape hatch keyed on ALLOW_DEV_LOGIN, which
  // a developer's .env commonly sets. It reads `next/headers`, which throws
  // outside a request scope. That path is not what this suite is about, so it
  // is switched off explicitly rather than left to whatever .env happens to
  // hold on the machine running the tests.
  vi.stubEnv("ALLOW_DEV_LOGIN", "0");
  findFirstArtifact.mockResolvedValue({
    content: { clinical_report: { anything: true } },
    createdAt: new Date("2026-08-19T00:00:00.000Z"),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("one-page report — access for patient-equivalent callers", () => {
  beforeEach(() => {
    // No clinic session: the anonymous / conference path.
    getClinicContext.mockRejectedValue(new Error("unauthenticated"));
    isConferenceMode.mockReturnValue(true);
    verifyReviewToken.mockReturnValue({ ok: true, assessmentId: ASSESSMENT_ID });
  });

  it("refuses a conference token while the consultation is PENDING_REVIEW", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("PENDING_REVIEW"));
    await expect(
      loadOnePageReportData(ASSESSMENT_ID, { reviewToken: "t" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a conference token when no consultation exists yet", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow(null));
    await expect(
      loadOnePageReportData(ASSESSMENT_ID, { reviewToken: "t" }),
    ).rejects.toBeInstanceOf(ReportAccessError);
  });

  it("refuses a conference token on a REVISION_REQUESTED consultation", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("REVISION_REQUESTED"));
    await expect(
      loadOnePageReportData(ASSESSMENT_ID, { reviewToken: "t" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows a conference token once the consultation is APPROVED", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("APPROVED"));
    const data = await loadOnePageReportData(ASSESSMENT_ID, { reviewToken: "t" });
    expect(data).toBeTruthy();
  });
});

describe("one-page report — labelling for internal callers", () => {
  beforeEach(() => {
    getClinicContext.mockResolvedValue({
      userId: "u",
      role: "DOCTOR",
      clinicId: "clinic-1",
      email: null,
    });
  });

  it("does not call an unapproved consultation a doctor approved plan", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("PENDING_REVIEW"));
    const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
      clinician: { title: string; signatureUrl: string | null };
      approval: { status: string };
    };
    expect(data.clinician.title).not.toBe("Doctor approved plan");
    expect(data.clinician.title).toMatch(/draft|pending/i);
    expect(data.approval.status).toBe("PENDING_REVIEW");
  });

  it("withholds the doctor signature until the consultation is approved", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("PENDING_REVIEW"));
    const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
      clinician: { signatureUrl: string | null };
    };
    expect(data.clinician.signatureUrl).toBeNull();
  });

  it("labels an APPROVED consultation as a doctor approved plan, with signature", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("APPROVED"));
    const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
      clinician: { title: string; signatureUrl: string | null };
    };
    expect(data.clinician.title).toBe("Doctor approved plan");
    expect(data.clinician.signatureUrl).toBe("https://example.com/sig.png");
  });

  it("falls back to Assessment.reviewDecision when no consultation version exists", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow(null, "APPROVED"));
    const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
      clinician: { title: string };
    };
    expect(data.clinician.title).toBe("Doctor approved plan");
  });

  it("still refuses a caller from another clinic", async () => {
    getClinicContext.mockResolvedValue({
      userId: "u",
      role: "DOCTOR",
      clinicId: "other-clinic",
      email: null,
    });
    findUniqueAssessment.mockResolvedValue(assessmentRow("APPROVED"));
    await expect(loadOnePageReportData(ASSESSMENT_ID)).rejects.toMatchObject({ status: 403 });
  });
});

// P0-1 regression: distinguishing a valid approved report (kitPhases present,
// however it got there) from a truly malformed one (approved, but no
// kitPhases at all) — pinned with real evidence, not assumption.
//
// Queried directly against staging (2026-09-08): every one of 15 real
// APPROVED ConsultationVersion rows has a populated treatmentPlan.kitPhases —
// zero exceptions. buildConsultation's buildTreatmentPlan() always writes it
// at composition time (verbatim from the engine's treatmentStrategy), and
// orchestrator.revise() always bases a new version on the PREVIOUS persisted
// content rather than a bare recompose (see orchestrator.ts: `const base =
// existing.content`), so a real approved row can never lose it once it has
// it. The only way to reach "APPROVED + no kitPhases" is a row that never
// went through the real pipeline — i.e. genuinely corrupted or synthetic
// data — which is exactly the state the fail-closed check exists to catch.
describe("one-page report — the fail-closed invariant is correct, not overzealous", () => {
  beforeEach(() => {
    getClinicContext.mockResolvedValue({
      userId: "u",
      role: "DOCTOR",
      clinicId: "clinic-1",
      email: null,
    });
  });

  it("a valid approved report — kitPhases present, non-empty — renders normally", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("APPROVED"));
    const data = await loadOnePageReportData(ASSESSMENT_ID);
    expect(data).toBeTruthy();
  });

  it("a valid approved report with a genuinely empty kit lineup (doctor removed every kit) is NOT treated as corrupted", async () => {
    // [] is a valid array — Array.isArray([]) is true — distinct from kitPhases
    // being absent or the wrong type. A doctor emptying the lineup on purpose
    // must not be indistinguishable from data corruption.
    findUniqueAssessment.mockResolvedValue(
      assessmentRow("APPROVED", "PENDING", { treatmentPlan: { kitPhases: [] } }),
    );
    const data = await loadOnePageReportData(ASSESSMENT_ID);
    expect(data).toBeTruthy();
  });

  it("an approved version with treatmentPlan present but kitPhases the wrong type still fails closed", async () => {
    findUniqueAssessment.mockResolvedValue(
      assessmentRow("APPROVED", "PENDING", { treatmentPlan: { kitPhases: "not-an-array" } }),
    );
    await expect(loadOnePageReportData(ASSESSMENT_ID)).rejects.toMatchObject({ status: 500 });
  });

  it("a genuinely malformed approved version (no treatmentPlan at all) still fails closed", async () => {
    findUniqueAssessment.mockResolvedValue(assessmentRow("APPROVED", "PENDING", {}));
    await expect(loadOnePageReportData(ASSESSMENT_ID)).rejects.toMatchObject({ status: 500 });
    await expect(loadOnePageReportData(ASSESSMENT_ID)).rejects.toThrow(/kit lineup data is missing or invalid/);
  });

  it("a PENDING_REVIEW version with no kitPhases does NOT fail closed — the gate is approval-specific", async () => {
    // Only an APPROVED version is held to this invariant. A draft in progress
    // has every right to be incomplete.
    getClinicContext.mockResolvedValue({ userId: "u", role: "DOCTOR", clinicId: "clinic-1", email: null });
    findUniqueAssessment.mockResolvedValue(assessmentRow("PENDING_REVIEW", "PENDING", {}));
    const data = await loadOnePageReportData(ASSESSMENT_ID);
    expect(data).toBeTruthy();
  });
});
