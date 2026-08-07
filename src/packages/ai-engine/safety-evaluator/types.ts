// Canonical safety / eligibility evaluator — shared types.
//
// One authoritative surface for pregnancy, hypertension, minoxidil, finasteride,
// age-based cautions, kit-combination exclusions, and missing-data flags. Both
// kit selection and topical recommendation consume the SAME evaluator so a
// "blocked" therapy cannot appear in one surface and not the other.
//
// Design principles:
//   1. Structured, not boolean — every result carries a stable ruleId, severity,
//      audience, and rationale so doctor and patient surfaces can render
//      differently without duplicating logic.
//   2. Deterministic — pure over its inputs. No I/O, no clock, no randomness.
//   3. Fail-loud on missing data — under-specified inputs surface as
//      MissingInput entries, never as false negatives.
//   4. Drug-drug interactions are explicitly NOT_EVALUATED. No implicit
//      safety claim is ever made about medication combinations.

export type SafetyRuleId =
  // Pregnancy — kit + topical + planning
  | 'SAFETY_PREGNANCY_KIT_LOCK'
  | 'SAFETY_PREGNANCY_TOPICAL_BLOCK'
  | 'SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK'
  // Hypertension — minoxidil chain
  | 'SAFETY_HYPERTENSION_MINOXIDIL_BLOCK'
  | 'SAFETY_HYPERTENSION_ORAL_MINOXIDIL_CAUTION'
  // Age / sex + finasteride
  | 'SAFETY_FINASTERIDE_MALE_UNDER_18'
  | 'SAFETY_FINASTERIDE_FEMALE_PREGNANCY_POTENTIAL'
  // Age-based cardiac caution
  | 'SAFETY_ORAL_MINOXIDIL_OVER_60_CARDIAC'
  // Kit-combination outcomes (reported from resolveKitInteractions audit trail)
  | 'SAFETY_KIT_COMBINATION_UNIFIED'
  // Missing-data flags
  | 'SAFETY_INPUT_HYPERTENSION_FREE_TEXT_ONLY'
  | 'SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE'
  // Drug-drug interactions — always emitted; safety-critical acknowledgement
  | 'SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED';

export type SafetySeverity =
  /** Absolute stop. Kit or topical must NEVER be dispensed. */
  | 'BLOCK'
  /** Non-blocking clinical caution requiring doctor decision. */
  | 'CAUTION'
  /** Informational — a kit swap or unification was applied upstream. */
  | 'INFO'
  /** The rule couldn't be evaluated because required input is missing. */
  | 'MISSING_INPUT'
  /** Explicit acknowledgement that a class of checks was not performed. */
  | 'NOT_EVALUATED';

export type SafetyAudience = 'DOCTOR' | 'PATIENT' | 'BOTH';

export interface SafetyFinding {
  ruleId: SafetyRuleId;
  severity: SafetySeverity;
  audience: SafetyAudience;
  /** Short, doctor-facing label (used in dashboard chips). */
  title: string;
  /** Doctor-facing rationale. May reference clinical fields. */
  doctorRationale: string;
  /**
   * Patient-facing message. MUST be cautious, MUST NOT expose internal kit ids,
   * rule ids, or engine terminology. Empty string when audience === 'DOCTOR'.
   */
  patientMessage: string;
  /** Kit ids to remove from the recommendation set. Case-sensitive match. */
  blockedKits?: readonly string[];
  /** Topical product names (verbatim) to drop from recommendations. */
  blockedTopicals?: readonly string[];
  /**
   * Kit or topical ids the evaluator considers a safe alternative given the
   * rule that fired. Not a prescription — the doctor still chooses.
   */
  safeAlternatives?: readonly string[];
  /**
   * If the rule requires additional confirmation from the doctor, describe
   * exactly what needs to be confirmed before dispensing.
   */
  escalation?: string;
  /**
   * Optional source evidence — which patient answer fields fired the rule.
   * Populated only when useful for the doctor to audit.
   */
  sourceFields?: readonly string[];
}

export interface SafetyEvaluationInput {
  /** Raw patient answers as consumed elsewhere in the engine. */
  answers: import('../../types').PatientAnswers;
  /** Patient demographics — required. */
  patient: { age: number; sex: string };
  /**
   * Kits proposed by the upstream sequencer. The evaluator will report which
   * ones to strip (`blockedKits`), never mutate the array itself.
   */
  proposedKits: readonly string[];
  /**
   * Optional: interaction-resolution audit trail from resolveKitInteractions.
   * Passed through as INFO findings so the eligibility surface reports the
   * full clinical rationale in one place.
   */
  kitInteractionAudit?: readonly string[];
}

export interface SafetyEvaluationResult {
  /** Every finding, ordered severity-first (BLOCK > CAUTION > MISSING_INPUT > INFO > NOT_EVALUATED). */
  findings: SafetyFinding[];
  /** Deduplicated union of all blockedKits across BLOCK findings. */
  blockedKits: readonly string[];
  /** Deduplicated union of all blockedTopicals across BLOCK findings. */
  blockedTopicals: readonly string[];
  /** Doctor-facing summary object. */
  doctorView: SafetyDoctorView;
  /** Patient-facing summary object (cautious, no ids, no engine language). */
  patientView: SafetyPatientView;
  /** True when at least one BLOCK-severity finding fired. */
  hasBlock: boolean;
  /**
   * True when at least one MISSING_INPUT finding fired — doctor should collect
   * additional data before finalising.
   */
  hasUnresolvedSafetyCheck: boolean;
}

export interface SafetyDoctorView {
  /** Every BLOCK finding, most critical first. */
  blocks: SafetyFinding[];
  /** Non-blocking cautions requiring doctor judgement. */
  cautions: SafetyFinding[];
  /** Missing-input warnings that must be resolved before dispensing. */
  unresolvedChecks: SafetyFinding[];
  /** Interaction / unification actions taken upstream (audit-only). */
  informational: SafetyFinding[];
  /** NOT_EVALUATED acknowledgements (always includes drug-drug). */
  notEvaluated: SafetyFinding[];
}

export interface SafetyPatientView {
  /** Cautious plain-language safety messages the patient should be aware of. */
  messages: string[];
  /**
   * True if the patient's report will be gated on doctor confirmation because
   * a safety block or missing-input finding fired. Front-ends can use this to
   * show a "your doctor will review this before your kit is dispatched" banner.
   */
  awaitsDoctorConfirmation: boolean;
}
