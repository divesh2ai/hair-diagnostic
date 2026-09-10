import { describe, it, expect, beforeAll } from "vitest";

/**
 * Security regression tests for the patient REPORT share token.
 *
 * The object behind this token is the clinical record, so each test below
 * should be read as "this is the thing that must never come back". They are
 * pure token-layer tests — no database, no HTTP; what is proven here is that
 * the primitive the patient report page depends on cannot be tricked.
 */

// Deterministic secrets so signatures are reproducible. Set before the modules
// are imported, because the dev-fallback branch reads process.env at call time
// and the explicit path is the one under test.
//
// The two surfaces share ONE secret on purpose here: that is the worst case for
// domain separation, and it is the configuration a deployment gets by default
// when only REVIEW_TOKEN_SECRET is set. If the tokens are separable under a
// shared secret, they are separable under separate ones.
process.env.REPORT_SHARE_TOKEN_SECRET = "test-only-shared-secret";
process.env.CART_TOKEN_SECRET = "test-only-shared-secret";
beforeAll(() => {
  process.env.REPORT_SHARE_TOKEN_SECRET = "test-only-shared-secret";
  process.env.CART_TOKEN_SECRET = "test-only-shared-secret";
});

import {
  signReportShareToken,
  verifyReportShareToken,
  patientReportHref,
} from "@/lib/reportShareToken";
import { signCartToken, verifyCartToken } from "@/lib/cartToken";

const ASSESSMENT_A = "cl_assessment_aaaaaaaaaaaaaaaa";
const ASSESSMENT_B = "cl_assessment_bbbbbbbbbbbbbbbb";

describe("patient report share token", () => {
  describe("the happy path a patient actually takes", () => {
    it("opens the assessment it was minted for", () => {
      const token = signReportShareToken(ASSESSMENT_A);
      const result = verifyReportShareToken(token);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.assessmentId).toBe(ASSESSMENT_A);
        expect(result.expiresAt).toBeGreaterThan(Date.now());
      }
    });

    it("names the assessment itself, so no second claim can disagree with it", () => {
      // This is the structural property the URL shape buys: a caller cannot
      // present A's token "for" B, because the request has nowhere to say B.
      const tokenA = signReportShareToken(ASSESSMENT_A);
      const tokenB = signReportShareToken(ASSESSMENT_B);

      const a = verifyReportShareToken(tokenA);
      const b = verifyReportShareToken(tokenB);
      expect(a.ok && a.assessmentId).toBe(ASSESSMENT_A);
      expect(b.ok && b.assessmentId).toBe(ASSESSMENT_B);
      expect(tokenA).not.toBe(tokenB);
    });
  });

  describe("domain separation — a token opens one surface and no other", () => {
    it("REJECTS a cart token presented as a report token", () => {
      const cartToken = signCartToken(ASSESSMENT_A);
      const result = verifyReportShareToken(cartToken);
      expect(result.ok).toBe(false);
      // The key label makes the SIGNATURES differ, so this fails before the
      // purpose field is even read. Either rejection is correct; what must
      // never happen is `ok: true`.
      if (!result.ok) {
        expect(["INVALID_SIGNATURE", "WRONG_PURPOSE"]).toContain(result.error);
      }
    });

    it("REJECTS a report token presented as a cart token", () => {
      const reportToken = signReportShareToken(ASSESSMENT_A);
      const result = verifyCartToken(reportToken, ASSESSMENT_A);
      expect(result.ok).toBe(false);
    });
  });

  describe("tampering", () => {
    it("REJECTS a token whose payload was edited to name another assessment", () => {
      const token = signReportShareToken(ASSESSMENT_A);
      const [, sig] = token.split(".");

      const forgedPayload = Buffer.from(
        JSON.stringify({ a: ASSESSMENT_B, e: Date.now() + 60_000, p: "report.v1" }),
      )
        .toString("base64")
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      const result = verifyReportShareToken(`${forgedPayload}.${sig}`);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("INVALID_SIGNATURE");
    });

    it("REJECTS a token with a flipped signature byte", () => {
      const token = signReportShareToken(ASSESSMENT_A);
      const [body, sig] = token.split(".");
      const flipped = sig.slice(0, -1) + (sig.at(-1) === "a" ? "b" : "a");
      const result = verifyReportShareToken(`${body}.${flipped}`);
      expect(result.ok).toBe(false);
    });

    it("REJECTS structurally malformed input without throwing", () => {
      for (const bad of ["", ".", "a.b.c", "not-a-token", "....", "%%%.%%%"]) {
        const result = verifyReportShareToken(bad);
        expect(result.ok).toBe(false);
      }
    });
  });

  describe("expiry", () => {
    it("REJECTS a token past its expiry", () => {
      const expired = signReportShareToken(ASSESSMENT_A, -1000);
      const result = verifyReportShareToken(expired);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("EXPIRED");
    });

    it("reports EXPIRED distinctly, so a genuine holder can be told what to do", () => {
      // The page shows a specific "this link has expired" message for this one
      // error and a generic notice for every other failure — see
      // app/patient/report/[token]/page.tsx. That behaviour depends on the
      // error code being distinguishable here.
      const expired = signReportShareToken(ASSESSMENT_A, -1000);
      const forged = "garbage.garbage";
      const a = verifyReportShareToken(expired);
      const b = verifyReportShareToken(forged);
      expect(a.ok).toBe(false);
      expect(b.ok).toBe(false);
      if (!a.ok && !b.ok) expect(a.error).not.toBe(b.error);
    });
  });

  describe("what the token discloses on its own", () => {
    it("carries no patient name, phone, clinic or clinical content", () => {
      const token = signReportShareToken(ASSESSMENT_A);
      const [body] = token.split(".");
      const payload = JSON.parse(
        Buffer.from(
          body.replace(/-/g, "+").replace(/_/g, "/") +
            "==".slice(0, (4 - (body.length % 4)) % 4),
          "base64",
        ).toString("utf8"),
      );
      // Exactly three claims: assessment, expiry, purpose. A leaked token is
      // worthless without being presented to the server.
      expect(Object.keys(payload).sort()).toEqual(["a", "e", "p"]);
      expect(payload.p).toBe("report.v1");
    });
  });

  describe("the URL", () => {
    it("puts the token in the path and nothing else", () => {
      const token = signReportShareToken(ASSESSMENT_A);
      const href = patientReportHref(token);
      expect(href.startsWith("/patient/report/")).toBe(true);
      // No assessment id anywhere in the URL — a patient's record identifier
      // must not travel in a link, a referrer header, or browser history.
      expect(href).not.toContain(ASSESSMENT_A);
    });
  });
});
