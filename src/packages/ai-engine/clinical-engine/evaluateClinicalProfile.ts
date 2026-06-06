import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from './types';
import { extractFlags } from './signals';
import { checkAbsoluteLocks } from './rules/absoluteLocks';
import { scoreConditions } from './scoreConditions';
import { deriveSignals } from './deriveSignals';
import { buildClinicalProfile } from './buildProtocol';

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL ENGINE — PatientAnswers → ClinicalProfile
//
// Pure orchestration. No clinical logic lives here.
// Each step delegates to its responsible module:
//
//   extractFlags        → signals.ts           (boolean flag extraction)
//   checkAbsoluteLocks  → rules/absoluteLocks  (pregnancy, early-grey locks)
//   scoreConditions     → scoreConditions.ts   (regrow path · grade override · scoring engine)
//   deriveSignals       → deriveSignals.ts     (scalp states · root causes · severity)
//   buildClinicalProfile → buildProtocol.ts   (profile assembly)
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateClinicalProfile(ans: PatientAnswers): ClinicalProfile {
  const flags = extractFlags(ans);

  // ── 1. Absolute locks — evaluated before the scoring engine ──────────────
  const lock = checkAbsoluteLocks(ans, flags);
  if (lock.locked) {
    return buildClinicalProfile(
      { dominant: lock.key, topScore: 100, secondary: [], allScores: { [lock.key]: 100 } },
      deriveSignals(ans),
      flags,
    );
  }

  // ── 2. Score conditions (regrow path · grade override · full engine) ──────
  const scored = scoreConditions(ans, flags);

  // ── 3. Derive scalp states, root causes, severity ─────────────────────────
  const derived = deriveSignals(ans);

  // ── 4. Assemble and return the clinical profile ───────────────────────────
  return buildClinicalProfile(scored, derived, flags);
}
