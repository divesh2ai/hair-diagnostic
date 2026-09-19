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
  type KitPrice,
} from "@/lib/commerce/kitPricing";
import {
  canSellToPatient,
  evaluateKitForPatientSale,
  evaluateOrderForPatientCharge,
} from "@/lib/commerce/sellability";
import { getKitInfo } from "@hairos/packages/registries/kits/info";

// Helpers for the combined matrix: build a price of a given state directly,
// so sellability can be exercised against PRICE_APPROVED even though no kit
// is approved in the repository today.
const approvedPrice = (minor: number): KitPrice => ({
  status: "PRICE_APPROVED",
  amountMinor: minor,
  currency: "INR",
  source: "APPROVED_MRP",
});
const presentPrice = (minor: number): KitPrice => ({
  status: "PRICE_PRESENT",
  amountMinor: minor,
  currency: "INR",
  source: "REPOSITORY_PLACEHOLDER",
});
const missingPrice = (): KitPrice => ({
  status: "PRICE_MISSING",
  amountMinor: null,
  currency: "INR",
  source: "NONE",
});

describe("kit identity", () => {
  it("1. resolves an exact canonical id and an approved alias", () => {
    const exact = resolveKitIdentity("TE_GOLD");
    expect(exact.status).toBe("RESOLVED");
    expect(exact.canonicalKitId).toBe("TE_GOLD");
    expect(exact.resolutionMethod).toBe("EXACT_CANONICAL");

    const aliased = resolveKitIdentity("PHENOTYPE INFLAMATION");
    expect(aliased.status).toBe("RESOLVED");
    expect(aliased.canonicalKitId).toBe("PHENOTYPE_INFLAMMATION");
    expect(aliased.resolutionMethod).toBe("APPROVED_ALIAS");
  });

  it("2. leaves PRO FACT META B PCOS unresolved", () => {
    const id = resolveKitIdentity("PRO FACT META B PCOS");
    expect(id.status).toBe("UNRESOLVED");
    expect(id.canonicalKitId).toBeNull();
    expect(id.resolutionMethod).toBe("NONE");
  });

  it("2b. does not inherit the clinical registry's normalisation-based match", () => {
    // The registry DOES resolve it — to the vegetarian PCOS kit. This test
    // pins the divergence: rendering may normalise, selling may not.
    expect(getKitInfo("PRO FACT META B PCOS")?.displayName).toBe(
      "PRO FACT META B - PCOS 6 (veg)",
    );
    expect(resolveKitIdentity("PRO FACT META B PCOS").canonicalKitId).toBeNull();
  });

  it("2c. refuses every near-miss spelling rather than guessing", () => {
    for (const near of [
      "PRO FACT META B PCOS 6",
      "PRO_FACT_META_B_PCOS",
      "META B PCOS",
      "PCOS 6 (veg)",
    ]) {
      expect(resolveKitIdentity(near).status).toBe("UNRESOLVED");
    }
    // The bare canonical id still resolves — this is not a blanket ban on PCOS.
    expect(resolveKitIdentity("PCOS").status).toBe("RESOLVED");
  });

  it("3. reports POST_HYSTERECTOMY_RESET as MISSING, not RESOLVED", () => {
    const id = resolveKitIdentity("POST_HYSTERECTOMY_RESET");
    expect(id.status).toBe("MISSING");
    expect(id.canonicalKitId).toBe("POST_HYSTERECTOMY_RESET");
    expect(CANONICAL_KIT_IDS).toContain("POST_HYSTERECTOMY_RESET");
  });

  it("4. preserves the raw identifier verbatim on every outcome", () => {
    expect(
      resolveKitIdentity("PHENOTYPE INFLAMATION").sourceIdentifierSnapshot,
    ).toBe("PHENOTYPE INFLAMATION");
    expect(
      resolveKitIdentity("PRO FACT META B PCOS").sourceIdentifierSnapshot,
    ).toBe("PRO FACT META B PCOS");
    // The canonical form never overwrites the source.
    const aliased = resolveKitIdentity("PHENOTYPE INFLAMATION");
    expect(aliased.sourceIdentifierSnapshot).not.toBe(aliased.canonicalKitId);
  });

  it("4b. keeps the approved alias list to exactly the 12 approved entries", () => {
    // 1 pre-existing (PHENOTYPE INFLAMATION) + 8 added 2026-09-08 + 1 added
    // 2026-09-09 (HAIR FACT TTM (OCD), the 12th pair's canonical side) + 2
    // added 2026-09-19, doctor-confirmed (drfact-mumbai): "PRO FACT META B" →
    // META_B and "PRO IMMUNE VEG" → PRO_IMMUNE_5_VEG, the clinical spellings
    // for the two kits newly approved for patient sale. Commercial identity is
    // still EXACT-MATCH ONLY — this table simply has two more entries, and the
    // list is still pinned here so nothing else can be added silently.
    expect(Object.keys(APPROVED_KIT_ALIASES).sort()).toEqual(
      [
        "PHENOTYPE INFLAMATION",
        "HAIR FACT TE GOLD",
        "IRON UP GOLD",
        "PRO FACT GI GOLD",
        "PRO IMMUNE GOLD",
        "RAPID WEIGHT LOSS SHIELD",
        "HAIR FACT NIGHT SHIFT",
        "HAIR FACT FREQUENT FLYERS",
        "PRO FACT META B HYPOTHYROID",
        "HAIR FACT TTM (OCD)",
        "PRO FACT META B",
        "PRO IMMUNE VEG",
      ].sort(),
    );
  });
});

