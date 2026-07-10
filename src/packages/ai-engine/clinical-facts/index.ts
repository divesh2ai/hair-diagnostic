export type { ClinicalFacts, ReportedFindings, ClinicalInferences, FactKey } from './types';
export { buildClinicalFacts, hasFact, hasAllFacts } from './buildClinicalFacts';
export {
  validateEvidenceGrounding,
  formatViolations,
  GROUNDING_RULES,
} from './validateEvidenceGrounding';
export type {
  GroundingRule,
  GroundingResult,
  GroundingViolation,
  SectionInput,
} from './validateEvidenceGrounding';
