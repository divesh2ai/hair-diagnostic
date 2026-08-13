import { describe, expect, it, vi } from 'vitest';
import {
  lookupIdentity,
  resolvePatientForIntake,
  toRelationship,
} from '../../apps/patient-portal/src/lib/patient/identity';

// The rule under test: match COUNT decides the state, and nothing else. No
// sort order, no recency heuristic, no "probably this one". Attaching a visit
// to the wrong person's clinical history is the failure these tests exist to
// make impossible.

type PatientRow = { id: string; name: string; age: number | null; gender: string | null; email: string | null };

function fakeDb(patients: PatientRow[]) {
  const created: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const db = {
    patient: {
      findMany: vi.fn(async ({ take }: { take?: number }) =>
        patients.slice(0, take ?? patients.length).map((p) => ({ id: p.id })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        patients.find((p) => p.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `created-${created.length}` };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { id: 'updated' };
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    assessment: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return { id: 'audit' };
      }),
    },
  };

  // The helpers accept a Prisma.TransactionClient; this stub implements the
  // handful of delegates they actually reach for.
  return { db: db as never, created, audits, updates };
}

const details = { name: 'Priya Shah', age: 38, gender: 'female', email: null };
const CLINIC = 'clinic-1';
const PHONE = '9876543210';

function patient(id: string): PatientRow {
  return { id, name: 'Priya Shah', age: 38, gender: 'female', email: null };
}

describe('lookupIdentity — deterministic states', () => {
  it('reports NEW when no record carries the number', async () => {
    const { db } = fakeDb([]);
    const result = await lookupIdentity(db, CLINIC, PHONE);
    expect(result?.state).toBe('NEW');
  });

  it('reports RETURNING_CANDIDATE for exactly one match', async () => {
    const { db } = fakeDb([patient('p1')]);
    const result = await lookupIdentity(db, CLINIC, PHONE);
    expect(result?.state).toBe('RETURNING_CANDIDATE');
    if (result?.state === 'RETURNING_CANDIDATE') expect(result.patientId).toBe('p1');
  });

  it('reports IDENTITY_AMBIGUOUS for two or more, and picks none of them', async () => {
    const { db } = fakeDb([patient('p1'), patient('p2')]);
    const result = await lookupIdentity(db, CLINIC, PHONE);
    expect(result?.state).toBe('IDENTITY_AMBIGUOUS');
    if (result?.state === 'IDENTITY_AMBIGUOUS') {
      expect(result.candidateCount).toBe(2);
      expect(result.candidateIds).toEqual(['p1', 'p2']);
      // No `patientId` field exists on this variant — there is nothing to
      // accidentally read as "the answer".
      expect(result).not.toHaveProperty('patientId');
    }
  });

  it('returns null for a number that cannot be normalised', async () => {
    const { db } = fakeDb([patient('p1')]);
    expect(await lookupIdentity(db, CLINIC, 'not a phone')).toBeNull();
  });

  it('always demands verification, whatever the state', async () => {
    for (const rows of [[], [patient('p1')], [patient('p1'), patient('p2')]]) {
      const { db } = fakeDb(rows);
      const result = await lookupIdentity(db, CLINIC, PHONE);
      expect(result?.requiresVerification).toBe(true);
    }
  });
});

describe('toRelationship — what a public caller is told', () => {
  it('collapses both returning states to RETURNING', () => {
    expect(toRelationship('NEW')).toBe('NEW');
    expect(toRelationship('RETURNING_CANDIDATE')).toBe('RETURNING');
    // Ambiguity is real and recorded, but "this number is on two records" is
    // itself a fact about someone's clinic attendance.
    expect(toRelationship('IDENTITY_AMBIGUOUS')).toBe('RETURNING');
  });
});

