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
    // The doctor is already inside their own workspace — "for doctor review"
    // states the obvious and reads like orchestration jargon.
    return { label: "Ready for review", tone: "warning" };
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

// composeOperationalReason() was removed deliberately.
//
// It computed a second line from the same three enums composeWorkflowLabel()
// already reads, so every queue row carried the state twice — "Ready for
// doctor review" next to "Doctor approval pending", "Revision requested"
// under "Revision requested". Two labels for one fact reads as a bug, and it
// crowded out the line that actually earns its space: *why* this case needs
// looking at, which comes from the review-pathway classifier via
// lib/doctor/reviewPriority.
//
// Workflow state → composeWorkflowLabel (one label, above).
// Clinical reason → reviewPriority().reason.
