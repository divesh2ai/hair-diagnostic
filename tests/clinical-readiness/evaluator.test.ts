// Pure evaluator contract. Deterministic, never throws, fail-closed for
// missing / malformed snapshots.

import { describe, it, expect } from "@jest/globals";
import {
  evaluateClinicalReadinessForApproval,
  toPatientSafeReadinessDecision,
} from "../../packages/shared/clinical-readiness/evaluator";
import type {
  ClinicalReadinessSnapshot,
  Consultation,
} from "../../packages/shared/types/consultation";

function snap(overrides: Partial<ClinicalReadinessSnapshot> = {}): ClinicalReadinessSnapshot {
  return {
    schemaVersion: 1,
    evaluatedAt: "2026-07-03T00:00:00.000Z",
    sourceClinicalArtifactVersion: "v4",
    isReadyForApproval: true,
    groundingViolations: [],
    reasoningGaps: [],
    blockingCodes: [],
    summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
    ...overrides,
  };
}

const consultationWith = (
  s?: ClinicalReadinessSnapshot | undefined,
): Consultation => ({ clinicalReadiness: s } as unknown as Consultation);

describe("evaluateClinicalReadinessForApproval", () => {
  it("clean snapshot → ready", () => {
    const r = evaluateClinicalReadinessForApproval(consultationWith(snap()));
    expect(r.ready).toBe(true);
    expect(r.blockingCodes).toEqual([]);
    expect(r.doctorSummary).toMatch(/satisfied/i);
  });

  it("grounding violation → blocked with GROUNDING_VIOLATION_PRESENT", () => {
    const r = evaluateClinicalReadinessForApproval(
      consultationWith(
        snap({
          isReadyForApproval: false,
          groundingViolations: [
            { ruleId: "scalp.dandruff", section: "What We Found", summary: "mentions dandruff" },
          ],
          blockingCodes: ["GROUNDING_VIOLATION_PRESENT"],
          summary: { groundingViolationCount: 1, reasoningGapCount: 0 },
        }),
      ),
    );
    expect(r.ready).toBe(false);
    expect(r.blockingCodes).toContain("GROUNDING_VIOLATION_PRESENT");
    expect(r.groundingViolationCount).toBe(1);
  });

  it("reasoning gap → blocked with REASONING_GAP_PRESENT", () => {
    const r = evaluateClinicalReadinessForApproval(
      consultationWith(
        snap({
          isReadyForApproval: false,
          reasoningGaps: [
            { kind: "kit.notDiscussedInNarrative", subject: "HAIR FACT TE GOLD", summary: "not named" },
          ],
          blockingCodes: ["REASONING_GAP_PRESENT"],
          summary: { groundingViolationCount: 0, reasoningGapCount: 1 },
        }),
      ),
    );
    expect(r.ready).toBe(false);
    expect(r.blockingCodes).toContain("REASONING_GAP_PRESENT");
    expect(r.reasoningGapCount).toBe(1);
  });

  it("historical consultation with no snapshot → fail closed READINESS_SNAPSHOT_MISSING", () => {
    const r = evaluateClinicalReadinessForApproval(consultationWith(undefined));
    expect(r.ready).toBe(false);
    expect(r.blockingCodes).toContain("READINESS_SNAPSHOT_MISSING");
    expect(r.doctorSummary).toMatch(/regenerate|revise/i);
  });

  it("null / undefined subject → fail closed", () => {
    expect(evaluateClinicalReadinessForApproval(null).ready).toBe(false);
    expect(evaluateClinicalReadinessForApproval(undefined).ready).toBe(false);
  });

  it("malformed snapshot (missing fields) → READINESS_SNAPSHOT_MALFORMED", () => {
    const bogus = { clinicalReadiness: { schemaVersion: 1 } } as unknown as Consultation;
    const r = evaluateClinicalReadinessForApproval(bogus);
    expect(r.ready).toBe(false);
    expect(r.blockingCodes).toContain("READINESS_SNAPSHOT_MALFORMED");
  });

  it("accepts a bare snapshot too (no Consultation wrapper)", () => {
    const r = evaluateClinicalReadinessForApproval(snap());
    expect(r.ready).toBe(true);
  });

  it("never throws for arbitrary garbage input", () => {
    expect(() =>
      evaluateClinicalReadinessForApproval("not a consultation" as unknown as Consultation),
    ).not.toThrow();
  });
});

describe("toPatientSafeReadinessDecision", () => {
  it("strips doctor-only violation detail and doctorSummary", () => {
    const decision = evaluateClinicalReadinessForApproval(
      consultationWith(
        snap({
          isReadyForApproval: false,
          groundingViolations: [
            { ruleId: "scalp.itching", section: "What We Found", summary: "mentions itching" },
          ],
          blockingCodes: ["GROUNDING_VIOLATION_PRESENT"],
          summary: { groundingViolationCount: 1, reasoningGapCount: 0 },
        }),
      ),
    );
    const safe = toPatientSafeReadinessDecision(decision);
    expect(safe).not.toHaveProperty("groundingViolations");
    expect(safe).not.toHaveProperty("reasoningGaps");
    expect(safe).not.toHaveProperty("doctorSummary");
    expect(safe.blockingCodes).toContain("GROUNDING_VIOLATION_PRESENT");
    expect(safe.groundingViolationCount).toBe(1);
  });
});
