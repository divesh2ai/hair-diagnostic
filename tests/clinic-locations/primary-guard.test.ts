import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { isDuplicatePrimaryLocation } from '../../apps/patient-portal/src/lib/clinic/location';

// The rule these tests defend: "one primary branch per clinic" is guaranteed by
// the database, not by the application transaction alone. When the database
// says no, the API has to recognise it and answer 409 — a race an admin can
// retry, not a 500 that reads as a platform fault.
//
// The guarantee itself is the partial unique index in
// prisma/migrations/20260812_clinic_locations:
//
//   CREATE UNIQUE INDEX "ClinicLocation_clinicId_primary_key"
//     ON "ClinicLocation" ("clinicId")
//     WHERE "isPrimary" = true AND "deletedAt" IS NULL;
//
// which cannot be exercised without Postgres. What is unit-testable is the
// translation of its violation, which is what this file covers.

function p2002(meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  });
}

describe('isDuplicatePrimaryLocation', () => {
  it('recognises the violation when Prisma names the index', () => {
    expect(isDuplicatePrimaryLocation(p2002({ target: 'ClinicLocation_clinicId_primary_key' })))
      .toBe(true);
  });

  it('recognises it when Prisma reports the column list instead', () => {
    // Prisma has reported both shapes across versions and drivers. Pinning to
    // one of them means an upgrade silently regresses this path to a 500.
    expect(isDuplicatePrimaryLocation(p2002({ target: ['clinicId'] }))).toBe(true);
  });

  it('ignores a unique violation on some other table', () => {
    expect(isDuplicatePrimaryLocation(p2002({ target: ['slug'] }))).toBe(false);
  });

  it('ignores non-P2002 Prisma errors', () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
      meta: { target: 'clinicId' },
    });
    expect(isDuplicatePrimaryLocation(notFound)).toBe(false);
  });

  it('ignores anything that is not a Prisma error', () => {
    expect(isDuplicatePrimaryLocation(new Error('boom'))).toBe(false);
    expect(isDuplicatePrimaryLocation(null)).toBe(false);
    expect(isDuplicatePrimaryLocation('P2002')).toBe(false);
  });
});
