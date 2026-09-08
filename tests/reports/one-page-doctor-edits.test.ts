// The one-pager (and its permanent approval snapshot) must reflect the
// doctor's saved kit lineup, not the frozen AI-recommendation snapshot from
// submission time.
//
// `loadOnePageReportData` used to read `clinical_report.treatmentStrategy`
// straight off the NARRATIVES artifact — a snapshot written once, at
// submission, before any doctor ever opened the case. KitLineupEditor saves
// go to `ConsultationVersion.content.treatmentPlan.kitPhases` instead, so a
// doctor who removed, reordered, or substituted a kit would see the change
// everywhere (Consultation JSON, cart, KitOrderIntent) except here — the
// document a patient actually ends up holding. This suite pins the overlay
// that fixes that: `treatmentStrategy` handed to the view-model builder must
// come from the doctor's current saved kit lineup when one exists, and must
// only fall back to the original artifact when it doesn't.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueAssessment = vi.fn();
const findFirstArtifact = vi.fn();
const getClinicContext = vi.fn();

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

vi.mock("@/lib/conferenceMode", () => ({ isConferenceMode: () => false }));
vi.mock("@/lib/reviewToken", () => ({
  signReviewToken: () => "signed-token",
  verifyReviewToken: () => ({ ok: false }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Map() }));

// Capture what the view-model builder actually receives as the report,
// instead of composing a real report.
vi.mock("@/lib/reports/one-page/viewModel", () => ({
  buildOnePageReportViewModel: (report: unknown) => ({ report }),
}));

const { loadOnePageReportData } = await import("@/lib/reports/one-page/loadReport");

const ASSESSMENT_ID = "asm-1";
const ORIGINAL_STRATEGY = [{ kitId: "MPHL", phase: 1, displayName: "MPHL Pro" }];

function assessmentRow(treatmentPlan: Record<string, unknown> | undefined) {
  return {
    id: ASSESSMENT_ID,
    clinicId: "clinic-1",
    reviewDecision: "APPROVED",
    reviewedAt: null,
    reviewerName: null,
    updatedAt: new Date("2026-09-08T00:00:00.000Z"),
    rawResponses: {},
    patient: { name: "P", age: 30, gender: "female", phone: null },
    clinic: { name: "C", address: null, phone: null, logoUrl: null },
    reviewingDoctor: { name: "Dr A", signatureUrl: null },
    consultations: [
      {
        currentVersion: {
          approvalStatus: "APPROVED",
          approvedAt: null,
          approvedBy: "Dr A",
          content: treatmentPlan ? { treatmentPlan } : {},
        },
      },
    ],
  };
}

/** Legacy row: approved via `reviewDecision`, no consultation version at all. */
function legacyApprovedRow() {
  return {
    id: ASSESSMENT_ID,
    clinicId: "clinic-1",
    reviewDecision: "APPROVED",
    reviewedAt: null,
    reviewerName: null,
    updatedAt: new Date("2026-09-08T00:00:00.000Z"),
    rawResponses: {},
    patient: { name: "P", age: 30, gender: "female", phone: null },
    clinic: { name: "C", address: null, phone: null, logoUrl: null },
    reviewingDoctor: { name: "Dr A", signatureUrl: null },
    consultations: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ALLOW_DEV_LOGIN", "0");
  getClinicContext.mockResolvedValue({
    userId: "u",
    role: "DOCTOR",
    clinicId: "clinic-1",
    email: null,
  });
  findFirstArtifact.mockResolvedValue({
    content: {
      clinical_report: {
        treatmentStrategy: ORIGINAL_STRATEGY,
        otherField: "untouched",
      },
    },
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

it("overlays the doctor's saved kitPhases onto the report's treatmentStrategy", async () => {
  const editedPhases = [{ kitId: "M4_PLUS", phase: 1, displayName: "M4+" }];
  findUniqueAssessment.mockResolvedValue(
    assessmentRow({ kitPhases: editedPhases, topicals: [], topicalCautions: [] }),
  );

  const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
    report: { treatmentStrategy: unknown; otherField: string };
  };

  expect(data.report.treatmentStrategy).toEqual(editedPhases);
  // Fields the doctor never edits pass through from the original snapshot.
  expect(data.report.otherField).toBe("untouched");
});

it("falls back to the original snapshot's treatmentStrategy for legacy rows with no consultation version", async () => {
  // A row approved via `assessment.reviewDecision` before the consultation
  // aggregate existed has no ConsultationVersion and therefore no kit editor
  // history — NARRATIVES is the only available lineup and the fallback is
  // correct for these historical rows.
  findUniqueAssessment.mockResolvedValue(legacyApprovedRow());

  const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
    report: { treatmentStrategy: unknown };
  };

  expect(data.report.treatmentStrategy).toEqual(ORIGINAL_STRATEGY);
});

it("fails closed when a consultation version is approved but kitPhases data is absent", async () => {
  // Approved consultation + missing kitPhases is corrupted state: the doctor
  // used the kit editor (so `buildConsultation` should have written
  // `kitPhases`), but the data is gone. Silently serving the NARRATIVES
  // artifact would present AI-generated kits as the approved prescription.
  // The loader must throw rather than fall back.
  findUniqueAssessment.mockResolvedValue(
    assessmentRow(undefined), // currentVersion present + approvalStatus APPROVED + content: {}
  );

  await expect(loadOnePageReportData(ASSESSMENT_ID)).rejects.toMatchObject({
    status: 500,
  });
});

it("reflects a doctor's kit removal, including down to an empty lineup", async () => {
  findUniqueAssessment.mockResolvedValue(
    assessmentRow({ kitPhases: [], topicals: [], topicalCautions: [] }),
  );

  const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
    report: { treatmentStrategy: unknown };
  };

  expect(data.report.treatmentStrategy).toEqual([]);
});

it("a budget substitution shows only the final kit, never both lines", async () => {
  // The required E2E example: MPHL PRO -> Edit/Change -> M4+ -> Save. The
  // report artifact still says "MPHL" (ORIGINAL_STRATEGY, from
  // findFirstArtifact above); the doctor's saved kitPhases now says M4+ with
  // substitution provenance in `meta`, exactly what the kit-substitution
  // route persists.
  const substitutedPhase = {
    kitId: "M4_PLUS",
    phase: 1,
    displayName: "M4+",
    meta: {
      substitution: {
        type: "BUDGET",
        reason: "BUDGET_AFFORDABILITY",
        originalKitId: "MPHL",
        originalPhase: ORIGINAL_STRATEGY[0],
      },
    },
  };
  findUniqueAssessment.mockResolvedValue(
    assessmentRow({ kitPhases: [substitutedPhase], topicals: [], topicalCautions: [] }),
  );

  const data = (await loadOnePageReportData(ASSESSMENT_ID)) as {
    report: { treatmentStrategy: Array<{ kitId: string; displayName: string }> };
  };

  expect(data.report.treatmentStrategy).toHaveLength(1);
  expect(data.report.treatmentStrategy[0]!.kitId).toBe("M4_PLUS");
  expect(data.report.treatmentStrategy[0]!.displayName).toBe("M4+");
  // No trace of the pre-substitution kit as a second, separate line.
  expect(data.report.treatmentStrategy.some((p) => p.kitId === "MPHL")).toBe(false);
});
