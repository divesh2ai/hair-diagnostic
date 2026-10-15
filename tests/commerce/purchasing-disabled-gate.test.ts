import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isPurchasingEnabled,
  assertPurchasingEnabled,
  PurchasingDisabledError,
  PURCHASING_DISABLED_CODE,
} from "@/lib/commerce/purchasingGate";

// Keep paymentStore's prisma import cheap and side-effect free — the data-layer
// guard throws before any query, so the DB is never reached in these tests.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const ORIG = process.env.PURCHASING_ENABLED;
beforeEach(() => {
  delete process.env.PURCHASING_ENABLED; // default: disabled
});
afterEach(() => {
  if (ORIG === undefined) delete process.env.PURCHASING_ENABLED;
  else process.env.PURCHASING_ENABLED = ORIG;
});

describe("purchasingGate — fails closed", () => {
  it("is OFF when unset", () => {
    expect(isPurchasingEnabled()).toBe(false);
    expect(() => assertPurchasingEnabled()).toThrow(PurchasingDisabledError);
  });

  it("is OFF for every value other than the exact string 'true'", () => {
    for (const v of ["1", "false", "yes", "TRUE", "", "on"]) {
      process.env.PURCHASING_ENABLED = v;
      expect(isPurchasingEnabled()).toBe(false);
    }
  });

  it("is ON only for exactly 'true'", () => {
    process.env.PURCHASING_ENABLED = "true";
    expect(isPurchasingEnabled()).toBe(true);
    expect(() => assertPurchasingEnabled()).not.toThrow();
  });

  it("carries the stable PURCHASING_DISABLED code", () => {
    let caught: unknown;
    try {
      assertPurchasingEnabled();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PurchasingDisabledError);
    expect((caught as PurchasingDisabledError).code).toBe(PURCHASING_DISABLED_CODE);
  });
});

describe("payment data layer — no chargeable row when disabled", () => {
  it("startCheckout rejects before any DB work", async () => {
    const { startCheckout } = await import("@/lib/payments/paymentStore");
    await expect(
      startCheckout({
        kitOrderIntentId: "koi",
        clinicId: "cl",
        assessmentId: "asm",
        amountMinor: null,
      }),
    ).rejects.toBeInstanceOf(PurchasingDisabledError);
  });

  it("markPaid rejects before any DB work", async () => {
    const { markPaid } = await import("@/lib/payments/paymentStore");
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markPaid({
        kitOrderIntentId: "koi",
        clinicId: "cl",
        assessmentId: "asm",
        source: "CLINIC_COUNTER",
        amountMinor: null,
        provider: "clinic_counter",
        providerRef: null,
        recordedByDoctorId: "d1",
      } as any),
    ).rejects.toBeInstanceOf(PurchasingDisabledError);
  });
});
