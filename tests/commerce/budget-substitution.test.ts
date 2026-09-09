import { describe, it, expect } from "vitest";
import {
  APPROVED_SUBSTITUTIONS,
  PROTECTED_NO_ALTERNATIVE_KIT_IDS,
  getApprovedAlternative,
  isApprovedSubstitutionPair,
  resolveSubstitutionPriceComparison,
  assertSubstitutionTableIsWellFormed,
  getApprovedAlternativeForKitId,
  isApprovedSubstitutionPairForKitId,
  resolveSubstitutionPriceComparisonForKitId,
} from "@/lib/commerce/budgetSubstitution";
import { CANONICAL_KIT_IDS } from "@/lib/commerce/kitIdentity";

// Governed budget substitution — the pairing + pricing table this feature is
// built on. Source: "KIT ALTERNATE PRICE.xlsx", reconciled 2026-09-08 (see
// docs/kit-price-reconciliation-2026-09-08.md).

describe("the approved pair table is well-formed", () => {
  it("names only real canonical kit ids on both sides", () => {
    expect(() => assertSubstitutionTableIsWellFormed()).not.toThrow();
  });

  it("has exactly 12 approved pairs", () => {
    expect(APPROVED_SUBSTITUTIONS).toHaveLength(12);
  });
});

describe("PASS — the 12 approved pairs", () => {
  const cases: Array<[string, string]> = [
    ["PHENOTYPE_INFLAMMATION", "PRO_IMMUNE_1"],
    ["MPHL", "M4_PLUS"],
    ["FPHL", "F4_PLUS"],
    ["META_B_HYPOTHYROID", "HYPOTHYROID_2"],
    ["TE_GOLD", "SHED_CONTROL"],
    ["IRON_UP_GOLD", "IRON_UP_1"],
    ["GI_GOLD", "GI_HEALTH_1"],
    ["PRO_IMMUNE_GOLD", "PRO_IMMUNE_1"],
    ["RWL_SHIELD", "SHED_CONTROL"],
    ["NIGHT_SHIFT", "SHED_CONTROL"],
    ["FREQUENT_FLYERS", "SHED_CONTROL"],
    ["TTM_SUPPORT", "STRESS_BUST_3"],
  ];

  it.each(cases)("%s -> %s is approved", (canonical, alternative) => {
    expect(isApprovedSubstitutionPair(canonical, alternative)).toBe(true);
    expect(getApprovedAlternative(canonical)?.alternativeKitId).toBe(alternative);
  });

  it("MPHL -> M4+, FPHL -> F4+, TE GOLD -> SHED CONTROL — the required E2E examples", () => {
    expect(isApprovedSubstitutionPair("MPHL", "M4_PLUS")).toBe(true);
    expect(isApprovedSubstitutionPair("FPHL", "F4_PLUS")).toBe(true);
    expect(isApprovedSubstitutionPair("TE_GOLD", "SHED_CONTROL")).toBe(true);
  });

  it("four different canonical kits share the single SHED_CONTROL identity", () => {
    const sources = APPROVED_SUBSTITUTIONS.filter((s) => s.alternativeKitId === "SHED_CONTROL").map(
      (s) => s.canonicalKitId,
    );
    expect(sources.sort()).toEqual(["FREQUENT_FLYERS", "NIGHT_SHIFT", "RWL_SHIELD", "TE_GOLD"].sort());
  });

  it("two different canonical kits share the single PRO_IMMUNE_1 identity, at the same price", () => {
    const sources = APPROVED_SUBSTITUTIONS.filter((s) => s.alternativeKitId === "PRO_IMMUNE_1");
    expect(sources.map((s) => s.canonicalKitId).sort()).toEqual(
      ["PHENOTYPE_INFLAMMATION", "PRO_IMMUNE_GOLD"].sort(),
    );
    const prices = sources.map(
      (s) => resolveSubstitutionPriceComparison(s.canonicalKitId, s.alternativeKitId)?.alternativePriceMinor,
    );
    expect(prices[0]).toBe(204500);
    expect(prices[0]).toBe(prices[1]);
  });
});

describe("FAIL — every other pairing is rejected, no fuzzy matching", () => {
  it("MPHL -> F4+ fails (wrong alternative for this canonical kit)", () => {
    expect(isApprovedSubstitutionPair("MPHL", "F4_PLUS")).toBe(false);
  });

  it("MPHL -> an arbitrary product fails", () => {
    expect(isApprovedSubstitutionPair("MPHL", "SOME_OTHER_KIT")).toBe(false);
    expect(isApprovedSubstitutionPair("MPHL", "HEALTHY_9")).toBe(false);
  });

  it("an UNCHANGED kit has no approved alternative at all", () => {
    for (const kitId of PROTECTED_NO_ALTERNATIVE_KIT_IDS) {
      expect(getApprovedAlternative(kitId)).toBeNull();
      expect(isApprovedSubstitutionPair(kitId, "M4_PLUS")).toBe(false);
    }
  });

  it("HEALTHY-9 -> anything fails", () => {
    expect(getApprovedAlternative("HEALTHY_9")).toBeNull();
    for (const candidate of ["M4_PLUS", "F4_PLUS", "SHED_CONTROL", "HEALTHY_9"]) {
      expect(isApprovedSubstitutionPair("HEALTHY_9", candidate)).toBe(false);
    }
  });

  it("the reverse direction is not implicitly valid", () => {
    // M4+ is the alternative FOR MPHL, not a canonical kit with its own
    // alternative.
    expect(getApprovedAlternative("M4_PLUS")).toBeNull();
  });

  it("does not resolve a raw display-name spelling — only the canonical key", () => {
    expect(getApprovedAlternative("MPHL PRO")).toBeNull();
    expect(isApprovedSubstitutionPair("MPHL PRO", "M4+")).toBe(false);
  });

  it("TTM_SUPPORT -> STRESS_BUST_3 is approved, once the workbook's alternative price was re-verified", () => {
    expect(getApprovedAlternative("TTM_SUPPORT")?.alternativeKitId).toBe("STRESS_BUST_3");
    expect(isApprovedSubstitutionPair("TTM_SUPPORT", "STRESS_BUST_3")).toBe(true);
    expect(CANONICAL_KIT_IDS).toContain("STRESS_BUST_3");
  });
});

