// Public surface of the canonical safety / eligibility evaluator. Kit
// selection (buildKitSequence) and topical recommendation (recommendTopicals)
// both consume from here — no separate pregnancy / hypertension / finasteride
// rule paths.

export { evaluateSafety } from './evaluator';
export type {
  SafetyRuleId,
  SafetySeverity,
  SafetyAudience,
  SafetyFinding,
  SafetyEvaluationInput,
  SafetyEvaluationResult,
  SafetyDoctorView,
  SafetyPatientView,
} from './types';
