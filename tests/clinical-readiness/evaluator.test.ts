// Pure evaluator contract. Deterministic, never throws, fail-closed for
// missing / malformed snapshots.

import { describe, it, expect } from "@jest/globals";
import {
  evaluateClinicalReadinessForApproval,
  toPatientSafeReadinessDecision,
  isSoftAdvisoryOnly,
  isHardBlocked,
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

// The one classifier approval and the PDF/render gate share.
describe("isSoftAdvisoryOnly / isHardBlocked — shared governance", () => {
  const evalOf = (s: ClinicalReadinessSnapshot) =>
    evaluateClinicalReadinessForApproval(consultationWith(s));

  // A narrative-prose grounding violation: the write-up SENTENCE mentions
  // something not recorded (Rule 2 / Rule 7). Governance: SOFT — correct the
  // sentence, don't block the clinician. The recommendation is unaffected.
  const groundingSnap = snap({
    isReadyForApproval: false,
    groundingViolations: [
      { ruleId: "scalp.dandruff", section: "What We Found", summary: "mentions dandruff" },
    ],
    blockingCodes: ["GROUNDING_VIOLATION_PRESENT"],
    summary: { groundingViolationCount: 1, reasoningGapCount: 0 },
  });
  // A narrative-completeness reasoning gap: a kit not NAMED in the write-up.
  // Documentation quality, not treatment safety → SOFT.
  const reasoningSnap = snap({
    isReadyForApproval: false,
    reasoningGaps: [{ kind: "kit.notDiscussedInNarrative", subject: "KIT", summary: "not named" }],
    blockingCodes: ["REASONING_GAP_PRESENT"],
    summary: { groundingViolationCount: 0, reasoningGapCount: 1 },
  });
  // Both defects are narrative-prose → the whole set is still SOFT.
  const mixedSnap = snap({
    isReadyForApproval: false,
    groundingViolations: [
      { ruleId: "scalp.dandruff", section: "What We Found", summary: "mentions dandruff" },
    ],
    reasoningGaps: [{ kind: "kit.notDiscussedInNarrative", subject: "KIT", summary: "not named" }],
    blockingCodes: ["GROUNDING_VIOLATION_PRESENT", "REASONING_GAP_PRESENT"],
    summary: { groundingViolationCount: 1, reasoningGapCount: 1 },
  });
  // A recommendation-level evidence failure: a kit selected with NO driver /
  // therapy need / rationale (kind `kit.missingTrigger`). This is treatment
  // safety, not prose → HARD, via RECOMMENDATION_UNSUPPORTED_PRESENT.
  const unsupportedRecoSnap = snap({
    isReadyForApproval: false,
    reasoningGaps: [
      { kind: "kit.missingTrigger", subject: "HAIR FACT TE GOLD", summary: "no trigger" },
    ],
    blockingCodes: ["REASONING_GAP_PRESENT"],
    summary: { groundingViolationCount: 0, reasoningGapCount: 1 },
  });
  // A hard recommendation failure alongside a soft narrative one: HARD wins.
  const unsupportedPlusNarrativeSnap = snap({
    isReadyForApproval: false,
    groundingViolations: [
      { ruleId: "scalp.dandruff", section: "What We Found", summary: "mentions dandruff" },
    ],
    reasoningGaps: [
      { kind: "kit.missingTrigger", subject: "HAIR FACT TE GOLD", summary: "no trigger" },
    ],
    blockingCodes: ["GROUNDING_VIOLATION_PRESENT", "REASONING_GAP_PRESENT"],
    summary: { groundingViolationCount: 1, reasoningGapCount: 1 },
  });

  it("reasoning-gap-only (kit not named) → soft advisory, NOT hard-blocked", () => {
    const d = evalOf(reasoningSnap);
    expect(isSoftAdvisoryOnly(d)).toBe(true);
    expect(isHardBlocked(d)).toBe(false);
  });

  // Guardrail: an unsupported narrative SENTENCE is soft. Correct the wording;
  // do not block the doctor. The treatment plan itself is untouched.
  it("grounding violation (unsupported narrative sentence) → soft, NOT hard", () => {
    const d = evalOf(groundingSnap);
    expect(isSoftAdvisoryOnly(d)).toBe(true);
    expect(isHardBlocked(d)).toBe(false);
    // Still not ready, still surfaced — soft ≠ invisible.
    expect(d.ready).toBe(false);
    expect(d.blockingCodes).toContain("GROUNDING_VIOLATION_PRESENT");
  });

  it("mixed narrative (grounding + kit-not-named) → soft, NOT hard", () => {
    const d = evalOf(mixedSnap);
    expect(isSoftAdvisoryOnly(d)).toBe(true);
    expect(isHardBlocked(d)).toBe(false);
  });

  // Guardrail: an unsupported TREATMENT RECOMMENDATION is hard. A kit in the
  // protocol with nothing supporting why it was selected must block approval.
  it("unsupported recommendation (kit.missingTrigger) → hard-blocked, NOT soft", () => {
    const d = evalOf(unsupportedRecoSnap);
    expect(d.blockingCodes).toContain("RECOMMENDATION_UNSUPPORTED_PRESENT");
    expect(isHardBlocked(d)).toBe(true);
    expect(isSoftAdvisoryOnly(d)).toBe(false);
  });

  it("hard recommendation failure + soft narrative → hard-blocked (hard wins)", () => {
    const d = evalOf(unsupportedPlusNarrativeSnap);
    expect(d.blockingCodes).toContain("RECOMMENDATION_UNSUPPORTED_PRESENT");
    expect(isHardBlocked(d)).toBe(true);
    expect(isSoftAdvisoryOnly(d)).toBe(false);
  });

  it("missing snapshot → hard-blocked (fail closed)", () => {
    const d = evaluateClinicalReadinessForApproval(consultationWith(undefined));
    expect(isHardBlocked(d)).toBe(true);
    expect(isSoftAdvisoryOnly(d)).toBe(false);
  });

  it("clean/ready → neither soft-only nor hard-blocked", () => {
    const d = evalOf(snap());
    expect(isSoftAdvisoryOnly(d)).toBe(false);
    expect(isHardBlocked(d)).toBe(false);
  });
});

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
