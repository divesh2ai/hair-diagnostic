// Small, single-purpose helper: remove any kit named in `blockedKits` from the
// sequenced phase list, preserving the relative order of the remaining kits.
//
// Extracted from buildKitSequence as a named function so the invariant is
// unit-testable in isolation:
//   1. Non-interference — when `blockedKits` is empty, the returned array is
//      byte-for-byte equal to `phases` (and the same reference is fine).
//   2. Controlled promotion — when a kit is removed, no other kit changes
//      relative position.

import type { KitId } from '../../../types';

export function filterSafetyBlocked(
  phases: readonly KitId[],
  blockedKits: readonly KitId[],
): KitId[] {
  if (blockedKits.length === 0) return [...phases];
  const blocked = new Set(blockedKits);
  return phases.filter((k) => !blocked.has(k));
}
