import { describe, expect, it } from 'vitest';
import {
  CLINIC_SESSION_WINDOW_MS,
  clinicSessionCutoff,
} from '../../apps/patient-portal/src/lib/doctor/clinicVisits';

// The rule these tests defend: In Clinic is a display window, not a timeout.
// Nothing expires a visit and nothing sweeps it up — the dashboard simply
// stops asking for visits older than a clinic session, so a patient who
// abandoned an assessment on Tuesday is not shown as present on Thursday.

describe('clinicSessionCutoff', () => {
  it('is one hour — a visit, not a working day', () => {
    // Long enough for a patient interrupted mid-assessment; short enough that
    // someone who left an hour ago stops occupying the waiting room.
    expect(CLINIC_SESSION_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it('sits exactly one window behind the given moment', () => {
    const now = new Date('2026-08-13T14:00:00.000Z');
    expect(clinicSessionCutoff(now).toISOString()).toBe('2026-08-13T13:00:00.000Z');
  });

  it('keeps a visit that started inside the window and drops one that did not', () => {
    const now = new Date('2026-08-13T14:00:00.000Z');
    const cutoff = clinicSessionCutoff(now);

    const startedTenMinutesAgo = new Date('2026-08-13T13:50:00.000Z');
    // Well within the old four-hour window, and deliberately outside this one.
    const startedTwoHoursAgo = new Date('2026-08-13T12:00:00.000Z');
    const startedYesterday = new Date('2026-08-12T16:30:00.000Z');

    expect(startedTenMinutesAgo > cutoff).toBe(true);
    expect(startedTwoHoursAgo > cutoff).toBe(false);
    expect(startedYesterday > cutoff).toBe(false);
  });

  it('keeps a visit right up to the boundary', () => {
    const now = new Date('2026-08-13T14:00:00.000Z');
    const cutoff = clinicSessionCutoff(now);
    // 59 minutes in is still in the room; a patient does not vanish because
    // the questionnaire took them a while.
    expect(new Date('2026-08-13T13:01:00.000Z') > cutoff).toBe(true);
  });
});
