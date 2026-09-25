// Regression guard: soft AI Review Notes are GONE from the normal Doctor
// Review screen, while the two governance rules that must survive it do.
//
// The change: ClinicalAttentionSection renders ONLY hard clinical/safety items
// and renders nothing when there are none. The soft advisories (narrative
// wording notes, reasoning gaps, optional-information suggestions, AI
// completeness messages) are still DERIVED by buildAttentionItems from the
// persisted readiness snapshot — so they remain in the readiness metadata for
// auditability — but they no longer reach the doctor's consultation flow.
//
// These are pure-logic + source checks, at the same altitude as the other
// review-section tests (the jsdom-free `node` environment the gate runs in):
//   • the section's visibility == "any HARD attention item exists", which is
//     exactly the predicate the component now gates on; and
//   • approval permission == the shared evaluator's hard/soft classifier.

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
// Relative imports (as in attention-safety.test.ts) so the suite type-checks
// under the root tsc as well as running under vitest's aliases.
import { buildAttentionItems } from "../../apps/patient-portal/src/lib/doctor/clinicalAttention";
import {
  evaluateClinicalReadinessForApproval,
  isHardBlocked,
} from "../../packages/shared/clinical-readiness/evaluator";
import type {
  ClinicalReadinessSnapshot,
  Consultation,
} from "../../packages/shared/types/consultation";

// What the component renders is `buildAttentionItems(...)` filtered to hard
// severity; it returns null when that list is empty. So "no Clinical Attention
// UI" is provably equivalent to "no hard attention items".
function hardItems(input: Parameters<typeof buildAttentionItems>[0]) {
  return buildAttentionItems(input).filter((i) => i.severity === "hard");
}

function snap(overrides: Partial<ClinicalReadinessSnapshot> = {}): ClinicalReadinessSnapshot {
  return {
    schemaVersion: 1,
    evaluatedAt: "2026-09-25T00:00:00.000Z",
    sourceClinicalArtifactVersion: "v5",
    isReadyForApproval: true,
    groundingViolations: [],
    reasoningGaps: [],
    blockingCodes: [],
    summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
    ...overrides,
  };
}

const consultationWith = (s?: ClinicalReadinessSnapshot): Consultation =>
  ({ clinicalReadiness: s } as unknown as Consultation);

// Mirrors the render-time shape ClinicalAttentionSection receives from the
// readiness metadata (the snapshot's counts + violation detail).
const readinessFor = (s: ClinicalReadinessSnapshot) => ({
  ready: false,
  blockingCodes: s.blockingCodes,
  groundingViolationCount: s.summary.groundingViolationCount,
  reasoningGapCount: s.summary.reasoningGapCount,
  doctorSummary: "",
  groundingViolations: s.groundingViolations,
  reasoningGaps: s.reasoningGaps,
});

const QUIET_CONFIDENCE = {
  overall: { band: "high", rationale: "" },
} as unknown as Consultation["confidence"];

