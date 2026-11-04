// Resolve the dashboard's date filter into a concrete [from, to) instant
// window, in the platform's timezone.
//
// The Super Admin has no clinic, so there is no clinic timezone to read; the
// platform default (Asia/Kolkata, the value every Clinic.timezone defaults to)
// is used so "today" means the operator's today, not UTC's.

import { todayKey, nextDay, zonedWallTimeToUtc, dayLabel } from "@/lib/format/clinicDay";
import type { TimeWindow } from "./types";

const PLATFORM_TZ = "Asia/Kolkata";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD day key, or null if the input is absent/malformed. */
function normalizeDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.slice(0, 10);
  return DAY_RE.test(trimmed) ? trimmed : null;
}

/** `day` shifted by `n` days (pure label arithmetic, matching nextDay). */
function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** The named period presets the dashboard offers. */
export type RangePreset = "today" | "7d" | "30d" | "all";

const RANGE_VALUES: RangePreset[] = ["today", "7d", "30d", "all"];

/** A YYYY-MM-DD so early that an "all time" window includes every real row. */
const ALL_TIME_FLOOR = "2000-01-01";

/**
 * Resolve a named preset — Today, Last 7 days, Last 30 days or All time — into
 * a concrete [from, to) instant window in Asia/Kolkata. The windowed KPI
 * figures are labelled with this period; "All time" makes them equal the
 * all-time totals so the two columns reconcile.
 */
export function resolveRange(range: RangePreset): TimeWindow {
  const today = todayKey(PLATFORM_TZ);
  const toIso = zonedWallTimeToUtc(nextDay(today), "00:00", PLATFORM_TZ).toISOString();
  if (range === "all") {
    return {
      fromIso: zonedWallTimeToUtc(ALL_TIME_FLOOR, "00:00", PLATFORM_TZ).toISOString(),
      toIso,
      label: "All time",
    };
  }
  const span = range === "7d" ? 7 : range === "30d" ? 30 : 1;
  if (span === 1) return resolveWindow(today, today);
  const lo = addDays(today, -(span - 1));
  return {
    fromIso: zonedWallTimeToUtc(lo, "00:00", PLATFORM_TZ).toISOString(),
    toIso,
    label: range === "7d" ? "Last 7 days" : "Last 30 days",
  };
}

/** Parse a `range` query param; null/unknown falls through to from/to handling. */
export function parseRange(value: string | null | undefined): RangePreset | null {
  return value && (RANGE_VALUES as string[]).includes(value) ? (value as RangePreset) : null;
}

/**
 * Build the window from optional `from`/`to` day params (YYYY-MM-DD, inclusive
 * of both days, interpreted in Asia/Kolkata). With neither, the window is
 * today. A one-sided range anchors the open end to today.
 */
export function resolveWindow(
  fromParam?: string | null,
  toParam?: string | null,
): TimeWindow {
  const today = todayKey(PLATFORM_TZ);
  const fromDay = normalizeDay(fromParam) ?? (toParam ? today : today);
  const toDay = normalizeDay(toParam) ?? fromDay;

  // Guard against a reversed range by swapping rather than erroring.
  const [lo, hi] = fromDay <= toDay ? [fromDay, toDay] : [toDay, fromDay];

  const fromIso = zonedWallTimeToUtc(lo, "00:00", PLATFORM_TZ).toISOString();
  // Exclusive upper bound = start of the day AFTER the last included day.
  const toIso = zonedWallTimeToUtc(nextDay(hi), "00:00", PLATFORM_TZ).toISOString();

  const label =
    lo === hi
      ? lo === today
        ? "Today"
        : dayLabel(lo)
      : `${dayLabel(lo)} – ${dayLabel(hi)}`;

  return { fromIso, toIso, label };
}
