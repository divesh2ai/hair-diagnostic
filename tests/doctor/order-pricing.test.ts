import { describe, it, expect } from "vitest";
import { buildDoctorOrderPricing } from "@/lib/doctor/orderPricing";

// Regression for the doctor Orders ₹5,500 price discrepancy.
//
// The orders panel used `priceForKit(kitId) = KIT_PRICE_INR[kitId] ?? 5500`,
// an exact-match lookup with no identity resolution. Raw/prescribed identifiers
// that the patient cart prices correctly (via resolveKitIdentity + the approved
// table) fell through to the ₹5,500 default here, so the doctor saw a number no
// patient is ever charged. These are the exact identifiers from the reported
// order.

const RAW = {
  phenotype: "PHENOTYPE INFLAMATION", // legacy spelling → PHENOTYPE_INFLAMMATION
  pcosVeg: "PRO FACT META B PCOS", // → PCOS (approved)
  thyroid: "Pro Fact Thyroid Care (Hyperthyroid Support)", // unresolved alias
  proImmuneVeg: "PRO IMMUNE VEG", // → PRO_IMMUNE_5_VEG (approved)
  fphl: "FPHL", // canonical, approved
};

describe("buildDoctorOrderPricing — approved kits price like the cart", () => {
  const { lineItems } = buildDoctorOrderPricing([
    RAW.phenotype,
    RAW.pcosVeg,
    RAW.proImmuneVeg,
    RAW.fphl,
  ]);
  const byKit = (raw: string) => lineItems.find((l) => l.kitId === raw)!;

  it("never invents the ₹5,500 placeholder for a resolvable kit", () => {
    for (const li of lineItems) {
      expect(li.priceInr).not.toBe(5500);
    }
  });

  it("prices each resolved kit at its approved patient charge", () => {
    expect(byKit(RAW.phenotype)).toMatchObject({ commercialState: "CHARGEABLE", priceInr: 3410 });
    expect(byKit(RAW.pcosVeg)).toMatchObject({ commercialState: "CHARGEABLE", priceInr: 3009 });
    expect(byKit(RAW.proImmuneVeg)).toMatchObject({ commercialState: "CHARGEABLE", priceInr: 2692 });
    expect(byKit(RAW.fphl)).toMatchObject({ commercialState: "CHARGEABLE", priceInr: 3583 });
  });

  it("totals a fully-approved order", () => {
    const pricing = buildDoctorOrderPricing([RAW.proImmuneVeg, RAW.fphl]);
    expect(pricing.chargeable).toBe(true);
    expect(pricing.totalInr).toBe(2692 + 3583);
    expect(pricing.totalLabel).toBeTypeOf("string");
  });
});

describe("buildDoctorOrderPricing — unresolved/unapproved kits mirror the cart", () => {
  it("shows a review state (not ₹5,500) for an unresolved identifier", () => {
    const { lineItems } = buildDoctorOrderPricing([RAW.thyroid]);
    const line = lineItems[0]!;
    expect(line.commercialState).toBe("IDENTITY_REVIEW"); // cart: "Catalog match required"
    expect(line.priceInr).toBeNull();
    expect(line.priceLabel).toBeNull();
  });

  it("withholds the order total when any line is not chargeable", () => {
    const pricing = buildDoctorOrderPricing([RAW.fphl, RAW.thyroid]);
    expect(pricing.chargeable).toBe(false);
    expect(pricing.totalInr).toBeNull();
    expect(pricing.totalLabel).toBeNull();
    // The resolvable line still prices correctly alongside the blocked one.
    expect(pricing.lineItems.find((l) => l.kitId === RAW.fphl)).toMatchObject({
      commercialState: "CHARGEABLE",
      priceInr: 3583,
    });
  });

  it("keeps a name for every line, so none is silently dropped", () => {
    const { lineItems } = buildDoctorOrderPricing([RAW.thyroid]);
    expect(lineItems[0]!.displayName.length).toBeGreaterThan(0);
  });
});
