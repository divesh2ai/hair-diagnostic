import { describe, it, expect } from "vitest";
import { deriveCartLifecycle } from "@/lib/journey/resolveJourney";
import type { FulfilmentRecord } from "@/lib/fulfilment/fulfilmentStore";
import type { FulfilmentStatus } from "@/lib/fulfilment/stateMachine";

// The cart lifecycle PART 5 asks for is DERIVED, not stored. These tests pin
// the derivation, because it is the one place a display could come to
// disagree with the records underneath it.

function fulfilment(status: FulfilmentStatus): FulfilmentRecord {
  // Only `status` is read by the deriver; the rest is shape.
  return {
    id: "f1",
    kitOrderIntentId: "i1",
    clinicId: "c1",
    doctorId: "d1",
    assessmentId: "a1",
    mode: "CLINIC",
    status,
    requestedAt: "2026-08-01T00:00:00.000Z",
    confirmedAt: null,
    packedAt: null,
    dispatchedAt: null,
    deliveredAt: null,
    acknowledgedAt: null,
    cancelledAt: null,
    acknowledgedByDoctorId: null,
    notes: null,
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const BASE = {
  hasOrder: true,
  cartSent: false,
  cartViewed: false,
  checkoutStarted: false,
  paid: false,
  fulfilment: null as FulfilmentRecord | null,
};

describe("derived cart lifecycle", () => {
  it("reports NO_ORDER when the doctor prescribed no kits", () => {
    expect(deriveCartLifecycle({ ...BASE, hasOrder: false })).toBe("NO_ORDER");
  });

  it("walks the ordinary path one stage at a time", () => {
    expect(deriveCartLifecycle(BASE)).toBe("DOCTOR_APPROVED");
    expect(deriveCartLifecycle({ ...BASE, cartSent: true })).toBe("SENT_TO_PATIENT");
    expect(deriveCartLifecycle({ ...BASE, cartSent: true, cartViewed: true })).toBe(
      "VIEWED",
    );
    expect(
      deriveCartLifecycle({
        ...BASE,
        cartSent: true,
        cartViewed: true,
        checkoutStarted: true,
      }),
    ).toBe("CHECKOUT_STARTED");
    expect(
      deriveCartLifecycle({
        ...BASE,
        cartSent: true,
        cartViewed: true,
        checkoutStarted: true,
        paid: true,
      }),
    ).toBe("PAID");
  });

  describe("the deepest true fact wins, not the shallowest missing one", () => {
    it("reports PAID even when no cart view was recorded", () => {
      // Real case: the clinic took payment at the counter before the patient
      // ever opened the link, or the patient's device blocked the request.
      // Reporting SENT_TO_PATIENT because a view event is absent would be a
      // worse answer than the one the money gives.
      expect(deriveCartLifecycle({ ...BASE, cartSent: true, paid: true })).toBe(
        "PAID",
      );
    });

    it("reports PAID even when the cart send was never recorded", () => {
      expect(deriveCartLifecycle({ ...BASE, paid: true })).toBe("PAID");
    });
  });

  describe("fulfilment outranks payment", () => {
    it("reports FULFILMENT_PENDING while ops is still working", () => {
      for (const s of ["REQUESTED", "CONFIRMED", "PACKED", "DISPATCHED"] as const) {
        expect(
          deriveCartLifecycle({ ...BASE, paid: true, fulfilment: fulfilment(s) }),
        ).toBe("FULFILMENT_PENDING");
      }
    });

    it("reports FULFILLED once the kit is delivered or receipt is confirmed", () => {
      expect(
        deriveCartLifecycle({
          ...BASE,
          paid: true,
          fulfilment: fulfilment("DELIVERED"),
        }),
      ).toBe("FULFILLED");
      expect(
        deriveCartLifecycle({
          ...BASE,
          paid: true,
          fulfilment: fulfilment("ACKNOWLEDGED"),
        }),
      ).toBe("FULFILLED");
    });

    it("does not report FULFILLED for a cancelled request", () => {
      expect(
        deriveCartLifecycle({
          ...BASE,
          paid: true,
          fulfilment: fulfilment("CANCELLED"),
        }),
      ).toBe("FULFILMENT_PENDING");
    });
  });

  it("never reports a fulfilment stage for an order with no fulfilment", () => {
    // A patient-delivery order has no clinic fulfilment record and must not be
    // shown as pending one forever.
    const result = deriveCartLifecycle({ ...BASE, paid: true, fulfilment: null });
    expect(result).toBe("PAID");
  });
});
