import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  evaluateOrderForPatientCharge,
  evaluateKitForPatientSale,
} from "@/lib/commerce/sellability";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import {
  isSubstitutionUsable,
  type KitSubstitution,
} from "@/lib/commerce/substitution";

const CART_ROUTE = path.join(
  process.cwd(),
  "apps/patient-portal/src/app/api/cart/[assessmentId]/route.ts",
);
const CHECKOUT_ROUTE = path.join(
  process.cwd(),
  "apps/patient-portal/src/app/api/cart/[assessmentId]/checkout/route.ts",
);
// The Clinic Order refactor moved the shared order query (commercial charge
// evaluation, doctor resolution, subtotal gating) into lib/cart/loadCartData —
// the ONE module both the API route and the page's server render call — and
// split the page into a doctor's ClinicOrderView and a patient's read-only
// PatientPlanView. These invariants assert against where each behaviour now
// lives, so they still pin the real fail-closed guarantees rather than the
// old single ecommerce page.
const CART_LOADER = path.join(
  process.cwd(),
  "apps/patient-portal/src/lib/cart/loadCartData.ts",
);
const CART_PATIENT_VIEW = path.join(
  process.cwd(),
  "apps/patient-portal/src/app/cart/[assessmentId]/PatientPlanView.tsx",
);
const CART_CLINIC_VIEW = path.join(
  process.cwd(),
  "apps/patient-portal/src/app/cart/[assessmentId]/ClinicOrderView.tsx",
);

const read = (p: string) => readFileSync(p, "utf8");

// The nine distinct identifiers actually present in KitOrderIntent.kitIds.
const LIVE_IDENTIFIERS = [
  "FPHL",
  "PRO IMMUNE GOLD",
  "MPHL",
  "IRON UP GOLD",
  "PHENOTYPE INFLAMATION",
  "PRO FACT META B PCOS",
  "HAIR FACT TE GOLD",
  "PRO FACT META B",
  "META_B",
];

