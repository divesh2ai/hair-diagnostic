import { describe, it, expect } from "vitest";
import {
  deriveLineState,
  summarisePlan,
  validatePurchaseEvent,
  isMoneyEvent,
  requiresReason,
  requiresBoxes,
  type PurchaseEventInput,
} from "@/lib/commerce/kitPurchaseModel";

// Partial kit purchase — domain rules. These are the guarantees the brief turns
// on: kit COUNT is separate from BOX quantity, a patient-reported purchase is
// never counted as a sale, later purchases don't double-count, and a deferred
// kit later bought reads as purchased.

const ev = (
  eventType: PurchaseEventInput["eventType"],
  boxes: number | null,
  occurredAt: string,
): PurchaseEventInput => ({ eventType, boxes, occurredAt });

describe("deriveLineState — box dimension", () => {
  it("counts only clinic-confirmed purchases, never patient-reported", () => {
    const d = deriveLineState(2, "RECOMMENDED", [
      ev("PURCHASE_REPORTED_BY_PATIENT", 2, "2026-10-01"),
    ]);
    expect(d.purchasedBoxes).toBe(0);
    expect(d.patientReportedBoxes).toBe(2);
    expect(d.status).toBe("RECOMMENDED");
    expect(d.remainingBoxes).toBe(2);
  });

  it("partial box purchase reads PARTIALLY_PURCHASED", () => {
    const d = deriveLineState(2, "RECOMMENDED", [
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 1, "2026-10-02"),
    ]);
    expect(d.purchasedBoxes).toBe(1);
    expect(d.remainingBoxes).toBe(1);
    expect(d.status).toBe("PARTIALLY_PURCHASED");
  });

  it("full box purchase reads PURCHASED", () => {
    const d = deriveLineState(2, "RECOMMENDED", [
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 2, "2026-10-02"),
    ]);
    expect(d.purchasedBoxes).toBe(2);
    expect(d.remainingBoxes).toBe(0);
    expect(d.status).toBe("PURCHASED");
  });

  it("later purchase on a new date accumulates without double counting", () => {
    const d = deriveLineState(4, "RECOMMENDED", [
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 1, "2026-10-02"),
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 2, "2026-10-23"),
    ]);
    expect(d.purchasedBoxes).toBe(3);
    expect(d.remainingBoxes).toBe(1);
    expect(d.status).toBe("PARTIALLY_PURCHASED");
  });

  it("refund reduces the counted purchase", () => {
    const d = deriveLineState(2, "RECOMMENDED", [
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 2, "2026-10-02"),
      ev("REFUNDED", 1, "2026-10-10"),
    ]);
    expect(d.purchasedBoxes).toBe(1);
    expect(d.status).toBe("PARTIALLY_PURCHASED");
  });

  it("dispensing is tracked apart from purchase, never added to it", () => {
    const d = deriveLineState(2, "RECOMMENDED", [
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 2, "2026-10-02"),
      ev("DISPENSED", 2, "2026-10-03"),
    ]);
    expect(d.purchasedBoxes).toBe(2);
    expect(d.dispensedBoxes).toBe(2);
  });

  it("a deferred kit later purchased reads as purchased", () => {
    const d = deriveLineState(2, "DEFERRED", [
      ev("DEFERRED", null, "2026-09-01"),
      ev("PURCHASE_CONFIRMED_BY_CLINIC", 2, "2026-10-01"),
    ]);
    expect(d.status).toBe("PURCHASED");
  });

  it("honours a stored control status when nothing was bought", () => {
    const d = deriveLineState(2, "DECLINED", []);
    expect(d.status).toBe("DECLINED");
    expect(d.purchasedBoxes).toBe(0);
  });

  it("records the earliest treatment-start date", () => {
    const d = deriveLineState(2, "RECOMMENDED", [
      ev("TREATMENT_STARTED", null, "2026-10-20"),
      ev("TREATMENT_STARTED", null, "2026-10-05"),
    ]);
    expect(d.treatmentStarted).toBe(true);
    expect(d.treatmentStartedAt).toBe("2026-10-05");
  });
});

