/**
 * Phase 1 snapshot test — proves buildFourChapterNarrative works end-to-end
 * on Sara's ClinicalReport.
 *
 * What this test asserts:
 *   1. The builder produces a FourChapterNarrative from a real ClinicalReport.
 *   2. Chapter 2 is sourced exclusively from clinicalInterpretation
 *      (sourcePolicy marker enforced).
 *   3. Chapter counts match expectations for Sara's case.
 *   4. The full output matches the persisted snapshot at sara.snapshot.json.
 *
 * Phase 1 does NOT alter any renderer. This test only proves the runtime
 * type + builder are real.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { buildFourChapterNarrative } from "../../src/packages/narrative-engine";
import type { FourChapterNarrative } from "../../src/packages/narrative-engine";
import type { ClinicalReport } from "../../src/packages/ai-engine/report-engine/types";

const FIXTURE_DIR = path.join(__dirname);
const REPORT_FIXTURE = path.join(FIXTURE_DIR, "sara.clinicalReport.json");
const SNAPSHOT_FILE = path.join(FIXTURE_DIR, "sara.snapshot.json");

function loadSaraReport(): ClinicalReport {
  const raw = fs.readFileSync(REPORT_FIXTURE, "utf8");
  return JSON.parse(raw) as ClinicalReport;
}

describe("buildFourChapterNarrative — Sara", () => {
  let report: ClinicalReport;
  let narrative: FourChapterNarrative;

  beforeAll(() => {
    report = loadSaraReport();
    narrative = buildFourChapterNarrative(report);
  });

  test("returns four chapters", () => {
    expect(narrative).toHaveProperty("chapter1");
    expect(narrative).toHaveProperty("chapter2");
    expect(narrative).toHaveProperty("chapter3");
    expect(narrative).toHaveProperty("chapter4");
  });

  test("chapter 1 sourced from PatientSummary", () => {
    expect(narrative.chapter1.hairPattern).toEqual(
      report.patientSummary.hairLossPattern,
    );
    expect(narrative.chapter1.scalpConcerns).toEqual(
      report.patientSummary.scalpConcerns,
    );
    expect(narrative.chapter1.goal).toEqual(report.patientSummary.goal);
    expect(narrative.chapter1.duration).toEqual(
      report.patientSummary.hairLossDuration ?? null,
    );
  });

  test("chapter 2 sourcePolicy === clinicalInterpretation_only", () => {
    expect(narrative.chapter2.sourcePolicy).toBe("clinicalInterpretation_only");
  });

  test("chapter 2 factor count === clinicalInterpretation row count", () => {
    expect(narrative.chapter2.factors).toHaveLength(
      report.patientSummary.clinicalInterpretation.length,
    );
  });

  test("chapter 2 factor.interpretation === verbatim ClinicalInterpretation.interpretation", () => {
    narrative.chapter2.factors.forEach((factor, idx) => {
      const row = report.patientSummary.clinicalInterpretation[idx];
      expect(factor.signal).toBe(row.signal);
      expect(factor.interpretation).toBe(row.interpretation);
    });
  });

  test("chapter 3 phases === treatmentStrategy phases", () => {
    expect(narrative.chapter3.phases).toHaveLength(
      report.treatmentStrategy.length,
    );
    narrative.chapter3.phases.forEach((phase, idx) => {
      const src = report.treatmentStrategy[idx];
      expect(phase.phase).toBe(src.phase);
      expect(phase.kitId).toBe(src.kitId);
      expect(phase.kitName).toBe(src.displayName);
      expect(phase.whySelected).toBe(src.whySelected);
    });
  });

  test("chapter 4 stages === recoveryMilestones", () => {
    expect(narrative.chapter4.stages).toHaveLength(
      report.recoveryMilestones.length,
    );
    narrative.chapter4.stages.forEach((stage, idx) => {
      expect(stage.window).toBe(report.recoveryMilestones[idx].window);
      expect(stage.bullets).toEqual(report.recoveryMilestones[idx].bullets);
    });
  });

  test("snapshot stability", () => {
    if (process.env.UPDATE_SNAPSHOT === "1") {
      fs.writeFileSync(
        SNAPSHOT_FILE,
        JSON.stringify(narrative, null, 2) + "\n",
        "utf8",
      );
    }
    const snapshot = JSON.parse(
      fs.readFileSync(SNAPSHOT_FILE, "utf8"),
    ) as FourChapterNarrative;
    expect(narrative).toEqual(snapshot);
  });
});
