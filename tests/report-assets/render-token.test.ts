import { describe, it, expect, beforeAll } from "vitest";

// The render worker's credential.
//
// ══ WHAT THIS PROTECTS ══════════════════════════════════════════════════════
//
// The renderer opens a page that shows a patient's clinical sheet with no
// session behind it. The only thing standing between that page and the
// internet is this token, so the properties below are not hygiene — they are
// the access control.

beforeAll(() => {
  process.env.RENDER_TOKEN_SECRET = "test-render-secret";
  process.env.CART_TOKEN_SECRET = "test-cart-secret";
  process.env.REPORT_SHARE_TOKEN_SECRET = "test-report-secret";
});

const { signRenderToken, verifyRenderToken, renderTargetHref } = await import(
  "@/lib/reports/assets/renderToken"
);
const { signCartToken } = await import("@/lib/cartToken");
const { signReportShareToken } = await import("@/lib/reportShareToken");

const SUBJECT = {
  assetId: "asset_1",
  consultationVersionId: "cv_1",
  type: "ONE_PAGER_PNG" as const,
};

describe("render token", () => {
  it("names the artefact it opens, and round-trips it", () => {
    const result = verifyRenderToken(signRenderToken(SUBJECT));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assetId).toBe("asset_1");
      expect(result.consultationVersionId).toBe("cv_1");
      expect(result.type).toBe("ONE_PAGER_PNG");
    }
  });

  it("carries no patient, clinic, assessment or URL in its payload", () => {
    // A token that named a destination would let its holder choose where the
    // browser goes. A token that named a patient would disclose one to anyone
    // who intercepted it.
    const token = signRenderToken(SUBJECT);
    const payload = JSON.parse(
      Buffer.from(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    );
    expect(Object.keys(payload).sort()).toEqual(["e", "i", "k", "p", "v"]);
  });

  it("expires in minutes, not days", () => {
    const result = verifyRenderToken(signRenderToken(SUBJECT));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ttlMs = result.expiresAt - Date.now();
      expect(ttlMs).toBeGreaterThan(0);
      expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000);
    }
  });

  it("refuses an expired token", () => {
    const expired = signRenderToken(SUBJECT, -1);
    expect(verifyRenderToken(expired)).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("refuses a tampered payload", () => {
    const token = signRenderToken(SUBJECT);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ i: "asset_OTHER", v: "cv_1", k: "ONE_PAGER_PNG", e: Date.now() + 60_000, p: "render.v1" }),
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(verifyRenderToken(`${forged}.${sig}`)).toEqual({
      ok: false,
      error: "INVALID_SIGNATURE",
    });
  });

  it("refuses a malformed token without throwing", () => {
    expect(verifyRenderToken("nonsense")).toEqual({ ok: false, error: "MALFORMED" });
    expect(verifyRenderToken("")).toEqual({ ok: false, error: "MALFORMED" });
  });

  // ── Domain separation ─────────────────────────────────────────────────────
  //
  // Three token surfaces exist and can be configured from one secret. A cart
  // token that opened a render target — or a render token that opened a
  // patient's report — would be a privilege escalation created by a shared
  // string rather than by a decision.
  it("does not accept a cart token", () => {
    const result = verifyRenderToken(signCartToken("assessment_1"));
    expect(result.ok).toBe(false);
  });

  it("does not accept a patient report share token", () => {
    const result = verifyRenderToken(signReportShareToken("assessment_1"));
    expect(result.ok).toBe(false);
  });

  it("builds one, unambiguous target path", () => {
    expect(renderTargetHref("abc.def")).toBe("/internal/render/one-pager/abc.def");
  });
});
