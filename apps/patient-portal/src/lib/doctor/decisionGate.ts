// May the doctor commit this decision right now — and if not, why not.
//
// ── Why this is a function and not a `disabled={...}` expression ────────────
// Approval is a server-side snapshot of the SAVED consultation: the order route
// is handed an expected content version and cuts the kit order from stored
// state. A doctor holding staged, unsaved kit edits who presses Approve is
// therefore approving the PREVIOUS lineup, silently, with no error anywhere.
//
// That is the most dangerous single interaction on this screen, so the rule
// that prevents it lives here as testable logic rather than inline in JSX,
// where a refactor could drop a condition and nothing would fail.
//
// The gate is deliberately conservative: it refuses in the safe direction and
// always supplies the doctor-facing reason alongside the refusal, so the UI
// cannot disable a button without saying why.

import type { DecisionState } from "../../app/doctor/reports/[assessmentId]/sections/DecisionBar";

export interface DecisionGateInput {
  state: DecisionState;
  /** Staged kit edits that have not been committed to a new version. */
  lineupDirty: boolean;
}

export interface DecisionGate {
  /** Whether the approve control may be pressed. */
  canApprove: boolean;
  /**
   * Doctor-facing explanation when `canApprove` is false. Null when approval
   * is available, and null while saving — a spinner already explains itself.
   */
  blockedReason: string | null;
}

export function decisionGate(input: DecisionGateInput): DecisionGate {
  // A decision already in flight. Blocking here is what prevents a second
  // click creating a duplicate approval.
  if (input.state === "saving") {
    return { canApprove: false, blockedReason: null };
  }

  // Terminal: the record already carries a decision. Re-approving would post
  // against a stale version and fail anyway.
  if (input.state === "approved") {
    return { canApprove: false, blockedReason: null };
  }

  // The load-bearing rule. Note it is checked AFTER the terminal states: an
  // approved consultation unmounts the editor, and a stale dirty flag must not
  // resurrect a warning on a case that is already decided.
  if (input.lineupDirty) {
    return {
      canApprove: false,
      blockedReason:
        "Unsaved protocol changes — save the lineup before approving.",
    };
  }

  // "error" is deliberately approvable: a failed save is exactly the state a
  // retry must be possible from.
  return { canApprove: true, blockedReason: null };
}
