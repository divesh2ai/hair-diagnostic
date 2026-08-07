import { describe, expect, it } from "vitest";

import { evaluateClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { scoreKits } from "../../src/packages/ai-engine/kit-scorer/scoreKits";
import { brandNameFor } from "../../src/packages/ai-engine/report-engine/v3/kitBrandNames";
import { mapTherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import type { PatientAnswers } from "../../src/packages/types";

describe("patient-facing kit brand names", () => {
  it.each([
    ["PRO IMMUNE GOLD", "Pro Immune 5"],
    ["PRO IMMUNE VEG", "Pro Immune 5"],
    ["MPHL", "MPHL Pro"],
    ["MPHL PLUS", "MPHL Pro"],
    ["FPHL", "FPHL Pro"],
    ["FPHL PLUS", "FPHL Pro"],
  ])("maps %s to %s", (kitId, expectedName) => {
    expect(brandNameFor(kitId)).toBe(expectedName);
  });
});

const clinic = {
  clinicId: "kit-name-test",
  availableKits: ["MPHL", "FPHL", "PRO IMMUNE GOLD", "PHENOTYPE INFLAMATION"],
};

describe("current pattern kit availability", () => {
  it.each([
    ["Male", "MPHL"],
    ["Female", "FPHL"],
  ])("does not emit obsolete Plus kit ids for advanced %s pattern loss", (sex, expectedKit) => {
    const answers: PatientAnswers = {
      sex,
      age: "40",
      grade: "Grade 4",
      thyroid: [], hormonal: [], lifestyle: [], diet: [],
      cause: ["Genetics"], scalp: [], immunity: [], deficiency: [],
      gut: [], hairtype: ["Thinning"], treatment: [],
      goal: ["Regrow hair"], duration: "More than 6 months", count: "No visible fall",
    };
    const profile = evaluateClinicalProfile(answers);
    const recommendation = scoreKits(
      profile,
      mapTherapyNeeds(profile),
      answers,
      clinic,
      { tier: "STANDARD", maxKits: 5 },
    );
    const ids = recommendation.rankedKits.map((kit) => kit.kitId);

    expect(ids).toContain(expectedKit);
    expect(ids.some((id) => id.includes("PLUS"))).toBe(false);
  });
});