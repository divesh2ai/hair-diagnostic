// Doctor Clinical Validation Loop — small pure-function coverage.
//
// The endpoint-level flows (approve+order, report-retry, feedback) are covered
// through the existing integration harness on top of the schema migration.
// These tests pin behaviours that live in pure helpers so they cannot silently
// drift.

import { describe, it, expect } from "@jest/globals";
import { extractKitIds } from "../../apps/patient-portal/src/lib/consultation/approveAndCreateOrder";
import type { Consultation, TreatmentPhase } from "@shared/types/consultation";

function phase(kitId: string, phaseIndex: number): TreatmentPhase {
  return {
    phase: phaseIndex,
    kitId,
    displayName: `kit-${kitId}`,
    whySelected: "test",
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
  } as TreatmentPhase;
}

function fakeConsultation(kitPhases: TreatmentPhase[]): Consultation {
  return {
    treatmentPlan: {
      recommendations: [],
      kitPhases,
      topicals: [],
      topicalCautions: [],
      expectedTimeline: [],
    },
  } as unknown as Consultation;
}

describe("extractKitIds — final kit order snapshot", () => {
  it("returns kitPhases[].kitId sorted by phase number", () => {
    const c = fakeConsultation([phase("B", 2), phase("A", 1), phase("C", 3)]);
    expect(extractKitIds(c)).toEqual(["A", "B", "C"]);
  });

  it("skips missing kitIds and empty phases", () => {
    const c = fakeConsultation([
      phase("A", 1),
      { ...phase("", 2), kitId: "" } as TreatmentPhase,
      phase("B", 3),
    ]);
    expect(extractKitIds(c)).toEqual(["A", "B"]);
  });

  it("returns empty array when no phases", () => {
    const c = fakeConsultation([]);
    expect(extractKitIds(c)).toEqual([]);
  });
});
