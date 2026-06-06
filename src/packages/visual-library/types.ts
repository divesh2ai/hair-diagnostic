export type VisualCategory =
  | 'scalp'
  | 'hair_cycle'
  | 'regrowth'
  | 'stress'
  | 'nutrition'
  | 'lifestyle'
  | 'hormonal';

export interface VisualAsset {
  id: string;
  category: VisualCategory;
  
  // Condition triggers (e.g., ['diffuse_shedding', 'telogen_effluvium', 'inflammation'])
  conditionTags: string[];
  
  // Optional contextual modifiers
  severity?: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  gender?: 'male' | 'female' | 'universal';
  
  // CDN path to the cinematic asset (highly realistic biological rendering)
  imageUrl: string;
  
  // Localization-ready keys for translation layers
  captionKey?: string;
  clinicalExplanationKey?: string;
  
  // Defaults for English rendering and fallback
  defaultCaption: string;
  defaultExplanation: string;
}
