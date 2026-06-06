import type { TherapyNeed } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from './types';
import { DIAGNOSIS_TO_NEEDS, SECONDARY_NEEDS } from './needsMatrix';

// ─────────────────────────────────────────────────────────────────────────────
// THERAPY ENGINE — ClinicalProfile → TherapyNeeds
//
// Translates clinical diagnoses into therapy objectives.
// Has no knowledge of kits, brands, or clinic configuration.
// This abstraction layer is required for multi-clinic scalability —
// different clinics map the same TherapyNeeds to different product portfolios.
// ─────────────────────────────────────────────────────────────────────────────

export function mapTherapyNeeds(profile: ClinicalProfile): TherapyNeeds {
  const needSet = new Set<TherapyNeed>();
  const needReasons: Partial<Record<TherapyNeed, string[]>> = {};

  function addNeed(need: TherapyNeed, reason: string): void {
    needSet.add(need);
    if (!needReasons[need]) needReasons[need] = [];
    needReasons[need]!.push(reason);
  }

  // Primary diagnosis needs
  const primaryNeeds = DIAGNOSIS_TO_NEEDS[profile.primaryDiagnosis] ?? [];
  for (const need of primaryNeeds) {
    addNeed(need, `Primary diagnosis: ${profile.primaryDiagnosis}`);
  }

  // Secondary condition additive needs
  for (const secondary of profile.secondaryDiagnoses) {
    const additiveNeeds = SECONDARY_NEEDS[secondary.key] ?? [];
    for (const need of additiveNeeds) {
      addNeed(need, `Secondary condition: ${secondary.key} (score: ${secondary.score})`);
    }
  }

  // Root cause augmentation — adds therapy needs not already covered by diagnosis
  const { rootCauses, flags } = profile;

  if (rootCauses.includes('IRON_DEFICIENCY'))   addNeed('IRON_REPLETION',         'Confirmed iron deficiency');
  if (rootCauses.includes('GUT_MALABSORPTION')) addNeed('GUT_RESTORATION',        'Active gut issues detected');
  if (rootCauses.includes('OXIDATIVE_STRESS'))  addNeed('ANTIOXIDANT_SUPPORT',    'Smoking / vaping / alcohol detected');
  if (rootCauses.includes('METABOLIC'))         addNeed('METABOLIC_SUPPORT',      'Metabolic signal confirmed');
  if (rootCauses.includes('HYPOTHYROID'))       addNeed('THYROID_SUPPORT',        'Hypothyroidism confirmed');
  if (rootCauses.includes('POST_PARTUM'))       addNeed('IMMUNE_MODULATION',      'Post-partum immune depletion');
  if (flags.hasGreyGoal)                        addNeed('MELANOCYTE_PROTECTION',  'Early greying co-concern');

  return {
    needs: Array.from(needSet),
    needReasons,
  };
}
