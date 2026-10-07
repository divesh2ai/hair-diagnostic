import { describe, it, expect } from "vitest";
import { patientReportSlug } from "@/lib/reports/patientSlug";
import { reportAssetPath } from "@/lib/reports/assets/contract";
import {
  patientReportObjectName,
  toFilenameSlug,
} from "@hairos/packages/pdf-engine/objectName";

// Reports (long-form PDF + one-pager) are stored under the patient's name, with
// a unique id kept alongside so same-name patients never collide.

describe("patientReportSlug (storage-key-safe)", () => {
  it("lowercases, hyphenates and folds accents", () => {
    expect(patientReportSlug("Rohini Sharma")).toBe("rohini-sharma");
    expect(patientReportSlug("Séraphin O'Neil")).toBe("seraphin-o-neil");
  });
  it("returns empty for no usable name", () => {
    expect(patientReportSlug("")).toBe("");
    expect(patientReportSlug(null)).toBe("");
    expect(patientReportSlug("!!!")).toBe("");
  });
  it("caps length", () => {
    expect(patientReportSlug("a".repeat(100)).length).toBe(60);
  });
});

describe("reportAssetPath — one-pager named by patient + asset id", () => {
  const base = {
    clinicId: "clinic1",
    consultationVersionId: "cv1",
    assetId: "asset9",
    type: "ONE_PAGER_PNG" as const,
  };

  it("includes the patient slug AND the unique asset id", () => {
    expect(reportAssetPath({ ...base, patientSlug: "rohini-sharma" })).toBe(
      "clinic/clinic1/consultation/cv1/one-pager/rohini-sharma-asset9.png",
    );
  });

  it("falls back to the asset id alone when no slug is given", () => {
    expect(reportAssetPath(base)).toBe(
      "clinic/clinic1/consultation/cv1/one-pager/asset9.png",
    );
    expect(reportAssetPath({ ...base, patientSlug: "" })).toBe(
      "clinic/clinic1/consultation/cv1/one-pager/asset9.png",
    );
  });

  it("two same-name patients get distinct keys (different asset id)", () => {
    const a = reportAssetPath({ ...base, assetId: "a1", patientSlug: "rohini-sharma" });
    const b = reportAssetPath({ ...base, assetId: "a2", patientSlug: "rohini-sharma" });
    expect(a).not.toBe(b);
  });
});

describe("patientReportObjectName — long-form PDF filename", () => {
  it("names the file after the patient", () => {
    expect(patientReportObjectName("Rohini Sharma", "assess1")).toBe(
      "rohini-sharma-report.pdf",
    );
  });
  it("falls back to the assessment id when the name is unusable", () => {
    expect(patientReportObjectName("", "assess1")).toBe("assess1-report.pdf");
    expect(patientReportObjectName(null, "assess1")).toBe("assess1-report.pdf");
    expect(patientReportObjectName("###", "assess1")).toBe("assess1-report.pdf");
  });
  it("shares the slug rules with the one-pager helper", () => {
    expect(toFilenameSlug("Séraphin O'Neil")).toBe("seraphin-o-neil");
  });
});
