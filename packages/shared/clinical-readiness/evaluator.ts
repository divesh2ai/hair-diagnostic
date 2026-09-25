// ─────────────────────────────────────────────────────────────────────────────
// evaluateClinicalReadinessForApproval — the single canonical decision
// function every approval / release gate calls. Pure, deterministic, never
// throws.
//
// Contract:
//   • Input is either a persisted Consultation or a standalone
//     ClinicalReadinessSnapshot. The evaluator does NOT rerun the clinical
//     pipeline — it inspects the snapshot the composer already produced.
//   • Historical consultations (composed before this milestone) have no
//     snapshot. Policy: FAIL CLOSED with READINESS_SNAPSHOT_MISSING. A
//     revise() will produce a fresh snapshot naturally; there is no silent
//     grandfathering of unvalidated content.
//   • Grounding violations are blocking. A single unresolved violation is
//     enough to block release.
//   • Reasoning gaps are blocking by default (the existing PDF engine
//     already blocks on them). This preserves parity between render-time
//     and approval-time gates.
//   • Malformed / partial snapshots fail closed via READINESS_SNAPSHOT_MALFORMED.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ClinicalReadinessSnapshot,
  Consultation,
  ReadinessGroundingViolation,
  ReadinessReasoningGap,
} from "../types/consultation";

export type ReadinessBlockingCode =
  | "GROUNDING_VIOLATION_PRESENT"
  | "REASONING_GAP_PRESENT"
  // A recommendation-level evidence failure: a kit is in the protocol with NO
  // driver, therapy need or rationale — nothing supports WHY it was selected.
  // This is a treatment-safety failure, not a narrative-prose one, so it is a
  // HARD block (see isSoftAdvisoryOnly). It is derived from the reasoning-gap
  // kind `kit.missingTrigger`, which is why it can coexist with
  // REASONING_GAP_PRESENT on the same decision.
  | "RECOMMENDATION_UNSUPPORTED_PRESENT"
  | "READINESS_SNAPSHOT_MISSING"
  | "READINESS_SNAPSHOT_MALFORMED";

export interface ReadinessDecision {
  /** True iff the consultation may be approved / released. */
  readonly ready: boolean;
  /** Stable machine-readable codes; empty when ready. */
  readonly blockingCodes: readonly ReadinessBlockingCode[];
  readonly groundingViolationCount: number;
  readonly reasoningGapCount: number;
  /**
   * Doctor-readable one-line summary. Safe for structured logs. Never
   * contains patient answers, tokens, URLs, or exception messages.
   */
  readonly doctorSummary: string;
  /** For the doctor UI. Empty for patient-token audience callers. */
  readonly groundingViolations: readonly ReadinessGroundingViolation[];
  readonly reasoningGaps: readonly ReadinessReasoningGap[];
}