describe("the fabricated price is gone from the patient path", () => {
  it("the cart route neither imports nor calls the fabricating helpers", () => {
    // Strip comments first: the files deliberately explain why these helpers
    // were removed, and naming them in prose is not using them. The route and
    // the shared loader are BOTH checked — the fabricating helpers must be
    // absent from the whole patient path — and the governed charge evaluation
    // now runs in the loader both the route and the page call.
    const stripComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const routeCode = stripComments(read(CART_ROUTE));
    const loaderCode = stripComments(read(CART_LOADER));

    for (const code of [routeCode, loaderCode]) {
      expect(code).not.toMatch(/import[^;]*\bpriceForKit\b[^;]*;/);
      expect(code).not.toMatch(/import[^;]*\btotalRevenueInr\b[^;]*;/);
      expect(code).not.toMatch(/\bpriceForKit\s*\(/);
      expect(code).not.toMatch(/\btotalRevenueInr\s*\(/);
    }
    expect(loaderCode).toMatch(/evaluateOrderForPatientCharge\s*\(/);
  });

  // The 2026-09-08 budget-substitution reconciliation (see
  // docs/kit-price-reconciliation-2026-09-08.md) did two things that between
  // them change the outcome for most of these nine LIVE identifiers:
  //   1. Approved prices for 11 canonical kits.
  //   2. Added 8 new commercial-identity aliases to
  //      lib/commerce/kitIdentity.ts's APPROVED_KIT_ALIASES — a prerequisite
  //      the budget-substitution feature needed, because
  //      src/packages/ai-engine/kit-scorer (the engine every current AND
  //      historical consultation's kitId actually comes from) emits the long
  //      clinical spelling ("HAIR FACT TE GOLD", "PRO IMMUNE GOLD", "IRON UP
  //      GOLD", …) for every compound kit name, not the short canonical key
  //      — commercial identity is still EXACT-MATCH ONLY, it just now has
  //      more entries in its exact-match table.
  // Only ONE of the nine now stays blocked: "PRO FACT META B PCOS" (explicitly
  // held for review, never resolves). "PRO FACT META B" / "META_B" USED to be
  // blocked too, but META_B was approved for direct patient sale on 2026-09-19
  // (doctor-confirmed, drfact-mumbai) and "PRO FACT META B" was added as its
  // approved alias — so both are now genuinely chargeable, exactly like the
  // 2026-09-08 reconciled identifiers.
  const STILL_BLOCKED_LIVE_IDENTIFIERS = ["PRO FACT META B PCOS"];
  const NOW_CHARGEABLE_LIVE_IDENTIFIERS = [
    "FPHL",
    "MPHL",
    "PHENOTYPE INFLAMATION",
    "PRO IMMUNE GOLD",
    "IRON UP GOLD",
    "HAIR FACT TE GOLD",
    "PRO FACT META B",
    "META_B",
  ];

  it("no live identifier can produce a patient price at all today, unless reconciled", () => {
    for (const raw of STILL_BLOCKED_LIVE_IDENTIFIERS) {
      const d = evaluateKitForPatientSale(raw);
      expect(d.sellable).toBe(false);
      expect(d.chargeableAmountMinor).toBeNull();
    }
  });

  it("the three reconciled live identifiers are now genuinely chargeable", () => {
    for (const raw of NOW_CHARGEABLE_LIVE_IDENTIFIERS) {
      const d = evaluateKitForPatientSale(raw);
      expect(d.sellable).toBe(true);
      expect(d.chargeableAmountMinor).toBeGreaterThan(0);
    }
  });

  it("nothing anywhere can yield the 5500 default", () => {
    // 5500 rupees is 550000 paise. Neither figure may appear as a chargeable
    // amount for any identifier, real, reconciled, or invented.
    for (const raw of [
      ...LIVE_IDENTIFIERS,
      "TOTALLY UNKNOWN KIT",
      "",
      "   ",
    ]) {
      const d = evaluateKitForPatientSale(raw);
      expect(d.chargeableAmountMinor).not.toBe(550000);
      expect(d.chargeableAmountMinor).not.toBe(5500);
    }
    for (const raw of STILL_BLOCKED_LIVE_IDENTIFIERS) {
      expect(evaluateKitForPatientSale(raw).chargeableAmountMinor).toBeNull();
    }
  });

  it("the cart page derives no price arithmetic from a raw unit price", () => {
    // The patient's read-only plan is where a total would be shown; it must
    // read the server-computed subtotal, never multiply a raw unit price (the
    // old page multiplied a never-null unitPriceInr — that field is gone).
    const src = read(CART_PATIENT_VIEW);
    expect(src).not.toMatch(/unitPriceInr/);
    expect(src).toMatch(/subtotalMinor/);
  });
});

describe("PRO FACT META B PCOS never becomes PCOS (veg)", () => {
  it("the clinical registry still resolves it — and is not the authority", () => {
    // Pinned deliberately: if this ever stops being true the divergence below
    // is no longer meaningful and this suite should be revisited.
    expect(getKitInfo("PRO FACT META B PCOS")?.displayName).toBe(
      "PRO FACT META B - PCOS 6 (veg)",
    );
  });

  it("the commercial decision refuses it and carries no canonical id", () => {
    const d = evaluateKitForPatientSale("PRO FACT META B PCOS");
    expect(d.identityStatus).toBe("UNRESOLVED");
    expect(d.canonicalKitId).toBeNull();
    expect(d.reasons).toContain("KIT_IDENTITY_REQUIRES_REVIEW");
  });

  it("the raw identifier survives, so the cart shows it instead of a name", () => {
    const d = evaluateKitForPatientSale("PRO FACT META B PCOS");
    expect(d.sourceIdentifierSnapshot).toBe("PRO FACT META B PCOS");
    // The loader (the one query the route and the page share) may only name a
    // kit via a resolved canonical id — an unresolved line keeps its raw
    // identifier and is never given a registry display name.
    expect(read(CART_LOADER)).toMatch(
      /decision\.canonicalKitId \? getKitInfo\(decision\.canonicalKitId\)/,
    );
  });

  it("no unknown identifier fuzzy-resolves commercially", () => {
    for (const unknown of [
      "PCOS 6",
      "PRO FACT META B PCOS 6 (veg)",
      "META-B PCOS",
      "TE GOLD VEG",
      "HEALTHY 9",
      "some kit that does not exist",
    ]) {
      const d = evaluateKitForPatientSale(unknown);
      expect(d.identityStatus).toBe("UNRESOLVED");
      expect(d.canonicalKitId).toBeNull();
    }
  });

  it("the approved alias still resolves — this is not a blanket refusal", () => {
    const d = evaluateKitForPatientSale("PHENOTYPE INFLAMATION");
    expect(d.identityStatus).toBe("RESOLVED");
    expect(d.canonicalKitId).toBe("PHENOTYPE_INFLAMMATION");
    // Reconciled 2026-09-08 as part of the budget-substitution feature (see
    // docs/kit-price-reconciliation-2026-09-08.md) — resolution AND price are
    // both now approved, so this identifier is genuinely chargeable.
    expect(d.priceStatus).toBe("PRICE_APPROVED");
    expect(d.sellable).toBe(true);
    expect(d.chargeableAmountMinor).toBe(341000);
    expect(d.sourceIdentifierSnapshot).toBe("PHENOTYPE INFLAMATION");
  });

  it("an identity that resolves but has no approved price is still blocked", () => {
    // ALOPECIA_AREATA: a real canonical kit, exact-match resolvable, but not
    // touched by the 2026-09-08 reconciliation (it has no budget alternative
    // and was not in the approved sheet for this feature).
    const d = evaluateKitForPatientSale("ALOPECIA_AREATA");
    expect(d.identityStatus).toBe("RESOLVED");
    expect(d.priceStatus).toBe("PRICE_PRESENT");
    expect(d.sellable).toBe(false);
    expect(d.reasons).toContain("PRICE_NOT_APPROVED");
  });
});

describe("no misleading total, no monetary progression", () => {
  it("a cart with one unresolved line has no total", () => {
    const order = evaluateOrderForPatientCharge([
      "FPHL",
      "PRO FACT META B PCOS",
    ]);
    expect(order.chargeable).toBe(false);
    expect(order.totalAmountMinor).toBeNull();
  });

  it("a cart of resolved-but-unapproved lines still has no total", () => {
    // ALOPECIA_AREATA + HBR: both resolve, neither was reconciled.
    const order = evaluateOrderForPatientCharge(["ALOPECIA_AREATA", "HBR"]);
    expect(order.chargeable).toBe(false);
    expect(order.totalAmountMinor).toBeNull();
    expect(order.blockingReasons).toContain("PRICE_NOT_APPROVED");
  });

  it("a cart of fully-reconciled lines now totals correctly", () => {
    // FPHL + MPHL: both reconciled 2026-09-08 — see the note on
    // NOW_CHARGEABLE_LIVE_IDENTIFIERS above for why these specific raw ids
    // (not the others) resolve.
    const order = evaluateOrderForPatientCharge(["FPHL", "MPHL"]);
    expect(order.chargeable).toBe(true);
    expect(order.totalAmountMinor).toBe(358300 + 363700);
  });

  it("real prescriptions that resolved-but-were-blocked (on identity or price) are now chargeable", () => {
    // Both exceptions among "still non-chargeable" below — kept separate
    // because their outcome genuinely changed with the reconciliation.
    // "FPHL" was blocked on price alone; "MPHL" + "PRO IMMUNE GOLD" needed
    // both the new alias AND the new price to become chargeable.
    const fphlOnly = evaluateOrderForPatientCharge(["FPHL"]);
    expect(fphlOnly.chargeable).toBe(true);
    expect(fphlOnly.totalAmountMinor).toBe(358300);

    // PRO_IMMUNE_GOLD was repriced 2026-09-19 (₹2,518 → ₹2,638) as part of the
    // doctor-confirmed Pro Immune price-sheet correction.
    const mphlProImmune = evaluateOrderForPatientCharge(["MPHL", "PRO IMMUNE GOLD"]);
    expect(mphlProImmune.chargeable).toBe(true);
    expect(mphlProImmune.totalAmountMinor).toBe(363700 + 263800);
  });

  it("every other real prescription on file remains non-chargeable", () => {
    // Each of these still contains at least one line blocked on identity (a
    // spelling with no canonical match or approved alias, or an identifier
    // explicitly held for review) or on price (a resolved kit that carries no
    // APPROVED price). META_B is deliberately NOT used to make an order blocked
    // any more — it is now approved for patient sale — so these orders lean on
    // identifiers that genuinely still cannot charge: "PRO FACT META B PCOS"
    // (held for review, unresolved) and ALOPECIA_AREATA / HBR (resolve, but
    // were never price-approved).
    const realOrders = [
      ["PRO FACT META B PCOS", "IRON UP GOLD"],
      ["HAIR FACT TE GOLD", "ALOPECIA_AREATA"],
      ["HBR"],
    ];
    for (const kits of realOrders) {
      const order = evaluateOrderForPatientCharge(kits);
      expect(order.chargeable).toBe(false);
      expect(order.totalAmountMinor).toBeNull();
    }
  });

  it("the checkout endpoint gates on the same decision, not on the UI", () => {
    const src = read(CHECKOUT_ROUTE);
    expect(src).toMatch(/evaluateOrderForPatientCharge/);
    expect(src).toMatch(/ORDER_NOT_CHARGEABLE/);
    expect(src).toMatch(/if \(!commercial\.chargeable\)/);
  });

  it("the clinic order gates its confirm button on the server flag", () => {
    // Confirming the order is the doctor's action, on the doctor-only
    // ClinicOrderView; the confirm button is disabled unless the server says
    // the whole order is chargeable. (That the patient's PatientPlanView has no
    // quantity control or order action at all is pinned in
    // p0-launch-invariants.)
    expect(read(CART_CLINIC_VIEW)).toMatch(/!cart\.chargeable/);
  });

  it("the loader emits a subtotal only when the whole order is chargeable", () => {
    // Subtotal gating moved into loadCartData, the one query the route and the
    // page share, so both callers get null rather than a partial total.
    const src = read(CART_LOADER);
    expect(src).toMatch(/commercial\.chargeable\s*\n?\s*\?/);
    expect(src).toMatch(/subtotalMinor/);
  });
});

describe("substitution contract (types only, not yet implemented)", () => {
  const base: KitSubstitution = {
    prescribedSourceIdentifierSnapshot: "PRO FACT META B",
    prescribedCanonicalKitId: "META_B",
    prescribedIdentityStatus: "RESOLVED",
    alternativeCanonicalKitId: "HEALTHY_9",
    reason: "LOWER_COST_ALTERNATIVE",
    reasonNote: null,
    requiresDoctorApproval: true,
    approvalStatus: "PENDING_DOCTOR_APPROVAL",
    approvedByDoctorId: null,
    approvedAt: null,
    finalSuppliedCanonicalKitId: null,
  };

  it("blocks a substitution awaiting doctor approval", () => {
    expect(isSubstitutionUsable(base)).toBe(false);
  });

  it("allows one that has been approved", () => {
    expect(isSubstitutionUsable({ ...base, approvalStatus: "APPROVED" })).toBe(
      true,
    );
  });

  it("blocks a rejected substitution even when approval was not required", () => {
    expect(
      isSubstitutionUsable({
        ...base,
        requiresDoctorApproval: false,
        approvalStatus: "REJECTED",
      }),
    ).toBe(false);
  });

  it("keeps the prescription and the alternative as separate facts", () => {
    const supplied = { ...base, approvalStatus: "APPROVED" as const,
      finalSuppliedCanonicalKitId: "HEALTHY_9" };
    // The prescribed kit is still recoverable after supply.
    expect(supplied.prescribedCanonicalKitId).toBe("META_B");
    expect(supplied.prescribedSourceIdentifierSnapshot).toBe("PRO FACT META B");
    expect(supplied.finalSuppliedCanonicalKitId).not.toBe(
      supplied.prescribedCanonicalKitId,
    );
  });
});
