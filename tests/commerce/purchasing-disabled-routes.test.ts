import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Route-contract proof that the five money/order endpoints refuse to act when
// purchasing is disabled (the default). The purchasingGate is REAL here — only
// each route's downstream collaborators are mocked, so a 403 proves the guard
// fired before any mutation, and the mutation spies prove nothing was written.

const startCheckout = vi.fn();
const confirmPayment = vi.fn();
const resolveApprovedOrder = vi.fn();
const verifyCartToken = vi.fn();
const writeAuditLog = vi.fn();
const requireDoctorContext = vi.fn();
const findUniqueAssessment = vi.fn();
const evaluateOrderForPatientCharge = vi.fn();

class PaymentNotProvisionedError extends Error {}
class FulfilmentNotProvisionedError extends Error {}

vi.mock("@/lib/prisma", () => ({
  prisma: { assessment: { findUnique: (...a: unknown[]) => findUniqueAssessment(...a) } },
}));
vi.mock("@/lib/cartToken", () => ({ verifyCartToken: (...a: unknown[]) => verifyCartToken(...a) }));
vi.mock("@/lib/consultation/approvedOrder", () => ({
  resolveApprovedOrder: (...a: unknown[]) => resolveApprovedOrder(...a),
}));
vi.mock("@/lib/consultation/loadReview", () => ({ newRequestId: () => "req_test" }));
vi.mock("@/lib/audit/writeAuditLog", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));
vi.mock("@/lib/auth", () => ({
  requireDoctorContext: (...a: unknown[]) => requireDoctorContext(...a),
  assertDoctorInClinic: () => null,
}));
vi.mock("@/lib/payments/paymentStore", () => ({
  startCheckout: (...a: unknown[]) => startCheckout(...a),
  PaymentNotProvisionedError,
  PAYMENT_NOT_PROVISIONED: "PAYMENT_NOT_PROVISIONED",
}));
vi.mock("@/lib/payments/confirmPayment", () => ({
  confirmPayment: (...a: unknown[]) => confirmPayment(...a),
}));
vi.mock("@/lib/payments/webhookVerifier", () => ({
  isKnownProvider: () => true,
  verifyWebhookSignature: () => ({ ok: true }),
}));
vi.mock("@/lib/fulfilment/fulfilmentStore", () => ({
  FULFILMENT_NOT_PROVISIONED: "FULFILMENT_NOT_PROVISIONED",
  FulfilmentNotProvisionedError,
}));
vi.mock("@/lib/commerce/sellability", () => ({
  evaluateOrderForPatientCharge: (...a: unknown[]) => evaluateOrderForPatientCharge(...a),
}));

const ORIG = process.env.PURCHASING_ENABLED;
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PURCHASING_ENABLED; // disabled by default
  requireDoctorContext.mockResolvedValue({
    doctor: { id: "d1", clinicId: "cl1" },
    authUserId: "u1",
    authRole: "DOCTOR",
    mode: "live",
  });
  findUniqueAssessment.mockResolvedValue({ clinicId: "cl1" });
});
afterEach(() => {
  if (ORIG === undefined) delete process.env.PURCHASING_ENABLED;
  else process.env.PURCHASING_ENABLED = ORIG;
});

const body = (obj: unknown) => JSON.stringify(obj);

describe("purchasing disabled — endpoints refuse and mutate nothing", () => {
  it("POST /cart/[id]/checkout → 403, no checkout started", async () => {
    const { POST } = await import("@/app/api/cart/[assessmentId]/checkout/route");
    const res = await POST(
      new Request("http://localhost/api/cart/asm/checkout?t=tok", { method: "POST" }),
      { params: Promise.resolve({ assessmentId: "asm" }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PURCHASING_DISABLED");
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("POST /cart/[id]/confirm → 403, no audit write", async () => {
    const { POST } = await import("@/app/api/cart/[assessmentId]/confirm/route");
    const res = await POST(
      new Request("http://localhost/api/cart/asm/confirm", { method: "POST", body: body({}) }),
      { params: Promise.resolve({ assessmentId: "asm" }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PURCHASING_DISABLED");
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("PATCH /cart/[id]/quantity → 403, no audit write", async () => {
    const { PATCH } = await import("@/app/api/cart/[assessmentId]/quantity/route");
    const res = await PATCH(
      new Request("http://localhost/api/cart/asm/quantity", { method: "PATCH", body: body({ kitId: "K1", quantity: 2 }) }),
      { params: Promise.resolve({ assessmentId: "asm" }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PURCHASING_DISABLED");
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("POST /doctor/orders/[intentId]/payment → 403, no payment confirmed", async () => {
    const { POST } = await import("@/app/api/doctor/orders/[intentId]/payment/route");
    const res = await POST(
      new Request("http://localhost/api/doctor/orders/koi/payment", { method: "POST", body: body({ amountMinor: 100 }) }),
      { params: Promise.resolve({ intentId: "koi" }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PURCHASING_DISABLED");
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("POST /payments/webhook/[provider] → 403, no payment confirmed", async () => {
    const { POST } = await import("@/app/api/payments/webhook/[provider]/route");
    const res = await POST(
      new Request("http://localhost/api/payments/webhook/razorpay", {
        method: "POST",
        body: body({ event: "payment.captured", kitOrderIntentId: "koi", amountMinor: 100 }),
      }),
      { params: Promise.resolve({ provider: "razorpay" }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("PURCHASING_DISABLED");
    expect(confirmPayment).not.toHaveBeenCalled();
  });
});

describe("purchasing enabled — the gate does not block", () => {
  it("POST /cart/[id]/checkout proceeds (not 403) when PURCHASING_ENABLED=true", async () => {
    process.env.PURCHASING_ENABLED = "true";
    verifyCartToken.mockReturnValue({ ok: true });
    resolveApprovedOrder.mockResolvedValue({ intentId: "koi", kitIds: ["K1"] });
    evaluateOrderForPatientCharge.mockReturnValue({
      chargeable: true,
      totalAmountMinor: 1,
      lines: [],
      blockingReasons: [],
    });
    startCheckout.mockResolvedValue({
      status: "PENDING",
      checkoutStartedAt: new Date(),
      paidAt: null,
      amountMinor: null,
      source: null,
    });
    const { POST } = await import("@/app/api/cart/[assessmentId]/checkout/route");
    const res = await POST(
      new Request("http://localhost/api/cart/asm/checkout?t=tok", { method: "POST" }),
      { params: Promise.resolve({ assessmentId: "asm" }) },
    );
    expect(res.status).not.toBe(403);
    expect(startCheckout).toHaveBeenCalledTimes(1);
  });
});
