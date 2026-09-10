import { describe, it, expect } from "vitest";
import {
  normalizeLineup,
  computeOrderDelta,
} from "@/lib/doctor/orderSummary/delta";

// Deterministic recommendation-delta coverage for the Patient Order Summary.
// The delta compares SYSTEM (v1) vs FINAL (order) lineups on canonical kit id.
// Custom kits, topicals and populated quantities do not exist in today's order
// model; the quantity paths are exercised anyway so the util is correct if
// `quantities` ever lands.

describe("normalizeLineup", () => {
  it("defaults absent quantity to 1 and sorts by kit id", () => {
    expect(normalizeLineup([{ kitId: "FPHL" }, { kitId: "ALOPECIA_AREATA" }])).toEqual([
      { kitId: "ALOPECIA_AREATA", quantity: 1 },
      { kitId: "FPHL", quantity: 1 },
    ]);
  });

  it("sums duplicate kit ids", () => {
    expect(normalizeLineup([{ kitId: "FPHL" }, { kitId: "FPHL", quantity: 2 }])).toEqual([
      { kitId: "FPHL", quantity: 3 },
    ]);
  });

  it("drops blank ids and coerces invalid quantities to 1", () => {
    expect(
      normalizeLineup([
        { kitId: "  " },
        { kitId: "TE_GOLD", quantity: 0 },
        { kitId: "GI_GOLD", quantity: -4 },
        { kitId: "HBR", quantity: 2.9 },
      ]),
    ).toEqual([
      { kitId: "GI_GOLD", quantity: 1 },
      { kitId: "HBR", quantity: 2 },
      { kitId: "TE_GOLD", quantity: 1 },
    ]);
  });
});

describe("computeOrderDelta", () => {
  it("1. identical recommendations → unchanged", () => {
    const d = computeOrderDelta([{ kitId: "FPHL" }, { kitId: "TE_GOLD" }], [
      { kitId: "FPHL" },
      { kitId: "TE_GOLD" },
    ]);
    expect(d.status).toBe("unchanged");
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.quantityChanged).toEqual([]);
    expect(d.unchanged.map((l) => l.kitId)).toEqual(["FPHL", "TE_GOLD"]);
    expect(d.replacements).toEqual([]);
  });

  it("2. one kit added", () => {
    const d = computeOrderDelta([{ kitId: "FPHL" }], [
      { kitId: "FPHL" },
      { kitId: "IRON_UP_GOLD" },
    ]);
    expect(d.status).toBe("modified");
    expect(d.added.map((l) => l.kitId)).toEqual(["IRON_UP_GOLD"]);
    expect(d.removed).toEqual([]);
  });

  it("3. one kit removed", () => {
    const d = computeOrderDelta([{ kitId: "FPHL" }, { kitId: "TE_GOLD" }], [
      { kitId: "FPHL" },
    ]);
    expect(d.status).toBe("modified");
    expect(d.removed.map((l) => l.kitId)).toEqual(["TE_GOLD"]);
    expect(d.added).toEqual([]);
    // A lone removal is NOT a replacement.
    expect(d.replacements).toEqual([]);
  });

  it("4. add + remove (multiple changes, not a replacement)", () => {
    const d = computeOrderDelta(
      [{ kitId: "FPHL" }, { kitId: "TE_GOLD" }],
      [{ kitId: "FPHL" }, { kitId: "IRON_UP_GOLD" }, { kitId: "GI_GOLD" }],
    );
    expect(d.added.map((l) => l.kitId)).toEqual(["GI_GOLD", "IRON_UP_GOLD"]);
    expect(d.removed.map((l) => l.kitId)).toEqual(["TE_GOLD"]);
    // Two added, one removed → ambiguous, no replacement asserted.
    expect(d.replacements).toEqual([]);
  });

  it("5. clean one-for-one swap → replacement asserted AND independent rows kept", () => {
    const d = computeOrderDelta([{ kitId: "TE_GOLD" }], [{ kitId: "GI_GOLD" }]);
    expect(d.status).toBe("modified");
    expect(d.replacements).toEqual([
      { removedKitId: "TE_GOLD", addedKitId: "GI_GOLD" },
    ]);
    expect(d.added.map((l) => l.kitId)).toEqual(["GI_GOLD"]);
    expect(d.removed.map((l) => l.kitId)).toEqual(["TE_GOLD"]);
  });

  it("6. quantity increase", () => {
    const d = computeOrderDelta([{ kitId: "FPHL", quantity: 1 }], [
      { kitId: "FPHL", quantity: 2 },
    ]);
    expect(d.status).toBe("modified");
    expect(d.quantityChanged).toEqual([{ kitId: "FPHL", from: 1, to: 2 }]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    // A quantity change suppresses the replacement heuristic.
    expect(d.replacements).toEqual([]);
  });

  it("7. quantity decrease", () => {
    const d = computeOrderDelta([{ kitId: "FPHL", quantity: 3 }], [
      { kitId: "FPHL", quantity: 1 },
    ]);
    expect(d.quantityChanged).toEqual([{ kitId: "FPHL", from: 3, to: 1 }]);
  });

  it("8. reordered kits only → unchanged", () => {
    const d = computeOrderDelta(
      [{ kitId: "FPHL" }, { kitId: "TE_GOLD" }, { kitId: "GI_GOLD" }],
      [{ kitId: "GI_GOLD" }, { kitId: "FPHL" }, { kitId: "TE_GOLD" }],
    );
    expect(d.status).toBe("unchanged");
    expect(d.unchanged.map((l) => l.kitId)).toEqual(["FPHL", "GI_GOLD", "TE_GOLD"]);
  });

  it("9. duplicate lines collapse before comparison", () => {
    const d = computeOrderDelta(
      [{ kitId: "FPHL" }, { kitId: "FPHL" }],
      [{ kitId: "FPHL", quantity: 2 }],
    );
    expect(d.status).toBe("unchanged");
    expect(d.unchanged).toEqual([{ kitId: "FPHL", quantity: 2 }]);
  });

  it("10. missing original snapshot → indeterminate, no invented rows", () => {
    const d = computeOrderDelta(null, [{ kitId: "FPHL" }, { kitId: "GI_GOLD" }]);
    expect(d.status).toBe("indeterminate");
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.quantityChanged).toEqual([]);
    expect(d.unchanged).toEqual([]);
    expect(d.replacements).toEqual([]);
  });

  it("11. empty final order against a real system rec → all removed", () => {
    const d = computeOrderDelta([{ kitId: "FPHL" }, { kitId: "TE_GOLD" }], []);
    expect(d.status).toBe("modified");
    expect(d.removed.map((l) => l.kitId)).toEqual(["FPHL", "TE_GOLD"]);
    expect(d.added).toEqual([]);
  });

  it("12. compares canonical id, never label similarity", () => {
    // TE_GOLD and TE_GOLD_VEG are distinct kits despite sharing a prefix.
    const d = computeOrderDelta([{ kitId: "TE_GOLD" }], [{ kitId: "TE_GOLD_VEG" }]);
    expect(d.added.map((l) => l.kitId)).toEqual(["TE_GOLD_VEG"]);
    expect(d.removed.map((l) => l.kitId)).toEqual(["TE_GOLD"]);
    expect(d.replacements).toEqual([
      { removedKitId: "TE_GOLD", addedKitId: "TE_GOLD_VEG" },
    ]);
  });
});
