import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from './types';
import {
  validateContraindications,
  getBlockedTopicals,
  isPregnantOrPlanning,
} from './contraindications/validateContraindications';
import {
  checkTherapyEligibility,
  applyTherapyBlocks,
} from './contraindications/checkTherapyEligibility';

export type {
  ContraindictionResult,
  ContraindictionViolation,
  ContraindictionSeverity,
} from './contraindications/validateContraindications';

export type {
  TherapyEligibilityResult,
  KitEligibility,
  ForbiddenCombination,
  KitId,
} from './contraindications/checkTherapyEligibility';

// ─────────────────────────────────────────────────────────────────────────────
// BUILD TOPICALS — unified topical recommendation + contraindication layer
//
// Consolidates validateContraindications() and checkTherapyEligibility() behind
// a single interface keyed to the ClinicalProfile, so callers never have to
// wire dominantKey and allScores manually.
//
// This layer is the single point of enforcement for:
//   · Absolute contraindications (pregnancy, hypertension, finasteride age gates)
//   · Suppression rules (SR_001–SR_008: TE GOLD, HBR, GI Gold, oxidative gates)
//   · Protocol overrides (Rule 1A triple-condition, SR_004 female-under-30)
//   · Forbidden kit combinations (KF_001–KF_004: ingredient overlap blocks)
// ─────────────────────────────────────────────────────────────────────────────

export interface TopicalRecommendationContext {
  contraindications: ReturnType<typeof validateContraindications>;
  blockedTopicals: string[];
  isPregnantOrPlanning: boolean;
}

/**
 * Derives all topical contraindications for a patient without requiring a
 * scored protocol. Use before kit assembly to detect hard-stop conditions early.
 */
export function buildTopicalContext(ans: PatientAnswers): TopicalRecommendationContext {
  return {
    contraindications: validateContraindications(ans),
    blockedTopicals: getBlockedTopicals(ans),
    isPregnantOrPlanning: isPregnantOrPlanning(ans),
  };
}

/**
 * Evaluates full therapy eligibility — suppression rules, forbidden combinations,
 * and protocol overrides — for a proposed kit phase list.
 *
 * Call AFTER validateContraindications() confirms no HARD_STOP.
 * Call BEFORE rendering the recommendation report.
 */
export function evaluateTherapyEligibility(
  ans: PatientAnswers,
  profile: ClinicalProfile,
  phases: string[],
): ReturnType<typeof checkTherapyEligibility> {
  return checkTherapyEligibility(
    ans,
    phases,
    profile.primaryDiagnosis,
    profile.allScores as Record<string, number>,
  );
}

/**
 * Applies all therapy blocks and returns the cleaned kit list.
 * If a protocol override is triggered, returns the override kit sequence directly.
 */
export function filterEligibleKits(
  ans: PatientAnswers,
  profile: ClinicalProfile,
  phases: string[],
): string[] {
  return applyTherapyBlocks(
    ans,
    phases,
    profile.primaryDiagnosis,
    profile.allScores as Record<string, number>,
  );
}
