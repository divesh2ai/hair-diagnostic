/**
 * CLINICAL CONTENT EXPANSION LAYER
 *
 * Transforms raw clinical data (enums, signals, scores) into rich,
 * production-quality clinical explanations and narratives.
 *
 * Exports:
 * - Therapy need expansions (8 core therapy needs)
 * - Root cause explanations (9 root causes)
 * - Content assembly utilities
 * - Visual journey population helpers
 */

export { THERAPY_NEED_EXPANSIONS, getTherapyNeedExpansion, getAllTherapyNeedExpansions, type TherapyNeedExpansion } from "./therapyNeedExpansions";

export { ROOT_CAUSE_EXPLANATIONS, getRootCauseExplanation, getAllRootCauseExplanations, type RootCauseExplanation } from "./rootCauseExpansions";
