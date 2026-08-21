import { describe, expect, it } from 'vitest';
import {
  compareByPriority,
  nextActionOf,
  standingOf,
} from '../../apps/patient-portal/src/lib/doctor/clinicalStanding';

// The rule these tests defend: GREEN MEANS A HUMAN APPROVED IT.
//
// Before this module existed, three doctor surfaces classified case state
// independently and disagreed. The specific defect worth a regression test is
// the one that shipped: `statusTone("COMPLETED")` painted a finished-but-unread
// report emerald on the patient detail page while the registry correctly showed
// the same case amber. One screen told a doctor their work was done; the other
// told them it was owed.

describe('standingOf — the decision outranks the pipeline', () => {
  it('does NOT call a COMPLETED but unapproved report reviewed', () => {
    // The exact case that regressed. The pipeline finished writing the report;
    // no human has read it. The doctor is still the blocker.
    const s = standingOf({
      assessmentCount: 1,
      lastStatus: 'COMPLETED',
      lastReviewDecision: 'PENDING',
    });
    expect(s.standing).toBe('AWAITING_REVIEW');
    expect(s.label).toBe('Awaiting review');
  });

  it('treats CLINICAL_READY the same way — ready is not reviewed', () => {
    expect(
      standingOf({
        assessmentCount: 1,
        lastStatus: 'CLINICAL_READY',
        lastReviewDecision: 'PENDING',
      }).standing,
    ).toBe('AWAITING_REVIEW');
  });

  it('marks a case reviewed only on an explicit APPROVED decision', () => {
    expect(
      standingOf({
        assessmentCount: 1,
        lastStatus: 'COMPLETED',
        lastReviewDecision: 'APPROVED',
      }).standing,
    ).toBe('REVIEWED');
  });

  it('reads the decision even when the pipeline is still mid-flight', () => {
    // An approval is a statement by a person and outranks whatever stage the
    // machine happens to be at.
    expect(
      standingOf({
        assessmentCount: 1,
        lastStatus: 'GENERATING_NARRATIVE',
        lastReviewDecision: 'APPROVED',
      }).standing,
    ).toBe('REVIEWED');
  });
});

describe('standingOf — whose turn is it', () => {
  it('puts EDITS_REQUESTED back with the system, not with the doctor', () => {
    // The doctor has acted. Amber would claim they are the blocker; they are
    // not, and a worklist that says otherwise sends them to a case twice.
    const s = standingOf({
      assessmentCount: 1,
      lastStatus: 'GENERATING_REPORT',
      lastReviewDecision: 'EDITS_REQUESTED',
    });
    expect(s.standing).toBe('PROCESSING');
    expect(s.label).toBe('Revision sent');
  });

  it('separates a total failure from a partial one', () => {
    // Different actions: nothing to read and needs a retry, versus most of a
    // report that may still be worth opening.
    expect(
      standingOf({
        assessmentCount: 1,
        lastStatus: 'FAILED',
        lastReviewDecision: 'PENDING',
      }).label,
    ).toBe('Failed');
    expect(
      standingOf({
        assessmentCount: 1,
        lastStatus: 'PARTIAL_FAILURE',
        lastReviewDecision: 'PENDING',
      }).label,
    ).toBe('Partial failure');
  });

  it('groups both failures and a rejection under ATTENTION', () => {
    for (const facts of [
      { lastStatus: 'FAILED', lastReviewDecision: 'PENDING' },
      { lastStatus: 'PARTIAL_FAILURE', lastReviewDecision: 'PENDING' },
      { lastStatus: 'COMPLETED', lastReviewDecision: 'REJECTED' },
    ]) {
      expect(standingOf({ assessmentCount: 1, ...facts }).standing).toBe(
        'ATTENTION',
      );
    }
  });

  it('calls a patient with no assessment NONE, whatever else is present', () => {
    expect(standingOf({ assessmentCount: 0 }).standing).toBe('NONE');
    // A count of zero wins even if a stale status somehow rode along.
    expect(
      standingOf({ assessmentCount: 0, lastStatus: 'COMPLETED' }).standing,
    ).toBe('NONE');
    // And a missing status means nothing has been submitted.
    expect(
      standingOf({ assessmentCount: 3, lastStatus: null }).standing,
    ).toBe('NONE');
  });

  it('treats an unrecognised pipeline state as work in progress', () => {
    // A new AssessmentStatus must never default to green or to red.
    expect(
      standingOf({
        assessmentCount: 1,
        lastStatus: 'SOME_FUTURE_STAGE',
        lastReviewDecision: 'PENDING',
      }).standing,
    ).toBe('PROCESSING');
  });
});

