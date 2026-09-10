// Kit substitution — the contract for supplying an alternative to the kit a
// doctor prescribed.
//
// TYPES ONLY. Nothing here is wired to a runtime path, and no substitution
// behaviour exists yet. The owner will supply the approved alternative/
// lower-cost kits and say which substitutions need a doctor's sign-off; this
// file exists so that when they arrive, the shape that records them already
// preserves the things that are easy to lose.
//
// ══ THE INVARIANT THIS PROTECTS ═════════════════════════════════════════════
//
// A substitution must never overwrite the prescription. What the doctor chose
// and what the patient received are two different facts, and a system that
// stores only the second cannot answer "was this what was ordered?" — which is
// the question that matters in a clinical supply chain.
//
// So every field below is additive: the prescribed kit and its raw identifier
// survive alongside the alternative, forever.

import type { KitIdentityStatus } from "./kitIdentity";

/** Why an alternative was offered. Extended when the owner defines the set. */
export type SubstitutionReason =
  | "LOWER_COST_ALTERNATIVE"
  | "OUT_OF_STOCK"
  | "KIT_DISCONTINUED"
  | "PATIENT_PREFERENCE"
  | "CLINICAL_EQUIVALENT";

export type SubstitutionApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING_DOCTOR_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export interface KitSubstitution {
  // ── What was prescribed. Never mutated. ──────────────────────────────────
  /** The raw identifier from the clinical system, exactly as stored. */
  prescribedSourceIdentifierSnapshot: string;
  /** Canonical id of the prescribed kit; null if identity was never resolved. */
  prescribedCanonicalKitId: string | null;
  prescribedIdentityStatus: KitIdentityStatus;

  // ── What is being offered instead. ───────────────────────────────────────
  /** Canonical id of the alternative. Never a free-text name. */
  alternativeCanonicalKitId: string;
  reason: SubstitutionReason;
  /** Free text for the reason, shown to the doctor reviewing it. */
  reasonNote: string | null;

  // ── Who has to agree, and did they. ──────────────────────────────────────
  /**
   * Whether this substitution needs a doctor's sign-off. Set from the owner's
   * rules per alternative — never inferred from price or similarity.
   */
  requiresDoctorApproval: boolean;
  approvalStatus: SubstitutionApprovalStatus;
  approvedByDoctorId: string | null;
  approvedAt: string | null;

  // ── What was actually supplied. ──────────────────────────────────────────
  /**
   * The kit the patient received. Null until fulfilment.
   *
   * Deliberately separate from `alternativeCanonicalKitId`: an alternative can
   * be offered and then not used, and a record that collapses "offered" into
   * "supplied" cannot tell the difference.
   */
  finalSuppliedCanonicalKitId: string | null;
}

/**
 * A substitution may reach the patient only when it is either not subject to
 * approval or has been approved. Pending and rejected both block.
 *
 * Pure, and intentionally the only place this rule is written down.
 */
export function isSubstitutionUsable(sub: KitSubstitution): boolean {
  if (!sub.requiresDoctorApproval) return sub.approvalStatus !== "REJECTED";
  return sub.approvalStatus === "APPROVED";
}
