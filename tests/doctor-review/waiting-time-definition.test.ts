import { describe, expect, it } from 'vitest';
import { elapsedLabel } from '../../apps/patient-portal/src/lib/format/waitingTime';

// The rule these tests defend: doctor-review waiting starts when the patient
// SUBMITS, and nothing else starts it.
//
// The worked example from the spec:
//
//   10:01  QR scan
//   10:02  identity captured — ClinicVisit.startedAt
//   10:08  assessment submitted — Assessment.submittedAt
//   10:14  a doctor looks at the dashboard
//
// The queue must read six minutes, not thirteen. Measuring from the scan or
// from the visit would inflate every wait by however long the questionnaire
// took, and the number a clinic manages its day by would quietly stop meaning
// anything.

const SCAN = new Date('2026-08-13T10:01:00Z');
const VISIT_STARTED = new Date('2026-08-13T10:02:00Z');
const SUBMITTED = new Date('2026-08-13T10:08:00Z');
const NOW = new Date('2026-08-13T10:14:00Z');

describe('waiting-time definition', () => {
  it('measures doctor-review waiting from submission', () => {
    expect(elapsedLabel(SUBMITTED, NOW)).toBe('6 min');
  });

  it('does not measure it from the visit start or the QR scan', () => {
    expect(elapsedLabel(VISIT_STARTED, NOW)).toBe('12 min');
    expect(elapsedLabel(SCAN, NOW)).toBe('13 min');
    // Both are real durations of something. Neither is how long a doctor has
    // kept this patient waiting.
    expect(elapsedLabel(VISIT_STARTED, NOW)).not.toBe(elapsedLabel(SUBMITTED, NOW));
  });

  it('measures in-progress duration from the visit start, and only that', () => {
    // Same clock, different question: "Assessment in progress · started 12 min
    // ago" at 10:14 is true and useful. It never becomes review waiting time.
    expect(elapsedLabel(VISIT_STARTED, NOW)).toBe('12 min');
  });
});

describe('elapsedLabel', () => {
  const base = new Date('2026-08-13T12:00:00Z');
  const ago = (ms: number) => new Date(base.getTime() - ms);

  it('reads as a duration, with no tense of its own', () => {
    expect(elapsedLabel(ago(6 * 60_000), base)).toBe('6 min');
    expect(elapsedLabel(ago(59 * 60_000), base)).toBe('59 min');
  });

  it('coarsens rather than emitting unreadable hour counts', () => {
    expect(elapsedLabel(ago(3 * 3_600_000), base)).toBe('3 hr');
    // The regression this replaces rendered "763h".
    expect(elapsedLabel(ago(763 * 3_600_000), base)).toBe('4 weeks');
  });

  it('uses singular units where they occur', () => {
    expect(elapsedLabel(ago(25 * 3_600_000), base)).toBe('1 day');
    expect(elapsedLabel(ago(15 * 24 * 3_600_000), base)).toBe('2 weeks');
  });

  it('never renders a negative duration from a skewed clock', () => {
    expect(elapsedLabel(new Date(base.getTime() + 30_000), base)).toBe('under a min');
    expect(elapsedLabel(ago(5_000), base)).toBe('under a min');
  });

  it('renders a missing timestamp as missing rather than as zero', () => {
    expect(elapsedLabel(null, base)).toBe('—');
    expect(elapsedLabel('not a date', base)).toBe('—');
  });
});
