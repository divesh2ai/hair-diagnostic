// POST /api/consultation/[assessmentId]/approve
//
// Canonical approval action for the doctor workspace. Approval updates the
// Consultation's version approval state via the orchestrator (the single
// source of truth). We also mirror the decision onto the legacy
// Assessment.reviewDecision flag so the existing reports list / badges — which
// still filter on that workflow column — stay consistent. The flag is a
// workflow marker, NOT clinical content; no diagnosis/treatment is duplicated.
//
// Accepted statuses (doctor UI vocabulary → underlying enum):
//   • APPROVED         → ConsultationApprovalStatus.APPROVED
//   • NEEDS_REVISION   → ConsultationApprovalStatus.REVISION_REQUESTED (alias)
//   • REVISION_REQUESTED → REVISION_REQUESTED (back-compat)
//   • REJECTED         → REJECTED (back-compat; the doctor pilot UI uses
//                        NEEDS_REVISION instead — REJECTED is retained for
//                        the WhatsApp review-token flow only)
//
// NEEDS_REVISION requires a structured `revisionReason` (enum) AND a free-text
// note. The reason is persisted alongside the approval notes so the audit row
// carries the doctor's rationale.

import { NextResponse } from "next/server";
import { ReviewDecision } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import {
  makeOrchestrator,
  OrchestratorError,
  ReadinessBlockedError,
  type ApprovalStatus,
} from "@hairos/packages/consultation-orchestrator";
import { consultationMeta } from "@/lib/consultation/meta";
import { logLifecycleEvent } from "@/lib/observability/lifecycle";
import { writeAuditLog, type AuditAction } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

const orchestrator = makeOrchestrator(prisma);

type ApiStatus =
  | "APPROVED"
  | "NEEDS_REVISION"
  | "REVISION_REQUESTED"
  | "REJECTED";

const VALID_API_STATUSES: ReadonlySet<ApiStatus> = new Set<ApiStatus>([
  "APPROVED",
  "NEEDS_REVISION",
  "REVISION_REQUESTED",
  "REJECTED",
]);

const API_TO_APPROVAL: Record<ApiStatus, ApprovalStatus> = {
  APPROVED: "APPROVED",
  NEEDS_REVISION: "REVISION_REQUESTED",
  REVISION_REQUESTED: "REVISION_REQUESTED",
  REJECTED: "REJECTED",
};

const MAX_NOTES = 2000;

// Canonical ApprovalStatus → legacy ReviewDecision workflow flag.
const DECISION_MAP: Record<ApprovalStatus, ReviewDecision> = {
  APPROVED: ReviewDecision.APPROVED,
  REVISION_REQUESTED: ReviewDecision.EDITS_REQUESTED,
  REJECTED: ReviewDecision.REJECTED,
};

// Structured revision reasons. Constrained set so downstream analytics /
// learning-loop tooling can aggregate without free-text parsing.
type RevisionReason =
  | "RECOMMENDATION_WRONG"
  | "SAFETY_CONCERN"
  | "CLINICAL_INTERPRETATION"
  | "REPORT_QUALITY"
  | "OTHER";
const VALID_REVISION_REASONS: ReadonlySet<RevisionReason> = new Set<RevisionReason>([
  "RECOMMENDATION_WRONG",
  "SAFETY_CONCERN",
  "CLINICAL_INTERPRETATION",
  "REPORT_QUALITY",
  "OTHER",
]);

function auditActionFor(apiStatus: ApiStatus): AuditAction {
  switch (apiStatus) {
    case "APPROVED":
      return "CONSULTATION_APPROVED";
    case "NEEDS_REVISION":
    case "REVISION_REQUESTED":
      return "CONSULTATION_NEEDS_REVISION";
    case "REJECTED":
      return "CONSULTATION_REJECTED";
  }
}

