import type { StatusTone } from "@/components/ui/status-badge";

// Single source of truth for the doctor-facing workflow state.
//
// Rationale: three internal enums (AssessmentStatus, ReviewDecision,
// ConsultationApprovalStatus) can produce paradoxical pairs on the wire —
// COMPLETED + PENDING is the *default* "needs review" state, and rendering
// "Completed / Pending" side-by-side reads as broken. This composer collapses
// them into one label the clinician understands.
//
// Rules:
//   1. Approval is the strongest signal — if the doctor has decided, we show
//      that decision (Report preparing / Report ready / Revision requested).
//   2. Otherwise the assessment lifecycle drives the label.
//   3. "Report ready" ≠ "Report delivered". Delivery is a distinct business
//      state we do not yet track; do not fabricate certainty.

export type WorkflowLabel = { label: string; tone: StatusTone };

type Input = {
  assessmentStatus?: string | null;
  reviewDecision?: string | null;
  approvalStatus?: string | null;
  informationRequired?: boolean;
};

export function composeWorkflowLabel(input: Input): WorkflowLabel {
  const status = (input.assessmentStatus ?? "").toUpperCase();
  const decision = (input.reviewDecision ?? "").toUpperCase();
  const approval = (input.approvalStatus ?? "").toUpperCase();

  if (input.informationRequired) {
    return { label: "Information required", tone: "warning" };
  }

  if (status === "FAILED") {
    return { label: "Report generation needs attention", tone: "danger" };
  }
  if (status === "PARTIAL_FAILURE") {
    return { label: "Report generation needs attention", tone: "warning" };
  }

  if (approval === "REVISION_REQUESTED" || decision === "EDITS_REQUESTED") {
    return { label: "Revision requested", tone: "warning" };
  }
  if (approval === "REJECTED" || decision === "REJECTED") {
    return { label: "Rejected", tone: "danger" };
  }

  if (decision === "APPROVED" || approval === "APPROVED") {
    if (status === "REPORT_GENERATING") {
      return { label: "Report preparing", tone: "info" };
    }
    if (status === "COMPLETED") {
      // Deliberately "ready", not "delivered" — we do not yet track the
      // actual delivery event.
      return { label: "Report ready", tone: "success" };
    }
    return { label: "Doctor approved", tone: "success" };
  }

  if (
    status === "CLINICAL_READY" ||
    status === "COMPLETED" ||
    status === "GENERATING_REPORT"
  ) {
    return { label: "Ready for doctor review", tone: "warning" };
  }
  if (status === "PENDING" || status === "QUEUED") {
    return { label: "Awaiting assessment", tone: "neutral" };
  }
  if (
    status === "NORMALIZING" ||
    status === "RUNNING_CLINICAL_ENGINE" ||
    status === "GENERATING_RECOMMENDATIONS" ||
    status === "GENERATING_NARRATIVE" ||
    status === "GENERATING_VIDEO_SCRIPT" ||
    status === "RENDERING_VIDEO"
  ) {
    return { label: "Analysis in progress", tone: "info" };
  }

  return { label: "In review", tone: "neutral" };
}

// Operational reason for the queue "Reason" column.
//
// This is not a clinical classifier — it explains *what stage* is holding the
// case, not *what illness* the patient has. Real clinical priority arrives in
// Phase 1A via the priority classifier and a dedicated Assessment field.
export function composeOperationalReason(input: Input): string | null {
  const status = (input.assessmentStatus ?? "").toUpperCase();
  const decision = (input.reviewDecision ?? "").toUpperCase();
  const approval = (input.approvalStatus ?? "").toUpperCase();

  if (input.informationRequired) return "Information incomplete";
  if (status === "FAILED" || status === "PARTIAL_FAILURE") {
    return "Report generation needs attention";
  }
  if (approval === "REVISION_REQUESTED" || decision === "EDITS_REQUESTED") {
    return "Revision requested";
  }
  if (
    (decision === "PENDING" || decision === "" ) &&
    (status === "CLINICAL_READY" ||
      status === "COMPLETED" ||
      status === "GENERATING_REPORT")
  ) {
    return "Doctor approval pending";
  }
  return null;
}
