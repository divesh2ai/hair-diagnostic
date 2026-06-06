// ─────────────────────────────────────────────────────────────────────────────
// HairOS Explanation Layer — Public API
//
// Two layers exported:
//   LAYER 1 — Dictionaries: structured machine-readable explanation entries
//   LAYER 2 — Builders:    narrative/paragraph generators for doctor, patient, report
//
// Usage:
//   import { buildNarrative, SIGNAL_EXPLANATIONS, ExplanationContext } from './explanations';
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  ExplanationEntry,
  ExplanationSeverity,
  FallbackExplanation,
  RankedExplanation,
  SignalDictionary,
  ConditionDictionary,
  TherapyNeedDictionary,
  ScalpStateDictionary,
  LifestyleDictionary,
  RiskFactorDictionary,
  ProtocolExplanationEntry,
  ProtocolDictionary,
  KitDictionaryEntry,
  KitDictionary,
  ClinicalReasoningResult,
  PhaseExplanation,
  SuppressionExplanation,
  ProtocolExplanationResult,
  KitExplanationItem,
  NarrativeLength,
  NarrativeResult,
  ExplanationContext,
} from './types';

// ── LAYER 1: Explanation Dictionaries ────────────────────────────────────────

export { SIGNAL_EXPLANATIONS }      from './dictionaries/signals';
export { CONDITION_EXPLANATIONS }   from './dictionaries/conditions';
export { THERAPY_NEED_EXPLANATIONS } from './dictionaries/therapyNeeds';
export { LIFESTYLE_EXPLANATIONS }   from './dictionaries/lifestyle';
export {
  SCALP_STATE_EXPLANATIONS,
  RISK_FACTOR_EXPLANATIONS,
} from './dictionaries/riskFactors';
export { PROTOCOL_EXPLANATIONS }    from './dictionaries/protocols';
export { KIT_EXPLANATIONS }         from './dictionaries/kits';

// ── LAYER 2: Narrative Builders ───────────────────────────────────────────────

export { buildClinicalReasoning }  from './builders/buildClinicalReasoning';
export { buildProtocolExplanation } from './builders/buildProtocolExplanation';
export { buildKitExplanation }     from './builders/buildKitExplanation';
export { buildDoctorSummary }      from './builders/buildDoctorSummary';
export { buildPatientSummary }     from './builders/buildPatientSummary';
export { buildNarrative }          from './builders/buildNarrative';

// ── Utilities ─────────────────────────────────────────────────────────────────

export {
  getFallback,
  lookupOrFallback,
  getAudienceText,
  composeBullets,
  deduplicateBullets,
  deduplicateStrings,
  sortBySeverityDesc,
  sortByPriorityDesc,
  severityWeight,
  maxSeverity,
  groupByCategory,
  capitalise,
  ensureFullStop,
  formatBullet,
  normaliseKey,
} from './utils';

// ── LAYER 3: Template + Composer Infrastructure ───────────────────────────────

export * from './templates/index';
export * from './composers/index';
