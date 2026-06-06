// ─── Composers Layer — Public Exports ────────────────────────────────────────
// Re-exports all composer functions, shared utilities, and types.

export type {
  NarrativeTarget,
  TargetConstraints,
  ComposeOptions,
  ComposedSegment,
  ComposedNarrative,
} from './types';

export { TARGET_CONSTRAINTS }                from './types';

export { composeClinicalNarrative }          from './composeClinicalNarrative';
export { composePatientNarrative }           from './composePatientNarrative';
export { composePrognosis }                  from './composePrognosis';
export { composeTherapyExplanation }         from './composeTherapyExplanation';
export { composeLifestylePlan }              from './composeLifestylePlan';
export { composeMonitoringPlan }             from './composeMonitoringPlan';
