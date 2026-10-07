import { describe, it, expect } from "vitest";
import {
  verticalForConcern,
  isHairOsConcern,
  isSkinFactConcern,
} from "@/lib/verticals";
import {
  getProtocolForConcern,
  getDefaultProtocol,
  loadProtocol,
  UnsupportedProtocolError,
} from "@/runtime/protocolLoader";
import { reviewHref, isReviewUnavailable } from "@/lib/doctor/reviewHref";

// ─────────────────────────────────────────────────────────────────────────────
// Vertical discriminator — HairOS vs Skin FACT, derived from `__meta.concern`.
// ─────────────────────────────────────────────────────────────────────────────
describe("verticalForConcern", () => {
  it("classifies hair and legacy/absent concerns as HAIROS", () => {
    for (const c of ["hair", null, undefined, ""] as const) {
      expect(verticalForConcern(c)).toBe("HAIROS");
      expect(isHairOsConcern(c)).toBe(true);
      expect(isSkinFactConcern(c)).toBe(false);
    }
  });

  it("classifies every skin_* concern as SKIN_FACT (including unknown tracks)", () => {
    for (const c of [
      "skin_acne",
      "skin_pigmentation",
      "skin_anti_ageing",
      "skin_rosacea", // a track that does not exist yet
    ]) {
      expect(verticalForConcern(c)).toBe("SKIN_FACT");
      expect(isSkinFactConcern(c)).toBe(true);
      expect(isHairOsConcern(c)).toBe(false);
    }
  });

  it("a non-skin unknown value does NOT accidentally become Skin FACT", () => {
    expect(verticalForConcern("dermatology")).toBe("HAIROS");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// protocolLoader — a Skin FACT concern must never inherit the hair protocol.
// ─────────────────────────────────────────────────────────────────────────────
describe("protocolLoader vertical boundary", () => {
  const hairProtocol = getDefaultProtocol();

  it("hair loads the HairOS protocol", () => {
    expect(getProtocolForConcern("hair").length).toBeGreaterThan(0);
    expect(getProtocolForConcern("hair")).toBe(hairProtocol); // cached, same ref
  });

  it("skin_acne loads its own protocol, distinct from the hair protocol", () => {
    const acne = getProtocolForConcern("skin_acne");
    expect(acne.length).toBeGreaterThan(0);
    expect(acne).not.toBe(hairProtocol);
  });

  it("skin_pigmentation and skin_anti_ageing throw, never return hair", () => {
    for (const c of ["skin_pigmentation", "skin_anti_ageing"] as const) {
      expect(() => getProtocolForConcern(c)).toThrow(UnsupportedProtocolError);
    }
  });

  it("REGRESSION: an unknown skin_* track throws instead of silently returning hair", () => {
    // The old switch had `default -> hair`, so a skin track with no explicit
    // case inherited the hair questionnaire. It must now be refused.
    expect(() => getProtocolForConcern("skin_rosacea" as never)).toThrow(
      UnsupportedProtocolError,
    );
  });

  it("the thrown error carries the concern and its vertical", () => {
    try {
      getProtocolForConcern("skin_pigmentation");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedProtocolError);
      const e = err as UnsupportedProtocolError;
      expect(e.concern).toBe("skin_pigmentation");
      expect(e.vertical).toBe("SKIN_FACT");
    }
  });

  it("loadProtocol(default) propagates the guard for unsupported skin concerns", () => {
    expect(() => loadProtocol("default", undefined, "skin_anti_ageing")).toThrow(
      UnsupportedProtocolError,
    );
    expect(loadProtocol("default", undefined, "hair").questions.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reviewHref — routing stays on the shared discriminator (no drift).
// ─────────────────────────────────────────────────────────────────────────────
describe("reviewHref routing by vertical", () => {
  it("routes pigmentation / anti-ageing to their dedicated skin surfaces", () => {
    expect(reviewHref({ id: "a1", concern: "skin_pigmentation" })).toBe(
      "/doctor/reports/a1/skin/pigmentation",
    );
    expect(reviewHref({ id: "a2", concern: "skin_anti_ageing" })).toBe(
      "/doctor/reports/a2/skin/anti-ageing",
    );
  });

  it("routes a skin concern with no surface (acne, unknown) to the holding page, never the hair consultation", () => {
    for (const c of ["skin_acne", "skin_rosacea"]) {
      expect(reviewHref({ id: "a3", concern: c })).toBe(
        "/doctor/reports/a3/skin/review-unavailable",
      );
      expect(isReviewUnavailable(c)).toBe(true);
    }
  });

  it("routes hair / legacy rows to the hair consultation", () => {
    expect(reviewHref({ id: "a4", concern: "hair" })).toBe("/doctor/reports/a4");
    expect(reviewHref({ id: "a5", concern: null })).toBe("/doctor/reports/a5");
    expect(isReviewUnavailable("hair")).toBe(false);
    expect(isReviewUnavailable(null)).toBe(false);
  });
});
