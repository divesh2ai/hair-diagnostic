import type { PatientAnswers } from '../../../types';
import type { AbsoluteLockResult, ClinicalFlags } from '../types';

// Only PREGNANCY and EARLY_GREY (sole concern, no hair-fall goal) are absolute locks.
// TTM and ALOPECIA_AREATA are scored high but allow co-condition modifiers.
export function checkAbsoluteLocks(
  _ans: PatientAnswers,
  flags: ClinicalFlags
): AbsoluteLockResult {
  if (flags.isPregnant) {
    return { locked: true, key: 'PREGNANCY' };
  }

  // EARLY_GREY is only an absolute lock when it is the SOLE concern.
  // If hair fall / regrow goal is also present, we score normally and inject the grey kit later.
  if (flags.hasGreyGoal && !flags.hasHairGoal && !flags.isRegrowGoal) {
    return { locked: true, key: 'EARLY_GREY' };
  }

  return { locked: false };
}
