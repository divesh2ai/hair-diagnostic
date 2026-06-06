/**
 * HairOS Knowledge Engine
 *
 * Deterministic, structured knowledge retrieval layer.
 * No AI generation. No LLM calls. No embeddings.
 *
 * Provides clinical, scientific, and business knowledge to:
 *   - clinical-engine (condition lookup, contraindication reference)
 *   - therapy-engine (therapy mechanism context)
 *   - topicals-engine (topical penetration, ingredient profiles)
 *   - narrative-engine (patient and doctor explanations)
 *   - doctor dashboard (clinical summaries)
 *   - PDF report generation (structured data blocks)
 *   - 3D avatar script generation (plain-language knowledge segments)
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  // Shared re-exports
  DiagnosisKey,
  TherapyNeed,
  RootCause,
  ScalpState,
  Severity,
  KitId,
  // Classification
  EvidenceLevel,
  IngredientCategory,
  TherapyCategory,
  PrognosisTimeframe,
  PenetrationDepth,
  LifestyleCategory,
  // Condition
  ConditionMechanism,
  ConditionTrigger,
  SymptomProfile,
  ProgressionStage,
  PrognosisEntry,
  ContraindicationEntry,
  ConfidenceFactor,
  ConditionKnowledge,
  // Ingredient
  IngredientInteraction,
  DosageGuidance,
  IngredientKnowledge,
  // Kit
  KitComponent,
  KitKnowledge,
  // Topical
  PenetrationProfile,
  FollicularTargetingProfile,
  ApplicationGuidance,
  IrritationProfile,
  InflammationModulationProfile,
  TopicalKnowledge,
  // Therapy
  TherapyMechanism,
  TherapyKnowledge,
  // Prognosis
  PrognosisOutcome,
  PrognosisModifier,
  PrognosisKnowledge,
  // Lifestyle
  LifestyleRecommendation,
  LifestyleGuidanceKnowledge,
  // Registries
  ConditionKnowledgeRegistry,
  IngredientKnowledgeRegistry,
  KitKnowledgeRegistry,
  TopicalKnowledgeRegistry,
  TherapyKnowledgeRegistry,
  PrognosisKnowledgeRegistry,
  LifestyleKnowledgeRegistry,
  // Results
  KnowledgeRetrievalResult,
  MultiKnowledgeRetrievalResult,
  ValidationResult,
} from './types';

// ─── Loaders ─────────────────────────────────────────────────────────────────
export { loadConditions } from './loaders/loadConditions';
export { loadIngredients } from './loaders/loadIngredients';
export { loadKits } from './loaders/loadKits';
export { loadTopicals } from './loaders/loadTopicals';
export { loadTherapies } from './loaders/loadTherapies';
export { loadPrognosis } from './loaders/loadPrognosis';
export { loadLifestyle } from './loaders/loadLifestyle';

// ─── Condition Retrievers ─────────────────────────────────────────────────────
export {
  getConditionKnowledge,
  getMultipleConditionKnowledge,
  getConditionsByTherapyNeed,
  getConditionsByRootCause,
  getRelatedConditions,
} from './retrievers/getConditionKnowledge';

// ─── Ingredient Retrievers ────────────────────────────────────────────────────
export {
  getIngredientKnowledge,
  getIngredientsByTherapyNeed,
  getIngredientsByCategory,
  getPregnancySafeIngredients,
  getSynergisticIngredients,
} from './retrievers/getIngredientKnowledge';

// ─── Kit Retrievers ───────────────────────────────────────────────────────────
export {
  getKitKnowledge,
  getKitsByDiagnosis,
  getKitsByTherapyNeed,
  getPregnancySafeKits,
} from './retrievers/getKitKnowledge';

// ─── Topical Retrievers ───────────────────────────────────────────────────────
export {
  getTopicalKnowledge,
  getTopicalsByScalpState,
  getTopicalsByTherapyNeed,
  getAntiInflammatoryTopicals,
  getPregnancySafeTopicals,
  getTopicalPenetrationExplanation,
  getFollicularTargetingExplanation,
} from './retrievers/getTopicalKnowledge';

// ─── Therapy Retrievers ───────────────────────────────────────────────────────
export {
  getTherapyKnowledge,
  getTherapiesForCondition,
  getTherapiesByCategory,
  getTherapyKnowledgeForNeeds,
} from './retrievers/getTherapyKnowledge';

// ─── Prognosis Retrievers ─────────────────────────────────────────────────────
export {
  getPrognosisKnowledge,
  getPrognosisForDiagnosis,
  getPrognosisWithFallback,
} from './retrievers/getPrognosisKnowledge';

// ─── Lifestyle Retrievers ─────────────────────────────────────────────────────
export {
  getLifestyleKnowledge,
  getLifestyleForDiagnosis,
  getLifestyleForRootCause,
  getLifestyleByCategory,
  getHighPriorityLifestyleRecommendations,
} from './retrievers/getLifestyleKnowledge';

// ─── Mappers ──────────────────────────────────────────────────────────────────
export {
  mapConditionToKnowledge,
} from './mappers/mapConditionToKnowledge';
export type { ConditionKnowledgeBundle } from './mappers/mapConditionToKnowledge';

export {
  mapKitToIngredients,
} from './mappers/mapKitToIngredients';
export type { KitIngredientMap } from './mappers/mapKitToIngredients';

export {
  mapKitToTopicals,
} from './mappers/mapKitToTopicals';
export type { KitTopicalMap } from './mappers/mapKitToTopicals';

export {
  mapTherapyToMechanisms,
  mapTherapyNeedsToMechanisms,
} from './mappers/mapTherapyToMechanisms';
export type { TherapyMechanismMap } from './mappers/mapTherapyToMechanisms';

export {
  mapDiagnosisToPrognosis,
} from './mappers/mapDiagnosisToPrognosis';
export type { ProgrammedPrognosisNarrative } from './mappers/mapDiagnosisToPrognosis';

// ─── Validators ───────────────────────────────────────────────────────────────
export {
  validateConditionKnowledge,
  assertValidConditionKnowledge,
} from './validators/validateConditionKnowledge';

export {
  validateKitKnowledge,
  assertValidKitKnowledge,
} from './validators/validateKitKnowledge';

export {
  validateIngredientKnowledge,
  assertValidIngredientKnowledge,
} from './validators/validateIngredientKnowledge';
