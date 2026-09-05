// The one definition of "this patient has treatment-damage evidence for HBR".
//
// ── Why this module exists ──────────────────────────────────────────────────
// The HBR indication was written down in three places that disagreed:
//
//   · the sequence builder tested `ans.treatment` for heat/chemical,
//   · safety rule SR_005 blocked HBR unless hard water was ALSO present,
//   · the questionnaire's own trigger text said "heat/chemical alone
//     insufficient - requires hard-water corroboration".
//
// So a patient who declared colour treatment was dispensed a kit that the
// safety evaluator marked BLOCKED. The divergence was inert only because
// eligibility is not wired into the dispensing path; it would have become a
// live contradiction the moment anyone connected them.
//
// The approved rule (clinic launch freeze, 2026-09-04) is OR semantics: any
// ONE of chemical treatment, heat styling, or hard-water exposure establishes
// the indication. This module is that rule, and every authoritative source now
// reads from it.
//
// ── What this module is NOT ─────────────────────────────────────────────────
// An indication is not a prescription. Establishing that HBR is clinically
// indicated says nothing about whether it enters a given protocol — that is a
// separate sequencing decision (`resolvedPhases.length === 1`) which lives in
// buildKitSequence and must stay there. Keeping the two apart is what lets a
// multi-kit protocol be shaft-damage-indicated and still not carry HBR.

import type { PatientAnswers } from "../../types";

/**
 * Did the patient decline the question rather than answer it?
 *
 * `signals().treatment()` and the eligibility helpers both match on
 * case-insensitive substrings, so the negative option "No heat or chemical
 * treatments" contains both "heat" and "chemical" and reads as a positive
 * declaration unless it is excluded first.
 */
function isNegativeAnswer(value: string): boolean {
  return /^(no|none|never)\b/.test(value.trim().toLowerCase());
}

/** Declared chemical or heat styling damage - questionnaire Q13 (treatment). */
export function hasTreatmentDamageSignal(ans: PatientAnswers): boolean {
  return (ans.treatment ?? []).some((v) => {
    if (typeof v !== "string") return false;
    if (isNegativeAnswer(v)) return false;
    return /heat|chemical|colour|color|keratin|straighten|bleach|perm|smoothen|rebond|relax/.test(
      v.trim().toLowerCase(),
    );
  });
}

/** Declared hard-water exposure - questionnaire Q4 (suspected cause). */
export function hasHardWaterSignal(ans: PatientAnswers): boolean {
  return (ans.cause ?? []).some(
    (v) => typeof v === "string" && !isNegativeAnswer(v) && /hard\s*water/i.test(v),
  );
}

/**
 * The clinical HBR indication: ANY ONE of chemical treatment, heat styling or
 * hard-water exposure.
 *
 * Deliberately independent of protocol size, diagnosis and kit sequence. The
 * caller decides what to do with an indication; this only reports whether one
 * exists.
 */
export function hasHbrTreatmentDamageIndication(ans: PatientAnswers): boolean {
  return hasTreatmentDamageSignal(ans) || hasHardWaterSignal(ans);
}
