import { describe, expect, it } from 'vitest';
import {
  clinicalAttention,
  reviewPriority,
} from '../../apps/patient-portal/src/lib/doctor/reviewPriority';

// The rule these tests defend: the review-pathway classifier informs a doctor
// about a case. It does not rank patients.
//
// Two failures are being prevented. First, a severity hierarchy printed on
// every waiting patient — "Standard review", "Review" — which is a clinical
// register applied to a queue and communicates nothing. Second, and worse, a
// chip that reassures: the classifier is disabled in production and populates
// no rows, so anything other than silence on an unclassified case is a claim
// about a case nothing has looked at.

describe('clinicalAttention', () => {
  it('says nothing about an unclassified case', () => {
    // The overwhelmingly common case today: reviewPathway is null on every
    // live row because the classifier is behind a flag that is set nowhere.
    expect(clinicalAttention({ assessmentStatus: 'COMPLETED' })).toBeNull();
  });

  it('says nothing about a case the classifier called routine', () => {
    expect(
      clinicalAttention({
        assessmentStatus: 'COMPLETED',
        reviewPathway: 'ROUTINE_REVIEW',
      }),
    ).toBeNull();
  });

  it('flags a case that needs resolution, in case-language not queue-language', () => {
    const attention = clinicalAttention({
      assessmentStatus: 'COMPLETED',
      reviewPathway: 'RESOLUTION_REQUIRED',
    });
    // "Needs attention" reads as a queue position; "Clinical attention" reads
    // as a property of the case, which is what it is.
    expect(attention).toMatchObject({ label: 'Clinical attention', tone: 'danger' });
  });

  it('flags examination and focused review with their own labels', () => {
    expect(
      clinicalAttention({
        assessmentStatus: 'COMPLETED',
        reviewPathway: 'EXAMINATION_REQUIRED',
      }),
    ).toMatchObject({ label: 'Examination required', tone: 'danger' });

    expect(
      clinicalAttention({
        assessmentStatus: 'COMPLETED',
        reviewPathway: 'FOCUSED_REVIEW',
      }),
    ).toMatchObject({ label: 'Focused review', tone: 'warning' });
  });

  it('flags a case whose report did not generate — an operational fact, not a diagnosis', () => {
    const attention = clinicalAttention({ assessmentStatus: 'FAILED' });
    expect(attention?.reason).toBe('Report generation did not complete');
  });

  it('carries no rank of any kind', () => {
    const attention = clinicalAttention({
      assessmentStatus: 'COMPLETED',
      reviewPathway: 'RESOLUTION_REQUIRED',
    });
    // Nothing a caller could sort by, even by accident. Ordering is
    // submittedAt ascending, everywhere, without exception.
    expect(attention && 'rank' in attention).toBe(false);
    expect(attention && 'tier' in attention).toBe(false);
  });

  it('leaves the underlying classifier untouched', () => {
    // This UX slice changed what is displayed, not what is computed. The
    // clinical red-flag rules and their tiers are unchanged and still
    // available to anything that legitimately needs them.
    expect(
      reviewPriority({
        assessmentStatus: 'COMPLETED',
        reviewPathway: 'ROUTINE_REVIEW',
      }),
    ).toMatchObject({ tier: 'routine', label: 'Standard review' });
  });
});