describe('resolvePatientForIntake', () => {
  it('creates a record when the number is unseen', async () => {
    const { db, created, audits } = fakeDb([]);
    const resolved = await resolvePatientForIntake(db, {
      clinicId: CLINIC,
      doctorId: null,
      rawPhone: PHONE,
      details,
    });

    expect(resolved.identityState).toBe('NEW');
    expect(resolved.matchedOn).toBe('created');
    expect(resolved.requiresReconciliation).toBe(false);
    expect(created[0].phoneNormalized).toBe('+919876543210');
    expect(audits).toHaveLength(0);
  });

  it('reuses the single matching record instead of creating another', async () => {
    const { db, created } = fakeDb([patient('p1')]);
    const resolved = await resolvePatientForIntake(db, {
      clinicId: CLINIC,
      doctorId: null,
      rawPhone: PHONE,
      details,
    });

    expect(resolved.patientId).toBe('p1');
    expect(resolved.matchedOn).toBe('mobile');
    expect(created).toHaveLength(0);
  });

  describe('when the number is ambiguous', () => {
    async function runAmbiguous() {
      const fake = fakeDb([patient('p1'), patient('p2')]);
      const resolved = await resolvePatientForIntake(fake.db, {
        clinicId: CLINIC,
        doctorId: null,
        rawPhone: PHONE,
        details,
      });
      return { ...fake, resolved };
    }

    it('picks neither candidate', async () => {
      const { resolved } = await runAmbiguous();
      expect(resolved.patientId).not.toBe('p1');
      expect(resolved.patientId).not.toBe('p2');
      expect(resolved.identityState).toBe('IDENTITY_AMBIGUOUS');
      expect(resolved.matchedOn).toBe('quarantined');
      expect(resolved.requiresReconciliation).toBe(true);
    });

    it('never mutates the existing duplicates', async () => {
      const { updates } = await runAmbiguous();
      expect(updates).toHaveLength(0);
    });

    it('quarantines the new record without a match key, so it cannot deepen the ambiguity', async () => {
      const { created } = await runAmbiguous();
      expect(created).toHaveLength(1);
      expect(created[0].phoneNormalized).toBeNull();
      // The number is still visible to reception for reconciliation.
      expect(created[0].phone).toBe('+919876543210');
    });

    it('creates loudly — the ambiguity and every candidate are audit-logged', async () => {
      const { audits } = await runAmbiguous();
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('patient.identity_ambiguous');
      const metadata = audits[0].metadata as Record<string, unknown>;
      expect(metadata.candidateIds).toEqual(['p1', 'p2']);
      expect(metadata.resolution).toBe('quarantined_pending_reconciliation');
    });

    it('marks the row as needing a human, so the state is queryable not just logged', async () => {
      // An AuditLog entry records what happened; it does not answer "which
      // identities in this clinic are still unresolved?" without a log scrape.
      const { created } = await runAmbiguous();
      expect(created[0].identityResolutionStatus).toBe('AMBIGUOUS');
      expect(created[0].identityFlaggedAt).toBeInstanceOf(Date);
    });
  });

  it('leaves an ordinary new record RESOLVED and unflagged', async () => {
    const { db, created } = fakeDb([]);
    await resolvePatientForIntake(db, {
      clinicId: CLINIC,
      doctorId: null,
      rawPhone: PHONE,
      details,
    });

    expect(created[0].identityResolutionStatus).toBe('RESOLVED');
    expect(created[0].identityFlaggedAt).toBeNull();
  });

  it('prefers a session-linked patient over any phone match', async () => {
    const { db, created } = fakeDb([patient('p1'), patient('p2')]);
    const resolved = await resolvePatientForIntake(db, {
      clinicId: CLINIC,
      doctorId: null,
      rawPhone: PHONE,
      details,
      linkedPatientId: 'linked-1',
    });

    expect(resolved.patientId).toBe('linked-1');
    expect(resolved.matchedOn).toBe('linked_assessment');
    expect(created).toHaveLength(0);
  });

  it('keeps an unparseable number verbatim but out of the match key', async () => {
    const { db, created } = fakeDb([]);
    await resolvePatientForIntake(db, {
      clinicId: CLINIC,
      doctorId: null,
      rawPhone: '022 2345 6789',
      details,
    });

    expect(created[0].phoneNormalized).toBeNull();
    expect(created[0].phone).toBe('022 2345 6789');
  });
});
