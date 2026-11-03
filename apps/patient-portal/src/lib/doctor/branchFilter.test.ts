import { describe, it, expect } from 'vitest';

import { ALL_BRANCHES, matchesBranchFilter } from './branchFilter';

describe('matchesBranchFilter', () => {
  it('ALL_BRANCHES shows every patient, attributed or not', () => {
    expect(matchesBranchFilter('loc_mulund', ALL_BRANCHES)).toBe(true);
    expect(matchesBranchFilter(null, ALL_BRANCHES)).toBe(true);
  });

  it('a specific branch shows only that branch', () => {
    expect(matchesBranchFilter('loc_mulund', 'loc_mulund')).toBe(true);
    expect(matchesBranchFilter('loc_bandra', 'loc_mulund')).toBe(false);
  });

  it('an unattributed patient matches no specific branch', () => {
    expect(matchesBranchFilter(null, 'loc_mulund')).toBe(false);
    expect(matchesBranchFilter(null, 'loc_bandra')).toBe(false);
  });

  it('partitions a Mulund/Bandra registry with no overlap and no loss', () => {
    const rows = [
      { id: 'p1', lastBranchId: 'loc_mulund' },
      { id: 'p2', lastBranchId: 'loc_bandra' },
      { id: 'p3', lastBranchId: 'loc_mulund' },
      { id: 'p4', lastBranchId: null }, // generic-URL walk-in
    ];
    const all = rows.filter((r) => matchesBranchFilter(r.lastBranchId, ALL_BRANCHES));
    const mulund = rows.filter((r) => matchesBranchFilter(r.lastBranchId, 'loc_mulund'));
    const bandra = rows.filter((r) => matchesBranchFilter(r.lastBranchId, 'loc_bandra'));

    expect(all).toHaveLength(4);
    expect(mulund.map((r) => r.id)).toEqual(['p1', 'p3']);
    expect(bandra.map((r) => r.id)).toEqual(['p2']);
    // The two branch views never share a patient.
    expect(mulund.some((r) => bandra.includes(r))).toBe(false);
  });
});
