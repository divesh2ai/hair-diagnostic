import type { PatientAnswers } from '../../types';
import type { ClinicalProfile } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE SNAPSHOT — ClinicalProfile → immutable clinical replay object
//
// A snapshot is a point-in-time freeze of the engine's full input + output.
// It supports:
//   · Replay engine  — re-run exactly the same recommendation from stored input
//   · Audit trail    — clinic dashboards can trace every decision to its inputs
//   · AI narration   — LLM receives a stable, structured context object
//   · Regression CI  — snapshot diff catches silent scoring changes
//
// The snapshot is intentionally read-only at the TypeScript level (Object.freeze).
// snapshotId is deterministic when provided (e.g., from a session/patient ID),
// otherwise auto-generated from timestamp + entropy for uniqueness.
// ─────────────────────────────────────────────────────────────────────────────

const ENGINE_VERSION = '1.0.0';

export interface ClinicalSnapshot {
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly engineVersion: string;
  readonly patientAnswers: Readonly<PatientAnswers>;
  readonly profile: Readonly<ClinicalProfile>;
}

/**
 * Produces an immutable clinical snapshot from a patient's answers and the
 * resulting ClinicalProfile. Freeze is shallow — nested arrays inside
 * patientAnswers and profile are not deeply frozen, matching JSON serialisation
 * semantics (downstream consumers should treat the whole object as read-only).
 *
 * @param ans         Normalised patient answers used to produce the profile.
 * @param profile     The ClinicalProfile returned by evaluateClinicalProfile().
 * @param snapshotId  Optional stable ID (e.g. session UUID). Auto-generated if omitted.
 */
export function generateSnapshot(
  ans: PatientAnswers,
  profile: ClinicalProfile,
  snapshotId?: string,
): ClinicalSnapshot {
  return Object.freeze({
    snapshotId: snapshotId ?? generateSnapshotId(),
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    patientAnswers: Object.freeze({ ...ans }),
    profile: Object.freeze({ ...profile }),
  });
}

function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
