// The doctor registry's branch filter, as one pure rule the page and its
// tests share. Kept out of the component so "which patients does Mulund show?"
// is answerable without rendering React.

/** Branch filter value: a ClinicLocation id, or ALL_BRANCHES for every branch. */
export const ALL_BRANCHES = 'all' as const;

export type BranchFilter = string;

/**
 * Does a patient (identified by their latest assessment's branch) belong under
 * the current branch filter?
 *
 * - ALL_BRANCHES shows everyone, attributed or not.
 * - A specific branch shows only patients whose latest assessment was taken
 *   there. An unattributed patient (null branch) matches ONLY "All Patients" —
 *   it is never silently folded into a branch it was never recorded at.
 */
export function matchesBranchFilter(
  lastBranchId: string | null,
  branchFilter: BranchFilter,
): boolean {
  if (branchFilter === ALL_BRANCHES) return true;
  return lastBranchId === branchFilter;
}
