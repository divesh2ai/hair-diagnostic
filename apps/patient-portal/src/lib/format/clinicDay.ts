// Calendar arithmetic in the CLINIC's timezone, not the browser's and not UTC.
//
// A doctor in Mumbai looking at "19 August" means 19 August in Asia/Kolkata.
// Every assessment timestamp is stored UTC, so an assessment submitted at
// 23:40 IST lands on 18 August in UTC. Bucketing by `toISOString().slice(0,10)`
// would file that patient under the previous day — quietly, and only for
// evening appointments, which is the worst kind of wrong.
//
// So there is exactly one notion of "which day is this" in the calendar, and
// it lives here: `dayKey(instant, timeZone)`. Both the server (bucketing rows)
// and the client (rendering the grid) call it, so a day cell and its detail
// panel can never disagree about what belongs in it.
//
// Everything is built on Intl rather than a date library. The zone database
// ships with the runtime, it is correct about DST without a dependency, and
// the two operations we need — "what wall clock does this instant show" and
// its inverse — are both short.

/** `YYYY-MM-DD`, as read off a wall clock in `timeZone`. */
export type DayKey = string;

/** `YYYY-MM`. */
export type MonthKey = string;

const DAY_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = DAY_FORMATTERS.get(timeZone);
  if (!f) {
    // en-CA formats as YYYY-MM-DD, which is the key format we want verbatim.
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    DAY_FORMATTERS.set(timeZone, f);
  }
  return f;
}

/** Which clinic-local day an instant falls on. */
export function dayKey(instant: Date | string | number, timeZone: string): DayKey {
  const d = instant instanceof Date ? instant : new Date(instant);
  return dayFormatter(timeZone).format(d);
}

/** Today, in the clinic's timezone — not the viewer's. */
export function todayKey(timeZone: string): DayKey {
  return dayKey(new Date(), timeZone);
}

/**
 * Offset of `timeZone` from UTC at a given instant, in milliseconds.
 *
 * Read the instant's wall clock in the zone, reinterpret those numbers as if
 * they were UTC, and subtract. The gap is the offset in force at that moment,
 * which is what makes this DST-correct rather than assuming a fixed number.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const at = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    // Some ICU builds render midnight as hour 24 under hour12:false.
    at("hour") % 24,
    at("minute"),
    at("second"),
  );
  return asIfUtc - instant.getTime();
}

/**
 * The UTC instant at which the clinic's wall clock reads `dayKey` `hhmm`.
 *
 * Solved by fixed point: guess that the wall time IS UTC, measure the zone
 * offset at that guess, correct, and repeat once. Two passes is enough for any
 * real zone — the second only matters when the first guess landed on the far
 * side of a DST transition from the answer.
 *
 * Ambiguous local times (the hour a DST fall-back repeats) resolve to one of
 * the two instants rather than erroring. Asia/Kolkata has no DST, so this
 * never fires for the clinics on the platform today; it is written this way so
 * that a clinic in a DST zone does not silently book people an hour off.
 */
export function zonedWallTimeToUtc(
  day: DayKey,
  hhmm: string,
  timeZone: string,
): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0, 0);

  let guess = new Date(wallAsUtc);
  for (let i = 0; i < 2; i++) {
    guess = new Date(wallAsUtc - zoneOffsetMs(guess, timeZone));
  }
  return guess;
}

/** The day after `day`. Pure label arithmetic — no zone is involved. */
export function nextDay(day: DayKey): DayKey {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * The clinic's current wall clock as `HH:MM`, rounded UP to the next `stepMin`
 * boundary.
 *
 * Used to seed the booking form. Seeding it with a fixed hour guarantees a
 * rejected first submission for anyone booking later in the day — the server
 * requires a future instant — and teaches the doctor that the form is
 * unreliable. Returns null when rounding would cross midnight, so the caller
 * can move to the next day rather than propose a time that has already gone.
 */
export function nextSlotAfterNow(
  timeZone: string,
  stepMin = 30,
): string | null {
  const now = new Date();
  const [hh, mm] = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(now)
    .split(":")
    .map(Number);

  // Strictly the NEXT boundary: exactly on the half hour advances a step, so
  // the proposed slot is never the minute that is already passing.
  const minutesNow = (hh % 24) * 60 + mm;
  const total = (Math.floor(minutesNow / stepMin) + 1) * stepMin;
  if (total >= 24 * 60) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** `YYYY-MM` of a clinic-local day. */
export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

/** Month `n` months away from `month`, e.g. `addMonths("2026-01", -1)`. */
export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * UTC window guaranteed to contain every instant belonging to `month` in any
 * timezone, with a day of slack on each side.
 *
 * The slack is deliberate, and it is why no timezone is taken here. Computing
 * exact zone-aware month boundaries and then bucketing by day key would mean
 * two independent implementations of the same calendar question, and they
 * would eventually disagree. Instead the query over-fetches by a bounded
 * amount and the caller drops whatever falls outside the month once it has a
 * real day key from `dayKey` — one source of truth about days, at the cost of
 * at most two extra days of rows. No zone is more than a day from UTC, so the
 * slack covers all of them.
 */
export function monthWindowUtc(month: MonthKey): {
  fromUtc: Date;
  toUtc: Date;
} {
  const [y, m] = month.split("-").map(Number);
  const DAY = 86_400_000;
  return {
    fromUtc: new Date(Date.UTC(y, m - 1, 1) - DAY),
    toUtc: new Date(Date.UTC(y, m, 1) + DAY),
  };
}

/**
 * The day keys of a Monday-first month grid: leading days from the previous
 * month, the month itself, trailing days from the next — always whole weeks.
 *
 * Pure string/UTC arithmetic. A grid cell is a label, not an instant, so no
 * timezone is involved in laying one out; the zone matters only when deciding
 * which cell a real timestamp belongs to.
 */
export function monthGrid(month: MonthKey): DayKey[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // getUTCDay: 0=Sun. Monday-first index: Mon=0 … Sun=6.
  const lead = (first.getUTCDay() + 6) % 7;

  const start = new Date(first.getTime() - lead * 86_400_000);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, i) =>
    new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

/** Human month heading, e.g. "August 2026". */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Human day heading, e.g. "Wednesday, 19 August 2026". */
export function dayLabel(day: DayKey): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Compact date of an instant in the clinic's timezone, e.g. "19 Aug 2026". */
export function shortDate(instant: Date | string, timeZone: string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  return d.toLocaleDateString("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Clock face of an instant in the clinic's timezone, e.g. "2:30 pm". */
export function timeLabel(instant: Date | string, timeZone: string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  return d
    .toLocaleTimeString("en-GB", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}