describe("summarisePlan — kit count vs box quantity are distinct", () => {
  it("4 kits recommended, 1 fully bought, 1 partly, 1 deferred, 1 untouched", () => {
    const s = summarisePlan([
      { recommendedBoxes: 2, storedStatus: "RECOMMENDED", events: [ev("PURCHASE_CONFIRMED_BY_CLINIC", 2, "2026-10-01")] },
      { recommendedBoxes: 2, storedStatus: "RECOMMENDED", events: [ev("PURCHASE_CONFIRMED_BY_CLINIC", 1, "2026-10-01")] },
      { recommendedBoxes: 2, storedStatus: "DEFERRED", events: [ev("DEFERRED", null, "2026-10-01")] },
      { recommendedBoxes: 2, storedStatus: "RECOMMENDED", events: [] },
    ]);
    // KIT dimension
    expect(s.recommendedKits).toBe(4);
    expect(s.purchasedKits).toBe(2); // fully + partial
    expect(s.fullyPurchasedKits).toBe(1);
    expect(s.deferredKits).toBe(1);
    expect(s.remainingKits).toBe(1);
    // BOX dimension
    expect(s.recommendedBoxes).toBe(8);
    expect(s.purchasedBoxes).toBe(3);
    expect(s.remainingBoxes).toBe(5);
  });

  it("never assumes purchase: no events ⇒ nothing purchased", () => {
    const s = summarisePlan([
      { recommendedBoxes: 2, storedStatus: "RECOMMENDED", events: [] },
      { recommendedBoxes: 2, storedStatus: "RECOMMENDED", events: [] },
    ]);
    expect(s.purchasedKits).toBe(0);
    expect(s.purchasedBoxes).toBe(0);
    expect(s.remainingKits).toBe(2);
  });
});

describe("validatePurchaseEvent + helpers", () => {
  it("rejects an unknown event type", () => {
    expect(validatePurchaseEvent({ eventType: "NOPE" })).toBe("invalid_event_type");
  });
  it("requires a reason for control events", () => {
    expect(validatePurchaseEvent({ eventType: "DEFERRED" })).toBe("reason_required");
    expect(validatePurchaseEvent({ eventType: "DEFERRED", reason: "cost" })).toBeNull();
    expect(requiresReason("DECLINED")).toBe(true);
    expect(requiresReason("PURCHASE_CONFIRMED_BY_CLINIC")).toBe(false);
  });
  it("requires a positive integer box count for quantity events", () => {
    expect(validatePurchaseEvent({ eventType: "PURCHASE_CONFIRMED_BY_CLINIC" })).toBe("boxes_required");
    expect(validatePurchaseEvent({ eventType: "PURCHASE_CONFIRMED_BY_CLINIC", boxes: 0 })).toBe("boxes_required");
    expect(validatePurchaseEvent({ eventType: "PURCHASE_CONFIRMED_BY_CLINIC", boxes: 1 })).toBeNull();
    expect(requiresBoxes("DISPENSED")).toBe(true);
    expect(requiresBoxes("TREATMENT_STARTED")).toBe(false);
  });
  it("rejects a negative sale value", () => {
    expect(validatePurchaseEvent({ eventType: "PAYMENT_RECORDED", saleValueMinor: -1 })).toBe("invalid_sale_value");
  });
  it("classifies money events for the purchasing gate", () => {
    expect(isMoneyEvent("PAYMENT_RECORDED", null)).toBe(true);
    expect(isMoneyEvent("PURCHASE_CONFIRMED_BY_CLINIC", 50000)).toBe(true);
    expect(isMoneyEvent("PURCHASE_CONFIRMED_BY_CLINIC", null)).toBe(false);
    expect(isMoneyEvent("DISPENSED", null)).toBe(false);
  });
});
