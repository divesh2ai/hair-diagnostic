import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  describeSchemaDrift,
  isSchemaDriftError,
} from '../../apps/patient-portal/src/lib/prismaErrors';

// The rule under test: "code shipped ahead of its migration" is a distinct
// failure from "the server is unreachable", and the two must not collapse into
// one response. Collapsing them tells a patient their phone is broken and tells
// an operator nothing, while the cause is exactly known.

function known(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('isSchemaDriftError', () => {
  it('recognises a missing column (P2022) — the D1 failure mode', () => {
    expect(
      isSchemaDriftError(
        known('P2022', { modelName: 'Patient', column: 'Patient.phoneNormalized' }),
      ),
    ).toBe(true);
  });

  it('recognises a missing table (P2021) — the S2 failure mode', () => {
    expect(isSchemaDriftError(known('P2021', { table: 'ClinicLocation' }))).toBe(true);
  });

  it('does not claim transient connection failures', () => {
    // These already have a retry path in lib/prisma. Treating them as drift
    // would turn a recoverable blip into a permanent-looking wall.
    for (const code of ['P1001', 'P1002', 'P1008', 'P1017', 'P2024']) {
      expect(isSchemaDriftError(known(code, {}))).toBe(false);
    }
  });

  it('does not claim ordinary query errors', () => {
    expect(isSchemaDriftError(known('P2025', {}))).toBe(false);
    expect(isSchemaDriftError(known('P2002', { target: ['clinicId'] }))).toBe(false);
  });

  it('ignores anything that is not a Prisma known-request error', () => {
    expect(isSchemaDriftError(new Error('boom'))).toBe(false);
    expect(isSchemaDriftError(null)).toBe(false);
    expect(isSchemaDriftError('P2022')).toBe(false);
  });
});

describe('describeSchemaDrift', () => {
  it('names the missing object so the log points at the fix', () => {
    expect(
      describeSchemaDrift(
        known('P2022', { modelName: 'Patient', column: 'Patient.phoneNormalized' }),
      ),
    ).toBe('Patient.phoneNormalized');
    expect(describeSchemaDrift(known('P2021', { table: 'ClinicLocation' }))).toBe(
      'ClinicLocation',
    );
  });

  it('degrades to the error code rather than printing row data', () => {
    expect(describeSchemaDrift(known('P2022', {}))).toBe('P2022');
    expect(describeSchemaDrift(new Error('boom'))).toBe('unknown');
  });
});
