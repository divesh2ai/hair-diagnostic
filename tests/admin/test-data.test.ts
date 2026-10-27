import { describe, it, expect } from "vitest";
import {
  classifyClinicDataClass,
  isConfirmedTest,
  tallyDataClasses,
} from "@/lib/admin/testData";

// The fixtures below are the ACTUAL staging clinic identities (name/slug/id) as
// of the P0 audit, so the classifier is tested against the real rows it has to
// separate — not a convenient invention.
const STAGING = [
  { id: "cmsuip5jk0000u6hz3hqduv8y", name: "DrFACT Mumbai Test Clinic", slug: "drfact-mumbai-test" },
  { id: "staging-qa-clinic-b", name: "DrFACT Pune Test Clinic", slug: "drfact-pune-test" },
  { id: "cmt74rliq0002246pswtdxyyj", name: "DrFACT Mumbai", slug: "drfact-mumbai" },
  { id: "cmtihpixo00012blsokqnnwli", name: "GH Derma Center", slug: "gh-derma-center" },
  { id: "cmtihpj2600072blsd5grsoe3", name: "Radiance Skin Hair Cosmetic Center", slug: "radiance-skin-hair-cosmetic-center" },
  { id: "cmtihpjap000d2blspalc04kt", name: "Reniu Clinic", slug: "reniu-clinic" },
  { id: "cdfc6cf3c33d1776b06c3f66e", name: "Acube Aesthetics", slug: "acube-aesthetics" },
];

describe("classifyClinicDataClass — explicit markers only", () => {
  it("marks a clinic TEST on a whole 'test' token in the slug", () => {
    const r = classifyClinicDataClass(STAGING[0]!);
    expect(r.dataClass).toBe("test");
    expect(r.signals.join(" ")).toContain('token "test"');
  });

  it("marks a clinic TEST on a seeded QA id prefix", () => {
    const r = classifyClinicDataClass(STAGING[1]!);
    expect(r.dataClass).toBe("test");
    expect(r.signals.join(" ")).toContain('id prefix "staging-qa-"');
  });

  it("marks a first-party brand with NO test token UNCERTAIN, never TEST", () => {
    const r = classifyClinicDataClass(STAGING[2]!); // DrFACT Mumbai
    expect(r.dataClass).toBe("uncertain");
    expect(r.signals.join(" ")).toContain("first-party brand");
  });

  it("marks a third-party practice name REAL", () => {
    for (const c of STAGING.slice(3)) {
      expect(classifyClinicDataClass(c).dataClass).toBe("real");
    }
  });
});

describe("no substring false positives", () => {
  it("does not treat 'latest' or 'contest' as a test marker", () => {
    expect(
      classifyClinicDataClass({ id: "x", name: "Latest Contest Skin Clinic", slug: "latest-contest-skin-clinic" }).dataClass,
    ).toBe("real");
  });

  it("does not treat an embedded 'qa' (e.g. 'aqua') as QA", () => {
    expect(
      classifyClinicDataClass({ id: "x", name: "Aqua Derma", slug: "aqua-derma" }).dataClass,
    ).toBe("real");
  });

  it("DOES catch 'qa' as a standalone token", () => {
    expect(
      classifyClinicDataClass({ id: "x", name: "QA Clinic", slug: "qa-clinic" }).dataClass,
    ).toBe("test");
  });
});

describe("tally + isConfirmedTest over the real staging set", () => {
  it("splits the sample into 2 test, 1 uncertain, 4 real", () => {
    expect(tallyDataClasses(STAGING)).toEqual({ real: 4, test: 2, uncertain: 1 });
  });

  it("isConfirmedTest is true only for the explicit test rows", () => {
    expect(STAGING.filter(isConfirmedTest).map((c) => c.slug)).toEqual([
      "drfact-mumbai-test",
      "drfact-pune-test",
    ]);
  });
});