describe("raw phase kitId resolution — verified against a real staging consultation", () => {
  // Fetched live from a staging Consultation on 2026-09-08: one lineup's
  // kitPhases carried kitId "HAIR FACT TE GOLD" and "PRO IMMUNE GOLD" — the
  // clinical spelling, not the canonical registry key — while another phase
  // in the SAME lineup carried the bare canonical key "FPHL". A phase's
  // kitId is not reliably canonical, so eligibility and validation must
  // resolve identity first (see kitIdentity.ts's exact-match resolver),
  // exactly like /api/cart and /api/kits already do.
  it("finds the approved alternative from the raw clinical spelling, not just the canonical key", () => {
    expect(getApprovedAlternativeForKitId("HAIR FACT TE GOLD")?.alternativeKitId).toBe("SHED_CONTROL");
    expect(getApprovedAlternativeForKitId("PRO IMMUNE GOLD")?.alternativeKitId).toBe("PRO_IMMUNE_1");
    // The alias case too.
    expect(getApprovedAlternativeForKitId("PHENOTYPE INFLAMATION")?.alternativeKitId).toBe("PRO_IMMUNE_1");
  });

  it("also works when the phase already carries the bare canonical key", () => {
    expect(getApprovedAlternativeForKitId("TE_GOLD")?.alternativeKitId).toBe("SHED_CONTROL");
    expect(getApprovedAlternativeForKitId("FPHL")?.alternativeKitId).toBe("F4_PLUS");
  });

  it("validates the pair from the raw spelling", () => {
    expect(isApprovedSubstitutionPairForKitId("HAIR FACT TE GOLD", "SHED_CONTROL")).toBe(true);
    expect(isApprovedSubstitutionPairForKitId("HAIR FACT TE GOLD", "PRO_IMMUNE_1")).toBe(false);
  });

  it("resolves the priced comparison from the raw spelling", () => {
    const c = resolveSubstitutionPriceComparisonForKitId("HAIR FACT TE GOLD", "SHED_CONTROL");
    expect(c?.bothPricesApproved).toBe(true);
    expect(c?.canonicalPriceMinor).toBe(299600);
    expect(c?.alternativePriceMinor).toBe(155200);
  });

  it("refuses an identifier that does not resolve at all, rather than guessing", () => {
    expect(getApprovedAlternativeForKitId("some kit that does not exist")).toBeNull();
    // Explicitly held for review — must not resolve even though the
    // clinical registry itself can render a name for it.
    expect(getApprovedAlternativeForKitId("PRO FACT META B PCOS")).toBeNull();
  });
});

describe("price comparison — always resolved server-side, never invented", () => {
  it("MPHL -> M4+ resolves the exact governed prices and saving", () => {
    const c = resolveSubstitutionPriceComparison("MPHL", "M4_PLUS");
    expect(c).not.toBeNull();
    expect(c!.bothPricesApproved).toBe(true);
    expect(c!.canonicalPriceMinor).toBe(363700);
    expect(c!.alternativePriceMinor).toBe(165500);
    expect(c!.savingMinor).toBe(363700 - 165500);
  });

  it("TTM_SUPPORT -> STRESS_BUST_3 resolves the exact governed prices and saving (12th pair, corrected 2026-09-09)", () => {
    const c = resolveSubstitutionPriceComparison("TTM_SUPPORT", "STRESS_BUST_3");
    expect(c).not.toBeNull();
    expect(c!.bothPricesApproved).toBe(true);
    expect(c!.canonicalPriceMinor).toBe(285800);
    expect(c!.alternativePriceMinor).toBe(145700);
    expect(c!.savingMinor).toBe(285800 - 145700);
  });

  it("returns null for a pair that is not approved, rather than a zero/default comparison", () => {
    expect(resolveSubstitutionPriceComparison("MPHL", "F4_PLUS")).toBeNull();
    expect(resolveSubstitutionPriceComparison("HEALTHY_9", "M4_PLUS")).toBeNull();
  });

  it("never falls back to a fabricated ₹5,500 (550000 paise) for any approved pair", () => {
    for (const s of APPROVED_SUBSTITUTIONS) {
      const c = resolveSubstitutionPriceComparison(s.canonicalKitId, s.alternativeKitId)!;
      expect(c.canonicalPriceMinor).not.toBe(550000);
      expect(c.alternativePriceMinor).not.toBe(550000);
    }
  });
});