export async function POST(
  req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  let auth;
  try {
    auth = await getClinicContext();
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }

  const { assessmentId } = await ctxParam.params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    notes?: string;
    revisionReason?: string;
  };

  const apiStatus = body.status as ApiStatus | undefined;
  if (!apiStatus || !VALID_API_STATUSES.has(apiStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const status = API_TO_APPROVAL[apiStatus];

  const notes = (body.notes ?? "").slice(0, MAX_NOTES);
  const isRevision =
    apiStatus === "NEEDS_REVISION" || apiStatus === "REVISION_REQUESTED";

  if (isRevision || apiStatus === "REJECTED") {
    if (notes.trim().length === 0) {
      return NextResponse.json(
        {
          error: "notes_required",
          message: "Reject / needs-revision requires a note",
        },
        { status: 400 },
      );
    }
  }

  let revisionReason: RevisionReason | null = null;
  if (isRevision) {
    const raw = body.revisionReason;
    if (typeof raw !== "string" || !VALID_REVISION_REASONS.has(raw as RevisionReason)) {
      return NextResponse.json(
        {
          error: "revision_reason_required",
          message:
            "Needs-revision requires revisionReason ∈ RECOMMENDATION_WRONG, SAFETY_CONCERN, CLINICAL_INTERPRETATION, REPORT_QUALITY, OTHER",
        },
        { status: 400 },
      );
    }
    revisionReason = raw as RevisionReason;
  }

  try {
    // Embed the structured revision reason into the persisted notes so it
    // travels with the version. The doctor-facing note stays first for
    // readability; the reason is appended in a machine-parseable tag.
    const persistedNotes = revisionReason
      ? `${notes}\n\n[revisionReason:${revisionReason}]`
      : notes || undefined;

    const stored = await orchestrator.approve({
      assessmentId,
      ctx: {
        actorId: auth.userId ?? "system",
        role: auth.role,
        clinicId: auth.clinicId ?? null,
      },
      status,
      notes: persistedNotes,
    });

    // Mirror onto the legacy workflow flag so the reports inbox stays in sync.
    await prisma.assessment
      .update({
        where: { id: assessmentId },
        data: {
          reviewDecision: DECISION_MAP[status],
          reviewerName: auth.userId ?? null,
          reviewNotes: notes,
          reviewedAt: new Date(),
        },
      })
      .catch(() => {
        // The consultation approval already succeeded and is the source of
        // truth; a legacy-flag write failure must not fail the request.
      });

    await writeAuditLog({
      action: auditActionFor(apiStatus),
      entityType: "Consultation",
      entityId: stored.consultationId,
      actorId: auth.userId ?? null,
      actorRole: auth.role,
      actorType: "doctor",
      assessmentId,
      metadata: {
        clinicId: auth.clinicId ?? null,
        contentVersion: stored.contentVersion,
        approvalStatus: stored.metadata.approvalStatus ?? null,
        revisionReason,
      },
    }).catch((err) => {
      console.error("[approve] Audit write failed:", err);
    });

    logLifecycleEvent({
      event: isRevision
        ? "consultation.needs_revision"
        : apiStatus === "APPROVED"
          ? "consultation.approved"
          : "consultation.rejected",
      assessmentId,
      clinicId: auth.clinicId ?? null,
      statusAfter: status,
    });

    return NextResponse.json({
      consultation: stored.content,
      meta: consultationMeta(stored),
    });
  } catch (err) {
    if (err instanceof ReadinessBlockedError) {
      logLifecycleEvent({
        event: "consultation.approval_blocked",
        assessmentId,
        clinicId: auth.clinicId ?? null,
        failureCode: err.decision.blockingCodes.includes("GROUNDING_VIOLATION_PRESENT")
          ? "grounding_violation"
          : "reasoning_gap",
      });
      return NextResponse.json(
        {
          error: "readiness_blocked",
          code: "readiness_blocked",
          message: err.decision.doctorSummary,
          blockingCodes: err.decision.blockingCodes,
          groundingViolationCount: err.decision.groundingViolationCount,
          reasoningGapCount: err.decision.reasoningGapCount,
          groundingViolations: err.decision.groundingViolations,
          reasoningGaps: err.decision.reasoningGaps,
        },
        { status: 422 },
      );
    }
    if (err instanceof OrchestratorError) {
      const code = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400;
      logLifecycleEvent({
        event: "consultation.approval_blocked",
        assessmentId,
        clinicId: auth.clinicId ?? null,
        failureCode:
          err.code === "not_found"
            ? "not_found"
            : err.code === "forbidden"
              ? "cross_clinic"
              : "state_ineligible",
      });
      return NextResponse.json({ error: err.code, message: err.message }, { status: code });
    }
    throw err;
  }
}
