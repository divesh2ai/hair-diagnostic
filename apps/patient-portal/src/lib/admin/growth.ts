// How a period-over-period comparison is presented.
//
// ── The problem ─────────────────────────────────────────────────────────────
// The dashboard could render "+450%". The arithmetic was right and the claim
// was useless: it came from 11 assessments this month against 2 in the same
// slice of last month. At this network's scale a single assessment moves the
// percentage by tens of points, so the figure reads as explosive growth when
// what actually happened is nine extra patients.
//
// The raw counts are not the problem and are not touched here. What was wrong
// was choosing percentage as the headline for a sample that cannot support one.
//
// ── The rule ────────────────────────────────────────────────────────────────
// A percentage is only worth leading with when one more event does not move it
// much. Take "much" to be ten percentage points — the granularity at which an
// operator would read a different story — and the condition is:
//
//     1 / previous ≤ 0.10   ⟺   previous ≥ 10
//
// So LOW_BASE_THRESHOLD is 10, derived rather than picked: below it, a single
// row swings the headline by more than ten points.
//
// Measured against this platform on 2026-09-01: 32 assessments all time, 22 in
// the last 30 days, 1 in the last 7. Every comparison the dashboard can
// currently draw sits under the threshold, which is exactly the finding — the
// percentage was never the honest headline, and this rule says so out loud
// instead of waiting for the network to grow into it.
//
// Nothing here queries or writes anything. It is a pure presentation decision
// over two numbers the API already returns.

/**
 * Below this many events in the previous period, one event moves the
 * percentage by more than ten points, so the absolute change leads instead.
 */
export const LOW_BASE_THRESHOLD = 10;

/**
 * What a metric's direction means operationally.
 *
 * Sign alone cannot colour a comparison. Fewer failed assessments is a good
 * week; fewer assessments arriving is a bad one. `higherIsBetter` says which
 * of the two a metric is, and `neutral` covers counts that are simply scale
 * — patients on the platform going up is not a success to celebrate in green.
 */
export type MetricDirection = "higherIsBetter" | "lowerIsBetter" | "neutral";

/** Semantic reading of the change, for callers choosing a tone. */
export type GrowthSentiment = "good" | "bad" | "neutral";

export interface GrowthInput {
  current: number;
  previous: number;
  /**
   * Singular noun for the thing being counted, e.g. "assessment". Used to
   * build "+9 assessments". Omit for a bare "+9".
   */
  unit?: string;
  /** Defaults to `neutral`: no colour claim unless a caller makes one. */
  direction?: MetricDirection;
}

export interface GrowthDisplay {
  /** current − previous. Always defined; this is the number that is real. */
  delta: number;
  /**
   * Rounded percentage change, or `null` when previous is 0 — there is no
   * percentage change from nothing, and 100% / ∞ would both be inventions.
   */
  percent: number | null;
  /** True when the previous period is too small for a percentage to lead. */
  lowBase: boolean;
  /** True only when the percentage is meaningful enough to be the headline. */
  percentIsPrimary: boolean;
  /** The headline string, e.g. "+9 assessments" or "+18%". */
  primary: string;
  /**
   * The supporting line, always naming the comparison basis so the reader can
   * judge the headline: "+450% vs previous period", "Previous period: 2",
   * "No assessments in previous period".
   */
  secondary: string;
  /** Whether this change is good, bad or merely a change. */
  sentiment: GrowthSentiment;
}

function plural(n: number, unit: string): string {
  return `${Math.abs(n)} ${unit}${Math.abs(n) === 1 ? "" : "s"}`;
}

/**
 * Typographic minus (U+2212), not a hyphen. The delta labels already use it,
 * and "+9 assessments" beside "-450%" put two different glyphs for the same
 * idea in one card. It also aligns to the same width as "+" under tabular-nums,
 * which a hyphen does not.
 */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : `${n}`;
}

/**
 * Decide how to present one period-over-period comparison.
 *
 * Pure. No clock, no fetch, no rounding of the underlying counts — `delta` is
 * always the exact arithmetic difference, and only the percentage is rounded.
 */
export function growthDisplay({
  current,
  previous,
  unit,
  direction = "neutral",
}: GrowthInput): GrowthDisplay {
  const delta = current - previous;

  // No percentage exists when the base is zero. The old dashboard substituted
  // 100 here, which asserted a measured doubling that never happened.
  const percent =
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  const lowBase = previous < LOW_BASE_THRESHOLD;
  const percentIsPrimary = percent !== null && !lowBase;

  const deltaLabel = unit
    ? `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${plural(delta, unit)}`
    : delta === 0
      ? "±0"
      : signed(delta);

  const primary = percentIsPrimary ? `${signed(percent!)}%` : deltaLabel;

  let secondary: string;
  if (previous === 0 && current === 0) {
    // Nothing either side. Explicitly not growth, and explicitly not a decline.
    secondary = "No activity in either period";
  } else if (previous === 0) {
    secondary = unit
      ? `No ${unit}s in previous period`
      : "Nothing in previous period";
  } else if (percentIsPrimary) {
    // Percentage led, so the absolute change is what the reader still needs.
    secondary = `${deltaLabel} vs previous period`;
  } else if (Math.abs(delta) === 0) {
    secondary = `Unchanged · previous period: ${previous}`;
  } else {
    // Low base: the percentage survives only as context, alongside the
    // denominator that makes it interpretable.
    secondary = `${signed(percent!)}% · previous period: ${previous}`;
  }

  let sentiment: GrowthSentiment = "neutral";
  if (delta !== 0 && direction !== "neutral") {
    const better = direction === "higherIsBetter" ? delta > 0 : delta < 0;
    sentiment = better ? "good" : "bad";
  }

  return {
    delta,
    percent,
    lowBase,
    percentIsPrimary,
    primary,
    secondary,
    sentiment,
  };
}

/**
 * Should a stage-conversion percentage be shown at all?
 *
 * The conversion funnel divides each stage by the one before it. That is a
 * ratio, not period-over-period growth, but it fails at small samples for the
 * same reason, and the previous code guarded division with `Math.max(1, prev)`
 * — which turns a zero base into a fabricated percentage of the numerator.
 * Same threshold, same principle: below it, show the counts and say nothing
 * about the rate.
 */
export function conversionPercent(
  count: number,
  base: number,
): number | null {
  if (base < LOW_BASE_THRESHOLD) return null;
  return Math.round((count / base) * 100);
}
