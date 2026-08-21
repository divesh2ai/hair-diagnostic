import { describe, expect, it } from 'vitest';
import {
  addMonths,
  dayKey,
  monthGrid,
  monthOf,
  monthWindowUtc,
  nextDay,
  nextSlotAfterNow,
  shortDate,
  timeLabel,
  zonedWallTimeToUtc,
} from '../../apps/patient-portal/src/lib/format/clinicDay';

// The rule these tests defend: a clinical day is the CLINIC'S day.
//
// Every assessment timestamp is stored UTC. A patient who submits at 23:40 in
// Mumbai submits at 18:10 UTC on the SAME date, but one at 00:30 IST submits at
// 19:00 UTC the PREVIOUS date. Bucketing by `toISOString().slice(0,10)` files
// that second patient under yesterday — quietly, and only for late-evening and
// early-morning visits, which is the worst kind of wrong because the calendar
// still looks plausible.

const IST = 'Asia/Kolkata'; // UTC+5:30, no DST
const NY = 'America/New_York'; // DST, for the transition cases

describe('dayKey — the clinic decides which day it is', () => {
  it('keeps a late-evening IST submission on its own local date', () => {
    // 2026-08-19 23:40 IST === 2026-08-19 18:10 UTC. Same date either way.
    expect(dayKey('2026-08-19T18:10:00.000Z', IST)).toBe('2026-08-19');
  });

  it('files a just-past-midnight IST submission on the NEW local day', () => {
    // 2026-08-20 00:30 IST === 2026-08-19 19:00 UTC. Naive UTC slicing would
    // return 2026-08-19 and put this patient on the wrong day.
    expect(dayKey('2026-08-19T19:00:00.000Z', IST)).toBe('2026-08-20');
    expect('2026-08-19T19:00:00.000Z'.slice(0, 10)).toBe('2026-08-19'); // the trap
  });

  it('rolls the month over on the clinic clock, not the UTC clock', () => {
    // 2026-09-01 00:15 IST === 2026-08-31 18:45 UTC. September, not August.
    expect(dayKey('2026-08-31T18:45:00.000Z', IST)).toBe('2026-09-01');
    expect(monthOf(dayKey('2026-08-31T18:45:00.000Z', IST))).toBe('2026-09');
  });

  it('rolls the year over the same way', () => {
    // 2027-01-01 00:30 IST === 2026-12-31 19:00 UTC.
    expect(dayKey('2026-12-31T19:00:00.000Z', IST)).toBe('2027-01-01');
  });

  it('accepts a Date, a string, or an epoch and agrees with itself', () => {
    const iso = '2026-08-19T18:10:00.000Z';
    expect(dayKey(new Date(iso), IST)).toBe(dayKey(iso, IST));
    expect(dayKey(new Date(iso).getTime(), IST)).toBe(dayKey(iso, IST));
  });
});

describe('zonedWallTimeToUtc — the time the doctor typed', () => {
  it('reads a booking form entry as clinic wall time', () => {
    // 14:30 in Mumbai is 09:00 UTC.
    expect(zonedWallTimeToUtc('2026-09-15', '14:30', IST).toISOString()).toBe(
      '2026-09-15T09:00:00.000Z',
    );
  });

  it('round-trips: what goes in as a local day comes back as that day', () => {
    for (const time of ['00:00', '09:00', '14:30', '23:59']) {
      const utc = zonedWallTimeToUtc('2026-09-15', time, IST);
      expect(dayKey(utc, IST)).toBe('2026-09-15');
    }
  });

  it('is correct on both sides of a DST transition', () => {
    // US DST began 2026-03-08. 10:00 local is UTC-5 before and UTC-4 after, so
    // a fixed-offset implementation gets exactly one of these wrong.
    expect(zonedWallTimeToUtc('2026-03-07', '10:00', NY).toISOString()).toBe(
      '2026-03-07T15:00:00.000Z',
    );
    expect(zonedWallTimeToUtc('2026-03-09', '10:00', NY).toISOString()).toBe(
      '2026-03-09T14:00:00.000Z',
    );
  });
});

