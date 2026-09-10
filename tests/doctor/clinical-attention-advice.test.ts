import { describe, it, expect } from "vitest";
import { buildAttentionItems } from "@/lib/doctor/clinicalAttention";
import type { Consultation } from "@shared/types/consultation";

// Guards the fix for the one UI-authored clinical advisory that used to live in
// clinicalAttention.ts: on a low-confidence case with no engine rationale, the
// UI printed "…Clinical examination is advisable." — invented medical advice.
// The UI must show the EXACT engine rationale when present, and NOTHING it
// authored itself when absent.

const QUIET = { readiness: null, degradedReasons: [] as string[] };

function lowConfidence(rationale?: string): Consultation["confidence"] {
  return {
    overall: { band: "low", rationale },
  } as unknown as Consultation["confidence"];
}

describe("buildAttentionItems — low confidence never fabricates advice", () => {
  it("shows the engine rationale verbatim when it exists", () => {
    const items = buildAttentionItems({ ...QUIET, confidence: lowConfidence("Only questionnaire on file; no images.") });
    const low = items.find((i) => i.title === "Limited supporting evidence");
    expect(low).toBeDefined();
    expect(low!.detail).toBe("Only questionnaire on file; no images.");
  });

  it("authors NO advice when the engine gave no rationale", () => {
    const items = buildAttentionItems({ ...QUIET, confidence: lowConfidence(undefined) });
    const low = items.find((i) => i.title === "Limited supporting evidence");
    expect(low).toBeDefined();
    // Detail is empty (the section omits an empty detail) — not an invented line.
    expect(low!.detail).toBe("");
    // The removed advisory must not reappear anywhere in the output.
    const text = JSON.stringify(items).toLowerCase();
    expect(text).not.toContain("advisable");
    expect(text).not.toContain("clinical examination");
  });

  it("treats a whitespace-only rationale as absent (no fabricated fallback)", () => {
    const items = buildAttentionItems({ ...QUIET, confidence: lowConfidence("   ") });
    const low = items.find((i) => i.title === "Limited supporting evidence");
    expect(low!.detail).toBe("");
  });
});
