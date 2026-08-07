import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_OPTION_ASSETS,
  clinicalOptionCodeForLabel,
  isClinicalOptionExcluded,
  resolveClinicalOptionAsset,
} from "../../apps/patient-portal/src/lib/reports/one-page/clinicalOptionAssets";

describe("clinical option asset registry", () => {
  it("resolves exact questionnaire aliases to the same patient-facing asset", () => {
    const resolved = resolveClinicalOptionAsset({ label: "Stress / Anxiety" });
    expect(resolved.optionCode).toBe("stress_anxiety_depression");
    expect(resolved.status).toBe("exact");
    expect(resolved.asset.src).toBe("/report-assets/clinical-options/stress_anxiety_depression.png");
  });

  it("uses a related domain fallback instead of generic follicle art", () => {
    const resolved = resolveClinicalOptionAsset({ label: "PCOS / PCOD" });
    expect(resolved.status).toBe("fallback");
    expect(resolved.asset.src).toContain("hormonal-contributor");
    expect(resolved.asset.src).not.toContain("fallback-neutral");
  });

  it("excludes empty questionnaire choices from snapshots", () => {
    expect(isClinicalOptionExcluded("None of the above")).toBe(true);
    expect(isClinicalOptionExcluded("No gut issues")).toBe(true);
    expect(isClinicalOptionExcluded("Endometriosis")).toBe(false);
  });

  it("has unique exact paths and files for every approved crop", () => {
    const exact = Object.values(CLINICAL_OPTION_ASSETS).filter((entry) => entry.status === "exact");
    expect(new Set(exact.map((entry) => entry.assetPath)).size).toBe(exact.length);
    for (const entry of exact) {
      const file = path.resolve("apps/patient-portal/public", entry.assetPath.replace(/^\//, ""));
      expect(existsSync(file), `${clinicalOptionCodeForLabel(entry.label)} file`).toBe(true);
    }
  });
});
