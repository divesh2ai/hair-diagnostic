import { NormalizedClinicalProfile } from '../questionnaire-normalizer/types';
import { VISUAL_ASSETS, VisualAsset } from '../visual-library';
import { VisualJourney, VisualSection } from './types';

/**
 * Transforms cold clinical data into an emotional, educational, and
 * deeply cinematic visual journey for the PDF Report.
 */
export function buildVisualJourney(assessmentId: string, rawProfile: unknown): VisualJourney {
  // Guard: rawProfile may be raw questionnaire answers (not a NormalizedClinicalProfile)
  // when called during idempotency resume. Normalise defensively.
  const profile: NormalizedClinicalProfile = {
    hairfallSeverity:      (rawProfile as any)?.hairfallSeverity      ?? 'NONE',
    sheddingPattern:       (rawProfile as any)?.sheddingPattern        ?? 'UNKNOWN',
    inflammatorySignals:   Array.isArray((rawProfile as any)?.inflammatorySignals)  ? (rawProfile as any).inflammatorySignals  : [],
    hormonalSignals:       Array.isArray((rawProfile as any)?.hormonalSignals)      ? (rawProfile as any).hormonalSignals      : [],
    metabolicSignals:      Array.isArray((rawProfile as any)?.metabolicSignals)     ? (rawProfile as any).metabolicSignals     : [],
    deficiencySignals:     Array.isArray((rawProfile as any)?.deficiencySignals)    ? (rawProfile as any).deficiencySignals    : [],
    psychologicalSignals:  Array.isArray((rawProfile as any)?.psychologicalSignals) ? (rawProfile as any).psychologicalSignals : [],
    lifestyleSignals:      Array.isArray((rawProfile as any)?.lifestyleSignals)     ? (rawProfile as any).lifestyleSignals     : [],
    medicalHistory:        Array.isArray((rawProfile as any)?.medicalHistory)       ? (rawProfile as any).medicalHistory       : [],
  };

  // Helper to fetch visuals based on clinical triggers
  const findAssets = (tags: string[], max: number = 2): VisualAsset[] => {
    // Score assets based on how many tags they match
    const scored = VISUAL_ASSETS.map(asset => {
      const matchCount = asset.conditionTags.filter(tag => tags.includes(tag)).length;
      return { asset, matchCount };
    });
    
    // Sort by highest match and return top 'max'
    return scored
      .filter(item => item.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .map(item => item.asset)
      .slice(0, max);
  };

  const sections: VisualSection[] = [];

  // ==========================================
  // SECTION 1: SCALP ENVIRONMENT
  // ==========================================
  const scalpTags: string[] = [];
  if (profile.inflammatorySignals.includes('SEVERE_INFLAMMATION')) scalpTags.push('inflammation');
  if (profile.inflammatorySignals.includes('DRY_DANDRUFF') || profile.inflammatorySignals.includes('OILY_DANDRUFF')) scalpTags.push('dandruff', 'scalp_buildup');
  
  if (scalpTags.length > 0) {
    sections.push({
      sectionTitleKey: 'section.scalp',
      sectionDescriptionKey: 'section.scalp.desc',
      defaultTitle: 'Your Scalp Environment',
      defaultDescription: 'Like soil to a plant, a healthy scalp is absolutely required for hair growth. We detected imbalances that are choking your hair roots.',
      visuals: findAssets(scalpTags, 2)
    });
  }

  // ==========================================
  // SECTION 2: BIOLOGICAL HAIR CYCLE (WHY IT'S FALLING)
  // ==========================================
  const hairCycleTags = ['recovery_phase']; // We always show recovery!
  
  if (profile.hairfallSeverity === 'HIGH' || profile.hairfallSeverity === 'SEVERE') {
    hairCycleTags.push('telogen_effluvium', 'shedding');
  }
  
  if (profile.sheddingPattern !== 'UNKNOWN') {
    hairCycleTags.push('thinning', 'androgenetic');
  }

  sections.push({
    sectionTitleKey: 'section.biology',
    sectionDescriptionKey: 'section.biology.desc',
    defaultTitle: 'Understanding the Biology',
    defaultDescription: 'Hair loss is rarely permanent death of the follicle. It is a disruption in your cellular growth cycle. Here is exactly what is happening beneath the skin.',
    visuals: findAssets(hairCycleTags, 3)
  });

  // ==========================================
  // SECTION 3: INTERNAL TRIGGERS
  // ==========================================
  const triggerTags: string[] = [];
  if (profile.deficiencySignals.includes('IRON')) triggerTags.push('iron_deficiency', 'anemia');
  if (profile.psychologicalSignals.includes('HIGH_STRESS')) triggerTags.push('stress', 'cortisol');
  if (profile.hormonalSignals.includes('PCOS') || profile.sheddingPattern === 'FRONTAL') triggerTags.push('pcos', 'thinning');
  
  if (triggerTags.length > 0) {
    sections.push({
      sectionTitleKey: 'section.triggers',
      sectionDescriptionKey: 'section.triggers.desc',
      defaultTitle: 'The Hidden Internal Triggers',
      defaultDescription: 'Hair is a highly sensitive barometer of your internal health. Our analysis identified specific metabolic and nutritional roadblocks.',
      visuals: findAssets(triggerTags, 2)
    });
  }

  return {
    assessmentId,
    generatedAt: new Date(),
    sections
  };
}
