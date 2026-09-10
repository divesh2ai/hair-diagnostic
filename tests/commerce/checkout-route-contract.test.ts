import { describe, it, expect, vi, beforeEach } from "vitest";

// ══ WHY THIS SUITE EXISTS IN-PROCESS ════════════════════════════════════════
//
// The behavioural checkout tests drive a real dev server over HTTP, so they
// can only ever observe the commercial state that server is actually in —
// today, PRICE_APPROVED = 0/30, every cart non-chargeable, every checkout 409.
// A `vi.mock` in the test process cannot reach across into the server.
//
// The alternative would be an env-gated override that lets a price be treated
// as approved. That is a switch which, if it ever leaked into production,
// would let real patients be charged against unapproved prices — the precise
// failure this whole workstream exists to prevent. It is not worth having for
// a test.
//
// So the CHARGEABLE half of the contract is proven here instead: the route
// handler imported directly, with the commerce decision mocked at its seam.
// No server, no database, no seeded price, and nothing added to production
// code to make it testable.

const startCheckout = vi.fn();
const evaluateOrderForPatientCharge = vi.fn();
const resolveApprovedOrder = vi.fn();
const verifyCartToken = vi.fn();
const findUniqueAssessment = vi.fn();

class PaymentNotProvisionedError extends Error {}

vi.mock("@/lib/prisma", () => ({
  prisma: { assessment: { findUnique: (...a: unknown[]) => findUniqueAssessment(...a) } },
}));
vi.mock("@/lib/cartToken", () => ({
  verifyCartToken: (...a: unknown[]) => verifyCartToken(...a),
}));
vi.mock("@/lib/consultation/approvedOrder", () => ({
  resolveApprovedOrder: (...a: unknown[]) => resolveApprovedOrder(...a),
}));
vi.mock("@/lib/payments/paymentStore", () => ({
  startCheckout: (...a: unknown[]) => startCheckout(...a),
  PaymentNotProvisionedError,
  PAYMENT_NOT_PROVISIONED: "PAYMENT_NOT_PROVISIONED",
}));
vi.mock("@/lib/commerce/sellability", () => ({
  evaluateOrderForPatientCharge: (...a: unknown[]) =>
    evaluateOrderForPatientCharge(...a),
}));

const { POST } = await import(
  "@/app/api/cart/[assessmentId]/checkout/route"
);

const ASSESSMENT = "asm_test_1";
const post = (body?: unknown) =>
  POST(
    new Request(`http://localhost/api/cart/${ASSESSMENT}/checkout?t=tok`, {
      method: "POST",
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    { params: Promise.resolve({ assessmentId: ASSESSMENT }) },
  );

/** A cart the commerce layer considers fully chargeable. Test-only. */
const chargeable = () => ({
  chargeable: true,
  totalAmountMinor: 590000,
  lines: [],
  blockingReasons: [],
});

const blocked = (reasons: string[]) => ({
  chargeable: false,
  totalAmountMinor: null,
  lines: [],
  blockingReasons: reasons,
});

const STARTED_AT = new Date("2026-09-03T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  verifyCartToken.mockReturnValue({ ok: true });
  resolveApprovedOrder.mockResolvedValue({
    intentId: "koi_1",
    kitIds: ["TE_GOLD"],
  });
  findUniqueAssessment.mockResolvedValue({ clinicId: "cl_1" });
  // Mirrors the real store's idempotency: the first call fixes the clock and
  // later calls hand back the same row.
  startCheckout.mockResolvedValue({
    status: "PENDING",
    checkoutStartedAt: STARTED_AT,
    paidAt: null,
    amountMinor: null,
    source: null,
  });
});

describe("chargeable cart — the contract preserved for when prices land", () => {
  it("returns 200 and records a PENDING checkout", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(chargeable());

    const res = await post();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("PENDING");
    expect(body.checkoutStartedAt).toBeTruthy();
    expect(startCheckout).toHaveBeenCalledTimes(1);
  });

  it("never sends an amount — the browser cannot put money on the row", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(chargeable());

    await post({ status: "PAID", paid: true, amountMinor: 1 });

    // Whatever the body claimed, the write carries a null amount and no
    // status the caller chose.
    const arg = startCheckout.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.amountMinor).toBeNull();
    expect(arg).not.toHaveProperty("status");
    expect(arg).not.toHaveProperty("paidAt");
    expect(arg.assessmentId).toBe(ASSESSMENT);
  });

  it("cannot create PAID through this endpoint", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(chargeable());

    const res = await post({ status: "PAID", paid: true, source: "CLINIC_COUNTER" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("PENDING");
    expect(body.status).not.toBe("PAID");
  });

  it("is idempotent — a repeat does not reset checkoutStartedAt", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(chargeable());

    const first = await (await post()).json();
    const second = await (await post()).json();

    expect(new Date(second.checkoutStartedAt).toISOString()).toBe(
      new Date(first.checkoutStartedAt).toISOString(),
    );
    // The route re-issues the same request; the store is what dedupes it.
    expect(startCheckout).toHaveBeenCalledTimes(2);
    const a = startCheckout.mock.calls[0]![0] as Record<string, unknown>;
    const b = startCheckout.mock.calls[1]![0] as Record<string, unknown>;
    expect(b).toEqual(a);
  });
});