describe("kit pricing authority", () => {
  it("5. reports PRICE_MISSING without substituting a default", () => {
    const p = getKitPrice("POST_HYSTERECTOMY_RESET");
    expect(p.status).toBe("PRICE_MISSING");
    expect(p.amountMinor).toBeNull();
    // The legacy helper would have answered Rs 5,500 here.
    expect(p.amountMinor).not.toBe(rupeesToMinor(5500));
  });

  it("6. reports repository figures as PRICE_PRESENT in minor units", () => {
    // ALOPECIA_AREATA, not TE_GOLD — TE_GOLD was reconciled to PRICE_APPROVED
    // by the 2026-09-08 budget-substitution reconciliation (see below).
    const p = getKitPrice("ALOPECIA_AREATA");
    expect(p.status).toBe("PRICE_PRESENT");
    expect(p.amountMinor).toBe(rupeesToMinor(6800));
    expect(Number.isInteger(p.amountMinor)).toBe(true);
    expect(p.source).toBe("REPOSITORY_PLACEHOLDER");
  });

  // Was "PRICE_APPROVED is 0/30" until the governed budget-substitution
  // feature reconciled 18 kits against "KIT ALTERNATE PRICE.xlsx"
  // (2026-09-08) — see docs/kit-price-reconciliation-2026-09-08.md and
  // tests/commerce/budget-substitution.test.ts for the substitution-specific
  // coverage. Every OTHER canonical kit stays exactly as before: unpriced.
  const RECONCILED_2026_09_08 = [
    "PHENOTYPE_INFLAMMATION",
    "MPHL",
    "FPHL",
    "META_B_HYPOTHYROID",
    "TE_GOLD",
    "IRON_UP_GOLD",
    "GI_GOLD",
    "PRO_IMMUNE_GOLD",
    "RWL_SHIELD",
    "NIGHT_SHIFT",
    "FREQUENT_FLYERS",
    "TTM_SUPPORT",
    "PRO_IMMUNE_1",
    "M4_PLUS",
    "F4_PLUS",
    "HYPOTHYROID_2",
    "SHED_CONTROL",
    "IRON_UP_1",
    "GI_HEALTH_1",
    "STRESS_BUST_3",
  ];

  // Approved 2026-09-19, doctor-confirmed (drfact-mumbai): two kits approved
  // for direct patient sale (not as budget alternatives) — META_B at ₹3,018
  // and PRO_IMMUNE_5_VEG at ₹2,692. Kept as their own list so the reason each
  // kit carries a price stays legible, and so "nothing else" below still means
  // exactly the union of the two governance decisions.
  const APPROVED_2026_09_19 = ["META_B", "PRO_IMMUNE_5_VEG"];

  it("7. approves exactly the reconciled + patient-sale kits — nothing else", () => {
    const approved = [...RECONCILED_2026_09_08, ...APPROVED_2026_09_19];
    expect(Object.keys(APPROVED_KIT_PRICES_MINOR).sort()).toEqual(
      [...approved].sort(),
    );
    for (const kitId of approved) {
      expect(getKitPrice(kitId).status).toBe("PRICE_APPROVED");
    }
    for (const kitId of CANONICAL_KIT_IDS) {
      if (approved.includes(kitId)) continue;
      expect(getKitPrice(kitId).status).not.toBe("PRICE_APPROVED");
    }
  });

  it("7b. never approves a protected UNCHANGED kit's price as a side effect", () => {
    // These kits carry no budget alternative and were NOT among the
    // doctor-confirmed patient-sale approvals; they must stay unpriced. META_B
    // is deliberately absent from this list now — it was approved for patient
    // sale on 2026-09-19 (see APPROVED_2026_09_19) — while every kit that
    // remains here must still be unable to charge a patient.
    for (const kitId of [
      "PCOS",
      "PRO_FACT_THYROID_CARE",
      "PERI_MENOPAUSE",
      "POST_MENOPAUSE",
      "HBR",
      "EARLY_GREYING_CARE_GOLD",
      "FH_WELL_3",
      "HEALTHY_9",
      "ALOPECIA_AREATA",
      "LACTIHEALTH",
    ]) {
      expect(getKitPrice(kitId).status).not.toBe("PRICE_APPROVED");
    }
  });

  it("7c. approves the TTM pair now that its workbook price was re-verified as present", () => {
    // Corrected 2026-09-09: the 2026-09-08 pass misread this cell as empty.
    expect(getKitPrice("TTM_SUPPORT").status).toBe("PRICE_APPROVED");
    expect(getKitPrice("TTM_SUPPORT").amountMinor).toBe(rupeesToMinor(2858));
    expect(getKitPrice("STRESS_BUST_3").status).toBe("PRICE_APPROVED");
    expect(getKitPrice("STRESS_BUST_3").amountMinor).toBe(rupeesToMinor(1457));
    expect(CANONICAL_KIT_IDS).toContain("STRESS_BUST_3");
  });

  it("7d. GI_GOLD's approved price matches the workbook exactly (corrected 2026-09-09)", () => {
    expect(getKitPrice("GI_GOLD").amountMinor).toBe(rupeesToMinor(3455));
  });
});