export function evaluateClinicalReadinessForApproval(
  subject: Consultation | ClinicalReadinessSnapshot | null | undefined,
): ReadinessDecision {
  const snapshot = extractSnapshot(subject);

  if (snapshot === null) {
    return {
      ready: false,
      blockingCodes: ["READINESS_SNAPSHOT_MISSING"],
      groundingViolationCount: 0,
      reasoningGapCount: 0,
      doctorSummary:
        "This consultation predates the clinical-readiness evidence contract. Please regenerate or revise before approving.",
      groundingViolations: [],
      reasoningGaps: [],
    };
  }
  if (snapshot === "malformed") {
    return {
      ready: false,
      blockingCodes: ["READINESS_SNAPSHOT_MALFORMED"],
      groundingViolationCount: 0,
      reasoningGapCount: 0,
      doctorSummary:
        "The clinical-readiness snapshot on this consultation is malformed. Please recompose the consultation.",
      groundingViolations: [],
      reasoningGaps: [],
    };
  }

  const groundingCount = snapshot.groundingViolations.length;
  const gapCount = snapshot.reasoningGaps.length;
  // A recommendation-level failure: a kit was selected with no driver / therapy
  // need / rationale at all. Distinguished from the narrative-prose reasoning
  // gaps (kit/condition not named, empty section) by its kind, so it can be a
  // HARD block while the narrative ones stay soft.
  const unsupportedRecommendation = snapshot.reasoningGaps.some(
    (g) => g.kind === "kit.missingTrigger",
  );
  const codes: ReadinessBlockingCode[] = [];
  if (groundingCount > 0) codes.push("GROUNDING_VIOLATION_PRESENT");
  if (gapCount > 0) codes.push("REASONING_GAP_PRESENT");
  if (unsupportedRecommendation) codes.push("RECOMMENDATION_UNSUPPORTED_PRESENT");

  const ready = codes.length === 0 && snapshot.isReadyForApproval;

  return {
    ready,
    blockingCodes: codes,
    groundingViolationCount: groundingCount,
    reasoningGapCount: gapCount,
    doctorSummary: ready
      ? "Clinical evidence contract satisfied. Ready for approval."
      : buildBlockedSummary(groundingCount, gapCount),
    groundingViolations: snapshot.groundingViolations,
    reasoningGaps: snapshot.reasoningGaps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hard / soft governance — the SINGLE classifier every gate shares.
//
// A not-ready decision is one of two things, and approval, report rendering and
// PDF/one-pager generation must all agree on which:
//
//   SOFT ADVISORY — blocked ONLY by narrative/reasoning-completeness gaps
//     (REASONING_GAP_PRESENT): a kit not named in the write-up, a detected
//     condition not spelled out, a thin explanation. These are AI
//     documentation-quality notes, NOT clinical contraindications. They are
//     recorded and shown in "AI Review Notes", but they must NOT block approval,
//     report rendering, PDF generation or patient delivery.
//
//   HARD BLOCK — everything else that is not ready: a grounding violation (a
//     recommendation not traceable to recorded evidence), a missing or malformed
//     readiness snapshot, or any MIXED set containing one of those. These stop
//     approval AND report/PDF release.
//
// Defining both here — rather than re-deriving the predicate at each gate — is
// what stops the approval gate and the PDF gate from ever drifting apart again.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when a decision is blocked ONLY by soft AI-narrative advisories.
 *
 * Two blocking codes are soft — both are NARRATIVE / documentation-quality
 * defects, NOT treatment-safety failures (kit selection is driven by recorded
 * facts, never by the narrative prose):
 *
 *   • REASONING_GAP_PRESENT      — a recommendation the write-up explains thinly,
 *                                  or a condition/kit not named in the narrative.
 *   • GROUNDING_VIOLATION_PRESENT — a narrative SENTENCE mentions something the
 *                                  patient did not report (e.g. GLP-1 wording
 *                                  inserted without evidence). This is Rule 2 /
 *                                  Rule 7 on the prose — the fix is to correct
 *                                  the sentence, not to block the clinician.
 *
 * Neither blocks approval, report rendering, PDF or delivery. A ready decision
 * is trivially not blocked, so it is not "soft advisory only" — callers gate on
 * {@link isHardBlocked} or `ready` directly.
 *
 * A missing or malformed readiness snapshot is an INTEGRITY failure, never soft.
 */
export function isSoftAdvisoryOnly(decision: ReadinessDecision): boolean {
  if (decision.blockingCodes.length === 0) return false;
  // Hard failures are never soft: an integrity failure (corrupt / absent
  // readiness data) or a recommendation-level evidence failure (a kit with no
  // support at all). Both are treatment-safety / data-integrity concerns, not
  // narrative prose.
  const hasHardFailure = decision.blockingCodes.some(
    (c) =>
      c === "READINESS_SNAPSHOT_MISSING" ||
      c === "READINESS_SNAPSHOT_MALFORMED" ||
      c === "RECOMMENDATION_UNSUPPORTED_PRESENT",
  );
  if (hasHardFailure) return false;
  // Otherwise the block is only narrative-quality (reasoning and/or grounding).
  return decision.blockingCodes.every(
    (c) => c === "REASONING_GAP_PRESENT" || c === "GROUNDING_VIOLATION_PRESENT",
  );
}

/**
 * True when a decision carries a HARD blocker that must stop approval AND
 * report/PDF release: not ready, and not soft-advisory-only. A ready decision
 * is never hard-blocked.
 */
export function isHardBlocked(decision: ReadinessDecision): boolean {
  return !decision.ready && !isSoftAdvisoryOnly(decision);
}

/** Strip doctor-only violation detail before returning to a patient-scoped surface. */
export function toPatientSafeReadinessDecision(
  decision: ReadinessDecision,
): Omit<ReadinessDecision, "groundingViolations" | "reasoningGaps" | "doctorSummary"> {
  return {
    ready: decision.ready,
    blockingCodes: decision.blockingCodes,
    groundingViolationCount: decision.groundingViolationCount,
    reasoningGapCount: decision.reasoningGapCount,
  };
}

function buildBlockedSummary(g: number, r: number): string {
  const parts: string[] = [];
  if (g > 0) parts.push(`${g} unresolved grounding violation${g === 1 ? "" : "s"}`);
  if (r > 0) parts.push(`${r} unresolved reasoning gap${r === 1 ? "" : "s"}`);
  return `Blocked: ${parts.join("; ")}.`;
}

// null → snapshot absent; "malformed" → present but not a valid snapshot;
// otherwise → the snapshot.
function extractSnapshot(
  subject: Consultation | ClinicalReadinessSnapshot | null | undefined,
): ClinicalReadinessSnapshot | null | "malformed" {
  if (!subject || typeof subject !== "object") return null;

  // A raw snapshot is recognised only when it clearly carries snapshot-shaped
  // fields. Anything else is treated as a Consultation wrapper — including
  // an empty object, which represents a historical row with no snapshot yet.
  if (looksLikeSnapshot(subject)) {
    return isSnapshotShape(subject) ? subject : "malformed";
  }

  const maybe = (subject as Consultation).clinicalReadiness;
  if (maybe === undefined || maybe === null) return null;
  if (!isSnapshotShape(maybe)) return "malformed";
  return maybe;
}

function looksLikeSnapshot(v: unknown): boolean {
  return (
    !!v &&
    typeof v === "object" &&
    "schemaVersion" in (v as Record<string, unknown>) &&
    "isReadyForApproval" in (v as Record<string, unknown>)
  );
}

function isSnapshotShape(v: unknown): v is ClinicalReadinessSnapshot {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    s.schemaVersion === 1 &&
    typeof s.evaluatedAt === "string" &&
    typeof s.sourceClinicalArtifactVersion === "string" &&
    typeof s.isReadyForApproval === "boolean" &&
    Array.isArray(s.groundingViolations) &&
    Array.isArray(s.reasoningGaps) &&
    Array.isArray(s.blockingCodes) &&
    typeof s.summary === "object" &&
    s.summary !== null
  );
}
