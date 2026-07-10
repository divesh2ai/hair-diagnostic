export type {
  ClinicalContext,
  SelectedKit,
  RejectedKit,
  PhasePlan,
  KitRationale,
} from './types';
export { buildClinicalContext } from './buildClinicalContext';
export type { BuildClinicalContextInput } from './buildClinicalContext';
export { explainKits } from './explainKits';
export type {
  KitExplanation,
  RejectedKitExplanation,
  KitExplanations,
} from './explainKits';
export {
  validateReasoningCompleteness,
  formatReasoningGaps,
} from './validateReasoningCompleteness';
export type {
  ReasoningGap,
  ReasoningGapKind,
  ReasoningCompletenessResult,
  NarrativeSection,
} from './validateReasoningCompleteness';
export { buildExplainabilityPanel } from './explainabilityPanel';
export type {
  ExplainabilityPanel,
  DetectedCondition,
  ClinicalInferenceItem,
  InteractionRuleItem,
  OpenQuestionItem,
} from './explainabilityPanel';
