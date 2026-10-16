import { createRequire } from "node:module";
import { afterAll, describe, expect, it, vi } from "vitest";
import { OnePageHairReport } from "../../apps/patient-portal/src/components/reports/one-page/OnePageHairReport";
import { buildOnePageReportViewModel } from "../../apps/patient-portal/src/lib/reports/one-page/viewModel";
import type { ClinicalReport } from "../../src/packages/ai-engine/report-engine/types";

const require = createRequire(new URL("../../apps/patient-portal/package.json", import.meta.url));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

const report = {
  patientSummary: { name: "Synthetic Patient", age: 30, gender: "Female", goal: [],
    hairLossPattern: [], scalpConcerns: [], lifestyleFactors: [], medicalFactors: [],
    previousTreatments: [], questionnaireSelections: {}, clinicalInterpretation: [] },
  rootCauseAnalysis: { primary: [], secondary: [], amplifiers: [] },
  treatmentStrategy: [], topicalRecommendations: [], topicalCautions: [],
  recoveryRoadmap: [], recoveryMilestones: [], dietAndLifestyle: [],
  generatedAt: "2026-10-16T00:00:00Z", schemaVersion: "v4",
} as unknown as ClinicalReport;

function model(status: string) {
  return buildOnePageReportViewModel(report, {
    assessmentId: "synthetic", clinician: { name: "Dr. Meha Mhatre", signatureUrl: "https://example.com/verified-signature.png" },
    approval: { status, approvedBy: "Dr. Meha Mhatre", approvedAt: "2026-10-16T00:00:00Z" },
  });
}

describe("one-page actual printed approval labels", () => {
  it.each(["PENDING_REVIEW", "PENDING", "DRAFT", "REVISION_REQUESTED", "EDITS_REQUESTED", "REJECTED"])("prints %s as a draft without approval or signature claims", status => {
    const data = model(status);
    expect(data.doctorApproval.state).not.toBe("REVIEWED");
    expect(data.doctorApproval.signatureUrl).toBeNull();
    expect(data.clinicalResult.reviewedBy).toMatch(/awaiting doctor review/i);
    // Even an accidental stale signature on the supplied model stays hidden.
    data.doctorApproval.signatureUrl = "https://example.com/stale-signature.png";
    const html = renderToStaticMarkup(React.createElement(OnePageHairReport, { data }));
    expect(html).toContain("AWAITING DOCTOR REVIEW");
    expect(html).not.toMatch(/DOCTOR-REVIEWED|DOCTOR<br\s*\/>REVIEWED|Reviewed &amp; Recommended by|signature\.png/i);
  });

  it("prints the approved doctor, approval date and available signature", () => {
    const data = model("APPROVED");
    const html = renderToStaticMarkup(React.createElement(OnePageHairReport, { data }));
    expect(html).toContain("DOCTOR-REVIEWED RESULT");
    expect(html).toContain("Dr. Meha Mhatre");
    expect(html).toContain(`Approved: ${data.doctorApproval.approvedAt}`);
    expect(html).toContain("verified-signature.png");
    expect(html).not.toContain("AWAITING DOCTOR REVIEW");
  });
});
