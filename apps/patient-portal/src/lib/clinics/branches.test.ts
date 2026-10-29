import { describe, it, expect, vi } from 'vitest';

import {
  normaliseBranchSlug,
  resolveClinicBranch,
  listClinicBranches,
} from './branches';

// A fake Prisma-ish client that records the `where`/args it is called with, so
// a test can assert the query is always scoped to one clinic — the property the
// whole two-branch isolation story rests on.
function fakeDb(rows: Array<Record<string, unknown>>) {
  const findFirst = vi.fn(async () => rows[0] ?? null);
  const findMany = vi.fn(async () => rows);
  return {
    db: { clinicLocation: { findFirst, findMany } } as never,
    findFirst,
    findMany,
  };
}

/* The first argument of a mock's first call, typed loosely — we are asserting
   on an internal `where`/args object, not production types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstArg(fn: ReturnType<typeof vi.fn>): any {
  return fn.mock.calls[0]?.[0];
}

const MULUND = { id: 'loc_mulund', slug: 'mulund', branchName: 'Mulund', isPrimary: false };
const BANDRA = { id: 'loc_bandra', slug: 'bandra', branchName: 'Bandra', isPrimary: true };

describe('normaliseBranchSlug', () => {
  it('lowercases and trims a valid slug', () => {
    expect(normaliseBranchSlug('  Bandra ')).toBe('bandra');
    expect(normaliseBranchSlug('mulund')).toBe('mulund');
    expect(normaliseBranchSlug('mumbai-central_2')).toBe('mumbai-central_2');
  });

  it('rejects empty, non-string, and unsafe values', () => {
    expect(normaliseBranchSlug('')).toBeNull();
    expect(normaliseBranchSlug(null)).toBeNull();
    expect(normaliseBranchSlug(undefined)).toBeNull();
    expect(normaliseBranchSlug('has space')).toBeNull();
    expect(normaliseBranchSlug('-leading-hyphen')).toBeNull();
    expect(normaliseBranchSlug('drop/table')).toBeNull();
  });
});

describe('resolveClinicBranch', () => {
  it('returns the branch when the slug resolves within the clinic', async () => {
    const { db, findFirst } = fakeDb([MULUND]);
    const branch = await resolveClinicBranch(db, 'clinicA', 'mulund');
    expect(branch).toEqual(MULUND);
    // The decisive assertion: the query is scoped to the clinic and excludes
    // soft-deleted and closed branches. clinicId is never optional here.
    const where = firstArg(findFirst).where;
    expect(where.clinicId).toBe('clinicA');
    expect(where.deletedAt).toBeNull();
    expect(where.status).toEqual({ not: 'CLOSED' });
    expect(where.OR).toEqual([{ slug: 'mulund' }]);
  });

  it('accepts a raw ClinicLocation id as well as a slug', async () => {
    const { db, findFirst } = fakeDb([BANDRA]);
    // A real ClinicLocation id (uuid, as production uses). It is id-shaped, so
    // the query matches on id OR slug — both still scoped to the clinic.
    const id = '419f229c-4f08-4506-ae86-209894d6b796';
    await resolveClinicBranch(db, 'clinicA', id);
    const where = firstArg(findFirst).where;
    expect(where.OR).toEqual(
      expect.arrayContaining([{ slug: id }, { id }]),
    );
  });

  it('never queries — and returns null — for empty or garbage input', async () => {
    const { db, findFirst } = fakeDb([]);
    expect(await resolveClinicBranch(db, 'clinicA', '')).toBeNull();
    expect(await resolveClinicBranch(db, 'clinicA', null)).toBeNull();
    expect(await resolveClinicBranch(db, 'clinicA', '   ')).toBeNull();
    expect(await resolveClinicBranch(db, 'clinicA', '!!')).toBeNull();
    expect(await resolveClinicBranch(db, '', 'mulund')).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns null when the clinic has no such branch (cross-clinic miss)', async () => {
    // clinicB asking for clinicA's slug: the DB finds nothing because the query
    // is clinic-scoped, so attribution can never cross a clinic boundary.
    const { db } = fakeDb([]);
    expect(await resolveClinicBranch(db, 'clinicB', 'mulund')).toBeNull();
  });
});

describe('listClinicBranches', () => {
  it('scopes to the clinic and orders primary-first then by name', async () => {
    const { db, findMany } = fakeDb([BANDRA, MULUND]);
    const out = await listClinicBranches(db, 'clinicA');
    expect(out).toEqual([BANDRA, MULUND]);
    const args = firstArg(findMany);
    expect(args.where.clinicId).toBe('clinicA');
    expect(args.where.deletedAt).toBeNull();
    expect(args.where.status).toEqual({ not: 'CLOSED' });
    expect(args.orderBy).toEqual([{ isPrimary: 'desc' }, { branchName: 'asc' }]);
    // Without withSlugOnly, branches with no QR handle are still listed.
    expect(args.where.slug).toBeUndefined();
  });

  it('filters to handled branches when withSlugOnly is set', async () => {
    const { db, findMany } = fakeDb([BANDRA]);
    await listClinicBranches(db, 'clinicA', { withSlugOnly: true });
    expect(firstArg(findMany).where.slug).toEqual({ not: null });
  });

  it('returns [] for a missing clinicId without querying', async () => {
    const { db, findMany } = fakeDb([MULUND]);
    expect(await listClinicBranches(db, '')).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
