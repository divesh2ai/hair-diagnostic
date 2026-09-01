// The low-volume comparison rule.
//
// The dashboard could render "+450%" from eleven assessments against a base of
// two. These cases lock the presentation decision that replaced it, including
// the ones that used to produce a number the data could not support.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/admin/growth-display.test.ts

import { describe, it, expect } from "@jest/globals";
import {
  growthDisplay,
  conversionPercent,
  LOW_BASE_THRESHOLD,
} from "@/lib/admin/growth";

describe("growthDisplay — the low-base rule", () => {
  it("leads with the percentage at a normal baseline", () => {
    // 120 previous is comfortably above the threshold: one more assessment
    // moves this by well under a point, so the percentage is stable enough to
    // be the headline.
    const g = growthDisplay({ current: 138, previous: 120, unit: "assessment" });
    expect(g.percentIsPrimary).toBe(true);
    expect(g.lowBase).toBe(false);
    expect(g.primary).toBe("+15%");
    // The absolute change is still shown — a percentage without its magnitude
    // is only half the story.
    expect(g.secondary).toBe("+18 assessments vs previous period");
    expect(g.delta).toBe(18);
  });

  it("leads with the absolute change at a small baseline", () => {
    // The case that started this: +450% is arithmetically right and says
    // nothing an operator can use.
    const g = growthDisplay({ current: 11, previous: 2, unit: "assessment" });
    expect(g.lowBase).toBe(true);
    expect(g.percentIsPrimary).toBe(false);
    expect(g.primary).toBe("+9 assessments");
    // The percentage survives as context, next to the denominator that makes
    // it readable.
    expect(g.percent).toBe(450);
    expect(g.secondary).toBe("+450% · previous period: 2");
  });

  it("puts the threshold where one event moves the percentage ten points", () => {
    // Exactly at the threshold the percentage is allowed to lead; one below it
    // is not. Stated as a test so the boundary cannot drift silently.
    expect(growthDisplay({ current: 12, previous: LOW_BASE_THRESHOLD }).percentIsPrimary).toBe(
      true,
    );
    expect(
      growthDisplay({ current: 12, previous: LOW_BASE_THRESHOLD - 1 }).percentIsPrimary,
    ).toBe(false);
  });

  it("never invents a percentage when the previous period is zero", () => {
    const g = growthDisplay({ current: 12, previous: 0, unit: "assessment" });
    // Not 100, not Infinity, not "∞%". There is no percentage change from
    // nothing, and the old API branch returned 100 as though there were.
    expect(g.percent).toBeNull();
    expect(g.primary).toBe("+12 assessments");
    expect(g.secondary).toBe("No assessments in previous period");
    expect(g.delta).toBe(12);
  });

  it("reports a neutral comparison when both periods are empty", () => {
    const g = growthDisplay({ current: 0, previous: 0, unit: "assessment" });
    expect(g.delta).toBe(0);
    expect(g.percent).toBeNull();
    // Explicitly not growth. The old formula returned 0%, which reads as a
    // measured flat period rather than as an absence of data.
    expect(g.primary).toBe("±0 assessments");
    expect(g.secondary).toBe("No activity in either period");
    expect(g.sentiment).toBe("neutral");
  });

  it("distinguishes unchanged-but-active from no-activity", () => {
    const g = growthDisplay({ current: 4, previous: 4, unit: "assessment" });
    expect(g.primary).toBe("±0 assessments");
    expect(g.secondary).toBe("Unchanged · previous period: 4");
  });
});

describe("growthDisplay — declines", () => {
  it("leads with the absolute drop at a small baseline", () => {
    const g = growthDisplay({ current: 1, previous: 4, unit: "assessment" });
    expect(g.percentIsPrimary).toBe(false);
    // −3 assessments is the fact; −75% is the same fact dressed as a crisis.
    expect(g.primary).toBe("−3 assessments");
    expect(g.secondary).toBe("−75% · previous period: 4");
  });

  it("leads with the percentage on a decline at a normal baseline", () => {
    const g = growthDisplay({ current: 80, previous: 100, unit: "assessment" });
    expect(g.percentIsPrimary).toBe(true);
    expect(g.primary).toBe("−20%");
    expect(g.secondary).toBe("−20 assessments vs previous period");
  });
});

describe("growthDisplay — sentiment follows meaning, not sign", () => {
  it("treats a drop in a higher-is-better metric as bad", () => {
    expect(
      growthDisplay({ current: 10, previous: 20, direction: "higherIsBetter" })
        .sentiment,
    ).toBe("bad");
  });

  it("treats a drop in a lower-is-better metric as good", () => {
    // Fewer failed assessments is a better week, and colouring it red because
    // the number went down would invert the message.
    expect(
      growthDisplay({ current: 1, previous: 9, direction: "lowerIsBetter" })
        .sentiment,
    ).toBe("good");
  });

  it("makes no colour claim for a metric that is merely scale", () => {
    // The default. More patients on the platform is not a success to
    // celebrate in green, and fewer is not an alert.
    expect(growthDisplay({ current: 50, previous: 10 }).sentiment).toBe("neutral");
    expect(growthDisplay({ current: 10, previous: 50 }).sentiment).toBe("neutral");
  });

  it("stays neutral when nothing changed, whatever the direction", () => {
    expect(
      growthDisplay({ current: 7, previous: 7, direction: "higherIsBetter" })
        .sentiment,
    ).toBe("neutral");
  });
});

describe("conversionPercent — the funnel uses the same threshold", () => {
  it("returns a rate once the base is large enough to support one", () => {
    expect(conversionPercent(15, 30)).toBe(50);
  });

  it("suppresses the rate below the threshold", () => {
    expect(conversionPercent(2, 3)).toBeNull();
  });

  it("never divides by zero into a fabricated rate", () => {
    // The previous funnel used Math.max(1, base), which turned an empty
    // preceding stage into a percentage of the numerator — 3 of 0 read as 300%.
    expect(conversionPercent(3, 0)).toBeNull();
  });
});
