// A pure kit REORDER must never change clinical readiness.
//
// Grounding (evidence ↔ narrative) does not look at the kit array at all, and
// the reasoning-completeness checks are SET-based: each selected kit is either
// named in the narrative or not, and either carries a trigger/rationale or not,
// regardless of its position in the phase order. The approval + PDF gates read
// COUNTS and blocking codes, both order-invariant. This test locks that so a
// reorder can never "magically" resolve or create an evidence problem.

import { describe, it, expect } from "vitest";
import { validateReasoningCompleteness } from "@hairos/packages/ai-engine/clinical-context/validateReasoningCompleteness";

type AnyKit = {
  kitId: string;
  displayName: string;
  phase: number;
  score: number;
  rationale: { drivenBy: string[]; satisfies: string[]; rationale: string };
};

function kit(kitId: string, phase: number): AnyKit {
  return {
    kitId,
    displayName: kitId,
    phase,
    score: 1,
    // Non-empty rationale so checkKitTriggers never flags "missing trigger" —
    // we are isolating the reorder question, not trigger presence.
    rationale: { drivenBy: ["dht"], satisfies: [], rationale: "selected for this patient" },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contextWith(kits: AnyKit[]): any {
  return {
    assessmentId: "a1",
    facts: { inferred: { rootCauses: [] } },
    selectedKits: kits,
    rejectedKits: [],
    sequencing: [],
    interactionRules: [],
    evidence: [],
    groundingViolations: [],
    reasoningGaps: [],
  };
}

// The narrative names KIT_A only, so KIT_B and KIT_C are "not discussed".
const sections = [{ name: "Plan", text: "We recommend KIT_A for this patient." }];

const subjects = (gaps: readonly { subject: string }[]) =>
  gaps.map((g) => g.subject).sort();

describe("readiness is invariant under a pure kit reorder", () => {
  it("same kit SET in two orders → same reasoning gaps (set + count)", () => {
    const forward = validateReasoningCompleteness(
      contextWith([kit("KIT_A", 1), kit("KIT_B", 2), kit("KIT_C", 3)]),
      sections,
    );
    const reversed = validateReasoningCompleteness(
      contextWith([kit("KIT_C", 1), kit("KIT_B", 2), kit("KIT_A", 3)]),
      sections,
    );

    // The undiscussed set is exactly {KIT_B, KIT_C} regardless of order.
    expect(subjects(forward.gaps)).toEqual(["KIT_B", "KIT_C"]);
    expect(subjects(reversed.gaps)).toEqual(subjects(forward.gaps));
    expect(reversed.gaps.length).toBe(forward.gaps.length);
    expect(reversed.valid).toBe(forward.valid);
  });

  it("reordering a fully-discussed plan stays clean in both orders", () => {
    const allNamed = [
      { name: "Plan", text: "We recommend KIT_A, KIT_B and KIT_C." },
    ];
    const forward = validateReasoningCompleteness(
      contextWith([kit("KIT_A", 1), kit("KIT_B", 2), kit("KIT_C", 3)]),
      allNamed,
    );
    const reversed = validateReasoningCompleteness(
      contextWith([kit("KIT_C", 1), kit("KIT_B", 2), kit("KIT_A", 3)]),
      allNamed,
    );
    expect(forward.gaps.length).toBe(0);
    expect(reversed.gaps.length).toBe(0);
  });
});
