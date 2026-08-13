import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  readIntakeSessionForLinking,
  signIntakeSession,
  verifyIntakeSession,
} from '../../apps/patient-portal/src/lib/patient/intakeSession';

// The rule these tests defend: closing a ClinicVisit at submission must not
// depend on the intake session still being fresh, and must still depend on it
// being genuine.
//
// A patient who takes 35 minutes over the assessment has an expired token and
// a completed submission. If the link is refused there, they appear on the
// Doctor Dashboard twice — still filling in the assessment they just handed
// in. Expiry is therefore ignored for linking and only for linking; every
// endpoint that tells a caller something still enforces it.

afterEach(() => {
  vi.useRealTimers();
});

describe('readIntakeSessionForLinking', () => {
  it('reads a live session', () => {
    const session = signIntakeSession('clinic_abc');
    expect(readIntakeSessionForLinking(session.token)).toEqual({
      clinicId: 'clinic_abc',
      sessionId: session.sessionId,
    });
  });

  it('still reads a session that has expired', () => {
    const session = signIntakeSession('clinic_abc', 1_000);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 60 * 60_000));

    // The gatekeeping read refuses it...
    expect(verifyIntakeSession(session.token)).toEqual({
      ok: false,
      error: 'EXPIRED',
    });
    // ...and the correlation read, which grants nothing, does not.
    expect(readIntakeSessionForLinking(session.token)).toEqual({
      clinicId: 'clinic_abc',
      sessionId: session.sessionId,
    });
  });

  it('refuses a forged signature even though expiry is ignored', () => {
    const session = signIntakeSession('clinic_abc');
    const [body] = session.token.split('.');
    const forged = `${body}.${'a'.repeat(64)}`;
    expect(readIntakeSessionForLinking(forged)).toBeNull();
  });

  it('refuses a token whose payload was swapped for another clinic', () => {
    const mine = signIntakeSession('clinic_abc');
    const theirs = signIntakeSession('clinic_xyz');
    const [, mySig] = mine.token.split('.');
    const [theirBody] = theirs.token.split('.');
    // Their payload, my signature — the MAC no longer matches.
    expect(readIntakeSessionForLinking(`${theirBody}.${mySig}`)).toBeNull();
  });

  it('refuses malformed input rather than throwing', () => {
    expect(readIntakeSessionForLinking(undefined)).toBeNull();
    expect(readIntakeSessionForLinking('')).toBeNull();
    expect(readIntakeSessionForLinking('not-a-token')).toBeNull();
    expect(readIntakeSessionForLinking({ token: 'nope' })).toBeNull();
  });
});
