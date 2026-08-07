// Canonical acute-onset detector — boundary + integration tests.
//
// The three-month acute-shedding window is a locked clinical rule. This suite
// pins:
//   1. Every representative duration phrase in the questionnaire produces the
//      same outcome across all live callers of the underlying predicate.
//   2. MISSING_INPUT is deterministic when duration is empty / whitespace and
//      never silently downgrades to "chronic".
//   3. Historical boolean call sites keep the same policy — the wrapper does
//      not change the answer, only annotates it.

import { describe, it, expect } from "@jest/globals";
import {
  evaluateAcuteOnset,
  isAcuteOnset,
} from "../../src/packages/ai-engine/clinical-engine/onset/acuteOnset";
import { isTeGoldDurationAboveThreeMonths } from "../../src/packages/ai-engine/kit-scorer/rules/teGoldGatingRule";

describe("evaluateAcuteOnset — outcome + reason code", () => {
  const acuteInputs = [
    "less than 3 months",
    "under 3 months",
    "1-3 months",
    "0-3 months",
    "up to 3 months",
    "1",
    "2",
    "3",
  ];
  const chronicInputs = [
    "more than 3 months",
    "over 3 months",
    "6 months",
    "12 months",
    "4",
    "24",
    "6+ months",
    "> 3 months",
  ];
  const missingInputs = ["", "   ", undefined];

  for (const d of acuteInputs) {
    it(`ACUTE — "${d}"`, () => {
      const r = evaluateAcuteOnset({ duration: d });
      expect(r.outcome).toBe("ACUTE");
      expect(r.reasonCode).toBe("ACUTE_ONSET_WITHIN_3_MONTHS");
      expect(r.acute).toBe(true);
    });
  }

  for (const d of chronicInputs) {
    it(`CHRONIC — "${d}"`, () => {
      const r = evaluateAcuteOnset({ duration: d });
      expect(r.outcome).toBe("CHRONIC");
      expect(r.reasonCode).toBe("CHRONIC_ONSET_BEYOND_3_MONTHS");
      expect(r.acute).toBe(false);
    });
  }

  for (const d of missingInputs) {
    it(`MISSING_INPUT — ${JSON.stringify(d)}`, () => {
      const r = evaluateAcuteOnset({ duration: d });
      expect(r.outcome).toBe("MISSING_INPUT");
      expect(r.reasonCode).toBe("ACUTE_ONSET_DURATION_UNKNOWN");
      expect(r.acute).toBe(false);
    });
  }
});

describe("isAcuteOnset ≡ !isTeGoldDurationAboveThreeMonths for present inputs", () => {
  const allDurations = [
    "less than 3 months",
    "1-3 months",
    "3",
    "4",
    "6 months",
    "12+ months",
    "more than 3 months",
    "over 3 months",
  ];
  for (const d of allDurations) {
    it(`policy invariant — "${d}"`, () => {
      // The wrapper must never disagree with the historically-authoritative
      // predicate for present, non-empty inputs. Only the empty case is
      // where the wrapper adds a MISSING_INPUT signal instead of returning
      // the raw `false`.
      expect(isAcuteOnset(d)).toBe(!isTeGoldDurationAboveThreeMonths(d));
    });
  }

  it("empty input: wrapper returns false (MISSING_INPUT), predicate returns false — same boolean", () => {
    expect(isAcuteOnset("")).toBe(false);
    expect(isTeGoldDurationAboveThreeMonths("")).toBe(false);
  });
});
