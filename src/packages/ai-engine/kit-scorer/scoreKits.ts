import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { TherapyNeeds } from '../therapy-engine/types';

import type {
  KitRecommendation,
  ClinicConfig,
  BudgetProfile,
} from './types';

import { buildKitSequence } from './sequence/buildKitSequence';
import { buildDecisions, buildTrace } from '../recommendation-decision';

// ─────────────────────────────────────────────────────────────────────────────
// KIT SCORER — CONDITION-FIRST ENGINE
//
// Public entry point. Delegates clinical decisions to buildKitSequence and
// then, when opt-in trace mode is enabled, threads the diagnostics that
// execution emitted into the canonical recommendation-decision adapter.
//
// The adapter does NOT re-invoke detectConditions, resolveKitInteractions,
// or evaluateSafety — it consumes the exact intermediate values captured
// during THIS execution. When trace is off, this file behaves byte-for-byte
// as before: no adapter runs, no `decisions` or `trace` fields are attached,
// and no clinical output changes.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreKitsOptions {
  /**
   * Development / QA / doctor-diagnostics trace. When true, the returned
   * KitRecommendation carries `diagnostics`, `decisions`, and `trace`
   * additive fields. MUST NOT be enabled on patient-facing routes.
   */
  readonly trace?: boolean;
  /**
   * Assessment id used to tag the trace payload. Optional — falls back to
   * "unknown-assessment" when omitted.
   */
  readonly assessmentId?: string;
  readonly fixtureProvenance?: {
    readonly source: 'synthetic' | 'existing_regression' | 'anonymized_real_case';
    readonly expectedOutputSource: 'none' | 'accepted_baseline' | 'clinical_rule_reference';
    readonly intent: readonly ('trace_completeness' | 'safety' | 'ordering' | 'eligibility')[];
    readonly clinicalCorrectnessAsserted: boolean;
  };
}

export function scoreKits(
  profile: ClinicalProfile,
  therapyNeeds: TherapyNeeds,
  ans: PatientAnswers,
  clinicConfig: ClinicConfig,
  budgetProfile?: BudgetProfile,
  options?: ScoreKitsOptions,
): KitRecommendation {
  const result = buildKitSequence(
    profile,
    therapyNeeds,
    ans,
    clinicConfig,
    budgetProfile,
    options?.trace ? { trace: true, therapyNeeds } : undefined,
  );

  // Non-trace path — return unchanged.
  if (!options?.trace) return result;

  const diagnostics = result.diagnostics;
  if (!diagnostics) return result;

  const decisions = buildDecisions(diagnostics);
  const trace = buildTrace(
    options.assessmentId ?? 'unknown-assessment',
    diagnostics,
    decisions,
    options.fixtureProvenance,
  );

  return {
    ...result,
    decisions,
    trace,
  };
}
