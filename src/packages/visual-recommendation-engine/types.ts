import { VisualAsset } from '../visual-library/types';

export interface VisualSection {
  sectionTitleKey: string; // Used for translation (e.g., 'REPORT_SECTION_SCALP_HEALTH')
  sectionDescriptionKey: string;
  defaultTitle: string;
  defaultDescription: string;
  visuals: VisualAsset[];
}

export interface VisualJourney {
  assessmentId: string;
  sections: VisualSection[];
  generatedAt: Date;
}
