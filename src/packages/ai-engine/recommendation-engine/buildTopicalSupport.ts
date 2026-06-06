import type { ClinicalProfile } from './buildTherapyRouting';
import type { SupportedTopical } from './buildTopicalSupport';

export interface TopicalSupportResult {
  readonly selectedTopical: SupportedTopical | null;
  readonly rationale: string;
  readonly usageFrequency: string;
  readonly contraindications: readonly string[];
}

export const buildTopicalSupport = (
  profile: ClinicalProfile
): TopicalSupportResult => {
  const hasHighDhtBurden = profile.hasHighDhtBurden ?? false;
  const isAdvancedGrade = profile.isAdvancedGrade ?? false;

  if (profile.gender === 'Male' && hasHighDhtBurden && isAdvancedGrade) {
    return {
      selectedTopical: 'EMUGROW_MCRD',
      rationale: 'Male AGA with high DHT burden and advanced grade.',
      usageFrequency: 'ONCE_DAILY',
      contraindications: ['Scalp irritation', 'Active inflammation']
    };
  }
  
  if (profile.gender === 'Female' || (!hasHighDhtBurden && !isAdvancedGrade)) {
    return {
      selectedTopical: 'EMUGROW_MCR',
      rationale: 'Female AGA, diffuse thinning, or early/moderate stage.',
      usageFrequency: 'ONCE_DAILY',
      contraindications: ['Pregnancy', 'Breastfeeding']
    };
  }

  return {
    selectedTopical: null,
    rationale: 'No specific topical indicated.',
    usageFrequency: 'NONE',
    contraindications: []
  };
};

export type SupportedTopical = 'EMUGROW_MCR' | 'EMUGROW_MCRD';
