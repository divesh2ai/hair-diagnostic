import { describe, it, expect } from "vitest";
import {
  buildMergedGroups,
  normalizeSignal,
  ORPHAN_KEY,
} from "@/lib/doctor/clinicalSignals";
import type { ClinicalSummaryViewModel } from "@/lib/doctor/clinicalSummary";

// The "Signals & what they mean" merge joins reported selections to their
// interpretations on normalized signal text (no stable key exists in the
// contract) and must never silently drop an interpretation that fails to match.

type EvItem = { label: string | null; value: string; emphasis: "normal" | "attention" };

function vm(
  evidence: { key: string; category: string; items: EvItem[] }[],
  interpretations: { signal: string; condition: string; interpretation: string }[],
): ClinicalSummaryViewModel {
  // Only `evidence` and `interpretations` are read by buildMergedGroups.
  return { evidence, interpretations } as unknown as ClinicalSummaryViewModel;
}

describe("normalizeSignal", () => {
  it("lowercases, collapses whitespace, strips surrounding punctuation", () => {
    expect(normalizeSignal("  Diffuse   Shedding.  ")).toBe("diffuse shedding");
    expect(normalizeSignal("• Normal scalp")).toBe("normal scalp");
    expect(normalizeSignal("")).toBe("");
  });
});

describe("buildMergedGroups", () => {
  it("joins a matched interpretation onto its reported selection", () => {
    const groups = buildMergedGroups(
      vm(
        [
          {
            key: "HAIR",
            category: "Hair & shedding",
            items: [{ label: "Pattern", value: "Diffuse shedding", emphasis: "attention" }],
          },
        ],
        [
          {
            signal: "Diffuse shedding",
            condition: "Diffuse telogen exit",
            interpretation: "Widespread shedding across the scalp.",
          },
        ],
      ),
    );
    expect(groups).toHaveLength(1);
    const sig = groups[0]!.signals[0]!;
    expect(sig.value).toBe("Diffuse shedding");
    expect(sig.interpreted).toBe(true);
    expect(sig.orphan).toBe(false);
    expect(sig.condition).toBe("Diffuse telogen exit");
    expect(sig.interpretation).toBe("Widespread shedding across the scalp.");
  });

  it("matches despite trailing punctuation / whitespace differences", () => {
    const groups = buildMergedGroups(
      vm(
        [
          {
            key: "SCALP",
            category: "Scalp",
            items: [{ label: null, value: "Normal scalp", emphasis: "normal" }],
          },
        ],
        [
          {
            signal: "  normal scalp. ",
            condition: "Healthy scalp",
            interpretation: "No dandruff, no inflammation.",
          },
        ],
      ),
    );
    const sig = groups[0]!.signals[0]!;
    expect(sig.interpreted).toBe(true);
    expect(sig.condition).toBe("Healthy scalp");
    // No orphan group when everything matched.
    expect(groups.some((g) => g.key === ORPHAN_KEY)).toBe(false);
  });

  it("surfaces an UNMATCHED interpretation in the explicit OTHER group — never dropped", () => {
    const groups = buildMergedGroups(
      vm(
        [
          {
            key: "HAIR",
            category: "Hair & shedding",
            items: [{ label: "Pattern", value: "Diffuse shedding", emphasis: "normal" }],
          },
        ],
        [
          {
            signal: "Recent illness",
            condition: "Post-illness shedding",
            interpretation: "Systemic illness diverts nutrients from the follicle.",
          },
        ],
      ),
    );
    const other = groups.find((g) => g.key === ORPHAN_KEY);
    expect(other, "orphan interpretation must be visible, not dropped").toBeDefined();
    expect(other!.category).toBe("Additional clinical signals");
    const sig = other!.signals[0]!;
    expect(sig.value).toBe("Recent illness");
    expect(sig.orphan).toBe(true);
    expect(sig.interpretation).toBe(
      "Systemic illness diverts nutrients from the follicle.",
    );
  });

  it("keeps a reported selection with no interpretation as a plain, non-interpreted row", () => {
    const groups = buildMergedGroups(
      vm(
        [
          {
            key: "LIFESTYLE",
            category: "Lifestyle",
            items: [{ label: null, value: "Poor sleep", emphasis: "normal" }],
          },
        ],
        [],
      ),
    );
    const sig = groups[0]!.signals[0]!;
    expect(sig.interpreted).toBe(false);
    expect(sig.orphan).toBe(false);
    expect(sig.condition).toBeNull();
    expect(sig.interpretation).toBeNull();
  });

  it("preserves clinical category order and puts orphans last", () => {
    const groups = buildMergedGroups(
      vm(
        [
          { key: "TREATMENTS", category: "Previous treatments", items: [{ label: null, value: "Minoxidil", emphasis: "normal" }] },
          { key: "HAIR", category: "Hair & shedding", items: [{ label: null, value: "Thinning", emphasis: "normal" }] },
          { key: "SCALP", category: "Scalp", items: [{ label: null, value: "Oily scalp", emphasis: "normal" }] },
        ],
        [
          { signal: "Chronic stress", condition: "Stress-driven", interpretation: "Cortisol pushes follicles into telogen." },
        ],
      ),
    );
    expect(groups.map((g) => g.key)).toEqual(["HAIR", "SCALP", "TREATMENTS", "OTHER"]);
  });

  it("preserves a long interpretation verbatim — collapse is visual only, data is never truncated", () => {
    const longText =
      "Prolonged medication, illness & surgery divert the nutrients for healing and " +
      "recovery depriving the hair follicles of resources for continuation of anagen. " +
      "Inflammation and active immune response also compound the nutrient diversion, " +
      "leaving inadequate energy resources for the continuation of hair growth. " +
      "Antibiotics and drugs used during recovery can cause hair loss as a side effect.";
    const groups = buildMergedGroups(
      vm(
        [
          { key: "MEDICAL", category: "Medical & metabolic", items: [{ label: null, value: "Recent illness", emphasis: "attention" }] },
        ],
        [{ signal: "Recent illness", condition: "Post-illness shedding", interpretation: longText }],
      ),
    );
    const sig = groups[0]!.signals[0]!;
    // Character-for-character identical — no summary, no trim, no ellipsis.
    expect(sig.interpretation).toBe(longText);
    expect(sig.interpretation!.length).toBe(longText.length);
  });

  it("tolerates a missing condition and a missing interpretation", () => {
    const groups = buildMergedGroups(
      vm(
        [
          { key: "HAIR", category: "Hair & shedding", items: [{ label: null, value: "Thinning", emphasis: "normal" }] },
        ],
        // condition empty string, interpretation present → condition null, no crash.
        [{ signal: "Thinning", condition: "", interpretation: "Reduced density." }],
      ),
    );
    const sig = groups[0]!.signals[0]!;
    expect(sig.condition).toBeNull();
    expect(sig.interpretation).toBe("Reduced density.");
  });

  it("does not double-count an interpretation that matched a selection", () => {
    const groups = buildMergedGroups(
      vm(
        [
          { key: "HAIR", category: "Hair & shedding", items: [{ label: null, value: "Diffuse shedding", emphasis: "attention" }] },
        ],
        [
          { signal: "Diffuse shedding", condition: "Diffuse telogen exit", interpretation: "…" },
        ],
      ),
    );
    // Matched → stays in HAIR, no OTHER group created.
    expect(groups.map((g) => g.key)).toEqual(["HAIR"]);
    expect(groups[0]!.signals).toHaveLength(1);
  });
});
