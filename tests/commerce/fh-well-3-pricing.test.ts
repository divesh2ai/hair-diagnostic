import { describe, it, expect } from "vitest";

import {
  resolveKitIdentity,
  APPROVED_KIT_ALIASES,
  CANONICAL_KIT_IDS,
} from "@/lib/commerce/kitIdentity";
import {
  getKitPrice,
  APPROVED_KIT_PRICES_MINOR,
  rupeesToMinor,
} from "@/lib/commerce/kitPricing";
import {
  evaluateKitForPatientSale,
  evaluateOrderForPatientCharge,
} from "@/lib/commerce/sellability";
import { DEFAULT_KIT_QUANTITY } from "@/lib/commerce/kitQuantity";

// Regression for the DrFACT Mumbai cart cmuky4ja6001zxee8ajv39612, whose
// "FH WELL 3" line rendered with no price and — because a cart cannot be
// part-priced — suppressed the whole order total. Root cause: the kit-scorer
// emits the bare clinical spelling "FH WELL 3" (spaces, no underscores), which
// is neither the canonical key nor an approved alias, so identity resolved
// UNRESOLVED and pricing was never reached. Fixed by adding the approved alias
// (kitIdentity.ts) and the approved price (kitPricing.ts).

const FH_WELL_3_MINOR = rupeesToMinor(3394); // 339400 paise, doctor-confirmed 2026-09-28

// The exact kitIds persisted on that cart's KitOrderIntent, in order.
const CART_KIT_IDS = [
  "FH WELL 3",
  "PHENOTYPE INFLAMATION",
  "PRO FACT META B",
  "PRO_IMMUNE_1",
  "FPHL",
];

describe('"FH WELL 3" identity resolution', () => {
  it('resolves the raw label to canonical FH_WELL_3 via an approved alias', () => {
    const identity = resolveKitIdentity("FH WELL 3");
    expect(identity.status).toBe("RESOLVED");
    expect(identity.canonicalKitId).toBe("FH_WELL_3");
    expect(identity.resolutionMethod).toBe("APPROVED_ALIAS");
    // The raw evidence is never overwritten with the canonical form.
    expect(identity.sourceIdentifierSnapshot).toBe("FH WELL 3");
  });

  it("keeps the alias entry and a canonical target that actually exists", () => {
    expect(APPROVED_KIT_ALIASES["FH WELL 3"]).toBe("FH_WELL_3");
    expect(CANONICAL_KIT_IDS).toContain("FH_WELL_3");
  });
});

describe("FH_WELL_3 pricing and sellability", () => {
  it("is PRICE_APPROVED at the doctor-confirmed ₹3,394", () => {
    const price = getKitPrice("FH_WELL_3");
    expect(price.status).toBe("PRICE_APPROVED");
    expect(price.amountMinor).toBe(FH_WELL_3_MINOR);
    expect(price.source).toBe("APPROVED_MRP");
    expect(APPROVED_KIT_PRICES_MINOR.FH_WELL_3).toBe(FH_WELL_3_MINOR);
  });

  it("is sellable from its raw prescribed label", () => {
    const decision = evaluateKitForPatientSale("FH WELL 3");
    expect(decision.sellable).toBe(true);
    expect(decision.reasons).toEqual([]);
    expect(decision.chargeableAmountMinor).toBe(FH_WELL_3_MINOR);
  });
});

describe("the whole cart now totals correctly", () => {
  it("makes every line of cmuky4ja6001zxee8ajv39612 chargeable", () => {
    const order = evaluateOrderForPatientCharge(CART_KIT_IDS);
    expect(order.chargeable).toBe(true);
    expect(order.blockingReasons).toEqual([]);
    expect(order.lines.every((l) => l.sellable)).toBe(true);
  });

  it("produces a per-unit subtotal of ₹15,550 and a qty-2 total of ₹31,100", () => {
    const order = evaluateOrderForPatientCharge(CART_KIT_IDS);
    // 3394 + 3410 + 3018 + 2145 + 3583 = 15,550 rupees per unit set.
    expect(order.totalAmountMinor).toBe(rupeesToMinor(15550));
    // The cart applies the default two-month (qty 2) supply to each line, so
    // the patient-facing order total is twice the per-unit subtotal.
    expect(DEFAULT_KIT_QUANTITY).toBe(2);
    expect((order.totalAmountMinor ?? 0) * DEFAULT_KIT_QUANTITY).toBe(
      rupeesToMinor(31100),
    );
  });
});

describe("other approved kits in this cart are untouched", () => {
  it.each([
    ["PHENOTYPE INFLAMATION", "PHENOTYPE_INFLAMMATION", 3410],
    ["PRO FACT META B", "META_B", 3018],
    ["PRO_IMMUNE_1", "PRO_IMMUNE_1", 2145],
    ["FPHL", "FPHL", 3583],
  ])("%s stays approved at ₹%d", (rawLabel, canonical, rupees) => {
    const decision = evaluateKitForPatientSale(rawLabel);
    expect(decision.canonicalKitId).toBe(canonical);
    expect(decision.sellable).toBe(true);
    expect(decision.chargeableAmountMinor).toBe(rupeesToMinor(rupees));
  });
});

describe("checkout stays fail-closed for still-blocked kits", () => {
  it.each([
    "PRO FACT META B PCOS", // deliberately held for review (veg/non-veg ambiguity)
    "HAIR FACT HAIR BREAKAGE REPAIR (HBR)", // no approved alias / price yet
    "HAIR FACT PERI MENOPAUSE VEG",
    "HAIR FACT TE GOLD VEG",
    "SOME KIT THAT DOES NOT EXIST",
  ])("does not sell %s", (rawLabel) => {
    const decision = evaluateKitForPatientSale(rawLabel);
    expect(decision.sellable).toBe(false);
    expect(decision.chargeableAmountMinor).toBeNull();
  });

  it("blocks and refuses to total an order containing a blocked kit", () => {
    const order = evaluateOrderForPatientCharge([
      "FH WELL 3", // now sellable
      "PRO FACT META B PCOS", // still blocked
    ]);
    expect(order.chargeable).toBe(false);
    expect(order.totalAmountMinor).toBeNull();
  });
});
