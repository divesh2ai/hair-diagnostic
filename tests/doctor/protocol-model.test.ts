import { describe, it, expect } from "vitest";
import { buildProtocolItems } from "@/lib/doctor/protocolModel";
import type { TreatmentPhase } from "@shared/types/consultation";
import type { KitCatalogItem } from "@/lib/doctor/kitCatalog";

// Proves the "Why this kit" reasons are engine/registry pass-through — the
// presentation layer must never invent a treatment reason. Every visible reason
// traces to phase.whySelected (engine), phase.supportingConditions (engine RCA),
// or the authored registry treatmentObjective.

function phase(over: Partial<TreatmentPhase>): TreatmentPhase {
  return {
    phase: 1,
    kitId: "FPHL",
    displayName: "FPHL Pro",
    whySelected: "",
    supportingConditions: [],
    keyIngredients: [],
    mechanismOfAction: [],
    formulationGroups: [],
    ...over,
  } as TreatmentPhase;
}

function catalog(
  entries: Record<string, Partial<KitCatalogItem>>,
): ReadonlyMap<string, KitCatalogItem> {
  const m = new Map<string, KitCatalogItem>();
  for (const [id, v] of Object.entries(entries)) {
    m.set(id, { kitId: id, ...v } as KitCatalogItem);
  }
  return m;
}

describe("buildProtocolItems — reasons are pass-through, never invented", () => {
  it("uses phase.whySelected verbatim as the rationale", () => {
    const why = "Selected for androgen-driven miniaturisation confirmed by widening parting.";
    const items = buildProtocolItems([phase({ whySelected: why })], catalog({}));
    expect(items[0]!.rationale).toBe(why);
  });

  it("uses the registry treatmentObjective verbatim as the objective", () => {
    const objective = "Rebalance the follicular growth cycle over three months.";
    const items = buildProtocolItems(
      [phase({ kitId: "FPHL" })],
      catalog({ FPHL: { treatmentObjective: objective } }),
    );
    expect(items[0]!.objective).toBe(objective);
  });

  it("passes engine supportingConditions through as drivers", () => {
    const items = buildProtocolItems(
      [phase({ supportingConditions: ["Androgenetic sensitivity", "Iron deficiency"] })],
      catalog({}),
    );
    expect(items[0]!.drivers).toEqual(["Androgenetic sensitivity", "Iron deficiency"]);
  });

  it("renders NO rationale and NO objective when the engine/registry gave none — does not fabricate", () => {
    const items = buildProtocolItems([phase({ whySelected: "" })], catalog({}));
    expect(items[0]!.rationale).toBeNull();
    expect(items[0]!.objective).toBeNull();
    // No driver is borrowed from a diagnosis when the phase records none.
    expect(items[0]!.drivers).toEqual([]);
  });
});