describe("non-chargeable cart — nothing reaches the payment store", () => {
  const cases: Array<[string, string[]]> = [
    ["resolved identity + unapproved price", ["PRICE_NOT_APPROVED"]],
    ["unresolved identity", ["KIT_IDENTITY_REQUIRES_REVIEW"]],
    ["missing price", ["PRICE_MISSING"]],
    ["kit not in catalogue", ["KIT_NOT_IN_CATALOGUE"]],
  ];

  for (const [name, reasons] of cases) {
    it(`409s for ${name}, and writes nothing`, async () => {
      evaluateOrderForPatientCharge.mockReturnValue(blocked(reasons));

      const res = await post();
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toBe("ORDER_NOT_CHARGEABLE");
      expect(body.reasons).toEqual(reasons);

      // The decisive assertion: no checkout was started, so no
      // checkoutStartedAt exists to be mistaken for a real attempt.
      expect(startCheckout).not.toHaveBeenCalled();
    });
  }

  it("stays blocked when repeated, and still writes nothing", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(blocked(["PRICE_NOT_APPROVED"]));

    for (const _ of [1, 2, 3]) {
      const res = await post();
      expect(res.status).toBe(409);
    }
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("cannot be talked into PAID by the request body", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(blocked(["PRICE_NOT_APPROVED"]));

    const res = await post({ status: "PAID", paid: true, amountMinor: 999999 });
    expect(res.status).toBe(409);
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("surfaces no price in the rejection", async () => {
    evaluateOrderForPatientCharge.mockReturnValue(blocked(["PRICE_NOT_APPROVED"]));

    const raw = await (await post()).text();
    expect(raw).not.toMatch(/5500|550000|amount/i);
  });
});

describe("the commercial gate sits behind the access checks", () => {
  it("a bad token is still a 404, not a 409 — states are not leaked", async () => {
    verifyCartToken.mockReturnValue({ ok: false });
    evaluateOrderForPatientCharge.mockReturnValue(blocked(["PRICE_NOT_APPROVED"]));

    const res = await post();
    expect(res.status).toBe(404);
    expect(evaluateOrderForPatientCharge).not.toHaveBeenCalled();
  });

  it("an unknown assessment is a 404 before any commercial judgement", async () => {
    resolveApprovedOrder.mockResolvedValue(null);

    const res = await post();
    expect(res.status).toBe(404);
    expect(evaluateOrderForPatientCharge).not.toHaveBeenCalled();
  });
});
