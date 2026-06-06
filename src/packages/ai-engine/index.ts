import type { PatientAnswers } from './types';
import type { ClinicConfig, BudgetProfile, KitRecommendation } from './kit-scorer/types';
import type { ClinicalProfile } from './clinical-engine/types';
import type { TherapyNeeds } from './therapy-engine/types';

import { evaluateClinicalProfile } from './clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from './therapy-engine/mapTherapyNeeds';
import { scoreKits } from './kit-scorer/scoreKits';

export interface HairOSRecommendation {
  clinicalProfile: ClinicalProfile;
  therapyNeeds: TherapyNeeds;
  recommendation: KitRecommendation;
}

/**
 * PUBLIC API ONLY
 * This is the ONLY function external apps should call.
 */
export function runClinicalPipeline(
  ans: PatientAnswers,
  clinicConfig: ClinicConfig,
  budgetProfile: BudgetProfile
): HairOSRecommendation {
  const clinicalProfile = evaluateClinicalProfile(ans);
  const therapyNeeds = mapTherapyNeeds(clinicalProfile);
  const recommendation = scoreKits(
    clinicalProfile,
    therapyNeeds,
    ans,
    clinicConfig,
    budgetProfile
  );

  return { clinicalProfile, therapyNeeds, recommendation };
}