describe("combined sellability matrix", () => {
  const resolved = resolveKitIdentity("TE_GOLD");
  const unresolved = resolveKitIdentity("PRO FACT META B PCOS");
  const missing = resolveKitIdentity("POST_HYSTERECTOMY_RESET");

  it("8. RESOLVED + PRICE_APPROVED is eligible", () => {
    const d = canSellToPatient({
      identity: resolved,
      price: approvedPrice(590000),
    });
    expect(d.sellable).toBe(true);
    expect(d.reasons).toEqual([]);
    expect(d.chargeableAmountMinor).toBe(590000);
  });

  it("9. RESOLVED + PRICE_PRESENT is blocked", () => {
    const d = canSellToPatient({ identity: resolved, price: presentPrice(590000) });
    expect(d.sellable).toBe(false);
    expect(d.reasons).toContain("PRICE_NOT_APPROVED");
    expect(d.chargeableAmountMinor).toBeNull();
  });

  it("10. RESOLVED + PRICE_MISSING is blocked", () => {
    const d = canSellToPatient({ identity: resolved, price: missingPrice() });
    expect(d.sellable).toBe(false);
    expect(d.reasons).toContain("PRICE_MISSING");
  });

  it("11. UNRESOLVED + PRICE_APPROVED is blocked", () => {
    const d = canSellToPatient({
      identity: unresolved,
      price: approvedPrice(640000),
    });
    expect(d.sellable).toBe(false);
    expect(d.reasons).toContain("KIT_IDENTITY_REQUIRES_REVIEW");
    expect(d.chargeableAmountMinor).toBeNull();
  });

  it("12. MISSING + PRICE_APPROVED is blocked", () => {
    const d = canSellToPatient({
      identity: missing,
      price: approvedPrice(500000),
    });
    expect(d.sellable).toBe(false);
    expect(d.reasons).toContain("KIT_NOT_IN_CATALOGUE");
  });

  it("12b. a disabled kit is blocked even when otherwise perfect", () => {
    const d = canSellToPatient({
      identity: resolved,
      price: approvedPrice(590000),
      active: false,
    });
    expect(d.sellable).toBe(false);
    expect(d.reasons).toContain("KIT_DISABLED");
  });
});

