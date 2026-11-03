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