describe('compareByPriority — the work the doctor owes comes first', () => {
  const awaiting = {
    assessmentCount: 1,
    lastStatus: 'COMPLETED',
    lastReviewDecision: 'PENDING',
    lastAssessment: '2026-08-01T00:00:00.000Z', // old
  };
  const reviewedToday = {
    assessmentCount: 1,
    lastStatus: 'COMPLETED',
    lastReviewDecision: 'APPROVED',
    lastAssessment: '2026-08-21T00:00:00.000Z', // recent
  };

  it('ranks a stale pending review above a fresh approved one', () => {
    // The whole reason the default sort is not "most recent": recency alone
    // buries three-day-old work under this morning's finished cases.
    expect(compareByPriority(awaiting, reviewedToday)).toBeLessThan(0);
    expect(compareByPriority(reviewedToday, awaiting)).toBeGreaterThan(0);
  });

  it('orders the full ladder: awaiting → attention → processing → reviewed → none', () => {
    const ladder = [
      { assessmentCount: 1, lastStatus: 'COMPLETED', lastReviewDecision: 'PENDING' },
      { assessmentCount: 1, lastStatus: 'FAILED', lastReviewDecision: 'PENDING' },
      { assessmentCount: 1, lastStatus: 'QUEUED', lastReviewDecision: 'PENDING' },
      { assessmentCount: 1, lastStatus: 'COMPLETED', lastReviewDecision: 'APPROVED' },
      { assessmentCount: 0 },
    ];
    const priorities = ladder.map((f) => standingOf(f).priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('falls back to most-recent within a band', () => {
    const older = { ...awaiting, lastAssessment: '2026-08-01T00:00:00.000Z' };
    const newer = { ...awaiting, lastAssessment: '2026-08-19T00:00:00.000Z' };
    expect(compareByPriority(newer, older)).toBeLessThan(0);
  });
});

describe('nextActionOf — one obvious next step, never a dead button', () => {
  const href = '/doctor/reports/abc';

  it('offers Review as the primary action on a pending case', () => {
    const a = nextActionOf(
      { assessmentCount: 1, lastStatus: 'COMPLETED', lastReviewDecision: 'PENDING' },
      { assessmentId: 'abc', reviewHref: href },
    );
    expect(a).toEqual({ kind: 'primary', label: 'Review', href });
  });

  it('demotes an approved case to a secondary View report', () => {
    const a = nextActionOf(
      { assessmentCount: 1, lastStatus: 'COMPLETED', lastReviewDecision: 'APPROVED' },
      { assessmentId: 'abc', reviewHref: href },
    );
    expect(a.kind).toBe('secondary');
    expect(a).toHaveProperty('href', href);
  });

  it('renders processing as inert text rather than a button', () => {
    // A control that cannot be pressed is a question the doctor has to answer
    // before they can move on.
    const a = nextActionOf(
      { assessmentCount: 1, lastStatus: 'QUEUED', lastReviewDecision: 'PENDING' },
      { assessmentId: 'abc', reviewHref: href },
    );
    expect(a).toEqual({ kind: 'inert', label: 'Processing' });
  });

  it('never produces a link when there is no assessment to open', () => {
    expect(nextActionOf({ assessmentCount: 0 }, {})).toEqual({
      kind: 'inert',
      label: 'No assessment',
    });
  });

  it('degrades to inert when the destination is unknown', () => {
    // A missing href must not become a button pointing at "undefined".
    const a = nextActionOf(
      { assessmentCount: 1, lastStatus: 'COMPLETED', lastReviewDecision: 'PENDING' },
      { assessmentId: 'abc', reviewHref: null },
    );
    expect(a.kind).toBe('inert');
  });
});
