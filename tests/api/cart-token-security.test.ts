import { describe, it, expect, beforeAll } from "@jest/globals";

/**
 * Security regression tests for the patient cart access token.
 *
 * These exist because `/api/cart/[assessmentId]` was public: the assessment
 * cuid alone returned the patient's name and phone number. The properties
 * asserted below are the ones that made that a vulnerability, so each test
 * here should be read as "this is the thing that must never come back".
 *
 * Pure token-layer tests — no database, no HTTP. The route wiring is asserted
 * separately by reading the handler's access contract; what is proven here is
 * that the primitive the route depends on cannot be tricked.
 */

// Deterministic secret so signatures are reproducible across runs. Must be set
// before the module is imported, because the dev-fallback branch reads
// process.env at call time and we want the explicit path under test.
beforeAll(() => {
  process.env.CART_TOKEN_SECRET = "test-only-cart-secret";
});
process.env.CART_TOKEN_SECRET = "test-only-cart-secret";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { signCartToken, verifyCartToken } = require("../../apps/patient-portal/src/lib/cartToken") as typeof import("../../apps/patient-portal/src/lib/cartToken");

const ASSESSMENT_A = "cl_assessment_aaaaaaaaaaaaaaaa";
const ASSESSMENT_B = "cl_assessment_bbbbbbbbbbbbbbbb";

describe("cart access token", () => {
  describe("the happy path a patient actually takes", () => {
    it("accepts a freshly minted token for its own assessment", () => {
      const token = signCartToken(ASSESSMENT_A);
      const result = verifyCartToken(token, ASSESSMENT_A);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.assessmentId).toBe(ASSESSMENT_A);
        expect(result.expiresAt).toBeGreaterThan(Date.now());
      }
    });
  });

  describe("assessment binding — the core of the fix", () => {
    it("REJECTS assessment A's token presented for assessment B", () => {
      const tokenForA = signCartToken(ASSESSMENT_A);
      const result = verifyCartToken(tokenForA, ASSESSMENT_B);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("ASSESSMENT_MISMATCH");
    });

    it("rejects even though A's signature is genuine", () => {
      // Guards against a future refactor that splits "is the signature valid"
      // from "is it for this record" and forgets to call the second half.
      const tokenForA = signCartToken(ASSESSMENT_A);
      expect(verifyCartToken(tokenForA, ASSESSMENT_A).ok).toBe(true);
      expect(verifyCartToken(tokenForA, ASSESSMENT_B).ok).toBe(false);
    });
  });

  describe("forgery", () => {
    it("rejects a token with a tampered payload but a stale signature", () => {
      const token = signCartToken(ASSESSMENT_A);
      const [, sig] = token.split(".");
      const forgedBody = Buffer.from(
        JSON.stringify({ a: ASSESSMENT_B, e: Date.now() + 60_000, p: "cart.v1" }),
      )
        .toString("base64")
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
      const result = verifyCartToken(`${forgedBody}.${sig}`, ASSESSMENT_B);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("INVALID_SIGNATURE");
    });

    it("rejects an unsigned payload", () => {
      const body = Buffer.from(
        JSON.stringify({ a: ASSESSMENT_A, e: Date.now() + 60_000, p: "cart.v1" }),
      ).toString("base64url");
      expect(verifyCartToken(`${body}.`, ASSESSMENT_A).ok).toBe(false);
      expect(verifyCartToken(body, ASSESSMENT_A).ok).toBe(false);
    });

    it("rejects garbage and empty input without throwing", () => {
      for (const bad of ["", ".", "..", "not-a-token", "a.b.c", "!!!.???"]) {
        const result = verifyCartToken(bad, ASSESSMENT_A);
        expect(result.ok).toBe(false);
      }
    });

    it("rejects a token signed with a different secret", () => {
      const token = signCartToken(ASSESSMENT_A);
      const original = process.env.CART_TOKEN_SECRET;
      process.env.CART_TOKEN_SECRET = "a-completely-different-secret";
      try {
        const result = verifyCartToken(token, ASSESSMENT_A);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBe("INVALID_SIGNATURE");
      } finally {
        process.env.CART_TOKEN_SECRET = original;
      }
    });
  });

  describe("expiry", () => {
    it("rejects an expired token", () => {
      const token = signCartToken(ASSESSMENT_A, -1000); // already past
      const result = verifyCartToken(token, ASSESSMENT_A);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("EXPIRED");
    });

    it("reports expiry rather than silently accepting a valid signature", () => {
      const token = signCartToken(ASSESSMENT_A, -1);
      const result = verifyCartToken(token, ASSESSMENT_A);
      expect(result.ok).toBe(false);
    });
  });

  describe("cross-surface replay", () => {
    it("REJECTS a review token replayed as a cart token", () => {
      // Both surfaces may share REVIEW_TOKEN_SECRET. Domain separation in the
      // key derivation is what stops one token opening the other's data.
      process.env.REVIEW_TOKEN_SECRET = "test-only-cart-secret";
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { signReviewToken } = require("../../apps/patient-portal/src/lib/reviewToken") as typeof import("../../apps/patient-portal/src/lib/reviewToken");
      const reviewToken = signReviewToken(ASSESSMENT_A);
      const result = verifyCartToken(reviewToken, ASSESSMENT_A);
      expect(result.ok).toBe(false);
    });
  });

  describe("payload hygiene", () => {
    it("carries no patient PII — only id, expiry and purpose", () => {
      const token = signCartToken(ASSESSMENT_A);
      const [body] = token.split(".");
      const decoded = JSON.parse(
        Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
      );
      expect(Object.keys(decoded).sort()).toEqual(["a", "e", "p"]);
      // Nothing resembling a name, phone, order or clinic may appear.
      const asText = JSON.stringify(decoded).toLowerCase();
      for (const forbidden of ["name", "phone", "email", "clinic", "order", "kit"]) {
        expect(asText).not.toContain(forbidden);
      }
    });

    it("is high entropy — distinct tokens for distinct assessments", () => {
      const a = signCartToken(ASSESSMENT_A);
      const b = signCartToken(ASSESSMENT_B);
      expect(a).not.toEqual(b);
      expect(a.split(".")[1]).not.toEqual(b.split(".")[1]);
    });
  });
});