describe("doctor review — soft AI Review Notes removed, governance preserved", () => {
  it("1 · narrative-only GLP-1 issue → no Clinical Attention UI, and Approve is allowed", () => {
    // A grounding violation is a narrative-prose defect: the write-up SENTENCE
    // mentions GLP-1 the patient did not report. Soft by governance.
    const s = snap({
      isReadyForApproval: false,
      groundingViolations: [
        {
          ruleId: "meds.glp1",
          section: "What We Found",
          summary: "mentions a GLP-1 medication",
        },
      ],
      blockingCodes: ["GROUNDING_VIOLATION_PRESENT"],
      summary: { groundingViolationCount: 1, reasoningGapCount: 0 },
    });

    // The screen shows nothing: the derived item exists but is soft.
    const all = buildAttentionItems({
      confidence: QUIET_CONFIDENCE,
      readiness: readinessFor(s) as never,
      degradedReasons: [],
    });
    expect(all.some((i) => i.severity === "soft")).toBe(true); // still derived (audit)
    expect(
      hardItems({
        confidence: QUIET_CONFIDENCE,
        readiness: readinessFor(s) as never,
        degradedReasons: [],
      }),
    ).toEqual([]); // ...but nothing hard → section renders null

    // Approval is not hard-blocked: a soft narrative advisory is signed past.
    expect(isHardBlocked(evaluateClinicalReadinessForApproval(consultationWith(s)))).toBe(false);
  });

  it("2 · reasoning gap → no Clinical Attention UI, and Approve is allowed", () => {
    // A narrative-completeness reasoning gap (kit not NAMED in the write-up) is
    // documentation quality, not treatment safety. Soft.
    const s = snap({
      isReadyForApproval: false,
      reasoningGaps: [
        { kind: "kit.notDiscussedInNarrative", subject: "KIT", summary: "not named" },
      ],
      blockingCodes: ["REASONING_GAP_PRESENT"],
      summary: { groundingViolationCount: 0, reasoningGapCount: 1 },
    });

    const all = buildAttentionItems({
      confidence: QUIET_CONFIDENCE,
      readiness: readinessFor(s) as never,
      degradedReasons: [],
    });
    expect(all.some((i) => i.severity === "soft")).toBe(true); // still derived (audit)
    expect(
      hardItems({
        confidence: QUIET_CONFIDENCE,
        readiness: readinessFor(s) as never,
        degradedReasons: [],
      }),
    ).toEqual([]); // no hard item → section renders null

    expect(isHardBlocked(evaluateClinicalReadinessForApproval(consultationWith(s)))).toBe(false);
  });

  it("3 · a real hard safety issue → Clinical Attention IS shown", () => {
    const items = hardItems({
      confidence: null,
      readiness: null,
      degradedReasons: [],
      safety: [
        { label: "Isotretinoin", reason: "Active course", source: "Contraindication" },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      severity: "hard",
      title: "Contraindication: Isotretinoin",
    });
  });

  it("3b · a hard recommendation issue (unsupported kit) blocks approval", () => {
    // kit.missingTrigger → RECOMMENDATION_UNSUPPORTED_PRESENT → HARD block.
    const s = snap({
      isReadyForApproval: false,
      reasoningGaps: [
        { kind: "kit.missingTrigger", subject: "HAIR FACT TE GOLD", summary: "no trigger" },
      ],
      blockingCodes: ["REASONING_GAP_PRESENT", "RECOMMENDATION_UNSUPPORTED_PRESENT"],
      summary: { groundingViolationCount: 0, reasoningGapCount: 1 },
    });
    const decision = evaluateClinicalReadinessForApproval(consultationWith(s));
    expect(decision.blockingCodes).toContain("RECOMMENDATION_UNSUPPORTED_PRESENT");
    expect(isHardBlocked(decision)).toBe(true);
  });

  it("3c · missing / malformed readiness is a hard block", () => {
    expect(isHardBlocked(evaluateClinicalReadinessForApproval(consultationWith(undefined)))).toBe(true);
    expect(
      isHardBlocked(
        evaluateClinicalReadinessForApproval({ clinicalReadiness: { bogus: true } } as unknown as Consultation),
      ),
    ).toBe(true);
  });
});

describe("ClinicalAttentionSection source — soft notes are not rendered", () => {
  const src = readFileSync(
    "apps/patient-portal/src/app/doctor/reports/[assessmentId]/sections/ClinicalAttentionSection.tsx",
    "utf-8",
  );

  it("no longer renders an 'AI Review Notes' block", () => {
    // Guards against the collapsed <details> soft-advisory panel creeping back.
    expect(src).not.toContain("AI Review Notes");
    expect(src).not.toMatch(/<details/);
  });

  it("filters to hard items and renders nothing when there are none", () => {
    expect(src).toMatch(/severity === "hard"/);
    expect(src).toMatch(/hard\.length === 0[\s\S]*return null/);
  });
});
