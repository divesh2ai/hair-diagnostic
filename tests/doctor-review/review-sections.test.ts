// Pure logic behind the new review sections.
//
// The jest environment here is `node`, so these cover the decision functions
// rather than rendered output: what the waiting clock reads, and — more
// importantly — when the Clinical Attention section speaks at all.

import { describe, it, expect } from "@jest/globals";
import { waitingTime } from "@/lib/format/waitingTime";
import { buildAttentionItems } from "@/lib/doctor/clinicalAttention";
import type { Consultation } from "@shared/types/consultation";

const NOW = Date.parse("2026-08-13T10:14:00.000Z");

function confidence(
  band: "low" | "moderate" | "high",
  missing: Array<{ kind: string; reason: string; suggestion: string }> = [],
): Consultation["confidence"] {
  const score = { score: band === "high" ? 0.9 : band === "moderate" ? 0.6 : 0.3, band, rationale: "" };
  return {
    overall: score,
    bySection: { diagnosis: score, rootCause: score, treatment: score },
    missingInformation: missing,
  } as unknown as Consultation["confidence"];
}

function readiness(grounding: number, gaps: number) {
  return {
    ready: grounding === 0 && gaps === 0,
    blockingCodes: [],
    groundingViolationCount: grounding,
    reasoningGapCount: gaps,
    doctorSummary: "",
    groundingViolations: [],
    reasoningGaps: [],
  };
}

describe("waiting clock — shared with the queue", () => {
  const NOW_DATE = new Date(NOW);

  it("measures from assessment submission, not from intake", () => {
    // 10:02 identity captured · 10:08 submitted · 10:14 viewed.
    // The case has been waiting 6 minutes, not 12. The header is fed
    // `visit.submittedAt` precisely so this stays true.
    expect(waitingTime("2026-08-13T10:08:00.000Z", NOW_DATE)).toBe("6 minutes ago");
  });

  it("uses the same helper the queue uses, so the two never disagree", () => {
    // Regression guard for the drift this module's own header warns about:
    // ReviewHeader must not grow a local formatter.
    const src = require("node:fs").readFileSync(
      "apps/patient-portal/src/app/doctor/reports/[assessmentId]/sections/ReviewHeader.tsx",
      "utf-8",
    );
    expect(src).toContain('from "@/lib/format/waitingTime"');
    expect(src).not.toMatch(/function\s+(formatWaiting|waitingMinutes)/);
  });

  it("does not render a clock when there is no submission time", () => {
    expect(waitingTime(null, NOW_DATE)).toBe("—");
  });

  it("does not go backwards on clock skew", () => {
    expect(waitingTime("2026-08-13T10:20:00.000Z", NOW_DATE)).toBe("just now");
  });
});

describe("clinical attention — silence by default", () => {
  it("says nothing on a clean case", () => {
    // The single most important behaviour here. A card reading "no issues"
    // on every routine case trains doctors to skip the region.
    const items = buildAttentionItems({
      confidence: confidence("high"),
      readiness: readiness(0, 0),
      degradedReasons: [],
    });
    expect(items).toHaveLength(0);
  });

  it("never asserts an all-clear", () => {
    const items = buildAttentionItems({
      confidence: confidence("high"),
      readiness: readiness(0, 0),
      degradedReasons: [],
    });
    const text = JSON.stringify(items).toLowerCase();
    expect(text).not.toContain("no red flags");
    expect(text).not.toContain("nothing detected");
  });
});

describe("clinical attention — real signals only", () => {
  it("classifies a grounding violation as a soft narrative note, not a contradiction", () => {
    // Governance change: a grounding violation is a narrative-prose defect
    // (an unsupported SENTENCE), not a treatment-safety contradiction. It is a
    // soft advisory the doctor may approve past — the wording is corrected, the
    // plan is untouched — so it must NOT be surfaced as a hard contradiction.
    const items = buildAttentionItems({
      confidence: confidence("high"),
      readiness: readiness(2, 0),
      degradedReasons: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("limitation");
    expect(items[0]!.severity).toBe("soft");
    expect(items[0]!.title).toBe("Narrative wording note");
    expect(items[0]!.detail).toContain("Does not affect the treatment plan or prevent approval");
  });

  it("classifies reasoning gaps as attention, since the doctor can proceed", () => {
    const items = buildAttentionItems({
      confidence: confidence("high"),
      readiness: readiness(0, 1),
      degradedReasons: [],
    });
    expect(items[0]!.kind).toBe("attention");
    expect(items[0]!.detail).toContain("1 recommendation");
    expect(items[0]!.detail).toContain("does not prevent approval");
  });

  it("flags low confidence but not moderate or high", () => {
    for (const band of ["high", "moderate"] as const) {
      expect(
        buildAttentionItems({
          confidence: confidence(band),
          readiness: readiness(0, 0),
          degradedReasons: [],
        }),
      ).toHaveLength(0);
    }
    expect(
      buildAttentionItems({
        confidence: confidence("low"),
        readiness: readiness(0, 0),
        degradedReasons: [],
      }),
    ).toHaveLength(1);
  });

  it("treats a legacy record as a limitation, never as a red flag", () => {
    const items = buildAttentionItems({
      confidence: confidence("high"),
      readiness: readiness(0, 0),
      degradedReasons: ["LEGACY_RAW_RESPONSES_MISSING"],
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("limitation");
  });

  it("shows no implementation language to the doctor", () => {
    const items = buildAttentionItems({
      confidence: confidence("low"),
      readiness: readiness(1, 1),
      degradedReasons: ["LEGACY_RAW_RESPONSES_MISSING"],
    });
    const text = JSON.stringify(items);
    for (const leak of ["rawResponses", "LEGACY_DEGRADED", "LEGACY_RAW_RESPONSES_MISSING", "null"]) {
      expect(text).not.toContain(leak);
    }
  });

  it("surfaces missing-input reasons the engine actually recorded", () => {
    const items = buildAttentionItems({
      confidence: confidence("high", [
        { kind: "SCALP_IMAGES", reason: "Vertex photo confirms miniaturisation.", suggestion: "" },
      ]),
      readiness: readiness(0, 0),
      degradedReasons: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("limitation");
    expect(items[0]!.detail).toContain("Vertex photo");
  });

  it("tolerates a missing readiness snapshot without inventing a warning", () => {
    const items = buildAttentionItems({
      confidence: confidence("high"),
      readiness: null,
      degradedReasons: [],
    });
    expect(items).toHaveLength(0);
  });
});
