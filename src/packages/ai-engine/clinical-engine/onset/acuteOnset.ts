// ─────────────────────────────────────────────────────────────────────────────
// Canonical acute-onset detector.
//
// The three-month acute-shedding window is a locked clinical rule used by:
//   • kit-scorer/rules/teGoldGatingRule.ts   (TE GOLD gating)
//   • kit-scorer/rules/activeSheddingRule.ts (final-pass sweep)
//   • kit-scorer/registry/detectConditions.ts (condition detection)
//   • clinical-engine/contraindications/checkTherapyEligibility.ts
//
// Historically each caller either called the raw predicate
// `isTeGoldDurationAboveThreeMonths(duration)` or was tempted to duplicate the
// regex. This module wraps the same underlying predicate with:
//   • an explicit input/output type,
//   • a stable REASON_CODE per outcome so downstream telemetry, the
//     doctor-facing evidence panel, and future audit surfaces reference one
//     identifier rather than a boolean,
//   • a deterministic MISSING_INPUT signal when duration was not captured, so
//     callers can decide to caution/review rather than silently treating
//     "unknown" as "chronic".
//
// This wrapper does NOT change the underlying policy — same predicate, same
// three-month boundary. It only makes the outcome self-describing.
// ─────────────────────────────────────────────────────────────────────────────

import { isTeGoldDurationAboveThreeMonths } from "../../kit-scorer/rules/teGoldGatingRule";

export type AcuteOnsetOutcome = "ACUTE" | "CHRONIC" | "MISSING_INPUT";

export type AcuteOnsetReasonCode =
  | "ACUTE_ONSET_WITHIN_3_MONTHS"
  | "CHRONIC_ONSET_BEYOND_3_MONTHS"
  | "ACUTE_ONSET_DURATION_UNKNOWN";

export interface AcuteOnsetInput {
  /**
   * Raw duration string exactly as captured by the questionnaire
   * (e.g. "1-3 months", "6+ months", "less than 3", "12"). Undefined /
   * empty / whitespace-only counts as MISSING_INPUT — never guessed.
   */
  duration?: string;
}

export interface AcuteOnsetResult {
  outcome: AcuteOnsetOutcome;
  reasonCode: AcuteOnsetReasonCode;
  /** True iff the underlying predicate would classify as within the acute window. */
  acute: boolean;
}

export function evaluateAcuteOnset(input: AcuteOnsetInput): AcuteOnsetResult {
  const raw = (input.duration ?? "").trim();
  if (raw.length === 0) {
    return {
      outcome: "MISSING_INPUT",
      reasonCode: "ACUTE_ONSET_DURATION_UNKNOWN",
      acute: false,
    };
  }
  if (isTeGoldDurationAboveThreeMonths(raw)) {
    return {
      outcome: "CHRONIC",
      reasonCode: "CHRONIC_ONSET_BEYOND_3_MONTHS",
      acute: false,
    };
  }
  return {
    outcome: "ACUTE",
    reasonCode: "ACUTE_ONSET_WITHIN_3_MONTHS",
    acute: true,
  };
}

/**
 * Convenience predicate that preserves the historical `boolean` shape for
 * call sites that only need "was this within the acute window?". New code
 * should prefer `evaluateAcuteOnset` and read `result.reasonCode` for audit.
 */
export function isAcuteOnset(duration?: string): boolean {
  return evaluateAcuteOnset({ duration }).acute;
}
