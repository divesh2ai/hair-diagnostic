import { describe, expect, it } from "vitest";
import { evaluateClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../../src/packages/ai-engine/kit-scorer/scoreKits";
import { buildClinicalReport } from "../../src/packages/ai-engine/report-engine/buildClinicalReport";
import { getKitInfo } from "../../src/packages/registries/kits/info";
import { budgetForFixture, loadAllFixtures, OPEN_CLINIC } from "../fixtures/loader";

describe("Post Hysterectomy Kit patient copy", () => {
  it("uses the canonical recovery paragraph for why the kit was selected", () => {
    const fixture = loadAllFixtures()[0];
    expect(fixture).toBeDefined();

    const answers = { ...fixture.answers, hormonal: ["Post-hysterectomy"] };
    const profile = evaluateClinicalProfile(answers);
    const needs = mapTherapyNeeds(profile);
    const scored = scoreKits(profile, needs, answers, OPEN_CLINIC, budgetForFixture(fixture));
    const first = scored.rankedKits[0];
    expect(first).toBeDefined();

    const kits = {
      ...scored,
      rankedKits: [{ ...first, kitId: "PRO FACT POST HYSTERECTOMY RESET", phase: 1 }],
    };
    const report = buildClinicalReport(
      { name: "Test Patient", age: 42, sex: answers.sex },
      profile,
      needs,
      kits,
      answers,
    );

    expect(report.treatmentStrategy[0]?.whySelected).toBe(
      getKitInfo("PRO FACT POST HYSTERECTOMY RESET")?.diagnosisInsight,
    );
  });
});