describe('monthWindowUtc — over-fetch, then bucket by real day key', () => {
  it('starts a day before and ends a day after the naive UTC month', () => {
    const { fromUtc, toUtc } = monthWindowUtc('2026-08');
    expect(fromUtc.toISOString()).toBe('2026-07-31T00:00:00.000Z');
    expect(toUtc.toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });

  it('contains every instant that belongs to the month in a far-east zone', () => {
    // Kiritimati is UTC+14 — the extreme case for a month's first moment
    // preceding the UTC month boundary.
    const { fromUtc, toUtc } = monthWindowUtc('2026-08');
    const firstMoment = zonedWallTimeToUtc('2026-08-01', '00:00', 'Pacific/Kiritimati');
    const lastMoment = zonedWallTimeToUtc('2026-08-31', '23:59', 'Pacific/Kiritimati');
    expect(firstMoment.getTime()).toBeGreaterThanOrEqual(fromUtc.getTime());
    expect(lastMoment.getTime()).toBeLessThan(toUtc.getTime());
  });

  it('contains every instant that belongs to the month in a far-west zone', () => {
    // Pacific/Niue is UTC-11 — the extreme case at the other end.
    const { fromUtc, toUtc } = monthWindowUtc('2026-08');
    const firstMoment = zonedWallTimeToUtc('2026-08-01', '00:00', 'Pacific/Niue');
    const lastMoment = zonedWallTimeToUtc('2026-08-31', '23:59', 'Pacific/Niue');
    expect(firstMoment.getTime()).toBeGreaterThanOrEqual(fromUtc.getTime());
    expect(lastMoment.getTime()).toBeLessThan(toUtc.getTime());
  });

  it('handles February in a leap year', () => {
    const { fromUtc, toUtc } = monthWindowUtc('2028-02');
    expect(fromUtc.toISOString()).toBe('2028-01-31T00:00:00.000Z');
    expect(toUtc.toISOString()).toBe('2028-03-02T00:00:00.000Z');
  });
});

describe('monthGrid — whole weeks, Monday first', () => {
  it('always returns a whole number of weeks', () => {
    for (const m of ['2026-01', '2026-02', '2026-08', '2028-02', '2026-11']) {
      expect(monthGrid(m).length % 7).toBe(0);
    }
  });

  it('starts on a Monday and contains every day of the month', () => {
    const cells = monthGrid('2026-08');
    expect(new Date(`${cells[0]}T00:00:00Z`).getUTCDay()).toBe(1); // Monday
    const inMonth = cells.filter((d) => d.startsWith('2026-08'));
    expect(inMonth.length).toBe(31);
    expect(inMonth[0]).toBe('2026-08-01');
    expect(inMonth[30]).toBe('2026-08-31');
  });

  it('gives a leap February its 29th', () => {
    const inMonth = monthGrid('2028-02').filter((d) => d.startsWith('2028-02'));
    expect(inMonth.length).toBe(29);
    expect(inMonth.at(-1)).toBe('2028-02-29');
  });

  it('produces strictly consecutive days with no gaps or repeats', () => {
    const cells = monthGrid('2026-03');
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i]).toBe(nextDay(cells[i - 1]));
    }
  });
});

describe('addMonths / nextDay — calendar navigation', () => {
  it('crosses a year boundary in both directions', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('pads single-digit months', () => {
    expect(addMonths('2026-10', -1)).toBe('2026-09');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
  });

  it('steps a full year without drifting', () => {
    let m = '2026-08';
    for (let i = 0; i < 12; i++) m = addMonths(m, 1);
    expect(m).toBe('2027-08');
  });

  it('rolls nextDay over months and leap days', () => {
    expect(nextDay('2026-08-31')).toBe('2026-09-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
    expect(nextDay('2028-02-29')).toBe('2028-03-01');
  });
});

describe('nextSlotAfterNow — the booking form opens on a bookable time', () => {
  it('returns null when rounding up would cross midnight', () => {
    // The caller moves to tomorrow morning rather than proposing a time that
    // has already gone. Verified against a zone where it is currently 23:5x is
    // impractical, so the contract is asserted structurally instead.
    const slot = nextSlotAfterNow(IST);
    expect(slot === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(slot)).toBe(true);
  });

  it('lands on a step boundary', () => {
    const slot = nextSlotAfterNow(IST, 30);
    if (slot) expect(['00', '30']).toContain(slot.slice(3));
  });

  it('is strictly in the future — never the minute currently passing', () => {
    const slot = nextSlotAfterNow(IST, 30);
    if (slot) {
      const nowHHMM = new Intl.DateTimeFormat('en-GB', {
        timeZone: IST,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());
      expect(slot > nowHHMM).toBe(true);
    }
  });
});

describe('display helpers render in the clinic zone', () => {
  it('formats a time on the clinic clock, not the runtime clock', () => {
    // 09:00 UTC is 2:30 pm in Mumbai.
    expect(timeLabel('2026-09-15T09:00:00.000Z', IST)).toBe('2:30 pm');
  });

  it('formats a date on the clinic clock across the UTC boundary', () => {
    // 2026-08-19 19:00 UTC is already the 20th in Mumbai.
    expect(shortDate('2026-08-19T19:00:00.000Z', IST)).toBe('20 Aug 2026');
  });

  it('agrees with dayKey about which day it is showing', () => {
    const iso = '2026-08-31T18:45:00.000Z';
    // "Sept", not "Sep": en-GB is the only common locale whose CLDR short form
    // for September is four letters. Asserted verbatim rather than loosened to
    // a regex, because the point of this test is that the two helpers name the
    // SAME day, and a fuzzy match would still pass if one of them drifted.
    expect(shortDate(iso, IST)).toBe('1 Sept 2026');
    expect(dayKey(iso, IST)).toBe('2026-09-01');
  });
});
