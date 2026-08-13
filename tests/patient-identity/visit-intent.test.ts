import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEW_PATIENT_VISIT,
  RETURNING_VISIT_TYPES,
  VISIT_TYPES,
  isReturningVisitType,
  isVisitType,
  resolveVisitType,
  toRelationshipState,
} from '../../apps/patient-portal/src/lib/patient/visit';

// The rule under test: relationship and intent are different questions, and
// neither may be derived from the other. A returning patient is not
// automatically a FOLLOW_UP, and a quarantined identity is never filed as a
// confirmed RETURNING.

describe('the returning-patient menu', () => {
  it('never offers INITIAL — a patient we already have a record for is not new', () => {
    expect(RETURNING_VISIT_TYPES).not.toContain('INITIAL');
  });

  it('offers every other intent, so nothing collapses into FOLLOW_UP by default', () => {
    const offered = new Set<string>(RETURNING_VISIT_TYPES);
    for (const type of VISIT_TYPES) {
      if (type === 'INITIAL') continue;
      expect(offered.has(type)).toBe(true);
    }
  });

  it('distinguishes kit collection from a clinical follow-up', () => {
    // These are the two the operations model most needs kept apart: one is a
    // dispense, the other is a consultation.
    expect(RETURNING_VISIT_TYPES).toContain('KIT_FULFILMENT');
    expect(RETURNING_VISIT_TYPES).toContain('FOLLOW_UP');
  });
});

describe('isVisitType / isReturningVisitType', () => {
  it('accepts only canonical values', () => {
    expect(isVisitType('KIT_FULFILMENT')).toBe(true);
    expect(isVisitType('kit_fulfilment')).toBe(false);
    expect(isVisitType('SOMETHING_ELSE')).toBe(false);
    expect(isVisitType(undefined)).toBe(false);
  });

  it('excludes INITIAL from the returning set', () => {
    expect(isReturningVisitType('INITIAL')).toBe(false);
    expect(isReturningVisitType('REASSESSMENT')).toBe(true);
  });
});

describe('resolveVisitType', () => {
  it('derives INITIAL for a new patient rather than asking', () => {
    expect(resolveVisitType('NEW', undefined)).toBe(DEFAULT_NEW_PATIENT_VISIT);
    expect(DEFAULT_NEW_PATIENT_VISIT).toBe('INITIAL');
  });

  it('ignores a submitted intent that contradicts a NEW relationship', () => {
    // A client claiming both "first visit" and "follow-up" is a bug. Trusting
    // the intent would put a first-time patient in the follow-up queue.
    expect(resolveVisitType('NEW', 'FOLLOW_UP')).toBe('INITIAL');
  });

  it('keeps the stated intent for a returning patient', () => {
    for (const intent of RETURNING_VISIT_TYPES) {
      expect(resolveVisitType('RETURNING', intent)).toBe(intent);
    }
  });

  it('keeps the stated intent for an ambiguous identity too', () => {
    // Ambiguity is about *who* this is, not about why they came. The patient
    // still told us, and that answer is still worth recording.
    expect(resolveVisitType('AMBIGUOUS', 'KIT_FULFILMENT')).toBe('KIT_FULFILMENT');
  });

  it('records null — not INITIAL — when a returning submission carries no intent', () => {
    // An older client, or a session that skipped the gate. "Not captured" is a
    // fact; INITIAL would be a claim about a visit nobody described.
    expect(resolveVisitType('RETURNING', undefined)).toBeNull();
    expect(resolveVisitType(null, undefined)).toBeNull();
  });

  it('refuses INITIAL from a returning submission', () => {
    expect(resolveVisitType('RETURNING', 'INITIAL')).toBeNull();
    expect(resolveVisitType('AMBIGUOUS', 'INITIAL')).toBeNull();
  });

  it('drops junk instead of persisting it', () => {
    expect(resolveVisitType('RETURNING', 'follow_up')).toBeNull();
    expect(resolveVisitType('RETURNING', 42)).toBeNull();
    expect(resolveVisitType('RETURNING', { visitType: 'FOLLOW_UP' })).toBeNull();
  });
});

describe('toRelationshipState', () => {
  it('keeps ambiguity distinct from a confirmed returning patient', () => {
    expect(toRelationshipState('NEW')).toBe('NEW');
    expect(toRelationshipState('RETURNING_CANDIDATE')).toBe('RETURNING');
    // The whole point. A quarantined visit filed as RETURNING would erase the
    // one fact reception needs to act on.
    expect(toRelationshipState('IDENTITY_AMBIGUOUS')).toBe('AMBIGUOUS');
  });
});
