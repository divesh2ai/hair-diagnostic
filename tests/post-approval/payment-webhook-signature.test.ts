import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import {
  isKnownProvider,
  verifyWebhookSignature,
} from "@/lib/payments/webhookVerifier";

// The payment webhook is an unauthenticated public URL that flips an order to
// PAID. Its signature check is the whole of its authentication, so every one
// of these is a "free kits" test.

const SECRET = "test-only-webhook-secret";
const BODY = JSON.stringify({
  event: "payment.captured",
  kitOrderIntentId: "cl_intent_aaaa",
  paymentId: "pay_123",
  amountMinor: 450000,
});

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function headers(sig: string | null, name = "x-razorpay-signature"): Headers {
  const h = new Headers();
  if (sig !== null) h.set(name, sig);
  return h;
}

const ORIGINAL = process.env.PAYMENT_WEBHOOK_SECRET;

beforeEach(() => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET;
  delete process.env.PAYMENT_WEBHOOK_SECRET_RAZORPAY;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
  else process.env.PAYMENT_WEBHOOK_SECRET = ORIGINAL;
  delete process.env.PAYMENT_WEBHOOK_SECRET_RAZORPAY;
});

describe("payment webhook signature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature("razorpay", BODY, headers(sign(BODY))).ok).toBe(
      true,
    );
  });

  describe("forgery — the whole point", () => {
    it("REJECTS a body with no signature at all", () => {
      const v = verifyWebhookSignature("razorpay", BODY, headers(null));
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe("missing_signature");
    });

    it("REJECTS a signature made with the wrong secret", () => {
      const v = verifyWebhookSignature(
        "razorpay",
        BODY,
        headers(sign(BODY, "attacker-secret")),
      );
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe("invalid_signature");
    });

    it("REJECTS a valid signature replayed over a DIFFERENT body", () => {
      // The realistic attack: intercept one genuine callback, then resend it
      // with someone else's order id.
      const otherOrder = JSON.stringify({
        event: "payment.captured",
        kitOrderIntentId: "cl_intent_victim",
        paymentId: "pay_123",
      });
      const v = verifyWebhookSignature("razorpay", otherOrder, headers(sign(BODY)));
      expect(v.ok).toBe(false);
    });

    it("REJECTS a body altered by a single character", () => {
      const tampered = BODY.replace("450000", "450001");
      expect(
        verifyWebhookSignature("razorpay", tampered, headers(sign(BODY))).ok,
      ).toBe(false);
    });

    it("REJECTS a truncated signature without throwing", () => {
      // timingSafeEqual throws on unequal lengths; an exception here would
      // become a 500, and a 500 tells a prober something a 401 does not.
      const short = sign(BODY).slice(0, 10);
      expect(() =>
        verifyWebhookSignature("razorpay", BODY, headers(short)),
      ).not.toThrow();
      expect(verifyWebhookSignature("razorpay", BODY, headers(short)).ok).toBe(
        false,
      );
    });

    it("REJECTS an empty signature header", () => {
      expect(verifyWebhookSignature("razorpay", BODY, headers("")).ok).toBe(false);
    });
  });

  describe("fail closed", () => {
    it("REJECTS when no secret is configured", () => {
      delete process.env.PAYMENT_WEBHOOK_SECRET;
      const v = verifyWebhookSignature("razorpay", BODY, headers(sign(BODY)));
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe("not_configured");
    });

    it("REJECTS an unknown provider", () => {
      const v = verifyWebhookSignature("totally-made-up", BODY, headers(sign(BODY)));
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe("unknown_provider");
    });

    it("has no development bypass", () => {
      // A NODE_ENV escape hatch in a payment verifier is a bypass that ships,
      // and staging carries real-shaped orders.
      //
      // Asserted by reading the module rather than by setting NODE_ENV: the
      // claim is that the verifier does not CONSULT the environment at all,
      // which is stronger than showing it rejects under one value of it — and
      // Vitest defines process.env.NODE_ENV as non-configurable, so the
      // environment cannot be swapped from inside a test anyway.
      const src = readFileSync(
        join(
          process.cwd(),
          "apps/patient-portal/src/lib/payments/webhookVerifier.ts",
        ),
        "utf8",
      );
      // Comments stripped first — the module's own documentation explains why
      // there is no NODE_ENV bypass, and matching that prose would fail the
      // test for saying the right thing.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code).not.toContain("NODE_ENV");

      // And it rejects unsigned and wrongly-signed callbacks here and now.
      expect(
        verifyWebhookSignature("razorpay", BODY, headers("anything")).ok,
      ).toBe(false);
      expect(verifyWebhookSignature("razorpay", BODY, headers(null)).ok).toBe(
        false,
      );
    });
  });

  describe("per-provider secrets", () => {
    it("prefers the provider-specific secret over the shared one", () => {
      // Rotating one gateway must not invalidate another.
      process.env.PAYMENT_WEBHOOK_SECRET_RAZORPAY = "razorpay-only";
      expect(
        verifyWebhookSignature(
          "razorpay",
          BODY,
          headers(sign(BODY, "razorpay-only")),
        ).ok,
      ).toBe(true);
      expect(
        verifyWebhookSignature("razorpay", BODY, headers(sign(BODY, SECRET))).ok,
      ).toBe(false);
    });

    it("requires each provider's own header", () => {
      // A signature in the wrong header is not a signature.
      expect(
        verifyWebhookSignature(
          "razorpay",
          BODY,
          headers(sign(BODY), "stripe-signature"),
        ).ok,
      ).toBe(false);
    });
  });

  describe("the provider allowlist", () => {
    it("names only providers this deployment will accept", () => {
      expect(isKnownProvider("razorpay")).toBe(true);
      expect(isKnownProvider("instamojo")).toBe(true);
      expect(isKnownProvider("stripe")).toBe(true);
      expect(isKnownProvider("")).toBe(false);
      expect(isKnownProvider("__proto__")).toBe(false);
      expect(isKnownProvider("constructor")).toBe(false);
    });
  });
});