describe("patient charging boundary", () => {
  // Kits with NO approved price — i.e. every canonical kit except the 18
  // reconciled for budget substitution on 2026-09-08 (see the reconciliation
  // block above). These still cannot be charged; TE_GOLD/MPHL/FPHL etc. are
  // deliberately NOT used here any more, since reconciliation approved them.
  const STILL_UNAPPROVED = ["ALOPECIA_AREATA", "HBR", "FH_WELL_3", "HEALTHY_9"];

  it("13. a kit with no approved price still cannot produce a chargeable amount", () => {
    for (const kitId of STILL_UNAPPROVED) {
      const d = evaluateKitForPatientSale(kitId);
      expect(d.sellable).toBe(false);
      expect(d.chargeableAmountMinor).toBeNull();
    }
  });

  it("13b. an order of still-unapproved kits yields no total", () => {
    const order = evaluateOrderForPatientCharge(STILL_UNAPPROVED);
    expect(order.chargeable).toBe(false);
    expect(order.totalAmountMinor).toBeNull();
    expect(order.blockingReasons).toContain("PRICE_NOT_APPROVED");
  });

  it("13c. a reconciled canonical kit and its approved alternative are now chargeable", () => {
    // Proves the reconciliation actually took effect — not just that the
    // map has entries, but that the sellability gate honours them.
    const canonical = evaluateKitForPatientSale("MPHL");
    expect(canonical.sellable).toBe(true);
    expect(canonical.chargeableAmountMinor).toBe(363700);

    const alternative = evaluateKitForPatientSale("M4_PLUS");
    expect(alternative.sellable).toBe(true);
    expect(alternative.chargeableAmountMinor).toBe(165500);
  });

  it("13d. an order mixing reconciled kits totals correctly", () => {
    const order = evaluateOrderForPatientCharge(["MPHL", "M4_PLUS"]);
    expect(order.chargeable).toBe(true);
    expect(order.totalAmountMinor).toBe(363700 + 165500);
  });

  it("14. an unresolved identity cannot enter patient checkout", () => {
    const order = evaluateOrderForPatientCharge([
      "TE_GOLD",
      "PRO FACT META B PCOS",
    ]);
    expect(order.chargeable).toBe(false);
    expect(order.totalAmountMinor).toBeNull();
    expect(order.blockingReasons).toContain("KIT_IDENTITY_REQUIRES_REVIEW");

    // And the unresolved line carries no price of its own.
    const line = order.lines.find(
      (l) => l.sourceIdentifierSnapshot === "PRO FACT META B PCOS",
    );
    expect(line?.chargeableAmountMinor).toBeNull();
    expect(line?.canonicalKitId).toBeNull();
  });

  it("14b. an empty order is not chargeable", () => {
    const order = evaluateOrderForPatientCharge([]);
    expect(order.chargeable).toBe(false);
    expect(order.totalAmountMinor).toBeNull();
  });

  it("15. an internal reviewer can still see the reason and the raw id", () => {
    const d = evaluateKitForPatientSale("PRO FACT META B PCOS");
    expect(d.reasons).toContain("KIT_IDENTITY_REQUIRES_REVIEW");
    expect(d.sourceIdentifierSnapshot).toBe("PRO FACT META B PCOS");
    expect(d.identityStatus).toBe("UNRESOLVED");

    // A present-but-unapproved price stays visible to internal review as a
    // price STATUS, while remaining unchargeable.
    const priced = evaluateKitForPatientSale("ALOPECIA_AREATA");
    expect(priced.priceStatus).toBe("PRICE_PRESENT");
    expect(priced.chargeableAmountMinor).toBeNull();
  });
});
